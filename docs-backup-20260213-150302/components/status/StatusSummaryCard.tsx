'use client';

/**
 * StatusSummaryCard
 *
 * Dashboard widget showing status counts and progress.
 * Supports click-to-filter functionality.
 *
 * Scientific Luxury design system.
 */

import { motion } from 'framer-motion';
import type { RecommendationStatus, StatusSummary } from '@/lib/types/recommendation-status';
import { STATUS_CONFIG } from '@/lib/types/recommendation-status';

interface StatusSummaryCardProps {
  summary: StatusSummary;
  onFilterClick?: (status: RecommendationStatus | 'all') => void;
  activeFilter?: RecommendationStatus | 'all';
  className?: string;
}

export function StatusSummaryCard({
  summary,
  onFilterClick,
  activeFilter = 'all',
  className = '',
}: StatusSummaryCardProps) {
  const statuses: RecommendationStatus[] = [
    'pending_review',
    'under_review',
    'needs_verification',
    'needs_clarification',
    'approved',
    'rejected',
    'implemented',
  ];

  // Calculate progress percentages
  const completedCount = summary.approved + summary.implemented;
  const inProgressCount = summary.under_review + summary.needs_verification + summary.needs_clarification;
  const pendingCount = summary.pending_review;
  const rejectedCount = summary.rejected;

  const total = summary.total || 1; // Avoid division by zero
  const completedPercent = Math.round((completedCount / total) * 100);
  const inProgressPercent = Math.round((inProgressCount / total) * 100);

  return (
    <div className={`bg-[#0a0a0a] border border-white/10 rounded-lg overflow-hidden ${className}`}>
      {/* Header */}
      <div className="px-4 py-3 border-b border-white/5">
        <h3 className="text-sm font-medium text-white">Review Progress</h3>
        <p className="text-xs text-white/40 mt-0.5">
          {summary.total} recommendations
        </p>
      </div>

      {/* Progress Bar */}
      <div className="px-4 py-3 border-b border-white/5">
        <div className="flex items-center gap-2 mb-2">
          <div className="flex-1 h-2 bg-white/5 rounded-full overflow-hidden flex">
            {completedPercent > 0 && (
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${completedPercent}%` }}
                transition={{ duration: 0.5, delay: 0.2 }}
                className="bg-green-500 h-full"
              />
            )}
            {inProgressPercent > 0 && (
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${inProgressPercent}%` }}
                transition={{ duration: 0.5, delay: 0.4 }}
                className="bg-blue-500 h-full"
              />
            )}
          </div>
          <span className="text-xs text-white/50 w-12 text-right">
            {completedPercent}%
          </span>
        </div>

        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-green-500" />
              <span className="text-white/50">Complete: {completedCount}</span>
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-blue-500" />
              <span className="text-white/50">In Progress: {inProgressCount}</span>
            </span>
          </div>
          <span className="text-white/30">
            {pendingCount} pending
          </span>
        </div>
      </div>

      {/* Status Breakdown */}
      <div className="px-4 py-3">
        <div className="grid grid-cols-4 gap-2">
          {statuses.map((status) => {
            const config = STATUS_CONFIG[status];
            const count = summary[status];
            const isActive = activeFilter === status;

            if (count === 0 && !isActive) return null;

            return (
              <button
                key={status}
                onClick={() => onFilterClick?.(isActive ? 'all' : status)}
                className={`
                  flex flex-col items-center p-2 rounded transition-all
                  ${isActive
                    ? `${config.bgColor} ${config.borderColor} border`
                    : 'hover:bg-white/5'
                  }
                `}
              >
                <span className="text-lg mb-1">{config.icon}</span>
                <span className={`text-lg font-medium ${config.color}`}>
                  {count}
                </span>
                <span className="text-[10px] text-white/40 truncate w-full text-center">
                  {config.label.split(' ')[0]}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Filter Indicator */}
      {activeFilter !== 'all' && (
        <div className="px-4 py-2 border-t border-white/5 bg-white/5">
          <div className="flex items-center justify-between">
            <span className="text-xs text-white/50">
              Showing: {STATUS_CONFIG[activeFilter].label}
            </span>
            <button
              onClick={() => onFilterClick?.('all')}
              className="text-xs text-violet-400 hover:text-violet-300"
            >
              Clear filter
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * StatusSummaryCompact
 *
 * Inline summary for smaller spaces.
 */
interface StatusSummaryCompactProps {
  summary: StatusSummary;
  className?: string;
}

export function StatusSummaryCompact({
  summary,
  className = '',
}: StatusSummaryCompactProps) {
  const completedCount = summary.approved + summary.implemented;
  const total = summary.total || 1;
  const percent = Math.round((completedCount / total) * 100);

  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <div className="flex-1 h-1.5 bg-white/5 rounded-full overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${percent}%` }}
          className="h-full bg-gradient-to-r from-green-500 to-emerald-400"
        />
      </div>
      <span className="text-xs text-white/50 whitespace-nowrap">
        {completedCount}/{total} complete
      </span>
    </div>
  );
}

export default StatusSummaryCard;
