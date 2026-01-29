'use client'

import { useCallback, useEffect, Suspense, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { apiRequest, ApiRequestError } from '@/lib/api/client'
import {
    DollarSign,
    LayoutDashboard,
    Beaker,
    FileSearch,
    TrendingDown,
    Building2,
    Settings,
    RefreshCw,
    Plus,
    CheckCircle,
    AlertTriangle,
    ArrowRight
} from 'lucide-react'

interface Connection {
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

type TransactionsSummary = {
    total: number
    rndCandidates: number
    rndValue: number
    needsReview: number
    missingTaxTypes: number
}

function formatCurrency(value: number | null | undefined): string {
    if (value === null || value === undefined || Number.isNaN(value)) return 'Not available'
    return new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }).format(value)
}

function DashboardContent() {
    const searchParams = useSearchParams()
    const justConnected = searchParams.get('connected') === 'true'

    const [connections, setConnections] = useState<Connection[]>([])
    const [loading, setLoading] = useState(true)
    const [activeConnection, setActiveConnection] = useState<Connection | null>(null)
    const [summary, setSummary] = useState<TransactionsSummary | null>(null)
    const [summaryLoading, setSummaryLoading] = useState(false)
    const [summaryError, setSummaryError] = useState<string | null>(null)

    const fetchSummary = useCallback(async (tenantId: string) => {
        try {
            setSummaryLoading(true)
            setSummaryError(null)
            const data = await apiRequest<{ summary: TransactionsSummary }>(
                `/api/xero/transactions?tenantId=${encodeURIComponent(tenantId)}`
            )
            setSummary(data.summary || null)
        } catch (error) {
            console.error('Failed to fetch summary:', error)
            const errorMessage = error instanceof ApiRequestError
                ? error.message
                : 'Failed to load summary'
            setSummaryError(errorMessage)
            setSummary(null)
        } finally {
            setSummaryLoading(false)
        }
    }, [])

    const fetchConnections = useCallback(async () => {
        try {
            const data = await apiRequest<{ connections: Connection[] }>('/api/xero/organizations')
            setConnections(data.connections || [])
            if (data.connections?.length > 0) {
                const connection = data.connections[0]
                setActiveConnection(connection)
                fetchSummary(connection.tenant_id)
            } else {
                setActiveConnection(null)
                setSummary(null)
            }
        } catch (error) {
            console.error('Failed to fetch connections:', error)
        } finally {
            setLoading(false)
        }
    }, [fetchSummary])

    useEffect(() => {
        fetchConnections()
    }, [fetchConnections])

    function handleSelectConnection(connection: Connection) {
        setActiveConnection(connection)
        fetchSummary(connection.tenant_id)
    }

    const hasConnections = connections.length > 0

    return (
        <div className="flex min-h-screen">
            {/* Sidebar */}
            <aside className="sidebar">
                <div className="p-6">
                    <div className="flex items-center gap-3 mb-8">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-sky-500 to-emerald-500 flex items-center justify-center">
                            <DollarSign className="w-6 h-6 text-white" />
                        </div>
                        <div>
                            <h1 className="font-bold">ATO Optimizer</h1>
                            <p className="text-xs text-[var(--text-muted)]">Tax Intelligence</p>
                        </div>
                    </div>

                    <nav className="space-y-1">
                        <Link href="/dashboard" className="sidebar-link active">
                            <LayoutDashboard className="w-5 h-5" />
                            <span>Dashboard</span>
                        </Link>
                        <Link href="/dashboard/rnd" className="sidebar-link">
                            <Beaker className="w-5 h-5" />
                            <span>R&D Assessment</span>
                        </Link>
                        <Link href="/dashboard/audit" className="sidebar-link">
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
            <main className="ml-[280px] flex-1 p-8">
                {/* Success Banner */}
                {justConnected && (
                    <div className="mb-6 p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center gap-3">
                        <CheckCircle className="w-5 h-5 text-emerald-400" />
                        <span className="text-emerald-400">Xero account connected successfully!</span>
                    </div>
                )}

                {/* Header */}
                <div className="flex items-center justify-between mb-8">
                    <div>
                        <h2 className="text-2xl font-bold mb-1">Tax Optimization Dashboard</h2>
                        <p className="text-[var(--text-secondary)]">
                            {activeConnection
                                ? `Connected to ${activeConnection.organisation_name || activeConnection.tenant_name}`
                                : 'Connect your Xero account to get started'
                            }
                        </p>
                    </div>
                    <div className="flex items-center gap-3">
                        {activeConnection && (
                            <button
                                onClick={fetchConnections}
                                className="btn btn-secondary"
                            >
                                <RefreshCw className="w-4 h-4" />
                                Sync Data
                            </button>
                        )}
                        <Link href="/api/auth/xero" className="btn btn-xero">
                            <Plus className="w-4 h-4" />
                            Add Connection
                        </Link>
                    </div>
                </div>

                {summaryError && (
                    <div className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400">
                        {summaryError}
                    </div>
                )}

                {loading ? (
                    <div className="flex items-center justify-center h-64">
                        <div className="loading-spinner" />
                    </div>
                ) : !hasConnections ? (
                    /* No Connections State */
                    <div className="text-center py-20">
                        <div className="w-20 h-20 rounded-full bg-sky-500/10 flex items-center justify-center mx-auto mb-6">
                            <Building2 className="w-10 h-10 text-sky-400" />
                        </div>
                        <h3 className="text-xl font-semibold mb-3">No Xero Connections</h3>
                        <p className="text-[var(--text-secondary)] mb-8 max-w-md mx-auto">
                            Connect your Xero account to analyze your financial data and
                            discover tax optimization opportunities.
                        </p>
                        <Link href="/api/auth/xero" className="btn btn-xero text-lg px-8 py-4">
                            Connect Xero Account
                            <ArrowRight className="w-5 h-5" />
                        </Link>
                    </div>
                ) : (
                    <>
                        {/* Stats Grid */}
                        <div className="grid md:grid-cols-4 gap-6 mb-8">
                            <div className="stat-card xero">
                                <div className="flex items-center justify-between mb-3">
                                    <span className="text-sm text-[var(--text-secondary)]">Connections</span>
                                    <Building2 className="w-5 h-5 text-sky-400" />
                                </div>
                                <div className="text-3xl font-bold">{connections.length}</div>
                                <div className="text-xs text-[var(--text-muted)]">Xero organization(s)</div>
                            </div>

                            <div className="stat-card accent">
                                <div className="flex items-center justify-between mb-3">
                                    <span className="text-sm text-[var(--text-secondary)]">R&D Candidate Spend</span>
                                    <Beaker className="w-5 h-5 text-emerald-400" />
                                </div>
                                <div className="text-3xl font-bold text-emerald-400">
                                    {summaryLoading ? 'Loading...' : formatCurrency(summary?.rndValue ?? null)}
                                </div>
                                <div className="text-xs text-[var(--text-muted)]">flagged by transaction analysis</div>
                            </div>

                            <div className="stat-card">
                                <div className="flex items-center justify-between mb-3">
                                    <span className="text-sm text-[var(--text-secondary)]">Review Items</span>
                                    <AlertTriangle className="w-5 h-5 text-amber-400" />
                                </div>
                                <div className="text-3xl font-bold">
                                    {summaryLoading ? 'Loading...' : (summary ? summary.needsReview : 'Not available')}
                                </div>
                                <div className="text-xs text-[var(--text-muted)]">requiring manual review</div>
                            </div>

                            <div className="stat-card warning">
                                <div className="flex items-center justify-between mb-3">
                                    <span className="text-sm text-[var(--text-secondary)]">Transactions Scanned</span>
                                    <TrendingDown className="w-5 h-5 text-amber-400" />
                                </div>
                                <div className="text-3xl font-bold">
                                    {summaryLoading ? 'Loading...' : (summary ? summary.total : 'Not available')}
                                </div>
                                <div className="text-xs text-[var(--text-muted)]">current sync window</div>
                            </div>
                        </div>

                        {/* Quick Actions */}
                        <div className="grid md:grid-cols-3 gap-6 mb-8">
                            <Link href="/dashboard/rnd" className="glass-card p-6 hover:border-emerald-500/50 transition-colors">
                                <div className="w-12 h-12 rounded-xl bg-emerald-500/10 flex items-center justify-center mb-4">
                                    <Beaker className="w-6 h-6 text-emerald-400" />
                                </div>
                                <h3 className="font-semibold mb-2">R&D Tax Assessment</h3>
                                <p className="text-sm text-[var(--text-secondary)] mb-4">
                                    Review candidate transactions sourced from Xero data.
                                </p>
                                <div className="flex items-center text-emerald-400 text-sm font-medium">
                                    Start Assessment <ArrowRight className="w-4 h-4 ml-2" />
                                </div>
                            </Link>

                            <Link href="/dashboard/audit" className="glass-card p-6 hover:border-sky-500/50 transition-colors">
                                <div className="w-12 h-12 rounded-xl bg-sky-500/10 flex items-center justify-center mb-4">
                                    <FileSearch className="w-6 h-6 text-sky-400" />
                                </div>
                                <h3 className="font-semibold mb-2">Transaction Audit</h3>
                                <p className="text-sm text-[var(--text-secondary)] mb-4">
                                    Review signals for missing tax types and account codes.
                                </p>
                                <div className="flex items-center text-sky-400 text-sm font-medium">
                                    Run Audit <ArrowRight className="w-4 h-4 ml-2" />
                                </div>
                            </Link>

                            <Link href="/dashboard/losses" className="glass-card p-6 hover:border-amber-500/50 transition-colors">
                                <div className="w-12 h-12 rounded-xl bg-amber-500/10 flex items-center justify-center mb-4">
                                    <TrendingDown className="w-6 h-6 text-amber-400" />
                                </div>
                                <h3 className="font-semibold mb-2">Loss Analysis</h3>
                                <p className="text-sm text-[var(--text-secondary)] mb-4">
                                    View Profit & Loss data from your Xero reports.
                                </p>
                                <div className="flex items-center text-amber-400 text-sm font-medium">
                                    Analyze Losses <ArrowRight className="w-4 h-4 ml-2" />
                                </div>
                            </Link>
                        </div>

                        {/* Connected Organizations */}
                        <div className="glass-card">
                            <div className="p-6 border-b border-[var(--border-default)]">
                                <h3 className="font-semibold">Connected Organizations</h3>
                            </div>
                            <div className="divide-y divide-[var(--border-default)]">
                                {connections.map((conn) => (
                                    <div key={conn.tenant_id} className="p-6 flex items-center justify-between">
                                        <div className="flex items-center gap-4">
                                            <div className="w-12 h-12 rounded-xl bg-sky-500/10 flex items-center justify-center">
                                                <Building2 className="w-6 h-6 text-sky-400" />
                                            </div>
                                            <div>
                                                <div className="font-medium">{conn.organisation_name || conn.tenant_name}</div>
                                                <div className="text-sm text-[var(--text-secondary)]">
                                                    {conn.organisation_type} - {conn.country_code} - {conn.base_currency}
                                                </div>
                                            </div>
                                            {conn.is_demo_company && (
                                                <span className="priority-badge medium">Demo</span>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <span className="text-sm text-[var(--text-muted)]">
                                                Connected {new Date(conn.connected_at).toLocaleDateString()}
                                            </span>
                                            <button
                                                onClick={() => handleSelectConnection(conn)}
                                                className={`btn ${activeConnection?.tenant_id === conn.tenant_id ? 'btn-primary' : 'btn-secondary'}`}
                                            >
                                                {activeConnection?.tenant_id === conn.tenant_id ? 'Active' : 'Select'}
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </>
                )}
            </main>
        </div>
    )
}

function DashboardLoading() {
    return (
        <div className="flex min-h-screen items-center justify-center">
            <div className="loading-spinner" />
        </div>
    )
}

export default function DashboardPage() {
    return (
        <Suspense fallback={<DashboardLoading />}>
            <DashboardContent />
        </Suspense>
    )
}
