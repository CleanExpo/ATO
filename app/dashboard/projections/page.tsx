'use client'

import { HoloPanel, HoloPanelGrid } from '@/components/ui/HoloPanel'
import { RnDOffsetProjection } from '@/components/projections/RnDOffsetProjection'
import { FBTLiabilityProjection } from '@/components/projections/FBTLiabilityProjection'
import { SuperCapUsage } from '@/components/projections/SuperCapUsage'
import { SmallBusinessCGTConcession } from '@/components/projections/SmallBusinessCGTConcession'
import { LossCarryForwardTimeline } from '@/components/projections/LossCarryForwardTimeline'
import { TaxDisclaimer } from '@/components/dashboard/TaxDisclaimer'

/**
 * Projections Dashboard - Tax offset and concession projections
 *
 * Shows real-time gauges and meters for all major tax offsets.
 * Data sourced from existing API endpoints; empty states shown
 * when data is not yet available.
 */
export default function ProjectionsPage() {
  // In production, these would be fetched from Backend_Dev's API endpoints.
  // For now, show empty states per CLAUDE.md requirements (no mock data).
  const hasData = false

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

      {!hasData ? (
        <div className="card" style={{ textAlign: 'center', padding: 'var(--space-3xl)', color: 'var(--text-tertiary)' }}>
          <p className="typo-title" style={{ marginBottom: 'var(--space-sm)' }}>
            No projection data available
          </p>
          <p className="typo-subtitle">
            Connect your accounting platform and run a forensic audit to generate tax offset projections.
          </p>
        </div>
      ) : (
        <>
          {/* R&D + FBT side by side */}
          <HoloPanelGrid layout="equal" className="mb-6">
            <HoloPanel title="R&D Tax Incentive" subtitle="Division 355 ITAA 1997">
              <RnDOffsetProjection
                eligibleExpenditure={0}
                offsetAmount={0}
                maxOffset={0}
              />
            </HoloPanel>
            <HoloPanel title="Fringe Benefits Tax" subtitle="FBTAA 1986">
              <FBTLiabilityProjection
                totalLiability={0}
                estimatedPayable={0}
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
              concessionalUsed={0}
              nonConcessionalUsed={0}
            />
          </HoloPanel>

          {/* CGT Concessions */}
          <HoloPanel
            title="CGT Concessions"
            subtitle="Division 152 ITAA 1997"
            className="mb-6"
          >
            <SmallBusinessCGTConcession
              criteria={[]}
            />
          </HoloPanel>

          {/* Loss carry-forward */}
          <HoloPanel
            title="Loss Carry-Forward"
            subtitle="Subdivision 36-A ITAA 1997"
          >
            <LossCarryForwardTimeline years={[]} />
          </HoloPanel>
        </>
      )}

      <TaxDisclaimer sticky />
    </div>
  )
}
