/**
 * ATO Tax Optimizer - Landing Page
 *
 * Scientific Luxury Design System.
 * Premium, minimal, product-ready.
 */

'use client'

import Link from 'next/link'
import { motion } from 'framer-motion'

// ─── Design Tokens ───────────────────────────────────────────────────

const SPECTRAL = {
  cyan: '#00F5FF',
  emerald: '#00FF88',
  amber: '#FFB800',
  red: '#FF4444',
  magenta: '#FF00FF',
} as const

const EASING = [0.19, 1, 0.22, 1] as const

// ─── Breathing Orb ──────────────────────────────────────────────────

function BreathingOrb({ colour, size = 'md' }: { colour: string; size?: 'sm' | 'md' | 'lg' }) {
  const sizes = { sm: 'h-8 w-8', md: 'h-12 w-12', lg: 'h-16 w-16' }
  const dots = { sm: 'h-2 w-2', md: 'h-3 w-3', lg: 'h-4 w-4' }
  return (
    <motion.div
      className={`${sizes[size]} flex items-center justify-center rounded-full border-[0.5px]`}
      style={{
        borderColor: `${colour}50`,
        backgroundColor: `${colour}10`,
        boxShadow: `0 0 40px ${colour}30`,
      }}
    >
      <motion.div
        className={`${dots[size]} rounded-full`}
        style={{ backgroundColor: colour }}
        animate={{ scale: [1, 1.3, 1], opacity: [1, 0.6, 1] }}
        transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
      />
    </motion.div>
  )
}

// ─── Page ────────────────────────────────────────────────────────────

export default function Home() {
  return (
    <div className="min-h-screen text-white" style={{ background: '#050505' }}>

      {/* ── Header ── */}
      <header className="fixed top-0 left-0 right-0 z-50 border-b border-white/[0.06]" style={{ background: 'rgba(5,5,5,0.85)', backdropFilter: 'blur(20px)' }}>
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <BreathingOrb colour={SPECTRAL.cyan} size="sm" />
            <div>
              <span className="text-sm font-medium text-white/90 tracking-wide">ATO Tax Optimizer</span>
              <p className="text-[9px] uppercase tracking-[0.3em] text-white/30">Australian Tax Intelligence</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <Link
              href="/dashboard"
              className="px-4 py-2 text-[10px] uppercase tracking-[0.2em] text-white/40 hover:text-white/70 transition-colors"
            >
              Dashboard
            </Link>
            <Link
              href="/api/auth/xero"
              className="px-5 py-2.5 rounded-sm text-[10px] uppercase tracking-[0.15em] font-medium border-[0.5px] transition-all hover:shadow-lg"
              style={{
                borderColor: `${SPECTRAL.cyan}40`,
                color: SPECTRAL.cyan,
                backgroundColor: `${SPECTRAL.cyan}10`,
              }}
            >
              Connect Xero
            </Link>
          </div>
        </div>
      </header>

      {/* ── Hero ── */}
      <section className="pt-40 pb-32 px-6">
        <div className="max-w-5xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: EASING }}
          >
            <p className="text-[10px] uppercase tracking-[0.4em] text-white/30 mb-8">
              AI-Powered Forensic Tax Analysis
            </p>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.1, ease: EASING }}
            className="text-7xl md:text-8xl font-extralight tracking-tight leading-[0.9] mb-8"
          >
            <span className="text-white">Unlock Every</span>
            <br />
            <span style={{ color: SPECTRAL.cyan }}>Tax Dollar</span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2, ease: EASING }}
            className="text-lg text-white/40 max-w-xl mx-auto mb-12 font-light tracking-wide"
          >
            Deep analysis of your Xero data to identify R&D refunds,
            unclaimed deductions, and optimisation opportunities.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.3, ease: EASING }}
            className="flex items-center justify-center gap-4"
          >
            <Link
              href="/api/auth/xero"
              className="px-8 py-4 rounded-sm text-[11px] uppercase tracking-[0.2em] font-medium border-[0.5px] transition-all hover:shadow-2xl"
              style={{
                borderColor: `${SPECTRAL.cyan}50`,
                color: '#050505',
                backgroundColor: SPECTRAL.cyan,
                boxShadow: `0 0 60px ${SPECTRAL.cyan}30`,
              }}
            >
              Connect Xero Account
            </Link>
            <Link
              href="/dashboard"
              className="px-8 py-4 rounded-sm text-[11px] uppercase tracking-[0.2em] font-medium border-[0.5px] border-white/[0.1] text-white/50 hover:text-white/80 hover:border-white/[0.2] transition-all"
              style={{ background: 'rgba(255,255,255,0.02)' }}
            >
              View Dashboard
            </Link>
          </motion.div>
        </div>
      </section>

      {/* ── Capabilities Data Strip ── */}
      <section className="px-6 pb-32">
        <div className="max-w-5xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8, ease: EASING }}
            className="flex flex-col md:flex-row items-stretch gap-0 border-[0.5px] border-white/[0.06] rounded-sm overflow-hidden"
            style={{ background: 'rgba(255,255,255,0.01)' }}
          >
            {[
              {
                label: 'R&D Tax Incentive',
                value: '43.5%',
                detail: 'Refundable offset under Division 355',
                colour: SPECTRAL.emerald,
              },
              {
                label: 'Loss Recovery',
                value: 'Div 7A',
                detail: 'Carry-forward losses and shareholder loans',
                colour: SPECTRAL.cyan,
              },
              {
                label: 'Deduction Audit',
                value: 'S.8-1',
                detail: 'Misclassified expenses and unclaimed items',
                colour: SPECTRAL.amber,
              },
            ].map((cap, idx) => (
              <div
                key={cap.label}
                className={`flex-1 p-8 ${idx < 2 ? 'md:border-r border-b md:border-b-0 border-white/[0.06]' : ''}`}
              >
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: cap.colour }} />
                  <span className="text-[10px] uppercase tracking-[0.3em] text-white/30">{cap.label}</span>
                </div>
                <p className="font-mono text-3xl font-medium tabular-nums mb-2" style={{ color: cap.colour }}>
                  {cap.value}
                </p>
                <p className="text-sm text-white/30">{cap.detail}</p>
              </div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ── Process Timeline ── */}
      <section className="px-6 pb-32">
        <div className="max-w-3xl mx-auto">
          <motion.p
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, ease: EASING }}
            className="text-[10px] uppercase tracking-[0.4em] text-white/30 text-center mb-16"
          >
            How It Works
          </motion.p>

          <div className="relative">
            {/* Vertical spine */}
            <div className="absolute left-6 top-6 bottom-6 w-px bg-white/[0.06]" />

            {[
              {
                step: '01',
                title: 'Connect',
                desc: 'Secure OAuth link to your Xero accounting data. Read-only access.',
                colour: SPECTRAL.cyan,
              },
              {
                step: '02',
                title: 'Analyse',
                desc: 'AI scans every transaction for R&D eligibility, deductions, and misclassifications.',
                colour: SPECTRAL.emerald,
              },
              {
                step: '03',
                title: 'Review',
                desc: 'Prioritised recommendations with legislation references and confidence scores.',
                colour: SPECTRAL.amber,
              },
              {
                step: '04',
                title: 'Optimise',
                desc: 'Claim R&D offsets, recover losses, and maximise your tax position.',
                colour: SPECTRAL.magenta,
              },
            ].map((item, idx) => (
              <motion.div
                key={item.step}
                initial={{ opacity: 0, x: -30 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: idx * 0.12, ease: EASING }}
                className="relative flex items-start gap-8 mb-12 last:mb-0"
              >
                {/* Orb on spine */}
                <div className="relative z-10 flex-shrink-0">
                  <div
                    className="w-12 h-12 flex items-center justify-center rounded-full border-[0.5px]"
                    style={{
                      borderColor: `${item.colour}40`,
                      backgroundColor: `${item.colour}08`,
                      boxShadow: `0 0 30px ${item.colour}20`,
                    }}
                  >
                    <motion.div
                      className="w-2.5 h-2.5 rounded-full"
                      style={{ backgroundColor: item.colour }}
                      animate={{ scale: [1, 1.3, 1], opacity: [1, 0.5, 1] }}
                      transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut', delay: idx * 0.3 }}
                    />
                  </div>
                </div>

                {/* Content */}
                <div className="pt-2">
                  <div className="flex items-baseline gap-3 mb-2">
                    <span className="text-[10px] font-mono text-white/20 tabular-nums">{item.step}</span>
                    <h3 className="text-xl font-light text-white/90">{item.title}</h3>
                  </div>
                  <p className="text-sm text-white/30 leading-relaxed max-w-md">{item.desc}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Trust Strip ── */}
      <section className="px-6 pb-32">
        <div className="max-w-5xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8, ease: EASING }}
            className="p-8 border-[0.5px] border-white/[0.06] rounded-sm"
            style={{ background: 'rgba(255,255,255,0.01)' }}
          >
            <div className="flex items-center gap-4 mb-6">
              <BreathingOrb colour={SPECTRAL.emerald} size="sm" />
              <h3 className="text-xl font-light text-white/80">Read-Only Analysis</h3>
            </div>
            <p className="text-sm text-white/30 mb-8 max-w-2xl">
              Your data is never modified. We analyse and recommend &mdash; all changes
              require your review and professional advice.
            </p>
            <div className="flex flex-wrap gap-6">
              {[
                'No modifications to Xero',
                'Full ATO legislation citations',
                'Professional review recommended',
                'HTTPS encrypted',
              ].map((item, idx) => (
                <motion.div
                  key={item}
                  initial={{ opacity: 0, x: -10 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: idx * 0.08, duration: 0.5, ease: EASING }}
                  className="flex items-center gap-2"
                >
                  <div className="w-1 h-1 rounded-full" style={{ backgroundColor: SPECTRAL.emerald }} />
                  <span className="text-[11px] text-white/40 tracking-wide">{item}</span>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="px-6 pb-32">
        <div className="max-w-3xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8, ease: EASING }}
          >
            <p className="text-[10px] uppercase tracking-[0.4em] text-white/20 mb-6">
              Ready to Begin
            </p>
            <h2 className="text-4xl md:text-5xl font-extralight tracking-tight text-white mb-6">
              Optimise Your Tax Position
            </h2>
            <p className="text-sm text-white/30 mb-10 max-w-md mx-auto">
              Connect your Xero account and discover potential refunds,
              unclaimed deductions, and optimisation opportunities.
            </p>
            <Link
              href="/api/auth/xero"
              className="inline-flex items-center gap-3 px-10 py-5 rounded-sm text-[11px] uppercase tracking-[0.2em] font-medium transition-all hover:shadow-2xl"
              style={{
                color: '#050505',
                backgroundColor: SPECTRAL.emerald,
                boxShadow: `0 0 80px ${SPECTRAL.emerald}25`,
              }}
            >
              Get Started with Xero
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
              </svg>
            </Link>
          </motion.div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="px-6 py-8 border-t border-white/[0.06]">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-[10px] text-white/20 tracking-wider">
            &copy; 2026 ATO Tax Optimizer. Analysis recommendations only.
          </p>
          <div className="flex items-center gap-6">
            <span className="text-[10px] text-white/15 tracking-wider">Division 355 ITAA 1997</span>
            <div className="h-3 w-px bg-white/[0.06]" />
            <span className="text-[10px] text-white/15 tracking-wider">Xero Integration</span>
            <div className="h-3 w-px bg-white/[0.06]" />
            <span className="text-[10px] text-white/15 tracking-wider">Read-Only Access</span>
          </div>
        </div>
      </footer>
    </div>
  )
}
