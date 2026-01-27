'use client';

/**
 * StatusBadge
 *
 * Coloured badge showing recommendation status.
 * Supports compact and expanded variants.
 *
 * Scientific Luxury design system.
 */

import { motion } from 'framer-motion';
import type { RecommendationStatus } from '@/lib/types/recommendation-status';
import { STATUS_CONFIG, formatStatusTime } from '@/lib/types/recommendation-status';

interface StatusBadgeProps {
  status: RecommendationStatus;
  size?: 'sm' | 'md' | 'lg';
  showIcon?: boolean;
  showLabel?: boolean;
  lastUpdatedAt?: string;
  lastUpdatedBy?: string;
  animate?: boolean;
  className?: string;
}

export function StatusBadge({
  status,
  size = 'md',
  showIcon = true,
  showLabel = true,
  lastUpdatedAt,
  lastUpdatedBy,
  animate = true,
  className = '',
}: StatusBadgeProps) {
  const config = STATUS_CONFIG[status];

  const sizeClasses = {
    sm: 'px-1.5 py-0.5 text-[10px]',
    md: 'px-2 py-1 text-xs',
    lg: 'px-3 py-1.5 text-sm',
  };

  const iconSizes = {
    sm: 'text-xs',
    md: 'text-sm',
    lg: 'text-base',
  };

  const badge = (
    <div
      className={`
        inline-flex items-center gap-1 rounded font-medium
        ${sizeClasses[size]}
        ${config.bgColor} ${config.borderColor} ${config.color}
        border
        ${className}
      `}
      title={
        lastUpdatedAt
          ? `${config.description}. Updated ${formatStatusTime(lastUpdatedAt)}${lastUpdatedBy ? ` by ${lastUpdatedBy}` : ''}`
          : config.description
      }
    >
      {showIcon && <span className={iconSizes[size]}>{config.icon}</span>}
      {showLabel && <span>{config.label}</span>}
    </div>
  );

  if (!animate) return badge;

  return (
    <motion.div
      initial={{ scale: 0.95, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ duration: 0.2 }}
    >
      {badge}
    </motion.div>
  );
}

/**
 * StatusDot
 *
 * Simple dot indicator for status (minimal variant).
 */
interface StatusDotProps {
  status: RecommendationStatus;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function StatusDot({ status, size = 'md', className = '' }: StatusDotProps) {
  const config = STATUS_CONFIG[status];

  const sizeClasses = {
    sm: 'w-2 h-2',
    md: 'w-3 h-3',
    lg: 'w-4 h-4',
  };

  const colorMap: Record<RecommendationStatus, string> = {
    pending_review: 'bg-white/40',
    under_review: 'bg-blue-400',
    needs_verification: 'bg-amber-400',
    needs_clarification: 'bg-cyan-400',
    approved: 'bg-green-400',
    rejected: 'bg-red-400',
    implemented: 'bg-violet-400',
  };

  return (
    <div
      className={`${sizeClasses[size]} rounded-full ${colorMap[status]} ${className}`}
      title={config.label}
    />
  );
}

export default StatusBadge;
