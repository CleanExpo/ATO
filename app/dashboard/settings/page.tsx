/**
 * Settings & Configuration - v8.1 Scientific Luxury Tier
 * 
 * Central management for business, accountant, and platform integrations.
 */

'use client'

import React, { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import {
    Building2,
    User,
    Mail,
    Save,
    Settings,
    CheckCircle2,
    AlertTriangle,
    LogOut,
    RefreshCw,
    ExternalLink,
    ShieldCheck,
    Zap,
    Loader2,
    CreditCard
} from 'lucide-react'
import Link from 'next/link'

interface XeroConnection {
    tenant_id: string
    tenant_name: string
    organisation_name: string
    country_code: string
    connected_at: string
}

interface QuickBooksConnection {
    tenant_id: string
    realm_id: string
    tenant_name: string
    organisation_name: string
    country_code: string
    connected_at: string
}

interface MYOBConnection {
    user_id: string
    company_file_id: string
    company_file_name: string
    connected_at: string
    api_base_url: string
}

export default function SettingsPage() {
    const [businessName, setBusinessName] = useState('Disaster Recovery Qld')
    const [businessABN, setBusinessABN] = useState('42 633 062 307')
    const [accountantName, setAccountantName] = useState('Peter Turner')
    const [accountantEmail, setAccountantEmail] = useState('peter@tkm.com.au')
    const [accountantFirm, setAccountantFirm] = useState('TKM Accountants')
    const [saved, setSaved] = useState(false)
    const [xeroConnections, setXeroConnections] = useState<XeroConnection[]>([])
    const [xeroLoading, setXeroLoading] = useState(true)
    const [xeroError, setXeroError] = useState<string | null>(null)
    const [quickbooksConnections, setQuickbooksConnections] = useState<QuickBooksConnection[]>([])
    const [quickbooksLoading, setQuickbooksLoading] = useState(true)
    const [quickbooksError, setQuickbooksError] = useState<string | null>(null)
    const [myobConnections, setMyobConnections] = useState<MYOBConnection[]>([])
    const [myobLoading, setMyobLoading] = useState(true)
    const [myobError, setMyobError] = useState<string | null>(null)

    useEffect(() => {
        async function fetchXeroConnections() {
            try {
                const res = await fetch('/api/xero/organizations')
                if (!res.ok) throw new Error(`Failed to fetch connections: ${res.status}`)
                const data = await res.json()
                setXeroConnections(data.connections || [])
            } catch (err) {
                console.error('Error fetching Xero connections:', err)
                setXeroError(err instanceof Error ? err.message : 'Failed to load Xero connections')
            } finally {
                setXeroLoading(false)
            }
        }
        fetchXeroConnections()
    }, [])

    useEffect(() => {
        async function fetchQuickBooksConnections() {
            try {
                // QuickBooks connections stored in same xero_connections table
                const res = await fetch('/api/xero/organizations')
                if (!res.ok) throw new Error(`Failed to fetch connections: ${res.status}`)
                const data = await res.json()
                // Filter for QuickBooks connections (tenant_name contains 'QuickBooks')
                const qbConnections = (data.connections || []).filter(
                    (conn: any) => conn.tenant_name?.includes('QuickBooks') || conn.realm_id
                )
                setQuickbooksConnections(qbConnections)
            } catch (err) {
                console.error('Error fetching QuickBooks connections:', err)
                setQuickbooksError(err instanceof Error ? err.message : 'Failed to load QuickBooks connections')
            } finally {
                setQuickbooksLoading(false)
            }
        }
        fetchQuickBooksConnections()
    }, [])

    useEffect(() => {
        async function fetchMYOBConnections() {
            try {
                const res = await fetch('/api/myob/connections')
                if (!res.ok) throw new Error(`Failed to fetch MYOB connections: ${res.status}`)
                const data = await res.json()
                setMyobConnections(data.connections || [])
            } catch (err) {
                console.error('Error fetching MYOB connections:', err)
                setMyobError(err instanceof Error ? err.message : 'Failed to load MYOB connections')
            } finally {
                setMyobLoading(false)
            }
        }
        fetchMYOBConnections()
    }, [])

    const handleSave = () => {
        setSaved(true)
        setTimeout(() => setSaved(false), 3000)
    }

    return (
        <div className="min-h-screen bg-[var(--bg-dashboard)] px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
            <div className="max-w-5xl mx-auto space-y-8 sm:space-y-12">

                {/* Header Section */}
                <div className="flex flex-col md:flex-row justify-between items-start gap-6 border-b border-white/10 pb-8">
                    <div>
                        <div className="flex items-center gap-2 text-xs font-bold font-mono text-sky-400 uppercase tracking-widest mb-2">
                            <Settings className="w-4 h-4" />
                            <span>System Preferences</span>
                        </div>
                        <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black text-white tracking-tighter">Command Settings</h1>
                        <p className="text-white/40 mt-2 font-medium">Configure entity sovereignty and global orchestration rules.</p>
                    </div>
                    <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 w-full sm:w-auto">
                        <Link href="/auth/logout" className="btn btn-secondary border-white/5 hover:bg-white/5 py-3">
                            <LogOut className="w-4 h-4 mr-2 text-red-500" /> Sign Out
                        </Link>
                        <button onClick={handleSave} className="btn btn-primary px-8 py-3 shadow-[0_0_30px_rgba(14,165,233,0.2)]">
                            <Save className="w-4 h-4 mr-2" /> Save Changes
                        </button>
                    </div>
                </div>

                {saved && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center gap-3 text-emerald-400 font-bold text-sm"
                    >
                        <CheckCircle2 className="w-5 h-5" />
                        Settings synchronized with central intelligence.
                    </motion.div>
                )}

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    {/* Business Details */}
                    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="glass-card p-8 border-white/5 space-y-8">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-sky-500/10 flex items-center justify-center">
                                <Building2 className="w-5 h-5 text-sky-400" />
                            </div>
                            <h3 className="text-xl font-bold text-white tracking-tight">Main Entity Details</h3>
                        </div>

                        <div className="space-y-6">
                            <div className="space-y-2">
                                <label className="text-[10px] font-black uppercase tracking-[0.2em] text-white/40">Registered Business Name</label>
                                <input
                                    type="text"
                                    value={businessName}
                                    onChange={(e) => setBusinessName(e.target.value)}
                                    className="w-full bg-white/5 border border-white/10 rounded-xl px-5 py-3 text-white focus:outline-none focus:border-sky-500/50 transition-all font-medium"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-black uppercase tracking-[0.2em] text-white/40">Australian Business Number (ABN)</label>
                                <input
                                    type="text"
                                    value={businessABN}
                                    onChange={(e) => setBusinessABN(e.target.value)}
                                    className="w-full bg-white/5 border border-white/10 rounded-xl px-5 py-3 text-white focus:outline-none focus:border-sky-500/50 transition-all font-medium font-mono"
                                />
                            </div>
                        </div>
                    </motion.div>

                    {/* Commercial License */}
                    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="glass-card p-8 border-white/5 space-y-8">
                        <div className="flex justify-between items-start">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-sky-500/10 flex items-center justify-center">
                                    <CreditCard className="w-5 h-5 text-sky-400" />
                                </div>
                                <h3 className="text-xl font-bold text-white tracking-tight">Forensic License Matrix</h3>
                            </div>
                            <Link href="/dashboard/pricing" className="text-[10px] font-black uppercase text-sky-400 hover:text-sky-300 transition-colors tracking-widest bg-sky-500/10 px-3 py-1 rounded-full border border-sky-500/20">
                                UPGRADE
                            </Link>
                        </div>

                        <div className="p-6 rounded-2xl bg-white/[0.02] border border-white/10 flex items-center justify-between group">
                            <div className="space-y-1">
                                <span className="text-[10px] font-black text-white/40 uppercase tracking-widest">Active Tier</span>
                                <h4 className="text-lg font-bold text-white flex items-center gap-2">
                                    Business Owner License
                                    <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 uppercase tracking-tighter">Verified</span>
                                </h4>
                            </div>
                            <div className="text-right">
                                <span className="text-[10px] font-black text-white/40 uppercase tracking-widest block">Audit Allocation</span>
                                <span className="text-xl font-mono font-bold text-white">1/1</span>
                            </div>
                        </div>

                        <p className="text-xs text-white/40 leading-relaxed font-medium">
                            Your license entitles you to one comprehensive forensic audit per year. Accountants can unlock bulk discounts ($495) for client on-charging.
                        </p>
                    </motion.div>

                    {/* Accountant Details */}
                    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="glass-card p-8 border-white/5 space-y-8">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center">
                                <User className="w-5 h-5 text-emerald-400" />
                            </div>
                            <h3 className="text-xl font-bold text-white tracking-tight">Professional Collaboration</h3>
                        </div>

                        <div className="space-y-6">
                            <div className="space-y-2">
                                <label className="text-[10px] font-black uppercase tracking-[0.2em] text-white/40">Registered Tax Agent / Accountant</label>
                                <input
                                    type="text"
                                    value={accountantName}
                                    onChange={(e) => setAccountantName(e.target.value)}
                                    className="w-full bg-white/5 border border-white/10 rounded-xl px-5 py-3 text-white focus:outline-none focus:border-emerald-500/50 transition-all font-medium"
                                />
                            </div>
                            <div className="flex gap-4">
                                <div className="space-y-2 flex-1">
                                    <label className="text-[10px] font-black uppercase tracking-[0.2em] text-white/40">Direct Email Address</label>
                                    <input
                                        type="email"
                                        value={accountantEmail}
                                        onChange={(e) => setAccountantEmail(e.target.value)}
                                        className="w-full bg-white/5 border border-white/10 rounded-xl px-5 py-3 text-white focus:outline-none focus:border-emerald-500/50 transition-all font-medium"
                                    />
                                </div>
                                <div className="space-y-2 flex-1">
                                    <label className="text-[10px] font-black uppercase tracking-[0.2em] text-white/40">Accounting Firm</label>
                                    <input
                                        type="text"
                                        value={accountantFirm}
                                        onChange={(e) => setAccountantFirm(e.target.value)}
                                        className="w-full bg-white/5 border border-white/10 rounded-xl px-5 py-3 text-white focus:outline-none focus:border-emerald-500/50 transition-all font-medium"
                                    />
                                </div>
                            </div>
                        </div>
                    </motion.div>
                </div>

                {/* Xero Connection Matrix */}
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="glass-card p-8 border-white/5 space-y-8">
                    <div className="flex justify-between items-center">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-[#13b5ea]/10 flex items-center justify-center">
                                <Building2 className="w-5 h-5 text-[#13b5ea]" />
                            </div>
                            <div>
                                <h3 className="text-xl font-bold text-white tracking-tight">Xero Integration</h3>
                                <p className="text-[10px] text-white/40 font-medium mt-0.5">Financial ledger connectivity</p>
                            </div>
                        </div>
                        <Link href="/api/auth/xero" className="btn btn-secondary border-white/5 hover:border-[#13b5ea]/40 px-6 py-2 text-[10px] font-black uppercase tracking-widest text-[#13b5ea]">
                            <RefreshCw className="w-3 h-3 mr-2" /> Connect Xero
                        </Link>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {xeroLoading ? (
                            <div className="col-span-full py-12 flex flex-col items-center justify-center space-y-4">
                                <Loader2 className="w-8 h-8 animate-spin text-white/20" />
                                <p className="text-xs font-bold text-white/20 uppercase tracking-[0.2em]">Synchronizing Connections</p>
                            </div>
                        ) : xeroConnections.length === 0 ? (
                            <div className="col-span-full py-12 text-center glass-card border-dashed border-white/5">
                                <p className="text-sm text-white/40 font-medium mb-6">No active financial connections found.</p>
                                <Link href="/api/auth/xero" className="btn btn-primary px-8">Initialize Xero OAuth</Link>
                            </div>
                        ) : (
                            xeroConnections.map((conn) => (
                                <div key={conn.tenant_id} className="p-6 rounded-3xl bg-white/[0.02] border border-white/5 space-y-4 group hover:border-emerald-500/30 transition-all">
                                    <div className="flex justify-between items-start">
                                        <div className="space-y-1">
                                            <div className="flex items-center gap-2">
                                                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                                <span className="text-[10px] font-black text-emerald-500 uppercase tracking-widest">Active Connection</span>
                                            </div>
                                            <h4 className="font-bold text-white">{conn.organisation_name}</h4>
                                        </div>
                                        <div className="p-2 rounded-lg bg-white/5">
                                            <ShieldCheck className="w-4 h-4 text-emerald-400 opacity-60" />
                                        </div>
                                    </div>
                                    <div className="pt-4 space-y-3 border-t border-white/5">
                                        <div className="flex justify-between items-center text-[10px]">
                                            <span className="text-white/40 font-bold uppercase">Region</span>
                                            <span className="text-white/60 font-mono">{conn.country_code}</span>
                                        </div>
                                        <div className="flex justify-between items-center text-[10px]">
                                            <span className="text-white/40 font-bold uppercase">Last Sync</span>
                                            <span className="text-white/60 font-mono">{new Date(conn.connected_at).toLocaleDateString()}</span>
                                        </div>
                                    </div>
                                    <button className="w-full py-3 rounded-xl bg-white/5 text-[10px] font-black text-red-400 uppercase tracking-widest hover:bg-red-500/10 transition-colors opacity-0 group-hover:opacity-100">
                                        Disconnect Entity
                                    </button>
                                </div>
                            ))
                        )}
                    </div>
                </motion.div>

                {/* QuickBooks Connection Matrix */}
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }} className="glass-card p-8 border-white/5 space-y-8">
                    <div className="flex justify-between items-center">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-[#2ca01c]/10 flex items-center justify-center">
                                <Building2 className="w-5 h-5 text-[#2ca01c]" />
                            </div>
                            <div>
                                <h3 className="text-xl font-bold text-white tracking-tight">QuickBooks Integration</h3>
                                <p className="text-[10px] text-white/40 font-medium mt-0.5">36% Australian market share</p>
                            </div>
                        </div>
                        <Link href="/api/auth/quickbooks" className="btn btn-secondary border-white/5 hover:border-[#2ca01c]/40 px-6 py-2 text-[10px] font-black uppercase tracking-widest text-[#2ca01c]">
                            <RefreshCw className="w-3 h-3 mr-2" /> Connect QuickBooks
                        </Link>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {quickbooksLoading ? (
                            <div className="col-span-full py-12 flex flex-col items-center justify-center space-y-4">
                                <Loader2 className="w-8 h-8 animate-spin text-white/20" />
                                <p className="text-xs font-bold text-white/20 uppercase tracking-[0.2em]">Synchronizing Connections</p>
                            </div>
                        ) : quickbooksConnections.length === 0 ? (
                            <div className="col-span-full py-12 text-center glass-card border-dashed border-white/5">
                                <div className="mb-4 flex justify-center">
                                    <div className="w-16 h-16 rounded-2xl bg-[#2ca01c]/5 flex items-center justify-center">
                                        <Building2 className="w-8 h-8 text-[#2ca01c]/40" />
                                    </div>
                                </div>
                                <p className="text-sm text-white/40 font-medium mb-2">No QuickBooks connections found.</p>
                                <p className="text-xs text-white/30 mb-6">Connect your QuickBooks Online account to unlock 6 transaction types for comprehensive tax analysis.</p>
                                <Link href="/api/auth/quickbooks" className="btn btn-primary px-8 bg-[#2ca01c] hover:bg-[#2ca01c]/80">
                                    Initialize QuickBooks OAuth
                                </Link>
                            </div>
                        ) : (
                            quickbooksConnections.map((conn) => (
                                <div key={conn.tenant_id} className="p-6 rounded-3xl bg-white/[0.02] border border-white/5 space-y-4 group hover:border-[#2ca01c]/30 transition-all">
                                    <div className="flex justify-between items-start">
                                        <div className="space-y-1">
                                            <div className="flex items-center gap-2">
                                                <div className="w-1.5 h-1.5 rounded-full bg-[#2ca01c]" />
                                                <span className="text-[10px] font-black text-[#2ca01c] uppercase tracking-widest">Active Connection</span>
                                            </div>
                                            <h4 className="font-bold text-white">{conn.organisation_name || conn.tenant_name}</h4>
                                        </div>
                                        <div className="p-2 rounded-lg bg-white/5">
                                            <ShieldCheck className="w-4 h-4 text-[#2ca01c] opacity-60" />
                                        </div>
                                    </div>
                                    <div className="pt-4 space-y-3 border-t border-white/5">
                                        <div className="flex justify-between items-center text-[10px]">
                                            <span className="text-white/40 font-bold uppercase">Realm ID</span>
                                            <span className="text-white/60 font-mono">{conn.realm_id?.slice(0, 12)}...</span>
                                        </div>
                                        <div className="flex justify-between items-center text-[10px]">
                                            <span className="text-white/40 font-bold uppercase">Region</span>
                                            <span className="text-white/60 font-mono">{conn.country_code || 'AU'}</span>
                                        </div>
                                        <div className="flex justify-between items-center text-[10px]">
                                            <span className="text-white/40 font-bold uppercase">Connected</span>
                                            <span className="text-white/60 font-mono">{new Date(conn.connected_at).toLocaleDateString()}</span>
                                        </div>
                                    </div>
                                    <button
                                        onClick={async () => {
                                            if (confirm(`Disconnect ${conn.organisation_name || 'this QuickBooks company'}?`)) {
                                                try {
                                                    const res = await fetch('/api/auth/quickbooks/disconnect', {
                                                        method: 'POST',
                                                        headers: { 'Content-Type': 'application/json' },
                                                        body: JSON.stringify({ tenantId: conn.tenant_id })
                                                    })
                                                    if (res.ok) {
                                                        setQuickbooksConnections(prev => prev.filter(c => c.tenant_id !== conn.tenant_id))
                                                    }
                                                } catch (err) {
                                                    console.error('Disconnect failed:', err)
                                                }
                                            }
                                        }}
                                        className="w-full py-3 rounded-xl bg-white/5 text-[10px] font-black text-red-400 uppercase tracking-widest hover:bg-red-500/10 transition-colors opacity-0 group-hover:opacity-100"
                                    >
                                        Disconnect Company
                                    </button>
                                </div>
                            ))
                        )}
                    </div>

                    {/* Transaction Type Coverage Info */}
                    {quickbooksConnections.length > 0 && (
                        <div className="p-6 rounded-2xl bg-[#2ca01c]/5 border border-[#2ca01c]/10 space-y-4">
                            <div className="flex items-center gap-3">
                                <Zap className="w-5 h-5 text-[#2ca01c]" />
                                <h4 className="text-sm font-bold text-white">100% Transaction Coverage</h4>
                            </div>
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                                {[
                                    'Purchase Transactions',
                                    'Bill Transactions',
                                    'Invoice Transactions',
                                    'Expense Transactions',
                                    'Credit Memo Transactions',
                                    'Journal Entry Transactions'
                                ].map((type) => (
                                    <div key={type} className="flex items-center gap-2 text-xs">
                                        <CheckCircle2 className="w-3 h-3 text-[#2ca01c]" />
                                        <span className="text-white/60 font-medium">{type}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </motion.div>

                {/* MYOB Connection Matrix */}
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="glass-card p-8 border-white/5 space-y-8">
                    <div className="flex justify-between items-center">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-purple-500/10 flex items-center justify-center">
                                <Building2 className="w-5 h-5 text-purple-500" />
                            </div>
                            <div>
                                <h3 className="text-xl font-bold text-white tracking-tight">MYOB Integration</h3>
                                <p className="text-[10px] text-white/40 font-medium mt-0.5">22% Australian market share</p>
                            </div>
                        </div>
                        <Link href="/api/auth/myob/authorize" className="btn btn-secondary border-white/5 hover:border-purple-500/40 px-6 py-2 text-[10px] font-black uppercase tracking-widest text-purple-500">
                            <RefreshCw className="w-3 h-3 mr-2" /> Connect MYOB
                        </Link>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {myobLoading ? (
                            <div className="col-span-full py-12 flex flex-col items-center justify-center space-y-4">
                                <Loader2 className="w-8 h-8 animate-spin text-white/20" />
                                <p className="text-xs font-bold text-white/20 uppercase tracking-[0.2em]">Synchronizing Connections</p>
                            </div>
                        ) : myobConnections.length === 0 ? (
                            <div className="col-span-full py-12 text-center glass-card border-dashed border-white/5">
                                <div className="mb-4 flex justify-center">
                                    <div className="w-16 h-16 rounded-2xl bg-purple-500/5 flex items-center justify-center">
                                        <Building2 className="w-8 h-8 text-purple-500/40" />
                                    </div>
                                </div>
                                <p className="text-sm text-white/40 font-medium mb-2">No MYOB connections found.</p>
                                <p className="text-xs text-white/30 mb-6">Connect your MYOB AccountRight company file to unlock 6 transaction types for comprehensive tax analysis.</p>
                                <Link href="/api/auth/myob/authorize" className="btn btn-primary px-8 bg-purple-500 hover:bg-purple-500/80">
                                    Initialize MYOB OAuth
                                </Link>
                            </div>
                        ) : (
                            myobConnections.map((conn) => (
                                <div key={conn.company_file_id} className="p-6 rounded-3xl bg-white/[0.02] border border-white/5 space-y-4 group hover:border-purple-500/30 transition-all">
                                    <div className="flex justify-between items-start">
                                        <div className="space-y-1">
                                            <div className="flex items-center gap-2">
                                                <div className="w-1.5 h-1.5 rounded-full bg-purple-500" />
                                                <span className="text-[10px] font-black text-purple-500 uppercase tracking-widest">Active Connection</span>
                                            </div>
                                            <h4 className="font-bold text-white">{conn.company_file_name}</h4>
                                        </div>
                                        <div className="p-2 rounded-lg bg-white/5">
                                            <ShieldCheck className="w-4 h-4 text-purple-500 opacity-60" />
                                        </div>
                                    </div>
                                    <div className="pt-4 space-y-3 border-t border-white/5">
                                        <div className="flex justify-between items-center text-[10px]">
                                            <span className="text-white/40 font-bold uppercase">Company File ID</span>
                                            <span className="text-white/60 font-mono">{conn.company_file_id.slice(0, 12)}...</span>
                                        </div>
                                        <div className="flex justify-between items-center text-[10px]">
                                            <span className="text-white/40 font-bold uppercase">Region</span>
                                            <span className="text-white/60 font-mono">AU</span>
                                        </div>
                                        <div className="flex justify-between items-center text-[10px]">
                                            <span className="text-white/40 font-bold uppercase">Connected</span>
                                            <span className="text-white/60 font-mono">{new Date(conn.connected_at).toLocaleDateString()}</span>
                                        </div>
                                    </div>
                                    <button
                                        onClick={async () => {
                                            if (confirm(`Disconnect ${conn.company_file_name}?`)) {
                                                try {
                                                    const res = await fetch('/api/myob/disconnect', {
                                                        method: 'POST',
                                                        headers: { 'Content-Type': 'application/json' },
                                                        body: JSON.stringify({ companyFileId: conn.company_file_id })
                                                    })
                                                    if (res.ok) {
                                                        setMyobConnections(prev => prev.filter(c => c.company_file_id !== conn.company_file_id))
                                                    }
                                                } catch (err) {
                                                    console.error('Disconnect failed:', err)
                                                }
                                            }
                                        }}
                                        className="w-full py-3 rounded-xl bg-white/5 text-[10px] font-black text-red-400 uppercase tracking-widest hover:bg-red-500/10 transition-colors opacity-0 group-hover:opacity-100"
                                    >
                                        Disconnect Company
                                    </button>
                                </div>
                            ))
                        )}
                    </div>

                    {/* Transaction Type Coverage Info */}
                    {myobConnections.length > 0 && (
                        <div className="p-6 rounded-2xl bg-purple-500/5 border border-purple-500/10 space-y-4">
                            <div className="flex items-center gap-3">
                                <Zap className="w-5 h-5 text-purple-500" />
                                <h4 className="text-sm font-bold text-white">100% Transaction Coverage</h4>
                            </div>
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                                {[
                                    'Sale Invoices',
                                    'Purchase Bills',
                                    'Spend Money Transactions',
                                    'Receive Money Transactions',
                                    'General Journals',
                                    'Service Invoices'
                                ].map((type) => (
                                    <div key={type} className="flex items-center gap-2 text-xs">
                                        <CheckCircle2 className="w-3 h-3 text-purple-500" />
                                        <span className="text-white/60 font-medium">{type}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </motion.div>

                {/* Secure Vault Info */}
                <div className="flex items-start gap-4 p-8 rounded-[40px] bg-sky-500/5 border border-sky-500/20">
                    <div className="w-12 h-12 rounded-2xl bg-sky-500/10 flex items-center justify-center flex-shrink-0">
                        <ShieldCheck className="w-6 h-6 text-sky-400" />
                    </div>
                    <div>
                        <h4 className="font-bold text-white mb-1">Encrypted Security Protocol</h4>
                        <p className="text-sm text-white/40 leading-relaxed font-medium">
                            All API credentials and personal identity tokens are stored in the <span className="text-white">Secure Sovereignty Vault</span>. Data transmission uses industry-standard 256-bit encryption with continuous rotational security audits.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    )
}
