'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import {
    DollarSign,
    LayoutDashboard,
    Beaker,
    FileSearch,
    TrendingDown,
    Settings,
    ArrowLeft,
    AlertTriangle,
    Play
} from 'lucide-react'
import { MobileNav } from '@/components/ui/MobileNav'

type Connection = {
    tenant_id: string
    tenant_name: string
    organisation_name: string
    organisation_type: string
    country_code: string
    base_currency: string
    is_demo_company: boolean
    connected_at: string
    updated_at: string
}

type TransactionLineItem = {
    description?: string | null
}

type TransactionAnalysis = {
    isRndCandidate?: boolean
    rndKeywordsFound?: string[]
}

type Transaction = {
    id: string
    date?: string
    reference?: string | null
    contact?: string | null
    total?: number | null
    status?: string | null
    lineItems?: TransactionLineItem[]
    analysis?: TransactionAnalysis
}

type TransactionsSummary = {
    total: number
    rndCandidates: number
    rndValue: number
    needsReview: number
    missingTaxTypes: number
}

function buildDescription(tx: Transaction): string {
    const lineItem = tx.lineItems?.find(item => item.description)?.description
    return (tx.reference || lineItem || 'Transaction') as string
}

function formatCurrency(value: number | null | undefined): string {
    if (value === null || value === undefined || Number.isNaN(value)) return 'Not available'
    return new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }).format(value)
}

function getFiscalYearRange(label: string): { fromDate: string; toDate: string } | null {
    if (label === 'All') return null
    const match = label.match(/^FY(\d{4})-(\d{2})$/)
    if (!match) return null
    const startYear = Number(match[1])
    if (!Number.isFinite(startYear)) return null
    const fromDate = `${startYear}-07-01`
    const toDate = `${startYear + 1}-06-30`
    return { fromDate, toDate }
}

export default function RnDAssessmentPage() {
    const [connections, setConnections] = useState<Connection[]>([])
    const [activeTenantId, setActiveTenantId] = useState<string>('')
    const [selectedFY, setSelectedFY] = useState('FY2024-25')
    const [candidates, setCandidates] = useState<Transaction[]>([])
    const [summary, setSummary] = useState<TransactionsSummary | null>(null)
    const [connectionsLoading, setConnectionsLoading] = useState(true)
    const [candidatesLoading, setCandidatesLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        let isMounted = true

        async function loadConnections() {
            try {
                setConnectionsLoading(true)
                const res = await fetch('/api/xero/organizations')
                if (!res.ok) {
                    throw new Error('Failed to load Xero connections')
                }
                const data = await res.json()
                if (!isMounted) return
                const loaded = (data.connections || []) as Connection[]
                setConnections(loaded)
                if (loaded.length > 0) {
                    setActiveTenantId(loaded[0].tenant_id)
                }
            } catch (err) {
                if (!isMounted) return
                setError(err instanceof Error ? err.message : 'Failed to load connections')
            } finally {
                if (isMounted) setConnectionsLoading(false)
            }
        }

        loadConnections()

        return () => {
            isMounted = false
        }
    }, [])

    useEffect(() => {
        let isMounted = true

        async function loadCandidates(tenantId: string) {
            try {
                setCandidatesLoading(true)
                setError(null)
                const params = new URLSearchParams({ tenantId })
                const range = getFiscalYearRange(selectedFY)
                if (range) {
                    params.set('fromDate', range.fromDate)
                    params.set('toDate', range.toDate)
                }
                const res = await fetch(`/api/xero/transactions?${params.toString()}`)
                if (!res.ok) {
                    throw new Error('Failed to load transactions')
                }
                const data = await res.json()
                if (!isMounted) return
                const transactions: Transaction[] = data.transactions || []
                const rndCandidates = transactions.filter(tx => tx.analysis?.isRndCandidate)
                setCandidates(rndCandidates)
                setSummary((data.summary || null) as TransactionsSummary | null)
            } catch (err) {
                if (!isMounted) return
                setError(err instanceof Error ? err.message : 'Failed to load R&D candidates')
                setCandidates([])
                setSummary(null)
            } finally {
                if (isMounted) setCandidatesLoading(false)
            }
        }

        if (activeTenantId) {
            loadCandidates(activeTenantId)
        } else {
            setCandidates([])
            setSummary(null)
        }

        return () => {
            isMounted = false
        }
    }, [activeTenantId, selectedFY])

    const candidateSpend = useMemo(() => {
        return candidates.reduce((sum, tx) => sum + (tx.total || 0), 0)
    }, [candidates])

    const hasConnections = connections.length > 0
    const loading = connectionsLoading || candidatesLoading

    return (
        <div className="min-h-screen">
            {/* Sidebar */}
            <aside className="sidebar-wide">
                <div className="p-6">
                    <div className="flex items-center gap-3 mb-8">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[var(--accent-primary)] to-[var(--accent-secondary)] flex items-center justify-center">
                            <DollarSign className="w-6 h-6 text-white" />
                        </div>
                        <div>
                            <h1 className="font-bold text-[var(--text-primary)]">ATO Optimizer</h1>
                            <p className="text-xs text-[var(--text-muted)]">Tax Intelligence</p>
                        </div>
                    </div>

                    <nav className="space-y-1">
                        <Link href="/dashboard" className="sidebar-link">
                            <LayoutDashboard className="w-5 h-5" />
                            <span>Dashboard</span>
                        </Link>
                        <Link href="/dashboard/rnd" className="sidebar-link active">
                            <Beaker className="w-5 h-5" />
                            <span>R&D Assessment</span>
                        </Link>
                        <Link href="/dashboard/forensic-audit" className="sidebar-link">
                            <FileSearch className="w-5 h-5" />
                            <span>Forensic Audit</span>
                        </Link>
                        <Link href="/dashboard/losses" className="sidebar-link">
                            <TrendingDown className="w-5 h-5" />
                            <span>Loss Analysis</span>
                        </Link>
                    </nav>
                </div>

                <div className="mt-auto p-6 border-t border-[var(--border-default)]">
                    <Link href="/dashboard/settings" className="sidebar-link">
                        <Settings className="w-5 h-5" />
                        <span>Settings</span>
                    </Link>
                </div>
            </aside>

            {/* Main Content */}
            <main className="main-content-wide">
                {/* Header */}
                <div className="flex flex-wrap items-center gap-4 mb-8">
                    <Link href="/dashboard" className="btn btn-ghost p-2">
                        <ArrowLeft className="w-5 h-5" />
                    </Link>
                    <div className="flex-1">
                        <h2 className="text-2xl font-bold mb-1">R&D Tax Incentive Assessment</h2>
                        <p className="text-[var(--text-secondary)]">
                            Candidates are derived from Xero transaction data only.
                        </p>
                    </div>
                    <div className="flex items-center gap-3">
                        {hasConnections && (
                            <select
                                value={activeTenantId}
                                onChange={(e) => setActiveTenantId(e.target.value)}
                                className="input w-64"
                            >
                                {connections.map(conn => (
                                    <option key={conn.tenant_id} value={conn.tenant_id}>
                                        {conn.organisation_name || conn.tenant_name}
                                    </option>
                                ))}
                            </select>
                        )}
                        <select
                            value={selectedFY}
                            onChange={(e) => setSelectedFY(e.target.value)}
                            className="input w-40"
                        >
                            <option value="FY2024-25">FY2024-25</option>
                            <option value="FY2023-24">FY2023-24</option>
                            <option value="FY2022-23">FY2022-23</option>
                            <option value="All">All</option>
                        </select>
                    </div>
                </div>

                {error && (
                    <div className="alert alert--error mb-6">
                        <AlertTriangle className="w-5 h-5" />
                        {error}
                    </div>
                )}

                {!loading && !hasConnections && (
                    <div className="glass-card p-8 text-center">
                        <h3 className="text-lg font-semibold mb-2">No Xero connection</h3>
                        <p className="text-[var(--text-secondary)] mb-6">
                            Connect a Xero organization to scan for R&D candidates.
                        </p>
                        <Link href="/api/auth/xero" className="btn btn-xero">
                            Connect Xero
                        </Link>
                    </div>
                )}

                {/* Stats */}
                {hasConnections && (
                    <div className="grid md:grid-cols-4 gap-6 mb-8">
                        <div className="stat-card accent">
                            <div className="text-sm text-[var(--text-secondary)] mb-2">Candidate Spend</div>
                            <div className="text-3xl font-bold text-emerald-400">
                                {loading ? 'Loading...' : formatCurrency(candidateSpend)}
                            </div>
                            <div className="text-xs text-[var(--text-muted)]">sum of flagged transactions</div>
                        </div>

                        <div className="stat-card">
                            <div className="text-sm text-[var(--text-secondary)] mb-2">Candidates</div>
                            <div className="text-3xl font-bold">{loading ? 'Loading...' : candidates.length}</div>
                            <div className="text-xs text-[var(--text-muted)]">transactions requiring review</div>
                        </div>

                        <div className="stat-card">
                            <div className="text-sm text-[var(--text-secondary)] mb-2">Transactions Scanned</div>
                            <div className="text-3xl font-bold">
                                {loading ? 'Loading...' : (summary ? summary.total : 'Not available')}
                            </div>
                            <div className="text-xs text-[var(--text-muted)]">current selection</div>
                        </div>

                        <div className="stat-card warning">
                            <div className="text-sm text-[var(--text-secondary)] mb-2">ATO Rate</div>
                            <div className="text-xl font-bold text-amber-400">Not configured</div>
                            <div className="text-xs text-[var(--text-muted)]">official rate required for offsets</div>
                        </div>
                    </div>
                )}

                {/* Candidates List */}
                {hasConnections && !loading && candidates.length === 0 && (
                    <div className="glass-card p-6 text-center text-[var(--text-secondary)]">
                        No R&D candidates found for the selected period.
                    </div>
                )}

                {hasConnections && candidates.length > 0 && (
                    <div className="glass-card mb-8">
                        <div className="p-6 border-b border-[var(--border-default)] flex items-center justify-between">
                            <h3 className="font-semibold">R&D Candidate Transactions</h3>
                            <button className="btn btn-primary" disabled>
                                <Play className="w-4 h-4" />
                                Scan Transactions
                            </button>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="table">
                                <thead>
                                    <tr>
                                        <th>Date</th>
                                        <th>Description</th>
                                        <th>Amount</th>
                                        <th>Keywords</th>
                                        <th>Status</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {candidates.map((tx) => (
                                        <tr key={tx.id}>
                                            <td className="text-sm text-[var(--text-secondary)]">
                                                {tx.date ? new Date(tx.date).toLocaleDateString() : 'Not available'}
                                            </td>
                                            <td>
                                                <div className="font-medium text-sm">{buildDescription(tx)}</div>
                                                {tx.contact && (
                                                    <div className="text-xs text-[var(--text-muted)]">Contact: {tx.contact}</div>
                                                )}
                                            </td>
                                            <td>
                                                <span className="amount">{formatCurrency(tx.total ?? null)}</span>
                                            </td>
                                            <td className="text-sm text-[var(--text-secondary)]">
                                                {tx.analysis?.rndKeywordsFound?.length
                                                    ? tx.analysis.rndKeywordsFound.join(', ')
                                                    : 'None'}
                                            </td>
                                            <td className="text-sm text-[var(--text-secondary)]">
                                                {tx.status || 'Not available'}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {/* Reference Card */}
                {hasConnections && (
                    <div className="glass-card p-6">
                        <div className="flex items-start gap-4">
                            <div className="w-12 h-12 rounded-xl bg-sky-500/10 flex items-center justify-center flex-shrink-0">
                                <AlertTriangle className="w-6 h-6 text-sky-400" />
                            </div>
                            <div>
                                <h3 className="font-semibold mb-2">ATO Guidance Required</h3>
                                <p className="text-sm text-[var(--text-secondary)] mb-4">
                                    R&D eligibility and offsets must be confirmed against official ATO guidance.
                                    No statutory rates are applied unless sourced from government data.
                                </p>
                                <div className="text-xs text-[var(--text-muted)]">
                                    Connect official sources to calculate offsets and eligibility criteria.
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </main>

            {/* Mobile Bottom Navigation */}
            <MobileNav />
        </div>
    )
}
