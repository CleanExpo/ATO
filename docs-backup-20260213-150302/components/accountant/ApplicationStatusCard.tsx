'use client';

/**
 * Application Status Card Component
 *
 * Displays the current status of an accountant application
 */

import { useEffect, useState } from 'react';
import type { ApplicationStatusResponse } from '@/lib/types/accountant';

interface ApplicationStatusCardProps {
  applicationId: string;
  autoRefresh?: boolean; // Auto-refresh every 30 seconds
  refreshInterval?: number; // Milliseconds (default: 30000)
}

export default function ApplicationStatusCard({
  applicationId,
  autoRefresh = false,
  refreshInterval = 30000,
}: ApplicationStatusCardProps) {
  const [status, setStatus] = useState<ApplicationStatusResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStatus = async () => {
    try {
      const response = await fetch(`/api/accountant/application/${applicationId}`);

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || 'Failed to fetch application status');
      }

      const data = await response.json();

      setStatus(data);
      setError(null);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to fetch application status');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();

    if (autoRefresh) {
      const interval = setInterval(fetchStatus, refreshInterval);
      return () => clearInterval(interval);
    }
  }, [applicationId, autoRefresh, refreshInterval]);

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto p-8 bg-white rounded-lg shadow-lg">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-3/4 mb-4"></div>
          <div className="h-4 bg-gray-200 rounded w-full mb-2"></div>
          <div className="h-4 bg-gray-200 rounded w-2/3"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-3xl mx-auto p-8 bg-red-50 border border-red-200 rounded-lg">
        <h2 className="text-xl font-semibold text-red-800 mb-2">Error</h2>
        <p className="text-red-700">{error}</p>
      </div>
    );
  }

  if (!status) {
    return null;
  }

  const { application } = status;

  // Status-specific styling
  const statusConfig = {
    pending: {
      bgColor: 'bg-yellow-50',
      borderColor: 'border-yellow-200',
      textColor: 'text-yellow-800',
      badgeColor: 'bg-yellow-100 text-yellow-800',
      icon: '⏳',
      title: 'Application Pending',
    },
    under_review: {
      bgColor: 'bg-blue-50',
      borderColor: 'border-blue-200',
      textColor: 'text-blue-800',
      badgeColor: 'bg-blue-100 text-blue-800',
      icon: '🔍',
      title: 'Under Review',
    },
    approved: {
      bgColor: 'bg-green-50',
      borderColor: 'border-green-200',
      textColor: 'text-green-800',
      badgeColor: 'bg-green-100 text-green-800',
      icon: '✅',
      title: 'Application Approved',
    },
    rejected: {
      bgColor: 'bg-red-50',
      borderColor: 'border-red-200',
      textColor: 'text-red-800',
      badgeColor: 'bg-red-100 text-red-800',
      icon: '❌',
      title: 'Application Not Approved',
    },
    suspended: {
      bgColor: 'bg-gray-50',
      borderColor: 'border-gray-200',
      textColor: 'text-gray-800',
      badgeColor: 'bg-gray-100 text-gray-800',
      icon: '⛔',
      title: 'Account Suspended',
    },
  };

  const config = statusConfig[application.status];

  return (
    <div className="max-w-3xl mx-auto">
      {/* Main Status Card */}
      <div className={`p-8 ${config.bgColor} border ${config.borderColor} rounded-lg shadow-lg`}>
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-3">
            <span className="text-4xl">{config.icon}</span>
            <div>
              <h1 className={`text-2xl font-bold ${config.textColor}`}>{config.title}</h1>
              <p className="text-sm text-gray-600">
                Application ID: {applicationId.slice(0, 8)}...
              </p>
            </div>
          </div>

          <span
            className={`px-4 py-2 rounded-full text-sm font-semibold ${config.badgeColor}`}
          >
            {application.status.replace('_', ' ').toUpperCase()}
          </span>
        </div>

        {/* Status Message */}
        <div className="mb-6">
          <p className={`text-lg ${config.textColor} mb-4`}>{status.status_message}</p>
          <p className="text-gray-700">{status.next_steps}</p>
        </div>

        {/* Application Details */}
        <div className="mt-8 pt-6 border-t border-gray-300">
          <h3 className="text-lg font-semibold mb-4">Application Details</h3>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-gray-600">Applicant</p>
              <p className="font-semibold">
                {application.first_name} {application.last_name}
              </p>
            </div>

            <div>
              <p className="text-gray-600">Email</p>
              <p className="font-semibold">{application.email}</p>
            </div>

            <div>
              <p className="text-gray-600">Firm</p>
              <p className="font-semibold">{application.firm_name}</p>
            </div>

            <div>
              <p className="text-gray-600">Credential</p>
              <p className="font-semibold">{application.credential_type}</p>
            </div>

            <div>
              <p className="text-gray-600">Submitted</p>
              <p className="font-semibold">
                {new Date(application.created_at).toLocaleDateString('en-AU', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                })}
              </p>
            </div>

            {application.reviewed_at && (
              <div>
                <p className="text-gray-600">Reviewed</p>
                <p className="font-semibold">
                  {new Date(application.reviewed_at).toLocaleDateString('en-AU', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                  })}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Rejection Reason (if rejected) */}
        {application.status === 'rejected' && application.rejection_reason && (
          <div className="mt-6 p-4 bg-red-100 border border-red-300 rounded-lg">
            <h4 className="font-semibold text-red-900 mb-2">Reason for Rejection</h4>
            <p className="text-red-800">{application.rejection_reason}</p>
          </div>
        )}

        {/* Auto-refresh indicator */}
        {autoRefresh && application.status !== 'approved' && application.status !== 'rejected' && (
          <div className="mt-6 text-center">
            <p className="text-xs text-gray-500">
              Auto-refreshing every {refreshInterval / 1000} seconds...
            </p>
          </div>
        )}
      </div>

      {/* Next Actions */}
      {application.status === 'approved' && (
        <div className="mt-6 p-6 bg-white border border-gray-200 rounded-lg shadow">
          <h3 className="text-lg font-semibold mb-4">Next Steps</h3>
          <ol className="list-decimal list-inside space-y-2 text-sm">
            <li>Check your email ({application.email}) for login instructions</li>
            <li>Use the magic link to set up your account</li>
            <li>Start using wholesale pricing ($495 per report)</li>
            <li>Invite your team members to collaborate</li>
          </ol>
        </div>
      )}

      {application.status === 'rejected' && (
        <div className="mt-6 p-6 bg-white border border-gray-200 rounded-lg shadow">
          <h3 className="text-lg font-semibold mb-4">What Now?</h3>
          <p className="text-sm text-gray-700 mb-4">
            If you believe this decision was made in error or if your circumstances have changed,
            please contact our support team.
          </p>
          <a
            href="mailto:support@ato.example.com"
            className="inline-block px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Contact Support
          </a>
        </div>
      )}
    </div>
  );
}
