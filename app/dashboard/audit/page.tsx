'use client'

import { useState, useEffect } from 'react'
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
    Filter,
    Download,
    Play,
    Eye,
    ChevronDown
} from 'lucide-react'

interface AuditFinding {
    id: string
    type: 'rnd_candidate' | 'misclassification' | 'missing_tax_type' | 'unclaimed_deduction'
    priority: 'critical' | 'high' | 'medium' | 'low'
    transactionDate: string
    description: string
    amount: number
    currentClassification: string
    recommendedAction: string
    estimatedBenefit: number
    legislationRef: string
}

const MOCK_FINDINGS: AuditFinding[] = [
    {
        id: '1',
        type: 'rnd_candidate',
        priority: 'critical',
        transactionDate: '2024-11-15',
        description: 'Software development contractor - TechDev Solutions',
        amount: 24500,
        currentClassification: 'Consulting Fees',
        recommendedAction: 'Review for R&D eligibility - 43.5% refund potential',
        estimatedBenefit: 10658,
        legislationRef: 'Division 355 ITAA 1997'
    },
    {
        id: '2',
        type: 'rnd_candidate',
        priority: 'high',
        transactionDate: '2024-10-22',
        description: 'Engineering prototype materials',
        amount: 8750,
        currentClassification: 'Office Supplies',
        recommendedAction: 'Reclassify to R&D Materials for offset claim',
        estimatedBenefit: 3806,
        legislationRef: 'Division 355 ITAA 1997'
    },
    {
        id: '3',
        type: 'misclassification',
        priority: 'medium',
        transactionDate: '2024-09-18',
        description: 'Professional development course - AWS Certification',
        amount: 2400,
        currentClassification: 'Entertainment',
        recommendedAction: 'Reclassify to Training & Development (deductible)',
        estimatedBenefit: 600,
        legislationRef: 'Section 8-1 ITAA 1997'
    },
    {
        id: '4',
        type: 'missing_tax_type',
        priority: 'high',
        transactionDate: '2024-08-30',
        description: 'Computer equipment purchase',
        amount: 4200,
        currentClassification: 'Office Equipment',
        recommendedAction: 'Apply instant asset write-off (< $20,000 threshold)',
        estimatedBenefit: 1050,
        legislationRef: 'Subdivision 328-D ITAA 1997'
    },
    {
        id: '5',
        type: 'unclaimed_deduction',
        priority: 'medium',
        transactionDate: '2024-12-01',
        description: 'Home office expenses not claimed',
        amount: 0,
        currentClassification: 'N/A',
        recommendedAction: 'Calculate home office deduction (67c/hour)',
        estimatedBenefit: 804,
        legislationRef: 'TR 93/30'
    }
]

export default function TaxAuditPage() {
    const [findings, setFindings] = useState<AuditFinding[]>(MOCK_FINDINGS)
    const [filterType, setFilterType] = useState<string>('all')
    const [filterPriority, setFilterPriority] = useState<string>('all')

    const filteredFindings = findings.filter(f => {
        if (filterType !== 'all' && f.type !== filterType) return false
        if (filterPriority !== 'all' && f.priority !== filterPriority) return false
        return true
    })

    const totalBenefit = findings.reduce((sum, f) => sum + f.estimatedBenefit, 0)
    const criticalCount = findings.filter(f => f.priority === 'critical').length
    const rndCandidates = findings.filter(f => f.type === 'rnd_candidate').length

    const getTypeLabel = (type: string) => {
        switch (type) {
            case 'rnd_candidate': return 'R&D Candidate'
            case 'misclassification': return 'Misclassification'
            case 'missing_tax_type': return 'Missing Tax Type'
            case 'unclaimed_deduction': return 'Unclaimed Deduction'
            default: return type
        }
    }

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
            <main className="ml-[280px] flex-1 p-8">
                {/* Header */}
                <div className="flex items-center gap-4 mb-8">
                    <Link href="/dashboard" className="btn btn-ghost p-2">
                        <ArrowLeft className="w-5 h-5" />
                    </Link>
                    <div className="flex-1">
                        <h2 className="text-2xl font-bold mb-1">Tax Audit Findings</h2>
                        <p className="text-[var(--text-secondary)]">
                            Transaction analysis and optimization recommendations
                        </p>
                    </div>
                    <button className="btn btn-secondary">
                        <Download className="w-4 h-4" />
                        Export Report
                    </button>
                    <button className="btn btn-primary">
                        <Play className="w-4 h-4" />
                        Run Full Audit
                    </button>
                </div>

                {/* Stats */}
                <div className="grid md:grid-cols-4 gap-6 mb-8">
                    <div className="stat-card accent">
                        <div className="text-sm text-[var(--text-secondary)] mb-2">Total Potential Benefit</div>
                        <div className="text-3xl font-bold text-emerald-400">
                            ${totalBenefit.toLocaleString()}
                        </div>
                        <div className="text-xs text-[var(--text-muted)]">from {findings.length} findings</div>
                    </div>

                    <div className="stat-card danger">
                        <div className="text-sm text-[var(--text-secondary)] mb-2">Critical Items</div>
                        <div className="text-3xl font-bold text-red-400">{criticalCount}</div>
                        <div className="text-xs text-[var(--text-muted)]">require immediate attention</div>
                    </div>

                    <div className="stat-card xero">
                        <div className="text-sm text-[var(--text-secondary)] mb-2">R&D Candidates</div>
                        <div className="text-3xl font-bold text-sky-400">{rndCandidates}</div>
                        <div className="text-xs text-[var(--text-muted)]">43.5% refund potential</div>
                    </div>

                    <div className="stat-card warning">
                        <div className="text-sm text-[var(--text-secondary)] mb-2">Misclassifications</div>
                        <div className="text-3xl font-bold text-amber-400">
                            {findings.filter(f => f.type === 'misclassification').length}
                        </div>
                        <div className="text-xs text-[var(--text-muted)]">need correction</div>
                    </div>
                </div>

                {/* Filters */}
                <div className="flex items-center gap-4 mb-6">
                    <div className="flex items-center gap-2">
                        <Filter className="w-4 h-4 text-[var(--text-muted)]" />
                        <span className="text-sm text-[var(--text-secondary)]">Filter:</span>
                    </div>
                    <select
                        value={filterType}
                        onChange={(e) => setFilterType(e.target.value)}
                        className="input w-48"
                    >
                        <option value="all">All Types</option>
                        <option value="rnd_candidate">R&D Candidates</option>
                        <option value="misclassification">Misclassifications</option>
                        <option value="missing_tax_type">Missing Tax Type</option>
                        <option value="unclaimed_deduction">Unclaimed Deductions</option>
                    </select>
                    <select
                        value={filterPriority}
                        onChange={(e) => setFilterPriority(e.target.value)}
                        className="input w-40"
                    >
                        <option value="all">All Priorities</option>
                        <option value="critical">Critical</option>
                        <option value="high">High</option>
                        <option value="medium">Medium</option>
                        <option value="low">Low</option>
                    </select>
                </div>

                {/* Findings Table */}
                <div className="table-container">
                    <table className="table">
                        <thead>
                            <tr>
                                <th>Priority</th>
                                <th>Type</th>
                                <th>Date</th>
                                <th>Description</th>
                                <th>Amount</th>
                                <th>Est. Benefit</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredFindings.map((finding) => (
                                <tr key={finding.id}>
                                    <td>
                                        <span className={`priority-badge ${finding.priority}`}>
                                            {finding.priority}
                                        </span>
                                    </td>
                                    <td>
                                        <span className="text-sm">{getTypeLabel(finding.type)}</span>
                                    </td>
                                    <td>
                                        <span className="text-sm text-[var(--text-secondary)]">
                                            {new Date(finding.transactionDate).toLocaleDateString()}
                                        </span>
                                    </td>
                                    <td>
                                        <div>
                                            <div className="font-medium text-sm">{finding.description}</div>
                                            <div className="text-xs text-[var(--text-muted)]">
                                                Current: {finding.currentClassification}
                                            </div>
                                        </div>
                                    </td>
                                    <td>
                                        <span className="amount">
                                            ${finding.amount.toLocaleString()}
                                        </span>
                                    </td>
                                    <td>
                                        <span className="amount positive">
                                            +${finding.estimatedBenefit.toLocaleString()}
                                        </span>
                                    </td>
                                    <td>
                                        <button className="btn btn-ghost p-2">
                                            <Eye className="w-4 h-4" />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {/* Legend */}
                <div className="mt-8 p-6 rounded-xl bg-[var(--bg-tertiary)] border border-[var(--border-default)]">
                    <h4 className="font-medium mb-4">Finding Categories</h4>
                    <div className="grid md:grid-cols-4 gap-4 text-sm">
                        <div>
                            <span className="font-medium text-emerald-400">R&D Candidate</span>
                            <p className="text-[var(--text-secondary)]">Transaction potentially eligible for 43.5% R&D offset</p>
                        </div>
                        <div>
                            <span className="font-medium text-amber-400">Misclassification</span>
                            <p className="text-[var(--text-secondary)]">Expense in wrong account category</p>
                        </div>
                        <div>
                            <span className="font-medium text-sky-400">Missing Tax Type</span>
                            <p className="text-[var(--text-secondary)]">Transaction without GST/BAS code</p>
                        </div>
                        <div>
                            <span className="font-medium text-purple-400">Unclaimed Deduction</span>
                            <p className="text-[var(--text-secondary)]">Valid deduction not being claimed</p>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    )
}
