'use client'

/**
 * Pre-OAuth Data Collection Notice
 *
 * Required under Australian Privacy Principle 1.4 (Privacy Act 1988).
 * Users must be informed about what data will be collected from Xero
 * and how it will be used BEFORE the OAuth connection is initiated.
 */

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Shield, Database, Eye, Lock, ArrowLeft, ExternalLink, Cpu, Globe } from 'lucide-react'
import { TaxDisclaimer } from '@/components/dashboard/TaxDisclaimer'

export default function XeroConnectPage() {
  const router = useRouter()
  const [acknowledged, setAcknowledged] = useState(false)

  const handleConnect = () => {
    if (acknowledged) {
      router.push('/api/auth/xero')
    }
  }

  return (
    <div id="main-content" style={{ maxWidth: 720, margin: '0 auto', paddingBottom: 'var(--space-3xl)' }}>
      <div style={{ marginBottom: 'var(--space-xl)' }}>
        <Link
          href="/dashboard"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 'var(--space-xs)',
            color: 'var(--text-tertiary)',
            fontSize: '0.75rem',
            marginBottom: 'var(--space-md)',
          }}
        >
          <ArrowLeft size={14} />
          Back to Dashboard
        </Link>
        <h1 className="typo-headline">Connect Your Xero Account</h1>
        <p className="typo-subtitle" style={{ marginTop: 'var(--space-xs)' }}>
          Before connecting, please review what data we access and how it is used.
        </p>
      </div>

      {/* Data Collection Notice - APP 1.4 */}
      <div
        className="card"
        role="region"
        aria-label="Data collection notice"
        style={{ marginBottom: 'var(--space-lg)' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-md)', marginBottom: 'var(--space-lg)' }}>
          <Shield size={20} style={{ color: 'var(--accent-primary)', flexShrink: 0 }} />
          <h2 className="typo-title">Australian Privacy Principle 1 &mdash; Collection Notice</h2>
        </div>

        <div className="layout-stack" style={{ gap: 'var(--space-lg)' }}>
          {/* What we collect */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)', marginBottom: 'var(--space-sm)' }}>
              <Database size={16} style={{ color: 'var(--text-secondary)' }} />
              <h3 className="typo-label">Data We Access From Xero</h3>
            </div>
            <ul style={{ paddingLeft: 'var(--space-lg)', color: 'var(--text-secondary)', fontSize: '0.875rem', lineHeight: 1.7 }}>
              <li>Chart of accounts and account balances</li>
              <li>Transaction history (invoices, bills, payments, bank transactions)</li>
              <li>Contact and supplier records</li>
              <li>Tax rates and BAS data</li>
              <li>Payroll summaries and employee counts</li>
              <li>Fixed asset registers</li>
              <li>Financial reports (profit and loss, balance sheet, trial balance)</li>
              <li>Organisation details and settings</li>
            </ul>
          </div>

          {/* How we use it */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)', marginBottom: 'var(--space-sm)' }}>
              <Eye size={16} style={{ color: 'var(--text-secondary)' }} />
              <h3 className="typo-label">How We Use Your Data</h3>
            </div>
            <ul style={{ paddingLeft: 'var(--space-lg)', color: 'var(--text-secondary)', fontSize: '0.875rem', lineHeight: 1.7 }}>
              <li>Forensic analysis of transactions to identify tax deductions and opportunities</li>
              <li>R&amp;D Tax Incentive eligibility assessment (Division 355 ITAA 1997)</li>
              <li>Division 7A compliance checking for private company loans</li>
              <li>Loss carry-forward analysis and tax position optimisation</li>
              <li>Generating tax intelligence reports for your accountant</li>
            </ul>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginTop: 'var(--space-sm)' }}>
              Your data is <strong>never</strong> used for marketing, sold to third parties, or shared beyond
              the purposes described above.
            </p>
          </div>

          {/* Storage and security */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)', marginBottom: 'var(--space-sm)' }}>
              <Lock size={16} style={{ color: 'var(--text-secondary)' }} />
              <h3 className="typo-label">Storage and Security</h3>
            </div>
            <ul style={{ paddingLeft: 'var(--space-lg)', color: 'var(--text-secondary)', fontSize: '0.875rem', lineHeight: 1.7 }}>
              <li><strong>Read-only access:</strong> We never modify your Xero data</li>
              <li><strong>Encryption:</strong> OAuth tokens encrypted with AES-256-GCM at rest</li>
              <li><strong>Data location:</strong> Stored in Australia (Supabase ap-southeast-2, Sydney)</li>
              <li><strong>Retention:</strong> Data retained for 5 years per ATO record-keeping requirements (s 262A ITAA 1936)</li>
              <li><strong>Deletion:</strong> You can request deletion of your data at any time via Settings</li>
            </ul>
          </div>

          {/* Cross-border AI data processing disclosure (APP 8) */}
          <div
            style={{
              padding: 'var(--space-md)',
              border: '1px solid rgba(251, 191, 36, 0.3)',
              borderRadius: 'var(--radius-sm)',
              backgroundColor: 'rgba(251, 191, 36, 0.05)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)', marginBottom: 'var(--space-sm)' }}>
              <Cpu size={16} style={{ color: '#FBBF24' }} />
              <h3 className="typo-label" style={{ color: '#FBBF24' }}>AI Analysis &mdash; Cross-Border Data Processing</h3>
            </div>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', lineHeight: 1.7, marginBottom: 'var(--space-sm)' }}>
              To provide forensic tax analysis, your financial transaction data is processed by
              Google Gemini AI. This involves sending data to Google Cloud servers which{' '}
              <strong>may be located outside Australia</strong>.
            </p>
            <div style={{ marginBottom: 'var(--space-sm)' }}>
              <p className="typo-label" style={{ marginBottom: 'var(--space-xs)', fontSize: '0.8rem' }}>What data is sent to Google Gemini AI:</p>
              <ul style={{ paddingLeft: 'var(--space-lg)', color: 'var(--text-secondary)', fontSize: '0.8125rem', lineHeight: 1.7 }}>
                <li>Transaction descriptions (may include supplier and customer names)</li>
                <li>Transaction amounts and dates</li>
                <li>Account codes and categories</li>
              </ul>
            </div>
            <div style={{ marginBottom: 'var(--space-sm)' }}>
              <p className="typo-label" style={{ marginBottom: 'var(--space-xs)', fontSize: '0.8rem' }}>Why this data is processed externally:</p>
              <ul style={{ paddingLeft: 'var(--space-lg)', color: 'var(--text-secondary)', fontSize: '0.8125rem', lineHeight: 1.7 }}>
                <li>AI-powered classification of transactions for tax deduction identification</li>
                <li>Forensic analysis to detect compliance issues and optimisation opportunities</li>
              </ul>
            </div>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.75rem', lineHeight: 1.6 }}>
              <Globe size={12} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 4 }} />
              Under Australian Privacy Principle 8 (Privacy Act 1988), we are required to inform you of this
              cross-border disclosure. You may choose not to connect your Xero account if you do not
              consent to this processing. AI analysis is user-initiated and can be opted out of at any time
              via your dashboard Settings.
            </p>
          </div>
        </div>
      </div>

      {/* Acknowledgement and connect */}
      <div className="card" style={{ marginBottom: 'var(--space-lg)' }}>
        <label
          style={{
            display: 'flex',
            gap: 'var(--space-md)',
            cursor: 'pointer',
            alignItems: 'flex-start',
          }}
        >
          <input
            type="checkbox"
            checked={acknowledged}
            onChange={(e) => setAcknowledged(e.target.checked)}
            style={{ marginTop: 3, flexShrink: 0 }}
            aria-describedby="consent-description"
          />
          <span id="consent-description" className="typo-subtitle" style={{ lineHeight: 1.6 }}>
            I have read and understand the data collection notice above, including the cross-border
            AI data processing disclosure. I consent to the Australian Tax Optimizer accessing my
            Xero financial data and processing it via Google Gemini AI (which may operate outside
            Australia) for the purposes of forensic tax analysis as described.
          </span>
        </label>

        <div style={{ display: 'flex', gap: 'var(--space-md)', marginTop: 'var(--space-lg)', flexWrap: 'wrap' }}>
          <button
            onClick={handleConnect}
            disabled={!acknowledged}
            className="btn btn-xero"
            style={{
              padding: 'var(--space-md) var(--space-xl)',
              opacity: acknowledged ? 1 : 0.4,
              cursor: acknowledged ? 'pointer' : 'not-allowed',
            }}
            aria-disabled={!acknowledged}
          >
            Connect to Xero
            <ExternalLink size={14} style={{ marginLeft: 'var(--space-xs)' }} />
          </button>

          <Link
            href="/dashboard"
            className="btn btn-ghost"
            style={{ padding: 'var(--space-md) var(--space-xl)' }}
          >
            Cancel
          </Link>
        </div>
      </div>

      <TaxDisclaimer />
    </div>
  )
}
