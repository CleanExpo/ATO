'use client'

/**
 * Operation Provider Wrapper
 *
 * Wraps the application with operation context and mounts
 * global visual feedback components (indicator + toasts).
 */

import { ReactNode, useEffect } from 'react'
import { OperationProvider as ContextProvider, useOperations } from '@/lib/operations/operation-context'
import { setToastDispatcher, clearToastDispatcher } from '@/lib/operations/toast'
import { GlobalOperationIndicator } from '@/components/operations/GlobalOperationIndicator'
import { ToastContainer } from '@/components/operations/ToastContainer'

/**
 * Inner component that sets up the toast dispatcher
 */
function ToastDispatcherSetup({ children }: { children: ReactNode }) {
  const { addToast } = useOperations()

  useEffect(() => {
    setToastDispatcher(addToast)
    return () => clearToastDispatcher()
  }, [addToast])

  return <>{children}</>
}

/**
 * Main provider component
 */
export function OperationProviderWrapper({ children }: { children: ReactNode }) {
  return (
    <ContextProvider>
      <ToastDispatcherSetup>
        {children}
        <GlobalOperationIndicator />
        <ToastContainer />
      </ToastDispatcherSetup>
    </ContextProvider>
  )
}

export default OperationProviderWrapper
