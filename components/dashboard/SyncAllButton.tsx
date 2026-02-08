/**
 * Sync All Organisations Button
 *
 * Triggers sync + analysis for all connected Xero/MYOB orgs sequentially.
 * Displays per-org progress as each completes.
 */

'use client'

import { useState } from 'react'
import { Database, Loader2, CheckCircle2, XCircle, ChevronDown, ChevronUp } from 'lucide-react'
import { useRouter } from 'next/navigation'

interface OrgInfo {
  platform: 'xero' | 'myob'
  tenantId: string
  companyFileId?: string
  name: string
}

interface OrgStatus {
  name: string
  status: 'pending' | 'syncing' | 'analyzing' | 'complete' | 'error'
  error?: string
}

interface SyncAllButtonProps {
  organisations: OrgInfo[]
  className?: string
}

export function SyncAllButton({ organisations, className = '' }: SyncAllButtonProps) {
  const router = useRouter()
  const [isRunning, setIsRunning] = useState(false)
  const [orgStatuses, setOrgStatuses] = useState<OrgStatus[]>([])
  const [expanded, setExpanded] = useState(true)
  const [allDone, setAllDone] = useState(false)

  async function startSyncForOrg(org: OrgInfo): Promise<boolean> {
    const syncEndpoint = org.platform === 'xero'
      ? '/api/audit/sync-historical'
      : '/api/myob/sync'

    const syncBody = org.platform === 'xero'
      ? { tenantId: org.tenantId }
      : { companyFileId: org.companyFileId || org.tenantId }

    // Start sync
    const syncResponse = await fetch(syncEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(syncBody),
    })

    if (!syncResponse.ok) {
      let msg = `Sync failed: ${syncResponse.status}`
      try {
        const err = await syncResponse.json()
        msg = err.error || msg
      } catch { /* non-JSON */ }
      throw new Error(msg)
    }

    // Poll sync status until complete
    const pollUrl = `/api/audit/sync-historical?tenantId=${org.tenantId}`
    let syncComplete = false
    for (let i = 0; i < 300; i++) { // 10 min max (300 * 2s)
      await sleep(2000)
      try {
        const statusRes = await fetch(pollUrl)
        if (!statusRes.ok) continue
        const status = await statusRes.json()
        if (status.status === 'complete') { syncComplete = true; break }
        if (status.status === 'error') throw new Error(status.errorMessage || 'Sync failed')
      } catch (err) {
        if (err instanceof Error && err.message !== 'Sync failed') continue
        throw err
      }
    }

    if (!syncComplete) throw new Error('Sync timed out after 10 minutes')
    return true
  }

  async function startAnalysisForOrg(org: OrgInfo): Promise<boolean> {
    const analyzeResponse = await fetch('/api/audit/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tenantId: org.tenantId, platform: org.platform }),
    })

    if (!analyzeResponse.ok) {
      let msg = `Analysis failed: ${analyzeResponse.status}`
      try {
        const err = await analyzeResponse.json()
        msg = err.error || msg
      } catch { /* non-JSON */ }
      throw new Error(msg)
    }

    // Poll analysis status until complete
    for (let i = 0; i < 600; i++) { // 20 min max (600 * 2s)
      await sleep(2000)
      try {
        const statusRes = await fetch(`/api/audit/analyze?tenantId=${org.tenantId}`)
        if (!statusRes.ok) continue
        const status = await statusRes.json()
        if (status.status === 'complete') return true
        if (status.status === 'error') throw new Error(status.errorMessage || 'Analysis failed')
      } catch (err) {
        if (err instanceof Error && !err.message.includes('failed')) continue
        throw err
      }
    }

    throw new Error('Analysis timed out after 20 minutes')
  }

  async function syncAll() {
    if (organisations.length === 0) return

    setIsRunning(true)
    setAllDone(false)
    setExpanded(true)

    const statuses: OrgStatus[] = organisations.map(org => ({
      name: org.name,
      status: 'pending',
    }))
    setOrgStatuses([...statuses])

    for (let i = 0; i < organisations.length; i++) {
      const org = organisations[i]

      // Sync phase
      statuses[i] = { name: org.name, status: 'syncing' }
      setOrgStatuses([...statuses])

      try {
        await startSyncForOrg(org)

        // Analysis phase
        statuses[i] = { name: org.name, status: 'analyzing' }
        setOrgStatuses([...statuses])

        await startAnalysisForOrg(org)

        statuses[i] = { name: org.name, status: 'complete' }
        setOrgStatuses([...statuses])
      } catch (err) {
        statuses[i] = {
          name: org.name,
          status: 'error',
          error: err instanceof Error ? err.message : 'Unknown error',
        }
        setOrgStatuses([...statuses])
        // Continue to next org even if one fails
      }
    }

    setIsRunning(false)
    setAllDone(true)
  }

  const completedCount = orgStatuses.filter(s => s.status === 'complete').length
  const errorCount = orgStatuses.filter(s => s.status === 'error').length
  const currentOrg = orgStatuses.find(s => s.status === 'syncing' || s.status === 'analyzing')

  return (
    <div style={{ marginTop: 'var(--space-sm)' }}>
      <button
        onClick={syncAll}
        disabled={isRunning || organisations.length === 0}
        className={`btn btn-primary ${className}`}
        style={{
          width: '100%',
          padding: 'var(--space-sm) var(--space-lg)',
          opacity: isRunning ? 0.8 : 1,
          cursor: isRunning ? 'not-allowed' : 'pointer',
          fontSize: '13px',
          fontWeight: 700,
          letterSpacing: '0.05em',
          textTransform: 'uppercase' as const,
        }}
      >
        {isRunning ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" style={{ marginRight: '8px', display: 'inline' }} />
            Syncing {currentOrg?.name || '...'}
            ({completedCount}/{organisations.length})
          </>
        ) : allDone ? (
          <>
            <CheckCircle2 className="w-4 h-4" style={{ marginRight: '8px', display: 'inline' }} />
            All Done — {completedCount} of {organisations.length} Complete
          </>
        ) : (
          <>
            <Database className="w-4 h-4" style={{ marginRight: '8px', display: 'inline' }} />
            Sync & Analyse All {organisations.length} Organisations
          </>
        )}
      </button>

      {/* Per-org status list */}
      {orgStatuses.length > 0 && (
        <div style={{
          marginTop: 'var(--space-sm)',
          border: '1px solid var(--border-default)',
          borderRadius: '8px',
          overflow: 'hidden',
        }}>
          <button
            onClick={() => setExpanded(!expanded)}
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: 'var(--space-xs) var(--space-sm)',
              background: 'rgba(255,255,255,0.02)',
              border: 'none',
              color: 'var(--text-muted)',
              fontSize: '11px',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            <span>
              Progress: {completedCount} complete{errorCount > 0 ? `, ${errorCount} failed` : ''}
            </span>
            {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </button>

          {expanded && (
            <div style={{ padding: 'var(--space-xs) var(--space-sm)' }}>
              {orgStatuses.map((s, idx) => (
                <div
                  key={idx}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 'var(--space-xs)',
                    padding: '4px 0',
                    fontSize: '12px',
                  }}
                >
                  {s.status === 'complete' && <CheckCircle2 className="w-3.5 h-3.5" style={{ color: 'var(--color-success)' }} />}
                  {s.status === 'error' && <XCircle className="w-3.5 h-3.5" style={{ color: 'var(--color-error)' }} />}
                  {s.status === 'syncing' && <Loader2 className="w-3.5 h-3.5 animate-spin" style={{ color: 'var(--accent-xero)' }} />}
                  {s.status === 'analyzing' && <Loader2 className="w-3.5 h-3.5 animate-spin" style={{ color: '#FBBF24' }} />}
                  {s.status === 'pending' && <div style={{ width: 14, height: 14, borderRadius: '50%', border: '1px solid var(--border-default)' }} />}

                  <span style={{ color: s.status === 'error' ? 'var(--color-error)' : 'var(--text-default)', fontWeight: 500 }}>
                    {s.name}
                  </span>

                  <span style={{ color: 'var(--text-muted)', fontSize: '10px', marginLeft: 'auto' }}>
                    {s.status === 'syncing' && 'Syncing data...'}
                    {s.status === 'analyzing' && 'AI analysis...'}
                    {s.status === 'complete' && 'Done'}
                    {s.status === 'error' && (s.error || 'Failed')}
                    {s.status === 'pending' && 'Waiting'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* View Results button when all done */}
      {allDone && completedCount > 0 && (
        <button
          onClick={() => router.push('/dashboard/strategies')}
          className="btn btn-primary"
          style={{
            width: '100%',
            marginTop: 'var(--space-sm)',
            padding: 'var(--space-sm) var(--space-lg)',
            fontSize: '13px',
            fontWeight: 700,
            letterSpacing: '0.05em',
            textTransform: 'uppercase' as const,
          }}
        >
          View Results for All Organisations →
        </button>
      )}
    </div>
  )
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}
