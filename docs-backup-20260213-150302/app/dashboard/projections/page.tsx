'use client'

import { useState, useEffect, useCallback } from 'react'
import { HoloPanel, HoloPanelGrid } from '@/components/ui/HoloPanel'
import { RnDOffsetProjection } from '@/components/projections/RnDOffsetProjection'
import { FBTLiabilityProjection } from '@/components/projections/FBTLiabilityProjection'
import { SuperCapUsage } from '@/components/projections/SuperCapUsage'
import { SmallBusinessCGTConcession } from '@/components/projections/SmallBusinessCGTConcession'
import { LossCarryForwardTimeline } from '@/components/projections/LossCarryForwardTimeline'
import { TaxDisclaimer } from '@/components/dashboard/TaxDisclaimer'

interface ProjectionData {
  rnd: { eligibleExpenditure: number; offsetAmount: number; maxOffset: number }
  fbt: { totalLiability: number; estimatedPayable: number }
  super: { concessionalUsed: number; nonConcessionalUsed: number }
  cgt: { criteria: Array<{ name: string; met: boolean | null; detail: string; legislativeRef: string }> }
  losses: { years: Array<{ financialYear: string; lossAmount: number; cotCompliant: boolean; sbtCompliant: boolean; utilised: number; carried: number }> }
}

/**
 * Projections Dashboard - Tax offset and concession projections
 *
 * Shows real-time gauges and meters for all major tax offsets.
 * Data sourced from existing API endpoints; empty states shown
 * when data is not yet available.
 */
export default function ProjectionsPage() {
  const [loading, setLoading] = useState(true)
  const [hasData, setHasData] = useState(false)
  const [projections, setProjections] = useState<ProjectionData | null>(null)
  const [emptyReason, setEmptyReason] = useState<'no-connection' | 'no-analysis'>('no-connection')

  const fetchProjectionData = useCallback(async () => {
    try {
      // Check for connected organisations
      const orgsRes = await fetch('/api/xero/organizations')
      if (!orgsRes.ok) {
        setEmptyReason('no-connection')
        return
      }
      const orgsData = await orgsRes.json()
      const connections = orgsData.connections || orgsData.organizations || []

      if (connections.length === 0) {
        setEmptyReason('no-connection')
        return
      }

      // Use the first connected org's tenant ID
      const tenantId = connections[0].tenant_id || connections[0].tenantId

      if (!tenantId) {
        setEmptyReason('no-connection')
        return
      }

      // Check if analysis has been run by fetching recommendations
      const recRes = await fetch(`/api/audit/recommendations?tenantId=${encodeURIComponent(tenantId)}`)
      if (!recRes.ok) {
        setEmptyReason('no-analysis')
        return
      }
      const recData = await recRes.json()

      const totalRecs = recData.summary?.totalRecommendations ?? recData.recommendations?.length ?? 0
      if (totalRecs === 0) {
        setEmptyReason('no-analysis')
        return
      }

      // Extract projection data from recommendations
      const recs = recData.recommendations || []
      const rndRecs = recs.filter((r: any) => r.category === 'rnd_candidate' || r.primary_category === 'rnd_candidate')
      const rndTotal = rndRecs.reduce((sum: number, r: any) => sum + (r.estimated_benefit || r.estimatedBenefit || 0), 0)

      setProjections({
        rnd: {
          eligibleExpenditure: rndRecs.reduce((sum: number, r: any) => sum + Math.abs(r.amount || 0), 0),
          offsetAmount: rndTotal,
          maxOffset: 4000000, // s 355-100(3) ITAA 1997 cap
        },
        fbt: {
          totalLiability: 0,
          estimatedPayable: 0,
        },
        super: {
          concessionalUsed: 0,
          nonConcessionalUsed: 0,
        },
        cgt: { criteria: [] },
        losses: { years: [] },
      })
      setHasData(true)
    } catch {
      setEmptyReason('no-connection')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchProjectionData()
  }, [fetchProjectionData])

  return (
    <div id="main-content" style={{ paddingBottom: 'var(--space-3xl)' }}>
      {/* Page header */}
      <div style={{ marginBottom: 'var(--space-xl)' }}>
        <h1 className="typo-headline">Tax Offset Projections</h1>
        <p className="typo-subtitle" style={{ marginTop: 'var(--space-xs)' }}>
          Projected offsets, concessions, and cap usage for the current financial year
        </p>
        <span className="estimate-label" style={{ marginTop: 'var(--space-sm)' }}>
          ALL VALUES ARE ESTIMATES
        </span>
      </div>

      {loading ? (
        <div className="space-y-6 animate-in fade-in duration-300">
          <div className="card" style={{ padding: 'var(--space-xl)', height: '200px' }}>
            <div className="animate-pulse" style={{ background: 'var(--surface-2)', height: '100%', borderRadius: '4px' }} />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="card" style={{ padding: 'var(--space-xl)', height: '160px' }}>
              <div className="animate-pulse" style={{ background: 'var(--surface-2)', height: '100%', borderRadius: '4px' }} />
            </div>
            <div className="card" style={{ padding: 'var(--space-xl)', height: '160px' }}>
              <div className="animate-pulse" style={{ background: 'var(--surface-2)', height: '100%', borderRadius: '4px' }} />
            </div>
          </div>
        </div>
      ) : !hasData ? (
        <div className="card" style={{ textAlign: 'center', padding: 'var(--space-3xl)', color: 'var(--text-tertiary)' }}>
          <p className="typo-title" style={{ marginBottom: 'var(--space-sm)' }}>
            {emptyReason === 'no-connection'
              ? 'No accounting platform connected'
              : 'No analysis data available'}
          </p>
          <p className="typo-subtitle" style={{ marginBottom: 'var(--space-lg)' }}>
            {emptyReason === 'no-connection'
              ? 'Connect your Xero account to unlock tax offset projections.'
              : 'Run a forensic audit on your synced transactions to generate projections.'}
          </p>
          <a
            href={emptyReason === 'no-connection' ? '/dashboard/connect' : '/dashboard'}
            className="btn-primary"
            style={{ display: 'inline-block', padding: '8px 24px', textDecoration: 'none' }}
          >
            {emptyReason === 'no-connection' ? 'Connect Xero' : 'Go to Dashboard'}
          </a>
        </div>
      ) : (
        <>
          {/* R&D + FBT side by side */}
          <HoloPanelGrid layout="equal" className="mb-6">
            <HoloPanel title="R&D Tax Incentive" subtitle="Division 355 ITAA 1997">
              <RnDOffsetProjection
                eligibleExpenditure={projections?.rnd.eligibleExpenditure ?? 0}
                offsetAmount={projections?.rnd.offsetAmount ?? 0}
                maxOffset={projections?.rnd.maxOffset ?? 0}
              />
            </HoloPanel>
            <HoloPanel title="Fringe Benefits Tax" subtitle="FBTAA 1986">
              <FBTLiabilityProjection
                totalLiability={projections?.fbt.totalLiability ?? 0}
                estimatedPayable={projections?.fbt.estimatedPayable ?? 0}
              />
            </HoloPanel>
          </HoloPanelGrid>

          {/* Super cap usage */}
          <HoloPanel
            title="Superannuation"
            subtitle="Division 291 ITAA 1997"
            className="mb-6"
          >
            <SuperCapUsage
              concessionalUsed={projections?.super.concessionalUsed ?? 0}
              nonConcessionalUsed={projections?.super.nonConcessionalUsed ?? 0}
            />
          </HoloPanel>

          {/* CGT Concessions */}
          <HoloPanel
            title="CGT Concessions"
            subtitle="Division 152 ITAA 1997"
            className="mb-6"
          >
            <SmallBusinessCGTConcession
              criteria={projections?.cgt.criteria ?? []}
            />
          </HoloPanel>

          {/* Loss carry-forward */}
          <HoloPanel
            title="Loss Carry-Forward"
            subtitle="Subdivision 36-A ITAA 1997"
          >
            <LossCarryForwardTimeline years={projections?.losses.years ?? []} />
          </HoloPanel>
        </>
      )}

      <TaxDisclaimer sticky />
    </div>
  )
}
