'use client';

/**
 * ShareLinkManager
 *
 * Full-featured manager for share links with:
 * - List of all share links
 * - Filter by status
 * - Create new links
 * - Revoke existing links
 * - Access statistics
 *
 * Scientific Luxury design system.
 */

import { useState, useEffect, useCallback } from 'react';
import { AnimatePresence } from 'framer-motion';
import {
  ShareLinkListItem,
  ShareLinkStatus,
  ListShareLinksResponse,
} from '@/lib/types/shared-reports';
import type { UnreadFeedbackResponse, UnreadFeedbackCount } from '@/lib/types/share-feedback';
import { ShareLinkCard } from './ShareLinkCard';
import { CreateShareModal } from './CreateShareModal';
import { FeedbackBadge } from './FeedbackBadge';

interface ShareLinkManagerProps {
  tenantId: string;
  onCreateClick?: () => void;
}

type FilterStatus = ShareLinkStatus | 'all';

export function ShareLinkManager({ tenantId }: ShareLinkManagerProps) {
  const [links, setLinks] = useState<ShareLinkListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterStatus>('all');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [copiedToast, setCopiedToast] = useState<string | null>(null);
  const [feedbackCounts, setFeedbackCounts] = useState<Map<string, UnreadFeedbackCount>>(new Map());
  const [totalUnreadFeedback, setTotalUnreadFeedback] = useState(0);

  const fetchFeedbackCounts = useCallback(async () => {
    try {
      const response = await fetch(`/api/share/feedback/unread?tenantId=${tenantId}`);
      if (response.ok) {
        const data: UnreadFeedbackResponse = await response.json();
        const countsMap = new Map<string, UnreadFeedbackCount>();
        for (const count of data.counts) {
          countsMap.set(count.shareId, count);
        }
        setFeedbackCounts(countsMap);
        setTotalUnreadFeedback(data.totalUnread);
      }
    } catch (err) {
      console.error('Failed to fetch feedback counts:', err);
    }
  }, [tenantId]);

  const fetchLinks = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/share/list?tenantId=${tenantId}`);
      if (!response.ok) {
        throw new Error('Failed to fetch share links');
      }
      const data: ListShareLinksResponse = await response.json();
      setLinks(data.links);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  }, [tenantId]);

  useEffect(() => {
    fetchLinks();
    fetchFeedbackCounts();
  }, [fetchLinks, fetchFeedbackCounts]);

  const handleRevoke = async (link: ShareLinkListItem) => {
    try {
      const response = await fetch('/api/share/revoke', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shareId: link.id }),
      });

      if (!response.ok) {
        throw new Error('Failed to revoke link');
      }

      // Update local state
      setLinks(prev =>
        prev.map(l =>
          l.id === link.id ? { ...l, status: 'revoked' as ShareLinkStatus } : l
        )
      );
    } catch (err) {
      console.error('Failed to revoke:', err);
    }
  };

  const handleCopy = async (url: string) => {
    await navigator.clipboard.writeText(url);
    setCopiedToast('Link copied to clipboard');
    setTimeout(() => setCopiedToast(null), 2000);
  };

  const filteredLinks = filter === 'all'
    ? links
    : links.filter(l => l.status === filter);

  const stats = {
    total: links.length,
    active: links.filter(l => l.status === 'active').length,
    expired: links.filter(l => l.status === 'expired').length,
    revoked: links.filter(l => l.status === 'revoked').length,
    totalAccess: links.reduce((sum, l) => sum + l.accessCount, 0),
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-medium text-white">Share Links</h2>
          <p className="text-sm text-white/50 mt-1">
            Manage secure links for accountant access to your reports
          </p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white text-sm font-medium rounded transition-all"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Create Link
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-6 gap-4">
        {[
          { label: 'Total Links', value: stats.total, color: 'violet' },
          { label: 'Active', value: stats.active, color: 'green' },
          { label: 'Expired', value: stats.expired, color: 'amber' },
          { label: 'Revoked', value: stats.revoked, color: 'red' },
          { label: 'Total Views', value: stats.totalAccess, color: 'blue' },
          { label: 'Unread Feedback', value: totalUnreadFeedback, color: 'violet', highlight: totalUnreadFeedback > 0 },
        ].map(stat => (
          <div
            key={stat.label}
            className={`bg-[#0a0a0a] border rounded-lg p-4 ${
              'highlight' in stat && stat.highlight
                ? 'border-violet-500/50 bg-violet-500/5'
                : 'border-white/10'
            }`}
          >
            <div className="text-xs text-white/40 mb-1">{stat.label}</div>
            <div className="flex items-center gap-2">
              <span className={`text-2xl font-medium text-${stat.color}-400`}>
                {stat.value}
              </span>
              {'highlight' in stat && stat.highlight && (
                <FeedbackBadge count={stat.value} size="sm" animate={false} />
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Filter */}
      <div className="flex items-center gap-2">
        <span className="text-sm text-white/50 mr-2">Filter:</span>
        {(['all', 'active', 'expired', 'revoked'] as FilterStatus[]).map(status => (
          <button
            key={status}
            onClick={() => setFilter(status)}
            className={`px-3 py-1.5 text-sm rounded transition-colors ${
              filter === status
                ? 'bg-white/10 text-white'
                : 'text-white/50 hover:text-white hover:bg-white/5'
            }`}
          >
            {status.charAt(0).toUpperCase() + status.slice(1)}
            {status !== 'all' && (
              <span className="ml-1 text-white/30">
                ({status === 'active' ? stats.active : status === 'expired' ? stats.expired : stats.revoked})
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Error */}
      {error && (
        <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-lg text-red-300">
          {error}
          <button
            onClick={fetchLinks}
            className="ml-3 text-red-400 hover:text-red-300 underline"
          >
            Retry
          </button>
        </div>
      )}

      {/* Loading */}
      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <div className="flex items-center gap-3 text-white/50">
            <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            Loading share links...
          </div>
        </div>
      )}

      {/* Empty State */}
      {!isLoading && !error && filteredLinks.length === 0 && (
        <div className="text-center py-12 bg-[#0a0a0a] border border-white/10 rounded-lg">
          <svg className="w-12 h-12 mx-auto text-white/20 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
          </svg>
          <h3 className="text-lg font-medium text-white mb-2">
            {filter === 'all' ? 'No share links yet' : `No ${filter} links`}
          </h3>
          <p className="text-white/50 mb-4">
            {filter === 'all'
              ? 'Create a share link to give your accountant secure access to your reports'
              : `You don't have any ${filter} share links`}
          </p>
          {filter === 'all' && (
            <button
              onClick={() => setShowCreateModal(true)}
              className="px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium rounded transition-colors"
            >
              Create Your First Link
            </button>
          )}
        </div>
      )}

      {/* Links List */}
      {!isLoading && filteredLinks.length > 0 && (
        <div className="grid gap-4">
          <AnimatePresence mode="popLayout">
            {filteredLinks.map(link => (
              <ShareLinkCard
                key={link.id}
                link={link}
                onRevoke={handleRevoke}
                onCopy={handleCopy}
                feedbackInfo={feedbackCounts.get(link.id)}
              />
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* Create Modal */}
      <CreateShareModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        tenantId={tenantId}
        onSuccess={() => {
          fetchLinks();
          setShowCreateModal(false);
        }}
      />

      {/* Copy Toast */}
      <AnimatePresence>
        {copiedToast && (
          <div className="fixed bottom-4 right-4 z-50">
            <div className="px-4 py-3 bg-green-600 text-white text-sm font-medium rounded-lg shadow-lg animate-fade-in">
              {copiedToast}
            </div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default ShareLinkManager;
