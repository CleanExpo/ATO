'use client'

/**
 * Page Skeleton - Dark-theme loading placeholder
 *
 * Reusable skeleton for dashboard analysis pages using the dark theme.
 * Variants: 'default' (stats + chart), 'analysis' (header + list), 'form' (form fields)
 */

interface PageSkeletonProps {
  variant?: 'default' | 'analysis' | 'form'
}

function ShimmerBlock({ className = '', height = '16px' }: { className?: string; height?: string }) {
  return (
    <div
      className={`animate-pulse rounded ${className}`}
      style={{ background: 'var(--surface-2, rgba(255,255,255,0.05))', height }}
    />
  )
}

export function PageSkeleton({ variant = 'default' }: PageSkeletonProps) {
  if (variant === 'analysis') {
    return (
      <div className="space-y-6 animate-in fade-in duration-300">
        <div>
          <ShimmerBlock height="28px" className="w-48 mb-2" />
          <ShimmerBlock height="16px" className="w-72" />
        </div>
        <div className="space-y-3">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="card p-4 flex items-center gap-4">
              <ShimmerBlock height="40px" className="w-10 rounded-lg" />
              <div className="flex-1 space-y-2">
                <ShimmerBlock height="14px" className="w-3/4" />
                <ShimmerBlock height="12px" className="w-1/2" />
              </div>
              <ShimmerBlock height="24px" className="w-20 rounded-full" />
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (variant === 'form') {
    return (
      <div className="space-y-6 animate-in fade-in duration-300 max-w-2xl">
        <ShimmerBlock height="28px" className="w-48 mb-6" />
        {[...Array(4)].map((_, i) => (
          <div key={i} className="space-y-2">
            <ShimmerBlock height="14px" className="w-24" />
            <ShimmerBlock height="40px" className="w-full rounded-lg" />
          </div>
        ))}
        <ShimmerBlock height="44px" className="w-32 rounded-lg" />
      </div>
    )
  }

  // Default variant
  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="flex items-center justify-between">
        <div>
          <ShimmerBlock height="28px" className="w-48 mb-2" />
          <ShimmerBlock height="16px" className="w-72" />
        </div>
        <ShimmerBlock height="40px" className="w-28 rounded-lg" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="card p-5">
            <ShimmerBlock height="12px" className="w-20 mb-3" />
            <ShimmerBlock height="24px" className="w-28" />
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card p-6">
          <ShimmerBlock height="16px" className="w-36 mb-4" />
          <ShimmerBlock height="200px" />
        </div>
        <div className="card p-6">
          <ShimmerBlock height="16px" className="w-36 mb-4" />
          <ShimmerBlock height="200px" />
        </div>
      </div>
    </div>
  )
}

export default PageSkeleton
