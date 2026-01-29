/**
 * Organization Switcher Component
 *
 * Dropdown menu for switching between organizations
 * and creating new organizations
 */

'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useOrganization } from '@/lib/context/OrganizationContext'
import { ChevronDown, Plus, Building2, Check, Settings, Users } from 'lucide-react'
import {
  getRoleBadgeColor,
  getRoleDisplayName,
  hasPermission,
} from '@/lib/types/multi-tenant'

export function OrganizationSwitcher() {
  const {
    currentOrganization,
    currentRole,
    organizations,
    switchOrganization,
    isLoading,
  } = useOrganization()

  const [isOpen, setIsOpen] = useState(false)
  const [showCreateDialog, setShowCreateDialog] = useState(false)

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 bg-white/5 rounded-lg animate-pulse">
        <div className="w-5 h-5 bg-white/10 rounded" />
        <div className="w-32 h-4 bg-white/10 rounded" />
      </div>
    )
  }

  if (!currentOrganization) {
    return (
      <button
        onClick={() => setShowCreateDialog(true)}
        className="flex items-center gap-2 px-3 py-2 bg-white/5 hover:bg-white/10 rounded-lg transition-colors"
      >
        <Plus className="w-4 h-4" />
        <span className="text-sm font-medium">Create Organization</span>
      </button>
    )
  }

  return (
    <>
      {/* Organization Switcher Dropdown */}
      <div className="relative">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center gap-2 px-3 py-2 bg-white/5 hover:bg-white/10 rounded-lg transition-colors min-w-[200px]"
        >
          <Building2 className="w-4 h-4 text-blue-400" />
          <div className="flex-1 text-left">
            <div className="text-sm font-medium truncate">
              {currentOrganization.name}
            </div>
            {currentRole && (
              <div className="text-xs text-gray-400">
                {getRoleDisplayName(currentRole)}
              </div>
            )}
          </div>
          <ChevronDown
            className={`w-4 h-4 transition-transform ${
              isOpen ? 'rotate-180' : ''
            }`}
          />
        </button>

        {/* Dropdown Menu */}
        {isOpen && (
          <>
            {/* Backdrop */}
            <div
              className="fixed inset-0 z-40"
              onClick={() => setIsOpen(false)}
            />

            {/* Menu */}
            <div className="absolute top-full left-0 mt-2 w-full min-w-[280px] bg-gray-900 border border-white/10 rounded-lg shadow-xl z-50">
              <div className="p-2 border-b border-white/10">
                <div className="px-3 py-2 text-xs font-medium text-gray-400 uppercase tracking-wide">
                  Your Organizations
                </div>
              </div>

              {/* Organization List */}
              <div className="p-2 max-h-[300px] overflow-y-auto">
                {organizations.map((org) => (
                  <button
                    key={org.id}
                    onClick={() => {
                      switchOrganization(org.id)
                      setIsOpen(false)
                    }}
                    className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
                      currentOrganization.id === org.id
                        ? 'bg-blue-500/10 text-blue-400'
                        : 'hover:bg-white/5 text-gray-300'
                    }`}
                  >
                    <div className="flex-1 text-left">
                      <div className="text-sm font-medium">{org.name}</div>
                      {org.abn && (
                        <div className="text-xs text-gray-500">
                          ABN: {org.abn}
                        </div>
                      )}
                    </div>

                    {currentOrganization.id === org.id && (
                      <Check className="w-4 h-4 text-blue-400" />
                    )}
                  </button>
                ))}
              </div>

              {/* Organization Management Links */}
              <div className="p-2 border-t border-white/10 space-y-1">
                {currentRole && hasPermission(currentRole, 'canManageSettings') && (
                  <Link
                    href="/dashboard/organization/settings"
                    onClick={() => setIsOpen(false)}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-300 hover:bg-white/5 rounded-lg transition-colors"
                  >
                    <Settings className="w-4 h-4" />
                    Organization Settings
                  </Link>
                )}
                <Link
                  href="/dashboard/organization/members"
                  onClick={() => setIsOpen(false)}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-300 hover:bg-white/5 rounded-lg transition-colors"
                >
                  <Users className="w-4 h-4" />
                  Team Members
                </Link>
              </div>

              {/* Create New Organization */}
              <div className="p-2 border-t border-white/10">
                <button
                  onClick={() => {
                    setIsOpen(false)
                    setShowCreateDialog(true)
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm font-medium text-blue-400 hover:bg-blue-500/10 rounded-lg transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  Create New Organization
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Create Organization Dialog */}
      {showCreateDialog && (
        <CreateOrganizationDialog onClose={() => setShowCreateDialog(false)} />
      )}
    </>
  )
}

/**
 * Create Organization Dialog
 */
function CreateOrganizationDialog({ onClose }: { onClose: () => void }) {
  const { createOrganization } = useOrganization()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [formData, setFormData] = useState({
    name: '',
    abn: '',
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    setError(null)

    try {
      await createOrganization(formData.name, formData.abn || undefined)
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create organization')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/50 z-50" onClick={onClose} />

      {/* Dialog */}
      <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-md bg-gray-900 border border-white/10 rounded-lg shadow-xl z-50">
        <div className="p-6 border-b border-white/10">
          <h2 className="text-xl font-semibold">Create New Organization</h2>
          <p className="mt-1 text-sm text-gray-400">
            Add a new client organization to manage
          </p>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Organization Name */}
          <div>
            <label className="block text-sm font-medium mb-2">
              Organization Name <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) =>
                setFormData({ ...formData, name: e.target.value })
              }
              className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="ABC Corporation Pty Ltd"
              required
            />
          </div>

          {/* ABN (Optional) */}
          <div>
            <label className="block text-sm font-medium mb-2">
              ABN (Optional)
            </label>
            <input
              type="text"
              value={formData.abn}
              onChange={(e) =>
                setFormData({ ...formData, abn: e.target.value.replace(/\D/g, '') })
              }
              className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="12345678901"
              maxLength={11}
              pattern="\d{11}"
            />
            <p className="mt-1 text-xs text-gray-500">
              Enter 11 digits (without spaces)
            </p>
          </div>

          {/* Error Message */}
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
              className="flex-1 px-4 py-2 bg-blue-500 hover:bg-blue-600 rounded-lg transition-colors disabled:opacity-50"
              disabled={isSubmitting || !formData.name}
            >
              {isSubmitting ? 'Creating...' : 'Create Organization'}
            </button>
          </div>
        </form>
      </div>
    </>
  )
}
