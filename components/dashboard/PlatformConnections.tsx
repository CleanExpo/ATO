/**
 * Platform Connections Component
 *
 * Displays connected accounting platforms (Xero, MYOB, etc.)
 * with ability to switch between them and add new connections
 */

'use client'

import { motion } from 'framer-motion'
import { Building2 } from 'lucide-react'
import { PlatformSyncButton } from './PlatformSyncButton'

interface XeroConnection {
  tenant_id: string
  tenant_name: string
  organisation_name: string
  organisation_type: string
  country_code: string
  base_currency: string
  is_demo_company: boolean
  connected_at: string
  updated_at: string
}

interface MYOBConnection {
  id: string
  companyFileId: string
  companyFileName: string
  countryCode: string
  currencyCode: string
  connectedAt: string
  lastSyncedAt: string | null
  expiresAt: string
  isExpired: boolean
}

type PlatformConnection = {
  id: string
  platform: 'xero' | 'myob'
  name: string
  type: string
  country: string
  currency: string
  isDemo: boolean
  isExpired?: boolean
  tenantId?: string  // For Xero
  companyFileId?: string  // For MYOB
}

interface PlatformConnectionsProps {
  xeroConnections: XeroConnection[]
  myobConnections: MYOBConnection[]
  activeConnectionId: string | null
  onSelectConnection: (connection: PlatformConnection) => void
}

export function PlatformConnections({
  xeroConnections,
  myobConnections,
  activeConnectionId,
  onSelectConnection
}: PlatformConnectionsProps) {
  // Normalize connections from both platforms
  const normalizedConnections: PlatformConnection[] = [
    ...xeroConnections.map(conn => ({
      id: conn.tenant_id,
      platform: 'xero' as const,
      name: conn.organisation_name || conn.tenant_name,
      type: conn.organisation_type,
      country: conn.country_code,
      currency: conn.base_currency,
      isDemo: conn.is_demo_company,
      tenantId: conn.tenant_id,
    })),
    ...myobConnections.map(conn => ({
      id: conn.id,
      platform: 'myob' as const,
      name: conn.companyFileName,
      type: 'Company File',
      country: conn.countryCode,
      currency: conn.currencyCode,
      isDemo: false,
      isExpired: conn.isExpired,
      companyFileId: conn.companyFileId,
    }))
  ]

  const totalConnections = normalizedConnections.length

  return (
    <section style={{ marginTop: 'var(--space-xl)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-md)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)' }}>
          <Building2 className="w-4 h-4" style={{ color: 'var(--accent-xero)' }} />
          <span style={{ fontWeight: 600, fontSize: '14px' }}>
            Connected Platforms ({totalConnections})
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-xs)', fontSize: '12px', color: 'var(--text-muted)' }}>
          <span>{xeroConnections.length} Xero</span>
          <span>•</span>
          <span>{myobConnections.length} MYOB</span>
        </div>
      </div>

      <div className="layout-stack">
        {normalizedConnections.map((conn) => {
          const isActive = activeConnectionId === conn.id
          const platformColor = conn.platform === 'xero' ? 'var(--accent-xero)' : 'var(--accent-myob)'
          const platformColorDim = conn.platform === 'xero' ? 'var(--accent-xero-dim)' : 'var(--accent-myob-dim)'

          return (
            <motion.div
              key={conn.id}
              onClick={() => onSelectConnection(conn)}
              className={`org-card ${isActive ? 'org-card--active' : ''}`}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              style={{
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                border: isActive ? `2px solid ${platformColor}` : '1px solid var(--border-default)',
                background: isActive ? `${platformColorDim}20` : 'transparent',
              }}
              whileHover={{ scale: 1.01, borderColor: platformColor }}
            >
              {/* Platform Icon */}
              <div className="org-card__icon" style={{
                background: isActive ? platformColor : platformColorDim,
                color: isActive ? 'white' : platformColor,
              }}>
                <Building2 className="w-5 h-5" />
              </div>

              {/* Connection Info */}
              <div className="org-card__info">
                <div className="org-card__name" style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)' }}>
                  {conn.name}

                  {/* Platform Badge */}
                  <span style={{
                    fontSize: '10px',
                    padding: '2px 6px',
                    borderRadius: '4px',
                    background: platformColorDim,
                    color: platformColor,
                    fontWeight: 600,
                    textTransform: 'uppercase',
                  }}>
                    {conn.platform}
                  </span>

                  {/* Demo/Live Badge */}
                  {conn.isDemo ? (
                    <span style={{
                      fontSize: '10px',
                      padding: '2px 6px',
                      borderRadius: '4px',
                      background: 'var(--color-warning-dim)',
                      color: 'var(--color-warning)',
                      fontWeight: 600,
                    }}>
                      DEMO
                    </span>
                  ) : (
                    <span style={{
                      fontSize: '10px',
                      padding: '2px 6px',
                      borderRadius: '4px',
                      background: 'var(--color-success-dim)',
                      color: 'var(--color-success)',
                      fontWeight: 600,
                    }}>
                      LIVE
                    </span>
                  )}

                  {/* Expired Badge for MYOB */}
                  {conn.isExpired && (
                    <span style={{
                      fontSize: '10px',
                      padding: '2px 6px',
                      borderRadius: '4px',
                      background: 'var(--color-error-dim)',
                      color: 'var(--color-error)',
                      fontWeight: 600,
                    }}>
                      EXPIRED
                    </span>
                  )}
                </div>

                <div className="org-card__meta">
                  {conn.type} • {conn.country} • {conn.currency}
                </div>
              </div>

              {/* Active Indicator & Actions */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--space-sm)',
                flexDirection: 'column',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)' }}>
                  {isActive && (
                    <span style={{
                      fontSize: '11px',
                      color: platformColor,
                      fontWeight: 600,
                    }}>
                      Currently Viewing
                    </span>
                  )}
                  <button
                    onClick={(e) => { e.stopPropagation(); onSelectConnection(conn) }}
                    className={isActive ? 'btn btn-primary' : 'btn btn-secondary'}
                    style={{ padding: 'var(--space-xs) var(--space-md)' }}
                    disabled={conn.isExpired}
                  >
                    {conn.isExpired ? 'Reconnect' : isActive ? 'Active' : 'Select'}
                  </button>
                </div>

                {/* Sync Button */}
                {!conn.isExpired && (
                  <div onClick={(e) => e.stopPropagation()}>
                    <PlatformSyncButton
                      platform={conn.platform}
                      tenantId={conn.tenantId || conn.companyFileId || conn.id}
                      companyFileId={conn.companyFileId}
                      connectionName={conn.name}
                      className="btn-sm"
                    />
                  </div>
                )}
              </div>
            </motion.div>
          )
        })}
      </div>
    </section>
  )
}
