'use client'

/**
 * Alert Preferences Page
 *
 * Allows users to configure their tax alert preferences
 */

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import {
  Bell,
  Mail,
  Smartphone,
  Calendar,
  AlertCircle,
  Lightbulb,
  FileText,
  Scale,
  TrendingUp,
  Save,
  Loader2
} from 'lucide-react'
import { useRouter } from 'next/navigation'

interface AlertPreferences {
  id?: string
  tenant_id?: string
  alerts_enabled: boolean
  email_notifications: boolean
  in_app_notifications: boolean
  rnd_alerts: boolean
  deadline_alerts: boolean
  opportunity_alerts: boolean
  compliance_alerts: boolean
  legislative_alerts: boolean
  advance_notice_days: number
  digest_frequency: 'realtime' | 'daily' | 'weekly'
  notification_email?: string
}

export default function AlertPreferencesPage() {
  const router = useRouter()
  const [preferences, setPreferences] = useState<AlertPreferences>({
    alerts_enabled: true,
    email_notifications: true,
    in_app_notifications: true,
    rnd_alerts: true,
    deadline_alerts: true,
    opportunity_alerts: true,
    compliance_alerts: true,
    legislative_alerts: true,
    advance_notice_days: 30,
    digest_frequency: 'daily',
    notification_email: ''
  })

  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [saveMessage, setSaveMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  useEffect(() => {
    fetchPreferences()
  }, [])

  const fetchPreferences = async () => {
    try {
      const response = await fetch('/api/alerts/preferences')
      if (!response.ok) {
        throw new Error('Failed to fetch preferences')
      }

      const data = await response.json()
      if (data.preferences) {
        setPreferences(data.preferences)
      }
    } catch (error) {
      console.error('Error fetching preferences:', error)
      setSaveMessage({ type: 'error', text: 'Failed to load preferences' })
    } finally {
      setIsLoading(false)
    }
  }

  const handleSave = async () => {
    setIsSaving(true)
    setSaveMessage(null)

    try {
      const response = await fetch('/api/alerts/preferences', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(preferences)
      })

      if (!response.ok) {
        throw new Error('Failed to save preferences')
      }

      setSaveMessage({ type: 'success', text: 'Preferences saved successfully!' })
      setTimeout(() => setSaveMessage(null), 3000)
    } catch (error) {
      console.error('Error saving preferences:', error)
      setSaveMessage({ type: 'error', text: 'Failed to save preferences' })
    } finally {
      setIsSaving(false)
    }
  }

  const updatePreference = (key: keyof AlertPreferences, value: any) => {
    setPreferences(prev => ({ ...prev, [key]: value }))
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-blue-500 animate-spin mx-auto mb-4" />
          <p className="text-gray-600 dark:text-gray-400">Loading preferences...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <div className="container mx-auto px-4 py-8 max-w-4xl">

        {/* Header */}
        <div className="mb-8">
          <button
            onClick={() => router.back()}
            className="text-blue-500 hover:text-blue-600 mb-4 flex items-center gap-2"
          >
            ← Back to Alerts
          </button>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            Alert Preferences
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Customize how and when you receive tax alerts
          </p>
        </div>

        {/* Save Message */}
        {saveMessage && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className={`mb-6 p-4 rounded-lg ${
              saveMessage.type === 'success'
                ? 'bg-green-50 dark:bg-green-950 text-green-800 dark:text-green-200 border border-green-200 dark:border-green-800'
                : 'bg-red-50 dark:bg-red-950 text-red-800 dark:text-red-200 border border-red-200 dark:border-red-800'
            }`}
          >
            {saveMessage.text}
          </motion.div>
        )}

        <div className="space-y-6">

          {/* Master Toggle */}
          <div className="bg-white dark:bg-gray-900 rounded-lg p-6 border border-gray-200 dark:border-gray-800">
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-3">
                <Bell className="w-6 h-6 text-blue-500 mt-1" />
                <div>
                  <h3 className="font-semibold text-gray-900 dark:text-white mb-1">
                    Enable Tax Alerts
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Receive automated tax alerts, deadline reminders, and opportunity notifications
                  </p>
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={preferences.alerts_enabled}
                  onChange={(e) => updatePreference('alerts_enabled', e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
              </label>
            </div>
          </div>

          {/* Notification Channels */}
          <div className="bg-white dark:bg-gray-900 rounded-lg p-6 border border-gray-200 dark:border-gray-800">
            <h3 className="font-semibold text-gray-900 dark:text-white mb-4">
              Notification Channels
            </h3>

            <div className="space-y-4">
              {/* Email Notifications */}
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3">
                  <Mail className="w-5 h-5 text-purple-500 mt-0.5" />
                  <div>
                    <h4 className="font-medium text-gray-900 dark:text-white">
                      Email Notifications
                    </h4>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Receive alerts via email
                    </p>
                  </div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={preferences.email_notifications}
                    onChange={(e) => updatePreference('email_notifications', e.target.checked)}
                    disabled={!preferences.alerts_enabled}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-purple-300 dark:peer-focus:ring-purple-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-purple-600 peer-disabled:opacity-50"></div>
                </label>
              </div>

              {/* Email Address */}
              {preferences.email_notifications && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  className="ml-8"
                >
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Notification Email (optional, uses account email if not set)
                  </label>
                  <input
                    type="email"
                    value={preferences.notification_email || ''}
                    onChange={(e) => updatePreference('notification_email', e.target.value)}
                    placeholder="alerts@example.com"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                  />
                </motion.div>
              )}

              {/* In-App Notifications */}
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3">
                  <Smartphone className="w-5 h-5 text-green-500 mt-0.5" />
                  <div>
                    <h4 className="font-medium text-gray-900 dark:text-white">
                      In-App Notifications
                    </h4>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Show alerts in the dashboard
                    </p>
                  </div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={preferences.in_app_notifications}
                    onChange={(e) => updatePreference('in_app_notifications', e.target.checked)}
                    disabled={!preferences.alerts_enabled}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-green-300 dark:peer-focus:ring-green-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-green-600 peer-disabled:opacity-50"></div>
                </label>
              </div>
            </div>
          </div>

          {/* Alert Types */}
          <div className="bg-white dark:bg-gray-900 rounded-lg p-6 border border-gray-200 dark:border-gray-800">
            <h3 className="font-semibold text-gray-900 dark:text-white mb-4">
              Alert Types
            </h3>

            <div className="space-y-4">
              {/* R&D Alerts */}
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3">
                  <TrendingUp className="w-5 h-5 text-blue-500 mt-0.5" />
                  <div>
                    <h4 className="font-medium text-gray-900 dark:text-white">
                      R&D Tax Incentive
                    </h4>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      R&D registration and claim deadlines (Division 355)
                    </p>
                  </div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={preferences.rnd_alerts}
                    onChange={(e) => updatePreference('rnd_alerts', e.target.checked)}
                    disabled={!preferences.alerts_enabled}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600 peer-disabled:opacity-50"></div>
                </label>
              </div>

              {/* Deadline Alerts */}
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3">
                  <Calendar className="w-5 h-5 text-red-500 mt-0.5" />
                  <div>
                    <h4 className="font-medium text-gray-900 dark:text-white">
                      Deadline Reminders
                    </h4>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      BAS, tax return, and FBT lodgment deadlines
                    </p>
                  </div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={preferences.deadline_alerts}
                    onChange={(e) => updatePreference('deadline_alerts', e.target.checked)}
                    disabled={!preferences.alerts_enabled}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-red-300 dark:peer-focus:ring-red-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-red-600 peer-disabled:opacity-50"></div>
                </label>
              </div>

              {/* Opportunity Alerts */}
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3">
                  <Lightbulb className="w-5 h-5 text-yellow-500 mt-0.5" />
                  <div>
                    <h4 className="font-medium text-gray-900 dark:text-white">
                      Tax Opportunities
                    </h4>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Unclaimed deductions, instant asset write-offs
                    </p>
                  </div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={preferences.opportunity_alerts}
                    onChange={(e) => updatePreference('opportunity_alerts', e.target.checked)}
                    disabled={!preferences.alerts_enabled}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-yellow-300 dark:peer-focus:ring-yellow-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-yellow-600 peer-disabled:opacity-50"></div>
                </label>
              </div>

              {/* Compliance Alerts */}
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-orange-500 mt-0.5" />
                  <div>
                    <h4 className="font-medium text-gray-900 dark:text-white">
                      Compliance Issues
                    </h4>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Division 7A loans, loss expiry, compliance warnings
                    </p>
                  </div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={preferences.compliance_alerts}
                    onChange={(e) => updatePreference('compliance_alerts', e.target.checked)}
                    disabled={!preferences.alerts_enabled}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-orange-300 dark:peer-focus:ring-orange-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-orange-600 peer-disabled:opacity-50"></div>
                </label>
              </div>

              {/* Legislative Alerts */}
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3">
                  <Scale className="w-5 h-5 text-purple-500 mt-0.5" />
                  <div>
                    <h4 className="font-medium text-gray-900 dark:text-white">
                      Legislative Changes
                    </h4>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Tax law changes, rate updates, new legislation
                    </p>
                  </div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={preferences.legislative_alerts}
                    onChange={(e) => updatePreference('legislative_alerts', e.target.checked)}
                    disabled={!preferences.alerts_enabled}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-purple-300 dark:peer-focus:ring-purple-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-purple-600 peer-disabled:opacity-50"></div>
                </label>
              </div>
            </div>
          </div>

          {/* Timing Preferences */}
          <div className="bg-white dark:bg-gray-900 rounded-lg p-6 border border-gray-200 dark:border-gray-800">
            <h3 className="font-semibold text-gray-900 dark:text-white mb-4">
              Timing Preferences
            </h3>

            <div className="space-y-4">
              {/* Advance Notice Days */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Advance Notice for Deadlines
                </label>
                <select
                  value={preferences.advance_notice_days}
                  onChange={(e) => updatePreference('advance_notice_days', parseInt(e.target.value))}
                  disabled={!preferences.alerts_enabled}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white disabled:opacity-50"
                >
                  <option value={7}>7 days before</option>
                  <option value={14}>14 days before</option>
                  <option value={30}>30 days before</option>
                  <option value={60}>60 days before</option>
                  <option value={90}>90 days before</option>
                </select>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  How far in advance to notify you about upcoming deadlines
                </p>
              </div>

              {/* Email Digest Frequency */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Email Digest Frequency
                </label>
                <select
                  value={preferences.digest_frequency}
                  onChange={(e) => updatePreference('digest_frequency', e.target.value)}
                  disabled={!preferences.alerts_enabled || !preferences.email_notifications}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white disabled:opacity-50"
                >
                  <option value="realtime">Real-time (immediate)</option>
                  <option value="daily">Daily digest</option>
                  <option value="weekly">Weekly digest</option>
                </select>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  How often to receive email notifications
                </p>
              </div>
            </div>
          </div>

          {/* Save Button */}
          <div className="flex justify-end">
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="flex items-center gap-2 px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium"
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="w-5 h-5" />
                  Save Preferences
                </>
              )}
            </button>
          </div>

        </div>
      </div>
    </div>
  )
}
