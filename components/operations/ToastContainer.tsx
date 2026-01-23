'use client'

/**
 * Toast Container
 *
 * Container for stacked toast notifications.
 * Fixed position bottom-right of viewport.
 */

import { AnimatePresence } from 'framer-motion'
import { useOperations } from '@/lib/operations/operation-context'
import { Toast } from './Toast'

export function ToastContainer() {
  const { state, removeToast } = useOperations()

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col-reverse gap-3">
      <AnimatePresence mode="popLayout">
        {state.toasts.map(toast => (
          <Toast
            key={toast.id}
            toast={toast}
            onDismiss={removeToast}
          />
        ))}
      </AnimatePresence>
    </div>
  )
}

export default ToastContainer
