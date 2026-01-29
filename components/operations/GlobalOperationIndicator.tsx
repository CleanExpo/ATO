'use client'

/**
 * Global Operation Indicator
 *
 * Fixed position indicator showing all active operations.
 * Provides visual feedback that the system is working.
 */

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { RefreshCw, Brain, Shield, FileText, ChevronDown } from 'lucide-react'
import { useOperations } from '@/lib/operations/operation-context'
import { OPERATION_CONFIG, ANIMATION_PRESETS, type OperationType } from '@/lib/operations/types'

// Icon mapping
const ICONS: Record<OperationType, typeof RefreshCw> = {
  sync: RefreshCw,
  analysis: Brain,
  'data-quality': Shield,
  report: FileText
}

export function GlobalOperationIndicator() {
  const { getActiveOperations } = useOperations()
  const [isExpanded, setIsExpanded] = useState(true)

  const activeOperations = getActiveOperations()
  const hasOperations = activeOperations.length > 0

  if (!hasOperations) return null

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, x: 100, scale: 0.95 }}
        animate={{ opacity: 1, x: 0, scale: 1 }}
        exit={{ opacity: 0, x: 100, scale: 0.95 }}
        transition={{ type: 'spring', ...ANIMATION_PRESETS.spring.gentle }}
        className="fixed top-20 right-4 z-50 w-80"
      >
        {/* Card Container */}
        <div className="bg-white/95 backdrop-blur-xl rounded-2xl shadow-2xl border border-slate-200/50 overflow-hidden">
          {/* Header */}
          <motion.button
            onClick={() => setIsExpanded(!isExpanded)}
            className="w-full px-4 py-3 flex items-center justify-between bg-gradient-to-r from-slate-50 to-white hover:from-slate-100 hover:to-slate-50 transition-colors"
          >
            <div className="flex items-center gap-3">
              {/* Animated pulse indicator */}
              <div className="relative">
                <motion.div
                  className="w-3 h-3 rounded-full bg-emerald-500"
                  animate={{
                    scale: [1, 1.2, 1],
                    opacity: [1, 0.7, 1]
                  }}
                  transition={{
                    duration: 1.5,
                    repeat: Infinity,
                    ease: 'easeInOut'
                  }}
                />
                <motion.div
                  className="absolute inset-0 w-3 h-3 rounded-full bg-emerald-500"
                  animate={{
                    scale: [1, 2],
                    opacity: [0.5, 0]
                  }}
                  transition={{
                    duration: 1.5,
                    repeat: Infinity,
                    ease: 'easeOut'
                  }}
                />
              </div>
              <span className="font-semibold text-slate-700">
                {activeOperations.length} operation{activeOperations.length !== 1 ? 's' : ''} running
              </span>
            </div>
            <motion.div
              animate={{ rotate: isExpanded ? 180 : 0 }}
              transition={{ duration: 0.2 }}
            >
              <ChevronDown className="w-5 h-5 text-slate-400" />
            </motion.div>
          </motion.button>

          {/* Operations List */}
          <AnimatePresence>
            {isExpanded && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden"
              >
                <div className="px-4 pb-4 space-y-3">
                  {activeOperations.map((operation, index) => {
                    const config = OPERATION_CONFIG[operation.type]
                    const Icon = ICONS[operation.type]

                    return (
                      <motion.div
                        key={operation.id}
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        transition={{ delay: index * 0.05 }}
                        className="relative"
                      >
                        {/* Operation Card */}
                        <div
                          className="p-3 rounded-xl border transition-all"
                          style={{
                            borderColor: `${config.colour}30`,
                            backgroundColor: `${config.colour}08`
                          }}
                        >
                          {/* Header Row */}
                          <div className="flex items-start justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <motion.div
                                animate={{ rotate: operation.type === 'sync' ? 360 : 0 }}
                                transition={{
                                  duration: 2,
                                  repeat: operation.type === 'sync' ? Infinity : 0,
                                  ease: 'linear'
                                }}
                                style={{ color: config.colour }}
                              >
                                <Icon className="w-4 h-4" />
                              </motion.div>
                              <span className="font-medium text-sm text-slate-700">
                                {operation.title}
                              </span>
                            </div>
                            <span
                              className="text-xs font-bold"
                              style={{ color: config.colour }}
                            >
                              {operation.progress.toFixed(0)}%
                            </span>
                          </div>

                          {/* Subtitle */}
                          {operation.subtitle && (
                            <p className="text-xs text-slate-500 mb-2">
                              {operation.subtitle}
                            </p>
                          )}

                          {/* Progress Bar */}
                          <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                            <motion.div
                              className="h-full rounded-full relative overflow-hidden"
                              style={{ backgroundColor: config.colour }}
                              initial={{ width: 0 }}
                              animate={{ width: `${operation.progress}%` }}
                              transition={{ type: 'spring', ...ANIMATION_PRESETS.spring.gentle }}
                            >
                              {/* Shimmer effect */}
                              <motion.div
                                className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent"
                                animate={{ x: ['-100%', '200%'] }}
                                transition={{
                                  duration: 1.5,
                                  repeat: Infinity,
                                  ease: 'linear'
                                }}
                              />
                            </motion.div>
                          </div>

                          {/* Footer Row */}
                          <div className="flex items-center justify-between mt-2">
                            {operation.current !== undefined && operation.total !== undefined && (
                              <span className="text-xs text-slate-400">
                                {operation.current.toLocaleString()} of {operation.total.toLocaleString()}
                              </span>
                            )}
                            {operation.eta && (
                              <span className="text-xs text-slate-400">
                                ETA: {operation.eta}
                              </span>
                            )}
                          </div>
                        </div>
                      </motion.div>
                    )
                  })}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </AnimatePresence>
  )
}

export default GlobalOperationIndicator
