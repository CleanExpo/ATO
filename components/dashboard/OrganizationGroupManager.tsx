/**
 * Organization Group Manager
 *
 * Allows linking multiple organizations together for:
 * - Consolidated pricing ($199 per additional org in same group)
 * - Consolidated analysis (cross-entity fund movements, inter-company transactions)
 * - Consolidated reporting (one report covering all linked entities)
 *
 * Business Logic:
 * - Linked orgs: $995 + $199 per additional = Consolidated analysis
 * - Separate orgs: $995 each = Separate reports
 */

'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Building2,
  Link as LinkIcon,
  Unlink,
  Plus,
  Check,
  AlertCircle,
  DollarSign,
  TrendingDown,
  Loader2,
  ChevronDown,
  ChevronUp,
} from 'lucide-react'
import { formatPrice } from '@/lib/stripe/client'

interface Organization {
  id: string
  name: string
  group_id: string | null
  is_primary_in_group: boolean
  xero_tenant_id?: string
}

interface OrganizationGroup {
  id: string
  name: string
  description: string | null
  organizationCount: number
  organizations: Organization[]
}

interface OrganizationGroupManagerProps {
  organizations: Organization[]
  onOrganizationsUpdated: () => void
}

export function OrganizationGroupManager({
  organizations,
  onOrganizationsUpdated,
}: OrganizationGroupManagerProps) {
  const [groups, setGroups] = useState<OrganizationGroup[]>([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState(false)
  const [creatingGroup, setCreatingGroup] = useState(false)
  const [newGroupName, setNewGroupName] = useState('')
  const [linkingOrg, setLinkingOrg] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchGroups()
  }, [])

  const fetchGroups = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/organizations/groups')
      const data = await response.json()
      setGroups(data.groups || [])
    } catch (err) {
      console.error('Failed to fetch groups:', err)
      setError('Failed to load organization groups')
    } finally {
      setLoading(false)
    }
  }

  const createGroup = async () => {
    if (!newGroupName.trim()) return

    try {
      setCreatingGroup(true)
      setError(null)

      const response = await fetch('/api/organizations/groups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newGroupName }),
      })

      if (!response.ok) {
        throw new Error('Failed to create group')
      }

      setNewGroupName('')
      await fetchGroups()
    } catch (err) {
      console.error('Failed to create group:', err)
      setError('Failed to create group')
    } finally {
      setCreatingGroup(false)
    }
  }

  const linkOrgToGroup = async (orgId: string, groupId: string) => {
    try {
      setLinkingOrg(orgId)
      setError(null)

      const response = await fetch(`/api/organizations/${orgId}/link-group`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ groupId }),
      })

      if (!response.ok) {
        throw new Error('Failed to link organization')
      }

      await fetchGroups()
      onOrganizationsUpdated()
    } catch (err) {
      console.error('Failed to link organization:', err)
      setError('Failed to link organization')
    } finally {
      setLinkingOrg(null)
    }
  }

  const unlinkOrg = async (orgId: string) => {
    try {
      setLinkingOrg(orgId)
      setError(null)

      const response = await fetch(`/api/organizations/${orgId}/link-group`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        throw new Error('Failed to unlink organization')
      }

      await fetchGroups()
      onOrganizationsUpdated()
    } catch (err) {
      console.error('Failed to unlink organization:', err)
      setError('Failed to unlink organization')
    } finally {
      setLinkingOrg(null)
    }
  }

  // Calculate pricing impact
  const ungroupedOrgs = organizations.filter(org => !org.group_id)
  const groupedOrgs = organizations.filter(org => org.group_id)

  const currentPricing = {
    ungroupedCost: ungroupedOrgs.length * 99500, // $995 each
    groupedBaseCost: groups.length * 99500, // $995 per group
    groupedAdditionalCost: Math.max(0, groupedOrgs.length - groups.length) * 19900, // $199 per additional
  }

  const totalCost = currentPricing.ungroupedCost + currentPricing.groupedBaseCost + currentPricing.groupedAdditionalCost

  const potentialSavingsIfAllLinked = organizations.length > 1
    ? (organizations.length * 99500) - (99500 + (organizations.length - 1) * 19900)
    : 0

  return (
    <div style={{
      marginTop: 'var(--space-xl)',
      padding: 'var(--space-md)',
      background: 'rgba(99, 102, 241, 0.05)',
      borderRadius: '12px',
      border: '1px solid rgba(99, 102, 241, 0.2)',
    }}>
      {/* Header */}
      <div
        onClick={() => setExpanded(!expanded)}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          cursor: 'pointer',
          marginBottom: expanded ? 'var(--space-md)' : 0,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)' }}>
          <LinkIcon className="w-5 h-5" style={{ color: 'rgb(99, 102, 241)' }} />
          <h3 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)' }}>
            Organization Grouping
          </h3>
          {potentialSavingsIfAllLinked > 0 && !expanded && (
            <span style={{
              fontSize: '12px',
              padding: '2px 8px',
              borderRadius: '12px',
              background: 'rgba(16, 185, 129, 0.2)',
              color: 'rgb(16, 185, 129)',
              fontWeight: 600,
            }}>
              Save {formatPrice(potentialSavingsIfAllLinked)}
            </span>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)' }}>
          {!expanded && (
            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
              {groups.length} group{groups.length === 1 ? '' : 's'} • {ungroupedOrgs.length} separate
            </span>
          )}
          {expanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
        </div>
      </div>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
          >
            {/* Pricing Impact */}
            <div style={{
              padding: 'var(--space-md)',
              marginBottom: 'var(--space-md)',
              background: 'rgba(255, 255, 255, 0.03)',
              borderRadius: '8px',
              border: '1px solid rgba(255, 255, 255, 0.1)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-xs)', marginBottom: 'var(--space-sm)' }}>
                <DollarSign className="w-4 h-4" style={{ color: 'var(--text-muted)' }} />
                <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)' }}>
                  Pricing Breakdown
                </span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 'var(--space-sm)', fontSize: '12px' }}>
                <div>
                  <span style={{ color: 'var(--text-muted)' }}>Separate orgs ({ungroupedOrgs.length}):</span>
                  <span style={{ float: 'right', fontWeight: 600 }}>
                    {formatPrice(currentPricing.ungroupedCost)}
                  </span>
                </div>
                <div>
                  <span style={{ color: 'var(--text-muted)' }}>Grouped base ({groups.length}):</span>
                  <span style={{ float: 'right', fontWeight: 600 }}>
                    {formatPrice(currentPricing.groupedBaseCost)}
                  </span>
                </div>
                <div>
                  <span style={{ color: 'var(--text-muted)' }}>Additional orgs:</span>
                  <span style={{ float: 'right', fontWeight: 600 }}>
                    {formatPrice(currentPricing.groupedAdditionalCost)}
                  </span>
                </div>
                <div style={{ borderTop: '1px solid rgba(255, 255, 255, 0.1)', paddingTop: 'var(--space-xs)' }}>
                  <span style={{ color: 'var(--text-primary)', fontWeight: 700 }}>Total:</span>
                  <span style={{ float: 'right', fontWeight: 700, color: 'rgb(99, 102, 241)' }}>
                    {formatPrice(totalCost)}
                  </span>
                </div>
              </div>

              {potentialSavingsIfAllLinked > 0 && ungroupedOrgs.length > 1 && (
                <div style={{
                  marginTop: 'var(--space-sm)',
                  padding: 'var(--space-xs)',
                  background: 'rgba(16, 185, 129, 0.1)',
                  borderRadius: '6px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 'var(--space-xs)',
                  fontSize: '11px',
                  color: 'rgb(16, 185, 129)',
                }}>
                  <TrendingDown className="w-3 h-3" />
                  <span>Link all orgs together to save {formatPrice(potentialSavingsIfAllLinked)}</span>
                </div>
              )}
            </div>

            {error && (
              <div style={{
                padding: 'var(--space-sm)',
                marginBottom: 'var(--space-md)',
                background: 'rgba(239, 68, 68, 0.1)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                borderRadius: '8px',
                fontSize: '13px',
                color: 'rgb(239, 68, 68)',
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--space-xs)',
              }}>
                <AlertCircle className="w-4 h-4" />
                {error}
              </div>
            )}

            {/* Create New Group */}
            <div style={{
              marginBottom: 'var(--space-md)',
              display: 'flex',
              gap: 'var(--space-xs)',
            }}>
              <input
                type="text"
                placeholder="New group name (e.g., 'My Business Group')"
                value={newGroupName}
                onChange={(e) => setNewGroupName(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && createGroup()}
                disabled={creatingGroup}
                style={{
                  flex: 1,
                  padding: 'var(--space-sm)',
                  background: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  borderRadius: '6px',
                  color: 'var(--text-primary)',
                  fontSize: '13px',
                }}
              />
              <button
                onClick={createGroup}
                disabled={!newGroupName.trim() || creatingGroup}
                style={{
                  padding: 'var(--space-sm) var(--space-md)',
                  background: creatingGroup || !newGroupName.trim()
                    ? 'rgba(99, 102, 241, 0.3)'
                    : 'rgb(99, 102, 241)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: creatingGroup || !newGroupName.trim() ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 'var(--space-xs)',
                }}
              >
                {creatingGroup ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Creating...
                  </>
                ) : (
                  <>
                    <Plus className="w-4 h-4" />
                    Create Group
                  </>
                )}
              </button>
            </div>

            {/* Existing Groups */}
            {groups.map((group) => (
              <div
                key={group.id}
                style={{
                  marginBottom: 'var(--space-md)',
                  padding: 'var(--space-md)',
                  background: 'rgba(255, 255, 255, 0.03)',
                  borderRadius: '8px',
                  border: '1px solid rgba(99, 102, 241, 0.3)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-sm)' }}>
                  <div>
                    <h4 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>
                      {group.name}
                    </h4>
                    <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                      {group.organizationCount} organization{group.organizationCount === 1 ? '' : 's'}
                      {group.organizationCount > 1 && (
                        <> • ${formatPrice(99500)} + {formatPrice(19900)} × {group.organizationCount - 1}</>
                      )}
                    </p>
                  </div>
                </div>

                {/* Organizations in this group */}
                {group.organizations.map((org) => (
                  <div
                    key={org.id}
                    style={{
                      padding: 'var(--space-sm)',
                      marginBottom: 'var(--space-xs)',
                      background: 'rgba(255, 255, 255, 0.02)',
                      borderRadius: '6px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)' }}>
                      <Building2 className="w-4 h-4" style={{ color: 'rgb(99, 102, 241)' }} />
                      <span style={{ fontSize: '13px', color: 'var(--text-primary)' }}>
                        {org.name}
                      </span>
                      {org.is_primary_in_group && (
                        <span style={{
                          fontSize: '10px',
                          padding: '2px 6px',
                          borderRadius: '4px',
                          background: 'rgba(99, 102, 241, 0.2)',
                          color: 'rgb(99, 102, 241)',
                          fontWeight: 600,
                        }}>
                          PRIMARY
                        </span>
                      )}
                    </div>

                    <button
                      onClick={() => unlinkOrg(org.id)}
                      disabled={linkingOrg === org.id}
                      style={{
                        padding: '4px 8px',
                        background: 'rgba(239, 68, 68, 0.1)',
                        color: 'rgb(239, 68, 68)',
                        border: 'none',
                        borderRadius: '4px',
                        fontSize: '11px',
                        fontWeight: 600,
                        cursor: linkingOrg === org.id ? 'not-allowed' : 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                      }}
                    >
                      {linkingOrg === org.id ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : (
                        <Unlink className="w-3 h-3" />
                      )}
                      Unlink
                    </button>
                  </div>
                ))}
              </div>
            ))}

            {/* Ungrouped Organizations */}
            {ungroupedOrgs.length > 0 && (
              <div style={{
                padding: 'var(--space-md)',
                background: 'rgba(255, 255, 255, 0.03)',
                borderRadius: '8px',
                border: '1px solid rgba(255, 255, 255, 0.1)',
              }}>
                <h4 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: 'var(--space-sm)' }}>
                  Separate Organizations ({ungroupedOrgs.length})
                </h4>
                <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: 'var(--space-md)' }}>
                  Each pays full price: {formatPrice(99500)} per organization
                </p>

                {ungroupedOrgs.map((org) => (
                  <div
                    key={org.id}
                    style={{
                      padding: 'var(--space-sm)',
                      marginBottom: 'var(--space-xs)',
                      background: 'rgba(255, 255, 255, 0.02)',
                      borderRadius: '6px',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)' }}>
                        <Building2 className="w-4 h-4" style={{ color: 'var(--text-muted)' }} />
                        <span style={{ fontSize: '13px', color: 'var(--text-primary)' }}>
                          {org.name}
                        </span>
                      </div>

                      {groups.length > 0 && (
                        <select
                          onChange={(e) => {
                            if (e.target.value) {
                              linkOrgToGroup(org.id, e.target.value)
                            }
                          }}
                          disabled={linkingOrg === org.id}
                          style={{
                            padding: '4px 8px',
                            background: 'rgba(99, 102, 241, 0.1)',
                            color: 'rgb(99, 102, 241)',
                            border: '1px solid rgba(99, 102, 241, 0.3)',
                            borderRadius: '4px',
                            fontSize: '11px',
                            fontWeight: 600,
                            cursor: 'pointer',
                          }}
                        >
                          <option value="">Link to group...</option>
                          {groups.map((g) => (
                            <option key={g.id} value={g.id}>
                              {g.name}
                            </option>
                          ))}
                        </select>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
