/**
 * Terms of Service Page
 *
 * Server component. Scientific Luxury design system.
 * Covers service description, disclaimers, pricing,
 * user obligations, IP, liability, and governing law.
 */

import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowLeft, Scale, AlertTriangle } from 'lucide-react'

export const metadata: Metadata = {
  title: 'Terms of Service — ATO Tax Optimizer',
  description: 'Terms and conditions for using ATO Tax Optimizer.',
}

// ─── Design Tokens ───────────────────────────────────────────────────

const SPECTRAL = {
  cyan: '#00F5FF',
  emerald: '#00FF88',
  amber: '#FFB800',
  red: '#FF4444',
} as const

// ─── Section Data ────────────────────────────────────────────────────

const sections = [
  {
    id: 'acceptance',
    title: '1. Acceptance of Terms',
    content: [
      'By accessing or using ATO Tax Optimizer (the "Service"), you agree to be bound by these Terms of Service ("Terms"). If you do not agree to these Terms, you must not use the Service.',
      'These Terms constitute a legally binding agreement between you ("User", "you") and Disaster Recovery Qld (ABN 42 633 062 307) ("we", "us", "our"), the operator of ATO Tax Optimizer.',
      'We reserve the right to modify these Terms at any time. Continued use of the Service after changes are posted constitutes acceptance of the updated Terms.',
    ],
  },
  {
    id: 'service-description',
    title: '2. Service Description',
    content: [
      'ATO Tax Optimizer is an AI-powered tax analysis platform designed for Australian, New Zealand, and United Kingdom small-to-medium businesses (SMBs).',
      'The Service analyses financial data from connected accounting platforms (Xero, MYOB, QuickBooks) to identify potential R&D tax offsets, unclaimed deductions, Division 7A compliance gaps, and other tax optimisation opportunities.',
      'The Service generates detailed reports with findings, confidence scores, and legislative references for review by qualified tax professionals.',
    ],
  },
  {
    id: 'not-tax-advice',
    title: '3. Not Tax Advice',
    content: [],
    isDisclaimer: true,
    disclaimerContent: [
      'ATO Tax Optimizer is an analytical tool only. The Service is NOT a registered tax agent or BAS agent under the Tax Agent Services Act 2009 (TASA).',
      'All output, findings, reports, and recommendations provided by the Service are for informational purposes only and do not constitute tax advice, financial advice, or legal advice.',
      'Users must consult a qualified, registered tax practitioner before implementing any recommendations or making any changes to their tax position based on information provided by the Service.',
      'We expressly disclaim any responsibility for tax outcomes, penalties, interest, or other consequences arising from actions taken based on the Service\u2019s output without independent professional verification.',
    ],
  },
  {
    id: 'pricing-payments',
    title: '4. Pricing & Payments',
    content: [
      'The Service operates on a one-time payment model. Current pricing (in Australian Dollars, inclusive of GST where applicable):',
      'Core Analysis \u2014 $495 AUD: Includes standard tax analysis covering deduction recovery and compliance checks across connected financial data.',
      'Comprehensive Audit \u2014 $995 AUD: Includes full forensic audit covering R&D tax offsets (Division 355), Division 7A compliance, misclassified deductions, and 5-year historical analysis with detailed PDF/Excel reports.',
      'All payments are processed securely via Stripe. We do not store your payment card details.',
      'Refund Policy \u2014 No refunds are available after an analysis report has been generated. If the Service fails to produce any analysis due to a technical error, you are entitled to a full refund. Contact support@carsi.com.au within 14 days of purchase.',
    ],
  },
  {
    id: 'user-obligations',
    title: '5. User Obligations',
    content: [
      'You agree to:',
      'Provide accurate and complete information when registering and using the Service.',
      'Ensure you have authorised access to the accounting systems you connect to the Service. You must be the account owner or have explicit written permission from the account owner.',
      'Comply with all applicable Australian, New Zealand, and United Kingdom tax laws and regulations.',
      'Not use the Service for any unlawful purpose, including but not limited to tax evasion or fraud.',
      'Keep your account credentials secure and notify us immediately of any unauthorised access.',
    ],
  },
  {
    id: 'intellectual-property',
    title: '6. Intellectual Property',
    content: [
      'Platform Ownership \u2014 ATO Tax Optimizer, including its software, algorithms, AI models, user interface, documentation, and branding, is the intellectual property of Disaster Recovery Qld. All rights are reserved.',
      'User Data Ownership \u2014 You retain full ownership of your financial data and any reports generated by the Service using your data. We claim no ownership over your input data or generated outputs.',
      'Licence to Use \u2014 We grant you a limited, non-exclusive, non-transferable, revocable licence to access and use the Service in accordance with these Terms.',
      'Restrictions \u2014 You may not reverse-engineer, decompile, disassemble, or otherwise attempt to derive the source code of the Service. You may not resell, sublicence, or redistribute access to the Service without our written consent.',
    ],
  },
  {
    id: 'limitation-of-liability',
    title: '7. Limitation of Liability',
    content: [
      'To the maximum extent permitted by Australian law (including the Australian Consumer Law under Schedule 2 of the Competition and Consumer Act 2010):',
      'The Service is provided "as is" without warranties of any kind, whether express or implied, including but not limited to warranties of merchantability, fitness for a particular purpose, or accuracy of tax analysis.',
      'We are not liable for any indirect, incidental, special, consequential, or punitive damages arising from your use of the Service, including but not limited to lost profits, tax penalties, interest charges, or ATO audit outcomes.',
      'Our total aggregate liability for any claim arising from or relating to the Service is limited to the amount you paid for the specific analysis that gave rise to the claim.',
      'Nothing in these Terms excludes or limits any guarantee, condition, or warranty implied by the Australian Consumer Law that cannot be lawfully excluded.',
    ],
  },
  {
    id: 'termination',
    title: '8. Termination',
    content: [
      'You may terminate your account at any time by contacting support@carsi.com.au or through your account settings.',
      'We may terminate or suspend your access to the Service at any time, with or without cause, including for breach of these Terms.',
      'Upon termination, your right to use the Service ceases immediately. Your financial data will be deleted within 30 days of your request, subject to any legal retention requirements.',
      'Sections relating to intellectual property, limitation of liability, and governing law survive termination.',
    ],
  },
  {
    id: 'governing-law',
    title: '9. Governing Law',
    content: [
      'These Terms are governed by and construed in accordance with the laws of the State of Queensland, Australia.',
      'The courts of Queensland, Australia have exclusive jurisdiction over any disputes arising from or relating to these Terms or your use of the Service.',
      'If any provision of these Terms is found to be invalid or unenforceable, the remaining provisions will continue in full force and effect.',
    ],
  },
  {
    id: 'contact',
    title: '10. Contact',
    content: [
      'For questions about these Terms of Service, please contact us:',
      'Email: support@carsi.com.au',
      'Operator: Disaster Recovery Qld (ABN 42 633 062 307)',
      'Location: Queensland, Australia',
    ],
  },
]

// ─── Page Component ──────────────────────────────────────────────────

export default function TermsOfServicePage() {
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
              <Scale className="w-4 h-4" style={{ color: SPECTRAL.cyan }} />
              <span className="text-[11px] uppercase tracking-[0.4em] text-white/40 font-medium">
                Legal
              </span>
            </div>
            <h1 className="text-3xl md:text-4xl font-extralight tracking-tight text-white mb-4">
              Terms of Service
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
                className={`p-6 md:p-8 border-[0.5px] rounded-sm ${
                  section.isDisclaimer
                    ? ''
                    : 'border-white/[0.06]'
                }`}
                style={{
                  background: section.isDisclaimer
                    ? 'rgba(255, 184, 0, 0.03)'
                    : '#0a0a0a',
                  borderColor: section.isDisclaimer
                    ? `${SPECTRAL.amber}30`
                    : undefined,
                }}
              >
                <div className="flex items-start gap-3 mb-5">
                  {section.isDisclaimer && (
                    <AlertTriangle
                      className="w-5 h-5 flex-shrink-0 mt-0.5"
                      style={{ color: SPECTRAL.amber }}
                    />
                  )}
                  <h2 className="text-lg font-medium text-white/90">
                    {section.title}
                  </h2>
                </div>

                <div className="space-y-4">
                  {(section.isDisclaimer
                    ? section.disclaimerContent ?? []
                    : section.content
                  ).map((paragraph, idx) => (
                    <p
                      key={idx}
                      className={`text-sm leading-relaxed font-light ${
                        section.isDisclaimer
                          ? 'text-white/60'
                          : 'text-white/50'
                      }`}
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
              href="/privacy"
              className="text-[11px] uppercase tracking-[0.2em] font-light hover:text-white/70"
              style={{ color: SPECTRAL.cyan }}
            >
              Privacy Policy
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
