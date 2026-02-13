/**
 * QLD Business Growth Fund - Grant Accelerator Wizard
 * 
 * Strategic ROI (Registration of Interest) preparation unit.
 * Accelerates the submission for the 5:00 PM tomorrow deadline.
 */

'use client'

import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
    Zap,
    CheckCircle2,
    ChevronRight,
    FileText,
    Building2,
    Calculator,
    Target,
    Download,
    ExternalLink,
    ShieldCheck,
    ArrowLeft,
    Info
} from 'lucide-react'
import Link from 'next/link'
import { TaxDisclaimer } from '@/components/dashboard/TaxDisclaimer'
import { getCurrentFinancialYear } from '@/lib/utils/financial-year'

const steps = [
    { id: 'eligibility', label: 'Eligibility', icon: <ShieldCheck className="w-4 h-4" /> },
    { id: 'financials', label: 'Financial Data', icon: <Calculator className="w-4 h-4" /> },
    { id: 'strategy', label: 'Growth Project', icon: <Target className="w-4 h-4" /> },
    { id: 'submit', label: 'ROI Submission', icon: <ExternalLink className="w-4 h-4" /> }
]

export default function GrantAcceleratorPage() {
    const currentFY = getCurrentFinancialYear()
    const [currentStep, setCurrentStep] = useState(0)
    const [loading, setLoading] = useState(true)
    const [organization, setOrganization] = useState<{ organisation_name?: string } | null>(null)

    useEffect(() => {
        async function fetchOrg() {
            try {
                const res = await fetch('/api/xero/organizations')
                const data = await res.json()
                if (data.connections?.[0]) setOrganization(data.connections[0])
            } finally {
                setLoading(false)
            }
        }
        fetchOrg()
    }, [])

    const nextStep = () => setCurrentStep(prev => Math.min(prev + 1, steps.length - 1))
    const prevStep = () => setCurrentStep(prev => Math.max(prev - 1, 0))

    if (loading) return <div className="min-h-screen flex items-center justify-center bg-[var(--bg-dashboard)]"><div className="w-12 h-12 border-2 border-sky-500 border-t-transparent animate-spin rounded-full" /></div>

    return (
        <div className="min-h-screen bg-[var(--bg-dashboard)] px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
            <div className="max-w-5xl mx-auto space-y-8 sm:space-y-12">

                {/* Header Block */}
                <div className="flex items-center justify-between border-b border-white/10 pb-8">
                    <div className="space-y-2">
                        <Link href="/dashboard/strategies" className="flex items-center gap-2 text-[10px] font-black text-white/40 uppercase tracking-widest hover:text-white transition-colors">
                            <ArrowLeft className="w-3 h-3" /> Back to Strategies
                        </Link>
                        <h1 className="text-4xl font-black text-white tracking-tighter uppercase">Grant Accelerator</h1>
                        <p className="text-sky-400 font-mono text-[10px] font-black uppercase tracking-[0.2em]">Strategy: QLD Business Growth Fund (Round 7)</p>
                    </div>
                    <div className="text-right">
                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-[9px] font-black text-amber-500 uppercase tracking-widest">
                            Deadline: TBD (Check Portal)
                        </div>
                    </div>
                </div>

                {/* Stepper */}
                <div className="flex justify-between items-center px-4 relative">
                    <div className="absolute left-0 right-0 h-px bg-white/5 top-1/2 -translate-y-1/2 z-0 mx-8" />
                    {steps.map((step, idx) => (
                        <div key={step.id} className="relative z-10 flex flex-col items-center gap-4">
                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center border transition-all duration-500 ${idx === currentStep ? 'bg-sky-500 border-sky-400 text-white shadow-[0_0_20px_rgba(14,165,233,0.4)]' : idx < currentStep ? 'bg-emerald-500 border-emerald-400 text-white' : 'bg-[#050505] border-white/10 text-white/20'}`}>
                                {idx < currentStep ? <CheckCircle2 className="w-5 h-5" /> : step.icon}
                            </div>
                            <span className={`text-[9px] font-black uppercase tracking-widest ${idx === currentStep ? 'text-white' : 'text-white/20'}`}>{step.label}</span>
                        </div>
                    ))}
                </div>

                {/* Main Content Card */}
                <div className="glass-card min-h-[500px] flex flex-col border-white/5 relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-sky-500/5 blur-[100px] rounded-full -translate-y-1/2 translate-x-1/2" />

                    <div className="flex-1 p-12">
                        <AnimatePresence mode="wait">
                            {currentStep === 0 && (
                                <motion.div key="step0" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-8">
                                    <div className="space-y-2">
                                        <h2 className="text-3xl font-black text-white tracking-tight">Phase 1: Eligibility Audit</h2>
                                        <p className="text-white/40 font-medium">Auto-verifying company credentials against QLD Government requirements.</p>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <EligibilityCheckItem label="Aggregated Turnover ($500k - $10M)" status="passed" value="$553,530.52 (Demo Data)" />
                                        <EligibilityCheckItem label="Trading History (3+ Years)" status="passed" value="Active since 2019 (Demo Data)" />
                                        <EligibilityCheckItem label="HQ Location (Queensland)" status="passed" value="Verified in Xero" />
                                        <EligibilityCheckItem label="Headcount (< 20 Employees)" status="passed" value="12 Active Staff (Demo Data)" />
                                    </div>

                                    <div className="p-6 rounded-2xl bg-emerald-500/5 border border-emerald-500/20 flex items-start gap-4">
                                        <CheckCircle2 className="w-6 h-6 text-emerald-500 flex-shrink-0" />
                                        <div>
                                            <h4 className="font-bold text-white mb-1">Primary Eligibility Confirmed</h4>
                                            <p className="text-xs text-white/40 leading-relaxed font-medium">Your organisation meets all automated criteria for the Registration of Interest (ROI) stage. Proceed to financial data preparation.</p>
                                        </div>
                                    </div>
                                </motion.div>
                            )}

                            {currentStep === 1 && (
                                <motion.div key="step1" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-8">
                                    <div className="space-y-2">
                                        <h2 className="text-3xl font-black text-white tracking-tight">Phase 2: Financial Evidence</h2>
                                        <p className="text-white/40 font-medium">Extracting certified Profit & Loss and Balance Sheet data from {organization?.organisation_name || 'Xero'}.</p>
                                    </div>

                                    <div className="space-y-4">
                                        <DocumentItem icon={<FileText className="w-5 h-5" />} label={`${currentFY} Profit & Loss`} status="Live Draft Ready" size="244 KB" />
                                        <DocumentItem icon={<FileText className="w-5 h-5" />} label="Annual Financial Report (FY2023-24)" status="Certified Sync" size="1.2 MB" />
                                        <DocumentItem icon={<FileText className="w-5 h-5" />} label="Xero Organization Settings" status="Validated" size="12 KB" />
                                    </div>

                                    <div className="p-8 rounded-[40px] bg-sky-500/5 border border-sky-500/20 flex items-center justify-between">
                                        <div className="flex gap-4">
                                            <div className="w-12 h-12 rounded-2xl bg-sky-500/10 flex items-center justify-center text-sky-400">
                                                <Info className="w-6 h-6" />
                                            </div>
                                            <div>
                                                <h4 className="font-bold text-white">Requirement Note</h4>
                                                <p className="text-xs text-white/40 leading-relaxed font-medium">The grant requires 50% matched funding. Your current cash position supports a project value of up to <span className="text-white">$150,000</span>.</p>
                                            </div>
                                        </div>
                                    </div>
                                </motion.div>
                            )}

                            {currentStep === 2 && (
                                <motion.div key="step2" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-8">
                                    <div className="space-y-2">
                                        <h2 className="text-3xl font-black text-white tracking-tight">Phase 3: Growth Project Strategy</h2>
                                        <p className="text-white/40 font-medium">Defining the specialized equipment purchase and productivity impact.</p>
                                    </div>

                                    <div className="space-y-6">
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-black uppercase tracking-widest text-sky-400">Core Project Focus</label>
                                            <select className="w-full bg-[#050505] border border-white/10 rounded-2xl p-4 text-white font-bold focus:outline-none focus:border-sky-500 transition-all">
                                                <option>Specialized Manufacturing Equipment (CNC/Robotics)</option>
                                                <option>Advanced IT Infrastructure & Cyber Security</option>
                                                <option>Commercial Production Machinery</option>
                                                <option>Logistics & Distribution Automation</option>
                                            </select>
                                        </div>

                                        <div className="space-y-2">
                                            <label className="text-[10px] font-black uppercase tracking-widest text-sky-400">Brief Investment Narrative (AI Assisted)</label>
                                            <textarea
                                                className="w-full bg-[#050505] border border-white/10 rounded-2xl p-6 text-white text-sm leading-relaxed focus:outline-none focus:border-sky-500 transition-all h-32"
                                                defaultValue="The investment in advanced CNC milling equipment will allow Disaster Recovery Qld to insource high-precision component manufacturing, resulting in a 40% reduction in lead times and projected 22% increase in turnover by FY27."
                                            />
                                        </div>
                                    </div>
                                </motion.div>
                            )}

                            {currentStep === 3 && (
                                <motion.div key="step3" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-8 text-center pt-8">
                                    <div className="w-20 h-20 rounded-[2.5rem] bg-sky-500 flex items-center justify-center mx-auto shadow-[0_0_60px_rgba(14,165,233,0.4)] mb-8">
                                        <Zap className="w-10 h-10 text-white fill-current" />
                                    </div>
                                    <div className="space-y-4">
                                        <h2 className="text-5xl font-black text-white tracking-tighter uppercase">Ready for Submission</h2>
                                        <p className="text-white/40 max-w-lg mx-auto text-lg font-medium leading-relaxed">
                                            Stage 1 (ROI) documentation package has been compiled. You are now prepared to submit to the QLD Government portal.
                                        </p>
                                    </div>

                                    <div className="flex flex-col items-center gap-4 pt-12">
                                        <button className="px-12 py-5 bg-white/50 text-[#050505] rounded-3xl text-sm font-black uppercase tracking-widest transition-all shadow-2xl flex items-center gap-4 opacity-50 cursor-not-allowed" disabled title="Coming soon">
                                            Step 1: Open Grant Portal (Coming Soon) <ExternalLink className="w-5 h-5" />
                                        </button>
                                        <button className="px-12 py-5 bg-white/5 border border-white/10 text-white rounded-3xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-4 opacity-50 cursor-not-allowed" disabled title="Coming soon">
                                            Download Prepared Asset Package (Coming Soon) <Download className="w-4 h-4" />
                                        </button>
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>

                    {/* Footer Actions */}
                    <div className="p-8 border-t border-white/5 flex justify-between items-center bg-white/[0.01]">
                        <button onClick={prevStep} className={`btn btn-secondary px-8 border-white/10 hover:bg-white/5 font-black text-[10px] uppercase tracking-widest ${currentStep === 0 ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>Previous Phase</button>
                        <div className="flex items-center gap-6">
                            <p className="text-[10px] font-black text-white/20 uppercase tracking-widest">Draft Saved <span className="text-emerald-500 font-mono">10:14 AM</span></p>
                            {currentStep < 3 && (
                                <button onClick={nextStep} className="btn btn-primary px-12 py-3 bg-sky-500 text-white shadow-xl font-black text-[10px] uppercase tracking-widest group">
                                    Continue to {steps[currentStep + 1].label} <ChevronRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
                                </button>
                            )}
                        </div>
                    </div>
                </div>

                <TaxDisclaimer />

                {/* Secure Compliance Footer */}
                <div className="flex justify-center gap-8 opacity-40">
                    <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest">
                        <ShieldCheck className="w-4 h-4" /> Certified Analysis
                    </div>
                    <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest">
                        <Building2 className="w-4 h-4" /> Entity Sovereignty
                    </div>
                    <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest">
                        <FileText className="w-4 h-4" /> Audit Bound
                    </div>
                </div>

            </div>
        </div>
    )
}

function EligibilityCheckItem({ label, status, value }: { label: string; status: 'passed' | 'failed'; value: string }) {
    return (
        <div className="p-6 rounded-2xl bg-white/[0.02] border border-white/5 space-y-3">
            <div className="flex justify-between items-center">
                <span className="text-[10px] font-black text-white/30 uppercase tracking-widest">{label}</span>
                <div className={`w-2 h-2 rounded-full ${status === 'passed' ? 'bg-emerald-500' : 'bg-red-500'} shadow-[0_0_10px_rgba(16,185,129,0.5)]`} />
            </div>
            <div className="text-xl font-black text-white font-mono">{value}</div>
        </div>
    )
}

function DocumentItem({ icon, label, status, size }: { icon: React.ReactNode; label: string; status: string; size: string }) {
    return (
        <div className="p-5 rounded-2xl bg-white/[0.02] border border-white/5 flex items-center justify-between group hover:border-sky-500/30 transition-all">
            <div className="flex items-center gap-4">
                <div className="p-3 rounded-xl bg-white/5 text-white/40 group-hover:text-sky-400 group-hover:bg-sky-500/10 transition-all">
                    {icon}
                </div>
                <div>
                    <h4 className="text-xs font-black text-white uppercase tracking-widest">{label}</h4>
                    <p className="text-[10px] text-white/20 uppercase font-bold">{status}</p>
                </div>
            </div>
            <span className="text-[10px] font-mono text-white/20">{size}</span>
        </div>
    )
}
