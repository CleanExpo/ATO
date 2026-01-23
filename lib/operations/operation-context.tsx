'use client'

/**
 * Operation Context
 *
 * Global state management for long-running operations and toast notifications.
 * Uses React Context + useReducer for lightweight state management.
 */

import { createContext, useContext, useReducer, useCallback, ReactNode } from 'react'
import type {
  Operation,
  OperationState,
  OperationAction,
  Toast,
  ToastType
} from './types'

// Generate unique IDs
const generateId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`

// Initial state
const initialState: OperationState = {
  operations: new Map(),
  toasts: [],
  globalStatus: 'idle'
}

// Reducer function
function operationReducer(state: OperationState, action: OperationAction): OperationState {
  switch (action.type) {
    case 'START_OPERATION': {
      const newOperations = new Map(state.operations)
      const operation: Operation = {
        ...action.payload,
        status: action.payload.status || 'running',
        startedAt: new Date(),
        progress: action.payload.progress || 0
      }
      newOperations.set(operation.id, operation)

      return {
        ...state,
        operations: newOperations,
        globalStatus: 'working'
      }
    }

    case 'UPDATE_OPERATION': {
      const { id, updates } = action.payload
      const existing = state.operations.get(id)
      if (!existing) return state

      const newOperations = new Map(state.operations)
      newOperations.set(id, { ...existing, ...updates })

      return {
        ...state,
        operations: newOperations
      }
    }

    case 'COMPLETE_OPERATION': {
      const { id, error } = action.payload
      const existing = state.operations.get(id)
      if (!existing) return state

      const newOperations = new Map(state.operations)
      newOperations.set(id, {
        ...existing,
        status: error ? 'error' : 'complete',
        progress: error ? existing.progress : 100,
        completedAt: new Date(),
        error
      })

      // Check if any operations are still running
      const stillRunning = Array.from(newOperations.values()).some(
        op => op.status === 'running' || op.status === 'queued'
      )

      return {
        ...state,
        operations: newOperations,
        globalStatus: stillRunning ? 'working' : (error ? 'error' : 'idle')
      }
    }

    case 'REMOVE_OPERATION': {
      const newOperations = new Map(state.operations)
      newOperations.delete(action.payload.id)

      const stillRunning = Array.from(newOperations.values()).some(
        op => op.status === 'running' || op.status === 'queued'
      )

      return {
        ...state,
        operations: newOperations,
        globalStatus: stillRunning ? 'working' : 'idle'
      }
    }

    case 'ADD_TOAST': {
      const toast: Toast = {
        ...action.payload,
        id: generateId(),
        duration: action.payload.duration ?? 5000,
        dismissible: action.payload.dismissible ?? true
      }

      return {
        ...state,
        toasts: [...state.toasts, toast]
      }
    }

    case 'REMOVE_TOAST': {
      return {
        ...state,
        toasts: state.toasts.filter(t => t.id !== action.payload.id)
      }
    }

    case 'CLEAR_ALL_TOASTS': {
      return {
        ...state,
        toasts: []
      }
    }

    default:
      return state
  }
}

// Context type
interface OperationContextValue {
  state: OperationState
  // Operation methods
  startOperation: (operation: Omit<Operation, 'id' | 'startedAt' | 'status'> & { id?: string }) => string
  updateOperation: (id: string, updates: Partial<Operation>) => void
  completeOperation: (id: string, error?: string) => void
  removeOperation: (id: string) => void
  getOperation: (id: string) => Operation | undefined
  getActiveOperations: () => Operation[]
  // Toast methods
  addToast: (toast: Omit<Toast, 'id'>) => string
  removeToast: (id: string) => void
  clearAllToasts: () => void
  // Convenience toast methods
  toast: {
    success: (title: string, message?: string) => string
    error: (title: string, message?: string) => string
    info: (title: string, message?: string) => string
    warning: (title: string, message?: string) => string
  }
}

// Create context
const OperationContext = createContext<OperationContextValue | null>(null)

// Provider component
export function OperationProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(operationReducer, initialState)

  // Operation methods
  const startOperation = useCallback((
    operation: Omit<Operation, 'id' | 'startedAt' | 'status'> & { id?: string }
  ): string => {
    const id = operation.id || generateId()
    dispatch({
      type: 'START_OPERATION',
      payload: { ...operation, id, progress: operation.progress || 0 }
    })
    return id
  }, [])

  const updateOperation = useCallback((id: string, updates: Partial<Operation>) => {
    dispatch({ type: 'UPDATE_OPERATION', payload: { id, updates } })
  }, [])

  const completeOperation = useCallback((id: string, error?: string) => {
    dispatch({ type: 'COMPLETE_OPERATION', payload: { id, error } })
  }, [])

  const removeOperation = useCallback((id: string) => {
    dispatch({ type: 'REMOVE_OPERATION', payload: { id } })
  }, [])

  const getOperation = useCallback((id: string): Operation | undefined => {
    return state.operations.get(id)
  }, [state.operations])

  const getActiveOperations = useCallback((): Operation[] => {
    return Array.from(state.operations.values()).filter(
      op => op.status === 'running' || op.status === 'queued'
    )
  }, [state.operations])

  // Toast methods
  const addToast = useCallback((toast: Omit<Toast, 'id'>): string => {
    const id = generateId()
    dispatch({ type: 'ADD_TOAST', payload: toast })
    return id
  }, [])

  const removeToast = useCallback((id: string) => {
    dispatch({ type: 'REMOVE_TOAST', payload: { id } })
  }, [])

  const clearAllToasts = useCallback(() => {
    dispatch({ type: 'CLEAR_ALL_TOASTS' })
  }, [])

  // Convenience toast methods
  const createToast = useCallback((type: ToastType, title: string, message?: string): string => {
    return addToast({ type, title, message })
  }, [addToast])

  const toast = {
    success: (title: string, message?: string) => createToast('success', title, message),
    error: (title: string, message?: string) => createToast('error', title, message),
    info: (title: string, message?: string) => createToast('info', title, message),
    warning: (title: string, message?: string) => createToast('warning', title, message)
  }

  const value: OperationContextValue = {
    state,
    startOperation,
    updateOperation,
    completeOperation,
    removeOperation,
    getOperation,
    getActiveOperations,
    addToast,
    removeToast,
    clearAllToasts,
    toast
  }

  return (
    <OperationContext.Provider value={value}>
      {children}
    </OperationContext.Provider>
  )
}

// Custom hook to use operation context
export function useOperations() {
  const context = useContext(OperationContext)
  if (!context) {
    throw new Error('useOperations must be used within an OperationProvider')
  }
  return context
}

// Export a standalone toast function for use outside React components
// This will be implemented with a ref pattern in the provider
export { OperationContext }
