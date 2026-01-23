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
    Filter,
    Download,
    Play,
    AlertTriangle
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
    hasMissingTaxTypes?: boolean
    hasMissingAccounts?: boolean
    needsReview?: boolean
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

type AuditFinding = {
    id: string
    date?: string
    description: string
    amount?: number | null
    contact?: string | null
    status?: string | null
    signals: {
        rndCandidate: boolean
        missingTaxType: boolean
        missingAccount: boolean
    }
    keywords: string[]
}

function buildDescription(tx: Transaction): string {
    const lineItem = tx.lineItems?.find(item => item.description)?.description
    return (tx.reference || lineItem || 'Transaction') as string
}

function formatCurrency(value: number | null | undefined): string {
    if (value === null || value === undefined || Number.isNaN(value)) return 'Not available'
    return new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }).format(value)
}

export default function TaxAuditPage() {
    const [connections, setConnections] = useState<Connection[]>([])
    const [activeTenantId, setActiveTenantId] = useState<string>('')
    const [findings, setFindings] = useState<AuditFinding[]>([])
    const [summary, setSummary] = useState<TransactionsSummary | null>(null)
    const [connectionsLoading, setConnectionsLoading] = useState(true)
    const [findingsLoading, setFindingsLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [filterSignal, setFilterSignal] = useState<string>('all')

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

        async function loadFindings(tenantId: string) {
            try {
                setFindingsLoading(true)
                setError(null)
                const res = await fetch(`/api/xero/transactions?tenantId=${encodeURIComponent(tenantId)}`)
                if (!res.ok) {
                    throw new Error('Failed to load transactions')
                }
                const data = await res.json()
                if (!isMounted) return

                const transactions: Transaction[] = data.transactions || []
                const derivedFindings: AuditFinding[] = transactions
                    .filter(tx => tx.analysis?.needsReview)
                    .map(tx => ({
                        id: tx.id,
                        date: tx.date,
                        description: buildDescription(tx),
                        amount: tx.total ?? null,
                        contact: tx.contact || null,
                        status: tx.status || null,
                        signals: {
                            rndCandidate: Boolean(tx.analysis?.isRndCandidate),
                            missingTaxType: Boolean(tx.analysis?.hasMissingTaxTypes),
                            missingAccount: Boolean(tx.analysis?.hasMissingAccounts)
                        },
                        keywords: tx.analysis?.rndKeywordsFound || []
                    }))

                setFindings(derivedFindings)
                setSummary((data.summary || null) as TransactionsSummary | null)
            } catch (err) {
                if (!isMounted) return
                setError(err instanceof Error ? err.message : 'Failed to load audit findings')
                setFindings([])
                setSummary(null)
            } finally {
                if (isMounted) setFindingsLoading(false)
            }
        }

        if (activeTenantId) {
            loadFindings(activeTenantId)
        } else {
            setFindings([])
            setSummary(null)
        }

        return () => {
            isMounted = false
        }
    }, [activeTenantId])

    const filteredFindings = useMemo(() => {
        return findings.filter(finding => {
            if (filterSignal === 'rnd_candidate') return finding.signals.rndCandidate
            if (filterSignal === 'missing_tax_type') return finding.signals.missingTaxType
            if (filterSignal === 'missing_account') return finding.signals.missingAccount
            return true
        })
    }, [findings, filterSignal])

    const totalReviewItems = findings.length
    const missingTaxTypes = findings.filter(f => f.signals.missingTaxType).length
    const missingAccounts = findings.filter(f => f.signals.missingAccount).length
    const rndCandidateSpend = summary?.rndValue
        ?? findings.filter(f => f.signals.rndCandidate).reduce((sum, f) => sum + (f.amount || 0), 0)

    const hasConnections = connections.length > 0
    const loading = connectionsLoading || findingsLoading

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
                        <Link href="/dashboard/rnd" className="sidebar-link">
                            <Beaker className="w-5 h-5" />
                            <span>R&D Assessment</span>
                        </Link>
                        <Link href="/dashboard/audit" className="sidebar-link active">
                            <FileSearch className="w-5 h-5" />
                            <span>Tax Audit</span>
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
                        <h2 className="text-2xl font-bold mb-1">Tax Audit Findings</h2>
                        <p className="text-[var(--text-secondary)]">
                            Findings are derived from your Xero transactions only.
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
                        <button className="btn btn-secondary" disabled>
                            <Download className="w-4 h-4" />
                            Export Report
                        </button>
                        <button className="btn btn-primary" disabled>
                            <Play className="w-4 h-4" />
                            Run Full Audit
                        </button>
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
                            Connect a Xero organization to generate audit findings.
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
                            <div className="text-sm text-[var(--text-secondary)] mb-2">Review Items</div>
                            <div className="text-3xl font-bold text-emerald-400">
                                {loading ? 'Loading...' : totalReviewItems}
                            </div>
                            <div className="text-xs text-[var(--text-muted)]">flagged from Xero data</div>
                        </div>

                        <div className="stat-card xero">
                            <div className="text-sm text-[var(--text-secondary)] mb-2">R&D Candidate Spend</div>
                            <div className="text-3xl font-bold text-sky-400">
                                {loading ? 'Loading...' : formatCurrency(rndCandidateSpend)}
                            </div>
                            <div className="text-xs text-[var(--text-muted)]">sum of flagged transactions</div>
                        </div>

                        <div className="stat-card warning">
                            <div className="text-sm text-[var(--text-secondary)] mb-2">Missing Tax Types</div>
                            <div className="text-3xl font-bold text-amber-400">
                                {loading ? 'Loading...' : missingTaxTypes}
                            </div>
                            <div className="text-xs text-[var(--text-muted)]">GST or BAS codes missing</div>
                        </div>

                        <div className="stat-card danger">
                            <div className="text-sm text-[var(--text-secondary)] mb-2">Missing Accounts</div>
                            <div className="text-3xl font-bold text-red-400">
                                {loading ? 'Loading...' : missingAccounts}
                            </div>
                            <div className="text-xs text-[var(--text-muted)]">account codes not set</div>
                        </div>
                    </div>
                )}

                {/* Filters */}
                {hasConnections && (
                    <div className="flex items-center gap-4 mb-6">
                        <div className="flex items-center gap-2">
                            <Filter className="w-4 h-4 text-[var(--text-muted)]" />
                            <span className="text-sm text-[var(--text-secondary)]">Filter:</span>
                        </div>
                        <select
                            value={filterSignal}
                            onChange={(e) => setFilterSignal(e.target.value)}
                            className="input w-56"
                        >
                            <option value="all">All Signals</option>
                            <option value="rnd_candidate">R&D Candidates</option>
                            <option value="missing_tax_type">Missing Tax Types</option>
                            <option value="missing_account">Missing Accounts</option>
                        </select>
                    </div>
                )}

                {hasConnections && !loading && filteredFindings.length === 0 && (
                    <div className="glass-card p-6 text-center text-[var(--text-secondary)]">
                        No audit findings from Xero data for the current filters.
                    </div>
                )}

                {/* Findings Table */}
                {hasConnections && filteredFindings.length > 0 && (
                    <div className="table-container">
                        <table className="table">
                            <thead>
                                <tr>
                                    <th>Signals</th>
                                    <th>Date</th>
                                    <th>Description</th>
                                    <th>Amount</th>
                                    <th>Status</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredFindings.map((finding) => (
                                    <tr key={finding.id}>
                                        <td>
                                            <div className="flex flex-wrap gap-2">
                                                {finding.signals.rndCandidate && (
                                                    <span className="priority-badge low">R&D Candidate</span>
                                                )}
                                                {finding.signals.missingTaxType && (
                                                    <span className="priority-badge medium">Missing Tax Type</span>
                                                )}
                                                {finding.signals.missingAccount && (
                                                    <span className="priority-badge critical">Missing Account</span>
                                                )}
                                            </div>
                                        </td>
                                        <td>
                                            <span className="text-sm text-[var(--text-secondary)]">
                                                {finding.date ? new Date(finding.date).toLocaleDateString() : 'Not available'}
                                            </span>
                                        </td>
                                        <td>
                                            <div>
                                                <div className="font-medium text-sm">{finding.description}</div>
                                                {finding.contact && (
                                                    <div className="text-xs text-[var(--text-muted)]">
                                                        Contact: {finding.contact}
                                                    </div>
                                                )}
                                                {finding.keywords.length > 0 && (
                                                    <div className="text-xs text-[var(--text-muted)]">
                                                        Keywords: {finding.keywords.join(', ')}
                                                    </div>
                                                )}
                                            </div>
                                        </td>
                                        <td>
                                            <span className="amount">
                                                {formatCurrency(finding.amount ?? null)}
                                            </span>
                                        </td>
                                        <td>
                                            <span className="text-sm text-[var(--text-secondary)]">
                                                {finding.status || 'Not available'}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}

                {/* Legend */}
                {hasConnections && (
                    <div className="mt-8 p-6 rounded-xl bg-[var(--bg-tertiary)] border border-[var(--border-default)]">
                        <h4 className="font-medium mb-4">Signal Definitions</h4>
                        <div className="grid md:grid-cols-3 gap-4 text-sm">
                            <div>
                                <span className="font-medium text-emerald-400">R&D Candidate</span>
                                <p className="text-[var(--text-secondary)]">Keyword-based signal from Xero transaction descriptions.</p>
                            </div>
                            <div>
                                <span className="font-medium text-amber-400">Missing Tax Type</span>
                                <p className="text-[var(--text-secondary)]">Transaction line item without a GST/BAS tax type.</p>
                            </div>
                            <div>
                                <span className="font-medium text-red-400">Missing Account</span>
                                <p className="text-[var(--text-secondary)]">Transaction line item without an account code.</p>
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
