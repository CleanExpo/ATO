'use client'
import { motion, HTMLMotionProps } from 'framer-motion'

interface GlassCardProps extends HTMLMotionProps<'div'> {
  highlight?: boolean
  children: React.ReactNode
  className?: string
}

export function GlassCard({ highlight, children, className = '', ...props }: GlassCardProps) {
  return (
    <motion.div
      className={`glass-card p-6 ${highlight ? 'border-[var(--accent)]/30' : ''} ${className}`}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      {...props}
    >
      {children}
    </motion.div>
  )
}
