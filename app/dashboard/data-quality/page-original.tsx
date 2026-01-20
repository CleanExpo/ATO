/**
 * Data Quality & Forensic Correction Dashboard
 *
 * Shows data integrity issues and allows accountant to approve/reject corrections.
 */

'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { AlertCircle, CheckCircle, Clock, XCircle, TrendingUp, AlertTriangle } from 'lucide-react'

interface ScanStatus {
    status: 'idle' | 'scanning' | 'complete' | 'error'
    progress: number
    transactionsScanned: number
    issuesFound: number
    issuesAutoCorrected: number
    issuesPendingReview: number
    issuesByType: {
        wrongAccount: number
        taxClassification: number
        unreconciled: number
        misallocated: number
        duplicate: number
    }
    totalImpactAmount: number
    message: string
}

interface DataQualityIssue {
    issueId: string
    transactionId: string
    issueType: string
    severity: 'critical' | 'high' | 'medium' | 'low'
    currentState: any
    suggestedFix: any
    confidence: number
    aiReasoning: string
    impactAmount: number
    financialYear: string
}

export default function DataQualityPage() {
    const [scanStatus, setScanStatus] = useState<ScanStatus | null>(null)
    const [issues, setIssues] = useState<DataQualityIssue[]>([])
    const [isLoading, setIsLoading] = useState(false)
    const [selectedIssues, setSelectedIssues] = useState<Set<string>>(new Set())
    const [tenantId, setTenantId] = useState<string>('')

    // Get tenant ID from localStorage or URL (implement your auth logic)
    useEffect(() => {
        const storedTenantId = localStorage.getItem('xero_tenant_id')
        if (storedTenantId) {
            setTenantId(storedTenantId)
            fetchScanStatus(storedTenantId)
            fetchIssues(storedTenantId)
        }
    }, [])

    const fetchScanStatus = async (tid: string) => {
        try {
            const res = await fetch(`/api/data-quality/scan?tenantId=${tid}`)
            const data = await res.json()
            setScanStatus(data)
        } catch (error) {
            console.error('Failed to fetch scan status:', error)
        }
    }

    const fetchIssues = async (tid: string, filters?: { status?: string; issueType?: string }) => {
        try {
            let url = `/api/data-quality/issues?tenantId=${tid}`
            if (filters?.status) url += `&status=${filters.status}`
            if (filters?.issueType) url += `&issueType=${filters.issueType}`

            const res = await fetch(url)
            const data = await res.json()
            setIssues(data.issues || [])
        } catch (error) {
            console.error('Failed to fetch issues:', error)
        }
    }

    const startScan = async () => {
        if (!tenantId) {
            alert('No Xero connection found. Please connect to Xero first.')
            return
        }

        setIsLoading(true)

        try {
            const res = await fetch('/api/data-quality/scan', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    tenantId,
                    financialYears: ['FY2024-25', 'FY2023-24', 'FY2022-23', 'FY2021-22', 'FY2020-21'],
                    autoFixThreshold: 90,
                    applyCorrections: true
                })
            })

            const data = await res.json()
            console.log('Scan started:', data)

            // Poll for status
            const pollInterval = setInterval(async () => {
                await fetchScanStatus(tenantId)
                const currentStatus = scanStatus

                if (currentStatus?.status === 'complete' || currentStatus?.status === 'error') {
                    clearInterval(pollInterval)
                    setIsLoading(false)
                    await fetchIssues(tenantId)
                }
            }, 2000)  // Poll every 2 seconds

        } catch (error) {
            console.error('Failed to start scan:', error)
            setIsLoading(false)
        }
    }

    const updateIssueStatus = async (issueIds: string[], status: 'approved' | 'rejected', notes?: string) => {
        try {
            const res = await fetch('/api/data-quality/issues', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    issueIds,
                    status,
                    accountantNotes: notes
                })
            })

            if (res.ok) {
                await fetchIssues(tenantId)
                setSelectedIssues(new Set())
            }
        } catch (error) {
            console.error('Failed to update issues:', error)
        }
    }

    const toggleIssueSelection = (issueId: string) => {
        const newSelection = new Set(selectedIssues)
        if (newSelection.has(issueId)) {
            newSelection.delete(issueId)
        } else {
            newSelection.add(issueId)
        }
        setSelectedIssues(newSelection)
    }

    const getSeverityColor = (severity: string) => {
        switch (severity) {
            case 'critical': return 'bg-red-100 text-red-800'
            case 'high': return 'bg-orange-100 text-orange-800'
            case 'medium': return 'bg-yellow-100 text-yellow-800'
            case 'low': return 'bg-blue-100 text-blue-800'
            default: return 'bg-gray-100 text-gray-800'
        }
    }

    const getIssueTypeLabel = (type: string) => {
        switch (type) {
            case 'wrong_account': return 'Wrong Account'
            case 'tax_classification': return 'Tax Classification'
            case 'unreconciled': return 'Unreconciled'
            case 'misallocated': return 'Misallocated'
            case 'duplicate': return 'Duplicate'
            default: return type
        }
    }

    return (
        <div className="container mx-auto p-6 space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold">Data Quality & Forensic Correction</h1>
                    <p className="text-gray-600 mt-2">
                        Validate and auto-correct Xero data integrity issues before tax analysis
                    </p>
                </div>

                <Button
                    onClick={startScan}
                    disabled={isLoading || scanStatus?.status === 'scanning'}
                    size="lg"
                >
                    {isLoading || scanStatus?.status === 'scanning' ? (
                        <>
                            <Clock className="mr-2 h-4 w-4 animate-spin" />
                            Scanning...
                        </>
                    ) : (
                        'Start Data Quality Scan'
                    )}
                </Button>
            </div>

            {/* Scan Status */}
            {scanStatus && (
                <Card>
                    <CardHeader>
                        <CardTitle>Scan Status</CardTitle>
                        <CardDescription>
                            {scanStatus.status === 'scanning' && `${scanStatus.progress.toFixed(0)}% complete`}
                            {scanStatus.status === 'complete' && `Last scan completed`}
                            {scanStatus.status === 'idle' && 'No scan has been run yet'}
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        {scanStatus.status === 'scanning' && (
                            <div className="space-y-2">
                                <div className="w-full bg-gray-200 rounded-full h-2">
                                    <div
                                        className="bg-blue-600 h-2 rounded-full transition-all"
                                        style={{ width: `${scanStatus.progress}%` }}
                                    />
                                </div>
                                <p className="text-sm text-gray-600">{scanStatus.message}</p>
                            </div>
                        )}

                        {scanStatus.status === 'complete' && (
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                <div className="text-center p-4 bg-gray-50 rounded-lg">
                                    <div className="text-2xl font-bold">{scanStatus.transactionsScanned.toLocaleString()}</div>
                                    <div className="text-sm text-gray-600">Transactions Scanned</div>
                                </div>
                                <div className="text-center p-4 bg-red-50 rounded-lg">
                                    <div className="text-2xl font-bold text-red-700">{scanStatus.issuesFound}</div>
                                    <div className="text-sm text-gray-600">Issues Found</div>
                                </div>
                                <div className="text-center p-4 bg-green-50 rounded-lg">
                                    <div className="text-2xl font-bold text-green-700">{scanStatus.issuesAutoCorrected}</div>
                                    <div className="text-sm text-gray-600">Auto-Corrected</div>
                                </div>
                                <div className="text-center p-4 bg-yellow-50 rounded-lg">
                                    <div className="text-2xl font-bold text-yellow-700">{scanStatus.issuesPendingReview}</div>
                                    <div className="text-sm text-gray-600">Pending Review</div>
                                </div>
                            </div>
                        )}

                        {scanStatus.issuesByType && scanStatus.issuesFound > 0 && (
                            <div className="mt-4">
                                <h4 className="font-semibold mb-2">Issues by Type</h4>
                                <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                                    {Object.entries(scanStatus.issuesByType).map(([type, count]) => (
                                        <div key={type} className="text-center p-3 bg-white border rounded">
                                            <div className="font-bold">{count}</div>
                                            <div className="text-xs text-gray-600">{getIssueTypeLabel(type)}</div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {scanStatus.totalImpactAmount > 0 && (
                            <Alert className="mt-4">
                                <TrendingUp className="h-4 w-4" />
                                <AlertDescription>
                                    Total financial impact: <strong>${scanStatus.totalImpactAmount.toLocaleString()}</strong>
                                </AlertDescription>
                            </Alert>
                        )}
                    </CardContent>
                </Card>
            )}

            {/* Issues List */}
            {issues.length > 0 && (
                <Card>
                    <CardHeader>
                        <div className="flex justify-between items-center">
                            <div>
                                <CardTitle>Data Quality Issues</CardTitle>
                                <CardDescription>{issues.length} issues require attention</CardDescription>
                            </div>

                            {selectedIssues.size > 0 && (
                                <div className="flex gap-2">
                                    <Button
                                        onClick={() => updateIssueStatus(Array.from(selectedIssues), 'approved')}
                                        variant="outline"
                                        size="sm"
                                    >
                                        <CheckCircle className="mr-2 h-4 w-4" />
                                        Approve ({selectedIssues.size})
                                    </Button>
                                    <Button
                                        onClick={() => updateIssueStatus(Array.from(selectedIssues), 'rejected')}
                                        variant="outline"
                                        size="sm"
                                    >
                                        <XCircle className="mr-2 h-4 w-4" />
                                        Reject ({selectedIssues.size})
                                    </Button>
                                </div>
                            )}
                        </div>
                    </CardHeader>
                    <CardContent>
                        <Tabs defaultValue="pending_review">
                            <TabsList>
                                <TabsTrigger value="pending_review">Pending Review</TabsTrigger>
                                <TabsTrigger value="auto_corrected">Auto-Corrected</TabsTrigger>
                                <TabsTrigger value="all">All Issues</TabsTrigger>
                            </TabsList>

                            <TabsContent value="pending_review" className="space-y-3 mt-4">
                                {issues.filter(i => i.confidence >= 70 && i.confidence < 90).map(issue => (
                                    <IssueCard
                                        key={issue.issueId}
                                        issue={issue}
                                        isSelected={selectedIssues.has(issue.issueId)}
                                        onToggleSelect={() => toggleIssueSelection(issue.issueId)}
                                        getSeverityColor={getSeverityColor}
                                        getIssueTypeLabel={getIssueTypeLabel}
                                    />
                                ))}
                            </TabsContent>

                            <TabsContent value="auto_corrected" className="space-y-3 mt-4">
                                {issues.filter(i => i.confidence >= 90).map(issue => (
                                    <IssueCard
                                        key={issue.issueId}
                                        issue={issue}
                                        isSelected={false}
                                        onToggleSelect={() => {}}
                                        getSeverityColor={getSeverityColor}
                                        getIssueTypeLabel={getIssueTypeLabel}
                                        isAutoCorrected
                                    />
                                ))}
                            </TabsContent>

                            <TabsContent value="all" className="space-y-3 mt-4">
                                {issues.map(issue => (
                                    <IssueCard
                                        key={issue.issueId}
                                        issue={issue}
                                        isSelected={selectedIssues.has(issue.issueId)}
                                        onToggleSelect={() => toggleIssueSelection(issue.issueId)}
                                        getSeverityColor={getSeverityColor}
                                        getIssueTypeLabel={getIssueTypeLabel}
                                    />
                                ))}
                            </TabsContent>
                        </Tabs>
                    </CardContent>
                </Card>
            )}

            {issues.length === 0 && scanStatus?.status === 'complete' && (
                <Card>
                    <CardContent className="text-center py-12">
                        <CheckCircle className="mx-auto h-12 w-12 text-green-500 mb-4" />
                        <h3 className="text-lg font-semibold mb-2">No Issues Found</h3>
                        <p className="text-gray-600">
                            Your Xero data appears to be in good shape. No corrections needed.
                        </p>
                    </CardContent>
                </Card>
            )}
        </div>
    )
}

// Issue Card Component
function IssueCard({
    issue,
    isSelected,
    onToggleSelect,
    getSeverityColor,
    getIssueTypeLabel,
    isAutoCorrected = false
}: {
    issue: DataQualityIssue
    isSelected: boolean
    onToggleSelect: () => void
    getSeverityColor: (severity: string) => string
    getIssueTypeLabel: (type: string) => string
    isAutoCorrected?: boolean
}) {
    return (
        <div className={`border rounded-lg p-4 ${isSelected ? 'border-blue-500 bg-blue-50' : 'border-gray-200'}`}>
            <div className="flex items-start justify-between">
                <div className="flex items-start gap-4 flex-1">
                    {!isAutoCorrected && (
                        <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={onToggleSelect}
                            className="mt-1"
                        />
                    )}

                    <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                            <Badge className={getSeverityColor(issue.severity)}>
                                {issue.severity.toUpperCase()}
                            </Badge>
                            <Badge variant="outline">{getIssueTypeLabel(issue.issueType)}</Badge>
                            {isAutoCorrected && (
                                <Badge className="bg-green-100 text-green-800">Auto-Corrected</Badge>
                            )}
                            <span className="text-sm text-gray-500">{issue.financialYear}</span>
                        </div>

                        <div className="grid grid-cols-2 gap-4 text-sm">
                            <div>
                                <div className="font-semibold text-red-700">Current (Incorrect):</div>
                                <div className="text-gray-700">
                                    {issue.currentState.accountCode && `Account: ${issue.currentState.accountCode} - ${issue.currentState.accountName}`}
                                    {issue.currentState.description && <div>{issue.currentState.description}</div>}
                                    {issue.currentState.amount && <div>Amount: ${issue.currentState.amount.toLocaleString()}</div>}
                                </div>
                            </div>

                            <div>
                                <div className="font-semibold text-green-700">Suggested (Correct):</div>
                                <div className="text-gray-700">
                                    {issue.suggestedFix.accountCode && `Account: ${issue.suggestedFix.accountCode} - ${issue.suggestedFix.accountName}`}
                                    {issue.suggestedFix.reasoning && <div className="italic text-sm mt-1">{issue.suggestedFix.reasoning}</div>}
                                </div>
                            </div>
                        </div>

                        <div className="mt-2 text-sm text-gray-600">
                            <strong>AI Reasoning:</strong> {issue.aiReasoning}
                        </div>
                    </div>
                </div>

                <div className="text-right">
                    <div className="text-sm font-semibold">
                        Confidence: {issue.confidence}%
                    </div>
                    <div className="text-lg font-bold text-gray-700">
                        ${issue.impactAmount.toLocaleString()}
                    </div>
                    <div className="text-xs text-gray-500">Impact</div>
                </div>
            </div>
        </div>
    )
}
