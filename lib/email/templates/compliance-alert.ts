/**
 * Compliance Alert Email Template
 *
 * Sent when the weekly compliance CRON detects a tax rate change
 * or when an upcoming deadline is within 7 days.
 */

import type { Jurisdiction, RateChangeEvent, ComplianceDeadline } from '@/lib/types/jurisdiction'
import { JURISDICTION_CONFIGS } from '@/lib/types/jurisdiction'

export function buildComplianceAlertHTML(
  jurisdiction: Jurisdiction,
  rateChanges: RateChangeEvent[],
  upcomingDeadlines: ComplianceDeadline[]
): string {
  const config = JURISDICTION_CONFIGS[jurisdiction]

  const rateChangeRows = rateChanges.map((change) => `
    <tr>
      <td style="padding: 8px 12px; border-bottom: 1px solid #1a1a1a; color: #e0e0e0;">${change.rateType}</td>
      <td style="padding: 8px 12px; border-bottom: 1px solid #1a1a1a; color: #FF4444;">${change.oldValue}</td>
      <td style="padding: 8px 12px; border-bottom: 1px solid #1a1a1a; color: #00FF88;">${change.newValue}</td>
      <td style="padding: 8px 12px; border-bottom: 1px solid #1a1a1a; color: #a0a0a0;">${change.rateKey}</td>
    </tr>
  `).join('')

  const deadlineRows = upcomingDeadlines.map((d) => `
    <tr>
      <td style="padding: 8px 12px; border-bottom: 1px solid #1a1a1a; color: #e0e0e0;">${d.deadlineName}</td>
      <td style="padding: 8px 12px; border-bottom: 1px solid #1a1a1a; color: #FFB800;">${d.dueDate}</td>
      <td style="padding: 8px 12px; border-bottom: 1px solid #1a1a1a; color: #a0a0a0;">${d.description || ''}</td>
    </tr>
  `).join('')

  return `
    <!DOCTYPE html>
    <html>
    <head><meta charset="utf-8"></head>
    <body style="margin: 0; padding: 0; background-color: #050505; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
      <div style="max-width: 600px; margin: 0 auto; padding: 32px 24px;">
        <div style="text-align: center; margin-bottom: 24px;">
          <h1 style="color: #00F5FF; font-size: 20px; font-weight: 600; margin: 0;">
            ATO Tax Optimizer — Compliance Alert
          </h1>
          <p style="color: #a0a0a0; font-size: 14px; margin: 8px 0 0;">
            ${config.name} (${config.taxAuthorityAbbrev}) • ${new Date().toLocaleDateString('en-AU')}
          </p>
        </div>

        ${rateChanges.length > 0 ? `
          <div style="background: #0a0a0a; border: 1px solid #1a1a1a; border-radius: 4px; padding: 20px; margin-bottom: 16px;">
            <h2 style="color: #FF4444; font-size: 16px; margin: 0 0 12px;">
              ⚠ Rate Changes Detected
            </h2>
            <table style="width: 100%; border-collapse: collapse;">
              <thead>
                <tr style="border-bottom: 2px solid #333;">
                  <th style="padding: 8px 12px; text-align: left; color: #666; font-size: 12px;">Type</th>
                  <th style="padding: 8px 12px; text-align: left; color: #666; font-size: 12px;">Old</th>
                  <th style="padding: 8px 12px; text-align: left; color: #666; font-size: 12px;">New</th>
                  <th style="padding: 8px 12px; text-align: left; color: #666; font-size: 12px;">Key</th>
                </tr>
              </thead>
              <tbody>${rateChangeRows}</tbody>
            </table>
          </div>
        ` : ''}

        ${upcomingDeadlines.length > 0 ? `
          <div style="background: #0a0a0a; border: 1px solid #1a1a1a; border-radius: 4px; padding: 20px; margin-bottom: 16px;">
            <h2 style="color: #FFB800; font-size: 16px; margin: 0 0 12px;">
              📅 Upcoming Deadlines (Next 30 Days)
            </h2>
            <table style="width: 100%; border-collapse: collapse;">
              <thead>
                <tr style="border-bottom: 2px solid #333;">
                  <th style="padding: 8px 12px; text-align: left; color: #666; font-size: 12px;">Deadline</th>
                  <th style="padding: 8px 12px; text-align: left; color: #666; font-size: 12px;">Due Date</th>
                  <th style="padding: 8px 12px; text-align: left; color: #666; font-size: 12px;">Details</th>
                </tr>
              </thead>
              <tbody>${deadlineRows}</tbody>
            </table>
          </div>
        ` : ''}

        <div style="text-align: center; margin-top: 24px; padding-top: 16px; border-top: 1px solid #1a1a1a;">
          <p style="color: #666; font-size: 12px; margin: 0;">
            Australian Tax Optimizer • Forensic Tax Recovery Platform
            <br>Advisory only — no ${config.taxAuthorityAbbrev} lodgement
          </p>
        </div>
      </div>
    </body>
    </html>
  `
}

export function buildComplianceAlertText(
  jurisdiction: Jurisdiction,
  rateChanges: RateChangeEvent[],
  upcomingDeadlines: ComplianceDeadline[]
): string {
  const config = JURISDICTION_CONFIGS[jurisdiction]
  let text = `ATO Tax Optimizer — Compliance Alert\n${config.name} (${config.taxAuthorityAbbrev})\n\n`

  if (rateChanges.length > 0) {
    text += `RATE CHANGES DETECTED:\n`
    for (const change of rateChanges) {
      text += `  ${change.rateType}:${change.rateKey} — ${change.oldValue} → ${change.newValue}\n`
    }
    text += '\n'
  }

  if (upcomingDeadlines.length > 0) {
    text += `UPCOMING DEADLINES:\n`
    for (const d of upcomingDeadlines) {
      text += `  ${d.dueDate} — ${d.deadlineName}: ${d.description || ''}\n`
    }
  }

  return text
}
