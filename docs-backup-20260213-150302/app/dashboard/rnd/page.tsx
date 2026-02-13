/**
 * R&D Risk & Opportunity Assessment - v8.1 Scientific Luxury Tier
 *
 * Deep forensic analysis of eligible R&D activities under Division 355.
 * Data sourced from /api/audit/rnd-summary (real Xero transaction analysis).
 */

'use client'

import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
    Beaker,
    ShieldCheck,
    Zap,
    Clock,
    Microscope,
    Info,
    Download,
    DollarSign,
    ExternalLink,
    ChevronRight,
    AlertTriangle,
    Loader2
} from 'lucide-react'
import Link from 'next/link'
import AnimatedCounter from '@/components/dashboard/AnimatedCounter'
import { TaxDisclaimer } from '@/components/dashboard/TaxDisclaimer'
import { PageSkeleton } from '@/components/skeletons/PageSkeleton'
import { ErrorState } from '@/components/ui/ErrorState'
import { EmptyState } from '@/components/ui/EmptyState'

interface RndProject {
    id: string
    name: string
    category: string
    totalSpend: number
    transactionCount: number
    avgConfidence: number
    financialYears: string[]
    eligibleActivities: string[]
}

interface RndSummary {
    totalProjects: number
    totalEligibleExpenditure: number
    totalEstimatedOffset: number
    offsetRate: number
    projects: RndProject[]
}

const SectionHeading = ({ icon: Icon, title, badge }: { icon: React.ComponentType<{ className?: string }>; title: string; badge?: string }) => (
    <div className="flex items-center justify-between mb-8 pb-4 border-b border-white/10">
        <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-sky-500/10 flex items-center justify-center">
                <Icon className="w-5 h-5 text-sky-400" />
            </div>
            <div>
                <h2 className="text-xl font-bold text-white tracking-tight">{title}</h2>
                <p className="text-[10px] text-white/40 font-mono uppercase tracking-[0.2em]">Division 355 Intelligence</p>
            </div>
        </div>
        {badge && (
            <span className="px-3 py-1 rounded-full bg-sky-500/10 border border-sky-500/20 text-[10px] font-black text-sky-400 uppercase tracking-widest">
                {badge}
            </span>
        )}
    </div>
);

const CriteriaPill = ({ label, score, max = 3 }: { label: string; score: number; max?: number }) => (
    <div className="space-y-2">
        <div className="flex justify-between items-center text-[10px] font-bold uppercase tracking-widest">
            <span className="text-white/60">{label}</span>
            <span className="text-sky-400">{score}/{max}</span>
        </div>
        <div className="flex gap-1">
            {Array.from({ length: max }).map((_, i) => (
                <div
                    key={i}
                    className={`h-1 flex-1 rounded-full transition-all duration-1000 ${i < score ? 'bg-sky-500 shadow-[0_0_8px_rgba(14,165,233,0.5)]' : 'bg-white/5'}`}
                />
            ))}
        </div>
    </div>
);

/** Calculate R&D registration deadline: 10 months after FY end (30 June). */
function getRndDeadline(): { fyLabel: string; deadlineDate: Date; deadlineLabel: string; daysRemaining: number; progressPercent: number } {
    const now = new Date()
    const month = now.getMonth()
    const year = now.getFullYear()

    // Determine the most recent completed FY (or current if past June 30)
    // R&D registration is for the PRIOR completed FY
    const fyStartYear = month >= 6 ? year - 1 : year - 2
    const fyEndYear = fyStartYear + 1
    const fyEndShort = String(fyEndYear).slice(-2)
    const fyLabel = `FY${fyStartYear}-${fyEndShort}`

    // Deadline is 10 months after FY end (30 June) = 30 April next year
    const deadlineDate = new Date(fyEndYear + 1, 3, 30) // April 30 of year after FY end
    const deadlineLabel = `April 30, ${fyEndYear + 1}`

    const msRemaining = deadlineDate.getTime() - now.getTime()
    const daysRemaining = Math.max(0, Math.ceil(msRemaining / (1000 * 60 * 60 * 24)))

    // Progress: 10-month window = ~304 days
    const fyEndDate = new Date(fyEndYear, 5, 30) // June 30
    const totalWindow = deadlineDate.getTime() - fyEndDate.getTime()
    const elapsed = now.getTime() - fyEndDate.getTime()
    const progressPercent = Math.min(100, Math.max(0, (elapsed / totalWindow) * 100))

    return { fyLabel, deadlineDate, deadlineLabel, daysRemaining, progressPercent }
}

/** Convert avgConfidence (0-100) to a 0-3 score for CriteriaPill. */
function confidenceToScore(confidence: number): number {
    if (confidence >= 85) return 3
    if (confidence >= 70) return 2
    if (confidence >= 55) return 1
    return 0
}

export default function RnDAssessmentPage() {
    const [loading, setLoading] = useState(true)
    const [activeTab, setActiveTab] = useState('candidates')
    const [tenantId, setTenantId] = useState<string | null>(null)
    const [rndData, setRndData] = useState<RndSummary | null>(null)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        const fetchTenant = async () => {
            try {
                const res = await fetch('/api/xero/organizations')
                const data = await res.json()
                if (data.connections?.length > 0) {
                    setTenantId(data.connections[0].tenant_id)
                } else {
                    setLoading(false)
                }
            } catch (err) {
                console.error('Failed to fetch tenant:', err)
                setLoading(false)
            }
        }
        fetchTenant()
    }, [])

    const fetchRndData = useCallback(async (id: string) => {
        try {
            setLoading(true)
            const res = await fetch(`/api/audit/rnd-summary?tenantId=${encodeURIComponent(id)}`)
            if (!res.ok) throw new Error('Failed to fetch R&D summary')
            const data: RndSummary = await res.json()
            setRndData(data)
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Unknown error')
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => {
        if (tenantId) {
            fetchRndData(tenantId)
        }
    }, [tenantId, fetchRndData])

    const deadline = useMemo(() => getRndDeadline(), [])

    const avgConfidence = useMemo(() => {
        if (!rndData?.projects?.length) return 0
        const total = rndData.projects.reduce((sum, p) => sum + p.avgConfidence, 0)
        return Math.round(total / rndData.projects.length)
    }, [rndData])

    const hasData = rndData && rndData.projects.length > 0

    const legislativeTestStatuses = useMemo(() => {
        if (!hasData) {
            return [
                { label: 'Experimental Nature', status: 'Pending Analysis' },
                { label: 'Systematic Progression', status: 'Pending Analysis' },
                { label: 'Science Principles', status: 'Pending Analysis' },
                { label: 'High Uncertainty', status: 'Pending Analysis' }
            ]
        }
        // Derive status from average confidence across all projects
        return [
            { label: 'Experimental Nature', status: avgConfidence >= 80 ? 'Evidence Found' : avgConfidence >= 60 ? 'Verifying' : 'Inconclusive' },
            { label: 'Systematic Progression', status: avgConfidence >= 75 ? 'Identified' : avgConfidence >= 55 ? 'Verifying' : 'Inconclusive' },
            { label: 'Science Principles', status: avgConfidence >= 80 ? 'Evidence Found' : avgConfidence >= 60 ? 'Verifying' : 'Inconclusive' },
            { label: 'High Uncertainty', status: avgConfidence >= 85 ? 'Confirmed' : avgConfidence >= 65 ? 'Verifying' : 'Inconclusive' }
        ]
    }, [hasData, avgConfidence])

    if (loading) return <PageSkeleton variant="analysis" />

    if (!tenantId) return (
        <div className="min-h-screen bg-[var(--bg-dashboard)] flex items-center justify-center p-8">
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="glass-card max-w-md p-12 text-center space-y-6 border border-white/10">
                <div className="w-16 h-16 bg-sky-500/10 rounded-2xl flex items-center justify-center mx-auto">
                    <Beaker className="w-8 h-8 text-sky-400" />
                </div>
                <h2 className="text-2xl font-bold text-white">No Connection Detected</h2>
                <p className="text-white/40">Connect your Xero account to identify eligible R&D activities under Division 355.</p>
                <Link href="/dashboard/settings" className="btn btn-primary block w-full">
                    Establish Connection
                </Link>
            </motion.div>
        </div>
    )

    if (error) return (
        <div className="min-h-screen bg-[var(--bg-dashboard)] flex items-center justify-center p-8">
            <ErrorState title="Analysis Error" message={error} onRetry={() => tenantId && fetchRndData(tenantId)} />
        </div>
    )

    const stats = {
        expenditureLive: rndData?.totalEligibleExpenditure ?? 0,
        offsetProjected: rndData?.totalEstimatedOffset ?? 0,
        candidateCount: rndData?.totalProjects ?? 0,
        confidenceScore: avgConfidence
    }

    return (
        <div className="min-h-screen bg-[var(--bg-dashboard)] px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
            <div className="max-w-7xl mx-auto space-y-8 sm:space-y-12">

                {/* Header Section */}
                <div className="flex flex-col md:flex-row justify-between items-start gap-8">
                    <div className="space-y-4">
                        <div className="flex items-center gap-2 text-xs font-bold font-mono text-sky-400 uppercase tracking-[0.3em]">
                            <Beaker className="w-4 h-4" />
                            <span>Forensic R&D Intelligence</span>
                        </div>
                        <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black text-white tracking-tighter">R&D Tax Assessment</h1>
                        <p className="text-white/40 max-w-xl text-lg leading-relaxed font-medium">
                            Real-time identification and qualification of eligible R&D activities under <span className="text-white">Division 355 of the ITAA 1997</span>.
                        </p>
                    </div>

                    <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 w-full sm:w-auto">
                        <button className="btn btn-secondary px-6 border-white/5 py-4 opacity-50 cursor-not-allowed" disabled title="Coming soon">
                            <Download className="w-4 h-4 mr-2" /> Export Schedule (Coming Soon)
                        </button>
                        <button className="btn btn-primary px-8 py-4 shadow-[0_0_50px_rgba(14,165,233,0.3)] opacity-50 cursor-not-allowed" disabled title="Coming soon">
                            Register Activities (Coming Soon) <ChevronRight className="w-4 h-4 ml-2" />
                        </button>
                    </div>
                </div>

                {/* Global Impact Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
                    {[
                        { label: 'Identified Spend (Est.)', value: stats.expenditureLive, format: 'currency' as const, icon: DollarSign, color: 'text-white' },
                        { label: 'Refundable Offset (Est.)', value: stats.offsetProjected, format: 'currency' as const, icon: Zap, color: 'text-emerald-400' },
                        { label: 'Candidate Count', value: stats.candidateCount, format: 'compact' as const, icon: Microscope, color: 'text-sky-400' },
                        { label: 'Avg Confidence', value: stats.confidenceScore, format: 'compact' as const, suffix: "%", icon: ShieldCheck, color: 'text-sky-400' }
                    ].map((stat, i) => (
                        <motion.div
                            key={stat.label}
                            initial={{ opacity: 0, y: 30 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: i * 0.1 }}
                            className="glass-card p-6 border-white/5 hover:border-white/20 transition-all"
                        >
                            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-white/40 mb-3">{stat.label}</p>
                            <div className="flex items-end justify-between">
                                <div className={`text-3xl font-black ${stat.color} font-mono`}>
                                    <AnimatedCounter value={stat.value} format={stat.format} size="lg" />
                                </div>
                                <stat.icon className={`w-5 h-5 ${stat.color} opacity-40`} />
                            </div>
                        </motion.div>
                    ))}
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Main Assessment Engine */}
                    <div className="lg:col-span-2 space-y-8">
                        <div className="glass-card p-0 border-white/5 overflow-hidden">
                            <div className="p-8 bg-white/[0.02] border-b border-white/5 flex justify-between items-center">
                                <div className="flex gap-4">
                                    {['candidates', 'core', 'supporting', 'excluded'].map(tab => (
                                        <button
                                            key={tab}
                                            onClick={() => setActiveTab(tab)}
                                            className={`text-[10px] font-black uppercase tracking-widest px-4 py-2 rounded-lg transition-all ${activeTab === tab ? 'bg-sky-500 text-white' : 'text-white/40 hover:text-white hover:bg-white/5'}`}
                                        >
                                            {tab}
                                        </button>
                                    ))}
                                </div>
                                {hasData && (
                                    <div className="flex gap-2">
                                        <span className="px-3 py-1 rounded bg-amber-500/10 border border-amber-500/20 text-[9px] font-bold text-amber-400 uppercase">
                                            Requires Review
                                        </span>
                                    </div>
                                )}
                            </div>

                            <div className="max-h-[600px] overflow-y-auto scrollbar-thin">
                                <AnimatePresence mode="wait">
                                    {activeTab === 'candidates' && (
                                        <motion.div
                                            key="candidates"
                                            initial={{ opacity: 0 }}
                                            animate={{ opacity: 1 }}
                                            exit={{ opacity: 0 }}
                                            className="divide-y divide-white/5"
                                        >
                                            {hasData ? (
                                                rndData.projects.map((project) => {
                                                    const score = confidenceToScore(project.avgConfidence)
                                                    return (
                                                        <div key={project.id} className="p-8 hover:bg-white/[0.01] transition-colors group">
                                                            <div className="flex justify-between items-start mb-6">
                                                                <div>
                                                                    <h3 className="text-xl font-bold text-white mb-1 group-hover:text-sky-400 transition-colors cursor-pointer">{project.name}</h3>
                                                                    <p className="text-[10px] text-white/40 font-mono uppercase tracking-widest">
                                                                        {project.category} • {project.transactionCount} transactions • {project.financialYears.join(', ')}
                                                                    </p>
                                                                </div>
                                                                <div className="text-right">
                                                                    <p className="text-2xl font-black text-white font-mono">${project.totalSpend.toLocaleString()}</p>
                                                                    <p className="text-[10px] font-bold text-emerald-400 uppercase tracking-tighter">
                                                                        {project.avgConfidence}% Confidence
                                                                    </p>
                                                                </div>
                                                            </div>

                                                            <div className="grid grid-cols-4 gap-4">
                                                                <CriteriaPill label="Uncertainty" score={score} />
                                                                <CriteriaPill label="Systematic" score={Math.min(3, score + (project.avgConfidence >= 75 ? 1 : 0))} />
                                                                <CriteriaPill label="New Knowledge" score={score} />
                                                                <CriteriaPill label="Scientific" score={Math.max(0, score - (project.avgConfidence < 65 ? 1 : 0))} />
                                                            </div>
                                                        </div>
                                                    )
                                                })
                                            ) : (
                                                <EmptyState
                                                    icon={<AlertTriangle className="w-7 h-7" style={{ color: 'var(--accent, #00F5FF)' }} />}
                                                    title="No R&D Candidates Identified"
                                                    message="Run a forensic audit to analyse your transactions for Division 355 eligibility."
                                                    actionLabel="Launch Forensic Scan"
                                                    actionHref="/dashboard/forensic-audit"
                                                />
                                            )}
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </div>
                        </div>
                    </div>

                    {/* Right Pillar: Legislative Guidance & Risks */}
                    <div className="space-y-8">
                        <div className="glass-card p-8 border-white/5 space-y-8">
                            <SectionHeading icon={Info} title="Legislative Test" badge="Division 355" />

                            <div className="space-y-6">
                                <div className="space-y-1">
                                    <h4 className="text-sm font-bold text-white">The Four-Element Test</h4>
                                    <p className="text-xs text-white/40 leading-relaxed">Activities must be core R&D activities conducted for the purpose of generating new knowledge.</p>
                                </div>

                                <div className="space-y-4">
                                    {legislativeTestStatuses.map((item, i) => (
                                        <div key={i} className="flex items-center justify-between p-4 rounded-xl bg-white/5 border border-white/10 hover:border-sky-500/30 transition-all cursor-pointer">
                                            <span className="text-xs font-bold text-white/80">{item.label}</span>
                                            <span className="text-[10px] font-black text-sky-400 uppercase tracking-widest">{item.status}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="pt-8 border-t border-white/10">
                                <a href="https://www.ato.gov.au/businesses-and-organisations/income-deductions-and-concessions/r-and-d-tax-incentive" target="_blank" rel="noopener noreferrer" className="flex items-center justify-between group">
                                    <span className="text-xs font-bold text-white/60 group-hover:text-white transition-colors">Review R&D Guidelines</span>
                                    <ExternalLink className="w-4 h-4 text-white/20 group-hover:text-sky-400 transition-colors" />
                                </a>
                            </div>
                        </div>

                        <div className="p-8 rounded-[40px] bg-sky-500/5 border border-sky-500/20 relative overflow-hidden group">
                            <div className="relative z-10 space-y-4">
                                <div className="w-12 h-12 rounded-2xl bg-sky-500/20 flex items-center justify-center text-sky-400">
                                    <Clock className="w-6 h-6 animate-pulse" />
                                </div>
                                <h3 className="text-lg font-bold text-white">Registration Deadline</h3>
                                <p className="text-xs text-white/60 leading-relaxed">
                                    {deadline.fyLabel} registrations must be lodged with AusIndustry by <span className="text-white font-bold">{deadline.deadlineLabel}</span>.
                                </p>
                                <div className="pt-4">
                                    <div className="h-1 w-full bg-white/10 rounded-full overflow-hidden">
                                        <motion.div initial={{ width: 0 }} animate={{ width: `${deadline.progressPercent}%` }} className="h-full bg-sky-500" />
                                    </div>
                                    <div className="flex justify-between mt-2 text-[9px] font-black text-white/40 uppercase tracking-widest">
                                        <span>{deadline.daysRemaining} Days Remaining</span>
                                        <span>10 Months Limit</span>
                                    </div>
                                </div>
                            </div>
                            <div className="absolute top-0 right-0 w-32 h-32 bg-sky-500/10 blur-[60px] rounded-full group-hover:scale-150 transition-transform duration-1000" />
                        </div>
                    </div>
                </div>

                <TaxDisclaimer />
            </div>
        </div>
    )
}
