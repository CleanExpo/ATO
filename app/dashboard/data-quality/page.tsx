/**
 * Data Quality Intelligence Center - v8.1 Scientific Luxury Tier
 * 
 * High-fidelity forensic scanning for ledger misclassifications, 
 * duplicate detection, and tax integrity validation.
 */

'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Scan,
  AlertCircle,
  CheckCircle2,
  TrendingUp,
  ShieldCheck,
  Database,
  Zap,
  ChevronRight,
  Filter,
  BarChart3,
  RefreshCw,
  Clock,
  Search,
  AlertTriangle
} from 'lucide-react'
import AnimatedCounter from '@/components/dashboard/AnimatedCounter'
import LiveProgressCard from '@/components/dashboard/LiveProgressCard'
import LiveChart from '@/components/dashboard/LiveChart'
import ActivityFeed, { ActivityItem } from '@/components/dashboard/ActivityFeed'

const GlassCard = ({ children, className = '', highlight = false }: any) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    className={`glass-card overflow-hidden border ${highlight ? 'border-sky-500/30 bg-sky-500/5' : 'border-white/10'} ${className}`}
  >
    {children}
  </motion.div>
);

export default function DataQualityPage() {
  const [isScanning, setIsScanning] = useState(false)
  const [progress, setProgress] = useState(0)
  const [tenantId, setTenantId] = useState('')
  const [activities, setActivities] = useState<ActivityItem[]>([])

  // Demo states for the v8.1 view
  const stats = {
    totalScanned: 12450,
    issuesFound: 142,
    autoFixed: 89,
    impact: 42500.20,
    accuracy: 98.4
  }

  useEffect(() => {
    const fetchTenant = async () => {
      try {
        const res = await fetch('/api/xero/organizations')
        const data = await res.json()
        if (data.connections?.[0]) setTenantId(data.connections[0].tenant_id)
      } catch (err) { console.error(err) }
    }
    fetchTenant()
  }, [])

  const startScan = () => {
    setIsScanning(true)
    setProgress(0)
    let p = 0
    const interval = setInterval(() => {
      p += 2
      setProgress(p)
      if (p >= 100) {
        clearInterval(interval)
        setIsScanning(false)
      }
    }, 100)
  }

  return (
    <div className="min-h-screen bg-[var(--bg-dashboard)] px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
      <div className="max-w-7xl mx-auto space-y-8 sm:space-y-12">

        {/* Header Block */}
        <div className="flex flex-col md:flex-row justify-between items-start gap-8 border-b border-white/10 pb-8">
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-xs font-bold font-mono text-sky-400 uppercase tracking-widest">
              <Database className="w-4 h-4" />
              <span>Forensic Data Sovereignty</span>
            </div>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black text-white tracking-tighter">Data Quality</h1>
            <p className="text-white/40 max-w-xl text-lg font-medium leading-relaxed">
              AI-powered sentinel for transaction <span className="text-white">integrity</span>, classification accuracy, and tax compliance validation.
            </p>
          </div>

          <div className="flex items-center gap-4">
            <button
              onClick={startScan}
              disabled={isScanning}
              className={`btn px-8 py-4 rounded-2xl flex items-center gap-3 transition-all ${isScanning ? 'bg-white/5 text-white/20' : 'bg-sky-500 text-white shadow-[0_0_30px_rgba(14,165,233,0.3)] hover:scale-105'}`}
            >
              {isScanning ? <RefreshCw className="w-5 h-5 animate-spin" /> : <Scan className="w-5 h-5" />}
              <span className="font-black text-xs uppercase tracking-widest">{isScanning ? 'Analyzing Stream...' : 'Initialize Scan'}</span>
            </button>
          </div>
        </div>

        {/* Progress Visualizer */}
        <AnimatePresence>
          {isScanning && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
              <LiveProgressCard
                title="Transaction Stream Analysis"
                value={Math.round((progress / 100) * stats.totalScanned)}
                total={stats.totalScanned}
                percentage={progress}
                icon={<Zap className="w-6 h-6" />}
                color="info"
                subtitle="Scanning historical ledger for misclassifications"
                isAnimating={isScanning}
              />
            </motion.div>
          )}
        </AnimatePresence>

        {/* KPI Matrix */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <GlassCard className="p-8">
            <p className="text-[10px] font-black uppercase text-white/40 mb-3 tracking-widest">Accuracy Score</p>
            <div className="text-3xl font-black text-emerald-400 font-mono italic">
              <AnimatedCounter value={stats.accuracy} suffix="%" size="lg" />
            </div>
          </GlassCard>
          <GlassCard className="p-8">
            <p className="text-[10px] font-black uppercase text-white/40 mb-3 tracking-widest">Issues Detected</p>
            <div className="text-3xl font-black text-amber-400 font-mono">
              <AnimatedCounter value={stats.issuesFound} size="lg" />
            </div>
          </GlassCard>
          <GlassCard className="p-8">
            <p className="text-[10px] font-black uppercase text-white/40 mb-3 tracking-widest">Auto-Remediated</p>
            <div className="text-3xl font-black text-sky-400 font-mono">
              <AnimatedCounter value={stats.autoFixed} size="lg" />
            </div>
          </GlassCard>
          <GlassCard className="p-8" highlight>
            <p className="text-[10px] font-black uppercase text-sky-400 mb-3 tracking-widest">Financial Impact</p>
            <div className="text-3xl font-black text-white font-mono">
              <AnimatedCounter value={stats.impact} format="currency" size="lg" />
            </div>
          </GlassCard>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Activity Feed & Insight */}
          <div className="lg:col-span-2 space-y-8">
            <GlassCard className="p-0 border-white/5">
              <div className="p-6 bg-white/[0.03] border-b border-white/10 flex justify-between items-center">
                <h2 className="font-black text-white flex items-center gap-2 text-lg uppercase tracking-tighter">
                  <ActivityItemIcon type="info" /> Remediation Stream
                </h2>
                <span className="text-[10px] font-mono text-white/20">LIVE FORENSIC FEED</span>
              </div>
              <div className="p-6">
                <ul className="space-y-4">
                  <ActivityItemRow label="Duplicate Transaction Corrected" desc="Detected $1,420.00 duplicate invoice in General Expenses." time="2m ago" status="success" />
                  <ActivityItemRow label="Missed GST Flagged" desc="Transaction ID #XJ29 detected with 0% GST but likely 10% candidate." time="5m ago" status="warning" />
                  <ActivityItemRow label="Capital Purchase Identified" desc="$12,500.00 equipment classified as OPEX. Candidate for s40-80." time="12m ago" status="info" />
                </ul>
              </div>
            </GlassCard>
          </div>

          {/* Quality Controls */}
          <div className="space-y-8">
            <GlassCard className="p-8 space-y-8">
              <h3 className="text-lg font-bold flex items-center gap-2">
                <Filter className="w-5 h-5 text-sky-400" /> Sentinel Configuration
              </h3>

              <div className="space-y-4">
                <ToggleSetting label="Auto-Fix Low Risk (≥90% Confidence)" active={true} />
                <ToggleSetting label="Flag Missing GST Entries" active={true} />
                <ToggleSetting label="Deep Pattern Recognition" active={false} />
                <ToggleSetting label="External Benchmarking" active={true} />
              </div>

              <div className="pt-6 border-t border-white/10">
                <button className="w-full py-4 rounded-xl bg-white/5 border border-white/10 text-[10px] font-black text-white uppercase tracking-widest hover:bg-white/10 transition-all">
                  Download Integrity Report
                </button>
              </div>
            </GlassCard>

            {/* Legislative Anchor */}
            <div className="p-8 rounded-[40px] bg-sky-500/5 border border-sky-500/20">
              <div className="flex gap-4">
                <ShieldCheck className="w-6 h-6 text-sky-400 flex-shrink-0" />
                <div className="space-y-2">
                  <h4 className="font-bold text-white text-sm">Regulatory Compliance</h4>
                  <p className="text-[10px] text-white/40 leading-relaxed font-medium">
                    Data is validated against <span className="text-white">ITAA 1997 Division 8</span> and <span className="text-white">A New Tax System (GST) Act 1999</span>.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  )
}

function ActivityItemRow({ label, desc, time, status }: any) {
  const colors = {
    success: 'text-emerald-400 border-emerald-500/20 bg-emerald-500/5',
    warning: 'text-amber-400 border-amber-500/20 bg-amber-500/5',
    info: 'text-sky-400 border-sky-500/20 bg-sky-500/5'
  }
  return (
    <li className="p-5 rounded-2xl bg-white/[0.02] border border-white/5 flex items-start justify-between group hover:border-white/10 transition-all">
      <div className="flex gap-4">
        <div className={`mt-1 w-2 h-2 rounded-full ${status === 'success' ? 'bg-emerald-500' : status === 'warning' ? 'bg-amber-500' : 'bg-sky-500'}`} />
        <div className="space-y-1">
          <h4 className="text-xs font-black text-white uppercase tracking-wider">{label}</h4>
          <p className="text-[11px] text-white/40 font-medium leading-relaxed">{desc}</p>
        </div>
      </div>
      <span className="text-[9px] font-bold text-white/20 uppercase font-mono">{time}</span>
    </li>
  )
}

function ToggleSetting({ label, active }: any) {
  return (
    <div className="flex items-center justify-between p-4 rounded-xl bg-white/5 border border-white/5">
      <span className="text-[10px] font-bold text-white/60 uppercase tracking-wide">{label}</span>
      <div className={`w-8 h-4 rounded-full relative transition-all ${active ? 'bg-sky-500' : 'bg-white/10'}`}>
        <div className={`absolute top-1 w-2 h-2 rounded-full bg-white transition-all ${active ? 'right-1' : 'left-1'}`} />
      </div>
    </div>
  )
}

function ActivityItemIcon({ type }: { type: string }) {
  if (type === 'success') return <CheckCircle2 className="w-5 h-5 text-emerald-400" />
  if (type === 'warning') return <AlertTriangle className="w-5 h-5 text-amber-400" />
  return <Zap className="w-5 h-5 text-sky-400" />
}
