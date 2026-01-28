/**
 * Platform Badge Component
 *
 * Displays a colored badge for accounting platform (Xero, MYOB, QuickBooks)
 */

'use client'

import { motion } from 'framer-motion'

export type Platform = 'xero' | 'myob' | 'quickbooks'

interface PlatformBadgeProps {
  platform: Platform
  size?: 'sm' | 'md' | 'lg'
  showIcon?: boolean
  className?: string
}

const platformConfig = {
  xero: {
    label: 'Xero',
    color: '#13b5ea',
    colorDim: 'rgba(19, 181, 234, 0.1)',
  },
  myob: {
    label: 'MYOB',
    color: '#008591',
    colorDim: 'rgba(0, 133, 145, 0.1)',
  },
  quickbooks: {
    label: 'QuickBooks',
    color: '#2ca01c',
    colorDim: 'rgba(44, 160, 28, 0.1)',
  }
}

export function PlatformBadge({
  platform,
  size = 'md',
  showIcon = false,
  className = ''
}: PlatformBadgeProps) {
  const config = platformConfig[platform]

  const sizeStyles = {
    sm: {
      fontSize: '10px',
      padding: '2px 6px',
    },
    md: {
      fontSize: '11px',
      padding: '3px 8px',
    },
    lg: {
      fontSize: '12px',
      padding: '4px 10px',
    }
  }

  return (
    <motion.span
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.2 }}
      className={className}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '4px',
        fontWeight: 600,
        textTransform: 'uppercase',
        borderRadius: '4px',
        backgroundColor: config.colorDim,
        color: config.color,
        border: `1px solid ${config.color}30`,
        letterSpacing: '0.5px',
        ...sizeStyles[size]
      }}
    >
      {showIcon && (
        <span style={{
          width: '6px',
          height: '6px',
          borderRadius: '50%',
          backgroundColor: config.color,
        }} />
      )}
      {config.label}
    </motion.span>
  )
}

export function getPlatformLabel(platform: Platform): string {
  return platformConfig[platform].label
}

export function getPlatformColor(platform: Platform): string {
  return platformConfig[platform].color
}
