'use client'

/**
 * Base Skeleton Component
 *
 * Performant CSS-based shimmer animation for loading states.
 */

interface SkeletonProps {
  className?: string
  width?: string | number
  height?: string | number
  rounded?: 'none' | 'sm' | 'md' | 'lg' | 'full'
}

const ROUNDED_CLASSES = {
  none: 'rounded-none',
  sm: 'rounded',
  md: 'rounded-lg',
  lg: 'rounded-xl',
  full: 'rounded-full'
}

export function Skeleton({
  className = '',
  width,
  height,
  rounded = 'md'
}: SkeletonProps) {
  return (
    <div
      className={`skeleton ${ROUNDED_CLASSES[rounded]} ${className}`}
      style={{
        width: typeof width === 'number' ? `${width}px` : width,
        height: typeof height === 'number' ? `${height}px` : height
      }}
    />
  )
}

export default Skeleton
