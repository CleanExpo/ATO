'use client';

/**
 * StatusHistory
 *
 * Timeline of status changes for a recommendation.
 * Shows who changed it, when, and any notes.
 *
 * Scientific Luxury design system.
 */

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { StatusUpdate, RecommendationStatus } from '@/lib/types/recommendation-status';
import { STATUS_CONFIG, formatStatusTime } from '@/lib/types/recommendation-status';

interface StatusHistoryProps {
  history: StatusUpdate[];
  maxVisible?: number;
  className?: string;
}

export function StatusHistory({
  history,
  maxVisible = 3,
  className = '',
}: StatusHistoryProps) {
  const [expanded, setExpanded] = useState(false);

  if (history.length === 0) {
    return (
      <div className={`text-sm text-white/40 ${className}`}>
        No status changes yet
      </div>
    );
  }

  const visibleHistory = expanded ? history : history.slice(0, maxVisible);
  const hasMore = history.length > maxVisible;

  return (
    <div className={`space-y-2 ${className}`}>
      <AnimatePresence mode="popLayout">
        {visibleHistory.map((update, index) => (
          <StatusHistoryItem
            key={update.id}
            update={update}
            isLatest={index === 0}
          />
        ))}
      </AnimatePresence>

      {hasMore && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="text-xs text-violet-400 hover:text-violet-300 transition-colors"
        >
          {expanded
            ? 'Show less'
            : `Show ${history.length - maxVisible} more updates`}
        </button>
      )}
    </div>
  );
}

interface StatusHistoryItemProps {
  update: StatusUpdate;
  isLatest?: boolean;
}

function StatusHistoryItem({ update, isLatest = false }: StatusHistoryItemProps) {
  const config = STATUS_CONFIG[update.status];

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className={`relative pl-6 ${isLatest ? '' : 'opacity-70'}`}
    >
      {/* Timeline dot and line */}
      <div className="absolute left-0 top-1.5 flex flex-col items-center">
        <div
          className={`w-3 h-3 rounded-full border-2 ${
            isLatest
              ? `${config.borderColor} ${config.bgColor}`
              : 'border-white/20 bg-white/5'
          }`}
        />
        <div className="w-px flex-1 bg-white/10 mt-1" />
      </div>

      {/* Content */}
      <div className="pb-4">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-sm">{config.icon}</span>
          <span className={`text-sm font-medium ${config.color}`}>
            {config.label}
          </span>
          <span className="text-xs text-white/30">
            {formatStatusTime(update.createdAt)}
          </span>
        </div>

        <div className="text-xs text-white/50">
          by {update.updatedByName}
          <span className="text-white/30 ml-1">
            ({update.updatedByType})
          </span>
        </div>

        {update.notes && (
          <div className="mt-2 p-2 bg-white/5 border border-white/10 rounded text-xs text-white/70">
            {update.notes}
          </div>
        )}
      </div>
    </motion.div>
  );
}

/**
 * StatusHistoryCompact
 *
 * Inline version showing only the most recent update.
 */
interface StatusHistoryCompactProps {
  history: StatusUpdate[];
  className?: string;
}

export function StatusHistoryCompact({
  history,
  className = '',
}: StatusHistoryCompactProps) {
  if (history.length === 0) return null;

  const latest = history[0];
  const config = STATUS_CONFIG[latest.status];

  return (
    <div className={`flex items-center gap-2 text-xs ${className}`}>
      <span className="text-white/40">Last updated</span>
      <span className={config.color}>{formatStatusTime(latest.createdAt)}</span>
      <span className="text-white/30">by {latest.updatedByName}</span>
    </div>
  );
}

export default StatusHistory;
