/**
 * Tax Reporting Dashboard
 *
 * Displays:
 * - Quarterly tax summaries (GST, PAYG)
 * - Obligation tracking (BAS, Annual Returns, STP)
 * - Deadline reminders and alerts
 * - Compliance status overview
 */

'use client'

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Calendar,
  AlertTriangle,
  CheckCircle,
  Clock,
  FileText,
  DollarSign,
  TrendingUp,
  TrendingDown,
  AlertCircle,
  RefreshCw
} from 'lucide-react';
import AnimatedCounter from '@/components/dashboard/AnimatedCounter';

interface QuarterlySummary {
  quarter: string;
  gstCollected: number;
  gstPaid: number;
  payg: number;
  netPosition: number;
  transactionCount: number;
}

interface TaxObligation {
  id: string;
  type: 'BAS' | 'PAYG' | 'ANNUAL_RETURN' | 'STP';
  period: string;
  dueDate: string;
  status: 'OVERDUE' | 'DUE_SOON' | 'UPCOMING' | 'LODGED' | 'NOT_DUE';
  amount?: number;
  description: string;
  priority: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
}

interface ComplianceStatus {
  overdue: number;
  dueSoon: number;
  upcoming: number;
  total: number;
  complianceRate: number;
  status: 'AT_RISK' | 'WARNING' | 'COMPLIANT';
}

interface TaxReportingData {
  financialYear: string;
  quarterlySummaries: QuarterlySummary[];
  obligations: TaxObligation[];
  complianceStatus: ComplianceStatus;
  upcomingDeadlines: TaxObligation[];
  generatedAt: string;
}

export default function TaxReportingDashboard() {
  const [data, setData] = useState<TaxReportingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tenantId, setTenantId] = useState<string | null>(null);

  // Fetch tenant ID from Xero connections
  useEffect(() => {
    async function fetchTenantId() {
      try {
        const response = await fetch('/api/xero/organizations');
        const data = await response.json();

        if (data.connections && data.connections.length > 0) {
          setTenantId(data.connections[0].tenant_id);
        } else {
          setError('No Xero connections found. Please connect your Xero account first.');
        }
      } catch (err) {
        console.error('Failed to fetch tenant ID:', err);
        setError('Failed to load Xero connection');
      }
    }

    fetchTenantId();
  }, []);

  // Fetch tax obligations data
  useEffect(() => {
    async function fetchData() {
      if (!tenantId) return;

      try {
        setLoading(true);
        setError(null);

        const response = await fetch(`/api/tax-obligations?tenantId=${tenantId}`);
        const result = await response.json();

        if (!response.ok) {
          throw new Error(result.error || 'Failed to fetch tax obligations');
        }

        setData(result.data);
      } catch (err: any) {
        console.error('Error fetching tax obligations:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [tenantId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="loading-spinner mx-auto mb-4" />
          <p className="text-[var(--text-secondary)]">Loading tax reporting data...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="glass-card p-8 max-w-md text-center">
          <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-[var(--text-primary)] mb-2">Error</h2>
          <p className="text-[var(--text-secondary)] mb-4">{error}</p>
          {error.includes('Xero') && (
            <Link href="/api/auth/xero" className="btn btn-primary">
              Connect Xero
            </Link>
          )}
        </div>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="min-h-screen p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-[var(--text-primary)] mb-2">
            Tax Reporting Dashboard
          </h1>
          <p className="text-[var(--text-secondary)]">
            {data.financialYear} • Compliance tracking and deadlines
          </p>
        </div>

        {/* Compliance Status Hero */}
        <div className={`glass-card p-8 mb-8 border-l-4 ${
          data.complianceStatus.status === 'COMPLIANT' ? 'border-l-emerald-500 bg-emerald-500/5' :
          data.complianceStatus.status === 'WARNING' ? 'border-l-amber-500 bg-amber-500/5' :
          'border-l-red-500 bg-red-500/5'
        }`}>
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-3 mb-2">
                {data.complianceStatus.status === 'COMPLIANT' ? (
                  <CheckCircle className="w-8 h-8 text-emerald-400" />
                ) : data.complianceStatus.status === 'WARNING' ? (
                  <Clock className="w-8 h-8 text-amber-400" />
                ) : (
                  <AlertTriangle className="w-8 h-8 text-red-400" />
                )}
                <h2 className="text-2xl font-bold">
                  {data.complianceStatus.status === 'COMPLIANT' ? 'Fully Compliant' :
                   data.complianceStatus.status === 'WARNING' ? 'Action Required Soon' :
                   'Overdue Obligations'}
                </h2>
              </div>
              <p className="text-[var(--text-secondary)]">
                {data.complianceStatus.overdue} overdue • {data.complianceStatus.dueSoon} due soon • {data.complianceStatus.upcoming} upcoming
              </p>
            </div>
            <div className="text-right">
              <div className="text-4xl font-bold text-[var(--text-primary)]">
                {data.complianceStatus.complianceRate}%
              </div>
              <div className="text-sm text-[var(--text-muted)]">Compliance Rate</div>
            </div>
          </div>
        </div>

        {/* Upcoming Deadlines */}
        {data.upcomingDeadlines.length > 0 && (
          <div className="glass-card mb-8">
            <div className="p-6 border-b border-[var(--border-default)]">
              <h3 className="text-xl font-semibold text-[var(--text-primary)]">
                Upcoming Deadlines
              </h3>
            </div>
            <div className="divide-y divide-[var(--border-default)]">
              {data.upcomingDeadlines.map(obligation => (
                <div key={obligation.id} className="p-6 flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                      obligation.status === 'OVERDUE' ? 'bg-red-500/10' :
                      obligation.status === 'DUE_SOON' ? 'bg-amber-500/10' :
                      'bg-sky-500/10'
                    }`}>
                      {getObligationIcon(obligation.type)}
                    </div>
                    <div>
                      <div className="font-semibold text-[var(--text-primary)]">
                        {obligation.description}
                      </div>
                      <div className="text-sm text-[var(--text-muted)]">
                        {obligation.period}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className={`text-sm font-semibold mb-1 ${
                      obligation.status === 'OVERDUE' ? 'text-red-400' :
                      obligation.status === 'DUE_SOON' ? 'text-amber-400' :
                      'text-[var(--text-primary)]'
                    }`}>
                      {formatDeadlineStatus(obligation.dueDate, obligation.status)}
                    </div>
                    {obligation.amount !== undefined && (
                      <div className="text-sm text-[var(--text-muted)]">
                        Est. ${obligation.amount.toLocaleString()}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Quarterly Summaries */}
        <div className="mb-8">
          <h3 className="text-xl font-semibold text-[var(--text-primary)] mb-4">
            Quarterly GST Summaries
          </h3>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {data.quarterlySummaries.map(summary => (
              <div key={summary.quarter} className="glass-card p-6">
                <div className="text-sm font-semibold text-[var(--text-muted)] mb-4">
                  {summary.quarter}
                </div>

                <div className="space-y-3 mb-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-[var(--text-secondary)]">GST Collected</span>
                    <span className="font-semibold text-emerald-400">
                      ${summary.gstCollected.toLocaleString()}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-[var(--text-secondary)]">GST Paid</span>
                    <span className="font-semibold text-sky-400">
                      ${summary.gstPaid.toLocaleString()}
                    </span>
                  </div>
                  {summary.payg > 0 && (
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-[var(--text-secondary)]">PAYG</span>
                      <span className="font-semibold text-amber-400">
                        ${summary.payg.toLocaleString()}
                      </span>
                    </div>
                  )}
                </div>

                <div className="pt-3 border-t border-[var(--border-default)]">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold">Net Position</span>
                    <div className="flex items-center gap-2">
                      {summary.netPosition > 0 ? (
                        <TrendingUp className="w-4 h-4 text-emerald-400" />
                      ) : (
                        <TrendingDown className="w-4 h-4 text-red-400" />
                      )}
                      <span className={`font-bold ${
                        summary.netPosition > 0 ? 'text-emerald-400' : 'text-red-400'
                      }`}>
                        ${Math.abs(summary.netPosition).toLocaleString()}
                      </span>
                    </div>
                  </div>
                  <div className="text-xs text-[var(--text-muted)] mt-1">
                    {summary.transactionCount} transactions
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* All Obligations */}
        <div className="glass-card">
          <div className="p-6 border-b border-[var(--border-default)]">
            <h3 className="text-xl font-semibold text-[var(--text-primary)]">
              All Tax Obligations
            </h3>
          </div>
          <div className="divide-y divide-[var(--border-default)]">
            {data.obligations.map(obligation => (
              <div key={obligation.id} className="p-4 flex items-center justify-between hover:bg-white/5 transition-colors">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                    obligation.priority === 'CRITICAL' ? 'bg-red-500/10' :
                    obligation.priority === 'HIGH' ? 'bg-amber-500/10' :
                    'bg-sky-500/10'
                  }`}>
                    {getObligationIcon(obligation.type)}
                  </div>
                  <div>
                    <div className="font-medium text-[var(--text-primary)]">
                      {obligation.type}
                    </div>
                    <div className="text-sm text-[var(--text-muted)]">
                      {obligation.period}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-sm text-[var(--text-secondary)]">
                    {new Date(obligation.dueDate).toLocaleDateString('en-AU', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric'
                    })}
                  </div>
                  <div className={`px-3 py-1 rounded-full text-xs font-semibold ${
                    obligation.status === 'OVERDUE' ? 'bg-red-500/20 text-red-400' :
                    obligation.status === 'DUE_SOON' ? 'bg-amber-500/20 text-amber-400' :
                    obligation.status === 'UPCOMING' ? 'bg-sky-500/20 text-sky-400' :
                    'bg-emerald-500/20 text-emerald-400'
                  }`}>
                    {obligation.status.replace('_', ' ')}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function getObligationIcon(type: string) {
  switch (type) {
    case 'BAS':
      return <FileText className="w-5 h-5 text-sky-400" />;
    case 'PAYG':
      return <DollarSign className="w-5 h-5 text-amber-400" />;
    case 'ANNUAL_RETURN':
      return <Calendar className="w-5 h-5 text-purple-400" />;
    case 'STP':
      return <RefreshCw className="w-5 h-5 text-emerald-400" />;
    default:
      return <FileText className="w-5 h-5 text-[var(--text-muted)]" />;
  }
}

function formatDeadlineStatus(dueDate: string, status: string): string {
  const date = new Date(dueDate);
  const today = new Date();
  const daysUntil = Math.floor((date.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

  if (status === 'OVERDUE') {
    return `${Math.abs(daysUntil)} days overdue`;
  } else if (status === 'DUE_SOON') {
    return `Due in ${daysUntil} days`;
  } else {
    return date.toLocaleDateString('en-AU', {
      day: 'numeric',
      month: 'short'
    });
  }
}
