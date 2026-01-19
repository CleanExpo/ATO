'use client'

import { useState } from 'react'
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
    CheckCircle,
    XCircle,
    FileText,
    Users,
    Calendar
} from 'lucide-react'

interface LossYear {
    fy: string
    revenueLoss: number
    capitalLoss: number
    totalLoss: number
    cotSatisfied: boolean
    utilized: number
    remaining: number
}

interface ShareholderLoan {
    id: string
    name: string
    direction: 'to_company' | 'from_company'
    balance: number
    hasAgreement: boolean
    interestRate: number | null
    benchmarkRate: number
    minimumRepayment: number
    isCompliant: boolean
    riskAmount: number
}

const MOCK_LOSSES: LossYear[] = [
    { fy: 'FY2023-24', revenueLoss: 45000, capitalLoss: 0, totalLoss: 45000, cotSatisfied: true, utilized: 0, remaining: 45000 },
    { fy: 'FY2022-23', revenueLoss: 32000, capitalLoss: 5000, totalLoss: 37000, cotSatisfied: true, utilized: 0, remaining: 37000 },
    { fy: 'FY2021-22', revenueLoss: 18500, capitalLoss: 0, totalLoss: 18500, cotSatisfied: true, utilized: 0, remaining: 18500 },
]

const MOCK_LOANS: ShareholderLoan[] = [
    {
        id: '1',
        name: 'Director - P. Smith',
        direction: 'to_company',
        balance: 85000,
        hasAgreement: true,
        interestRate: 8.77,
        benchmarkRate: 8.77,
        minimumRepayment: 12500,
        isCompliant: true,
        riskAmount: 0
    },
    {
        id: '2',
        name: 'Director - J. Jones',
        direction: 'to_company',
        balance: 42000,
        hasAgreement: false,
        interestRate: null,
        benchmarkRate: 8.77,
        minimumRepayment: 6200,
        isCompliant: false,
        riskAmount: 42000
    }
]

export default function LossAnalysisPage() {
    const [losses] = useState<LossYear[]>(MOCK_LOSSES)
    const [loans] = useState<ShareholderLoan[]>(MOCK_LOANS)

    const totalLosses = losses.reduce((sum, l) => sum + l.remaining, 0)
    const futureTaxValue = totalLosses * 0.25 // 25% corporate rate
    const nonCompliantLoans = loans.filter(l => !l.isCompliant).length
    const totalRisk = loans.reduce((sum, l) => sum + l.riskAmount, 0)

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
                <div className="flex items-center gap-4 mb-8">
                    <Link href="/dashboard" className="btn btn-ghost p-2">
                        <ArrowLeft className="w-5 h-5" />
                    </Link>
                    <div className="flex-1">
                        <h2 className="text-2xl font-bold mb-1">Loss & Loan Analysis</h2>
                        <p className="text-[var(--text-secondary)]">
                            Carry-forward losses and Division 7A compliance
                        </p>
                    </div>
                </div>

                {/* Stats */}
                <div className="grid md:grid-cols-4 gap-6 mb-8">
                    <div className="stat-card">
                        <div className="text-sm text-[var(--text-secondary)] mb-2">Accumulated Losses</div>
                        <div className="text-3xl font-bold">${totalLosses.toLocaleString()}</div>
                        <div className="text-xs text-[var(--text-muted)]">available to carry forward</div>
                    </div>

                    <div className="stat-card accent">
                        <div className="text-sm text-[var(--text-secondary)] mb-2">Future Tax Value</div>
                        <div className="text-3xl font-bold text-emerald-400">${futureTaxValue.toLocaleString()}</div>
                        <div className="text-xs text-[var(--text-muted)]">at 25% corporate rate</div>
                    </div>

                    <div className="stat-card warning">
                        <div className="text-sm text-[var(--text-secondary)] mb-2">Non-Compliant Loans</div>
                        <div className="text-3xl font-bold text-amber-400">{nonCompliantLoans}</div>
                        <div className="text-xs text-[var(--text-muted)]">require action</div>
                    </div>

                    <div className="stat-card danger">
                        <div className="text-sm text-[var(--text-secondary)] mb-2">Deemed Dividend Risk</div>
                        <div className="text-3xl font-bold text-red-400">${totalRisk.toLocaleString()}</div>
                        <div className="text-xs text-[var(--text-muted)]">Division 7A exposure</div>
                    </div>
                </div>

                {/* Loss Position */}
                <div className="glass-card mb-8">
                    <div className="p-6 border-b border-[var(--border-default)]">
                        <h3 className="font-semibold flex items-center gap-2">
                            <TrendingDown className="w-5 h-5 text-amber-400" />
                            Carry-Forward Loss Position
                        </h3>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="table">
                            <thead>
                                <tr>
                                    <th>Financial Year</th>
                                    <th>Revenue Loss</th>
                                    <th>Capital Loss</th>
                                    <th>Total</th>
                                    <th>COT Satisfied</th>
                                    <th>Utilized</th>
                                    <th>Remaining</th>
                                </tr>
                            </thead>
                            <tbody>
                                {losses.map((loss) => (
                                    <tr key={loss.fy}>
                                        <td className="font-medium">{loss.fy}</td>
                                        <td className="amount negative">${loss.revenueLoss.toLocaleString()}</td>
                                        <td className="amount negative">${loss.capitalLoss.toLocaleString()}</td>
                                        <td className="amount negative">${loss.totalLoss.toLocaleString()}</td>
                                        <td>
                                            {loss.cotSatisfied ? (
                                                <CheckCircle className="w-5 h-5 text-emerald-400" />
                                            ) : (
                                                <XCircle className="w-5 h-5 text-red-400" />
                                            )}
                                        </td>
                                        <td className="amount">${loss.utilized.toLocaleString()}</td>
                                        <td className="amount font-bold">${loss.remaining.toLocaleString()}</td>
                                    </tr>
                                ))}
                                <tr className="bg-[var(--bg-tertiary)]">
                                    <td className="font-bold">Total</td>
                                    <td className="amount negative font-bold">
                                        ${losses.reduce((s, l) => s + l.revenueLoss, 0).toLocaleString()}
                                    </td>
                                    <td className="amount negative font-bold">
                                        ${losses.reduce((s, l) => s + l.capitalLoss, 0).toLocaleString()}
                                    </td>
                                    <td className="amount negative font-bold">
                                        ${losses.reduce((s, l) => s + l.totalLoss, 0).toLocaleString()}
                                    </td>
                                    <td></td>
                                    <td className="amount font-bold">
                                        ${losses.reduce((s, l) => s + l.utilized, 0).toLocaleString()}
                                    </td>
                                    <td className="amount font-bold text-emerald-400">
                                        ${totalLosses.toLocaleString()}
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Shareholder Loans - Division 7A */}
                <div className="glass-card mb-8">
                    <div className="p-6 border-b border-[var(--border-default)]">
                        <h3 className="font-semibold flex items-center gap-2">
                            <Users className="w-5 h-5 text-sky-400" />
                            Shareholder Loans - Division 7A Compliance
                        </h3>
                    </div>
                    <div className="divide-y divide-[var(--border-default)]">
                        {loans.map((loan) => (
                            <div key={loan.id} className="p-6">
                                <div className="flex items-start justify-between mb-4">
                                    <div>
                                        <div className="flex items-center gap-3 mb-1">
                                            <h4 className="font-medium">{loan.name}</h4>
                                            <span className={`priority-badge ${loan.isCompliant ? 'low' : 'critical'}`}>
                                                {loan.isCompliant ? 'Compliant' : 'Non-Compliant'}
                                            </span>
                                        </div>
                                        <p className="text-sm text-[var(--text-secondary)]">
                                            {loan.direction === 'to_company' ? 'Loan TO company' : 'Loan FROM company'}
                                        </p>
                                    </div>
                                    <div className="text-right">
                                        <div className="text-2xl font-bold">${loan.balance.toLocaleString()}</div>
                                        <div className="text-xs text-[var(--text-muted)]">outstanding balance</div>
                                    </div>
                                </div>

                                <div className="grid md:grid-cols-4 gap-4 p-4 rounded-xl bg-[var(--bg-tertiary)]">
                                    <div>
                                        <div className="text-xs text-[var(--text-muted)] mb-1">Written Agreement</div>
                                        <div className="flex items-center gap-2">
                                            {loan.hasAgreement ? (
                                                <><CheckCircle className="w-4 h-4 text-emerald-400" /> Yes</>
                                            ) : (
                                                <><XCircle className="w-4 h-4 text-red-400" /> No</>
                                            )}
                                        </div>
                                    </div>
                                    <div>
                                        <div className="text-xs text-[var(--text-muted)] mb-1">Interest Rate</div>
                                        <div>{loan.interestRate ? `${loan.interestRate}%` : 'Not set'}</div>
                                    </div>
                                    <div>
                                        <div className="text-xs text-[var(--text-muted)] mb-1">Benchmark Rate</div>
                                        <div>{loan.benchmarkRate}% (FY2024-25)</div>
                                    </div>
                                    <div>
                                        <div className="text-xs text-[var(--text-muted)] mb-1">Min. Yearly Repayment</div>
                                        <div>${loan.minimumRepayment.toLocaleString()}</div>
                                    </div>
                                </div>

                                {!loan.isCompliant && (
                                    <div className="mt-4 p-4 rounded-xl bg-red-500/10 border border-red-500/20">
                                        <div className="flex items-start gap-3">
                                            <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                                            <div>
                                                <div className="font-medium text-red-400 mb-1">Action Required</div>
                                                <p className="text-sm text-[var(--text-secondary)]">
                                                    Execute a complying Division 7A loan agreement before the next tax return lodgment
                                                    to avoid deemed dividend treatment on ${loan.riskAmount.toLocaleString()}.
                                                </p>
                                                <p className="text-xs text-[var(--text-muted)] mt-2">
                                                    Reference: Division 7A ITAA 1936 • Benchmark rate: {loan.benchmarkRate}%
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>

                {/* Info Card */}
                <div className="glass-card p-6">
                    <div className="flex items-start gap-4">
                        <div className="w-12 h-12 rounded-xl bg-amber-500/10 flex items-center justify-center flex-shrink-0">
                            <FileText className="w-6 h-6 text-amber-400" />
                        </div>
                        <div>
                            <h3 className="font-semibold mb-2">Loss Utilization Strategy</h3>
                            <p className="text-sm text-[var(--text-secondary)] mb-4">
                                Accumulated losses of <strong>${totalLosses.toLocaleString()}</strong> can be offset
                                against future profits, providing a tax saving of <strong className="text-emerald-400">
                                    ${futureTaxValue.toLocaleString()}</strong> at the 25% corporate tax rate.
                            </p>
                            <div className="text-xs text-[var(--text-muted)]">
                                Reference: Subdivision 36-A ITAA 1997 (Continuity of Ownership Test)
                            </div>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    )
}
