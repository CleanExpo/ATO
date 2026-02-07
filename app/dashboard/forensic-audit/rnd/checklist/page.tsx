/**
 * R&D Claim Preparation Checklist Page
 *
 * Full-page view for tracking claim preparation progress across
 * documentation, AusIndustry registration, tax return, and
 * post-submission requirements.
 *
 * Division 355 ITAA 1997 - R&D Tax Incentive.
 */

'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { TaxDisclaimer } from '@/components/dashboard/TaxDisclaimer'
import { MobileNav } from '@/components/ui/MobileNav'
import { ClaimChecklist } from '@/components/rnd'

export default function RndChecklistPage() {
  const [tenantId, setTenantId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Get real tenant ID from Xero connection
  useEffect(() => {
    async function getTenant() {
      try {
        const res = await fetch('/api/xero/organizations')
        const orgs = await res.json()
        if (orgs.organisations?.[0]?.tenantId) {
          setTenantId(orgs.organisations[0].tenantId)
        } else {
          setError('No Xero organisation connected. Please connect Xero first.')
        }
      } catch (err) {
        console.error('Failed to get tenant:', err)
        setError('Failed to load organisation data.')
      } finally {
        setLoading(false)
      }
    }

    getTenant()
  }, [])

  if (loading) {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ background: '#050505' }}
      >
        <div className="text-center">
          <div
            className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin mx-auto mb-4"
            style={{ borderColor: '#8855FF' }}
          />
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
            Loading...
          </p>
        </div>
      </div>
    )
  }

  if (error || !tenantId) {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ background: '#050505' }}
      >
        <div className="text-center max-w-md">
          <p className="text-sm mb-4" style={{ color: '#FF4444' }}>
            {error || 'No tenant available'}
          </p>
          <Link
            href="/dashboard"
            className="text-sm px-4 py-2 rounded-sm transition-colors hover:bg-white/10"
            style={{
              border: '0.5px solid rgba(255, 255, 255, 0.2)',
              color: 'var(--text-secondary)',
            }}
          >
            Back to Dashboard
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen" style={{ background: '#050505' }}>
      <MobileNav />

      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
        {/* Breadcrumb */}
        <nav className="flex items-center gap-2 text-xs mb-6" style={{ color: 'var(--text-muted)' }}>
          <Link
            href="/dashboard"
            className="transition-colors hover:brightness-110"
            style={{ color: 'var(--text-secondary)' }}
          >
            Dashboard
          </Link>
          <span>/</span>
          <Link
            href="/dashboard/forensic-audit"
            className="transition-colors hover:brightness-110"
            style={{ color: 'var(--text-secondary)' }}
          >
            Forensic Audit
          </Link>
          <span>/</span>
          <Link
            href="/dashboard/forensic-audit/rnd"
            className="transition-colors hover:brightness-110"
            style={{ color: 'var(--text-secondary)' }}
          >
            R&D Tax Incentive
          </Link>
          <span>/</span>
          <span style={{ color: 'var(--accent-primary)' }}>Checklist</span>
        </nav>

        {/* Page header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div
              className="w-10 h-10 rounded-sm flex items-center justify-center"
              style={{
                background: 'rgba(136, 85, 255, 0.1)',
                border: '0.5px solid rgba(136, 85, 255, 0.3)',
              }}
            >
              <svg className="w-5 h-5" fill="none" stroke="#8855FF" viewBox="0 0 24 24" strokeWidth={1.5}>
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
            <div>
              <h1 className="text-xl font-semibold" style={{ color: 'var(--text-primary)' }}>
                R&D Claim Preparation
              </h1>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                Track every requirement for your R&D Tax Incentive claim
              </p>
            </div>
          </div>
        </div>

        {/* Quick links */}
        <div
          className="flex flex-wrap gap-3 mb-6 p-4 rounded-sm"
          style={{
            background: 'rgba(255, 255, 255, 0.02)',
            border: '0.5px solid rgba(255, 255, 255, 0.08)',
          }}
        >
          <Link
            href="/dashboard/forensic-audit/rnd/evidence"
            className="flex items-center gap-2 px-3 py-1.5 text-xs rounded-sm transition-all hover:brightness-110"
            style={{
              background: 'rgba(136, 85, 255, 0.1)',
              border: '0.5px solid rgba(136, 85, 255, 0.3)',
              color: '#8855FF',
            }}
          >
            <span>|=|</span>
            <span>Evidence Wizard</span>
          </Link>
          <a
            href="https://business.gov.au/grants-and-programs/research-and-development-tax-incentive"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-3 py-1.5 text-xs rounded-sm transition-all hover:brightness-110"
            style={{
              background: 'rgba(0, 245, 255, 0.1)',
              border: '0.5px solid rgba(0, 245, 255, 0.3)',
              color: '#00F5FF',
            }}
          >
            <span>-&gt;</span>
            <span>AusIndustry Portal</span>
          </a>
          <a
            href="https://www.ato.gov.au/businesses-and-organisations/income-deductions-and-concessions/research-and-development-tax-incentive"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-3 py-1.5 text-xs rounded-sm transition-all hover:brightness-110"
            style={{
              background: 'rgba(0, 255, 136, 0.1)',
              border: '0.5px solid rgba(0, 255, 136, 0.3)',
              color: '#00FF88',
            }}
          >
            <span>-&gt;</span>
            <span>ATO R&D Guidance</span>
          </a>
        </div>

        {/* Checklist */}
        <ClaimChecklist tenantId={tenantId} />

        {/* Disclaimer */}
        <div
          className="mt-8 p-4 rounded-sm text-xs leading-relaxed"
          style={{
            background: 'rgba(255, 136, 0, 0.05)',
            border: '0.5px solid rgba(255, 136, 0, 0.2)',
            color: 'var(--text-muted)',
          }}
        >
          <strong style={{ color: '#FF8800' }}>Disclaimer:</strong>{' '}
          This checklist is provided for informational purposes only and does not
          constitute tax advice. All R&D Tax Incentive claims should be reviewed by
          a qualified tax professional before submission. The software provides
          intelligence and estimates, not binding financial advice.
        </div>
      </div>

      <TaxDisclaimer />
    </div>
  )
}
