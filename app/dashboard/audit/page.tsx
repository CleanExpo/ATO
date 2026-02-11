'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { TaxDisclaimer } from '@/components/dashboard/TaxDisclaimer'
import {
    ArrowLeft,
    Filter,
    Download,
    Play,
    AlertTriangle,
    ArrowUpDown,
    ArrowUp,
    ArrowDown,
    ChevronLeft,
    ChevronRight
} from 'lucide-react'

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
    const [sortColumn, setSortColumn] = useState<'date' | 'amount' | 'description'>('date')
    const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc')
    const [currentPage, setCurrentPage] = useState(1)
    const [pageSize, setPageSize] = useState(25)

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

    const sortedFindings = useMemo(() => {
        const sorted = [...filteredFindings].sort((a, b) => {
            let cmp = 0
            if (sortColumn === 'date') {
                const da = a.date ? new Date(a.date).getTime() : 0
                const db = b.date ? new Date(b.date).getTime() : 0
                cmp = da - db
            } else if (sortColumn === 'amount') {
                cmp = (a.amount ?? 0) - (b.amount ?? 0)
            } else if (sortColumn === 'description') {
                cmp = a.description.localeCompare(b.description)
            }
            return sortDirection === 'asc' ? cmp : -cmp
        })
        return sorted
    }, [filteredFindings, sortColumn, sortDirection])

    const totalPages = Math.max(1, Math.ceil(sortedFindings.length / pageSize))
    const safePage = Math.min(currentPage, totalPages)
    const paginatedFindings = useMemo(() => {
        const start = (safePage - 1) * pageSize
        return sortedFindings.slice(start, start + pageSize)
    }, [sortedFindings, safePage, pageSize])

    // Reset to page 1 when filter or sort changes
    useEffect(() => {
        setCurrentPage(1)
    }, [filterSignal, sortColumn, sortDirection])

    function toggleSort(col: 'date' | 'amount' | 'description') {
        if (sortColumn === col) {
            setSortDirection(d => d === 'asc' ? 'desc' : 'asc')
        } else {
            setSortColumn(col)
            setSortDirection(col === 'description' ? 'asc' : 'desc')
        }
    }

    function SortIcon({ col }: { col: 'date' | 'amount' | 'description' }) {
        if (sortColumn !== col) return <ArrowUpDown className="w-3 h-3 ml-1 opacity-40" />
        return sortDirection === 'asc'
            ? <ArrowUp className="w-3 h-3 ml-1 text-sky-400" />
            : <ArrowDown className="w-3 h-3 ml-1 text-sky-400" />
    }

    const totalReviewItems = findings.length
    const missingTaxTypes = findings.filter(f => f.signals.missingTaxType).length
    const missingAccounts = findings.filter(f => f.signals.missingAccount).length
    const rndCandidateSpend = summary?.rndValue
        ?? findings.filter(f => f.signals.rndCandidate).reduce((sum, f) => sum + (f.amount || 0), 0)

    const hasConnections = connections.length > 0
    const loading = connectionsLoading || findingsLoading

    return (
        <div className="min-h-screen">
            {/* Main Content */}
            <main className="main-content" style={{ paddingTop: 'var(--space-3xl)' }}>
                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:flex-wrap items-start sm:items-center gap-4 mb-6 sm:mb-8">
                    <Link href="/dashboard" className="btn btn-ghost p-2">
                        <ArrowLeft className="w-5 h-5" />
                    </Link>
                    <div className="flex-1">
                        <h2 className="text-xl sm:text-2xl font-bold mb-1">Tax Audit Findings</h2>
                        <p className="text-sm sm:text-base text-[var(--text-secondary)]">
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
                        <button
                            className="btn btn-secondary"
                            onClick={async () => {
                                if (!activeTenantId) return;
                                try {
                                    const res = await fetch('/api/reports/generate', {
                                        method: 'POST',
                                        headers: { 'Content-Type': 'application/json' },
                                        body: JSON.stringify({
                                            tenantId: activeTenantId,
                                            reportType: 'pdf',
                                            options: {
                                                includeLegislation: true,
                                                clientFriendly: true
                                            }
                                        })
                                    });
                                    if (res.ok) {
                                        const data = await res.json();
                                        window.open(data.url, '_blank');
                                    }
                                } catch (err) {
                                    console.error('Failed to generate report:', err);
                                }
                            }}
                            disabled={!hasConnections || loading}
                        >
                            <Download className="w-4 h-4" />
                            Export Report
                        </button>
                        <Link
                            href="/dashboard/forensic-audit/shared-links"
                            className="btn btn-secondary border-magenta-500/30 text-magenta-400 hover:bg-magenta-500/10"
                        >
                            <div className="flex items-center gap-2">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                                </svg>
                                <span>Secure Share</span>
                            </div>
                        </Link>
                        <Link
                            href={`/dashboard/forensic-audit?tenantId=${activeTenantId}`}
                            className="btn btn-primary"
                        >
                            <Play className="w-4 h-4" />
                            Run Full Audit
                        </Link>
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
                        <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
                            <span className="text-xs text-[var(--text-muted)]">
                                {sortedFindings.length} result{sortedFindings.length !== 1 ? 's' : ''}
                                {sortedFindings.length !== findings.length && ` (filtered from ${findings.length})`}
                            </span>
                            <div className="flex items-center gap-2">
                                <span className="text-xs text-[var(--text-muted)]">Per page:</span>
                                <select
                                    value={pageSize}
                                    onChange={(e) => { setPageSize(Number(e.target.value)); setCurrentPage(1) }}
                                    className="input w-20 text-xs py-1"
                                >
                                    <option value={25}>25</option>
                                    <option value={50}>50</option>
                                    <option value={100}>100</option>
                                </select>
                            </div>
                        </div>
                        <table className="table" role="grid">
                            <thead>
                                <tr>
                                    <th>Signals</th>
                                    <th>
                                        <button onClick={() => toggleSort('date')} className="flex items-center hover:text-white transition-colors" aria-label="Sort by date">
                                            Date <SortIcon col="date" />
                                        </button>
                                    </th>
                                    <th>
                                        <button onClick={() => toggleSort('description')} className="flex items-center hover:text-white transition-colors" aria-label="Sort by description">
                                            Description <SortIcon col="description" />
                                        </button>
                                    </th>
                                    <th>
                                        <button onClick={() => toggleSort('amount')} className="flex items-center hover:text-white transition-colors" aria-label="Sort by amount">
                                            Amount <SortIcon col="amount" />
                                        </button>
                                    </th>
                                    <th>Status</th>
                                </tr>
                            </thead>
                            <tbody>
                                {paginatedFindings.map((finding, rowIdx) => (
                                    <tr
                                        key={finding.id}
                                        tabIndex={0}
                                        onKeyDown={(e) => {
                                            const rows = e.currentTarget.parentElement?.querySelectorAll('tr[tabindex]')
                                            if (!rows) return
                                            if (e.key === 'ArrowDown' && rowIdx < rows.length - 1) {
                                                e.preventDefault();
                                                (rows[rowIdx + 1] as HTMLElement).focus()
                                            } else if (e.key === 'ArrowUp' && rowIdx > 0) {
                                                e.preventDefault();
                                                (rows[rowIdx - 1] as HTMLElement).focus()
                                            }
                                        }}
                                        className="focus:outline-none focus-visible:ring-1 focus-visible:ring-sky-500/50"
                                    >
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
                        {/* Pagination Controls */}
                        {totalPages > 1 && (
                            <div className="flex items-center justify-between px-4 py-3 border-t border-white/5">
                                <span className="text-xs text-[var(--text-muted)]">
                                    Showing {(safePage - 1) * pageSize + 1}–{Math.min(safePage * pageSize, sortedFindings.length)} of {sortedFindings.length}
                                </span>
                                <div className="flex items-center gap-1">
                                    <button
                                        onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                        disabled={safePage <= 1}
                                        className="btn btn-ghost p-1.5 disabled:opacity-30"
                                        aria-label="Previous page"
                                    >
                                        <ChevronLeft className="w-4 h-4" />
                                    </button>
                                    {Array.from({ length: totalPages }, (_, i) => i + 1)
                                        .filter(p => p === 1 || p === totalPages || Math.abs(p - safePage) <= 1)
                                        .reduce<(number | 'ellipsis')[]>((acc, p, idx, arr) => {
                                            if (idx > 0 && p - (arr[idx - 1]) > 1) acc.push('ellipsis')
                                            acc.push(p)
                                            return acc
                                        }, [])
                                        .map((item, idx) =>
                                            item === 'ellipsis' ? (
                                                <span key={`e${idx}`} className="px-2 text-xs text-[var(--text-muted)]">...</span>
                                            ) : (
                                                <button
                                                    key={item}
                                                    onClick={() => setCurrentPage(item)}
                                                    className={`px-2.5 py-1 text-xs rounded-md transition-colors ${
                                                        safePage === item
                                                            ? 'bg-sky-500 text-white font-bold'
                                                            : 'text-[var(--text-secondary)] hover:text-white hover:bg-white/5'
                                                    }`}
                                                    aria-label={`Page ${item}`}
                                                    aria-current={safePage === item ? 'page' : undefined}
                                                >
                                                    {item}
                                                </button>
                                            )
                                        )}
                                    <button
                                        onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                        disabled={safePage >= totalPages}
                                        className="btn btn-ghost p-1.5 disabled:opacity-30"
                                        aria-label="Next page"
                                    >
                                        <ChevronRight className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                        )}
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

            <TaxDisclaimer />
        </div>
    )
}
