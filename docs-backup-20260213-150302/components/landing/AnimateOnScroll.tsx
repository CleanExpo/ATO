'use client'

import { motion } from 'framer-motion'
import type { ReactNode } from 'react'

const EASING = [0.19, 1, 0.22, 1] as const

interface AnimateOnScrollProps {
  children: ReactNode
  className?: string
  delay?: number
  direction?: 'up' | 'left'
}

export function AnimateOnScroll({
  children,
  className,
  delay = 0,
  direction = 'up',
}: AnimateOnScrollProps) {
  return (
    <motion.div
      initial={{ opacity: 0, ...(direction === 'up' ? { y: 20 } : { x: -20 }) }}
      whileInView={{ opacity: 1, y: 0, x: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.8, delay, ease: EASING }}
      className={className}
    >
      {children}
    </motion.div>
  )
}
