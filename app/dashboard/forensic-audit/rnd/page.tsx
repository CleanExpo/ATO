/**
 * R&D Tax Incentive Detail Page
 *
 * Shows all R&D projects identified with Division 355 analysis,
 * registration status tracking, and deadline timeline.
 */

'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { MobileNav } from '@/components/ui/MobileNav'
import {
  RegistrationStatusCard,
  DeadlineTimeline,
  RegistrationWorkflow,
  DeadlineAlertBanner,
} from '@/components/rnd'
import {
  type RndRegistrationStatus,
  type DeadlineUrgency,
} from '@/lib/types/rnd-registration'

interface RndProject {
  projectName: string
  projectDescription: string
  financialYears: string[]
  totalExpenditure: number
  eligibleExpenditure: number
  estimatedOffset: number
  meetsEligibility: boolean
  overallConfidence: number
  transactionCount: number
  registrationDeadline: Date
  registrationStatus: 'not_registered' | 'deadline_approaching' | 'deadline_passed'
  recommendations: string[]
}

interface RndSummary {
  totalProjects: number
  totalEligibleExpenditure: number
  totalEstimatedOffset: number
  averageConfidence: number
  coreRndTransactions: number
  supportingRndTransactions: number
  projects: RndProject[]
}

interface DeadlineData {
  financialYear: string
  deadlineDate: string
  daysUntilDeadline: number
  urgencyLevel: DeadlineUrgency
  registrationStatus: RndRegistrationStatus
  eligibleExpenditure?: number
  estimatedOffset?: number
  ausindustryReference?: string
}

export default function RndDetailPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<RndSummary | null>(null)
  const [selectedProject, setSelectedProject] = useState<RndProject | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [tenantId, setTenantId] = useState<string | null>(null)
  const [deadlines, setDeadlines] = useState<DeadlineData[]>([])
  const [deadlinesLoading, setDeadlinesLoading] = useState(false)
  const [selectedFY, setSelectedFY] = useState<string | null>(null)
  const [showWorkflow, setShowWorkflow] = useState(false)

  // Get real tenant ID from Xero connection
  useEffect(() => {
    async function getTenant() {
      try {
        const res = await fetch('/api/xero/organizations')
        const orgs = await res.json()
        if (orgs.organisations?.[0]?.tenantId) {
          setTenantId(orgs.organisations[0].tenantId)
        } else {
          setError('No Xero connection found. Please connect to Xero first.')
          setLoading(false)
        }
      } catch (error) {
        console.error('Failed to get tenant ID:', error)
        setError('Failed to load Xero connection')
        setLoading(false)
      }
    }
    getTenant()
  }, [])

  // Load data when tenantId is available
  useEffect(() => {
    if (tenantId) {
      loadRndData()
      loadDeadlines()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantId])

  // Load registration deadlines from API
  const loadDeadlines = useCallback(async () => {
    if (!tenantId) return

    try {
      setDeadlinesLoading(true)
      const res = await fetch(`/api/rnd/deadlines?tenantId=${tenantId}`)
      if (res.ok) {
        const data = await res.json()
        setDeadlines(data.deadlines || [])
      }
    } catch (err) {
      console.error('Failed to load deadlines:', err)
    } finally {
      setDeadlinesLoading(false)
    }
  }, [tenantId])

  // Handle starting registration for a FY
  const handleStartRegistration = async (financialYear: string) => {
    if (!tenantId) return

    try {
      // Create or update registration record
      const res = await fetch('/api/rnd/registrations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenantId,
          financialYear,
          registrationStatus: 'in_progress',
        }),
      })

      if (res.ok) {
        // Refresh deadlines
        await loadDeadlines()
        // Show workflow for this FY
        setSelectedFY(financialYear)
        setShowWorkflow(true)
      }
    } catch (err) {
      console.error('Failed to start registration:', err)
    }
  }

  // Handle updating registration status
  const handleUpdateStatus = async (status: RndRegistrationStatus) => {
    if (!tenantId || !selectedFY) return

    try {
      // Get the registration ID for this FY
      const deadline = deadlines.find((d) => d.financialYear === selectedFY)
      if (!deadline) return

      // Update via POST (upsert)
      const res = await fetch('/api/rnd/registrations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenantId,
          financialYear: selectedFY,
          registrationStatus: status,
        }),
      })

      if (res.ok) {
        await loadDeadlines()
      }
    } catch (err) {
      console.error('Failed to update status:', err)
    }
  }

  async function loadRndData() {
    if (!tenantId) return

    try {
      setLoading(true)
      setError(null)

      // Call the real R&D summary API endpoint
      const res = await fetch(`/api/audit/rnd-summary?tenantId=${tenantId}`)
      if (!res.ok) {
        throw new Error('Failed to load R&D data')
      }

      const apiData = await res.json()

      // Transform API data to match the expected interface
      // Type guard for project data
      interface ApiProject {
        avgConfidence?: number
        transactionCount?: number
        name?: string
        category?: string
        financialYears?: string[]
        totalSpend?: number
      }

      const transformedData: RndSummary = {
        totalProjects: apiData.totalProjects || 0,
        totalEligibleExpenditure: apiData.totalEligibleExpenditure || 0,
        totalEstimatedOffset: apiData.totalEstimatedOffset || 0,
        averageConfidence: apiData.projects?.length > 0
          ? apiData.projects.reduce((sum: number, p: ApiProject) => sum + (p.avgConfidence || 0), 0) / apiData.projects.length
          : 0,
        coreRndTransactions: apiData.projects?.reduce((sum: number, p: ApiProject) => sum + (p.transactionCount || 0), 0) || 0,
        supportingRndTransactions: 0, // Not currently tracked, could be added later
        projects: (apiData.projects || []).map((p: ApiProject) => ({
          projectName: p.name || 'Unnamed Project',
          projectDescription: `R&D activities in ${p.category}`,
          financialYears: p.financialYears || [],
          totalExpenditure: p.totalSpend || 0,
          eligibleExpenditure: p.totalSpend || 0, // Assuming all spend is eligible for R&D candidates
          estimatedOffset: (p.totalSpend || 0) * (apiData.offsetRate || 0.435),
          meetsEligibility: (p.avgConfidence || 0) >= 70,
          overallConfidence: Math.round(p.avgConfidence || 0),
          transactionCount: p.transactionCount || 0,
          registrationDeadline: calculateRegistrationDeadline(p.financialYears || []),
          registrationStatus: calculateRegistrationStatus(p.financialYears || []),
          recommendations: generateRecommendations(p, apiData.offsetRate)
        }))
      }

      setData(transformedData)
    } catch (err) {
      console.error('Failed to load R&D data:', err)
      setError('Failed to load R&D analysis data')
    } finally {
      setLoading(false)
    }
  }

  // Helper function to calculate registration deadline
  function calculateRegistrationDeadline(years: string[]): Date {
    if (!years || years.length === 0) return new Date()

    // Get the most recent year
    const latestYear = years.sort().reverse()[0]

    // Extract year from format like "FY2024-25" or "2024"
    const yearMatch = latestYear.match(/\d{4}/)
    if (!yearMatch) return new Date()

    const year = parseInt(yearMatch[0])
    // Registration deadline is 10 months after end of financial year (April 30)
    // Financial year ends June 30, so deadline is April 30 of following year
    return new Date(year + 1, 3, 30) // April = month 3 (0-indexed)
  }

  // Helper function to calculate registration status
  function calculateRegistrationStatus(years: string[]): 'not_registered' | 'deadline_approaching' | 'deadline_passed' {
    const deadline = calculateRegistrationDeadline(years)
    const now = new Date()
    const daysUntilDeadline = Math.floor((deadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))

    if (daysUntilDeadline < 0) return 'deadline_passed'
    if (daysUntilDeadline < 90) return 'deadline_approaching'
    return 'not_registered'
  }

  // Helper function to generate recommendations
  function generateRecommendations(project: { avgConfidence?: number; financialYears?: string[] }, _offsetRate: number): string[] {
    const recommendations: string[] = []
    const status = calculateRegistrationStatus(project.financialYears || [])

    if (status === 'deadline_passed') {
      recommendations.push('Registration deadline has passed')
      recommendations.push('Check if late registration is possible')
      recommendations.push('Consider amendment for previous year if applicable')
    } else if (status === 'deadline_approaching') {
      recommendations.push('URGENT: Registration deadline approaching')
      recommendations.push('Register R&D activities with AusIndustry immediately')
    } else {
      recommendations.push('Register R&D activities with AusIndustry before deadline')
    }

    recommendations.push('Lodge Schedule 16N with Company Tax Return')
    recommendations.push('Maintain technical documentation of development process')
    recommendations.push('Document four-element test compliance for each activity')

    if ((project.avgConfidence ?? 0) < 75) {
      recommendations.push('Consider additional documentation to strengthen R&D claim')
    }

    return recommendations
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="loading-spinner mx-auto mb-4"></div>
          <p className="text-[var(--text-secondary)]">Loading R&D analysis...</p>
        </div>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="alert alert--error max-w-md">
          <h2 className="font-semibold mb-2">Error</h2>
          <p>{error || 'Failed to load data'}</p>
          <button onClick={() => router.back()} className="btn btn-primary mt-4">
            Go Back
          </button>
        </div>
      </div>
    )
  }

  const statusStyles: Record<string, { bg: string; border: string; accent: string }> = {
    deadline_passed: { bg: 'rgba(255, 68, 68, 0.06)', border: 'rgba(255, 68, 68, 0.3)', accent: '#FF4444' },
    deadline_approaching: { bg: 'rgba(255, 136, 0, 0.06)', border: 'rgba(255, 136, 0, 0.3)', accent: '#FF8800' },
    not_registered: { bg: 'rgba(136, 85, 255, 0.06)', border: 'rgba(136, 85, 255, 0.3)', accent: '#8855FF' }
  }

  return (
    <div className="min-h-screen p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <Link href="/dashboard/forensic-audit" className="text-[var(--accent-primary)] hover:text-[var(--accent-secondary)] mb-2 inline-block">
            ← Back to Dashboard
          </Link>
          <h1 className="text-3xl font-bold text-[var(--text-primary)] mb-2">R&D Tax Incentive Analysis</h1>
          <p className="text-[var(--text-secondary)]">Division 355 ITAA 1997 • 43.5% Refundable Offset</p>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="glass-card p-6" style={{ borderLeft: '2px solid #8855FF' }}>
            <h3 className="text-sm font-medium text-[var(--text-muted)] mb-2">Total Projects</h3>
            <p className="text-3xl font-bold text-[var(--text-primary)]">{data.totalProjects}</p>
          </div>

          <div className="glass-card p-6" style={{ borderLeft: '2px solid #8855FF' }}>
            <h3 className="text-sm font-medium text-[var(--text-muted)] mb-2">Eligible Expenditure</h3>
            <p className="text-3xl font-bold text-[var(--text-primary)]">
              ${data.totalEligibleExpenditure.toLocaleString('en-AU')}
            </p>
          </div>

          <div className="glass-card p-6" style={{ borderLeft: '2px solid #00FF88' }}>
            <h3 className="text-sm font-medium text-[var(--text-muted)] mb-2">Estimated Offset (43.5%)</h3>
            <p className="text-3xl font-bold" style={{ color: '#00FF88' }}>
              ${data.totalEstimatedOffset.toLocaleString('en-AU')}
            </p>
          </div>

          <div className="glass-card p-6" style={{ borderLeft: '2px solid var(--accent-primary)' }}>
            <h3 className="text-sm font-medium text-[var(--text-muted)] mb-2">Average Confidence</h3>
            <p className="text-3xl font-bold text-[var(--text-primary)]">{data.averageConfidence}%</p>
          </div>
        </div>

        {/* Deadline Alert Banner */}
        {deadlines.length > 0 && (
          <DeadlineAlertBanner
            deadlines={deadlines}
            onActionClick={(fy) => {
              setSelectedFY(fy)
              setShowWorkflow(true)
            }}
            className="mb-8"
          />
        )}

        {/* Registration Status Section */}
        <div className="mb-8">
          <h2 className="text-xl font-bold text-[var(--text-primary)] mb-6">Registration Status</h2>

          {deadlinesLoading ? (
            <div className="glass-card p-6 text-center">
              <div className="loading-spinner mx-auto mb-2"></div>
              <p className="text-sm text-[var(--text-muted)]">Loading registration status...</p>
            </div>
          ) : deadlines.length === 0 ? (
            <div className="glass-card p-6 text-center">
              <p className="text-[var(--text-secondary)]">
                No R&D registration deadlines found. Complete a forensic analysis to identify R&D opportunities.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Deadline Timeline - Left column */}
              <div className="lg:col-span-1">
                <div className="glass-card p-4">
                  <h3 className="text-sm font-medium text-[var(--text-muted)] mb-4">Deadline Timeline</h3>
                  <DeadlineTimeline
                    deadlines={deadlines}
                    selectedYear={selectedFY ?? undefined}
                    onSelectDeadline={(d) => setSelectedFY(d.financialYear)}
                  />
                </div>
              </div>

              {/* Registration Cards - Right columns */}
              <div className="lg:col-span-2">
                {selectedFY && showWorkflow ? (
                  // Show workflow for selected FY
                  <RegistrationWorkflow
                    financialYear={selectedFY}
                    currentStatus={
                      deadlines.find((d) => d.financialYear === selectedFY)?.registrationStatus || 'not_started'
                    }
                    onUpdateStatus={handleUpdateStatus}
                  />
                ) : (
                  // Show registration cards for urgent/approaching deadlines
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {deadlines
                      .filter((d) => d.urgencyLevel !== 'completed' && d.urgencyLevel !== 'open')
                      .slice(0, 4)
                      .map((deadline) => (
                        <RegistrationStatusCard
                          key={deadline.financialYear}
                          financialYear={deadline.financialYear}
                          registrationStatus={deadline.registrationStatus}
                          deadlineDate={deadline.deadlineDate}
                          daysUntilDeadline={deadline.daysUntilDeadline}
                          urgencyLevel={deadline.urgencyLevel}
                          eligibleExpenditure={deadline.eligibleExpenditure}
                          estimatedOffset={deadline.estimatedOffset}
                          ausindustryReference={deadline.ausindustryReference}
                          onStartRegistration={() => handleStartRegistration(deadline.financialYear)}
                          onViewDetails={() => {
                            setSelectedFY(deadline.financialYear)
                            setShowWorkflow(true)
                          }}
                        />
                      ))}
                    {deadlines.filter((d) => d.urgencyLevel !== 'completed' && d.urgencyLevel !== 'open').length === 0 && (
                      <div className="col-span-2 glass-card p-6 text-center">
                        <p className="text-[var(--text-secondary)]">
                          No urgent deadlines. Click a financial year in the timeline to manage its registration.
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {/* Back to cards button when viewing workflow */}
                {showWorkflow && (
                  <button
                    onClick={() => setShowWorkflow(false)}
                    className="mt-4 text-sm transition-colors hover:brightness-110"
                    style={{ color: 'var(--accent-primary)' }}
                  >
                    ← Back to registration overview
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Division 355 Four-Element Test */}
        <div className="glass-card p-6 mb-8" style={{ background: 'rgba(0, 245, 255, 0.04)', border: '0.5px solid rgba(0, 245, 255, 0.15)' }}>
          <h2 className="text-lg font-bold mb-4" style={{ color: 'var(--accent-primary)' }}>Division 355 Four-Element Test</h2>
          <p className="text-sm text-[var(--text-secondary)] mb-4">
            All identified projects meet the following R&D eligibility criteria:
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="glass-card p-4">
              <h3 className="font-semibold mb-2" style={{ color: 'var(--accent-primary)' }}>1. Outcome Unknown</h3>
              <p className="text-sm text-[var(--text-secondary)]">
                The outcome of the activity could not be determined in advance on the basis of current knowledge
              </p>
            </div>
            <div className="glass-card p-4">
              <h3 className="font-semibold mb-2" style={{ color: 'var(--accent-primary)' }}>2. Systematic Approach</h3>
              <p className="text-sm text-[var(--text-secondary)]">
                Activities followed a systematic progression of work based on principles of science
              </p>
            </div>
            <div className="glass-card p-4">
              <h3 className="font-semibold mb-2" style={{ color: 'var(--accent-primary)' }}>3. New Knowledge</h3>
              <p className="text-sm text-[var(--text-secondary)]">
                Generated new knowledge about a scientific or technical uncertainty
              </p>
            </div>
            <div className="glass-card p-4">
              <h3 className="font-semibold mb-2" style={{ color: 'var(--accent-primary)' }}>4. Scientific Method</h3>
              <p className="text-sm text-[var(--text-secondary)]">
                Used principles of established science, engineering, or computer science
              </p>
            </div>
          </div>
        </div>

        {/* Projects List */}
        <div className="glass-card p-6 mb-8">
          <h2 className="text-xl font-bold text-[var(--text-primary)] mb-6">R&D Projects</h2>

          <div className="space-y-6">
            {data.projects.map((project, index) => {
              const pStyle = statusStyles[project.registrationStatus]
              return (
                <div
                  key={index}
                  className="p-6 rounded-sm cursor-pointer transition-all hover:brightness-110"
                  style={{ background: pStyle.bg, borderLeft: `2px solid ${pStyle.accent}`, border: `0.5px solid ${pStyle.border}`, borderLeftWidth: '2px' }}
                  onClick={() => setSelectedProject(selectedProject?.projectName === project.projectName ? null : project)}
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <h3 className="text-lg font-bold text-[var(--text-primary)] mb-1">{project.projectName}</h3>
                      <p className="text-sm text-[var(--text-secondary)] mb-2">{project.projectDescription}</p>
                      <div className="flex gap-4 text-sm text-[var(--text-muted)]">
                        <span>Years: {project.financialYears.join(', ')}</span>
                        <span>•</span>
                        <span>{project.transactionCount} transactions</span>
                        <span>•</span>
                        <span>Confidence: {project.overallConfidence}%</span>
                      </div>
                    </div>
                    <div className="text-right ml-4">
                      <p className="text-sm text-[var(--text-muted)] mb-1">Estimated Offset</p>
                      <p className="text-2xl font-bold" style={{ color: '#00FF88' }}>
                        ${project.estimatedOffset.toLocaleString('en-AU')}
                      </p>
                    </div>
                  </div>

                  {selectedProject?.projectName === project.projectName && (
                    <div className="mt-4 pt-4" style={{ borderTop: '0.5px solid var(--border-light)' }}>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                        <div>
                          <p className="text-xs text-[var(--text-muted)] mb-1">Total Expenditure</p>
                          <p className="font-semibold text-[var(--text-primary)]">${project.totalExpenditure.toLocaleString('en-AU')}</p>
                        </div>
                        <div>
                          <p className="text-xs text-[var(--text-muted)] mb-1">Eligible Expenditure</p>
                          <p className="font-semibold text-[var(--text-primary)]">${project.eligibleExpenditure.toLocaleString('en-AU')}</p>
                        </div>
                        <div>
                          <p className="text-xs text-[var(--text-muted)] mb-1">Registration Deadline</p>
                          <p className="font-semibold text-[var(--text-primary)]">
                            {new Date(project.registrationDeadline).toLocaleDateString()}
                          </p>
                        </div>
                      </div>

                      <div className="glass-card p-4">
                        <h4 className="font-semibold text-[var(--text-primary)] mb-2">Recommendations:</h4>
                        <ul className="space-y-2">
                          {project.recommendations.map((rec, idx) => (
                            <li key={idx} className="text-sm text-[var(--text-secondary)] flex items-start">
                              <span className="mr-2">•</span>
                              <span>{rec}</span>
                            </li>
                          ))}
                        </ul>
                      </div>

                      {/* Collect Evidence Button */}
                      <div className="mt-4 flex items-center gap-3">
                        <Link
                          href={`/dashboard/forensic-audit/rnd/evidence?project=${encodeURIComponent(project.projectName)}`}
                          onClick={(e) => e.stopPropagation()}
                          className="inline-flex items-center gap-2 px-4 py-2 rounded-sm text-sm font-medium transition-all hover:brightness-110"
                          style={{
                            background: 'rgba(136, 85, 255, 0.2)',
                            border: '0.5px solid rgba(136, 85, 255, 0.4)',
                            color: '#8855FF',
                          }}
                        >
                          <span>|=|</span>
                          <span>Collect Evidence</span>
                        </Link>
                        <span className="text-xs text-[var(--text-muted)]">
                          Build your four-element test documentation
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* Transaction Breakdown */}
        <div className="glass-card p-6">
          <h2 className="text-xl font-bold text-[var(--text-primary)] mb-4">Transaction Breakdown</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="glass-card p-4" style={{ borderLeft: '2px solid #8855FF' }}>
              <h3 className="font-semibold text-[var(--text-secondary)] mb-2">Core R&D Activities</h3>
              <p className="text-3xl font-bold" style={{ color: '#8855FF' }}>{data.coreRndTransactions}</p>
              <p className="text-sm text-[var(--text-muted)] mt-1">
                Direct experimentation and hypothesis testing activities
              </p>
            </div>

            <div className="glass-card p-4" style={{ borderLeft: '2px solid var(--accent-primary)' }}>
              <h3 className="font-semibold text-[var(--text-secondary)] mb-2">Supporting R&D Activities</h3>
              <p className="text-3xl font-bold" style={{ color: 'var(--accent-primary)' }}>{data.supportingRndTransactions}</p>
              <p className="text-sm text-[var(--text-muted)] mt-1">
                Activities directly related to core R&D (must have nexus)
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile Bottom Navigation */}
      <MobileNav />
    </div>
  )
}
