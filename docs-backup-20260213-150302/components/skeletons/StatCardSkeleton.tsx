'use client'

/**
 * Stat Card Skeleton
 *
 * Loading placeholder for StatCard components.
 */

import { Skeleton } from './Skeleton'

interface StatCardSkeletonProps {
  showIcon?: boolean
  showTrend?: boolean
}

export function StatCardSkeleton({ showIcon = true, showTrend = true }: StatCardSkeletonProps) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          {/* Label */}
          <Skeleton width={80} height={14} className="mb-2" />
          {/* Value */}
          <Skeleton width={120} height={28} className="mb-1" />
          {/* Trend */}
          {showTrend && (
            <Skeleton width={60} height={12} />
          )}
        </div>
        {/* Icon */}
        {showIcon && (
          <Skeleton width={40} height={40} rounded="lg" />
        )}
      </div>
    </div>
  )
}

export default StatCardSkeleton
