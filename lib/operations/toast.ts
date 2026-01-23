/**
 * Toast Utility
 *
 * Standalone toast API for use outside React components.
 * Uses a ref pattern to access the OperationProvider dispatch.
 */

import type { Toast, ToastType } from './types'

// Store reference to the toast dispatcher
let toastDispatcher: ((toast: Omit<Toast, 'id'>) => string) | null = null

/**
 * Set the toast dispatcher (called by OperationProvider on mount)
 */
export function setToastDispatcher(dispatcher: (toast: Omit<Toast, 'id'>) => string) {
  toastDispatcher = dispatcher
}

/**
 * Clear the toast dispatcher (called by OperationProvider on unmount)
 */
export function clearToastDispatcher() {
  toastDispatcher = null
}

/**
 * Create a toast notification
 */
function createToast(type: ToastType, title: string, message?: string, options?: Partial<Toast>): string {
  if (!toastDispatcher) {
    console.warn('Toast dispatcher not initialised. Make sure OperationProvider is mounted.')
    return ''
  }

  return toastDispatcher({
    type,
    title,
    message,
    ...options
  })
}

/**
 * Toast API for use anywhere in the application
 */
export const toast = {
  /**
   * Show a success toast
   */
  success: (title: string, message?: string, options?: Partial<Toast>) =>
    createToast('success', title, message, options),

  /**
   * Show an error toast
   */
  error: (title: string, message?: string, options?: Partial<Toast>) =>
    createToast('error', title, message, { ...options, duration: 0 }), // Errors persist by default

  /**
   * Show an info toast
   */
  info: (title: string, message?: string, options?: Partial<Toast>) =>
    createToast('info', title, message, options),

  /**
   * Show a warning toast
   */
  warning: (title: string, message?: string, options?: Partial<Toast>) =>
    createToast('warning', title, message, options),

  /**
   * Show a custom toast
   */
  custom: (toast: Omit<Toast, 'id'>) => {
    if (!toastDispatcher) {
      console.warn('Toast dispatcher not initialised. Make sure OperationProvider is mounted.')
      return ''
    }
    return toastDispatcher(toast)
  }
}

export default toast
