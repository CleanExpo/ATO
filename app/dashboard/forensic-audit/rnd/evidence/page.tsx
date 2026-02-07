'use client'

/**
 * R&D Evidence Collection Page
 *
 * Wizard interface for collecting evidence for the Division 355
 * four-element test per R&D project.
 *
 * Division 355 ITAA 1997 - R&D Tax Incentive evidence collection.
 */

import { useEffect, useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { TaxDisclaimer } from '@/components/dashboard/TaxDisclaimer'
import Link from 'next/link'
import { MobileNav } from '@/components/ui/MobileNav'
import { EvidenceWizard } from '@/components/rnd'

function EvidencePageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [tenantId, setTenantId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Get project name and registration ID from query params
  const projectName = searchParams.get('project')
  const registrationId = searchParams.get('registrationId')

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
        }
      } catch (err) {
        console.error('Failed to get tenant ID:', err)
        setError('Failed to load Xero connection')
      } finally {
        setLoading(false)
      }
    }
    getTenant()
  }, [])

  // Validate project name is provided
  useEffect(() => {
    if (!loading && !projectName) {
      setError('Project name is required. Please select an R&D project first.')
    }
  }, [loading, projectName])

  const handleComplete = () => {
    // Navigate back to R&D page
    router.push('/dashboard/forensic-audit/rnd')
  }

  const handleCancel = () => {
    router.back()
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div
            className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin mx-auto mb-4"
            style={{ borderColor: '#8855FF' }}
          />
          <p style={{ color: 'var(--text-muted)' }}>Loading...</p>
        </div>
      </div>
    )
  }

  if (error || !tenantId || !projectName) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div
          className="max-w-md p-6 rounded-sm text-center"
          style={{
            background: 'rgba(255, 68, 68, 0.06)',
            border: '0.5px solid rgba(255, 68, 68, 0.2)',
          }}
        >
          <h2 className="font-semibold mb-2" style={{ color: '#FF4444' }}>
            Error
          </h2>
          <p className="text-sm mb-4" style={{ color: 'var(--text-secondary)' }}>
            {error || 'Unable to load evidence wizard'}
          </p>
          <Link
            href="/dashboard/forensic-audit/rnd"
            className="inline-block px-4 py-2 rounded-sm text-sm font-medium transition-all hover:brightness-110"
            style={{
              background: '#8855FF',
              color: '#FFFFFF',
            }}
          >
            Back to R&D Analysis
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen p-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <Link
            href="/dashboard/forensic-audit/rnd"
            className="text-sm transition-colors hover:brightness-110 mb-2 inline-block"
            style={{ color: 'var(--accent-primary)' }}
          >
            &#8592; Back to R&D Analysis
          </Link>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
            Collect R&D Evidence
          </h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
            Division 355 Four-Element Test Documentation
          </p>
        </div>

        {/* Project info banner */}
        <div
          className="p-4 rounded-sm mb-6"
          style={{
            background: 'rgba(136, 85, 255, 0.06)',
            border: '0.5px solid rgba(136, 85, 255, 0.2)',
          }}
        >
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-sm flex items-center justify-center"
              style={{ background: 'rgba(136, 85, 255, 0.2)' }}
            >
              <span style={{ color: '#8855FF' }}>|=|</span>
            </div>
            <div>
              <h2 className="font-medium" style={{ color: 'var(--text-primary)' }}>
                {decodeURIComponent(projectName)}
              </h2>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                Collecting evidence for R&D Tax Incentive claim
              </p>
            </div>
          </div>
        </div>

        {/* Evidence Wizard */}
        <EvidenceWizard
          projectName={decodeURIComponent(projectName)}
          tenantId={tenantId}
          registrationId={registrationId ?? undefined}
          onComplete={handleComplete}
          onCancel={handleCancel}
        />

        {/* Guidance note */}
        <div
          className="mt-6 p-4 rounded-sm"
          style={{
            background: 'rgba(0, 245, 255, 0.04)',
            border: '0.5px solid rgba(0, 245, 255, 0.15)',
          }}
        >
          <h3 className="text-sm font-medium mb-2" style={{ color: 'var(--accent-primary)' }}>
            Why Evidence Matters
          </h3>
          <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
            Strong evidence is critical for R&D Tax Incentive claims. The ATO may audit
            claims at any time, and contemporaneous documentation (created during the R&D
            activity) carries significantly more weight than evidence created after the fact.
            Focus on gathering documents that demonstrate each element of the four-element
            test was genuinely met.
          </p>
        </div>
      </div>

      {/* Mobile Navigation */}
      <MobileNav />
    </div>
  )
}

export default function EvidencePage() {
  return (
    <>
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <div
              className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin mx-auto mb-4"
              style={{ borderColor: '#8855FF' }}
            />
            <p style={{ color: 'var(--text-muted)' }}>Loading...</p>
          </div>
        </div>
      }
    >
      <EvidencePageContent />
    </Suspense>
    <TaxDisclaimer />
    </>
  )
}
