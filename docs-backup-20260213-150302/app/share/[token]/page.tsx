'use client';

/**
 * Share Page
 *
 * Public page for accountants to access shared reports.
 * Validates token and displays report data.
 * Supports feedback submission and threading.
 */

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { AccountantReportView } from '@/components/share/AccountantReportView';
import { TaxDisclaimer } from '@/components/dashboard/TaxDisclaimer';
import type { AccessShareLinkResponse, ShareLinkError } from '@/lib/types/shared-reports';
import type { FeedbackThread } from '@/lib/types/share-feedback';
import type { RecommendationStatus, StatusHistory } from '@/lib/types/recommendation-status';
import type { DocumentWithUrl, RecommendationDocument } from '@/lib/types/recommendation-documents';

type PageState =
  | { status: 'loading' }
  | { status: 'password_required' }
  | { status: 'error'; error: ShareLinkError }
  | { status: 'success'; data: AccessShareLinkResponse };

export default function SharePage() {
  const params = useParams();
  const token = params.token as string;

  const [state, setState] = useState<PageState>({ status: 'loading' });
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedbackThreads, setFeedbackThreads] = useState<FeedbackThread[]>([]);
  const [statusMap, setStatusMap] = useState<Map<string, StatusHistory>>(new Map());
  const [documentsMap, setDocumentsMap] = useState<Map<string, DocumentWithUrl[]>>(new Map());

  // Fetch documents for all recommendations
  const fetchDocuments = useCallback(async (recommendationIds: string[]) => {
    const newMap = new Map<string, DocumentWithUrl[]>();
    for (const recId of recommendationIds) {
      try {
        const response = await fetch(`/api/share/${token}/documents?recommendationId=${recId}`);
        if (response.ok) {
          const data = await response.json();
          newMap.set(recId, data.documents || []);
        }
      } catch (err) {
        console.error(`Failed to fetch documents for ${recId}:`, err);
      }
    }
    setDocumentsMap(newMap);
  }, [token]);

  // Fetch documents for a single recommendation
  const fetchDocumentsForRecommendation = useCallback(async (recommendationId: string) => {
    try {
      const response = await fetch(`/api/share/${token}/documents?recommendationId=${recommendationId}`);
      if (response.ok) {
        const data = await response.json();
        setDocumentsMap(prev => {
          const newMap = new Map(prev);
          newMap.set(recommendationId, data.documents || []);
          return newMap;
        });
      }
    } catch (err) {
      console.error(`Failed to fetch documents for ${recommendationId}:`, err);
    }
  }, [token]);

  // Handle document upload
  const handleDocumentUpload = useCallback(async (
    recommendationId: string,
    file: File,
    description?: string
  ): Promise<RecommendationDocument> => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('recommendationId', recommendationId);
    formData.append('uploadedByName', 'Accountant');
    if (description) {
      formData.append('description', description);
    }

    const response = await fetch(`/api/share/${token}/documents`, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Upload failed');
    }

    const data = await response.json();
    return data.document;
  }, [token]);

  // Fetch status for all recommendations
  const fetchStatus = useCallback(async (recommendationIds: string[]) => {
    const newMap = new Map<string, StatusHistory>();
    for (const recId of recommendationIds) {
      try {
        const response = await fetch(`/api/share/${token}/status?recommendationId=${recId}`);
        if (response.ok) {
          const data = await response.json();
          newMap.set(recId, data);
        }
      } catch (err) {
        console.error(`Failed to fetch status for ${recId}:`, err);
      }
    }
    setStatusMap(newMap);
  }, [token]);

  // Handle status change
  const handleStatusChange = useCallback(async (recommendationId: string, status: RecommendationStatus, notes?: string) => {
    try {
      const response = await fetch(`/api/share/${token}/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recommendationId,
          status,
          updatedByName: 'Accountant',
          notes,
        }),
      });
      if (response.ok) {
        // Refresh status for this recommendation
        const statusResponse = await fetch(`/api/share/${token}/status?recommendationId=${recommendationId}`);
        if (statusResponse.ok) {
          const data = await statusResponse.json();
          setStatusMap(prev => {
            const newMap = new Map(prev);
            newMap.set(recommendationId, data);
            return newMap;
          });
        }
      }
    } catch (err) {
      console.error('Failed to update status:', err);
    }
  }, [token]);

  // Fetch feedback for the report
  const fetchFeedback = useCallback(async () => {
    try {
      const response = await fetch(`/api/share/${token}/feedback`);
      if (response.ok) {
        const data = await response.json();
        setFeedbackThreads(data.threads || []);
      }
    } catch (err) {
      console.error('Failed to fetch feedback:', err);
    }
  }, [token]);

  const fetchReport = useCallback(async (passwordAttempt?: string) => {
    setState({ status: 'loading' });

    try {
      // Use POST with password in body (not query params) to avoid leaking
      // credentials in server logs, browser history, and Referer headers.
      const url = `/api/share/${token}`;
      const fetchOptions: RequestInit = passwordAttempt
        ? {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ password: passwordAttempt }),
          }
        : { method: 'GET' };

      const response = await fetch(url, fetchOptions);
      const data = await response.json();

      if (!response.ok) {
        const error = data as ShareLinkError;
        if (error.code === 'PASSWORD_REQUIRED') {
          setState({ status: 'password_required' });
        } else {
          setState({ status: 'error', error });
        }
        return;
      }

      setState({ status: 'success', data: data as AccessShareLinkResponse });
    } catch (_err) {
      setState({
        status: 'error',
        error: {
          success: false,
          error: 'Failed to load report. Please try again.',
          code: 'SERVER_ERROR',
        },
      });
    }
  }, [token]);

  useEffect(() => {
    fetchReport();
  }, [fetchReport]);

  // Fetch feedback, status, and documents when report is loaded
  useEffect(() => {
    if (state.status === 'success') {
      fetchFeedback();
      // Fetch status and documents for recommendations if available
      const recommendations = state.data.data.recommendations;
      if (recommendations && recommendations.length > 0) {
        const recIds = recommendations.map(r => r.id);
        fetchStatus(recIds);
        fetchDocuments(recIds);
      }
    }
  }, [state, fetchFeedback, fetchStatus, fetchDocuments]);

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    await fetchReport(password);
    setIsSubmitting(false);
  };

  // Loading state
  if (state.status === 'loading') {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <svg className="w-12 h-12 mx-auto text-violet-500 animate-spin mb-4" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <p className="text-white/50">Loading report...</p>
        </div>
      </div>
    );
  }

  // Password required
  if (state.status === 'password_required') {
    return (
      <>
        <div className="max-w-md mx-auto">
          <div className="bg-[#0a0a0a] border border-white/10 rounded-lg p-8">
            <div className="text-center mb-6">
              <div className="w-16 h-16 mx-auto mb-4 bg-amber-500/10 rounded-full flex items-center justify-center">
                <svg className="w-8 h-8 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </div>
              <h2 className="text-xl font-semibold text-white mb-2">Password Protected</h2>
              <p className="text-white/50 text-sm">
                This report is password protected. Enter the password provided by the report owner.
              </p>
            </div>

            <form onSubmit={handlePasswordSubmit} className="space-y-4">
              <div>
                <label htmlFor="password" className="block text-sm text-white/70 mb-2">
                  Password
                </label>
                <input
                  type="password"
                  id="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter password"
                  required
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder:text-white/30 focus:outline-none focus:border-violet-500"
                />
              </div>
              <button
                type="submit"
                disabled={isSubmitting || !password}
                className="w-full px-4 py-3 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white font-medium rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? 'Verifying...' : 'Access Report'}
              </button>
            </form>
          </div>
        </div>
        <TaxDisclaimer sticky />
      </>
    );
  }

  // Error state
  if (state.status === 'error') {
    const { error } = state;

    const errorConfigs: Record<string, { icon: string; title: string; message: string; color: string }> = {
      INVALID_TOKEN: {
        icon: '🔗',
        title: 'Invalid Link',
        message: 'This link is invalid or has been removed.',
        color: 'red',
      },
      EXPIRED: {
        icon: '⏰',
        title: 'Link Expired',
        message: 'This share link has expired. Please request a new one from the report owner.',
        color: 'amber',
      },
      REVOKED: {
        icon: '🚫',
        title: 'Access Revoked',
        message: 'Access to this report has been revoked by the owner.',
        color: 'red',
      },
      PASSWORD_REQUIRED: {
        icon: '🔐',
        title: 'Password Required',
        message: 'This report is password protected.',
        color: 'amber',
      },
      INVALID_PASSWORD: {
        icon: '🔐',
        title: 'Incorrect Password',
        message: 'The password you entered is incorrect. Please try again.',
        color: 'amber',
      },
      NOT_FOUND: {
        icon: '❓',
        title: 'Not Found',
        message: 'This share link does not exist or has been removed.',
        color: 'red',
      },
      SERVER_ERROR: {
        icon: '⚠️',
        title: 'Server Error',
        message: error.error || 'An unexpected error occurred. Please try again later.',
        color: 'red',
      },
    };

    const errorConfig = errorConfigs[error.code] || {
      icon: '⚠️',
      title: 'Error',
      message: error.error,
      color: 'red',
    };

    return (
      <div className="max-w-md mx-auto">
        <div className={`bg-[#0a0a0a] border border-${errorConfig.color}-500/30 rounded-lg p-8`}>
          <div className="text-center">
            <div className="text-5xl mb-4">{errorConfig.icon}</div>
            <h2 className={`text-xl font-semibold text-${errorConfig.color}-400 mb-2`}>
              {errorConfig.title}
            </h2>
            <p className="text-white/50 mb-6">{errorConfig.message}</p>

            {error.code === 'INVALID_PASSWORD' && (
              <button
                onClick={() => setState({ status: 'password_required' })}
                className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white text-sm font-medium rounded transition-colors"
              >
                Try Again
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Success state - show report
  return (
    <>
      <AccountantReportView
        data={state.data}
        token={token}
        feedbackThreads={feedbackThreads}
        onFeedbackSubmit={fetchFeedback}
        statusMap={statusMap}
        onStatusChange={handleStatusChange}
        documentsMap={documentsMap}
        onDocumentUpload={handleDocumentUpload}
        onDocumentRefresh={fetchDocumentsForRecommendation}
      />
      <TaxDisclaimer sticky />
    </>
  );
}
