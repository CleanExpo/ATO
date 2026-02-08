/**
 * Organization Members Page
 *
 * View and manage organization team members, roles, and invitations
 */

'use client'

import { useState, useEffect } from 'react'
import { useOrganization } from '@/lib/context/OrganizationContext'
import { hasPermission, getRoleBadgeColor, getRoleDisplayName, type UserRole } from '@/lib/types/multi-tenant'
import {
  Users,
  Plus,
  Trash2,
  Mail,
  UserPlus,
  AlertTriangle,
  Copy,
  CheckCircle,
  RefreshCw,
  MoreVertical,
} from 'lucide-react'

interface OrganizationMember {
  userId: string
  email: string
  name?: string
  role: string
  joinedAt: string
  lastActiveAt?: string
}

interface Invitation {
  id: string
  email: string
  role: string
  status: string
  expiresAt: string
  createdAt: string
}

export default function OrganizationMembersPage() {
  const { currentOrganization, currentRole } = useOrganization()

  const [members, setMembers] = useState<OrganizationMember[]>([])
  const [invitations, setInvitations] = useState<Invitation[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showInviteDialog, setShowInviteDialog] = useState(false)

  // Check permissions
  const canManageMembers =
    currentRole && hasPermission(currentRole, 'canManageMembers')

  // Load members and invitations
  useEffect(() => {
    if (!currentOrganization) return
    loadData()
  }, [currentOrganization])

  const loadData = async () => {
    if (!currentOrganization) return

    setIsLoading(true)
    setError(null)

    try {
      // Load members
      const membersResponse = await fetch(
        `/api/organizations/${currentOrganization.id}/members`
      )

      if (!membersResponse.ok) {
        throw new Error('Failed to load members')
      }

      const membersData = await membersResponse.json()
      setMembers(membersData.members || [])

      // Load invitations (if admin)
      if (canManageMembers) {
        const invitationsResponse = await fetch(
          `/api/organizations/${currentOrganization.id}/invitations`
        )

        if (invitationsResponse.ok) {
          const invitationsData = await invitationsResponse.json()
          setInvitations(
            invitationsData.invitations?.filter(
              (inv: Invitation) => inv.status === 'pending'
            ) || []
          )
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data')
    } finally {
      setIsLoading(false)
    }
  }

  const handleRemoveMember = async (userId: string, userEmail: string) => {
    if (
      !confirm(`Are you sure you want to remove ${userEmail} from this organization?`)
    ) {
      return
    }

    try {
      const response = await fetch(
        `/api/organizations/${currentOrganization?.id}/members?userId=${userId}`,
        { method: 'DELETE' }
      )

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to remove member')
      }

      await loadData()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to remove member')
    }
  }

  const handleRevokeInvitation = async (invitationId: string) => {
    try {
      const response = await fetch(
        `/api/organizations/${currentOrganization?.id}/invitations?invitationId=${invitationId}`,
        { method: 'DELETE' }
      )

      if (!response.ok) {
        throw new Error('Failed to revoke invitation')
      }

      await loadData()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to revoke invitation')
    }
  }

  if (!currentOrganization) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 text-white p-8 flex items-center justify-center">
        <div className="text-center">
          <Users className="w-12 h-12 text-gray-500 mx-auto mb-4" />
          <p className="text-gray-400">No organization selected</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 text-white p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-green-500/10 rounded-lg">
                <Users className="w-8 h-8 text-green-400" />
              </div>
              <div>
                <h1 className="text-3xl font-bold">Team Members</h1>
                <p className="text-gray-400 mt-1">
                  Manage access to {currentOrganization.name}
                </p>
              </div>
            </div>

            {canManageMembers && (
              <button
                onClick={() => setShowInviteDialog(true)}
                className="flex items-center gap-2 px-4 py-2 bg-green-500 hover:bg-green-600 rounded-lg transition-colors"
              >
                <UserPlus className="w-5 h-5" />
                Invite Member
              </button>
            )}
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-lg flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-red-400" />
            <span className="text-red-400">{error}</span>
          </div>
        )}

        {/* Members List */}
        <div className="bg-white/5 border border-white/10 rounded-lg overflow-hidden mb-6">
          <div className="p-4 border-b border-white/10">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">
                Active Members ({members.length})
              </h2>
              <button
                onClick={loadData}
                className="p-2 hover:bg-white/5 rounded-lg transition-colors"
                title="Refresh"
              >
                <RefreshCw
                  className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`}
                />
              </button>
            </div>
          </div>

          <div className="divide-y divide-white/10">
            {isLoading && members.length === 0 ? (
              <div className="p-8 text-center text-gray-400">Loading...</div>
            ) : members.length === 0 ? (
              <div className="p-8 text-center text-gray-400">
                No members found
              </div>
            ) : (
              members.map((member) => (
                <div
                  key={member.userId}
                  className="p-4 flex items-center justify-between hover:bg-white/5 transition-colors"
                >
                  <div className="flex items-center gap-4 flex-1">
                    <div className="w-10 h-10 bg-gradient-to-br from-green-500 to-green-600 rounded-full flex items-center justify-center text-white font-semibold">
                      {(member.name || member.email)[0].toUpperCase()}
                    </div>
                    <div className="flex-1">
                      <div className="font-medium">
                        {member.name || 'Unknown User'}
                      </div>
                      <div className="text-sm text-gray-400">{member.email}</div>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    <div
                      className={`px-3 py-1 rounded-full text-xs font-medium border ${getRoleBadgeColor(member.role as UserRole)}`}
                    >
                      {getRoleDisplayName(member.role as UserRole)}
                    </div>

                    <div className="text-sm text-gray-400">
                      Joined{' '}
                      {new Date(member.joinedAt).toLocaleDateString('en-AU', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                      })}
                    </div>

                    {canManageMembers && member.role !== 'owner' && (
                      <button
                        onClick={() =>
                          handleRemoveMember(member.userId, member.email)
                        }
                        className="p-2 text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                        title="Remove member"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Pending Invitations */}
        {canManageMembers && invitations.length > 0 && (
          <div className="bg-white/5 border border-white/10 rounded-lg overflow-hidden">
            <div className="p-4 border-b border-white/10">
              <h2 className="text-lg font-semibold">
                Pending Invitations ({invitations.length})
              </h2>
            </div>

            <div className="divide-y divide-white/10">
              {invitations.map((invitation) => (
                <div
                  key={invitation.id}
                  className="p-4 flex items-center justify-between hover:bg-white/5 transition-colors"
                >
                  <div className="flex items-center gap-4 flex-1">
                    <div className="w-10 h-10 bg-gray-700 rounded-full flex items-center justify-center text-gray-400">
                      <Mail className="w-5 h-5" />
                    </div>
                    <div className="flex-1">
                      <div className="font-medium">{invitation.email}</div>
                      <div className="text-sm text-gray-400">
                        Invited{' '}
                        {new Date(invitation.createdAt).toLocaleDateString(
                          'en-AU',
                          { year: 'numeric', month: 'short', day: 'numeric' }
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    <div
                      className={`px-3 py-1 rounded-full text-xs font-medium border ${getRoleBadgeColor(invitation.role as UserRole)}`}
                    >
                      {getRoleDisplayName(invitation.role as UserRole)}
                    </div>

                    <div className="text-sm text-yellow-400">
                      Expires{' '}
                      {new Date(invitation.expiresAt).toLocaleDateString(
                        'en-AU',
                        { year: 'numeric', month: 'short', day: 'numeric' }
                      )}
                    </div>

                    <button
                      onClick={() => handleRevokeInvitation(invitation.id)}
                      className="p-2 text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                      title="Revoke invitation"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Invite Dialog */}
      {showInviteDialog && (
        <InviteDialog
          organizationId={currentOrganization.id}
          onClose={() => setShowInviteDialog(false)}
          onSuccess={loadData}
        />
      )}
    </div>
  )
}

/**
 * Invite Member Dialog
 */
function InviteDialog({
  organizationId,
  onClose,
  onSuccess,
}: {
  organizationId: string
  onClose: () => void
  onSuccess: () => void
}) {
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<'admin' | 'accountant' | 'read_only'>('accountant')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [invitationUrl, setInvitationUrl] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    setError(null)

    try {
      const response = await fetch(`/api/organizations/${organizationId}/invitations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, role }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to send invitation')
      }

      const data = await response.json()
      setInvitationUrl(data.invitationUrl)
      onSuccess()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send invitation')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleCopy = () => {
    if (invitationUrl) {
      navigator.clipboard.writeText(invitationUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/50 z-50" onClick={onClose} />

      {/* Dialog */}
      <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-md bg-gray-900 border border-white/10 rounded-lg shadow-xl z-50">
        <div className="p-6 border-b border-white/10">
          <h2 className="text-xl font-semibold">Invite Team Member</h2>
          <p className="mt-1 text-sm text-gray-400">
            Send an invitation to join this organization
          </p>
        </div>

        {!invitationUrl ? (
          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            {/* Email */}
            <div>
              <label className="block text-sm font-medium mb-2">
                Email Address <span className="text-red-400">*</span>
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                placeholder="user@example.com"
                required
              />
            </div>

            {/* Role */}
            <div>
              <label className="block text-sm font-medium mb-2">
                Role <span className="text-red-400">*</span>
              </label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as 'admin' | 'accountant' | 'read_only')}
                className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
              >
                <option value="admin">Administrator</option>
                <option value="accountant">Accountant</option>
                <option value="read_only">Read Only</option>
              </select>
              <p className="mt-1 text-xs text-gray-500">
                {role === 'admin' && 'Can manage members and settings'}
                {role === 'accountant' && 'Can view and generate reports'}
                {role === 'read_only' && 'View-only access'}
              </p>
            </div>

            {/* Error */}
            {error && (
              <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-sm text-red-400">
                {error}
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-3 pt-4">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 px-4 py-2 bg-white/5 hover:bg-white/10 rounded-lg transition-colors"
                disabled={isSubmitting}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="flex-1 px-4 py-2 bg-green-500 hover:bg-green-600 rounded-lg transition-colors disabled:opacity-50"
                disabled={isSubmitting || !email}
              >
                {isSubmitting ? 'Sending...' : 'Send Invitation'}
              </button>
            </div>
          </form>
        ) : (
          <div className="p-6 space-y-4">
            <div className="p-4 bg-green-500/10 border border-green-500/20 rounded-lg flex items-start gap-3">
              <CheckCircle className="w-5 h-5 text-green-400 mt-0.5" />
              <div>
                <div className="font-medium text-green-400">
                  Invitation Sent!
                </div>
                <div className="text-sm text-gray-300 mt-1">
                  An email has been sent to {email} with the invitation link.
                </div>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">
                Invitation Link
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={invitationUrl}
                  readOnly
                  className="flex-1 px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm"
                />
                <button
                  onClick={handleCopy}
                  className="px-4 py-2 bg-blue-500 hover:bg-blue-600 rounded-lg transition-colors"
                >
                  {copied ? (
                    <CheckCircle className="w-4 h-4" />
                  ) : (
                    <Copy className="w-4 h-4" />
                  )}
                </button>
              </div>
              <p className="mt-1 text-xs text-gray-500">
                You can also share this link manually
              </p>
            </div>

            <button
              onClick={onClose}
              className="w-full px-4 py-2 bg-white/5 hover:bg-white/10 rounded-lg transition-colors"
            >
              Close
            </button>
          </div>
        )}
      </div>
    </>
  )
}
