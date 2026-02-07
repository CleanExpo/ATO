/**
 * ATO Tax Optimizer - Landing Page
 *
 * Geo-focused Australian landing page with E-E-A-T signals,
 * Local Business Schema, interactive R&D offset calculator,
 * and compliance-first messaging per TASA 2009.
 */

'use client'

import Link from 'next/link'
import { motion } from 'framer-motion'
import { useState, useRef, useCallback, useEffect } from 'react'
import {
  CheckCircle,
  Shield,
  Lock,
  Award,
  AlertTriangle,
  ArrowRight,
  FileText,
  DollarSign,
  BarChart3,
  Search,
  TrendingUp,
  Zap,
  Scale,
  Eye,
  ChevronRight,
  Calculator,
  Building2,
  MapPin,
} from 'lucide-react'

// ─── Design Tokens ───────────────────────────────────────────────────

const SPECTRAL = {
  cyan: '#00F5FF',
  emerald: '#00FF88',
  amber: '#FFB800',
  red: '#FF4444',
  magenta: '#FF00FF',
} as const

const EASING = [0.19, 1, 0.22, 1] as const

// ─── Local Business Schema (JSON-LD) ────────────────────────────────

function LocalBusinessSchema() {
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: 'ATO Tax Optimizer',
    applicationCategory: 'BusinessApplication',
    operatingSystem: 'Web',
    offers: {
      '@type': 'Offer',
      price: '995',
      priceCurrency: 'AUD',
    },
    description: 'AI-powered forensic tax analysis for Australian businesses. Identifies R&D tax offsets, unclaimed deductions, and Division 7A compliance gaps from Xero data.',
    areaServed: {
      '@type': 'Country',
      name: 'Australia',
    },
    provider: {
      '@type': 'Organization',
      name: 'ATO Tax Optimizer',
      areaServed: 'AU',
      knowsAbout: [
        'R&D Tax Incentive (Division 355 ITAA 1997)',
        'Division 7A Compliance',
        'Australian Business Taxation',
        'Tax Deduction Recovery',
        'Xero Accounting Integration',
      ],
    },
    featureList: [
      'Forensic analysis of 5 years of Xero transaction data',
      'R&D Tax Incentive eligibility assessment',
      'Division 7A loan compliance monitoring',
      'Unclaimed deduction discovery',
      'ATO legislation references on every finding',
    ],
  }

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  )
}

function FAQSchema() {
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: [
      {
        '@type': 'Question',
        name: 'How much can Australian businesses recover through R&D tax offsets?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Under Division 355 ITAA 1997, eligible Australian businesses with turnover under $20M can receive a refundable tax offset of up to 43.5% on qualifying R&D expenditure. Our forensic analysis typically identifies $200K-$500K in recoverable benefits across 5 financial years.',
        },
      },
      {
        '@type': 'Question',
        name: 'Is my Xero data safe with ATO Tax Optimizer?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Yes. We use read-only Xero OAuth access with AES-256-GCM encryption. Your accounting data is never modified. All infrastructure runs in Australian data centres (ap-southeast-2).',
        },
      },
      {
        '@type': 'Question',
        name: 'Does this replace my tax agent?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'No. ATO Tax Optimizer is an analytical tool, not a registered tax agent under the Tax Agent Services Act 2009. All findings should be reviewed by a qualified tax professional before implementation.',
        },
      },
    ],
  }

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  )
}

// ─── Interactive R&D Offset Calculator ──────────────────────────────

function OffsetCalculator() {
  const [expenditure, setExpenditure] = useState(250000)
  const [entityRate, setEntityRate] = useState<25 | 30>(25)

  const offsetRate = entityRate === 25 ? 0.435 : 0.485
  const offsetAmount = Math.round(expenditure * offsetRate)
  const netCost = expenditure - offsetAmount

  const sliderRef = useRef<HTMLDivElement>(null)
  const [isDragging, setIsDragging] = useState(false)

  const handleSliderInteraction = useCallback((clientX: number) => {
    if (!sliderRef.current) return
    const rect = sliderRef.current.getBoundingClientRect()
    const pct = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width))
    // Snap to $10K increments, range $50K - $2M
    const raw = 50000 + pct * 1950000
    const snapped = Math.round(raw / 10000) * 10000
    setExpenditure(snapped)
  }, [])

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    setIsDragging(true)
    handleSliderInteraction(e.clientX)
  }, [handleSliderInteraction])

  useEffect(() => {
    if (!isDragging) return
    const handleMouseMove = (e: MouseEvent) => handleSliderInteraction(e.clientX)
    const handleMouseUp = () => setIsDragging(false)
    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isDragging, handleSliderInteraction])

  const pct = ((expenditure - 50000) / 1950000) * 100

  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.8, ease: EASING }}
      className="p-8 md:p-10 border-[0.5px] rounded-sm"
      style={{
        borderColor: `${SPECTRAL.cyan}20`,
        background: 'linear-gradient(135deg, rgba(0,245,255,0.03) 0%, rgba(0,255,136,0.02) 100%)',
      }}
    >
      <div className="flex items-center gap-3 mb-8">
        <Calculator className="w-5 h-5" style={{ color: SPECTRAL.cyan }} />
        <h3 className="text-lg font-medium text-white/90">R&D Offset Calculator</h3>
        <span className="text-[10px] uppercase tracking-widest text-white/30 ml-auto">Division 355 ITAA 1997</span>
      </div>

      {/* Entity rate toggle */}
      <div className="flex items-center gap-4 mb-8">
        <span className="text-[11px] uppercase tracking-wider text-white/40">Corporate Rate:</span>
        <div className="flex gap-2">
          {([25, 30] as const).map(rate => (
            <button
              key={rate}
              onClick={() => setEntityRate(rate)}
              className="px-4 py-2 rounded-sm text-[11px] font-mono transition-all duration-200"
              style={{
                background: entityRate === rate ? `${SPECTRAL.cyan}15` : 'rgba(255,255,255,0.03)',
                borderWidth: '0.5px',
                borderStyle: 'solid',
                borderColor: entityRate === rate ? `${SPECTRAL.cyan}40` : 'rgba(255,255,255,0.08)',
                color: entityRate === rate ? SPECTRAL.cyan : 'rgba(255,255,255,0.5)',
              }}
            >
              {rate}%{rate === 25 ? ' (Base)' : ' (Standard)'}
            </button>
          ))}
        </div>
      </div>

      {/* Slider */}
      <div className="mb-10">
        <div className="flex justify-between items-baseline mb-3">
          <span className="text-[11px] uppercase tracking-wider text-white/40">Eligible R&D Expenditure</span>
          <span className="text-2xl font-mono text-white font-light tabular-nums">
            ${expenditure.toLocaleString()}
          </span>
        </div>
        <div
          ref={sliderRef}
          className="relative h-2 bg-white/[0.06] rounded-full cursor-pointer select-none"
          onMouseDown={handleMouseDown}
          onTouchStart={(e) => {
            setIsDragging(true)
            handleSliderInteraction(e.touches[0].clientX)
          }}
          onTouchMove={(e) => handleSliderInteraction(e.touches[0].clientX)}
          onTouchEnd={() => setIsDragging(false)}
        >
          <motion.div
            className="absolute top-0 left-0 h-full rounded-full"
            style={{
              width: `${pct}%`,
              background: `linear-gradient(90deg, ${SPECTRAL.cyan}, ${SPECTRAL.emerald})`,
            }}
            layout
          />
          <motion.div
            className="absolute top-1/2 -translate-y-1/2 w-5 h-5 rounded-full border-2"
            style={{
              left: `${pct}%`,
              marginLeft: '-10px',
              borderColor: SPECTRAL.cyan,
              backgroundColor: '#050505',
              boxShadow: `0 0 20px ${SPECTRAL.cyan}40`,
            }}
            layout
          />
        </div>
        <div className="flex justify-between mt-2 text-[10px] font-mono text-white/20">
          <span>$50K</span>
          <span>$2M</span>
        </div>
      </div>

      {/* Results */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        <div className="p-5 rounded-sm border-[0.5px] border-white/[0.06]" style={{ background: 'rgba(0,255,136,0.04)' }}>
          <p className="text-[10px] uppercase tracking-widest text-white/40 mb-2">Estimated Offset</p>
          <p className="text-3xl font-mono tabular-nums font-light" style={{ color: SPECTRAL.emerald }}>
            ${offsetAmount.toLocaleString()}
          </p>
          <p className="text-[10px] text-white/30 mt-1">{(offsetRate * 100).toFixed(1)}% refundable rate</p>
        </div>
        <div className="p-5 rounded-sm border-[0.5px] border-white/[0.06]" style={{ background: 'rgba(0,245,255,0.04)' }}>
          <p className="text-[10px] uppercase tracking-widest text-white/40 mb-2">Net R&D Cost</p>
          <p className="text-3xl font-mono tabular-nums font-light" style={{ color: SPECTRAL.cyan }}>
            ${netCost.toLocaleString()}
          </p>
          <p className="text-[10px] text-white/30 mt-1">After tax offset recovery</p>
        </div>
        <div className="p-5 rounded-sm border-[0.5px] border-white/[0.06]" style={{ background: 'rgba(255,184,0,0.04)' }}>
          <p className="text-[10px] uppercase tracking-widest text-white/40 mb-2">Effective Cost</p>
          <p className="text-3xl font-mono tabular-nums font-light" style={{ color: SPECTRAL.amber }}>
            {((1 - offsetRate) * 100).toFixed(1)}%
          </p>
          <p className="text-[10px] text-white/30 mt-1">Per dollar of R&D spend</p>
        </div>
      </div>

      <p className="text-[10px] text-white/25 mt-6 leading-relaxed">
        Estimate only. Refundable offset for entities with aggregated turnover under $20M (s 355-100 ITAA 1997).
        Entities at 30% rate receive 48.5% offset. Subject to $4M annual cap. Consult a registered tax agent.
      </p>
    </motion.div>
  )
}

// ─── Dashboard Preview Component ────────────────────────────────────

function DashboardPreview() {
  return (
    <motion.div
      initial={{ opacity: 0, x: 40 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 1, delay: 0.4, ease: EASING }}
      className="relative"
    >
      <div
        className="rounded-sm border-[0.5px] overflow-hidden"
        style={{
          borderColor: `${SPECTRAL.cyan}20`,
          background: 'rgba(255,255,255,0.02)',
          boxShadow: `0 0 120px ${SPECTRAL.cyan}08, 0 40px 80px rgba(0,0,0,0.5)`,
        }}
      >
        {/* Mock browser chrome */}
        <div className="px-4 py-3 border-b border-white/[0.06] flex items-center gap-2">
          <div className="flex gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-white/10" />
            <div className="w-2.5 h-2.5 rounded-full bg-white/10" />
            <div className="w-2.5 h-2.5 rounded-full bg-white/10" />
          </div>
          <div className="flex-1 mx-4 px-3 py-1 rounded-sm bg-white/[0.04] text-[10px] text-white/30 font-mono">
            app.atotaxoptimizer.com.au/dashboard
          </div>
        </div>

        {/* Dashboard content simulation */}
        <div className="p-6 space-y-4">
          {/* Stats row */}
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: 'R&D Offset', value: '$187,432', colour: SPECTRAL.emerald },
              { label: 'Deductions', value: '$94,218', colour: SPECTRAL.cyan },
              { label: 'Div 7A Risk', value: 'LOW', colour: SPECTRAL.amber },
            ].map(stat => (
              <div key={stat.label} className="p-3 rounded-sm border-[0.5px] border-white/[0.06]" style={{ background: 'rgba(255,255,255,0.02)' }}>
                <p className="text-[8px] uppercase tracking-widest text-white/30 mb-1">{stat.label}</p>
                <p className="text-sm font-mono" style={{ color: stat.colour }}>{stat.value}</p>
              </div>
            ))}
          </div>

          {/* Chart bars */}
          <div className="p-4 rounded-sm border-[0.5px] border-white/[0.06]" style={{ background: 'rgba(255,255,255,0.01)' }}>
            <p className="text-[8px] uppercase tracking-widest text-white/25 mb-3">Quarterly Tax Position</p>
            <div className="flex items-end gap-2 h-20">
              {[65, 42, 78, 55, 88, 70, 95, 60].map((h, i) => (
                <motion.div
                  key={i}
                  className="flex-1 rounded-sm"
                  style={{
                    background: i % 2 === 0
                      ? `linear-gradient(to top, ${SPECTRAL.cyan}40, ${SPECTRAL.cyan}10)`
                      : `linear-gradient(to top, ${SPECTRAL.emerald}40, ${SPECTRAL.emerald}10)`,
                  }}
                  initial={{ height: 0 }}
                  animate={{ height: `${h}%` }}
                  transition={{ duration: 0.8, delay: 0.6 + i * 0.08, ease: EASING }}
                />
              ))}
            </div>
          </div>

          {/* Finding rows */}
          <div className="space-y-2">
            {[
              { text: 'Unclaimed software development costs — Div 355 eligible', tag: 'R&D', colour: SPECTRAL.emerald },
              { text: 'Motor vehicle deductions reclassified — S.8-1', tag: 'DED', colour: SPECTRAL.cyan },
              { text: 'Shareholder loan benchmark rate variance', tag: '7A', colour: SPECTRAL.amber },
            ].map(row => (
              <div key={row.text} className="flex items-center gap-3 p-3 rounded-sm border-[0.5px] border-white/[0.04]" style={{ background: 'rgba(255,255,255,0.01)' }}>
                <span className="text-[8px] font-mono px-2 py-0.5 rounded-sm border-[0.5px]" style={{ color: row.colour, borderColor: `${row.colour}30`, background: `${row.colour}10` }}>
                  {row.tag}
                </span>
                <span className="text-[10px] text-white/40 truncate">{row.text}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Glow effect */}
      <div
        className="absolute -inset-10 -z-10 blur-3xl opacity-30"
        style={{ background: `radial-gradient(ellipse at center, ${SPECTRAL.cyan}15, transparent 70%)` }}
      />
    </motion.div>
  )
}

// ─── Compliance Audit Card ──────────────────────────────────────────

function ComplianceAuditCard() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.8, ease: EASING }}
      className="p-8 md:p-10 border-[0.5px] border-white/[0.08] rounded-sm"
      style={{ background: 'rgba(255,255,255,0.02)' }}
    >
      <div className="flex items-start gap-6 mb-8">
        <div className="flex-shrink-0 w-14 h-14 rounded-full border-[0.5px] flex items-center justify-center"
          style={{ borderColor: `${SPECTRAL.amber}30`, background: `${SPECTRAL.amber}08` }}>
          <Scale className="w-6 h-6" style={{ color: SPECTRAL.amber }} />
        </div>
        <div>
          <h3 className="text-xl font-medium text-white/90 mb-1">Independent Compliance Audit</h3>
          <p className="text-[11px] uppercase tracking-wider text-white/30">Verified against ITAA 1936 / ITAA 1997 / FBTAA 1986 / TASA 2009</p>
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
        ].map(col => (
          <div key={col.title}>
            <p className="text-[10px] uppercase tracking-widest text-white/40 mb-4">{col.title}</p>
            <div className="space-y-3">
              {col.items.map(item => (
                <div key={item} className="flex items-start gap-3">
                  <CheckCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" style={{ color: SPECTRAL.emerald }} />
                  <span className="text-[12px] text-white/50 leading-relaxed">{item}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="p-4 rounded-sm border-[0.5px] border-amber-500/10" style={{ background: 'rgba(255,184,0,0.03)' }}>
        <p className="text-[11px] text-white/40 leading-relaxed">
          <strong className="text-white/60">Disclaimer:</strong> This platform is an analytical tool and is not a registered tax agent under the Tax Agent Services Act 2009 (TASA).
          All findings are estimates for informational purposes only. Review by a registered tax practitioner is required before implementation.
        </p>
      </div>
    </motion.div>
  )
}

// ─── Main Page ──────────────────────────────────────────────────────

export default function Home() {
  return (
    <div className="min-h-screen text-white" style={{ background: '#050505' }}>
      <LocalBusinessSchema />
      <FAQSchema />

      <div className="w-full">

        {/* ── Section 1: Hero — "The Pain Killer" ── */}
        <section className="min-h-screen flex flex-col justify-center px-4 sm:px-6 lg:px-8 py-16">
          <div className="max-w-4xl mx-auto w-full text-center">
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.8, ease: EASING }}
                  className="flex items-center justify-center gap-3 mb-8"
                >
                  <MapPin className="w-3.5 h-3.5" style={{ color: SPECTRAL.cyan }} />
                  <span className="text-[11px] uppercase tracking-[0.3em] text-white/40 font-medium">
                    Built for Australian Businesses
                  </span>
                </motion.div>

                <motion.h1
                  initial={{ opacity: 0, y: 30 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.8, delay: 0.1, ease: EASING }}
                  className="text-4xl md:text-5xl lg:text-[3.5rem] font-extralight tracking-tight leading-[1.1] mb-6"
                >
                  <span className="text-white">Your Xero Data Holds</span>
                  <br />
                  <span style={{ color: SPECTRAL.cyan }}>$200K+ in Missed Tax Benefits</span>
                </motion.h1>

                <motion.p
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.8, delay: 0.2, ease: EASING }}
                  className="text-lg text-white/50 max-w-xl mx-auto mb-4 font-light leading-relaxed"
                >
                  AI-powered forensic analysis scans 5 years of transactions to surface
                  R&D tax offsets, unclaimed deductions, and compliance gaps that your
                  current process is likely missing.
                </motion.p>

                <motion.p
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.8, delay: 0.25, ease: EASING }}
                  className="text-sm text-white/30 mb-10 font-light"
                >
                  Division 355 ITAA 1997 &middot; Section 8-1 ITAA 1997 &middot; Division 7A ITAA 1936
                </motion.p>

                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.8, delay: 0.3, ease: EASING }}
                  className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-10"
                >
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
                      Connect Xero — Free Analysis
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
                </motion.div>

                {/* E-E-A-T Trust Signals */}
                <motion.div
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.8, delay: 0.4, ease: EASING }}
                  className="flex flex-wrap justify-center gap-6 text-[11px] text-white/30"
                >
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
                </motion.div>
          </div>

          {/* Dashboard Preview — below hero text, centered */}
          <div className="max-w-3xl mx-auto w-full mt-16 hidden lg:block">
            <DashboardPreview />
          </div>
        </section>

        {/* ── Pain Killer: What You're Missing ── */}
        <section className="px-4 sm:px-6 lg:px-8 py-20 md:py-28">
          <div className="max-w-7xl mx-auto">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8, ease: EASING }}
              className="text-center mb-14"
            >
              <p className="text-[11px] uppercase tracking-[0.4em] text-white/40 mb-4 font-medium">The Problem</p>
              <h2 className="text-3xl md:text-4xl font-extralight tracking-tight text-white mb-4">
                Most Australian SMEs Leave Money on the Table
              </h2>
              <p className="text-base text-white/40 max-w-2xl mx-auto font-light leading-relaxed">
                Manual bookkeeping misses eligible R&D activities, misclassifies deductible expenses,
                and overlooks compliance gaps that compound across financial years.
              </p>
            </motion.div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {[
                {
                  icon: Search,
                  label: 'R&D Activities Hidden in OpEx',
                  stat: '43.5%',
                  statLabel: 'Refundable Offset',
                  detail: 'Software development, process improvement, and engineering work often qualifies under Division 355 but gets buried in general operating expenses.',
                  colour: SPECTRAL.emerald,
                },
                {
                  icon: FileText,
                  label: 'Misclassified Deductions',
                  stat: 'S.8-1',
                  statLabel: 'ITAA 1997',
                  detail: 'Business travel, professional development, equipment, and home office costs incorrectly coded in Xero — resulting in understated deductions.',
                  colour: SPECTRAL.cyan,
                },
                {
                  icon: AlertTriangle,
                  label: 'Division 7A Compliance Gaps',
                  stat: '8.77%',
                  statLabel: 'Benchmark Rate',
                  detail: 'Shareholder loans, company payments, and trust distributions that trigger deemed dividend provisions when minimum repayments are missed.',
                  colour: SPECTRAL.amber,
                },
              ].map((item, idx) => (
                <motion.div
                  key={item.label}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.6, delay: idx * 0.1, ease: EASING }}
                  className="p-7 border-[0.5px] border-white/[0.08] rounded-sm hover:border-white/[0.15] transition-all duration-300 flex flex-col"
                  style={{ background: 'rgba(255,255,255,0.02)' }}
                >
                  <div className="flex items-center gap-3 mb-5">
                    <item.icon className="w-4 h-4" style={{ color: item.colour }} />
                    <span className="text-[11px] uppercase tracking-[0.2em] text-white/40 font-medium">{item.label}</span>
                  </div>
                  <div className="mb-5">
                    <span className="text-3xl font-mono font-light tabular-nums" style={{ color: item.colour }}>
                      {item.stat}
                    </span>
                    <span className="text-[10px] uppercase tracking-wider text-white/30 ml-2">{item.statLabel}</span>
                  </div>
                  <p className="text-sm text-white/40 leading-relaxed flex-1">{item.detail}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Section 2: How It Works ── */}
        <section className="px-4 sm:px-6 lg:px-8 py-20 md:py-28">
          <div className="max-w-7xl mx-auto">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8, ease: EASING }}
              className="text-center mb-14"
            >
              <p className="text-[11px] uppercase tracking-[0.4em] text-white/40 mb-4 font-medium">How It Works</p>
              <h2 className="text-3xl md:text-4xl font-extralight tracking-tight text-white">
                From Xero Connection to Tax Recovery
              </h2>
            </motion.div>

            <div className="space-y-8">
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
                  desc: 'Our engine analyses every transaction across 5 financial years — flagging R&D eligibility, deduction gaps, and Division 7A exposures.',
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
                  desc: 'Share exportable reports (PDF/Excel) with your registered tax agent for review and implementation. We recommend — they execute.',
                  colour: SPECTRAL.magenta,
                  icon: FileText,
                  detail: 'White-label reports for advisory firms',
                },
              ].map((item, idx) => (
                <motion.div
                  key={item.step}
                  initial={{ opacity: 0, x: -20 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.6, delay: idx * 0.08, ease: EASING }}
                  className="flex items-start gap-6 md:gap-8 group"
                >
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
                      <span className="text-[11px] font-mono text-white/20 tabular-nums tracking-wider">{item.step}</span>
                      <h3 className="text-xl font-light text-white/90">{item.title}</h3>
                    </div>
                    <p className="text-sm text-white/45 leading-relaxed mb-2">{item.desc}</p>
                    <span className="text-[10px] uppercase tracking-wider text-white/25 font-mono">{item.detail}</span>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Interactive R&D Offset Calculator ── */}
        <section className="px-4 sm:px-6 lg:px-8 py-20 md:py-28">
          <div className="max-w-7xl mx-auto">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8, ease: EASING }}
              className="text-center mb-10"
            >
              <p className="text-[11px] uppercase tracking-[0.4em] text-white/40 mb-4 font-medium">Calculate Your Benefit</p>
              <h2 className="text-3xl md:text-4xl font-extralight tracking-tight text-white">
                R&D Tax Offset Estimator
              </h2>
            </motion.div>

            <div className="max-w-4xl mx-auto">
              <OffsetCalculator />
            </div>
          </div>
        </section>

        {/* ── Section 3: Compliance Guarantee ── */}
        <section className="px-4 sm:px-6 lg:px-8 py-20 md:py-28">
          <div className="max-w-7xl mx-auto">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8, ease: EASING }}
              className="text-center mb-14"
            >
              <p className="text-[11px] uppercase tracking-[0.4em] text-white/40 mb-4 font-medium">Compliance Guarantee</p>
              <h2 className="text-3xl md:text-4xl font-extralight tracking-tight text-white mb-4">
                Built on Australian Tax Law
              </h2>
              <p className="text-base text-white/40 max-w-2xl mx-auto font-light leading-relaxed">
                Every calculation references specific ATO legislation. Every finding includes
                confidence scores and amendment period deadlines.
              </p>
            </motion.div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-10">
              <ComplianceAuditCard />

              {/* Trust/Security Card */}
              <div className="space-y-6">
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.8, delay: 0.1, ease: EASING }}
                  className="p-8 border-[0.5px] border-white/[0.08] rounded-sm"
                  style={{ background: 'rgba(255,255,255,0.02)' }}
                >
                  <div className="flex items-center gap-3 mb-6">
                    <Eye className="w-5 h-5" style={{ color: SPECTRAL.cyan }} />
                    <h3 className="text-lg font-medium text-white/90">Read-Only Promise</h3>
                  </div>
                  <p className="text-sm text-white/40 mb-6 leading-relaxed">
                    We analyse and recommend. Your Xero data is never modified, deleted, or written to.
                    All changes require your explicit action with professional guidance.
                  </p>
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { icon: Lock, label: 'No Xero Writes' },
                      { icon: Shield, label: 'Bank-Grade Security' },
                      { icon: Award, label: 'ATO Citations' },
                      { icon: Building2, label: 'AU Data Centres' },
                    ].map(item => (
                      <div key={item.label} className="flex items-center gap-2.5 p-3 rounded-sm border-[0.5px] border-white/[0.04]" style={{ background: 'rgba(255,255,255,0.01)' }}>
                        <item.icon className="w-4 h-4" style={{ color: SPECTRAL.emerald }} />
                        <span className="text-[11px] text-white/45">{item.label}</span>
                      </div>
                    ))}
                  </div>
                </motion.div>

                {/* Money-Back Guarantee */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.8, delay: 0.2, ease: EASING }}
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
                    If our forensic audit doesn't identify at least <strong className="text-white/80">$5,000 in potential tax benefits</strong>,
                    we refund your $995 audit fee in full. No questions asked.
                  </p>
                </motion.div>
              </div>
            </div>
          </div>
        </section>

        {/* ── Pricing ── */}
        <section id="pricing" className="px-4 sm:px-6 lg:px-8 py-20 md:py-28">
          <div className="max-w-7xl mx-auto">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8, ease: EASING }}
              className="text-center mb-14"
            >
              <p className="text-[11px] uppercase tracking-[0.4em] text-white/40 mb-4 font-medium">Investment</p>
              <h2 className="text-3xl md:text-4xl font-extralight tracking-tight text-white">Select Your Plan</h2>
            </motion.div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Business Owner */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.8, ease: EASING }}
                className="p-8 border-[0.5px] border-white/[0.08] rounded-sm flex flex-col justify-between hover:border-white/[0.15] transition-all duration-300"
                style={{ background: 'rgba(255,255,255,0.02)' }}
              >
                <div>
                  <div className="flex items-center gap-3 mb-6">
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: SPECTRAL.cyan }} />
                    <span className="text-[11px] uppercase tracking-[0.3em] text-white/40 font-medium">Individual Entity</span>
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
                    ].map(feat => (
                      <div key={feat} className="flex items-center gap-3">
                        <CheckCircle className="w-4 h-4 flex-shrink-0" style={{ color: SPECTRAL.cyan }} />
                        <span className="text-[13px] text-white/50">{feat}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <div className="flex items-baseline gap-3 mb-6">
                    <span className="text-4xl font-mono text-white font-light">$995</span>
                    <span className="text-[11px] uppercase tracking-wider text-white/30">AUD &middot; One-Off Audit</span>
                  </div>
                  <Link
                    href="/api/auth/xero"
                    className="block w-full text-center py-4 rounded-sm text-[11px] uppercase tracking-[0.2em] font-medium border-[0.5px] border-white/[0.15] text-white/60 hover:text-white/90 hover:border-white/[0.3] transition-all duration-300"
                    style={{ background: 'rgba(255,255,255,0.04)' }}
                  >
                    Start Professional Audit
                  </Link>
                </div>
              </motion.div>

              {/* Advisory Firms */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.8, delay: 0.1, ease: EASING }}
                className="p-8 border-[0.5px] rounded-sm flex flex-col justify-between relative overflow-hidden"
                style={{
                  borderColor: `${SPECTRAL.cyan}30`,
                  background: `linear-gradient(135deg, rgba(0,245,255,0.05) 0%, rgba(0,255,136,0.03) 100%)`,
                  boxShadow: `0 0 80px ${SPECTRAL.cyan}10`,
                }}
              >
                <div className="absolute top-5 right-5">
                  <div className="px-3 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest" style={{ background: SPECTRAL.cyan, color: '#050505' }}>
                    Enterprise
                  </div>
                </div>
                <div>
                  <div className="flex items-center gap-3 mb-6">
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: SPECTRAL.emerald }} />
                    <span className="text-[11px] uppercase tracking-[0.3em] text-white/40 font-medium">Multi-Tenant</span>
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
                    ].map(feat => (
                      <div key={feat} className="flex items-center gap-3">
                        <CheckCircle className="w-4 h-4 flex-shrink-0" style={{ color: SPECTRAL.emerald }} />
                        <span className="text-[13px] text-white/50">{feat}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <div className="flex items-baseline gap-3 mb-6">
                    <span className="text-4xl font-mono text-white italic font-light">POA</span>
                    <span className="text-[11px] uppercase tracking-wider text-white/30">Volume Licensing</span>
                  </div>
                  <button
                    className="block w-full text-center py-4 rounded-sm text-[11px] uppercase tracking-[0.2em] font-semibold transition-all duration-300 hover:scale-[1.02]"
                    style={{
                      background: SPECTRAL.cyan,
                      color: '#050505',
                      boxShadow: `0 0 40px ${SPECTRAL.cyan}25`,
                    }}
                  >
                    Apply for Commercial License
                  </button>
                </div>
              </motion.div>
            </div>
          </div>
        </section>

        {/* ── Final CTA ── */}
        <section className="px-4 sm:px-6 lg:px-8 py-20 md:py-28">
          <div className="max-w-7xl mx-auto text-center">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8, ease: EASING }}
            >
              <p className="text-[11px] uppercase tracking-[0.4em] text-white/30 mb-6 font-medium">
                Ready to Recover
              </p>
              <h2 className="text-3xl md:text-4xl font-extralight tracking-tight text-white mb-6">
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
                No credit card required &middot; Read-only access &middot; $5K minimum benefit guarantee
              </p>
            </motion.div>
          </div>
        </section>

        {/* ── Footer ── */}
        <footer className="px-4 sm:px-6 lg:px-8 py-12 border-t border-white/[0.06]">
          <div className="max-w-7xl mx-auto">
            <div className="flex flex-col md:flex-row items-center justify-between gap-6 mb-6">
              <p className="text-[11px] text-white/25 tracking-wider">
                &copy; 2026 ATO Tax Optimizer. ABN Pending. Analysis recommendations only — not financial or tax advice.
              </p>
              <div className="flex items-center gap-8">
                <span className="text-[11px] text-white/20 tracking-wider">Division 355 ITAA 1997</span>
                <div className="h-4 w-px bg-white/[0.06]" />
                <span className="text-[11px] text-white/20 tracking-wider">Xero Certified</span>
                <div className="h-4 w-px bg-white/[0.06]" />
                <span className="text-[11px] text-white/20 tracking-wider">Australian Data Sovereignty</span>
              </div>
            </div>
            <p className="text-[10px] text-white/15 text-center leading-relaxed max-w-4xl mx-auto">
              This software is not a registered tax agent or BAS agent under the Tax Agent Services Act 2009 (TASA).
              All analysis is provided for informational purposes only and does not constitute tax, financial, or legal advice.
              Consult a registered tax practitioner before implementing any recommendations.
            </p>
          </div>
        </footer>
      </div>
    </div>
  )
}
