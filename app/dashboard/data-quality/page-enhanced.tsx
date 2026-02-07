/**
 * Enhanced Data Quality & Forensic Correction Dashboard
 *
 * Features:
 * - Live progress visualization with animated components
 * - Real-time charts and counters
 * - Activity feed showing live updates
 * - Dual-format view (Client vs Accountant)
 * - Beautiful glassmorphism design
 */

'use client'

import { useEffect, useState, useCallback } from 'react'
import { Scan, AlertCircle, CheckCircle, TrendingUp } from 'lucide-react'
import LiveProgressCard from '@/components/dashboard/LiveProgressCard'
import AnimatedCounter from '@/components/dashboard/AnimatedCounter'
import LiveChart from '@/components/dashboard/LiveChart'
import ActivityFeed, { ActivityItem } from '@/components/dashboard/ActivityFeed'
import FormatToggleWrapper from '@/components/dashboard/FormatToggleWrapper'
import {
  transformDataQualityToClientView,
  type DataQualityScanResult
} from '@/lib/utils/client-view-transformer'
import { createLogger } from '@/lib/logger'

const log = createLogger('dashboard:data-quality')

interface ScanStatus extends DataQualityScanResult {
  status: 'idle' | 'scanning' | 'complete' | 'error'
  progress: number
  message: string
}

export default function DataQualityPage() {
  const [scanStatus, setScanStatus] = useState<ScanStatus | null>(null)
  const [isScanning, setIsScanning] = useState(false)
  const [tenantId, setTenantId] = useState<string>('')
  const [activities, setActivities] = useState<ActivityItem[]>([])
  const [pollInterval, setPollInterval] = useState<NodeJS.Timeout | null>(null)

  // Get tenant ID on mount
  useEffect(() => {
    const fetchTenant = async () => {
      try {
        const res = await fetch('/api/xero/organizations')
        const data = await res.json()
        if (data.connections?.[0]) {
          const tid = data.connections[0].tenant_id
          setTenantId(tid)
          localStorage.setItem('xero_tenant_id', tid)
          fetchScanStatus(tid)
        }
      } catch (error) {
        console.error('Failed to fetch tenant:', error)
      }
    }
    fetchTenant()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const fetchScanStatus = useCallback(async (tid: string) => {
    try {
      const res = await fetch(`/api/data-quality/scan?tenantId=${tid}`)
      const data = await res.json()
      setScanStatus(data)
      setIsScanning(data.status === 'scanning')

      // Add activity when status changes
      if (data.message) {
        addActivity({
          id: Date.now().toString(),
          timestamp: new Date(),
          message: data.message,
          type: data.status === 'complete' ? 'success' : 'info'
        })
      }

      return data
    } catch (error) {
      console.error('Failed to fetch scan status:', error)
      return null
    }
  }, [])

  const addActivity = (activity: ActivityItem) => {
    setActivities(prev => [...prev, activity])
  }

  const startScan = async () => {
    if (!tenantId) {
      alert('No Xero connection found. Please connect to Xero first.')
      return
    }

    setIsScanning(true)
    addActivity({
      id: Date.now().toString(),
      timestamp: new Date(),
      message: 'Starting data quality scan...',
      type: 'info'
    })

    try {
      const res = await fetch('/api/data-quality/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenantId,
          financialYears: ['FY2024-25', 'FY2023-24'],
          autoFixThreshold: 90,
          applyCorrections: true
        })
      })

      const data = await res.json()
      log.info('Scan started', { status: data.status })

      // Start polling for progress
      const interval = setInterval(async () => {
        const status = await fetchScanStatus(tenantId)

        if (status?.status === 'complete') {
          clearInterval(interval)
          setIsScanning(false)
          setPollInterval(null)
          addActivity({
            id: Date.now().toString(),
            timestamp: new Date(),
            message: `Scan complete! Found ${status.issuesFound} issues in ${status.transactionsScanned} transactions`,
            type: 'success'
          })
        } else if (status?.status === 'error') {
          clearInterval(interval)
          setIsScanning(false)
          setPollInterval(null)
          addActivity({
            id: Date.now().toString(),
            timestamp: new Date(),
            message: 'Scan failed - please try again',
            type: 'error'
          })
        }
      }, 2000)

      setPollInterval(interval)
    } catch (error) {
      console.error('Failed to start scan:', error)
      setIsScanning(false)
      addActivity({
        id: Date.now().toString(),
        timestamp: new Date(),
        message: 'Failed to start scan - check connection',
        type: 'error'
      })
    }
  }

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollInterval) clearInterval(pollInterval)
    }
  }, [pollInterval])

  // Prepare chart data
  const issueTypeChartData = scanStatus
    ? [
        { name: 'Duplicates', value: scanStatus.issuesByType.duplicate, color: '#f59e0b' },
        { name: 'Wrong Account', value: scanStatus.issuesByType.wrongAccount, color: '#ef4444' },
        {
          name: 'Tax Errors',
          value: scanStatus.issuesByType.taxClassification,
          color: '#8b5cf6'
        },
        {
          name: 'Unreconciled',
          value: scanStatus.issuesByType.unreconciled,
          color: '#06b6d4'
        }
      ].filter(item => item.value > 0)
    : []

  // Calculate ETA (rough estimate)
  const calculateETA = () => {
    if (!scanStatus || scanStatus.status !== 'scanning') return undefined
    const remaining = 100 - scanStatus.progress
    const secondsRemaining = Math.round((remaining / 100) * 120) // Assume 2 min total
    return `${Math.floor(secondsRemaining / 60)}m ${secondsRemaining % 60}s`
  }

  return (
    <div className="flex min-h-screen">
      {/* Sidebar would go here - using existing from main dashboard */}

      {/* Main Content */}
      <main className="flex-1 p-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-2xl font-bold mb-1">Data Quality Scan</h2>
            <p className="text-[var(--text-secondary)]">
              AI-powered validation and auto-correction
            </p>
          </div>
          <button
            onClick={startScan}
            disabled={isScanning}
            className={`btn ${isScanning ? 'btn-secondary' : 'btn-primary'}`}
          >
            {isScanning ? (
              <>
                <div className="loading-spinner w-4 h-4" />
                Scanning...
              </>
            ) : (
              <>
                <Scan className="w-4 h-4" />
                Start Scan
              </>
            )}
          </button>
        </div>

        {/* Live Progress Section - Only show when scanning or complete */}
        {scanStatus && scanStatus.status !== 'idle' && (
          <div className="grid lg:grid-cols-3 gap-6 mb-8">
            {/* Main Progress Card */}
            <div className="lg:col-span-2">
              <LiveProgressCard
                title="Transaction Scanning"
                value={scanStatus.transactionsScanned}
                total={1000}
                percentage={scanStatus.progress}
                icon={<Scan className="w-6 h-6" />}
                color="xero"
                subtitle="AI analyzing transaction data"
                eta={calculateETA()}
                isAnimating={isScanning}
              />
            </div>

            {/* Quick Stats */}
            <div className="space-y-4">
              <div className="glass-card p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-[var(--text-secondary)]">Issues Found</span>
                  <AlertCircle className="w-5 h-5 text-amber-400" />
                </div>
                <AnimatedCounter
                  value={scanStatus.issuesFound}
                  className="text-3xl font-bold text-amber-400"
                />
              </div>

              <div className="glass-card p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-[var(--text-secondary)]">Auto-Fixed</span>
                  <CheckCircle className="w-5 h-5 text-emerald-400" />
                </div>
                <AnimatedCounter
                  value={scanStatus.issuesAutoCorrected}
                  className="text-3xl font-bold text-emerald-400"
                />
              </div>
            </div>
          </div>
        )}

        {/* Results Section - Only show when complete */}
        {scanStatus && scanStatus.status === 'complete' && (
          <div className="grid lg:grid-cols-2 gap-6 mb-8">
            {/* Issue Breakdown Chart */}
            {issueTypeChartData.length > 0 && (
              <LiveChart
                data={issueTypeChartData}
                type="pie"
                title="Issue Breakdown"
                height={300}
              />
            )}

            {/* Financial Impact Card */}
            <div className="glass-card p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center">
                  <TrendingUp className="w-6 h-6 text-emerald-400" />
                </div>
                <div>
                  <h3 className="font-semibold">Financial Impact</h3>
                  <p className="text-xs text-[var(--text-muted)]">
                    Potential savings from corrections
                  </p>
                </div>
              </div>

              <AnimatedCounter
                value={scanStatus.totalImpactAmount}
                format="currency"
                decimals={2}
                className="text-4xl font-bold text-emerald-400"
              />

              <div className="mt-6 grid grid-cols-2 gap-4">
                <div className="text-center p-3 bg-[var(--bg-tertiary)] rounded-lg">
                  <div className="text-2xl font-bold text-[var(--text-primary)]">
                    {scanStatus.issuesPendingReview}
                  </div>
                  <div className="text-xs text-[var(--text-muted)]">Need Review</div>
                </div>
                <div className="text-center p-3 bg-[var(--bg-tertiary)] rounded-lg">
                  <div className="text-2xl font-bold text-[var(--text-primary)]">
                    {Math.round(((scanStatus.transactionsScanned - scanStatus.issuesFound) / scanStatus.transactionsScanned) * 100)}%
                  </div>
                  <div className="text-xs text-[var(--text-muted)]">Accuracy</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Activity Feed */}
        {activities.length > 0 && (
          <div className="mb-8">
            <ActivityFeed
              items={activities}
              maxItems={15}
              autoScroll={true}
              showTimestamps={true}
            />
          </div>
        )}

        {/* Dual-Format Results View */}
        {scanStatus && scanStatus.status === 'complete' && (
          <FormatToggleWrapper
            clientView={<ClientView data={scanStatus} />}
            technicalView={<TechnicalView data={scanStatus} />}
            defaultView="accountant"
          />
        )}
      </main>
    </div>
  )
}

// Client-friendly view component
function ClientView({ data }: { data: DataQualityScanResult }) {
  const summary = transformDataQualityToClientView(data)

  return (
    <div className="space-y-6">
      {/* Headline Card */}
      <div className="glass-card p-8 text-center">
        <div className="text-4xl mb-2">
          {summary.visualData.accuracyScore >= 95 ? '🎉' : summary.visualData.accuracyScore >= 85 ? '✅' : '⚠️'}
        </div>
        <h2 className="text-3xl font-bold text-[var(--text-primary)] mb-4">
          {summary.headline}
        </h2>
        <p className="text-[var(--text-secondary)] max-w-2xl mx-auto">
          {summary.whatThisMeans}
        </p>
      </div>

      {/* Key Findings */}
      <div className="glass-card p-6">
        <h3 className="text-xl font-semibold text-[var(--text-primary)] mb-4">
          What We Found
        </h3>
        <ul className="space-y-3">
          {summary.keyFindings.map((finding, index) => (
            <li key={index} className="flex items-start gap-3">
              <CheckCircle className="w-5 h-5 text-emerald-400 mt-0.5 flex-shrink-0" />
              <span className="text-[var(--text-secondary)]">{finding}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Quick Stats */}
      <div className="grid md:grid-cols-3 gap-6">
        <div className="glass-card p-6 text-center">
          <div className="text-4xl font-bold text-emerald-400 mb-2">
            ${Math.round(summary.visualData.savingsPotential / 1000)}k
          </div>
          <div className="text-sm text-[var(--text-secondary)]">Potential Savings</div>
        </div>
        <div className="glass-card p-6 text-center">
          <div className="text-4xl font-bold text-amber-400 mb-2">
            {summary.visualData.issuesCount}
          </div>
          <div className="text-sm text-[var(--text-secondary)]">Issues to Review</div>
        </div>
        <div className="glass-card p-6 text-center">
          <div className="text-4xl font-bold text-sky-400 mb-2">
            {summary.visualData.estimatedFixTime}
          </div>
          <div className="text-sm text-[var(--text-secondary)]">Estimated Fix Time</div>
        </div>
      </div>

      {/* Next Steps */}
      <div className="glass-card p-6">
        <h3 className="text-xl font-semibold text-[var(--text-primary)] mb-4">
          Next Steps
        </h3>
        <ol className="space-y-3">
          {summary.nextSteps.map((step, index) => (
            <li key={index} className="flex items-start gap-3">
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-sky-500/20 text-sky-400 flex items-center justify-center text-sm font-semibold">
                {index + 1}
              </span>
              <span className="text-[var(--text-secondary)]">{step}</span>
            </li>
          ))}
        </ol>
      </div>

      {/* Download Button */}
      <div className="flex justify-center">
        <button className="btn btn-primary">
          Download Client-Friendly Report
        </button>
      </div>
    </div>
  )
}

// Technical view component
function TechnicalView({ data }: { data: DataQualityScanResult }) {
  return (
    <div className="space-y-6">
      {/* Technical Summary */}
      <div className="glass-card p-6">
        <h3 className="text-xl font-semibold text-[var(--text-primary)] mb-4">
          Technical Analysis Summary
        </h3>
        <div className="grid md:grid-cols-2 gap-6">
          <div>
            <p className="text-sm text-[var(--text-muted)] mb-1">Transactions Scanned</p>
            <p className="text-2xl font-bold text-[var(--text-primary)]">
              {data.transactionsScanned.toLocaleString()}
            </p>
          </div>
          <div>
            <p className="text-sm text-[var(--text-muted)] mb-1">Financial Years</p>
            <p className="text-2xl font-bold text-[var(--text-primary)]">FY2024-25, FY2023-24</p>
          </div>
          <div>
            <p className="text-sm text-[var(--text-muted)] mb-1">AI Model</p>
            <p className="text-2xl font-bold text-[var(--text-primary)]">Gemini 3 Flash</p>
          </div>
          <div>
            <p className="text-sm text-[var(--text-muted)] mb-1">Confidence Level</p>
            <p className="text-2xl font-bold text-[var(--text-primary)]">
              {data.confidence}%
            </p>
          </div>
        </div>
      </div>

      {/* Issue Breakdown */}
      <div className="glass-card p-6">
        <h3 className="text-xl font-semibold text-[var(--text-primary)] mb-4">
          Issues Identified: {data.issuesFound}
        </h3>
        <div className="space-y-4">
          <IssueTypeRow
            label="Duplicate Transactions"
            count={data.issuesByType.duplicate}
            description="Same date+amount+supplier detection algorithm"
          />
          <IssueTypeRow
            label="Wrong Account Classifications"
            count={data.issuesByType.wrongAccount}
            description="AI-based account code validation"
          />
          <IssueTypeRow
            label="Tax Classification Errors"
            count={data.issuesByType.taxClassification}
            description="GST/BAS compliance validation"
          />
          <IssueTypeRow
            label="Unreconciled Transactions"
            count={data.issuesByType.unreconciled}
            description="Bank reconciliation status check"
          />
        </div>
      </div>

      {/* Correction Strategy */}
      <div className="glass-card p-6">
        <h3 className="text-xl font-semibold text-[var(--text-primary)] mb-4">
          Correction Strategy
        </h3>
        <ul className="space-y-3 text-[var(--text-secondary)]">
          <li>• <strong>{data.issuesAutoCorrected}</strong> auto-corrections applied (confidence ≥90%)</li>
          <li>• <strong>{data.issuesPendingReview}</strong> flagged for accountant review (70-89% confidence)</li>
          <li>• Total Financial Impact: <strong className="text-emerald-400">${data.totalImpactAmount.toLocaleString()}</strong></li>
          <li>• Recommended: Review medium-confidence items before finalizing</li>
        </ul>
      </div>

      {/* Download Buttons */}
      <div className="flex gap-4">
        <button className="btn btn-primary flex-1">
          View Detailed Issue List
        </button>
        <button className="btn btn-secondary flex-1">
          Export to Excel
        </button>
        <button className="btn btn-secondary flex-1">
          Download Technical Report PDF
        </button>
      </div>
    </div>
  )
}

// Helper component for issue type rows
function IssueTypeRow({ label, count, description }: { label: string; count: number; description: string }) {
  return (
    <div className="flex items-center justify-between p-4 bg-[var(--bg-tertiary)] rounded-lg">
      <div>
        <p className="font-semibold text-[var(--text-primary)]">{label}</p>
        <p className="text-sm text-[var(--text-muted)]">{description}</p>
      </div>
      <div className="text-2xl font-bold text-[var(--text-primary)]">
        {count}
      </div>
    </div>
  )
}
