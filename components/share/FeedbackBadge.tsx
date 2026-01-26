'use client';

/**
 * FeedbackBadge
 *
 * Badge showing unread feedback count with animation.
 * Used on share link cards and dashboard indicators.
 *
 * Scientific Luxury design system.
 */

import { motion } from 'framer-motion';

interface FeedbackBadgeProps {
  count: number;
  size?: 'sm' | 'md' | 'lg';
  animate?: boolean;
  className?: string;
}

export function FeedbackBadge({
  count,
  size = 'md',
  animate = true,
  className = '',
}: FeedbackBadgeProps) {
  if (count === 0) return null;

  const sizeClasses = {
    sm: 'h-4 min-w-[16px] text-[10px] px-1',
    md: 'h-5 min-w-[20px] text-xs px-1.5',
    lg: 'h-6 min-w-[24px] text-sm px-2',
  };

  const displayCount = count > 99 ? '99+' : count.toString();

  return (
    <motion.div
      initial={animate ? { scale: 0 } : false}
      animate={{ scale: 1 }}
      className={`
        inline-flex items-center justify-center
        ${sizeClasses[size]}
        rounded-full
        bg-violet-500 text-white font-medium
        ${className}
      `}
    >
      {animate ? (
        <motion.span
          key={count}
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 10 }}
        >
          {displayCount}
        </motion.span>
      ) : (
        displayCount
      )}
    </motion.div>
  );
}

/**
 * FeedbackIndicator
 *
 * Small dot indicator showing feedback presence.
 */
interface FeedbackIndicatorProps {
  hasUnread: boolean;
  className?: string;
}

export function FeedbackIndicator({ hasUnread, className = '' }: FeedbackIndicatorProps) {
  if (!hasUnread) return null;

  return (
    <motion.div
      initial={{ scale: 0 }}
      animate={{ scale: 1 }}
      className={`
        w-2 h-2 rounded-full bg-violet-500
        ${className}
      `}
    >
      <motion.div
        className="w-full h-full rounded-full bg-violet-500"
        animate={{ opacity: [1, 0.5, 1] }}
        transition={{ duration: 2, repeat: Infinity }}
      />
    </motion.div>
  );
}

/**
 * FeedbackTypeBadge
 *
 * Badge showing feedback type breakdown.
 */
interface FeedbackTypeBadgeProps {
  questions: number;
  concerns: number;
  approvals: number;
  comments: number;
  className?: string;
}

export function FeedbackTypeBadge({
  questions,
  concerns,
  approvals,
  comments,
  className = '',
}: FeedbackTypeBadgeProps) {
  const total = questions + concerns + approvals + comments;
  if (total === 0) return null;

  return (
    <div className={`flex items-center gap-1 ${className}`}>
      {questions > 0 && (
        <span className="px-1.5 py-0.5 text-xs rounded bg-cyan-500/10 border border-cyan-500/30 text-cyan-400">
          ❓ {questions}
        </span>
      )}
      {concerns > 0 && (
        <span className="px-1.5 py-0.5 text-xs rounded bg-amber-500/10 border border-amber-500/30 text-amber-400">
          ⚠️ {concerns}
        </span>
      )}
      {approvals > 0 && (
        <span className="px-1.5 py-0.5 text-xs rounded bg-green-500/10 border border-green-500/30 text-green-400">
          ✅ {approvals}
        </span>
      )}
      {comments > 0 && (
        <span className="px-1.5 py-0.5 text-xs rounded bg-blue-500/10 border border-blue-500/30 text-blue-400">
          💬 {comments}
        </span>
      )}
    </div>
  );
}

export default FeedbackBadge;
