'use client';

/**
 * AccountantReportView
 *
 * Read-only view of a shared report for accountants.
 * Includes executive summary, findings, recommendations, feedback, and export options.
 *
 * Scientific Luxury design system.
 */

import { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { AccessShareLinkResponse, ReportFinding, Recommendation } from '@/lib/types/shared-reports';
import type { FeedbackThread as FeedbackThreadType, FeedbackWithReplies } from '@/lib/types/share-feedback';
import type { RecommendationStatus, StatusHistory } from '@/lib/types/recommendation-status';
import type { DocumentWithUrl, RecommendationDocument } from '@/lib/types/recommendation-documents';
import { getDocumentSuggestions } from '@/lib/types/recommendation-documents';
import { FeedbackThread } from './FeedbackThread';
import { FeedbackForm } from './FeedbackForm';
import { FeedbackBadge } from './FeedbackBadge';
import { StatusBadge, StatusSelector } from '@/components/status';
import { DocumentList, DocumentUpload, DocumentCountBadge } from '@/components/documents';

interface AccountantReportViewProps {
  data: AccessShareLinkResponse;
  token: string;
  feedbackThreads?: FeedbackThreadType[];
  onFeedbackSubmit?: () => void;
  statusMap?: Map<string, StatusHistory>;
  onStatusChange?: (recommendationId: string, status: RecommendationStatus, notes?: string) => Promise<void>;
  documentsMap?: Map<string, DocumentWithUrl[]>;
  onDocumentUpload?: (recommendationId: string, file: File, description?: string) => Promise<RecommendationDocument>;
  onDocumentRefresh?: (recommendationId: string) => void;
}

const PRIORITY_COLORS = {
  high: { bg: 'bg-red-500/10', border: 'border-red-500/30', text: 'text-red-400' },
  medium: { bg: 'bg-amber-500/10', border: 'border-amber-500/30', text: 'text-amber-400' },
  low: { bg: 'bg-green-500/10', border: 'border-green-500/30', text: 'text-green-400' },
};

const CONFIDENCE_COLORS = {
  high: 'text-green-400',
  medium: 'text-amber-400',
  low: 'text-red-400',
};

export function AccountantReportView({
  data,
  token,
  feedbackThreads = [],
  onFeedbackSubmit,
  statusMap = new Map(),
  onStatusChange,
  documentsMap = new Map(),
  onDocumentUpload,
  onDocumentRefresh,
}: AccountantReportViewProps) {
  const [activeTab, setActiveTab] = useState<'summary' | 'findings' | 'recommendations' | 'feedback'>('summary');
  const printRef = useRef<HTMLDivElement>(null);

  const { title, description, organisationName, generatedAt, expiresAt, data: reportData } = data;
  const { executiveSummary, findings, recommendations, metadata } = reportData;

  // Get feedback for a specific finding
  const getFeedbackForFinding = (findingId: string): FeedbackWithReplies[] => {
    const thread = feedbackThreads.find(t => t.findingId === findingId);
    return thread?.feedback || [];
  };

  // Get general feedback (not tied to a finding)
  const generalFeedback = feedbackThreads.find(t => t.findingId === null)?.feedback || [];

  // Total feedback count
  const totalFeedbackCount = feedbackThreads.reduce((sum, t) => sum + t.totalCount, 0);

  const handlePrint = () => {
    window.print();
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-AU', {
      style: 'currency',
      currency: 'AUD',
      maximumFractionDigits: 0,
    }).format(value);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-AU', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  };

  return (
    <div ref={printRef} className="space-y-6 print:bg-white print:text-black">
      {/* Report Header */}
      <div className="bg-[#0a0a0a] border border-white/10 rounded-lg p-6 print:border-gray-300">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-white print:text-black">{title}</h1>
            {description && (
              <p className="text-white/60 mt-1 print:text-gray-600">{description}</p>
            )}
            <div className="flex flex-wrap gap-3 mt-4 text-sm">
              <span className="px-3 py-1 bg-violet-500/10 border border-violet-500/30 rounded text-violet-300 print:bg-violet-50 print:border-violet-200 print:text-violet-700">
                {organisationName}
              </span>
              <span className="px-3 py-1 bg-white/5 border border-white/10 rounded text-white/60 print:bg-gray-50 print:border-gray-200 print:text-gray-600">
                Generated: {formatDate(generatedAt)}
              </span>
            </div>
          </div>
          <div className="flex gap-2 print:hidden">
            <button
              onClick={handlePrint}
              className="flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 border border-white/10 text-white text-sm rounded transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
              </svg>
              Print
            </button>
          </div>
        </div>
      </div>

      {/* Estimate Notice Banner */}
      <div className="bg-amber-500/5 border border-amber-500/20 rounded-lg px-4 py-3 flex items-center gap-3 print:bg-amber-50 print:border-amber-300">
        <span className="px-2 py-0.5 bg-amber-500/20 border border-amber-500/30 rounded text-[10px] font-bold text-amber-300 uppercase tracking-widest whitespace-nowrap print:bg-amber-100 print:text-amber-800 print:border-amber-400">
          Estimate Only
        </span>
        <span className="text-xs text-amber-200/70 print:text-amber-800">
          All dollar amounts in this report are AI-generated estimates based on automated ledger analysis. They are indicative only and must be verified by a qualified Tax Agent or Accountant before any action is taken.
        </span>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 print:hidden">
        {(['summary', 'findings', 'recommendations', 'feedback'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors flex items-center gap-2 ${
              activeTab === tab
                ? 'bg-violet-600 text-white'
                : 'bg-white/5 text-white/60 hover:text-white hover:bg-white/10'
            }`}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
            {tab === 'findings' && findings.length > 0 && (
              <span className="px-1.5 py-0.5 bg-white/20 rounded text-xs">
                {findings.length}
              </span>
            )}
            {tab === 'feedback' && totalFeedbackCount > 0 && (
              <FeedbackBadge count={totalFeedbackCount} size="sm" animate={false} />
            )}
          </button>
        ))}
      </div>

      {/* Executive Summary Tab */}
      {activeTab === 'summary' && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className={`space-y-6 ${activeTab !== 'summary' ? 'hidden print:block' : ''}`}
        >
          <h2 className="text-lg font-medium text-white print:text-black hidden print:block">
            Executive Summary
          </h2>

          {/* Key Metrics */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <MetricCard
              label="Transactions Analysed"
              value={executiveSummary.totalTransactionsAnalysed.toLocaleString()}
              icon="📊"
            />
            <MetricCard
              label="Potential Benefit (Est.)"
              value={formatCurrency(executiveSummary.totalPotentialBenefit)}
              icon="💰"
              highlight
            />
            <MetricCard
              label="High Priority Items"
              value={executiveSummary.highPriorityItems.toString()}
              icon="🔴"
            />
            <MetricCard
              label="Period Covered"
              value={executiveSummary.periodCovered}
              icon="📅"
            />
          </div>

          {/* Key Findings */}
          <div className="bg-[#0a0a0a] border border-white/10 rounded-lg p-6 print:border-gray-300">
            <h3 className="text-lg font-medium text-white mb-4 print:text-black">
              Key Findings
            </h3>
            <ul className="space-y-3">
              {executiveSummary.keyFindings.map((finding, index) => (
                <li key={index} className="flex items-start gap-3">
                  <svg className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span className="text-white/80 print:text-gray-700">{finding}</span>
                </li>
              ))}
            </ul>
            {executiveSummary.estimateDisclaimer && (
              <p className="mt-4 text-xs text-amber-400/70 print:text-amber-700 border-t border-white/5 pt-3">
                {executiveSummary.estimateDisclaimer}
              </p>
            )}
          </div>
        </motion.div>
      )}

      {/* Findings Tab */}
      {activeTab === 'findings' && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className={`space-y-4 ${activeTab !== 'findings' ? 'hidden print:block' : ''}`}
        >
          <h2 className="text-lg font-medium text-white print:text-black hidden print:block print:mt-8 print:pt-8 print:border-t">
            Detailed Findings
          </h2>

          {findings.length === 0 ? (
            <div className="text-center py-8 text-white/50">
              No specific findings to display.
            </div>
          ) : (
            <div className="space-y-4">
              {findings.map((finding) => (
                <FindingCard
                  key={finding.id}
                  finding={finding}
                  token={token}
                  feedback={getFeedbackForFinding(finding.id)}
                  onFeedbackSubmit={onFeedbackSubmit}
                />
              ))}
            </div>
          )}
        </motion.div>
      )}

      {/* Recommendations Tab */}
      {activeTab === 'recommendations' && recommendations && recommendations.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className={`space-y-4 ${activeTab !== 'recommendations' ? 'hidden print:block' : ''}`}
        >
          <h2 className="text-lg font-medium text-white print:text-black hidden print:block print:mt-8 print:pt-8 print:border-t">
            Recommendations
          </h2>

          <div className="space-y-4">
            {recommendations.map((rec) => (
              <RecommendationCard
                key={rec.id}
                recommendation={rec}
                token={token}
                statusInfo={statusMap.get(rec.id)}
                onStatusChange={onStatusChange}
                documents={documentsMap.get(rec.id)}
                onDocumentUpload={onDocumentUpload}
                onDocumentRefresh={onDocumentRefresh}
              />
            ))}
          </div>
        </motion.div>
      )}

      {/* Feedback Tab */}
      {activeTab === 'feedback' && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-6"
        >
          <div className="bg-[#0a0a0a] border border-white/10 rounded-lg p-6">
            <h3 className="text-lg font-medium text-white mb-4">Leave General Feedback</h3>
            <p className="text-sm text-white/50 mb-4">
              Share your questions, comments, or concerns about this report. Your feedback will be sent to the report owner.
            </p>
            <FeedbackForm
              token={token}
              onSubmit={async () => onFeedbackSubmit?.()}
            />
          </div>

          {generalFeedback.length > 0 && (
            <div className="bg-[#0a0a0a] border border-white/10 rounded-lg p-6">
              <h3 className="text-lg font-medium text-white mb-4">Previous Feedback</h3>
              <FeedbackThread
                feedback={generalFeedback}
                token={token}
                onNewFeedback={onFeedbackSubmit}
                showAddForm={false}
              />
            </div>
          )}
        </motion.div>
      )}

      {/* Disclaimer */}
      <div className="bg-amber-500/5 border border-amber-500/20 rounded-lg p-4 text-sm text-amber-200/80 print:bg-amber-50 print:border-amber-200 print:text-amber-800">
        <strong className="block mb-1">Disclaimer</strong>
        {metadata.disclaimer}
      </div>

      {/* Expiry Notice */}
      <div className="text-center text-sm text-white/40 print:hidden">
        This link expires on {formatDate(expiresAt)}
      </div>
    </div>
  );
}

function MetricCard({
  label,
  value,
  icon,
  highlight,
}: {
  label: string;
  value: string;
  icon: string;
  highlight?: boolean;
}) {
  return (
    <div className={`bg-[#0a0a0a] border rounded-lg p-4 print:border-gray-300 ${
      highlight ? 'border-green-500/30' : 'border-white/10'
    }`}>
      <div className="flex items-center gap-2 mb-2">
        <span>{icon}</span>
        <span className="text-sm text-white/50 print:text-gray-500">{label}</span>
      </div>
      <div className={`text-2xl font-semibold ${
        highlight ? 'text-green-400' : 'text-white print:text-black'
      }`}>
        {value}
      </div>
    </div>
  );
}

function FindingCard({
  finding,
  token,
  feedback,
  onFeedbackSubmit,
}: {
  finding: ReportFinding;
  token: string;
  feedback: FeedbackWithReplies[];
  onFeedbackSubmit?: () => void;
}) {
  const [showFeedback, setShowFeedback] = useState(false);
  const priorityStyle = PRIORITY_COLORS[finding.priority];
  const confidenceColor = CONFIDENCE_COLORS[finding.confidence];

  return (
    <div className="bg-[#0a0a0a] border border-white/10 rounded-lg overflow-hidden print:border-gray-300">
      <div className="p-4 border-b border-white/5 print:border-gray-200">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h4 className="font-medium text-white print:text-black">{finding.title}</h4>
            <p className="text-sm text-white/50 print:text-gray-500 mt-1">{finding.category}</p>
          </div>
          <div className="flex items-center gap-2">
            {feedback.length > 0 && (
              <FeedbackBadge count={feedback.length} size="sm" />
            )}
            <div className={`px-2 py-1 text-xs font-medium rounded ${priorityStyle.bg} ${priorityStyle.border} ${priorityStyle.text} border print:bg-opacity-100`}>
              {finding.priority.toUpperCase()}
            </div>
          </div>
        </div>
      </div>
      <div className="p-4 space-y-3">
        <p className="text-sm text-white/70 print:text-gray-600">{finding.description}</p>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-white/40 print:text-gray-400">Potential Benefit</span>
            <div className="text-green-400 font-medium">
              {new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }).format(finding.potentialBenefit)}
              <span className="ml-1.5 text-[10px] font-semibold text-amber-400/80 uppercase tracking-wider print:text-amber-700">
                Est. Only
              </span>
            </div>
          </div>
          <div>
            <span className="text-white/40 print:text-gray-400">Confidence</span>
            <div className={`font-medium ${confidenceColor}`}>
              {finding.confidence.charAt(0).toUpperCase() + finding.confidence.slice(1)}
            </div>
          </div>
        </div>
        <div className="pt-3 border-t border-white/5 print:border-gray-200">
          <div className="text-xs text-white/40 print:text-gray-400 mb-1">Legislative Reference</div>
          <div className="text-sm text-violet-300 print:text-violet-700">{finding.legislativeReference}</div>
        </div>
        <div>
          <div className="text-xs text-white/40 print:text-gray-400 mb-1">Action Required</div>
          <div className="text-sm text-white/80 print:text-gray-700">{finding.actionRequired}</div>
        </div>

        {/* Feedback Section */}
        <div className="pt-3 border-t border-white/5 print:hidden">
          <button
            onClick={() => setShowFeedback(!showFeedback)}
            className="flex items-center gap-2 text-sm text-white/50 hover:text-white/70 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
            {showFeedback ? 'Hide' : 'Leave'} Feedback
            {feedback.length > 0 && !showFeedback && ` (${feedback.length})`}
          </button>

          <AnimatePresence>
            {showFeedback && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="mt-4"
              >
                <FeedbackThread
                  feedback={feedback}
                  token={token}
                  findingId={finding.id}
                  onNewFeedback={onFeedbackSubmit}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

interface RecommendationCardProps {
  recommendation: Recommendation;
  token: string;
  statusInfo?: StatusHistory;
  onStatusChange?: (recommendationId: string, status: RecommendationStatus, notes?: string) => Promise<void>;
  documents?: DocumentWithUrl[];
  onDocumentUpload?: (recommendationId: string, file: File, description?: string) => Promise<RecommendationDocument>;
  onDocumentRefresh?: (recommendationId: string) => void;
}

function RecommendationCard({
  recommendation,
  token,
  statusInfo,
  onStatusChange,
  documents = [],
  onDocumentUpload,
  onDocumentRefresh,
}: RecommendationCardProps) {
  const [showDocuments, setShowDocuments] = useState(false);

  const handleStatusChange = async (status: RecommendationStatus, notes?: string) => {
    if (onStatusChange) {
      await onStatusChange(recommendation.id, status, notes);
    }
  };

  const handleUpload = async (file: File, description?: string): Promise<RecommendationDocument> => {
    if (!onDocumentUpload) throw new Error('Upload not available');
    const doc = await onDocumentUpload(recommendation.id, file, description);
    onDocumentRefresh?.(recommendation.id);
    return doc;
  };

  // Determine tax area for suggestions
  const taxArea = recommendation.title?.toLowerCase().includes('r&d') ? 'rnd' :
                  recommendation.title?.toLowerCase().includes('div') ? 'div7a' :
                  recommendation.title?.toLowerCase().includes('loss') ? 'loss' :
                  'deduction';

  return (
    <div className="bg-[#0a0a0a] border border-white/10 rounded-lg p-4 print:border-gray-300">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-2 flex-wrap">
          <h4 className="font-medium text-white print:text-black">{recommendation.title}</h4>
          {statusInfo && onStatusChange ? (
            <StatusSelector
              currentStatus={statusInfo.currentStatus}
              updaterType="accountant"
              onStatusChange={handleStatusChange}
              compact
            />
          ) : statusInfo ? (
            <StatusBadge
              status={statusInfo.currentStatus}
              size="sm"
              lastUpdatedAt={statusInfo.lastUpdatedAt}
              lastUpdatedBy={statusInfo.lastUpdatedBy}
            />
          ) : null}
          {documents.length > 0 && (
            <DocumentCountBadge count={documents.length} />
          )}
        </div>
        <div className="text-green-400 font-medium whitespace-nowrap">
          {new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }).format(recommendation.estimatedBenefit)}
          <span className="ml-1.5 text-[10px] font-semibold text-amber-400/80 uppercase tracking-wider print:text-amber-700">
            Est. Only
          </span>
        </div>
      </div>
      <p className="text-sm text-white/70 print:text-gray-600 mb-4">{recommendation.description}</p>
      <div className="space-y-2">
        <div className="text-xs text-white/40 print:text-gray-400">Steps to implement:</div>
        <ol className="list-decimal list-inside space-y-1 text-sm text-white/70 print:text-gray-600">
          {recommendation.steps.map((step, index) => (
            <li key={index}>{step}</li>
          ))}
        </ol>
      </div>

      {/* Documents Section */}
      <div className="mt-4 pt-4 border-t border-white/5 print:hidden">
        <button
          onClick={() => setShowDocuments(!showDocuments)}
          className="flex items-center gap-2 text-sm text-white/50 hover:text-white/70 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          {showDocuments ? 'Hide' : 'View'} Documents
          {documents.length > 0 && !showDocuments && ` (${documents.length})`}
        </button>

        <AnimatePresence>
          {showDocuments && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="mt-4 space-y-4"
            >
              {/* Existing Documents */}
              {documents.length > 0 && (
                <DocumentList
                  documents={documents}
                  compact={documents.length <= 2}
                />
              )}

              {/* Upload Section */}
              {onDocumentUpload && (
                <div className="pt-4 border-t border-white/5">
                  <p className="text-xs text-white/40 mb-3">
                    Upload supporting documentation for this recommendation
                  </p>
                  <DocumentUpload
                    recommendationId={recommendation.id}
                    onUpload={handleUpload}
                    suggestedTypes={getDocumentSuggestions(taxArea)}
                  />
                </div>
              )}

              {/* Empty state */}
              {documents.length === 0 && !onDocumentUpload && (
                <p className="text-sm text-white/30 text-center py-4">No documents attached</p>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

export default AccountantReportView;
