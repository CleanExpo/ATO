/**
 * Activity Feed Component
 *
 * Live activity log with:
 * - Auto-scrolling list with fade-in animations
 * - Color-coded by message type
 * - Slide-in animation from right
 * - Timestamps with relative time
 * - Auto-prune old items to prevent memory leaks
 * - Pause on hover
 */

'use client'

import React, { useEffect, useRef, useState } from 'react'
import { CheckCircle, AlertCircle, AlertTriangle, Info } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'

export interface ActivityItem {
  id: string
  timestamp: Date
  message: string
  type: 'info' | 'success' | 'warning' | 'error'
  icon?: React.ReactNode
  metadata?: Record<string, unknown>
}

interface ActivityFeedProps {
  items: ActivityItem[]
  maxItems?: number // Max visible items (default 10)
  autoScroll?: boolean
  showTimestamps?: boolean
  className?: string
}

const typeConfig = {
  info: {
    icon: Info,
    color: 'text-sky-400',
    bg: 'bg-sky-500/10',
    border: 'border-sky-500/30'
  },
  success: {
    icon: CheckCircle,
    color: 'text-emerald-400',
    bg: 'bg-emerald-500/10',
    border: 'border-emerald-500/30'
  },
  warning: {
    icon: AlertTriangle,
    color: 'text-amber-400',
    bg: 'bg-amber-500/10',
    border: 'border-amber-500/30'
  },
  error: {
    icon: AlertCircle,
    color: 'text-red-400',
    bg: 'bg-red-500/10',
    border: 'border-red-500/30'
  }
}

export default function ActivityFeed({
  items,
  maxItems = 10,
  autoScroll = true,
  showTimestamps = true,
  className = ''
}: ActivityFeedProps) {
  const [isPaused, setIsPaused] = useState(false)
  const feedRef = useRef<HTMLDivElement>(null)
  const [displayItems, setDisplayItems] = useState<ActivityItem[]>([])

  // Update display items, keeping only the most recent maxItems
  useEffect(() => {
    const recentItems = items.slice(-maxItems)
    setDisplayItems(recentItems)
  }, [items, maxItems])

  // Auto-scroll to bottom when new items arrive (unless paused)
  useEffect(() => {
    if (autoScroll && !isPaused && feedRef.current) {
      feedRef.current.scrollTop = feedRef.current.scrollHeight
    }
  }, [displayItems, autoScroll, isPaused])

  const formatTimestamp = (date: Date) => {
    try {
      return formatDistanceToNow(date, { addSuffix: true })
    } catch {
      return 'just now'
    }
  }

  return (
    <div className={`glass-card ${className}`}>
      <div className="p-4 border-b border-[var(--border-default)]">
        <h3 className="font-semibold text-[var(--text-primary)]">Activity Feed</h3>
        <p className="text-xs text-[var(--text-muted)] mt-1">
          Live updates from current operations
        </p>
      </div>

      <div
        ref={feedRef}
        className="max-h-96 overflow-y-auto p-4 space-y-2"
        onMouseEnter={() => setIsPaused(true)}
        onMouseLeave={() => setIsPaused(false)}
      >
        {displayItems.length === 0 ? (
          <div className="text-center py-8 text-[var(--text-muted)]">
            <Info className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No activity yet</p>
          </div>
        ) : (
          displayItems.map((item, index) => {
            const config = typeConfig[item.type]
            const Icon = (item.icon || config.icon) as React.ComponentType<{ className?: string }>

            return (
              <div
                key={item.id}
                className={`flex items-start gap-3 p-3 rounded-lg border ${config.bg} ${config.border}
                  animate-[slideInRight_0.3s_ease-out] opacity-0`}
                style={{
                  animation: `slideInRight 0.3s ease-out ${index * 0.05}s forwards`
                }}
              >
                <div className={`mt-0.5 ${config.color}`}>
                  <Icon className="w-4 h-4" />
                </div>

                <div className="flex-1 min-w-0">
                  <p className="text-sm text-[var(--text-primary)] leading-snug">
                    {item.message}
                  </p>
                  {showTimestamps && (
                    <p className="text-xs text-[var(--text-muted)] mt-1">
                      {formatTimestamp(item.timestamp)}
                    </p>
                  )}
                </div>
              </div>
            )
          })
        )}
      </div>

      {isPaused && (
        <div className="px-4 py-2 text-xs text-center text-[var(--text-muted)] border-t border-[var(--border-default)]">
          Paused - Move mouse away to resume auto-scroll
        </div>
      )}

      {/* Add custom animation */}
      <style jsx>{`
        @keyframes slideInRight {
          from {
            opacity: 0;
            transform: translateX(20px);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }
      `}</style>
    </div>
  )
}
