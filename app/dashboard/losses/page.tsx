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
    FileText,
    Users
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

type ParsedReportCell = {
    value?: string
}

type ParsedReportRow = {
    account?: string
    values: ParsedReportCell[]
}

type ParsedReportSection = {
    title?: string
    rows: ParsedReportRow[]
    summary?: {
        label?: string
        values: ParsedReportCell[]
    }
}

type ParsedReport = {
    title?: string
    date?: string
    sections: ParsedReportSection[]
} | null

function parseAmount(raw?: string): number | null {
    if (!raw) return null
    const cleaned = raw.replace(/[$,]/g, '').trim()
    if (!cleaned) return null
    const isNegative = cleaned.startsWith('(') && cleaned.endsWith(')')
    const normalized = cleaned.replace(/[()]/g, '')
    const value = Number(normalized)
    if (!Number.isFinite(value)) return null
    return isNegative ? -value : value
}

function getCellValue(cells?: ParsedReportCell[]): number | null {
    if (!cells || cells.length === 0) return null
    return parseAmount(cells[cells.length - 1]?.value)
}

function findSectionTotal(report: ParsedReport, keywords: string[]): number | null {
    if (!report) return null
    const match = report.sections.find(section => {
        const title = section.title?.toLowerCase() || ''
        return keywords.some(keyword => title.includes(keyword))
    })
    if (!match) return null
    if (match.summary?.values) {
        return getCellValue(match.summary.values)
    }
    if (match.rows.length > 0) {
        return getCellValue(match.rows[match.rows.length - 1].values)
    }
    return null
}

function findRowValue(report: ParsedReport, labels: string[]): number | null {
    if (!report) return null
    const normalized = labels.map(label => label.toLowerCase())
    for (const section of report.sections) {
        for (const row of section.rows) {
            const account = row.account?.toLowerCase()
            if (account && normalized.includes(account)) {
                return getCellValue(row.values)
            }
        }
    }
    return null
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

export default function LossAnalysisPage() {
    const [connections, setConnections] = useState<Connection[]>([])
    const [activeTenantId, setActiveTenantId] = useState<string>('')
    const [selectedFY, setSelectedFY] = useState('FY2024-25')
    const [report, setReport] = useState<ParsedReport>(null)
    const [connectionsLoading, setConnectionsLoading] = useState(true)
    const [reportLoading, setReportLoading] = useState(false)
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

        async function loadReport(tenantId: string) {
            try {
                setReportLoading(true)
                setError(null)
                const params = new URLSearchParams({ tenantId, type: 'ProfitAndLoss' })
                const range = getFiscalYearRange(selectedFY)
                if (range) {
                    params.set('fromDate', range.fromDate)
                    params.set('toDate', range.toDate)
                }
                const res = await fetch(`/api/xero/reports?${params.toString()}`)
                if (!res.ok) {
                    throw new Error('Failed to load Profit & Loss report')
                }
                const data = await res.json()
                if (!isMounted) return
                setReport((data.report || null) as ParsedReport)
            } catch (err) {
                if (!isMounted) return
                setError(err instanceof Error ? err.message : 'Failed to load report')
                setReport(null)
            } finally {
                if (isMounted) setReportLoading(false)
            }
        }

        if (activeTenantId) {
            loadReport(activeTenantId)
        } else {
            setReport(null)
        }

        return () => {
            isMounted = false
        }
    }, [activeTenantId, selectedFY])

    const incomeTotal = useMemo(() => findSectionTotal(report, ['income']), [report])
    const expenseTotal = useMemo(() => findSectionTotal(report, ['expense']), [report])
    const netRowValue = useMemo(() => findRowValue(report, ['Net Profit', 'Net Loss']), [report])
    const netDerived = useMemo(() => {
        if (incomeTotal === null || expenseTotal === null) return null
        return incomeTotal - Math.abs(expenseTotal)
    }, [incomeTotal, expenseTotal])
    const netResult = netRowValue ?? netDerived

    const hasConnections = connections.length > 0
    const loading = connectionsLoading || reportLoading

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
                        <Link href="/dashboard" className="sidebar-link">
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
                        <Link href="/dashboard/losses" className="sidebar-link active">
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
                {/* Header */}
                <div className="flex flex-wrap items-center gap-4 mb-8">
                    <Link href="/dashboard" className="btn btn-ghost p-2">
                        <ArrowLeft className="w-5 h-5" />
                    </Link>
                    <div className="flex-1">
                        <h2 className="text-2xl font-bold mb-1">Loss & Loan Analysis</h2>
                        <p className="text-[var(--text-secondary)]">
                            Profit & Loss values sourced directly from Xero reports.
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
                    <div className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400">
                        {error}
                    </div>
                )}

                {!loading && !hasConnections && (
                    <div className="glass-card p-8 text-center">
                        <h3 className="text-lg font-semibold mb-2">No Xero connection</h3>
                        <p className="text-[var(--text-secondary)] mb-6">
                            Connect a Xero organization to load Profit & Loss data.
                        </p>
                        <Link href="/api/auth/xero" className="btn btn-xero">
                            Connect Xero
                        </Link>
                    </div>
                )}

                {/* Stats */}
                {hasConnections && (
                    <div className="grid md:grid-cols-4 gap-6 mb-8">
                        <div className="stat-card">
                            <div className="text-sm text-[var(--text-secondary)] mb-2">Net Result (P&L)</div>
                            <div className="text-3xl font-bold">
                                {loading ? 'Loading...' : formatCurrency(netResult ?? null)}
                            </div>
                            <div className="text-xs text-[var(--text-muted)]">{report?.date || 'Report date not available'}</div>
                        </div>

                        <div className="stat-card accent">
                            <div className="text-sm text-[var(--text-secondary)] mb-2">Total Income</div>
                            <div className="text-3xl font-bold text-emerald-400">
                                {loading ? 'Loading...' : formatCurrency(incomeTotal ?? null)}
                            </div>
                            <div className="text-xs text-[var(--text-muted)]">from Xero Profit & Loss</div>
                        </div>

                        <div className="stat-card warning">
                            <div className="text-sm text-[var(--text-secondary)] mb-2">Total Expenses</div>
                            <div className="text-3xl font-bold text-amber-400">
                                {loading ? 'Loading...' : formatCurrency(expenseTotal ?? null)}
                            </div>
                            <div className="text-xs text-[var(--text-muted)]">from Xero Profit & Loss</div>
                        </div>

                        <div className="stat-card danger">
                            <div className="text-sm text-[var(--text-secondary)] mb-2">Carry-forward Losses</div>
                            <div className="text-xl font-bold text-red-400">Not available</div>
                            <div className="text-xs text-[var(--text-muted)]">requires tax history outside Xero</div>
                        </div>
                    </div>
                )}

                {/* Profit & Loss Summary */}
                {hasConnections && !loading && !report && (
                    <div className="glass-card p-6 text-center text-[var(--text-secondary)]">
                        No Profit & Loss report available for the selected period.
                    </div>
                )}

                {hasConnections && report && (
                    <div className="glass-card mb-8">
                        <div className="p-6 border-b border-[var(--border-default)]">
                            <h3 className="font-semibold flex items-center gap-2">
                                <TrendingDown className="w-5 h-5 text-amber-400" />
                                Profit & Loss Summary
                            </h3>
                        </div>
                        <div className="p-6 grid md:grid-cols-3 gap-6">
                            <div>
                                <div className="text-xs text-[var(--text-muted)] mb-1">Report Title</div>
                                <div className="font-medium">{report.title || 'Profit & Loss'}</div>
                            </div>
                            <div>
                                <div className="text-xs text-[var(--text-muted)] mb-1">Report Date</div>
                                <div className="font-medium">{report.date || 'Not available'}</div>
                            </div>
                            <div>
                                <div className="text-xs text-[var(--text-muted)] mb-1">Net Result</div>
                                <div className="font-medium">{formatCurrency(netResult ?? null)}</div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Shareholder Loans - Division 7A */}
                {hasConnections && (
                    <div className="glass-card mb-8">
                        <div className="p-6 border-b border-[var(--border-default)]">
                            <h3 className="font-semibold flex items-center gap-2">
                                <Users className="w-5 h-5 text-sky-400" />
                                Shareholder Loans - Division 7A Compliance
                            </h3>
                        </div>
                        <div className="p-6">
                            <div className="flex items-start gap-3 p-4 rounded-xl bg-red-500/10 border border-red-500/20">
                                <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                                <div>
                                    <div className="font-medium text-red-400 mb-1">Not available from Xero</div>
                                    <p className="text-sm text-[var(--text-secondary)]">
                                        Division 7A loan compliance requires specific loan agreements and ATO benchmark
                                        rates. This data is not provided by Xero reports and must be supplied from
                                        official records.
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Info Card */}
                {hasConnections && (
                    <div className="glass-card p-6">
                        <div className="flex items-start gap-4">
                            <div className="w-12 h-12 rounded-xl bg-amber-500/10 flex items-center justify-center flex-shrink-0">
                                <FileText className="w-6 h-6 text-amber-400" />
                            </div>
                            <div>
                                <h3 className="font-semibold mb-2">Loss Utilization Strategy</h3>
                                <p className="text-sm text-[var(--text-secondary)] mb-4">
                                    Carry-forward tax losses require historical tax return data and ATO validation.
                                    Connect official sources before calculating utilization strategies.
                                </p>
                                <div className="text-xs text-[var(--text-muted)]">
                                    Reference data must be sourced from ATO or other government records.
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </main>
        </div>
    )
}
