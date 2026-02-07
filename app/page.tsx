/**
 * ATO Tax Optimizer - Landing Page (SSR)
 *
 * Server-rendered landing page with client islands for interactivity.
 * GEO-optimised: semantic HTML, JSON-LD schemas, cited statistics,
 * and high-fidelity product showcase.
 */

import type { Metadata } from 'next'
import Link from 'next/link'
import {
  CheckCircle,
  Shield,
  Lock,
  Award,
  AlertTriangle,
  ArrowRight,
  FileText,
  BarChart3,
  Search,
  Zap,
  Scale,
  Eye,
  MapPin,
  Building2,
} from 'lucide-react'

import { AnimateOnScroll } from '@/components/landing/AnimateOnScroll'
import { OffsetCalculator } from '@/components/landing/OffsetCalculator'
import { ProductShowcase } from '@/components/landing/ProductShowcase'
import { FAQSection } from '@/components/landing/FAQSection'
import { CitedStats } from '@/components/landing/CitedStats'
import {
  SoftwareApplicationSchema,
  FAQPageSchema,
  OrganizationSchema,
  BreadcrumbSchema,
} from '@/components/landing/schemas'

// ─── Design Tokens ───────────────────────────────────────────────────

const SPECTRAL = {
  cyan: '#00F5FF',
  emerald: '#00FF88',
  amber: '#FFB800',
  red: '#FF4444',
  magenta: '#FF00FF',
} as const

// ─── Page Metadata ───────────────────────────────────────────────────

export const metadata: Metadata = {
  title: 'ATO Tax Optimizer | AI-Powered Tax Recovery for Australian Businesses',
  description:
    'Forensic AI analysis of your Xero data to recover $200K-$500K in R&D tax offsets, unclaimed deductions, and Division 7A compliance gaps. Built for Australian SMEs under ITAA 1997.',
  alternates: {
    canonical: 'https://atotaxoptimizer.com.au',
  },
}

// ─── Main Page ──────────────────────────────────────────────────────

export default function Home() {
  return (
    <div className="min-h-screen text-white" style={{ background: '#050505' }}>
      {/* JSON-LD Schemas */}
      <SoftwareApplicationSchema />
      <FAQPageSchema />
      <OrganizationSchema />
      <BreadcrumbSchema />

      <main>
        {/* ── Hero ── */}
        <header className="min-h-screen flex flex-col justify-center px-4 sm:px-6 lg:px-8 py-16">
          <div className="max-w-4xl mx-auto w-full text-center">
            <AnimateOnScroll>
              <div className="flex items-center justify-center gap-3 mb-8">
                <MapPin className="w-3.5 h-3.5" style={{ color: SPECTRAL.cyan }} />
                <span className="text-[11px] uppercase tracking-[0.3em] text-white/40 font-medium">
                  Built for Australian Businesses
                </span>
              </div>
            </AnimateOnScroll>

            <AnimateOnScroll delay={0.1}>
              <h1 className="text-4xl md:text-5xl lg:text-[3.5rem] font-extralight tracking-tight leading-[1.1] mb-6">
                <span className="text-white">Your Xero Data Holds</span>
                <br />
                <span style={{ color: SPECTRAL.cyan }}>$200K+ in Missed Tax Benefits</span>
              </h1>
            </AnimateOnScroll>

            <AnimateOnScroll delay={0.2}>
              <p className="text-lg text-white/50 max-w-xl mx-auto mb-4 font-light leading-relaxed">
                AI-powered forensic analysis scans 5 years of transactions to surface
                R&D tax offsets, unclaimed deductions, and compliance gaps that your
                current process is likely missing.
              </p>
            </AnimateOnScroll>

            <AnimateOnScroll delay={0.25}>
              <p className="text-sm text-white/30 mb-10 font-light">
                Division 355 ITAA 1997 &middot; Section 8-1 ITAA 1997 &middot; Division 7A ITAA 1936
              </p>
            </AnimateOnScroll>

            <AnimateOnScroll delay={0.3}>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-10">
                <Link
                  href="/api/auth/xero"
                  className="group px-8 py-4 rounded-sm text-[11px] uppercase tracking-[0.2em] font-semibold border-[0.5px] transition-all duration-300 hover:scale-[1.02] w-full sm:w-auto text-center"
                  style={{
                    borderColor: `${SPECTRAL.cyan}50`,
                    color: '#050505',
                    backgroundColor: SPECTRAL.cyan,
                    boxShadow: `0 0 60px ${SPECTRAL.cyan}25`,
                  }}
                >
                  <span className="flex items-center justify-center gap-3">
                    Connect Xero &mdash; Free Analysis
                    <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                  </span>
                </Link>
                <Link
                  href="/dashboard"
                  className="px-8 py-4 rounded-sm text-[11px] uppercase tracking-[0.2em] font-medium border-[0.5px] border-white/[0.12] text-white/50 hover:text-white/80 hover:border-white/[0.25] transition-all duration-300 w-full sm:w-auto text-center"
                  style={{ background: 'rgba(255,255,255,0.02)' }}
                >
                  View Dashboard
                </Link>
              </div>
            </AnimateOnScroll>

            {/* Trust badges */}
            <AnimateOnScroll delay={0.4}>
              <div className="flex flex-wrap justify-center gap-6 text-[11px] text-white/30">
                <div className="flex items-center gap-2">
                  <Shield className="w-3.5 h-3.5" style={{ color: SPECTRAL.emerald }} />
                  <span>Read-Only Xero Access</span>
                </div>
                <div className="flex items-center gap-2">
                  <Lock className="w-3.5 h-3.5" style={{ color: SPECTRAL.cyan }} />
                  <span>AES-256 Encryption</span>
                </div>
                <div className="flex items-center gap-2">
                  <MapPin className="w-3.5 h-3.5" style={{ color: SPECTRAL.amber }} />
                  <span>Australian Data Centres</span>
                </div>
              </div>
            </AnimateOnScroll>
          </div>

          {/* Product showcase - below hero */}
          <div className="max-w-4xl mx-auto w-full mt-16 hidden lg:block">
            <ProductShowcase />
          </div>
        </header>

        {/* ── Cited Statistics ── */}
        <section
          aria-labelledby="stats-heading"
          className="px-4 sm:px-6 lg:px-8 py-20 md:py-28"
        >
          <div className="max-w-7xl mx-auto">
            <AnimateOnScroll>
              <div className="text-center mb-14">
                <p className="text-[11px] uppercase tracking-[0.4em] text-white/40 mb-4 font-medium">
                  Key Australian Tax Statistics
                </p>
                <h2
                  id="stats-heading"
                  className="text-3xl md:text-4xl font-extralight tracking-tight text-white"
                >
                  The Numbers That Matter
                </h2>
              </div>
            </AnimateOnScroll>
            <AnimateOnScroll delay={0.1}>
              <CitedStats />
            </AnimateOnScroll>
          </div>
        </section>

        {/* ── What You're Missing ── */}
        <section
          aria-labelledby="pain-heading"
          className="px-4 sm:px-6 lg:px-8 py-20 md:py-28"
        >
          <div className="max-w-7xl mx-auto">
            <AnimateOnScroll>
              <div className="text-center mb-14">
                <p className="text-[11px] uppercase tracking-[0.4em] text-white/40 mb-4 font-medium">
                  The Problem
                </p>
                <h2
                  id="pain-heading"
                  className="text-3xl md:text-4xl font-extralight tracking-tight text-white mb-4"
                >
                  Most Australian SMEs Leave Money on the Table
                </h2>
                <p className="text-base text-white/40 max-w-2xl mx-auto font-light leading-relaxed">
                  Manual bookkeeping misses eligible R&D activities, misclassifies deductible
                  expenses, and overlooks compliance gaps that compound across financial years.
                </p>
              </div>
            </AnimateOnScroll>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {[
                {
                  icon: Search,
                  label: 'R&D Activities Hidden in OpEx',
                  stat: '43.5%',
                  statLabel: 'Refundable Offset',
                  detail:
                    'Software development, process improvement, and engineering work often qualifies under Division 355 but gets buried in general operating expenses.',
                  colour: SPECTRAL.emerald,
                },
                {
                  icon: FileText,
                  label: 'Misclassified Deductions',
                  stat: 'S.8-1',
                  statLabel: 'ITAA 1997',
                  detail:
                    'Business travel, professional development, equipment, and home office costs incorrectly coded in Xero \u2014 resulting in understated deductions.',
                  colour: SPECTRAL.cyan,
                },
                {
                  icon: AlertTriangle,
                  label: 'Division 7A Compliance Gaps',
                  stat: '8.77%',
                  statLabel: 'Benchmark Rate',
                  detail:
                    'Shareholder loans, company payments, and trust distributions that trigger deemed dividend provisions when minimum repayments are missed.',
                  colour: SPECTRAL.amber,
                },
              ].map((item, idx) => (
                <AnimateOnScroll key={item.label} delay={idx * 0.1}>
                  <div
                    className="p-7 border-[0.5px] border-white/[0.08] rounded-sm hover:border-white/[0.15] transition-all duration-300 flex flex-col h-full"
                    style={{ background: 'rgba(255,255,255,0.02)' }}
                  >
                    <div className="flex items-center gap-3 mb-5">
                      <item.icon className="w-4 h-4" style={{ color: item.colour }} />
                      <span className="text-[11px] uppercase tracking-[0.2em] text-white/40 font-medium">
                        {item.label}
                      </span>
                    </div>
                    <div className="mb-5">
                      <span
                        className="text-3xl font-mono font-light tabular-nums"
                        style={{ color: item.colour }}
                      >
                        {item.stat}
                      </span>
                      <span className="text-[10px] uppercase tracking-wider text-white/30 ml-2">
                        {item.statLabel}
                      </span>
                    </div>
                    <p className="text-sm text-white/40 leading-relaxed flex-1">{item.detail}</p>
                  </div>
                </AnimateOnScroll>
              ))}
            </div>
          </div>
        </section>

        {/* ── How It Works ── */}
        <section
          aria-labelledby="how-heading"
          className="px-4 sm:px-6 lg:px-8 py-20 md:py-28"
        >
          <div className="max-w-7xl mx-auto">
            <AnimateOnScroll>
              <div className="text-center mb-14">
                <p className="text-[11px] uppercase tracking-[0.4em] text-white/40 mb-4 font-medium">
                  How It Works
                </p>
                <h2
                  id="how-heading"
                  className="text-3xl md:text-4xl font-extralight tracking-tight text-white"
                >
                  From Xero Connection to Tax Recovery
                </h2>
              </div>
            </AnimateOnScroll>

            <ol className="space-y-8 list-none">
              {[
                {
                  step: '01',
                  title: 'Connect Your Xero',
                  desc: 'Secure OAuth link with read-only access. Your accounting data is never modified. Australian data centres only.',
                  colour: SPECTRAL.cyan,
                  icon: Lock,
                  detail: '30-second setup via Xero OAuth 2.0',
                },
                {
                  step: '02',
                  title: 'AI Forensic Scan',
                  desc: 'Our engine analyses every transaction across 5 financial years \u2014 flagging R&D eligibility, deduction gaps, and Division 7A exposures.',
                  colour: SPECTRAL.emerald,
                  icon: Zap,
                  detail: '2,400+ transactions per hour',
                },
                {
                  step: '03',
                  title: 'Prioritised Findings',
                  desc: 'Receive findings ranked by dollar value with full ATO legislation references, confidence scores, and amendment period deadlines.',
                  colour: SPECTRAL.amber,
                  icon: BarChart3,
                  detail: 'ITAA 1997 section citations on every finding',
                },
                {
                  step: '04',
                  title: 'Professional Review',
                  desc: 'Share exportable reports (PDF/Excel) with your registered tax agent for review and implementation. We recommend \u2014 they execute.',
                  colour: SPECTRAL.magenta,
                  icon: FileText,
                  detail: 'White-label reports for advisory firms',
                },
              ].map((item, idx) => (
                <li key={item.step}>
                  <AnimateOnScroll delay={idx * 0.08} direction="left">
                    <div className="flex items-start gap-6 md:gap-8 group">
                      <div className="flex-shrink-0 flex flex-col items-center gap-2">
                        <div
                          className="w-12 h-12 flex items-center justify-center rounded-full border-[0.5px] transition-all duration-300 group-hover:scale-110"
                          style={{
                            borderColor: `${item.colour}30`,
                            backgroundColor: `${item.colour}08`,
                            boxShadow: `0 0 30px ${item.colour}15`,
                          }}
                        >
                          <item.icon className="w-5 h-5" style={{ color: item.colour }} />
                        </div>
                        {idx < 3 && <div className="w-px h-8 bg-white/[0.06]" />}
                      </div>

                      <div className="flex-1 pt-1 pb-2">
                        <div className="flex items-baseline gap-4 mb-2">
                          <span className="text-[11px] font-mono text-white/20 tabular-nums tracking-wider">
                            {item.step}
                          </span>
                          <h3 className="text-xl font-light text-white/90">{item.title}</h3>
                        </div>
                        <p className="text-sm text-white/45 leading-relaxed mb-2">{item.desc}</p>
                        <span className="text-[10px] uppercase tracking-wider text-white/25 font-mono">
                          {item.detail}
                        </span>
                      </div>
                    </div>
                  </AnimateOnScroll>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* ── R&D Offset Calculator (Client Island) ── */}
        <section
          aria-labelledby="calculator-heading"
          className="px-4 sm:px-6 lg:px-8 py-20 md:py-28"
        >
          <div className="max-w-7xl mx-auto">
            <AnimateOnScroll>
              <div className="text-center mb-10">
                <p className="text-[11px] uppercase tracking-[0.4em] text-white/40 mb-4 font-medium">
                  Calculate Your Benefit
                </p>
                <h2
                  id="calculator-heading"
                  className="text-3xl md:text-4xl font-extralight tracking-tight text-white"
                >
                  R&D Tax Offset Estimator
                </h2>
              </div>
            </AnimateOnScroll>
            <div className="max-w-4xl mx-auto">
              <OffsetCalculator />
            </div>
          </div>
        </section>

        {/* ── Compliance Guarantee ── */}
        <section
          aria-labelledby="compliance-heading"
          className="px-4 sm:px-6 lg:px-8 py-20 md:py-28"
        >
          <div className="max-w-7xl mx-auto">
            <AnimateOnScroll>
              <div className="text-center mb-14">
                <p className="text-[11px] uppercase tracking-[0.4em] text-white/40 mb-4 font-medium">
                  Compliance Guarantee
                </p>
                <h2
                  id="compliance-heading"
                  className="text-3xl md:text-4xl font-extralight tracking-tight text-white mb-4"
                >
                  Built on Australian Tax Law
                </h2>
                <p className="text-base text-white/40 max-w-2xl mx-auto font-light leading-relaxed">
                  Every calculation references specific ATO legislation. Every finding includes
                  confidence scores and amendment period deadlines.
                </p>
              </div>
            </AnimateOnScroll>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-10">
              {/* Compliance Audit Card */}
              <AnimateOnScroll>
                <div
                  className="p-8 md:p-10 border-[0.5px] border-white/[0.08] rounded-sm h-full"
                  style={{ background: 'rgba(255,255,255,0.02)' }}
                >
                  <div className="flex items-start gap-6 mb-8">
                    <div
                      className="flex-shrink-0 w-14 h-14 rounded-full border-[0.5px] flex items-center justify-center"
                      style={{ borderColor: `${SPECTRAL.amber}30`, background: `${SPECTRAL.amber}08` }}
                    >
                      <Scale className="w-6 h-6" style={{ color: SPECTRAL.amber }} />
                    </div>
                    <div>
                      <h3 className="text-xl font-medium text-white/90 mb-1">
                        Independent Compliance Audit
                      </h3>
                      <p className="text-[11px] uppercase tracking-wider text-white/30">
                        Verified against ITAA 1936 / ITAA 1997 / FBTAA 1986 / TASA 2009
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                    {[
                      {
                        title: 'Tax Law Accuracy',
                        items: [
                          'R&D offset tiered by turnover (18.5% / 8.5% premium)',
                          '$4M annual refundable cap enforced (s 355-100)',
                          'Capital vs revenue loss distinction (s 102-5)',
                          'Base rate entity passive income test (s 23AA)',
                        ],
                      },
                      {
                        title: 'Security & Privacy',
                        items: [
                          'Read-only Xero OAuth (no write access)',
                          'AES-256-GCM token encryption at rest',
                          'Australian data centres (ap-southeast-2)',
                          'Row-level security on all tenant data',
                        ],
                      },
                    ].map((col) => (
                      <div key={col.title}>
                        <p className="text-[10px] uppercase tracking-widest text-white/40 mb-4">
                          {col.title}
                        </p>
                        <div className="space-y-3">
                          {col.items.map((item) => (
                            <div key={item} className="flex items-start gap-3">
                              <CheckCircle
                                className="w-3.5 h-3.5 flex-shrink-0 mt-0.5"
                                style={{ color: SPECTRAL.emerald }}
                              />
                              <span className="text-[12px] text-white/50 leading-relaxed">{item}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>

                  <div
                    className="p-4 rounded-sm border-[0.5px] border-amber-500/10"
                    style={{ background: 'rgba(255,184,0,0.03)' }}
                  >
                    <p className="text-[11px] text-white/40 leading-relaxed">
                      <strong className="text-white/60">Disclaimer:</strong> This platform is an
                      analytical tool and is not a registered tax agent under the Tax Agent Services
                      Act 2009 (TASA). All findings are estimates for informational purposes only.
                      Review by a registered tax practitioner is required before implementation.
                    </p>
                  </div>
                </div>
              </AnimateOnScroll>

              {/* Trust / Security cards */}
              <div className="space-y-6">
                <AnimateOnScroll delay={0.1}>
                  <div
                    className="p-8 border-[0.5px] border-white/[0.08] rounded-sm"
                    style={{ background: 'rgba(255,255,255,0.02)' }}
                  >
                    <div className="flex items-center gap-3 mb-6">
                      <Eye className="w-5 h-5" style={{ color: SPECTRAL.cyan }} />
                      <h3 className="text-lg font-medium text-white/90">Read-Only Promise</h3>
                    </div>
                    <p className="text-sm text-white/40 mb-6 leading-relaxed">
                      We analyse and recommend. Your Xero data is never modified, deleted, or
                      written to. All changes require your explicit action with professional
                      guidance.
                    </p>
                    <div className="grid grid-cols-2 gap-3">
                      {[
                        { icon: Lock, label: 'No Xero Writes' },
                        { icon: Shield, label: 'Bank-Grade Security' },
                        { icon: Award, label: 'ATO Citations' },
                        { icon: Building2, label: 'AU Data Centres' },
                      ].map((item) => (
                        <div
                          key={item.label}
                          className="flex items-center gap-2.5 p-3 rounded-sm border-[0.5px] border-white/[0.04]"
                          style={{ background: 'rgba(255,255,255,0.01)' }}
                        >
                          <item.icon className="w-4 h-4" style={{ color: SPECTRAL.emerald }} />
                          <span className="text-[11px] text-white/45">{item.label}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </AnimateOnScroll>

                <AnimateOnScroll delay={0.2}>
                  <div
                    className="p-8 border-[0.5px] rounded-sm"
                    style={{
                      borderColor: `${SPECTRAL.emerald}20`,
                      background: `linear-gradient(135deg, rgba(0,255,136,0.04) 0%, rgba(0,245,255,0.02) 100%)`,
                    }}
                  >
                    <div className="flex items-center gap-3 mb-4">
                      <Shield className="w-5 h-5" style={{ color: SPECTRAL.emerald }} />
                      <h3 className="text-lg font-medium text-white/90">Money-Back Guarantee</h3>
                    </div>
                    <p className="text-sm text-white/50 leading-relaxed">
                      If our forensic audit doesn&apos;t identify at least{' '}
                      <strong className="text-white/80">$5,000 in potential tax benefits</strong>,
                      we refund your $995 audit fee in full. No questions asked.
                    </p>
                  </div>
                </AnimateOnScroll>
              </div>
            </div>
          </div>
        </section>

        {/* ── FAQ ── */}
        <section
          aria-labelledby="faq-heading"
          className="px-4 sm:px-6 lg:px-8 py-20 md:py-28"
        >
          <div className="max-w-7xl mx-auto">
            <AnimateOnScroll>
              <div className="text-center mb-14">
                <p className="text-[11px] uppercase tracking-[0.4em] text-white/40 mb-4 font-medium">
                  Common Questions
                </p>
                <h2
                  id="faq-heading"
                  className="text-3xl md:text-4xl font-extralight tracking-tight text-white"
                >
                  Frequently Asked Questions
                </h2>
              </div>
            </AnimateOnScroll>
            <AnimateOnScroll delay={0.1}>
              <FAQSection />
            </AnimateOnScroll>
          </div>
        </section>

        {/* ── Pricing ── */}
        <section
          id="pricing"
          aria-labelledby="pricing-heading"
          className="px-4 sm:px-6 lg:px-8 py-20 md:py-28"
        >
          <div className="max-w-7xl mx-auto">
            <AnimateOnScroll>
              <div className="text-center mb-14">
                <p className="text-[11px] uppercase tracking-[0.4em] text-white/40 mb-4 font-medium">
                  Investment
                </p>
                <h2
                  id="pricing-heading"
                  className="text-3xl md:text-4xl font-extralight tracking-tight text-white"
                >
                  Select Your Plan
                </h2>
              </div>
            </AnimateOnScroll>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Business Owner */}
              <AnimateOnScroll>
                <div
                  className="p-8 border-[0.5px] border-white/[0.08] rounded-sm flex flex-col justify-between hover:border-white/[0.15] transition-all duration-300 h-full"
                  style={{ background: 'rgba(255,255,255,0.02)' }}
                >
                  <div>
                    <div className="flex items-center gap-3 mb-6">
                      <div className="w-2 h-2 rounded-full" style={{ backgroundColor: SPECTRAL.cyan }} />
                      <span className="text-[11px] uppercase tracking-[0.3em] text-white/40 font-medium">
                        Individual Entity
                      </span>
                    </div>
                    <h3 className="text-2xl font-light text-white mb-3">Business Owner</h3>
                    <p className="text-sm text-white/40 mb-8 font-light leading-relaxed">
                      For Australian entities seeking to recover historical R&D offsets and correct
                      ledger misclassifications across 5 financial years.
                    </p>
                    <div className="space-y-3 mb-10">
                      {[
                        'Full 5-Year Forensic Audit',
                        'R&D Eligibility Assessment (Div 355)',
                        'Division 7A Compliance Monitoring',
                        'Unclaimed Deduction Discovery',
                        'Professional PDF/Excel Reports',
                        'ATO Legislation References Included',
                      ].map((feat) => (
                        <div key={feat} className="flex items-center gap-3">
                          <CheckCircle
                            className="w-4 h-4 flex-shrink-0"
                            style={{ color: SPECTRAL.cyan }}
                          />
                          <span className="text-[13px] text-white/50">{feat}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div>
                    <div className="flex items-baseline gap-3 mb-6">
                      <span className="text-4xl font-mono text-white font-light">$995</span>
                      <span className="text-[11px] uppercase tracking-wider text-white/30">
                        AUD &middot; One-Off Audit
                      </span>
                    </div>
                    <Link
                      href="/api/auth/xero"
                      className="block w-full text-center py-4 rounded-sm text-[11px] uppercase tracking-[0.2em] font-medium border-[0.5px] border-white/[0.15] text-white/60 hover:text-white/90 hover:border-white/[0.3] transition-all duration-300"
                      style={{ background: 'rgba(255,255,255,0.04)' }}
                    >
                      Start Professional Audit
                    </Link>
                  </div>
                </div>
              </AnimateOnScroll>

              {/* Advisory Firms */}
              <AnimateOnScroll delay={0.1}>
                <div
                  className="p-8 border-[0.5px] rounded-sm flex flex-col justify-between relative overflow-hidden h-full"
                  style={{
                    borderColor: `${SPECTRAL.cyan}30`,
                    background: `linear-gradient(135deg, rgba(0,245,255,0.05) 0%, rgba(0,255,136,0.03) 100%)`,
                    boxShadow: `0 0 80px ${SPECTRAL.cyan}10`,
                  }}
                >
                  <div className="absolute top-5 right-5">
                    <div
                      className="px-3 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest"
                      style={{ background: SPECTRAL.cyan, color: '#050505' }}
                    >
                      Enterprise
                    </div>
                  </div>
                  <div>
                    <div className="flex items-center gap-3 mb-6">
                      <div
                        className="w-2 h-2 rounded-full"
                        style={{ backgroundColor: SPECTRAL.emerald }}
                      />
                      <span className="text-[11px] uppercase tracking-[0.3em] text-white/40 font-medium">
                        Multi-Tenant
                      </span>
                    </div>
                    <h3 className="text-2xl font-light text-white mb-3">Advisory Firms</h3>
                    <p className="text-sm text-white/40 mb-8 font-light leading-relaxed">
                      Enterprise platform for Accountants, Financial Planners, and Bookkeepers
                      managing high-volume Australian client portfolios.
                    </p>
                    <div className="space-y-3 mb-10">
                      {[
                        'Unlimited Client Organisations',
                        'Dedicated Advisor Dashboard',
                        'White-Label Report Generation',
                        'Priority Legislative Support',
                        'Advanced API & Bulk-Sync',
                        'Custom Integration Options',
                      ].map((feat) => (
                        <div key={feat} className="flex items-center gap-3">
                          <CheckCircle
                            className="w-4 h-4 flex-shrink-0"
                            style={{ color: SPECTRAL.emerald }}
                          />
                          <span className="text-[13px] text-white/50">{feat}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div>
                    <div className="flex items-baseline gap-3 mb-6">
                      <span className="text-4xl font-mono text-white italic font-light">POA</span>
                      <span className="text-[11px] uppercase tracking-wider text-white/30">
                        Volume Licensing
                      </span>
                    </div>
                    <Link
                      href="/api/auth/xero"
                      className="block w-full text-center py-4 rounded-sm text-[11px] uppercase tracking-[0.2em] font-semibold transition-all duration-300 hover:scale-[1.02]"
                      style={{
                        background: SPECTRAL.cyan,
                        color: '#050505',
                        boxShadow: `0 0 40px ${SPECTRAL.cyan}25`,
                      }}
                    >
                      Apply for Commercial License
                    </Link>
                  </div>
                </div>
              </AnimateOnScroll>
            </div>
          </div>
        </section>

        {/* ── Final CTA ── */}
        <section
          aria-labelledby="cta-heading"
          className="px-4 sm:px-6 lg:px-8 py-20 md:py-28"
        >
          <div className="max-w-7xl mx-auto text-center">
            <AnimateOnScroll>
              <p className="text-[11px] uppercase tracking-[0.4em] text-white/30 mb-6 font-medium">
                Ready to Recover
              </p>
              <h2
                id="cta-heading"
                className="text-3xl md:text-4xl font-extralight tracking-tight text-white mb-6"
              >
                Stop Leaving Tax Benefits on the Table
              </h2>
              <p className="text-base text-white/40 mb-10 max-w-2xl mx-auto leading-relaxed">
                Connect your Xero account in 30 seconds. Our AI scans 5 years of transaction
                data and surfaces every missed deduction, R&D offset, and compliance gap.
              </p>
              <Link
                href="/api/auth/xero"
                className="inline-flex items-center gap-3 px-10 py-5 rounded-sm text-[12px] uppercase tracking-[0.2em] font-semibold transition-all duration-300 hover:scale-[1.02]"
                style={{
                  color: '#050505',
                  backgroundColor: SPECTRAL.emerald,
                  boxShadow: `0 0 80px ${SPECTRAL.emerald}20`,
                }}
              >
                Get Started with Xero
                <ArrowRight className="w-4 h-4" />
              </Link>
              <p className="text-[11px] text-white/25 mt-6">
                No credit card required &middot; Read-only access &middot; $5K minimum benefit
                guarantee
              </p>
            </AnimateOnScroll>
          </div>
        </section>
      </main>

      {/* ── Footer ── */}
      <footer className="px-4 sm:px-6 lg:px-8 py-12 border-t border-white/[0.06]">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6 mb-6">
            <p className="text-[11px] text-white/25 tracking-wider">
              &copy; 2026 ATO Tax Optimizer. ABN Pending. Analysis recommendations only &mdash;
              not financial or tax advice.
            </p>
            <div className="flex items-center gap-8">
              <span className="text-[11px] text-white/20 tracking-wider">
                Division 355 ITAA 1997
              </span>
              <div className="h-4 w-px bg-white/[0.06]" />
              <span className="text-[11px] text-white/20 tracking-wider">Xero Certified</span>
              <div className="h-4 w-px bg-white/[0.06]" />
              <span className="text-[11px] text-white/20 tracking-wider">
                Australian Data Sovereignty
              </span>
            </div>
          </div>
          <p className="text-[10px] text-white/15 text-center leading-relaxed max-w-4xl mx-auto">
            This software is not a registered tax agent or BAS agent under the Tax Agent Services
            Act 2009 (TASA). All analysis is provided for informational purposes only and does not
            constitute tax, financial, or legal advice. Consult a registered tax practitioner
            before implementing any recommendations.
          </p>
        </div>
      </footer>
    </div>
  )
}
