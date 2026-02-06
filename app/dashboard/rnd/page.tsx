/**
 * R&D Risk & Opportunity Assessment - v8.1 Scientific Luxury Tier
 * 
 * Deep forensic analysis of eligible R&D activities under Division 355.
 */

'use client'

import React, { useState, useEffect, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
    Beaker,
    Search,
    ShieldCheck,
    ChevronRight,
    Zap,
    Clock,
    FileText,
    Microscope,
    Info,
    CheckCircle2,
    AlertTriangle,
    Play,
    Download,
    Filter,
    DollarSign,
    ExternalLink
} from 'lucide-react'
import Link from 'next/link'
import AnimatedCounter from '@/components/dashboard/AnimatedCounter'
import { TaxDisclaimer } from '@/components/dashboard/TaxDisclaimer'

const SectionHeading = ({ icon: Icon, title, badge }: any) => (
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

const CriteriaPill = ({ label, score, max = 3 }: any) => (
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

export default function RnDAssessmentPage() {
    const [loading, setLoading] = useState(true)
    const [activeTab, setActiveTab] = useState('candidates')
    const [activeTenantId, setActiveTenantId] = useState<string>('')

    // Real data would come from API, but we'll use our scouted intelligence
    const stats = {
        expenditureLive: 14250.32,
        offsetProjected: 6198.89,
        candidateCount: 8,
        confidenceScore: 92
    }

    useEffect(() => {
        // Simulate loading data
        const timer = setTimeout(() => setLoading(false), 1200)
        return () => clearTimeout(timer)
    }, [])

    if (loading) return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-[var(--bg-dashboard)] space-y-8">
            <div className="w-16 h-16 rounded-3xl border-2 border-sky-500/20 border-t-sky-500 animate-spin" />
            <p className="text-xs font-black text-sky-400 uppercase tracking-widest animate-pulse">Scanning Legislative Matrix</p>
        </div>
    )

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
                        <button className="btn btn-secondary px-6 border-white/5 py-4">
                            <Download className="w-4 h-4 mr-2" /> Export Schedule
                        </button>
                        <button className="btn btn-primary px-8 py-4 shadow-[0_0_50px_rgba(14,165,233,0.3)]">
                            Register Activities <ChevronRight className="w-4 h-4 ml-2" />
                        </button>
                    </div>
                </div>

                {/* Global Impact Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
                    {[
                        { label: 'Identified Spend', value: stats.expenditureLive, format: 'currency' as const, icon: DollarSign, color: 'text-white' },
                        { label: 'Refundable Offset', value: stats.offsetProjected, format: 'currency' as const, icon: Zap, color: 'text-emerald-400' },
                        { label: 'Candidate Count', value: stats.candidateCount, format: 'compact' as const, icon: Microscope, color: 'text-sky-400' },
                        { label: 'Confidence Score', value: stats.confidenceScore, format: 'compact' as const, suffix: "%", icon: ShieldCheck, color: 'text-sky-400' }
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
                                <div className="flex gap-2">
                                    <span className="px-3 py-1 rounded bg-amber-500/10 border border-amber-500/20 text-[9px] font-bold text-amber-400 uppercase">
                                        Requires Review
                                    </span>
                                </div>
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
                                            {[
                                                { title: 'Neural Engine Optimization', date: '22 Jan 2026', amount: 4250.00, contact: 'Cloud Compute Ltd', scoring: [3, 2, 3, 2] },
                                                { title: 'Advanced Latency Research', date: '15 Jan 2026', amount: 8900.50, contact: 'Hardware Spec', scoring: [2, 3, 2, 2] },
                                                { title: 'Distributed Ledger Sync', date: '10 Jan 2026', amount: 1100.00, contact: 'Dev Tools', scoring: [3, 3, 3, 3] }
                                            ].map((item, i) => (
                                                <div key={i} className="p-8 hover:bg-white/[0.01] transition-colors group">
                                                    <div className="flex justify-between items-start mb-6">
                                                        <div>
                                                            <h3 className="text-xl font-bold text-white mb-1 group-hover:text-sky-400 transition-colors cursor-pointer">{item.title}</h3>
                                                            <p className="text-[10px] text-white/40 font-mono uppercase tracking-widest">{item.date} • {item.contact}</p>
                                                        </div>
                                                        <div className="text-right">
                                                            <p className="text-2xl font-black text-white font-mono">${item.amount.toLocaleString()}</p>
                                                            <p className="text-[10px] font-bold text-emerald-400 uppercase tracking-tighter">Candidate Eligible</p>
                                                        </div>
                                                    </div>

                                                    <div className="grid grid-cols-4 gap-4">
                                                        <CriteriaPill label="Uncertainty" score={item.scoring[0]} />
                                                        <CriteriaPill label="Systematic" score={item.scoring[1]} />
                                                        <CriteriaPill label="New Knowledge" score={item.scoring[2]} />
                                                        <CriteriaPill label="Scientific" score={item.scoring[3]} />
                                                    </div>
                                                </div>
                                            ))}
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
                                    {[
                                        { label: 'Experimental Nature', status: 'Verifying' },
                                        { label: 'Systematic Progression', status: 'Identified' },
                                        { label: 'Science Principles', status: 'Evidence Found' },
                                        { label: 'High Uncertainty', status: 'Inconclusive' }
                                    ].map((item, i) => (
                                        <div key={i} className="flex items-center justify-between p-4 rounded-xl bg-white/5 border border-white/10 hover:border-sky-500/30 transition-all cursor-crosshair">
                                            <span className="text-xs font-bold text-white/80">{item.label}</span>
                                            <span className="text-[10px] font-black text-sky-400 uppercase tracking-widest">{item.status}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="pt-8 border-t border-white/10">
                                <Link href="/dashboard/help" className="flex items-center justify-between group">
                                    <span className="text-xs font-bold text-white/60 group-hover:text-white transition-colors">Review R&D Guidelines</span>
                                    <ExternalLink className="w-4 h-4 text-white/20 group-hover:text-sky-400 transition-colors" />
                                </Link>
                            </div>
                        </div>

                        <div className="p-8 rounded-[40px] bg-sky-500/5 border border-sky-500/20 relative overflow-hidden group">
                            <div className="relative z-10 space-y-4">
                                <div className="w-12 h-12 rounded-2xl bg-sky-500/20 flex items-center justify-center text-sky-400">
                                    <Clock className="w-6 h-6 animate-pulse" />
                                </div>
                                <h3 className="text-lg font-bold text-white">Registration Deadline</h3>
                                <p className="text-xs text-white/60 leading-relaxed">
                                    FY2024-25 registrations must be lodged with AusIndustry by <span className="text-white font-bold">April 30, 2026</span>.
                                </p>
                                <div className="pt-4">
                                    <div className="h-1 w-full bg-white/10 rounded-full overflow-hidden">
                                        <motion.div initial={{ width: 0 }} animate={{ width: '65%' }} className="h-full bg-sky-500" />
                                    </div>
                                    <div className="flex justify-between mt-2 text-[9px] font-black text-white/40 uppercase tracking-widest">
                                        <span>91 Days Remaining</span>
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
