interface SkeletonProps {
  /** Width - CSS value or number (px) */
  width?: string | number
  /** Height - CSS value or number (px) */
  height?: string | number
  /** Use rounded-full for circle/avatar shapes */
  circle?: boolean
  /** Additional className */
  className?: string
}

/**
 * Skeleton - Loading placeholder with shimmer animation
 *
 * Primary loading state per DESIGN_SYSTEM.md section 6.5.
 * Uses horizontal gradient sweep, respects prefers-reduced-motion.
 *
 * @example
 * <Skeleton width={200} height={24} />
 * <Skeleton width="100%" height={16} />
 * <Skeleton width={40} height={40} circle />
 */
export function Skeleton({
  width = '100%',
  height = 16,
  circle = false,
  className = '',
}: SkeletonProps) {
  const w = typeof width === 'number' ? `${width}px` : width
  const h = typeof height === 'number' ? `${height}px` : height

  return (
    <div
      className={`skeleton ${className}`.trim()}
      style={{
        width: w,
        height: h,
        borderRadius: circle ? 'var(--radius-full)' : 'var(--radius-sm)',
      }}
      aria-hidden="true"
    />
  )
}

/**
 * SkeletonText - Multi-line text placeholder
 */
export function SkeletonText({
  lines = 3,
  className = '',
}: {
  lines?: number
  className?: string
}) {
  return (
    <div className={`layout-stack ${className}`.trim()} style={{ gap: 'var(--space-sm)' }} aria-hidden="true">
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          width={i === lines - 1 ? '60%' : '100%'}
          height={12}
        />
      ))}
    </div>
  )
}

/**
 * SkeletonCard - Card-shaped loading placeholder
 */
export function SkeletonCard({ className = '' }: { className?: string }) {
  return (
    <div className={`card ${className}`.trim()} aria-hidden="true">
      <Skeleton width={80} height={10} />
      <div style={{ marginTop: 'var(--space-sm)' }}>
        <Skeleton width={120} height={28} />
      </div>
      <div style={{ marginTop: 'var(--space-sm)' }}>
        <Skeleton width={60} height={16} />
      </div>
    </div>
  )
}
