/**
 * Progress Bar Component
 *
 * Shows progress with percentage and optional ETA
 */

import React from 'react'

interface ProgressBarProps {
  progress: number // 0-100
  label?: string
  showPercentage?: boolean
  eta?: string
  color?: 'blue' | 'green' | 'orange' | 'red'
  height?: 'sm' | 'md' | 'lg'
}

const colorClasses = {
  blue: 'bg-blue-600',
  green: 'bg-green-600',
  orange: 'bg-orange-600',
  red: 'bg-red-600',
}

const heightClasses = {
  sm: 'h-1',
  md: 'h-2',
  lg: 'h-4',
}

export default function ProgressBar({
  progress,
  label,
  showPercentage = true,
  eta,
  color = 'blue',
  height = 'md',
}: ProgressBarProps) {
  const clampedProgress = Math.min(100, Math.max(0, progress))

  return (
    <div className="w-full">
      {(label || showPercentage || eta) && (
        <div className="flex items-center justify-between mb-2">
          <div className="flex-1">
            {label && <span className="text-sm font-medium text-gray-700">{label}</span>}
          </div>
          <div className="flex items-center gap-3 text-sm text-gray-600">
            {showPercentage && (
              <span className="font-semibold">{clampedProgress.toFixed(0)}%</span>
            )}
            {eta && <span className="text-xs">ETA: {eta}</span>}
          </div>
        </div>
      )}

      <div className={`w-full bg-gray-200 rounded-full ${heightClasses[height]} overflow-hidden`}>
        <div
          className={`${colorClasses[color]} ${heightClasses[height]} rounded-full transition-all duration-300 ease-out`}
          style={{ width: `${clampedProgress}%` }}
        />
      </div>
    </div>
  )
}
