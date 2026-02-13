'use client';

/**
 * ShareLinkCard
 *
 * Card component displaying a single share link with:
 * - Title, report type, status badge
 * - Access statistics
 * - Copy and revoke actions
 * - Expiry countdown
 *
 * Scientific Luxury design system.
 */

import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  ShareLinkListItem,
  REPORT_TYPE_LABELS,
} from '@/lib/types/shared-reports';
import { buildShareUrl, formatTimeRemaining } from '@/lib/share/token-generator';
import { FeedbackBadge, FeedbackIndicator } from './FeedbackBadge';
import type { UnreadFeedbackCount } from '@/lib/types/share-feedback';

interface ShareLinkCardProps {
  link: ShareLinkListItem;
  onRevoke: (link: ShareLinkListItem) => void;
  onCopy: (url: string) => void;
  feedbackInfo?: UnreadFeedbackCount;
}

const STATUS_STYLES = {
  active: {
    bg: 'bg-green-500/10',
    border: 'border-green-500/30',
    text: 'text-green-400',
    label: 'Active',
  },
  expired: {
    bg: 'bg-amber-500/10',
    border: 'border-amber-500/30',
    text: 'text-amber-400',
    label: 'Expired',
  },
  revoked: {
    bg: 'bg-red-500/10',
    border: 'border-red-500/30',
    text: 'text-red-400',
    label: 'Revoked',
  },
};

export function ShareLinkCard({ link, onRevoke, onCopy, feedbackInfo }: ShareLinkCardProps) {
  const [showRevokeConfirm, setShowRevokeConfirm] = useState(false);
  const [isRevoking, setIsRevoking] = useState(false);

  const statusStyle = STATUS_STYLES[link.status];
  const shareUrl = buildShareUrl(link.token);
  const hasUnreadFeedback = feedbackInfo && feedbackInfo.unreadCount > 0;

  const handleRevoke = async () => {
    setIsRevoking(true);
    await onRevoke(link);
    setIsRevoking(false);
    setShowRevokeConfirm(false);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-AU', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="bg-[#0a0a0a] border border-white/10 rounded-lg overflow-hidden"
    >
      {/* Header */}
      <div className="px-4 py-3 border-b border-white/5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="font-medium text-white truncate">{link.title}</h3>
              {hasUnreadFeedback && (
                <FeedbackBadge count={feedbackInfo.unreadCount} size="sm" />
              )}
            </div>
            <p className="text-sm text-white/50 mt-0.5">
              {REPORT_TYPE_LABELS[link.reportType]}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <FeedbackIndicator hasUnread={!!hasUnreadFeedback} />
            <div className={`px-2 py-1 text-xs font-medium rounded ${statusStyle.bg} ${statusStyle.border} ${statusStyle.text} border`}>
              {statusStyle.label}
            </div>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-px bg-white/5">
        <div className="bg-[#0a0a0a] px-4 py-3">
          <div className="text-xs text-white/40 mb-1">Access Count</div>
          <div className="text-lg font-medium text-white">{link.accessCount}</div>
        </div>
        <div className="bg-[#0a0a0a] px-4 py-3">
          <div className="text-xs text-white/40 mb-1">Created</div>
          <div className="text-sm text-white">{formatDate(link.createdAt)}</div>
        </div>
        <div className="bg-[#0a0a0a] px-4 py-3">
          <div className="text-xs text-white/40 mb-1">
            {link.status === 'active' ? 'Expires' : 'Expired'}
          </div>
          <div className="text-sm text-white">
            {link.status === 'active'
              ? formatTimeRemaining(link.expiresAt)
              : formatDate(link.expiresAt)}
          </div>
        </div>
      </div>

      {/* Last Access */}
      {link.lastAccessedAt && (
        <div className="px-4 py-2 border-t border-white/5 text-xs text-white/40">
          Last accessed: {formatDate(link.lastAccessedAt)}
        </div>
      )}

      {/* Latest Feedback Preview */}
      {hasUnreadFeedback && feedbackInfo.latestFeedback && (
        <div className="px-4 py-3 border-t border-white/5 bg-violet-500/5">
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-violet-500/20 flex items-center justify-center">
              <span className="text-sm">
                {feedbackInfo.latestFeedback.feedbackType === 'question' ? '❓' :
                 feedbackInfo.latestFeedback.feedbackType === 'concern' ? '⚠️' :
                 feedbackInfo.latestFeedback.feedbackType === 'approval' ? '✅' : '💬'}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-sm font-medium text-white">
                  {feedbackInfo.latestFeedback.authorName}
                </span>
                <span className="text-xs text-white/40">
                  {formatDate(feedbackInfo.latestFeedback.createdAt)}
                </span>
              </div>
              <p className="text-sm text-white/60 truncate">
                {feedbackInfo.latestFeedback.message}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="px-4 py-3 border-t border-white/5 flex items-center gap-2">
        {link.status === 'active' && (
          <>
            <button
              onClick={() => onCopy(shareUrl)}
              className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-violet-600/20 hover:bg-violet-600/30 border border-violet-500/30 text-violet-300 text-sm font-medium rounded transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
              </svg>
              Copy Link
            </button>

            {showRevokeConfirm ? (
              <div className="flex items-center gap-2">
                <button
                  onClick={handleRevoke}
                  disabled={isRevoking}
                  className="px-3 py-2 bg-red-600/20 hover:bg-red-600/30 border border-red-500/30 text-red-300 text-sm font-medium rounded transition-colors disabled:opacity-50"
                >
                  {isRevoking ? 'Revoking...' : 'Confirm'}
                </button>
                <button
                  onClick={() => setShowRevokeConfirm(false)}
                  className="px-3 py-2 bg-white/5 hover:bg-white/10 border border-white/10 text-white/70 text-sm rounded transition-colors"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                onClick={() => setShowRevokeConfirm(true)}
                className="px-3 py-2 bg-white/5 hover:bg-red-600/10 border border-white/10 hover:border-red-500/30 text-white/50 hover:text-red-300 text-sm rounded transition-colors"
                title="Revoke this link"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                </svg>
              </button>
            )}
          </>
        )}

        {link.status !== 'active' && (
          <div className="flex-1 text-center text-sm text-white/30 py-2">
            This link is no longer accessible
          </div>
        )}

        {link.isPasswordProtected && (
          <div className="px-2 py-1 bg-amber-500/10 border border-amber-500/20 rounded text-xs text-amber-300">
            <svg className="w-3 h-3 inline mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
            Protected
          </div>
        )}
      </div>
    </motion.div>
  );
}

export default ShareLinkCard;
