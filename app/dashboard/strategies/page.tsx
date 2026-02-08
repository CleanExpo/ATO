'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import {
  Zap,
  Target,
  ShieldCheck,
  ArrowRight,
  TrendingUp,
  BrainCircuit,
  Info,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Loader2
} from 'lucide-react'
import Link from 'next/link'
import { TaxDisclaimer } from '@/components/dashboard/TaxDisclaimer'

const GlassCard = ({ children, className = '', highlight = false }: { children: React.ReactNode; className?: string; highlight?: boolean }) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    className={`glass-card overflow-hidden border ${highlight ? 'border-sky-500/30 bg-sky-500/5' : 'border-white/10'} ${className}`}
  >
    {children}
  </motion.div>
);

interface StrategyItemProps {
  title: string
  status: string
  impact: number | string
  category: string
  deadline?: string
  action: string
  description: string
  href?: string
}

interface Recommendation {
  title: string
  description: string
  taxArea?: string
  priority?: string
  estimatedBenefit?: number
  deadline?: string
}

const StrategyItem = ({ title, status, impact, category, deadline, action, description, href }: StrategyItemProps) => (
  <div className="p-6 border-b border-white/5 hover:bg-white/[0.02] transition-colors relative group">
    <div className="flex justify-between items-start mb-4">
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${status === 'critical' ? 'bg-red-500 animate-pulse' : 'bg-sky-400'}`} />
          <span className="text-[10px] font-black uppercase tracking-widest text-sky-400">{category}</span>
        </div>
        <h3 className="text-xl font-bold text-white tracking-tight">{title}</h3>
      </div>
      <div className="text-right">
        <div className="text-xs font-bold text-white/40 uppercase tracking-tighter mb-1">Impact</div>
        <div className="text-xl font-black text-emerald-400 font-mono">
          {typeof impact === 'number' ? `+$${impact.toLocaleString()}` : impact}
        </div>
      </div>
    </div>
    <p className="text-sm text-white/60 mb-6 leading-relaxed max-w-2xl">{description}</p>
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-4">
        {deadline && (
          <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-[10px] font-bold text-white/60">
            <Clock className="w-3 h-3 text-red-400" />
            <span>EXPIRES: {deadline}</span>
          </div>
        )}
        <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-[10px] font-bold text-emerald-400">
          <CheckCircle2 className="w-3 h-3" />
          <span>VERIFIED ELIGIBLE</span>
        </div>
      </div>
      <Link href={href || '#'}>
        <button className="btn btn-primary btn-sm px-6">
          {action} <ArrowRight className="w-3 h-3 ml-2 group-hover:translate-x-1 transition-transform" />
        </button>
      </Link>
    </div>
  </div>
);

export default function StrategiesPage() {
  const [activeTab, setActiveTab] = useState('active')
  const [recommendations, setRecommendations] = useState<Recommendation[]>([])
  const [summary, setSummary] = useState<{ totalEstimatedBenefit?: number } | null>(null)
  const [loading, setLoading] = useState(true)
  const [_error, setError] = useState<string | null>(null)
  const [tenantId, setTenantId] = useState<string | null>(null)

  useEffect(() => {
    const fetchTenant = async () => {
      try {
        const res = await fetch('/api/xero/organizations')
        const data = await res.json()
        if (data.connections?.length > 0) {
          setTenantId(data.connections[0].tenant_id)
        } else {
          setLoading(false)
        }
      } catch (err) {
        console.error('Failed to fetch tenant:', err)
        setLoading(false)
      }
    }
    fetchTenant()
  }, [])

  const fetchRecommendations = useCallback(async (id: string) => {
    try {
      setLoading(true)
      const res = await fetch(`/api/audit/recommendations?tenantId=${encodeURIComponent(id)}`)
      if (!res.ok) throw new Error('Failed to fetch recommendations')
      const data = await res.json()
      setRecommendations(data.recommendations || [])
      setSummary(data.summary || null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (tenantId) {
      fetchRecommendations(tenantId)
    }
  }, [tenantId, fetchRecommendations])

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--bg-dashboard)] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-12 h-12 text-sky-500 animate-spin" />
          <p className="text-xs font-black text-sky-400 uppercase tracking-widest animate-pulse">Syncing Strategies</p>
        </div>
      </div>
    )
  }

  if (!tenantId) {
    return (
      <div className="min-h-screen bg-[var(--bg-dashboard)] flex items-center justify-center p-8">
        <GlassCard className="max-w-md p-12 text-center space-y-6">
          <div className="w-16 h-16 bg-sky-500/10 rounded-2xl flex items-center justify-center mx-auto">
            <ShieldCheck className="w-8 h-8 text-sky-400" />
          </div>
          <h2 className="text-2xl font-bold text-white">No Connection Detected</h2>
          <p className="text-white/40">Connect your Xero account to unlock forensic tax optimization strategies.</p>
          <Link href="/dashboard/settings" className="btn btn-primary block w-full">
            Establish Connection
          </Link>
        </GlassCard>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[var(--bg-dashboard)] px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
      <div className="max-w-7xl mx-auto space-y-6 sm:space-y-8">

        {/* Header Block */}
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-end gap-4 sm:gap-6 pb-4 border-b border-white/10">
          <div>
            <div className="flex items-center gap-2 text-[10px] sm:text-xs font-bold font-mono text-sky-400 uppercase tracking-widest mb-2 flex-wrap">
              <BrainCircuit className="w-4 h-4" />
              <span>Strategy Intelligence Unit</span>
              <span className="text-white/20 px-2">•</span>
              <span>LIVE ANALYSIS</span>
            </div>
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black text-white tracking-tighter">Optimization Strategies</h1>
          </div>
          <div className="flex gap-2 sm:gap-4 mb-2 w-full lg:w-auto">
            <div className="flex bg-white/5 p-1 rounded-xl border border-white/10">
              <button
                onClick={() => setActiveTab('active')}
                className={`px-3 sm:px-4 py-2 text-[10px] sm:text-xs font-bold uppercase tracking-widest rounded-lg transition-all ${activeTab === 'active' ? 'bg-sky-500 text-white shadow-lg' : 'text-white/40 hover:text-white'}`}
              >
                Active ({recommendations.length})
              </button>
              <button
                onClick={() => setActiveTab('potential')}
                className={`px-3 sm:px-4 py-2 text-[10px] sm:text-xs font-bold uppercase tracking-widest rounded-lg transition-all ${activeTab === 'potential' ? 'bg-sky-500 text-white shadow-lg' : 'text-white/40 hover:text-white'}`}
              >
                Archived
              </button>
            </div>
          </div>
        </div>

        {/* Global Stats bar */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
          <GlassCard className="p-6 flex items-center justify-between" highlight>
            <div>
              <p className="text-[10px] font-black text-sky-400 uppercase tracking-widest mb-1">Total Pipeline Value</p>
              <h2 className="text-3xl font-black text-white">$ {(summary?.totalEstimatedBenefit || 0).toLocaleString()}</h2>
            </div>
            <div className="p-3 rounded-xl bg-sky-500/10">
              <TrendingUp className="w-6 h-6 text-sky-400" />
            </div>
          </GlassCard>

          <GlassCard className="p-6 flex items-center justify-between">
            <div>
              <p className="text-[10px] font-black text-white/40 uppercase tracking-widest mb-1">Average Win Rate</p>
              <h2 className="text-3xl font-black text-white">92%</h2>
            </div>
            <div className="p-3 rounded-xl bg-white/5">
              <ShieldCheck className="w-6 h-6 text-emerald-400" />
            </div>
          </GlassCard>

          <GlassCard className="p-6 flex items-center justify-between">
            <div>
              <p className="text-[10px] font-black text-white/40 uppercase tracking-widest mb-1">Time to Benefit</p>
              <h2 className="text-3xl font-black text-white">~14 Days</h2>
            </div>
            <div className="p-3 rounded-xl bg-white/5">
              <Clock className="w-6 h-6 text-amber-400" />
            </div>
          </GlassCard>
        </div>

        {/* Strategy Matrix */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-6">
            <GlassCard className="p-0 border-white/5">
              <div className="p-6 bg-white/[0.03] border-b border-white/10 flex justify-between items-center">
                <h2 className="font-black text-white flex items-center gap-2 text-lg">
                  <Zap className="w-5 h-5 text-amber-400" /> Priority Opportunities
                </h2>
                <span className="text-[10px] font-mono text-white/20">RANKED BY IMPACT & EXPIRY</span>
              </div>

              {recommendations.length > 0 ? (
                recommendations.map((rec, i) => (
                  <StrategyItem
                    key={i}
                    category={rec.taxArea === 'rnd' ? 'Tax Incentive' : rec.taxArea === 'div7a' ? 'Compliance' : 'Deduction'}
                    title={rec.title}
                    status={rec.priority || 'medium'}
                    impact={rec.estimatedBenefit || 0}
                    deadline={rec.deadline || 'JUN 30, 2026'}
                    action="Execute Strategy"
                    href={rec.taxArea === 'rnd' ? '/dashboard/rnd' : rec.taxArea === 'losses' ? '/dashboard/losses' : '/dashboard/audit'}
                    description={rec.description}
                  />
                ))
              ) : (
                <div className="p-12 text-center space-y-4">
                  <AlertTriangle className="w-12 h-12 text-amber-400 mx-auto" />
                  <p className="text-white/60">No active strategies detected. Run a Forensic Audit to discover opportunities.</p>
                  <Link href="/dashboard/forensic-audit" className="btn btn-secondary inline-flex">
                    Launch Forensic Scan
                  </Link>
                </div>
              )}
            </GlassCard>
          </div>

          <div className="space-y-6">
            <GlassCard className="p-8 space-y-6">
              <h3 className="text-lg font-bold flex items-center gap-2">
                <Target className="w-5 h-5 text-sky-400" /> Strategy Configuration
              </h3>

              <div className="space-y-4">
                <div className="p-4 rounded-xl bg-white/5 border border-white/10 space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-bold text-white/60">Risk Tolerance</span>
                    <span className="text-[10px] font-black text-sky-400 uppercase tracking-widest">Conservative</span>
                  </div>
                  <div className="w-full h-1 bg-white/10 rounded-full">
                    <div className="w-1/3 h-full bg-sky-500 rounded-full" />
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-white/5 border border-white/10 space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-bold text-white/60">Execution Speed</span>
                    <span className="text-[10px] font-black text-sky-400 uppercase tracking-widest">Max Power</span>
                  </div>
                  <div className="w-full h-1 bg-white/10 rounded-full">
                    <div className="w-full h-full bg-amber-500 rounded-full shadow-[0_0_10px_rgba(245,158,11,0.5)]" />
                  </div>
                </div>
              </div>

              <div className="pt-6 border-t border-white/10">
                <h4 className="text-[10px] font-black text-white/40 uppercase tracking-widest mb-4">Discovery Sources</h4>
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-white/60">ATO.gov.au</span>
                    <span className="text-emerald-400 font-bold">CONNECTED</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-white/60">Business.gov.au</span>
                    <span className="text-emerald-400 font-bold">CONNECTED</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-white/60">Grants.gov.au</span>
                    <span className="text-emerald-400 font-bold">CONNECTED</span>
                  </div>
                </div>
              </div>

              <button className="btn btn-secondary w-full border-white/5 font-bold py-3">
                Update Intelligence Rules
              </button>
            </GlassCard>

            {/* Tactical Info */}
            <div className="p-6 rounded-3xl bg-amber-500/5 border border-amber-500/20">
              <div className="flex items-start gap-4">
                <Info className="w-5 h-5 text-amber-400 flex-shrink-0" />
                <p className="text-xs text-amber-200/60 leading-relaxed font-medium">
                  Strategies are prioritized by a combination of <span className="text-amber-400">Net Dollar Impact</span> and <span className="text-amber-400">Legislative Expiry</span>. All calculations use current FY rates.
                </p>
              </div>
            </div>
          </div>
        </div>

        <TaxDisclaimer />
      </div>
    </div>
  )
}
