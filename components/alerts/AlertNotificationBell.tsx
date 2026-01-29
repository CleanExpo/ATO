'use client'

/**
 * Alert Notification Bell
 *
 * Displays unread alert count in a notification bell icon
 * Clicking opens the alerts dropdown
 */

import { useEffect, useState } from 'react'
import { Bell, BellDot } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

interface AlertNotificationBellProps {
  tenantId: string
  onClick?: () => void
}

export default function AlertNotificationBell({
  tenantId,
  onClick
}: AlertNotificationBellProps) {
  const [unreadCount, setUnreadCount] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [hasNewAlerts, setHasNewAlerts] = useState(false)

  useEffect(() => {
    fetchUnreadCount()

    // Poll for new alerts every 60 seconds
    const interval = setInterval(fetchUnreadCount, 60000)

    return () => clearInterval(interval)
  }, [tenantId])

  const fetchUnreadCount = async () => {
    try {
      const response = await fetch('/api/alerts?status=unread&limit=1')
      if (!response.ok) {
        throw new Error('Failed to fetch alert count')
      }

      const data = await response.json()
      const newCount = data.unreadCount || 0

      // Animate if count increased
      if (newCount > unreadCount) {
        setHasNewAlerts(true)
        setTimeout(() => setHasNewAlerts(false), 2000)
      }

      setUnreadCount(newCount)
    } catch (error) {
      console.error('Error fetching unread alert count:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleClick = () => {
    if (onClick) {
      onClick()
    }
  }

  return (
    <motion.button
      onClick={handleClick}
      className="relative p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      aria-label={`${unreadCount} unread alerts`}
    >
      {/* Bell Icon */}
      {unreadCount > 0 ? (
        <BellDot className="w-6 h-6 text-gray-700 dark:text-gray-300" />
      ) : (
        <Bell className="w-6 h-6 text-gray-700 dark:text-gray-300" />
      )}

      {/* Unread Count Badge */}
      <AnimatePresence>
        {unreadCount > 0 && (
          <motion.div
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            className="absolute -top-1 -right-1 min-w-[20px] h-5 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center px-1.5"
          >
            {unreadCount > 99 ? '99+' : unreadCount}
          </motion.div>
        )}
      </AnimatePresence>

      {/* New Alert Pulse Animation */}
      <AnimatePresence>
        {hasNewAlerts && (
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{
              scale: [1, 1.2, 1],
              opacity: [1, 0.5, 0]
            }}
            transition={{
              duration: 2,
              ease: "easeOut"
            }}
            className="absolute inset-0 rounded-lg border-2 border-blue-500"
          />
        )}
      </AnimatePresence>
    </motion.button>
  )
}
