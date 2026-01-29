/**
 * ATO Tax Optimizer - Landing Page (Optimized)
 *
 * Scientific Luxury Design System.
 * Premium, minimal, conversion-focused.
 */

'use client'

import Link from 'next/link'
import { motion } from 'framer-motion'
import { CheckCircle, Shield, Lock, Award } from 'lucide-react'

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
  const sizes = { sm: 'h-10 w-10', md: 'h-14 w-14', lg: 'h-20 w-20' }
  const dots = { sm: 'h-2.5 w-2.5', md: 'h-3.5 w-3.5', lg: 'h-5 w-5' }
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
    <div className="min-h-screen text-white flex justify-center" style={{ background: '#050505' }}>
      <div className="max-w-[1920px] w-full">
        {/* ── Hero ── */}
        <section className="pt-24 md:pt-32 pb-40 px-6">
          <div className="max-w-6xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: EASING }}
          >
            <p className="text-[11px] uppercase tracking-[0.4em] text-white/40 mb-10 font-medium">
              AI-Powered Forensic Tax Analysis
            </p>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.1, ease: EASING }}
            className="text-4xl md:text-5xl lg:text-6xl font-extralight tracking-tight leading-[1.1] mb-8"
          >
            <span className="text-white">Unlock Every</span>
            <br />
            <span style={{ color: SPECTRAL.cyan }}>Tax Dollar</span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2, ease: EASING }}
            className="text-lg md:text-xl text-white/60 max-w-2xl mx-auto mb-10 font-light leading-relaxed"
          >
            Deep AI analysis of your Xero data to identify R&D refunds,
            unclaimed deductions, and tax optimisation opportunities worth <span className="text-white/90" style={{ color: SPECTRAL.emerald }}>$200K-$500K</span>.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.3, ease: EASING }}
            className="flex flex-col sm:flex-row items-center justify-center gap-5 mb-12"
          >
            <Link
              href="/api/auth/xero"
              className="group px-10 py-5 rounded-sm text-[12px] uppercase tracking-[0.2em] font-semibold border-[0.5px] transition-all duration-300 hover:scale-105 w-full sm:w-auto"
              style={{
                borderColor: `${SPECTRAL.cyan}50`,
                color: '#050505',
                backgroundColor: SPECTRAL.cyan,
                boxShadow: `0 0 60px ${SPECTRAL.cyan}30`,
              }}
            >
              <span className="flex items-center justify-center gap-3">
                Connect Xero Account
                <svg className="w-4 h-4 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                </svg>
              </span>
            </Link>
            <Link
              href="/dashboard"
              className="px-10 py-5 rounded-sm text-[12px] uppercase tracking-[0.2em] font-medium border-[0.5px] border-white/[0.15] text-white/60 hover:text-white/90 hover:border-white/[0.3] transition-all duration-300 w-full sm:w-auto"
              style={{ background: 'rgba(255,255,255,0.03)' }}
            >
              View Dashboard
            </Link>
          </motion.div>

          {/* Trust Indicators */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.4, ease: EASING }}
            className="flex flex-wrap items-center justify-center gap-8 text-[11px] text-white/30"
          >
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4" style={{ color: SPECTRAL.emerald }} />
              <span>Read-Only Access</span>
            </div>
            <div className="flex items-center gap-2">
              <Lock className="w-4 h-4" style={{ color: SPECTRAL.cyan }} />
              <span>Bank-Grade Security</span>
            </div>
            <div className="flex items-center gap-2">
              <Award className="w-4 h-4" style={{ color: SPECTRAL.amber }} />
              <span>ATO Legislation Compliant</span>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ── Capabilities Data Strip ── */}
      <section className="px-6 py-20 md:py-32">
        <div className="max-w-5xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8, ease: EASING }}
            className="grid grid-cols-1 md:grid-cols-3 gap-5"
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
            ].map((cap) => (
              <motion.div
                key={cap.label}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, ease: EASING }}
                className="p-6 border-[0.5px] border-white/[0.08] rounded-sm hover:border-white/[0.15] transition-all duration-300"
                style={{
                  background: `rgba(255,255,255,0.02)`,
                  boxShadow: `0 0 40px ${cap.colour}08`
                }}
              >
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: cap.colour }} />
                  <span className="text-[11px] uppercase tracking-[0.3em] text-white/40 font-medium">{cap.label}</span>
                </div>
                <p className="font-mono text-3xl md:text-4xl font-medium tabular-nums mb-3" style={{ color: cap.colour }}>
                  {cap.value}
                </p>
                <p className="text-sm text-white/40 leading-relaxed">{cap.detail}</p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ── Process Timeline ── */}
      <section className="px-6 py-20 md:py-32">
        <div className="max-w-4xl mx-auto">
          <motion.p
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, ease: EASING }}
            className="text-[11px] uppercase tracking-[0.4em] text-white/40 text-center mb-12 font-medium"
          >
            How It Works
          </motion.p>

          <div className="space-y-10">
            {[
              {
                step: '01',
                title: 'Connect',
                desc: 'Secure OAuth link to your Xero accounting data. Read-only access ensures your data is never modified.',
                colour: SPECTRAL.cyan,
              },
              {
                step: '02',
                title: 'Analyse',
                desc: 'Our AI scans every transaction across 5 years for R&D eligibility, deductions, and ledger misclassifications.',
                colour: SPECTRAL.emerald,
              },
              {
                step: '03',
                title: 'Review',
                desc: 'Receive prioritised recommendations with full ATO legislation references and confidence scores.',
                colour: SPECTRAL.amber,
              },
              {
                step: '04',
                title: 'Optimise',
                desc: 'Claim R&D offsets, recover carry-forward losses, and maximise your tax position with professional guidance.',
                colour: SPECTRAL.magenta,
              },
            ].map((item, idx) => (
              <motion.div
                key={item.step}
                initial={{ opacity: 0, x: -30 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: idx * 0.1, ease: EASING }}
                className="flex items-start gap-8"
              >
                {/* Orb */}
                <div className="flex-shrink-0">
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
                <div className="flex-1 pt-1">
                  <div className="flex items-baseline gap-4 mb-2">
                    <span className="text-[11px] font-mono text-white/25 tabular-nums tracking-wider">{item.step}</span>
                    <h3 className="text-xl md:text-2xl font-light text-white/95">{item.title}</h3>
                  </div>
                  <p className="text-sm md:text-base text-white/45 leading-relaxed">{item.desc}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Pricing Section ── */}
      <section id="pricing" className="px-6 py-20 md:py-32">
        <div className="max-w-5xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8, ease: EASING }}
            className="text-center mb-14"
          >
            <p className="text-[11px] uppercase tracking-[0.4em] text-white/40 mb-4 font-medium">Investment Options</p>
            <h2 className="text-3xl md:text-4xl font-extralight tracking-tight text-white mb-6">Select Your Plan</h2>
            <p className="text-base md:text-lg text-white/40 max-w-2xl mx-auto font-light leading-relaxed">
              Professional solutions for Australian entities seeking high-fidelity tax optimisation.
            </p>
          </motion.div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Business Owner Card */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8, ease: EASING }}
              className="p-8 border-[0.5px] border-white/[0.08] rounded-sm flex flex-col justify-between hover:border-white/[0.15] transition-all duration-300"
              style={{ background: 'rgba(255,255,255,0.02)' }}
            >
              <div>
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-3">
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: SPECTRAL.cyan }} />
                    <span className="text-[11px] uppercase tracking-[0.3em] text-white/40 font-medium">Individual</span>
                  </div>
                </div>
                <h3 className="text-2xl md:text-3xl font-light text-white mb-3">Business Owner</h3>
                <p className="text-sm md:text-base text-white/40 mb-8 font-light leading-relaxed">
                  For Australian entities seeking to recover historical R&D offsets and correct ledger misclassifications across 5 financial years.
                </p>
                <div className="space-y-3 mb-10">
                  {[
                    'Full 5-Year Forensic Audit',
                    'R&D Eligibility Assessment (Div 355)',
                    'Division 7A Risk Monitoring',
                    'Unclaimed Deduction Discovery',
                    'Professional PDF/Excel Reports',
                    'Legislation References Included'
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
                  <span className="text-4xl md:text-5xl font-mono text-white font-light">$995</span>
                  <span className="text-[11px] uppercase tracking-wider text-white/30">One-Off Audit</span>
                </div>
                <Link
                  href="/api/auth/xero"
                  className="block w-full text-center py-4 rounded-sm text-[12px] uppercase tracking-[0.2em] font-medium border-[0.5px] border-white/[0.15] text-white/60 hover:text-white/90 hover:border-white/[0.3] transition-all duration-300"
                  style={{ background: 'rgba(255,255,255,0.04)' }}
                >
                  Start Professional Audit
                </Link>
              </div>
            </motion.div>

            {/* Advisory Firms Card */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8, delay: 0.1, ease: EASING }}
              className="p-8 border-[0.5px] rounded-sm flex flex-col justify-between relative overflow-hidden"
              style={{
                borderColor: `${SPECTRAL.cyan}30`,
                background: `linear-gradient(135deg, rgba(0, 245, 255, 0.05) 0%, rgba(0, 255, 136, 0.03) 100%)`,
                boxShadow: `0 0 100px ${SPECTRAL.cyan}15`
              }}
            >
              <div className="absolute top-5 right-5">
                <div className="px-3 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest" style={{ background: SPECTRAL.cyan, color: '#050505' }}>
                  Pro Licensed
                </div>
              </div>
              <div>
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: SPECTRAL.emerald }} />
                  <span className="text-[11px] uppercase tracking-[0.3em] text-white/40 font-medium">Enterprise</span>
                </div>
                <h3 className="text-2xl md:text-3xl font-light text-white mb-3">Advisory Firms</h3>
                <p className="text-sm md:text-base text-white/40 mb-8 font-light leading-relaxed">
                  Enterprise multi-tenant platform for Accountants, Financial Planners, and Bookkeepers managing high-volume client portfolios.
                </p>
                <div className="space-y-3 mb-10">
                  {[
                    'Unlimited Client Organizations',
                    'Dedicated Advisor Dashboard',
                    'White-Label Report Generation',
                    'Priority Legislative Support',
                    'Advanced API & Bulk-Sync',
                    'Custom Integration Options'
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
                  <span className="text-4xl md:text-5xl font-mono text-white italic font-light">POA</span>
                  <span className="text-[11px] uppercase tracking-wider text-white/30">Volume Licensing</span>
                </div>
                <button
                  className="block w-full text-center py-4 rounded-sm text-[12px] uppercase tracking-[0.2em] font-semibold transition-all duration-300 hover:scale-105"
                  style={{
                    background: SPECTRAL.cyan,
                    color: '#050505',
                    boxShadow: `0 0 40px ${SPECTRAL.cyan}30`
                  }}
                >
                  Apply for Commercial License
                </button>
              </div>
            </motion.div>
          </div>

          {/* Money-Back Guarantee */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8, delay: 0.2, ease: EASING }}
            className="mt-10 p-6 border-[0.5px] border-white/[0.06] rounded-sm text-center"
            style={{ background: 'rgba(255,255,255,0.01)' }}
          >
            <div className="flex items-center justify-center gap-3 mb-2">
              <Shield className="w-5 h-5" style={{ color: SPECTRAL.emerald }} />
              <span className="text-sm text-white/60 font-medium">100% Money-Back Guarantee</span>
            </div>
            <p className="text-[12px] text-white/35">
              If we don't identify at least $5,000 in potential tax benefits, we'll refund your audit fee in full.
            </p>
          </motion.div>
        </div>
      </section>

      {/* ── Trust Strip ── */}
      <section className="px-6 py-20 md:py-32">
        <div className="max-w-5xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8, ease: EASING }}
            className="p-8 border-[0.5px] border-white/[0.08] rounded-sm"
            style={{ background: 'rgba(255,255,255,0.02)' }}
          >
            <div className="flex items-center gap-4 mb-6">
              <BreathingOrb colour={SPECTRAL.emerald} size="md" />
              <h3 className="text-xl md:text-2xl font-light text-white/90">Read-Only Analysis</h3>
            </div>
            <p className="text-sm md:text-base text-white/40 mb-8 max-w-3xl leading-relaxed">
              Your data is never modified. We analyse and recommend — all changes
              require your review and professional advice.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { icon: Lock, label: 'No Xero Modifications' },
                { icon: CheckCircle, label: 'ATO Legislation Citations' },
                { icon: Shield, label: 'Professional Review Required' },
                { icon: Award, label: 'Bank-Grade Encryption' },
              ].map((item, idx) => (
                <motion.div
                  key={item.label}
                  initial={{ opacity: 0, y: 10 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: idx * 0.08, duration: 0.5, ease: EASING }}
                  className="flex flex-col items-center text-center gap-2 p-5 rounded-sm border border-white/[0.04]"
                  style={{ background: 'rgba(255,255,255,0.01)' }}
                >
                  <item.icon className="w-5 h-5" style={{ color: SPECTRAL.emerald }} />
                  <span className="text-[11px] text-white/50 tracking-wide leading-snug">{item.label}</span>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </div>
      </section>

      {/* ── Final CTA ── */}
      <section className="px-6 pb-20 md:pb-32">
        <div className="max-w-4xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8, ease: EASING }}
          >
            <p className="text-[11px] uppercase tracking-[0.4em] text-white/30 mb-6 font-medium">
              Ready to Begin
            </p>
            <h2 className="text-3xl md:text-4xl font-extralight tracking-tight text-white mb-6">
              Optimise Your Tax Position
            </h2>
            <p className="text-base md:text-lg text-white/40 mb-10 max-w-2xl mx-auto leading-relaxed">
              Connect your Xero account and discover potential refunds,
              unclaimed deductions, and optimisation opportunities.
            </p>
            <Link
              href="/api/auth/xero"
              className="inline-flex items-center gap-3 px-10 py-5 rounded-sm text-[12px] uppercase tracking-[0.2em] font-semibold transition-all duration-300 hover:scale-105"
              style={{
                color: '#050505',
                backgroundColor: SPECTRAL.emerald,
                boxShadow: `0 0 80px ${SPECTRAL.emerald}25`,
              }}
            >
              Get Started with Xero
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M17 8l4 4m0 0l-4 4m4-4H3" />
              </svg>
            </Link>
          </motion.div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="px-6 py-12 border-t border-white/[0.06]">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
          <p className="text-[11px] text-white/25 tracking-wider">
            © 2026 ATO Tax Optimizer. Analysis recommendations only. Not financial advice.
          </p>
          <div className="flex items-center gap-8">
            <span className="text-[11px] text-white/20 tracking-wider">Division 355 ITAA 1997</span>
            <div className="h-4 w-px bg-white/[0.06]" />
            <span className="text-[11px] text-white/20 tracking-wider">Xero Integration</span>
            <div className="h-4 w-px bg-white/[0.06]" />
            <span className="text-[11px] text-white/20 tracking-wider">Read-Only Access</span>
          </div>
        </div>
      </footer>
      </div>
    </div>
  )
}
