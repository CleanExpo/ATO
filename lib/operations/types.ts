/**
 * Operation Types for Visual Feedback System
 *
 * Centralised type definitions for tracking long-running operations
 * with Australian English localisation.
 */

// Operation categories
export type OperationType = 'sync' | 'analysis' | 'data-quality' | 'report'

// Operation lifecycle states
export type OperationStatus = 'queued' | 'running' | 'complete' | 'error' | 'cancelled'

// Toast notification types
export type ToastType = 'success' | 'error' | 'info' | 'warning'

/**
 * Core operation interface
 */
export interface Operation {
  id: string
  type: OperationType
  title: string
  subtitle?: string
  progress: number  // 0-100
  current?: number
  total?: number
  status: OperationStatus
  eta?: string
  startedAt: Date
  completedAt?: Date
  error?: string
  metadata?: Record<string, unknown>
}

/**
 * Toast notification interface
 */
export interface Toast {
  id: string
  type: ToastType
  title: string
  message?: string
  duration?: number  // ms, 0 = persist
  dismissible?: boolean
  action?: {
    label: string
    onClick: () => void
  }
}

/**
 * Global operation state
 */
export interface OperationState {
  operations: Map<string, Operation>
  toasts: Toast[]
  globalStatus: 'idle' | 'working' | 'error'
}

/**
 * Operation action types for reducer
 */
export type OperationAction =
  | { type: 'START_OPERATION'; payload: Omit<Operation, 'startedAt' | 'status'> & { status?: OperationStatus } }
  | { type: 'UPDATE_OPERATION'; payload: { id: string; updates: Partial<Operation> } }
  | { type: 'COMPLETE_OPERATION'; payload: { id: string; error?: string } }
  | { type: 'REMOVE_OPERATION'; payload: { id: string } }
  | { type: 'ADD_TOAST'; payload: Omit<Toast, 'id'> }
  | { type: 'REMOVE_TOAST'; payload: { id: string } }
  | { type: 'CLEAR_ALL_TOASTS' }

/**
 * Operation configuration by type
 */
export const OPERATION_CONFIG: Record<OperationType, {
  colour: string
  icon: string
  defaultTitle: string
  defaultDuration?: string
}> = {
  sync: {
    colour: '#0ea5e9',  // Sky blue
    icon: 'RefreshCw',
    defaultTitle: 'Synchronising Data',
    defaultDuration: '5-10 minutes'
  },
  analysis: {
    colour: '#8b5cf6',  // Purple
    icon: 'Brain',
    defaultTitle: 'AI Analysis',
    defaultDuration: '30-60 minutes'
  },
  'data-quality': {
    colour: '#06b6d4',  // Cyan
    icon: 'Shield',
    defaultTitle: 'Data Quality Scan',
    defaultDuration: '2-5 minutes'
  },
  report: {
    colour: '#f59e0b',  // Amber
    icon: 'FileText',
    defaultTitle: 'Generating Report',
    defaultDuration: '15 seconds - 2 minutes'
  }
}

/**
 * Australian English operation messages
 */
export const OPERATION_MESSAGES = {
  sync: {
    start: 'Synchronising historical data...',
    progress: 'Synchronised {current} of {total} transactions',
    complete: 'Data synchronisation complete',
    error: 'Synchronisation failed'
  },
  analysis: {
    start: 'Analysing transactions with AI...',
    progress: 'Analysing {year}... ({progress}%)',
    complete: 'Analysis complete. {count} opportunities found.',
    error: 'Analysis encountered an error'
  },
  'data-quality': {
    start: 'Scanning data quality...',
    progress: 'Scanned {current} of {total} transactions',
    complete: 'Data quality scan complete',
    error: 'Data quality scan failed'
  },
  report: {
    start: 'Generating {type} report...',
    progress: 'Building report sections...',
    complete: 'Report ready for download',
    error: 'Report generation failed'
  }
} as const

/**
 * Animation presets for Framer Motion
 */
export const ANIMATION_PRESETS = {
  spring: {
    gentle: { damping: 20, stiffness: 100 },
    snappy: { damping: 25, stiffness: 300 },
    bouncy: { damping: 15, stiffness: 200 }
  },
  duration: {
    fast: 0.15,
    normal: 0.3,
    slow: 0.5
  },
  easing: {
    easeOut: [0.16, 1, 0.3, 1],
    easeInOut: [0.65, 0, 0.35, 1]
  }
} as const
