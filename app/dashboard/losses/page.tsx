/**
 * Loss & Loan Analysis - v8.1 Scientific Luxury Tier
 * 
 * Deep forensic analysis of historical losses and shareholder loan compliance (Div 7A).
 */

'use client'

import React, { useState, useEffect, useMemo } from 'react'
import { motion } from 'framer-motion'
import {
    TrendingDown,
    Users,
    AlertTriangle,
    ArrowLeft,
    ChevronRight,
    Info,
    ShieldCheck,
    RefreshCw,
    Clock,
    ChevronDown,
    FileText,
    DollarSign
} from 'lucide-react'
import Link from 'next/link'
import AnimatedCounter from '@/components/dashboard/AnimatedCounter'

const GlassCard = ({ children, className = '', highlight = false }: any) => (
    <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className={`glass-card overflow-hidden border ${highlight ? 'border-sky-500/30 bg-sky-500/5' : 'border-white/10'} ${className}`}
    >
        {children}
    </motion.div>
);

export default function LossAnalysisPage() {
    const [connections, setConnections] = useState<any[]>([])
    const [activeTenantId, setActiveTenantId] = useState<string>('')
    const [selectedFY, setSelectedFY] = useState('FY2024-25')
    const [loading, setLoading] = useState(true)

    // Demo data for the forensic view
    const metrics = {
        netProfit: -42500.20,
        totalIncome: 152000.00,
        totalExpenses: 194500.20,
        carryForwardLosses: 12500.00
    }

    useEffect(() => {
        async function loadData() {
            try {
                const res = await fetch('/api/xero/organizations')
                const data = await res.json()
                const loaded = data.connections || []
                setConnections(loaded)
                if (loaded.length > 0) setActiveTenantId(loaded[0].tenant_id)
            } finally {
                setLoading(false)
            }
        }
        loadData()
    }, [])

    if (loading) return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-[var(--bg-dashboard)] space-y-8">
            <div className="w-16 h-16 rounded-3xl border-2 border-[var(--accent-primary)]/20 border-t-[var(--accent-primary)] animate-spin" />
            <p className="text-xs font-black text-[var(--accent-primary)] uppercase tracking-widest animate-pulse">Syncing Ledger History</p>
        </div>
    )

    return (
        <div className="min-h-screen bg-[var(--bg-dashboard)] px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
            <div className="max-w-7xl mx-auto space-y-8 sm:space-y-12">

                {/* Header Block */}
                <div className="flex flex-col md:flex-row justify-between items-start gap-8 border-b border-white/10 pb-8">
                    <div className="space-y-4">
                        <div className="flex items-center gap-2 text-xs font-bold font-mono text-sky-400 uppercase tracking-widest">
                            <TrendingDown className="w-4 h-4" />
                            <span>Forensic Loss Utilization</span>
                        </div>
                        <h1 className="text-6xl font-black text-white tracking-tighter">Loss & Loan Analysis</h1>
                        <p className="text-white/40 max-w-xl text-lg font-medium leading-relaxed">
                            Audit of carry-forward tax losses and Shareholder Loan compliance under <span className="text-white">Division 7A</span>.
                        </p>
                    </div>

                    <div className="flex items-center gap-4">
                        <select
                            value={activeTenantId}
                            onChange={(e) => setActiveTenantId(e.target.value)}
                            className="bg-white/5 border border-white/10 rounded-2xl px-6 py-4 text-white font-bold text-sm focus:outline-none focus:border-sky-500/50 appearance-none min-w-[200px]"
                        >
                            {connections.map(c => <option key={c.tenant_id} value={c.tenant_id}>{c.organisation_name}</option>)}
                        </select>
                        <select
                            value={selectedFY}
                            onChange={(e) => setSelectedFY(e.target.value)}
                            className="bg-white/10 border border-white/20 rounded-2xl px-6 py-4 text-white font-bold text-sm focus:outline-none focus:border-sky-500 appearance-none"
                        >
                            <option value="FY2024-25">FY2024-25</option>
                            <option value="FY2023-24">FY2023-24</option>
                        </select>
                    </div>
                </div>

                {/* KPI Grid */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                    <GlassCard className="p-8">
                        <p className="text-[10px] font-black uppercase text-white/40 mb-3 tracking-widest">Net Result (P&L)</p>
                        <div className="text-3xl font-black text-red-400 font-mono">
                            <AnimatedCounter value={metrics.netProfit} format="currency" size="lg" />
                        </div>
                    </GlassCard>
                    <GlassCard className="p-8">
                        <p className="text-[10px] font-black uppercase text-white/40 mb-3 tracking-widest">Total Income</p>
                        <div className="text-3xl font-black text-emerald-400 font-mono">
                            <AnimatedCounter value={metrics.totalIncome} format="currency" size="lg" />
                        </div>
                    </GlassCard>
                    <GlassCard className="p-8">
                        <p className="text-[10px] font-black uppercase text-white/40 mb-3 tracking-widest">Total Expenses</p>
                        <div className="text-3xl font-black text-amber-400 font-mono">
                            <AnimatedCounter value={metrics.totalExpenses} format="currency" size="lg" />
                        </div>
                    </GlassCard>
                    <GlassCard className="p-8" highlight>
                        <p className="text-[10px] font-black uppercase text-sky-400 mb-3 tracking-widest">Available Losses</p>
                        <div className="text-3xl font-black text-white font-mono">
                            <AnimatedCounter value={metrics.carryForwardLosses} format="currency" size="lg" />
                        </div>
                    </GlassCard>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Strategy View */}
                    <div className="lg:col-span-2 space-y-8">
                        <GlassCard className="p-8 space-y-8">
                            <div className="flex items-center justify-between border-b border-white/5 pb-6">
                                <h3 className="text-xl font-bold flex items-center gap-2">
                                    <Users className="w-5 h-5 text-sky-400" /> Shareholder Loan Compliance
                                </h3>
                                <div className="px-3 py-1 rounded-full bg-red-500/10 border border-red-500/20 text-[9px] font-black text-red-500 uppercase">
                                    Risk Detected
                                </div>
                            </div>

                            <div className="p-6 rounded-2xl bg-white/[0.02] border border-white/5 space-y-4">
                                <div className="flex items-start gap-4">
                                    <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center flex-shrink-0">
                                        <AlertTriangle className="w-5 h-5 text-amber-400" />
                                    </div>
                                    <div>
                                        <h4 className="font-bold text-white mb-1">Division 7A Breach Risk</h4>
                                        <p className="text-xs text-white/40 leading-relaxed font-medium">
                                            Undocumented payments to shareholders detected in current FY. Without a conforming loan agreement (ITAA97 s109N), these may be treated as deemed dividends.
                                        </p>
                                    </div>
                                </div>
                                <div className="pt-4 flex gap-3">
                                    <button className="btn btn-primary btn-sm px-6">Generate Draft Agreement</button>
                                    <button className="btn btn-secondary btn-sm px-6">Identify Transactions</button>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="p-6 rounded-2xl bg-white/[0.02] border border-white/5 space-y-4">
                                    <h5 className="text-[10px] font-black text-white/40 uppercase tracking-widest">Continuity of Ownership</h5>
                                    <div className="flex items-center justify-between">
                                        <span className="text-2xl font-black text-emerald-400 font-mono">MATCH</span>
                                        <ShieldCheck className="w-5 h-5 text-emerald-400 opacity-40" />
                                    </div>
                                    <p className="text-[10px] text-white/20 uppercase font-bold">Passed (COT Method)</p>
                                </div>
                                <div className="p-6 rounded-2xl bg-white/[0.02] border border-white/5 space-y-4">
                                    <h5 className="text-[10px] font-black text-white/40 uppercase tracking-widest">Business Continuity</h5>
                                    <div className="flex items-center justify-between">
                                        <span className="text-2xl font-black text-sky-400 font-mono">STABLE</span>
                                        <RefreshCw className="w-5 h-5 text-sky-400 opacity-40" />
                                    </div>
                                    <p className="text-[10px] text-white/20 uppercase font-bold">Similar Business Test</p>
                                </div>
                            </div>
                        </GlassCard>
                    </div>

                    {/* Right Column: Legislative Pillar */}
                    <div className="space-y-8">
                        <GlassCard className="p-8 space-y-8">
                            <h3 className="text-lg font-bold flex items-center gap-2">
                                <FileText className="w-5 h-5 text-sky-400" /> Legislative Context
                            </h3>

                            <div className="space-y-6">
                                <div className="space-y-3">
                                    <div className="flex justify-between items-center text-[10px] font-bold text-white/40 uppercase tracking-widest">
                                        <span>Division 7A Benchmark</span>
                                        <span className="text-sky-400">8.27% (FY25)</span>
                                    </div>
                                    <div className="p-4 rounded-xl bg-white/5 border border-white/10 text-[11px] text-white/60 leading-relaxed font-medium">
                                        Minimum Yearly Repayments (MYR) must be calculated using the ATO benchmark rate to avoid deemed dividends under s109E.
                                    </div>
                                </div>

                                <div className="pt-6 border-t border-white/10 space-y-4">
                                    <h4 className="text-[10px] font-black text-white/40 uppercase tracking-widest">Related Laws</h4>
                                    {[
                                        { section: 's109N', label: 'Loan Agreements', status: 'Mandatory' },
                                        { section: 's165-12', label: 'COT Ownership', status: 'Active' },
                                        { section: 's36-17', label: 'Choice to deduct', status: 'Available' }
                                    ].map((item, i) => (
                                        <div key={i} className="flex items-center justify-between p-3 rounded-lg bg-white/5 border border-white/5 hover:border-sky-500/30 transition-all cursor-pointer group">
                                            <span className="text-xs font-bold text-sky-400 group-hover:underline">{item.section}</span>
                                            <span className="text-[10px] font-black text-white/40 uppercase tracking-tighter">{item.label}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </GlassCard>

                        {/* Tactical Alert */}
                        <div className="p-8 rounded-[40px] bg-amber-500/5 border border-amber-500/20 relative overflow-hidden group">
                            <div className="relative z-10 flex gap-4">
                                <div className="w-12 h-12 rounded-2xl bg-amber-500/10 flex items-center justify-center text-amber-500 flex-shrink-0">
                                    <Info className="w-6 h-6" />
                                </div>
                                <div className="space-y-2">
                                    <h4 className="font-bold text-white">Loss Preservation</h4>
                                    <p className="text-xs text-white/40 leading-relaxed font-medium">
                                        Consider <span className="text-amber-400">limiting depreciation</span> or choosing not to deduct losses (s36-17) if it results in excessive franking credits or wasteful loss utilization.
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

            </div>
        </div>
    )
}
