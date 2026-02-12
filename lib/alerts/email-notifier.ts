/**
 * Alert Email Notification Service
 *
 * Sends email notifications for tax alerts using SendGrid
 */

import sgMail from '@sendgrid/mail'
import { createServiceClient } from '@/lib/supabase/server'
import { createLogger } from '@/lib/logger'
import { optionalConfig } from '@/lib/config/env'

const log = createLogger('alerts:email-notifier')

const _sgApiKey = optionalConfig.sendgridApiKey
if (_sgApiKey) {
  sgMail.setApiKey(_sgApiKey)
}

interface TaxAlert {
  id: string
  tenant_id: string
  alert_type: string
  title: string
  message: string
  severity: 'info' | 'warning' | 'critical'
  category: string
  financial_year?: string
  platform?: string
  due_date?: string
  action_url?: string
  action_label?: string
  metadata?: {
    potential_benefit?: number
    total_rnd_transactions?: number
    opportunity_count?: number
    total_eligible_value?: number
    [key: string]: unknown
  }
}

interface EmailNotificationResult {
  success: boolean
  emailId?: string
  error?: string
}

/**
 * Send email notification for a single alert
 */
export async function sendAlertEmail(
  alert: TaxAlert,
  recipientEmail: string,
  _recipientName?: string
): Promise<EmailNotificationResult> {
  try {
    // Severity-based email styling
    const severityConfig = {
      info: {
        color: '#3b82f6',
        icon: 'ℹ️',
        urgency: 'For Your Information'
      },
      warning: {
        color: '#f59e0b',
        icon: '⚠️',
        urgency: 'Action Recommended'
      },
      critical: {
        color: '#ef4444',
        icon: '🚨',
        urgency: 'Urgent Action Required'
      }
    }

    const config = severityConfig[alert.severity]

    // Format due date
    let dueDateText = ''
    if (alert.due_date) {
      const dueDate = new Date(alert.due_date)
      const daysUntil = Math.floor((dueDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24))

      if (daysUntil < 0) {
        dueDateText = `<div style="color: #dc2626; font-weight: bold; margin-top: 12px;">
          ⏰ This deadline has passed!
        </div>`
      } else if (daysUntil === 0) {
        dueDateText = `<div style="color: #dc2626; font-weight: bold; margin-top: 12px;">
          ⏰ Due TODAY: ${dueDate.toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' })}
        </div>`
      } else if (daysUntil <= 7) {
        dueDateText = `<div style="color: #f59e0b; font-weight: bold; margin-top: 12px;">
          ⏰ Due in ${daysUntil} day${daysUntil === 1 ? '' : 's'}: ${dueDate.toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' })}
        </div>`
      } else {
        dueDateText = `<div style="margin-top: 12px;">
          📅 Due: ${dueDate.toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' })} (${daysUntil} days)
        </div>`
      }
    }

    // Build action button
    const actionButton = alert.action_url && alert.action_label
      ? `<div style="margin-top: 24px;">
          <a href="${optionalConfig.appUrl || 'https://ato-ai.app'}${alert.action_url}"
             style="display: inline-block; padding: 12px 24px; background-color: ${config.color}; color: white; text-decoration: none; border-radius: 6px; font-weight: 600;">
            ${alert.action_label} →
          </a>
        </div>`
      : ''

    // Build metadata highlights
    let metadataHtml = ''
    if (alert.metadata) {
      const highlights: string[] = []

      if (alert.metadata.potential_benefit) {
        highlights.push(`💰 Potential benefit: $${alert.metadata.potential_benefit.toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`)
      }

      if (alert.metadata.total_rnd_transactions) {
        highlights.push(`🔬 ${alert.metadata.total_rnd_transactions} R&D eligible transactions`)
      }

      if (alert.metadata.opportunity_count) {
        highlights.push(`📊 ${alert.metadata.opportunity_count} opportunities identified`)
      }

      if (alert.metadata.total_eligible_value) {
        highlights.push(`💵 Total value: $${alert.metadata.total_eligible_value.toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`)
      }

      if (highlights.length > 0) {
        metadataHtml = `<div style="background-color: #f3f4f6; padding: 16px; border-radius: 8px; margin-top: 16px;">
          ${highlights.map(h => `<div style="margin-bottom: 8px;">${h}</div>`).join('')}
        </div>`
      }
    }

    // Send email
    const [response] = await sgMail.send({
      from: 'ATO Tax Optimizer <support@carsi.com.au>',
      to: recipientEmail,
      replyTo: 'phill.m@carsi.com.au',
      subject: `${config.icon} ${alert.title}`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #374151; margin: 0; padding: 0; background-color: #f9fafb;">
          <div style="max-width: 600px; margin: 0 auto; padding: 20px;">

            <!-- Header -->
            <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 32px; border-radius: 12px 12px 0 0; text-align: center;">
              <h1 style="color: white; margin: 0; font-size: 24px;">
                ${config.icon} Australian Tax Optimizer
              </h1>
              <div style="color: rgba(255, 255, 255, 0.9); margin-top: 8px; font-size: 14px;">
                ${config.urgency}
              </div>
            </div>

            <!-- Content -->
            <div style="background-color: white; padding: 32px; border-radius: 0 0 12px 12px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">

              <!-- Alert Badge -->
              <div style="display: inline-block; padding: 6px 12px; background-color: ${config.color}; color: white; border-radius: 6px; font-size: 12px; font-weight: 600; text-transform: uppercase; margin-bottom: 16px;">
                ${alert.category}
              </div>

              <!-- Title -->
              <h2 style="color: #111827; margin: 0 0 16px 0; font-size: 22px;">
                ${alert.title}
              </h2>

              <!-- Message -->
              <div style="color: #4b5563; font-size: 16px; line-height: 1.7; margin-bottom: 16px;">
                ${alert.message}
              </div>

              <!-- Due Date -->
              ${dueDateText}

              <!-- Metadata -->
              ${metadataHtml}

              <!-- Action Button -->
              ${actionButton}

              <!-- Footer Info -->
              <div style="margin-top: 32px; padding-top: 24px; border-top: 1px solid #e5e7eb;">
                <div style="font-size: 14px; color: #6b7280;">
                  ${alert.financial_year ? `<div>Financial Year: ${alert.financial_year}</div>` : ''}
                  ${alert.platform ? `<div style="margin-top: 4px;">Platform: <span style="text-transform: capitalize;">${alert.platform}</span></div>` : ''}
                </div>
              </div>
            </div>

            <!-- Email Footer -->
            <div style="text-align: center; padding: 24px; color: #9ca3af; font-size: 13px;">
              <p style="margin: 0 0 8px 0;">
                This is an automated tax alert from Australian Tax Optimizer
              </p>
              <p style="margin: 0;">
                <a href="${optionalConfig.appUrl || 'https://ato-ai.app'}/dashboard/alerts" style="color: #667eea; text-decoration: none;">
                  View all alerts
                </a>
                •
                <a href="${optionalConfig.appUrl || 'https://ato-ai.app'}/dashboard/alerts/preferences" style="color: #667eea; text-decoration: none;">
                  Manage preferences
                </a>
              </p>
              <p style="margin: 16px 0 0 0; font-size: 11px; color: #d1d5db;">
                Australian Tax Optimizer provides intelligence and estimates, not binding financial advice.
                <br>
                Consult a qualified tax professional before implementing any recommendations.
              </p>
            </div>

          </div>
        </body>
        </html>
      `
    })

    const messageId = response.headers['x-message-id'] || ''
    log.info('Email sent for alert', { alertId: alert.id, recipientEmail, messageId })

    return {
      success: true,
      emailId: messageId
    }

  } catch (error) {
    console.error('Error sending alert email:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}

/**
 * Send email notifications for multiple alerts
 */
export async function sendAlertEmails(
  alerts: TaxAlert[],
  recipientEmail: string,
  recipientName?: string
): Promise<{ sent: number; failed: number }> {
  let sent = 0
  let failed = 0

  for (const alert of alerts) {
    const result = await sendAlertEmail(alert, recipientEmail, recipientName)

    if (result.success) {
      sent++

      // Mark as email sent in database
      const supabase = await createServiceClient()
      await supabase
        .from('tax_alerts')
        .update({
          email_sent: true,
          email_sent_at: new Date().toISOString()
        })
        .eq('id', alert.id)

      // Log in history
      await supabase.from('tax_alert_history').insert({
        alert_id: alert.id,
        tenant_id: alert.tenant_id,
        event_type: 'email_sent',
        metadata: { email_id: result.emailId }
      })
    } else {
      failed++
      console.error(`Failed to send email for alert ${alert.id}:`, result.error)
    }

    // Rate limiting: Wait 100ms between emails
    await new Promise(resolve => setTimeout(resolve, 100))
  }

  return { sent, failed }
}

/**
 * Check and send pending alert emails
 * Called by scheduled job
 */
export async function sendPendingAlertEmails(): Promise<void> {
  log.info('Checking for pending alert emails')

  const supabase = await createServiceClient()

  // Get users with email notifications enabled
  const { data: preferences } = await supabase
    .from('tax_alert_preferences')
    .select('tenant_id, email_notifications, notification_email')
    .eq('alerts_enabled', true)
    .eq('email_notifications', true)

  if (!preferences || preferences.length === 0) {
    log.info('No users with email notifications enabled')
    return
  }

  for (const pref of preferences) {
    try {
      // Get unread alerts that haven't been emailed yet
      const { data: alerts } = await supabase
        .from('tax_alerts')
        .select('*')
        .eq('tenant_id', pref.tenant_id)
        .eq('status', 'unread')
        .eq('email_sent', false)
        .order('severity', { ascending: false }) // Critical first
        .order('triggered_at', { ascending: false })
        .limit(10) // Max 10 alerts per batch

      if (!alerts || alerts.length === 0) {
        continue
      }

      // Get user email
      const { data: user } = await supabase.auth.admin.getUserById(pref.tenant_id)
      const recipientEmail = pref.notification_email || user?.user?.email

      if (!recipientEmail) {
        console.warn(`No email found for tenant ${pref.tenant_id}`)
        continue
      }

      // Send emails
      const result = await sendAlertEmails(alerts as TaxAlert[], recipientEmail)
      log.info('Alert emails sent', { sent: result.sent, failed: result.failed, recipientEmail })

    } catch (error) {
      console.error(`Error processing alerts for tenant ${pref.tenant_id}:`, error)
    }
  }

  log.info('Pending alert emails processed')
}
