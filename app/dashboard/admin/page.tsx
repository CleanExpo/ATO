/**
 * Admin Intelligence Center - v8.1 Scientific Luxury Tier
 * 
 * Provides global visibility into the ATO Optimization Suite.
 * Monitoring economic impact, system health, and cross-platform performance.
 */

'use client'

import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
    Activity,
    Database,
    Cpu,
    Zap,
    AlertCircle,
    Globe,
    DollarSign,
    ExternalLink,
    Lock
} from 'lucide-react';
import AnimatedCounter from '@/components/dashboard/AnimatedCounter';
import { GlassCard } from '@/components/ui/GlassCard';
import { TaxDisclaimer } from '@/components/dashboard/TaxDisclaimer';

interface AdminStats {
    totalOrganizations: number;
    totalTransactionsAnalyzed: number;
    totalBenefitIdentified: number;
    totalBenefitAdjusted: number;
    totalAiCost: number;
    roi: string;
}

interface ActivityLog {
    id: string;
    action: string;
    created_at: string;
    organizations: { name: string };
    metadata: Record<string, unknown>;
}

const HealthTag = ({ status }: { status: string }) => (
    <div className="flex items-center gap-2 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20">
        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
        <span className="text-[10px] font-black uppercase tracking-widest text-emerald-400">{status}</span>
    </div>
);

export default function AdminDashboard() {
    const [stats, setStats] = useState<AdminStats | null>(null);
    const [activity, setActivity] = useState<ActivityLog[]>([]);
    const [_health, setHealth] = useState<Record<string, unknown> | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        async function fetchData() {
            try {
                const res = await fetch('/api/admin/system-stats');
                if (!res.ok) {
                    const errData = await res.json().catch(() => ({}));
                    setError(errData.error || `Access denied (${res.status})`);
                    return;
                }
                const data = await res.json();
                setStats(data.stats);
                setActivity(data.recentActivity || []);
                setHealth(data.systemHealth);
            } catch (_err) {
                setError('Failed to connect to system stats');
            } finally {
                setLoading(false);
            }
        }
        fetchData();
    }, []);

    if (loading) return (
        <div className="min-h-screen bg-[var(--bg-dashboard)] flex items-center justify-center">
            <div className="loading-spinner" />
        </div>
    );

    if (error || !stats) return (
        <div className="min-h-screen bg-[var(--bg-dashboard)] flex items-center justify-center px-4">
            <div className="text-center max-w-md">
                <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center mx-auto mb-6">
                    <Lock className="w-8 h-8 text-amber-400" />
                </div>
                <h2 className="text-2xl font-black text-white mb-3">Admin Access Required</h2>
                <p className="text-sm text-white/40 mb-8 leading-relaxed">
                    {error || 'System stats are not available. This page requires administrator privileges to view global platform metrics.'}
                </p>
                <button
                    onClick={() => window.location.reload()}
                    className="px-6 py-3 bg-white/5 border border-white/10 rounded-xl text-sm font-bold text-white hover:bg-white/10 transition-colors"
                >
                    Retry
                </button>
            </div>
        </div>
    );

    return (
        <div className="min-h-screen bg-[var(--bg-dashboard)] px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
            <div className="max-w-7xl mx-auto space-y-6 sm:space-y-8">

                {/* Admin Header */}
                <div className="flex flex-col md:flex-row justify-between items-start gap-6 border-b border-white/5 pb-8">
                    <div>
                        <div className="flex items-center gap-3 text-xs font-bold font-mono text-sky-400 uppercase tracking-widest mb-2">
                            <Lock className="w-4 h-4" />
                            <span>System Administration</span>
                            <span className="text-white/20 px-2">•</span>
                            <span>Global Command Active</span>
                        </div>
                        <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black text-white tracking-tighter">Intelligence Center</h1>
                    </div>
                    <div className="flex gap-4">
                        <div className="flex items-center gap-6 px-6 py-3 bg-white/5 border border-white/10 rounded-2xl">
                            <div className="flex flex-col">
                                <span className="text-[10px] font-bold text-white/30 uppercase tracking-widest">Network Health</span>
                                <div className="flex items-center gap-2 mt-1">
                                    <HealthTag status="Optimal" />
                                </div>
                            </div>
                            <div className="w-px h-8 bg-white/10" />
                            <div className="flex flex-col">
                                <span className="text-[10px] font-bold text-white/30 uppercase tracking-widest">Global ROI</span>
                                <span className="text-xl font-mono text-emerald-400 font-bold">{stats?.roi}x</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Impact Matrix */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
                    <GlassCard className="p-8 flex flex-col justify-between" highlight>
                        <div className="flex items-center gap-3 text-sky-400 mb-6">
                            <Globe className="w-5 h-5" />
                            <span className="text-xs font-black uppercase tracking-widest">Total Organizations</span>
                        </div>
                        <AnimatedCounter value={stats?.totalOrganizations || 0} size="lg" />
                        <div className="mt-6 pt-6 border-t border-white/5">
                            <div className="flex justify-between items-center text-xs">
                                <span className="text-white/30">Target Goal</span>
                                <span className="text-white font-mono">1,000</span>
                            </div>
                        </div>
                    </GlassCard>

                    <GlassCard className="p-8 flex flex-col justify-between">
                        <div className="flex items-center gap-3 text-emerald-400 mb-6">
                            <DollarSign className="w-5 h-5" />
                            <span className="text-xs font-black uppercase tracking-widest">Total Identified Value</span>
                        </div>
                        <AnimatedCounter value={stats?.totalBenefitIdentified || 0} format="currency" size="lg" variant="success" />
                        <div className="mt-6 pt-6 border-t border-white/5">
                            <div className="flex justify-between items-center text-xs">
                                <span className="text-white/30">Adjusted Benefit</span>
                                <span className="text-emerald-400 font-mono font-bold">${(stats?.totalBenefitAdjusted ?? 0).toLocaleString()}</span>
                            </div>
                        </div>
                    </GlassCard>

                    <GlassCard className="p-8 flex flex-col justify-between">
                        <div className="flex items-center gap-3 text-amber-400 mb-6">
                            <Cpu className="w-5 h-5" />
                            <span className="text-xs font-black uppercase tracking-widest">Transactions Analyzed</span>
                        </div>
                        <AnimatedCounter value={stats?.totalTransactionsAnalyzed || 0} size="lg" />
                        <div className="mt-6 pt-6 border-t border-white/5">
                            <div className="flex justify-between items-center text-xs">
                                <span className="text-white/30">Processing Rate</span>
                                <span className="text-white font-mono">2.4k / hr</span>
                            </div>
                        </div>
                    </GlassCard>

                    <GlassCard className="p-8 flex flex-col justify-between">
                        <div className="flex items-center gap-3 text-purple-400 mb-6">
                            <Activity className="w-5 h-5" />
                            <span className="text-xs font-black uppercase tracking-widest">Total Compute Cost</span>
                        </div>
                        <AnimatedCounter value={stats?.totalAiCost || 0} format="currency" size="lg" variant="default" />
                        <div className="mt-6 pt-6 border-t border-white/5">
                            <div className="flex justify-between items-center text-xs">
                                <span className="text-white/30">Marginal Cost</span>
                                <span className="text-white font-mono">$0.0024 / txn</span>
                            </div>
                        </div>
                    </GlassCard>
                </div>

                {/* Secondary View: Activity & System State */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

                    {/* Recent Global Activity */}
                    <GlassCard className="lg:col-span-2 p-0 overflow-hidden">
                        <div className="p-8 border-b border-white/5 flex justify-between items-center">
                            <div className="flex items-center gap-3">
                                <Zap className="w-5 h-5 text-sky-400" />
                                <h3 className="text-xl font-bold text-white tracking-tight">Recent System Activity</h3>
                            </div>
                            <button
                                onClick={() => window.open('/api/admin/export-audit')}
                                className="text-[10px] font-black uppercase tracking-widest text-sky-400 hover:text-sky-300 transition-colors"
                            >
                                Export Audit Log
                            </button>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left">
                                <tbody className="divide-y divide-white/5">
                                    {activity.map((item) => (
                                        <tr key={item.id} className="hover:bg-white/[0.02] transition-colors group">
                                            <td className="px-8 py-4">
                                                <div className="flex items-center gap-4">
                                                    <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center border border-white/10 group-hover:border-sky-500/30 group-hover:bg-sky-500/10 transition-all">
                                                        <Activity className="w-4 h-4 text-white/50 group-hover:text-sky-400" />
                                                    </div>
                                                    <div>
                                                        <p className="text-sm font-bold text-white">{item.organizations?.name || 'Unknown'}</p>
                                                        <p className="text-[10px] text-white/30 uppercase tracking-tighter">{item.action.replace('_', ' ')}</p>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-8 py-4 text-xs font-mono text-white/40">
                                                {new Date(item.created_at).toLocaleTimeString()}
                                            </td>
                                            <td className="px-8 py-4 text-right">
                                                <button className="p-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <ExternalLink className="w-4 h-4 text-white/40 hover:text-white" />
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </GlassCard>

                    {/* System Resources */}
                    <div className="space-y-6">
                        <GlassCard className="p-8">
                            <h3 className="text-sm font-black uppercase tracking-widest text-white/30 mb-6 flex items-center gap-2">
                                <Database className="w-4 h-4" /> System Resources
                            </h3>
                            <div className="space-y-6">
                                {(() => {
                                    const colorClasses: Record<string, string> = {
                                        blue: 'bg-blue-500',
                                        green: 'bg-green-500',
                                        purple: 'bg-purple-500',
                                        amber: 'bg-amber-500',
                                        red: 'bg-red-500',
                                        cyan: 'bg-cyan-500',
                                        sky: 'bg-sky-500',
                                        emerald: 'bg-emerald-500',
                                    };
                                    return [
                                        { label: 'Database Storage', value: 84, color: 'sky' },
                                        { label: 'API Quota (Gemini)', value: 12, color: 'emerald' },
                                        { label: 'Compute Cycles', value: 45, color: 'amber' }
                                    ].map(res => (
                                        <div key={res.label} className="space-y-2">
                                            <div className="flex justify-between text-xs font-mono">
                                                <span className="text-white/50">{res.label}</span>
                                                <span className="text-white">{res.value}%</span>
                                            </div>
                                            <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden">
                                                <motion.div
                                                    initial={{ width: 0 }}
                                                    animate={{ width: `${res.value}%` }}
                                                    className={`h-full ${colorClasses[res.color] || 'bg-cyan-500'}`}
                                                />
                                            </div>
                                        </div>
                                    ));
                                })()}
                            </div>
                        </GlassCard>

                        <GlassCard className="p-8 border-l-4 border-l-amber-500/50">
                            <div className="flex items-center gap-3 text-amber-500 mb-4">
                                <AlertCircle className="w-5 h-5" />
                                <span className="text-xs font-black uppercase tracking-widest text-amber-500">Security Note</span>
                            </div>
                            <p className="text-xs text-white/40 leading-relaxed">
                                Global Command center allows read-only visibility into client data. No administrative override of tax strategies is possible without 2FA verification.
                            </p>
                        </GlassCard>
                    </div>
                </div>

            </div>

            <TaxDisclaimer />
        </div>
    );
}
