/**
 * Multi-Tenant Types
 *
 * TypeScript types for multi-organization support
 */

export type UserRole = 'owner' | 'admin' | 'accountant' | 'read_only'

export type SubscriptionTier = 'free' | 'pro' | 'enterprise'

export type SubscriptionStatus = 'active' | 'trial' | 'suspended' | 'cancelled'

export type InvitationStatus = 'pending' | 'accepted' | 'expired' | 'revoked'

export type BusinessSize = 'micro' | 'small' | 'medium' | 'large'

export interface Organization {
  id: string
  name: string
  abn?: string
  industry?: string
  businessSize?: BusinessSize

  // Xero connection
  xeroTenantId?: string
  xeroConnectedAt?: string

  // Settings
  settings: OrganizationSettings

  // Subscription
  subscriptionTier: SubscriptionTier
  subscriptionStatus: SubscriptionStatus

  // Timestamps
  createdAt: string
  updatedAt: string
  deletedAt?: string
}

export interface OrganizationSettings {
  financialYearEnd?: string
  taxPreferences?: {
    rndAutoRegister?: boolean
    div7aMonitoring?: boolean
    quarterlyBAS?: boolean
  }
  reportingPreferences?: {
    emailReports?: boolean
    recipientEmail?: string
    reportFrequency?: 'weekly' | 'monthly' | 'quarterly'
  }
  notifications?: {
    deadlineReminders?: boolean
    analysisComplete?: boolean
    newRecommendations?: boolean
  }
}

export interface UserOrganizationAccess {
  id: string
  userId: string
  organizationId: string
  tenantId?: string
  role: UserRole
  createdAt: string
  updatedAt: string
}

export interface OrganizationInvitation {
  id: string
  organizationId: string
  email: string
  role: UserRole
  invitedBy: string
  token: string
  expiresAt: string
  status: InvitationStatus
  acceptedAt?: string
  acceptedBy?: string
  createdAt: string
  updatedAt: string
}

export interface OrganizationActivityLog {
  id: string
  organizationId: string
  userId?: string
  action: string
  entityType?: string
  entityId?: string
  metadata?: Record<string, unknown>
  ipAddress?: string
  userAgent?: string
  createdAt: string
}

export interface UserOrganizationSummary {
  organizationId: string
  organizationName: string
  role: UserRole
  xeroConnected: boolean
  memberCount: number
}

export interface OrganizationMember {
  userId: string
  email: string
  name?: string
  role: UserRole
  joinedAt: string
  lastActiveAt?: string
}

/**
 * Role permission levels
 */
export const ROLE_PERMISSIONS = {
  owner: {
    canManageMembers: true,
    canManageSettings: true,
    canDeleteOrganization: true,
    canViewReports: true,
    canGenerateReports: true,
    canViewAnalysis: true,
    canTriggerAnalysis: true,
    canManageBilling: true,
  },
  admin: {
    canManageMembers: true,
    canManageSettings: true,
    canDeleteOrganization: false,
    canViewReports: true,
    canGenerateReports: true,
    canViewAnalysis: true,
    canTriggerAnalysis: true,
    canManageBilling: false,
  },
  accountant: {
    canManageMembers: false,
    canManageSettings: false,
    canDeleteOrganization: false,
    canViewReports: true,
    canGenerateReports: true,
    canViewAnalysis: true,
    canTriggerAnalysis: true,
    canManageBilling: false,
  },
  read_only: {
    canManageMembers: false,
    canManageSettings: false,
    canDeleteOrganization: false,
    canViewReports: true,
    canGenerateReports: false,
    canViewAnalysis: true,
    canTriggerAnalysis: false,
    canManageBilling: false,
  },
} as const

/**
 * Check if user has permission for an action
 */
export function hasPermission(
  role: UserRole,
  permission: keyof typeof ROLE_PERMISSIONS[UserRole]
): boolean {
  return ROLE_PERMISSIONS[role]?.[permission] ?? false
}

/**
 * Get role display name
 */
export function getRoleDisplayName(role: UserRole): string {
  const names: Record<UserRole, string> = {
    owner: 'Owner',
    admin: 'Administrator',
    accountant: 'Accountant',
    read_only: 'Read Only',
  }
  return names[role]
}

/**
 * Get role description
 */
export function getRoleDescription(role: UserRole): string {
  const descriptions: Record<UserRole, string> = {
    owner: 'Full control over organization, including billing and deletion',
    admin: 'Manage users and settings, generate reports and analysis',
    accountant: 'View all data, generate reports, and run tax analysis',
    read_only: 'View-only access to reports and analysis results',
  }
  return descriptions[role]
}

/**
 * Get role badge color
 */
export function getRoleBadgeColor(role: UserRole): string {
  const colors: Record<UserRole, string> = {
    owner: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
    admin: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    accountant: 'bg-green-500/10 text-green-400 border-green-500/20',
    read_only: 'bg-gray-500/10 text-gray-400 border-gray-500/20',
  }
  return colors[role]
}

/**
 * Sort roles by permission level (owner first)
 */
export function sortRolesByPermission(roles: UserRole[]): UserRole[] {
  const order: UserRole[] = ['owner', 'admin', 'accountant', 'read_only']
  return roles.sort((a, b) => order.indexOf(a) - order.indexOf(b))
}
