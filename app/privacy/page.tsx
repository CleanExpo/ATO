/**
 * Privacy Policy Page
 *
 * Server component. Scientific Luxury design system.
 * Covers data collection, storage, third-party services,
 * and user rights under the Australian Privacy Act 1988.
 */

import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowLeft, Shield } from 'lucide-react'

export const metadata: Metadata = {
  title: 'Privacy Policy — ATO Tax Optimizer',
  description: 'How we collect, use, and protect your data.',
}

// ─── Design Tokens ───────────────────────────────────────────────────

const SPECTRAL = {
  cyan: '#00F5FF',
  emerald: '#00FF88',
  amber: '#FFB800',
} as const

// ─── Section Data ────────────────────────────────────────────────────

const sections = [
  {
    id: 'introduction',
    title: '1. Introduction',
    content: [
      'ATO Tax Optimizer is operated by Disaster Recovery Qld (ABN 42 633 062 307), a Queensland-based Australian company. We are committed to protecting the privacy and security of your personal and financial information.',
      'This Privacy Policy explains how we collect, use, store, and disclose your information when you use our AI-powered tax analysis platform. By accessing or using ATO Tax Optimizer, you acknowledge that you have read and understood this policy.',
      'We comply with the Australian Privacy Principles (APPs) contained in the Privacy Act 1988 (Cth) and applicable state and territory legislation.',
    ],
  },
  {
    id: 'information-we-collect',
    title: '2. Information We Collect',
    content: [
      'Account Data — When you register, we collect your name, email address, and authentication credentials (managed via Supabase Auth). If you sign in via Google OAuth, we receive your name and email from your Google account.',
      'Financial Data — When you connect your accounting software (Xero, MYOB, or QuickBooks) via OAuth, we access your transaction data, chart of accounts, invoices, and related financial records in read-only mode. We do not modify your accounting data.',
      'Payment Data — Payment processing is handled entirely by Stripe. We do not store your credit card number, CVV, or full card details on our servers. Stripe provides us with a transaction reference and payment confirmation only.',
      'Usage Data — We collect information about how you interact with our platform, including pages visited, features used, and analysis reports generated.',
    ],
  },
  {
    id: 'how-we-use-your-data',
    title: '3. How We Use Your Data',
    content: [
      'Tax Analysis — Your financial data is processed by our AI engine (powered by Google Gemini) to identify potential R&D tax offsets, unclaimed deductions, Division 7A compliance gaps, and other tax optimisation opportunities under Australian, New Zealand, and United Kingdom tax law.',
      'Anomaly Detection — We analyse transaction patterns to flag potential misclassifications, unusual entries, and compliance risks that may warrant professional review.',
      'Report Generation — We generate detailed PDF and Excel reports containing findings, confidence scores, and legislative references for review by your registered tax agent or financial adviser.',
      'Service Improvement — Aggregated, de-identified data may be used to improve our AI models and the accuracy of our analysis. Individual financial data is never shared or sold.',
    ],
  },
  {
    id: 'data-storage-security',
    title: '4. Data Storage & Security',
    content: [
      'Database — Your data is stored in Supabase PostgreSQL databases located in Sydney, Australia (ap-southeast-2 / syd1). All data remains within Australian data centres.',
      'Encryption — OAuth tokens from Xero, MYOB, and QuickBooks are encrypted at rest using AES-256-GCM. All data in transit is encrypted via TLS 1.2+.',
      'Access Control — Row Level Security (RLS) is enforced on all database tables containing user data. Each tenant can only access their own records. Administrative access is restricted and audited.',
      'HTTPS — All connections to our platform are encrypted via HTTPS. Unencrypted HTTP connections are automatically redirected.',
    ],
  },
  {
    id: 'third-party-services',
    title: '5. Third-Party Services',
    content: [
      'Google Gemini AI — Your financial data is processed by Google Gemini for AI-powered tax analysis. Data is transmitted securely and is subject to Google\u2019s data processing terms.',
      'Stripe — Payment processing is handled by Stripe, Inc. Stripe is PCI DSS Level 1 certified. Your payment information is subject to Stripe\u2019s privacy policy.',
      'SendGrid — Transactional emails (account verification, report delivery, notifications) are sent via SendGrid. Only your email address and message content are shared.',
      'Xero / MYOB / QuickBooks — We connect to your accounting platform via OAuth 2.0 with read-only access. We do not store your accounting platform credentials.',
    ],
  },
  {
    id: 'data-retention',
    title: '6. Data Retention',
    content: [
      'Financial Data — Your imported financial data is retained for as long as your account is active. Upon account deletion or written request, all financial data is permanently deleted within 30 days.',
      'AI Analysis Results — Tax analysis reports and findings are retained for 12 months from the date of generation to allow you to revisit and download your reports.',
      'Account Data — Basic account information (name, email) is retained until you request deletion. We may retain minimal records as required by Australian tax and corporate law.',
      'Backups — Encrypted database backups may retain deleted data for up to 90 days before automatic purging.',
    ],
  },
  {
    id: 'your-rights',
    title: '7. Your Rights',
    content: [
      'Under the Australian Privacy Act 1988 (Cth), you have the right to:',
      'Access — Request a copy of the personal information we hold about you.',
      'Correction — Request correction of any inaccurate or incomplete personal information.',
      'Deletion — Request deletion of your personal information and all associated financial data. We will comply within 30 days unless we are legally required to retain certain records.',
      'Complaint — Lodge a complaint with the Office of the Australian Information Commissioner (OAIC) if you believe your privacy has been breached.',
      'To exercise any of these rights, contact us at support@carsi.com.au with the subject line "Privacy Request".',
    ],
  },
  {
    id: 'cookies',
    title: '8. Cookies',
    content: [
      'Essential Cookies — We use essential cookies to maintain your authentication session and ensure the platform functions correctly. These cookies cannot be disabled without breaking core functionality.',
      'Analytics Cookies — With your consent, we may use analytics cookies to understand how users interact with our platform. You can accept or decline analytics cookies via our cookie consent banner.',
      'No Third-Party Tracking — We do not use third-party advertising cookies or cross-site tracking technologies.',
    ],
  },
  {
    id: 'changes',
    title: '9. Changes to This Policy',
    content: [
      'We may update this Privacy Policy from time to time to reflect changes in our practices, technology, or legal requirements. Material changes will be communicated via email to registered users and posted on this page.',
      'Last updated: 26 March 2026.',
    ],
  },
  {
    id: 'contact',
    title: '10. Contact',
    content: [
      'If you have questions about this Privacy Policy or how we handle your data, please contact us:',
      'Email: support@carsi.com.au',
      'Operator: Disaster Recovery Qld (ABN 42 633 062 307)',
      'Location: Queensland, Australia',
    ],
  },
]

// ─── Page Component ──────────────────────────────────────────────────

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen text-white" style={{ background: '#050505' }}>
      <main className="px-4 sm:px-6 lg:px-8 py-16 md:py-24">
        <div className="max-w-3xl mx-auto">
          {/* Back link */}
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-[11px] uppercase tracking-[0.2em] text-white/30 hover:text-white/50 font-light mb-12"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Back to Home
          </Link>

          {/* Header */}
          <div className="mb-14">
            <div className="flex items-center gap-3 mb-6">
              <Shield className="w-4 h-4" style={{ color: SPECTRAL.cyan }} />
              <span className="text-[11px] uppercase tracking-[0.4em] text-white/40 font-medium">
                Legal
              </span>
            </div>
            <h1 className="text-3xl md:text-4xl font-extralight tracking-tight text-white mb-4">
              Privacy Policy
            </h1>
            <p className="text-sm text-white/40 font-light">
              Last updated: 26 March 2026
            </p>
          </div>

          {/* Sections */}
          <div className="space-y-8">
            {sections.map((section) => (
              <section
                key={section.id}
                id={section.id}
                className="p-6 md:p-8 border-[0.5px] border-white/[0.06] rounded-sm"
                style={{ background: '#0a0a0a' }}
              >
                <h2 className="text-lg font-medium text-white/90 mb-5">
                  {section.title}
                </h2>
                <div className="space-y-4">
                  {section.content.map((paragraph, idx) => (
                    <p
                      key={idx}
                      className="text-sm text-white/50 leading-relaxed font-light"
                    >
                      {paragraph}
                    </p>
                  ))}
                </div>
              </section>
            ))}
          </div>

          {/* Footer nav */}
          <div className="mt-14 pt-8 border-t border-white/[0.06] flex flex-col sm:flex-row items-center justify-between gap-4">
            <Link
              href="/terms"
              className="text-[11px] uppercase tracking-[0.2em] font-light hover:text-white/70"
              style={{ color: SPECTRAL.cyan }}
            >
              Terms of Service
            </Link>
            <p className="text-[10px] text-white/20">
              &copy; 2026 ATO Tax Optimizer. ABN 42 633 062 307.
            </p>
          </div>
        </div>
      </main>
    </div>
  )
}
