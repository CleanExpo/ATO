/**
 * Organization Context
 *
 * Provides current organization context throughout the app.
 * Enables organization switching for multi-tenant users.
 */

'use client'

import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import type { Organization, UserRole } from '@/lib/types/multi-tenant'

interface OrganizationContextValue {
  // Current organization
  currentOrganization: Organization | null
  currentRole: UserRole | null
  isLoading: boolean

  // Organization list
  organizations: Organization[]

  // Actions
  switchOrganization: (organizationId: string) => Promise<void>
  refreshOrganizations: () => Promise<void>
  createOrganization: (name: string, abn?: string) => Promise<Organization>
}

const OrganizationContext = createContext<OrganizationContextValue | undefined>(undefined)

interface OrganizationProviderProps {
  children: ReactNode
  initialOrganizationId?: string
}

export function OrganizationProvider({
  children,
  initialOrganizationId,
}: OrganizationProviderProps) {
  const router = useRouter()
  const [currentOrganization, setCurrentOrganization] = useState<Organization | null>(null)
  const [currentRole, setCurrentRole] = useState<UserRole | null>(null)
  const [organizations, setOrganizations] = useState<Organization[]>([])
  const [isLoading, setIsLoading] = useState(true)

  // Fetch user's organizations
  const fetchOrganizations = async () => {
    try {
      const response = await fetch('/api/organizations')
      // Silently handle auth failures - app works in single-user mode without this
      if (!response.ok) {
        console.warn('Organizations API unavailable - running in single-user mode')
        setIsLoading(false)
        return
      }

      const data = await response.json()
      setOrganizations(data.organizations || [])

      // Auto-select first organization if none selected
      if (!currentOrganization && data.organizations.length > 0) {
        const orgId =
          initialOrganizationId ||
          localStorage.getItem('currentOrganizationId') ||
          data.organizations[0].id

        const org = data.organizations.find((o: Organization) => o.id === orgId)
        if (org) {
          setCurrentOrganization(org)
          localStorage.setItem('currentOrganizationId', org.id)

          // Fetch role for this organization
          const roleResponse = await fetch(`/api/organizations/${org.id}/role`)
          if (roleResponse.ok) {
            const roleData = await roleResponse.json()
            setCurrentRole(roleData.role)
          }
        }
      }
    } catch (error) {
      // Silently fail - multi-tenant features not required for single-user mode
      console.warn('Organizations context unavailable:', error)
    } finally {
      setIsLoading(false)
    }
  }

  // Switch to different organization
  const switchOrganization = async (organizationId: string) => {
    const org = organizations.find((o) => o.id === organizationId)
    if (!org) {
      console.error(`Organization ${organizationId} not found`)
      return
    }

    setCurrentOrganization(org)
    localStorage.setItem('currentOrganizationId', organizationId)

    // Fetch role for new organization
    try {
      const response = await fetch(`/api/organizations/${organizationId}/role`)
      if (response.ok) {
        const data = await response.json()
        setCurrentRole(data.role)
      }
    } catch (error) {
      console.error('Failed to fetch role:', error)
    }

    // Refresh the page to reload data for new organization
    router.refresh()
  }

  // Create new organization
  const createOrganization = async (name: string, abn?: string): Promise<Organization> => {
    const response = await fetch('/api/organizations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, abn }),
    })

    if (!response.ok) {
      throw new Error('Failed to create organization')
    }

    const data = await response.json()
    const newOrg = data.organization

    // Add to list and switch to it
    setOrganizations((prev) => [...prev, newOrg])
    await switchOrganization(newOrg.id)

    return newOrg
  }

  // Refresh organizations list
  const refreshOrganizations = async () => {
    setIsLoading(true)
    await fetchOrganizations()
  }

  // Initial load
  useEffect(() => {
    fetchOrganizations()
  }, [])

  const value: OrganizationContextValue = {
    currentOrganization,
    currentRole,
    isLoading,
    organizations,
    switchOrganization,
    refreshOrganizations,
    createOrganization,
  }

  return <OrganizationContext.Provider value={value}>{children}</OrganizationContext.Provider>
}

/**
 * Hook to use organization context
 */
export function useOrganization() {
  const context = useContext(OrganizationContext)
  if (context === undefined) {
    throw new Error('useOrganization must be used within OrganizationProvider')
  }
  return context
}

/**
 * Hook to require organization context (throws if no organization selected)
 */
export function useRequireOrganization() {
  const context = useOrganization()

  if (!context.currentOrganization) {
    throw new Error('No organization selected')
  }

  return {
    ...context,
    currentOrganization: context.currentOrganization,
    currentRole: context.currentRole!,
  }
}
