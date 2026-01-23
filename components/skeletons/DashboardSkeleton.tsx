'use client'

/**
 * Dashboard Skeleton
 *
 * Full dashboard loading placeholder with stat cards, charts, and tables.
 */

import { Skeleton } from './Skeleton'
import { StatCardSkeleton } from './StatCardSkeleton'

export function DashboardSkeleton() {
  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <Skeleton width={200} height={28} className="mb-2" />
          <Skeleton width={300} height={16} />
        </div>
        <Skeleton width={120} height={40} rounded="lg" />
      </div>

      {/* Stat Cards Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCardSkeleton />
        <StatCardSkeleton />
        <StatCardSkeleton />
        <StatCardSkeleton />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Chart 1 */}
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <Skeleton width={150} height={20} className="mb-4" />
          <Skeleton height={200} rounded="lg" />
        </div>
        {/* Chart 2 */}
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <Skeleton width={150} height={20} className="mb-4" />
          <Skeleton height={200} rounded="lg" />
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <Skeleton width={180} height={20} className="mb-4" />
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="flex items-center gap-4">
              <Skeleton width={40} height={40} rounded="full" />
              <Skeleton height={16} className="flex-1" />
              <Skeleton width={80} height={16} />
              <Skeleton width={60} height={24} rounded="full" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default DashboardSkeleton
