/**
 * Organization Settings Page
 *
 * Manage organization details, preferences, and integrations
 */

'use client'

import { useState, useEffect } from 'react'
import { useOrganization } from '@/lib/context/OrganizationContext'
import { hasPermission } from '@/lib/types/multi-tenant'
import {
  Building2,
  Save,
  AlertTriangle,
  CheckCircle,
  Settings as SettingsIcon,
  Mail,
  Bell,
  Calendar,
  Link as LinkIcon,
} from 'lucide-react'

export default function OrganizationSettingsPage() {
  const { currentOrganization, currentRole, refreshOrganizations } =
    useOrganization()

  const [isLoading, setIsLoading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    abn: '',
    industry: '',
    businessSize: '' as 'micro' | 'small' | 'medium' | 'large' | '',
    financialYearEnd: '',
    rndAutoRegister: false,
    div7aMonitoring: false,
    quarterlyBAS: false,
    emailReports: false,
    recipientEmail: '',
    reportFrequency: '' as 'weekly' | 'monthly' | 'quarterly' | '',
    deadlineReminders: false,
    analysisComplete: false,
    newRecommendations: false,
  })

  // Check permissions
  const canEdit =
    currentRole && hasPermission(currentRole, 'canManageSettings')

  // Load organization settings
  useEffect(() => {
    if (!currentOrganization) return

    const org = currentOrganization
    setFormData({
      name: org.name || '',
      abn: org.abn || '',
      industry: org.industry || '',
      businessSize: org.businessSize || '',
      financialYearEnd: org.settings?.financialYearEnd || '',
      rndAutoRegister: org.settings?.taxPreferences?.rndAutoRegister ?? false,
      div7aMonitoring: org.settings?.taxPreferences?.div7aMonitoring ?? false,
      quarterlyBAS: org.settings?.taxPreferences?.quarterlyBAS ?? false,
      emailReports: org.settings?.reportingPreferences?.emailReports ?? false,
      recipientEmail: org.settings?.reportingPreferences?.recipientEmail || '',
      reportFrequency:
        org.settings?.reportingPreferences?.reportFrequency || '',
      deadlineReminders:
        org.settings?.notifications?.deadlineReminders ?? false,
      analysisComplete: org.settings?.notifications?.analysisComplete ?? false,
      newRecommendations:
        org.settings?.notifications?.newRecommendations ?? false,
    })
  }, [currentOrganization])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSaving(true)
    setError(null)
    setSuccess(null)

    try {
      const response = await fetch(
        `/api/organizations/${currentOrganization?.id}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: formData.name,
            abn: formData.abn || undefined,
            industry: formData.industry || undefined,
            businessSize: formData.businessSize || undefined,
            settings: {
              financialYearEnd: formData.financialYearEnd || undefined,
              taxPreferences: {
                rndAutoRegister: formData.rndAutoRegister,
                div7aMonitoring: formData.div7aMonitoring,
                quarterlyBAS: formData.quarterlyBAS,
              },
              reportingPreferences: {
                emailReports: formData.emailReports,
                recipientEmail: formData.recipientEmail || undefined,
                reportFrequency: formData.reportFrequency || undefined,
              },
              notifications: {
                deadlineReminders: formData.deadlineReminders,
                analysisComplete: formData.analysisComplete,
                newRecommendations: formData.newRecommendations,
              },
            },
          }),
        }
      )

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to update settings')
      }

      setSuccess('Settings saved successfully')
      await refreshOrganizations()

      // Clear success message after 3 seconds
      setTimeout(() => setSuccess(null), 3000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save settings')
    } finally {
      setIsSaving(false)
    }
  }

  if (!currentOrganization) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 text-white p-8 flex items-center justify-center">
        <div className="text-center">
          <Building2 className="w-12 h-12 text-gray-500 mx-auto mb-4" />
          <p className="text-gray-400">No organization selected</p>
        </div>
      </div>
    )
  }

  if (!canEdit) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 text-white p-8">
        <div className="max-w-4xl mx-auto">
          <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-6">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-6 h-6 text-yellow-400 mt-1" />
              <div>
                <h3 className="text-lg font-semibold text-yellow-400 mb-2">
                  Insufficient Permissions
                </h3>
                <p className="text-gray-300">
                  You don't have permission to manage organization settings.
                  Contact an owner or administrator.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 text-white p-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-3 bg-blue-500/10 rounded-lg">
              <SettingsIcon className="w-8 h-8 text-blue-400" />
            </div>
            <div>
              <h1 className="text-3xl font-bold">Organization Settings</h1>
              <p className="text-gray-400 mt-1">
                Manage {currentOrganization.name} preferences and configuration
              </p>
            </div>
          </div>
        </div>

        {/* Success/Error Messages */}
        {success && (
          <div className="mb-6 p-4 bg-green-500/10 border border-green-500/20 rounded-lg flex items-center gap-3">
            <CheckCircle className="w-5 h-5 text-green-400" />
            <span className="text-green-400">{success}</span>
          </div>
        )}

        {error && (
          <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-lg flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-red-400" />
            <span className="text-red-400">{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* General Settings */}
          <div className="bg-white/5 border border-white/10 rounded-lg p-6">
            <div className="flex items-center gap-2 mb-6">
              <Building2 className="w-5 h-5 text-blue-400" />
              <h2 className="text-xl font-semibold">General</h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">ABN</label>
                <input
                  type="text"
                  value={formData.abn}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      abn: e.target.value.replace(/\D/g, ''),
                    })
                  }
                  className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  maxLength={11}
                  placeholder="12345678901"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">
                  Industry
                </label>
                <input
                  type="text"
                  value={formData.industry}
                  onChange={(e) =>
                    setFormData({ ...formData, industry: e.target.value })
                  }
                  className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Technology, Manufacturing, etc."
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">
                  Business Size
                </label>
                <select
                  value={formData.businessSize}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      businessSize: e.target.value as any,
                    })
                  }
                  className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select size</option>
                  <option value="micro">Micro (1-4 employees)</option>
                  <option value="small">Small (5-19 employees)</option>
                  <option value="medium">Medium (20-199 employees)</option>
                  <option value="large">Large (200+ employees)</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">
                  Financial Year End
                </label>
                <input
                  type="date"
                  value={formData.financialYearEnd}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      financialYearEnd: e.target.value,
                    })
                  }
                  className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Default: 30 June (Australian standard)
                </p>
              </div>
            </div>
          </div>

          {/* Tax Preferences */}
          <div className="bg-white/5 border border-white/10 rounded-lg p-6">
            <div className="flex items-center gap-2 mb-6">
              <Calendar className="w-5 h-5 text-green-400" />
              <h2 className="text-xl font-semibold">Tax Preferences</h2>
            </div>

            <div className="space-y-4">
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.rndAutoRegister}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      rndAutoRegister: e.target.checked,
                    })
                  }
                  className="mt-1"
                />
                <div>
                  <div className="font-medium">Auto-register R&D activities</div>
                  <div className="text-sm text-gray-400">
                    Automatically track potential R&D tax incentive candidates
                  </div>
                </div>
              </label>

              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.div7aMonitoring}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      div7aMonitoring: e.target.checked,
                    })
                  }
                  className="mt-1"
                />
                <div>
                  <div className="font-medium">Division 7A monitoring</div>
                  <div className="text-sm text-gray-400">
                    Monitor shareholder loans for Division 7A compliance
                  </div>
                </div>
              </label>

              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.quarterlyBAS}
                  onChange={(e) =>
                    setFormData({ ...formData, quarterlyBAS: e.target.checked })
                  }
                  className="mt-1"
                />
                <div>
                  <div className="font-medium">Quarterly BAS reporting</div>
                  <div className="text-sm text-gray-400">
                    Enable quarterly Business Activity Statement tracking
                  </div>
                </div>
              </label>
            </div>
          </div>

          {/* Reporting Preferences */}
          <div className="bg-white/5 border border-white/10 rounded-lg p-6">
            <div className="flex items-center gap-2 mb-6">
              <Mail className="w-5 h-5 text-purple-400" />
              <h2 className="text-xl font-semibold">Reporting</h2>
            </div>

            <div className="space-y-4">
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.emailReports}
                  onChange={(e) =>
                    setFormData({ ...formData, emailReports: e.target.checked })
                  }
                  className="mt-1"
                />
                <div>
                  <div className="font-medium">Email reports automatically</div>
                  <div className="text-sm text-gray-400">
                    Send reports to specified email address
                  </div>
                </div>
              </label>

              {formData.emailReports && (
                <>
                  <div>
                    <label className="block text-sm font-medium mb-2">
                      Recipient Email
                    </label>
                    <input
                      type="email"
                      value={formData.recipientEmail}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          recipientEmail: e.target.value,
                        })
                      }
                      className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="accountant@example.com"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">
                      Report Frequency
                    </label>
                    <select
                      value={formData.reportFrequency}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          reportFrequency: e.target.value as any,
                        })
                      }
                      className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">Select frequency</option>
                      <option value="weekly">Weekly</option>
                      <option value="monthly">Monthly</option>
                      <option value="quarterly">Quarterly</option>
                    </select>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Notifications */}
          <div className="bg-white/5 border border-white/10 rounded-lg p-6">
            <div className="flex items-center gap-2 mb-6">
              <Bell className="w-5 h-5 text-yellow-400" />
              <h2 className="text-xl font-semibold">Notifications</h2>
            </div>

            <div className="space-y-4">
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.deadlineReminders}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      deadlineReminders: e.target.checked,
                    })
                  }
                  className="mt-1"
                />
                <div>
                  <div className="font-medium">Deadline reminders</div>
                  <div className="text-sm text-gray-400">
                    Get notified about upcoming tax filing deadlines
                  </div>
                </div>
              </label>

              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.analysisComplete}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      analysisComplete: e.target.checked,
                    })
                  }
                  className="mt-1"
                />
                <div>
                  <div className="font-medium">Analysis completion</div>
                  <div className="text-sm text-gray-400">
                    Notify when AI tax analysis is complete
                  </div>
                </div>
              </label>

              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.newRecommendations}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      newRecommendations: e.target.checked,
                    })
                  }
                  className="mt-1"
                />
                <div>
                  <div className="font-medium">New recommendations</div>
                  <div className="text-sm text-gray-400">
                    Alert when new tax-saving opportunities are found
                  </div>
                </div>
              </label>
            </div>
          </div>

          {/* Submit Button */}
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={isSaving}
              className="flex items-center gap-2 px-6 py-3 bg-blue-500 hover:bg-blue-600 disabled:bg-gray-600 rounded-lg transition-colors font-medium"
            >
              <Save className="w-5 h-5" />
              {isSaving ? 'Saving...' : 'Save Settings'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
