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
    CheckCircle,
    XCircle,
    HelpCircle,
    AlertTriangle,
    Calendar,
    Download,
    Play
} from 'lucide-react'

interface RnDActivity {
    id: string
    name: string
    description: string
    type: 'core' | 'supporting' | null
    criteria: {
        unknownOutcome: boolean | null
        systematicApproach: boolean | null
        newKnowledge: boolean | null
        scientificMethod: boolean | null
    }
    expenditure: number
    eligibleExpenditure: number
    estimatedOffset: number
    status: 'draft' | 'assessed' | 'ready'
}

const MOCK_ACTIVITIES: RnDActivity[] = [
    {
        id: '1',
        name: 'Custom Software Development',
        description: 'Development of proprietary business software with novel algorithms',
        type: 'core',
        criteria: {
            unknownOutcome: true,
            systematicApproach: true,
            newKnowledge: true,
            scientificMethod: true
        },
        expenditure: 85000,
        eligibleExpenditure: 85000,
        estimatedOffset: 36975, // 43.5%
        status: 'assessed'
    },
    {
        id: '2',
        name: 'Engineering Prototype Testing',
        description: 'Experimental testing of new product prototypes',
        type: 'core',
        criteria: {
            unknownOutcome: true,
            systematicApproach: true,
            newKnowledge: true,
            scientificMethod: null
        },
        expenditure: 42000,
        eligibleExpenditure: 42000,
        estimatedOffset: 18270,
        status: 'draft'
    },
    {
        id: '3',
        name: 'Data Collection Support',
        description: 'Supporting activity for core R&D data requirements',
        type: 'supporting',
        criteria: {
            unknownOutcome: null,
            systematicApproach: null,
            newKnowledge: null,
            scientificMethod: null
        },
        expenditure: 15000,
        eligibleExpenditure: 15000,
        estimatedOffset: 6525,
        status: 'draft'
    }
]

export default function RnDAssessmentPage() {
    const [activities, setActivities] = useState<RnDActivity[]>(MOCK_ACTIVITIES)
    const [selectedFY, setSelectedFY] = useState('FY2024-25')

    const totalExpenditure = activities.reduce((sum, a) => sum + a.expenditure, 0)
    const eligibleExpenditure = activities.reduce((sum, a) => sum + a.eligibleExpenditure, 0)
    const estimatedRefund = activities.reduce((sum, a) => sum + a.estimatedOffset, 0)
    const assessedCount = activities.filter(a => a.status === 'assessed').length

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
                        <Link href="/dashboard/rnd" className="sidebar-link active">
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
                {/* Header */}
                <div className="flex items-center gap-4 mb-8">
                    <Link href="/dashboard" className="btn btn-ghost p-2">
                        <ArrowLeft className="w-5 h-5" />
                    </Link>
                    <div className="flex-1">
                        <h2 className="text-2xl font-bold mb-1">R&D Tax Incentive Assessment</h2>
                        <p className="text-[var(--text-secondary)]">
                            Division 355 ITAA 1997 • 43.5% Refundable Offset
                        </p>
                    </div>
                    <select
                        value={selectedFY}
                        onChange={(e) => setSelectedFY(e.target.value)}
                        className="input w-40"
                    >
                        <option value="FY2024-25">FY2024-25</option>
                        <option value="FY2023-24">FY2023-24</option>
                        <option value="FY2022-23">FY2022-23</option>
                    </select>
                </div>

                {/* Stats */}
                <div className="grid md:grid-cols-4 gap-6 mb-8">
                    <div className="stat-card accent">
                        <div className="text-sm text-[var(--text-secondary)] mb-2">Estimated Refund</div>
                        <div className="text-3xl font-bold text-emerald-400">
                            ${estimatedRefund.toLocaleString()}
                        </div>
                        <div className="text-xs text-[var(--text-muted)]">43.5% of eligible expenditure</div>
                    </div>

                    <div className="stat-card">
                        <div className="text-sm text-[var(--text-secondary)] mb-2">Eligible Expenditure</div>
                        <div className="text-3xl font-bold">${eligibleExpenditure.toLocaleString()}</div>
                        <div className="text-xs text-[var(--text-muted)]">of ${totalExpenditure.toLocaleString()} total</div>
                    </div>

                    <div className="stat-card">
                        <div className="text-sm text-[var(--text-secondary)] mb-2">Activities</div>
                        <div className="text-3xl font-bold">{activities.length}</div>
                        <div className="text-xs text-[var(--text-muted)]">{assessedCount} assessed</div>
                    </div>

                    <div className="stat-card warning">
                        <div className="text-sm text-[var(--text-secondary)] mb-2">Registration Deadline</div>
                        <div className="text-xl font-bold text-amber-400">30 Apr 2026</div>
                        <div className="text-xs text-[var(--text-muted)]">10 months after FY end</div>
                    </div>
                </div>

                {/* Activities List */}
                <div className="glass-card mb-8">
                    <div className="p-6 border-b border-[var(--border-default)] flex items-center justify-between">
                        <h3 className="font-semibold">R&D Activities</h3>
                        <button className="btn btn-primary">
                            <Play className="w-4 h-4" />
                            Scan Transactions for R&D
                        </button>
                    </div>
                    <div className="divide-y divide-[var(--border-default)]">
                        {activities.map((activity) => (
                            <div key={activity.id} className="p-6">
                                <div className="flex items-start justify-between mb-4">
                                    <div className="flex-1">
                                        <div className="flex items-center gap-3 mb-1">
                                            <h4 className="font-medium">{activity.name}</h4>
                                            <span className={`priority-badge ${activity.type === 'core' ? 'low' : 'medium'}`}>
                                                {activity.type === 'core' ? 'Core R&D' : 'Supporting'}
                                            </span>
                                            <span className={`priority-badge ${activity.status === 'assessed' ? 'low' : 'medium'}`}>
                                                {activity.status}
                                            </span>
                                        </div>
                                        <p className="text-sm text-[var(--text-secondary)]">{activity.description}</p>
                                    </div>
                                    <div className="text-right">
                                        <div className="text-2xl font-bold text-emerald-400">
                                            ${activity.estimatedOffset.toLocaleString()}
                                        </div>
                                        <div className="text-xs text-[var(--text-muted)]">estimated refund</div>
                                    </div>
                                </div>

                                {/* Division 355 Criteria */}
                                <div className="grid grid-cols-4 gap-4 p-4 rounded-xl bg-[var(--bg-tertiary)]">
                                    <div className="flex items-center gap-2">
                                        {activity.criteria.unknownOutcome === true ? (
                                            <CheckCircle className="w-5 h-5 text-emerald-400" />
                                        ) : activity.criteria.unknownOutcome === false ? (
                                            <XCircle className="w-5 h-5 text-red-400" />
                                        ) : (
                                            <HelpCircle className="w-5 h-5 text-amber-400" />
                                        )}
                                        <span className="text-sm">Unknown Outcome</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        {activity.criteria.systematicApproach === true ? (
                                            <CheckCircle className="w-5 h-5 text-emerald-400" />
                                        ) : activity.criteria.systematicApproach === false ? (
                                            <XCircle className="w-5 h-5 text-red-400" />
                                        ) : (
                                            <HelpCircle className="w-5 h-5 text-amber-400" />
                                        )}
                                        <span className="text-sm">Systematic Approach</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        {activity.criteria.newKnowledge === true ? (
                                            <CheckCircle className="w-5 h-5 text-emerald-400" />
                                        ) : activity.criteria.newKnowledge === false ? (
                                            <XCircle className="w-5 h-5 text-red-400" />
                                        ) : (
                                            <HelpCircle className="w-5 h-5 text-amber-400" />
                                        )}
                                        <span className="text-sm">New Knowledge</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        {activity.criteria.scientificMethod === true ? (
                                            <CheckCircle className="w-5 h-5 text-emerald-400" />
                                        ) : activity.criteria.scientificMethod === false ? (
                                            <XCircle className="w-5 h-5 text-red-400" />
                                        ) : (
                                            <HelpCircle className="w-5 h-5 text-amber-400" />
                                        )}
                                        <span className="text-sm">Scientific Method</span>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Reference Card */}
                <div className="glass-card p-6">
                    <div className="flex items-start gap-4">
                        <div className="w-12 h-12 rounded-xl bg-sky-500/10 flex items-center justify-center flex-shrink-0">
                            <AlertTriangle className="w-6 h-6 text-sky-400" />
                        </div>
                        <div>
                            <h3 className="font-semibold mb-2">Division 355 Requirements</h3>
                            <p className="text-sm text-[var(--text-secondary)] mb-4">
                                Core R&D activities must satisfy all four criteria. Supporting activities
                                must be directly related to core activities.
                            </p>
                            <div className="text-xs text-[var(--text-muted)]">
                                Reference: Division 355 ITAA 1997 • ATO R&D Tax Incentive Schedule
                            </div>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    )
}
