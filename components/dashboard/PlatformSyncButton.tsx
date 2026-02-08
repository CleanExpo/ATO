/**
 * Platform Sync Button Component
 *
 * Unified button to trigger historical data sync for any platform (Xero, MYOB, etc.)
 * Automatically detects platform and calls appropriate API
 */

'use client'

import { useState } from 'react'
import { Database, Loader2 } from 'lucide-react'
import { useRouter } from 'next/navigation'

interface PlatformSyncButtonProps {
  platform: 'xero' | 'myob'
  tenantId: string
  companyFileId?: string // For MYOB
  connectionName: string
  className?: string
}

export function PlatformSyncButton({
  platform,
  tenantId,
  companyFileId,
  connectionName,
  className = ''
}: PlatformSyncButtonProps) {
  const router = useRouter()
  const [isStarting, setIsStarting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function startSync() {
    setIsStarting(true)
    setError(null)

    try {
      let syncEndpoint: string
      let syncBody: { tenantId?: string; companyFileId?: string }

      if (platform === 'xero') {
        syncEndpoint = '/api/audit/sync'
        syncBody = { tenantId }
      } else if (platform === 'myob') {
        syncEndpoint = '/api/myob/sync'
        syncBody = { companyFileId: companyFileId || tenantId }
      } else {
        throw new Error(`Unsupported platform: ${platform}`)
      }

      console.log(`[${platform.toUpperCase()} Sync] Starting sync for ${connectionName}`)

      const response = await fetch(syncEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(syncBody)
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || `Sync failed: ${response.status}`)
      }

      const data = await response.json()
      console.log(`[${platform.toUpperCase()} Sync] Started successfully:`, data)

      // Redirect to forensic audit page with platform context
      router.push(`/dashboard/forensic-audit?platform=${platform}&tenantId=${tenantId}`)

    } catch (err) {
      console.error(`[${platform.toUpperCase()} Sync] Error:`, err)
      setError(err instanceof Error ? err.message : 'Failed to start sync')
    } finally {
      setIsStarting(false)
    }
  }

  return (
    <div>
      <button
        onClick={startSync}
        disabled={isStarting}
        className={`btn btn-primary ${className}`}
        style={{
          opacity: isStarting ? 0.6 : 1,
          cursor: isStarting ? 'not-allowed' : 'pointer',
        }}
      >
        {isStarting ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            Starting {platform.toUpperCase()} sync...
          </>
        ) : (
          <>
            <Database className="w-4 h-4" />
            Sync & Analyse {platform === 'myob' ? 'MYOB' : 'Xero'} Data
          </>
        )}
      </button>

      {error && (
        <p style={{
          color: 'var(--color-error)',
          fontSize: '12px',
          marginTop: 'var(--space-xs)'
        }}>
          {error}
        </p>
      )}
    </div>
  )
}
