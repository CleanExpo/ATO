'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  ResponsiveContainer,
  LineChart,
  Line,
  Area,
  AreaChart,
  Tooltip,
} from 'recharts'

const SPECTRAL = {
  cyan: '#00F5FF',
  emerald: '#00FF88',
  amber: '#FFB800',
  red: '#FF4444',
  magenta: '#FF00FF',
} as const

const EASING = [0.19, 1, 0.22, 1] as const

const TABS = ['Overview', 'R&D Analysis', 'Forensic Audit'] as const
type Tab = (typeof TABS)[number]

// --- Sample data for charts ---

const quarterlyData = [
  { q: 'Q1 FY23', deductions: 42000, rnd: 28000 },
  { q: 'Q2 FY23', deductions: 38000, rnd: 31000 },
  { q: 'Q3 FY23', deductions: 51000, rnd: 35000 },
  { q: 'Q4 FY23', deductions: 45000, rnd: 41000 },
  { q: 'Q1 FY24', deductions: 48000, rnd: 38000 },
  { q: 'Q2 FY24', deductions: 55000, rnd: 44000 },
  { q: 'Q3 FY24', deductions: 52000, rnd: 47000 },
  { q: 'Q4 FY24', deductions: 61000, rnd: 52000 },
]

const rndTrendData = [
  { month: 'Jul', eligible: 12400, claimed: 4200 },
  { month: 'Aug', eligible: 15800, claimed: 5100 },
  { month: 'Sep', eligible: 18200, claimed: 6800 },
  { month: 'Oct', eligible: 22100, claimed: 7200 },
  { month: 'Nov', eligible: 19800, claimed: 8400 },
  { month: 'Dec', eligible: 24500, claimed: 9100 },
  { month: 'Jan', eligible: 21300, claimed: 7800 },
  { month: 'Feb', eligible: 26800, claimed: 10200 },
  { month: 'Mar', eligible: 28400, claimed: 11500 },
  { month: 'Apr', eligible: 31200, claimed: 12800 },
  { month: 'May', eligible: 29800, claimed: 13400 },
  { month: 'Jun', eligible: 34100, claimed: 14200 },
]

const auditFindings = [
  { category: 'R&D Offset', amount: 187432, count: 23 },
  { category: 'Deductions', amount: 94218, count: 47 },
  { category: 'Div 7A', amount: 32150, count: 8 },
  { category: 'FBT', amount: 18420, count: 12 },
  { category: 'Super', amount: 8750, count: 5 },
]

// --- Stat card ---

function StatCard({
  label,
  value,
  colour,
  subtitle,
}: {
  label: string
  value: string
  colour: string
  subtitle?: string
}) {
  return (
    <div
      className="p-3 rounded-sm border-[0.5px] border-white/[0.06]"
      style={{ background: `${colour}06` }}
    >
      <p className="text-[8px] uppercase tracking-widest text-white/30 mb-1">{label}</p>
      <p className="text-sm font-mono tabular-nums" style={{ color: colour }}>
        {value}
      </p>
      {subtitle && <p className="text-[7px] text-white/20 mt-0.5">{subtitle}</p>}
    </div>
  )
}

// --- Finding row ---

function FindingRow({
  text,
  tag,
  colour,
  amount,
}: {
  text: string
  tag: string
  colour: string
  amount?: string
}) {
  return (
    <div
      className="flex items-center gap-3 p-2.5 rounded-sm border-[0.5px] border-white/[0.04]"
      style={{ background: 'rgba(255,255,255,0.01)' }}
    >
      <span
        className="text-[7px] font-mono px-1.5 py-0.5 rounded-sm border-[0.5px] flex-shrink-0"
        style={{
          color: colour,
          borderColor: `${colour}30`,
          background: `${colour}10`,
        }}
      >
        {tag}
      </span>
      <span className="text-[9px] text-white/40 truncate flex-1">{text}</span>
      {amount && (
        <span className="text-[9px] font-mono text-white/50 flex-shrink-0">{amount}</span>
      )}
    </div>
  )
}

// --- Tab content panels ---

function OverviewPanel() {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-2">
        <StatCard label="Total Recovery" value="$342,070" colour={SPECTRAL.emerald} subtitle="5-year analysis" />
        <StatCard label="Unclaimed" value="$94,218" colour={SPECTRAL.cyan} subtitle="47 deductions" />
        <StatCard label="Compliance" value="98.2%" colour={SPECTRAL.amber} subtitle="Div 7A / FBT" />
      </div>

      <div
        className="p-3 rounded-sm border-[0.5px] border-white/[0.06]"
        style={{ background: 'rgba(255,255,255,0.01)' }}
      >
        <p className="text-[8px] uppercase tracking-widest text-white/25 mb-2">
          Quarterly Tax Position
        </p>
        <div className="h-[120px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={quarterlyData} barGap={2} barSize={8}>
              <XAxis
                dataKey="q"
                tick={{ fontSize: 7, fill: 'rgba(255,255,255,0.2)' }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis hide />
              <Tooltip
                contentStyle={{
                  background: '#111',
                  border: '0.5px solid rgba(255,255,255,0.1)',
                  borderRadius: '2px',
                  fontSize: '9px',
                  color: 'rgba(255,255,255,0.7)',
                }}
                formatter={(value: number | undefined) => {
                  const v = value ?? 0
                  return [`$${v.toLocaleString()}`, '']
                }}
              />
              <Bar dataKey="deductions" fill={SPECTRAL.cyan} opacity={0.6} radius={[1, 1, 0, 0]} />
              <Bar dataKey="rnd" fill={SPECTRAL.emerald} opacity={0.6} radius={[1, 1, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="space-y-1.5">
        <FindingRow
          text="Unclaimed software development costs \u2014 Div 355 eligible"
          tag="R&D"
          colour={SPECTRAL.emerald}
          amount="$87,432"
        />
        <FindingRow
          text="Motor vehicle deductions reclassified \u2014 S.8-1"
          tag="DED"
          colour={SPECTRAL.cyan}
          amount="$12,840"
        />
        <FindingRow
          text="Shareholder loan benchmark rate variance"
          tag="7A"
          colour={SPECTRAL.amber}
          amount="$8,210"
        />
      </div>
    </div>
  )
}

function RnDPanel() {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-2">
        <StatCard label="Eligible R&D" value="$431,200" colour={SPECTRAL.emerald} subtitle="Div 355" />
        <StatCard label="Offset (43.5%)" value="$187,572" colour={SPECTRAL.cyan} subtitle="Refundable" />
        <StatCard label="Activities" value="23" colour={SPECTRAL.amber} subtitle="Identified" />
      </div>

      <div
        className="p-3 rounded-sm border-[0.5px] border-white/[0.06]"
        style={{ background: 'rgba(255,255,255,0.01)' }}
      >
        <p className="text-[8px] uppercase tracking-widest text-white/25 mb-2">
          Eligible vs Claimed R&D Expenditure
        </p>
        <div className="h-[120px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={rndTrendData}>
              <XAxis
                dataKey="month"
                tick={{ fontSize: 7, fill: 'rgba(255,255,255,0.2)' }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis hide />
              <Tooltip
                contentStyle={{
                  background: '#111',
                  border: '0.5px solid rgba(255,255,255,0.1)',
                  borderRadius: '2px',
                  fontSize: '9px',
                  color: 'rgba(255,255,255,0.7)',
                }}
                formatter={(value: number | undefined) => {
                  const v = value ?? 0
                  return [`$${v.toLocaleString()}`, '']
                }}
              />
              <Area
                type="monotone"
                dataKey="eligible"
                stroke={SPECTRAL.emerald}
                fill={SPECTRAL.emerald}
                fillOpacity={0.1}
                strokeWidth={1.5}
              />
              <Area
                type="monotone"
                dataKey="claimed"
                stroke={SPECTRAL.cyan}
                fill={SPECTRAL.cyan}
                fillOpacity={0.08}
                strokeWidth={1.5}
                strokeDasharray="4 2"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
        <div className="flex items-center gap-4 mt-2">
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-0.5 rounded-full" style={{ background: SPECTRAL.emerald }} />
            <span className="text-[7px] text-white/30">Eligible</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-0.5 rounded-full" style={{ background: SPECTRAL.cyan, opacity: 0.6 }} />
            <span className="text-[7px] text-white/30">Currently Claimed</span>
          </div>
        </div>
      </div>

      <div className="p-3 rounded-sm border-[0.5px] border-white/[0.06]" style={{ background: `${SPECTRAL.emerald}04` }}>
        <div className="flex items-center justify-between mb-2">
          <span className="text-[8px] uppercase tracking-widest text-white/30">Recovery Gap</span>
          <span className="text-[10px] font-mono" style={{ color: SPECTRAL.emerald }}>$187,572</span>
        </div>
        <div className="w-full h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
          <div
            className="h-full rounded-full"
            style={{
              width: '67%',
              background: `linear-gradient(90deg, ${SPECTRAL.cyan}, ${SPECTRAL.emerald})`,
            }}
          />
        </div>
        <div className="flex justify-between mt-1">
          <span className="text-[7px] text-white/20">Currently claimed</span>
          <span className="text-[7px] text-white/20">Full eligibility</span>
        </div>
      </div>
    </div>
  )
}

function ForensicPanel() {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-2">
        <StatCard label="Findings" value="95" colour={SPECTRAL.cyan} subtitle="Across 5 FYs" />
        <StatCard label="High Priority" value="12" colour={SPECTRAL.red} subtitle="Action required" />
        <StatCard label="Total Value" value="$342K" colour={SPECTRAL.emerald} subtitle="Recoverable" />
      </div>

      <div
        className="p-3 rounded-sm border-[0.5px] border-white/[0.06]"
        style={{ background: 'rgba(255,255,255,0.01)' }}
      >
        <p className="text-[8px] uppercase tracking-widest text-white/25 mb-2">
          Findings by Category
        </p>
        <div className="h-[100px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={auditFindings} layout="vertical" barSize={10}>
              <XAxis type="number" hide />
              <YAxis
                type="category"
                dataKey="category"
                tick={{ fontSize: 8, fill: 'rgba(255,255,255,0.3)' }}
                axisLine={false}
                tickLine={false}
                width={60}
              />
              <Tooltip
                contentStyle={{
                  background: '#111',
                  border: '0.5px solid rgba(255,255,255,0.1)',
                  borderRadius: '2px',
                  fontSize: '9px',
                  color: 'rgba(255,255,255,0.7)',
                }}
                formatter={(value: number | undefined) => {
                  const v = value ?? 0
                  return [`$${v.toLocaleString()}`, 'Amount']
                }}
              />
              <Bar dataKey="amount" fill={SPECTRAL.cyan} opacity={0.7} radius={[0, 2, 2, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="space-y-1.5">
        <FindingRow
          text="FBT car benefit not reported \u2014 s 9 FBTAA 1986"
          tag="FBT"
          colour={SPECTRAL.red}
          amount="$14,200"
        />
        <FindingRow
          text="Prepaid expense apportionment required \u2014 s 82KZM"
          tag="DED"
          colour={SPECTRAL.cyan}
          amount="$8,340"
        />
        <FindingRow
          text="Superannuation guarantee shortfall Q3 FY24"
          tag="SGC"
          colour={SPECTRAL.amber}
          amount="$4,180"
        />
        <FindingRow
          text="Capital vs revenue loss reclassification \u2014 s 102-5"
          tag="CGT"
          colour={SPECTRAL.magenta}
          amount="$22,800"
        />
      </div>
    </div>
  )
}

export function ProductShowcase() {
  const [activeTab, setActiveTab] = useState<Tab>('Overview')

  return (
    <motion.div
      initial={{ opacity: 0, y: 40 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 1, ease: EASING }}
    >
      <figure className="relative">
        <div
          className="rounded-sm border-[0.5px] overflow-hidden"
          style={{
            borderColor: `${SPECTRAL.cyan}20`,
            background: 'rgba(255,255,255,0.02)',
            boxShadow: `0 0 120px ${SPECTRAL.cyan}08, 0 40px 80px rgba(0,0,0,0.5)`,
          }}
        >
          {/* Browser chrome */}
          <div className="px-4 py-2.5 border-b border-white/[0.06] flex items-center gap-2">
            <div className="flex gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full bg-white/10" />
              <div className="w-2.5 h-2.5 rounded-full bg-white/10" />
              <div className="w-2.5 h-2.5 rounded-full bg-white/10" />
            </div>
            <div className="flex-1 mx-4 px-3 py-1 rounded-sm bg-white/[0.04] text-[10px] text-white/30 font-mono">
              ato-ai.app/dashboard
            </div>
          </div>

          {/* Tab bar */}
          <div className="px-4 pt-3 flex gap-1 border-b border-white/[0.06]">
            {TABS.map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className="px-4 py-2 text-[10px] uppercase tracking-wider transition-all duration-200 rounded-t-sm border-b-[1.5px] -mb-px"
                style={{
                  color: activeTab === tab ? SPECTRAL.cyan : 'rgba(255,255,255,0.35)',
                  borderBottomColor: activeTab === tab ? SPECTRAL.cyan : 'transparent',
                  background: activeTab === tab ? 'rgba(0,245,255,0.04)' : 'transparent',
                }}
              >
                {tab}
              </button>
            ))}
          </div>

          {/* Content */}
          <div className="p-4 min-h-[340px]">
            <AnimatePresence mode="wait">
              <motion.div
                key={activeTab}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.3, ease: EASING }}
              >
                {activeTab === 'Overview' && <OverviewPanel />}
                {activeTab === 'R&D Analysis' && <RnDPanel />}
                {activeTab === 'Forensic Audit' && <ForensicPanel />}
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Sample label */}
          <div className="px-4 py-2 border-t border-white/[0.04] flex items-center justify-between">
            <span className="text-[8px] uppercase tracking-widest text-white/20">
              Sample Analysis \u2014 Illustrative Data
            </span>
            <span className="text-[8px] font-mono text-white/15">
              FY2022\u201323 to FY2024\u201325
            </span>
          </div>
        </div>

        {/* Glow */}
        <div
          className="absolute -inset-10 -z-10 blur-3xl opacity-20 pointer-events-none"
          style={{
            background: `radial-gradient(ellipse at center, ${SPECTRAL.cyan}15, transparent 70%)`,
          }}
          aria-hidden="true"
        />

        <figcaption className="sr-only">
          Product dashboard showing sample tax analysis with charts, metrics, and findings
        </figcaption>
      </figure>
    </motion.div>
  )
}
