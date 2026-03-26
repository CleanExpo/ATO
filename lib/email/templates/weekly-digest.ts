/**
 * Weekly Digest Email Template
 *
 * Sent every Monday to organisation owners/admins who have opted in.
 * Summarises analyses completed, key findings, and upcoming deadlines.
 */

import type { Jurisdiction } from '@/lib/types/jurisdiction'
import { JURISDICTION_CONFIGS } from '@/lib/types/jurisdiction'

export interface DigestData {
  organisationName: string
  jurisdiction: Jurisdiction
  period: string // e.g. "17 Mar – 23 Mar 2026"
  analysesCompleted: number
  totalTaxRecoveryIdentified: number
  keyFindings: Array<{ engine: string; finding: string; amount?: number }>
  upcomingDeadlines: Array<{ name: string; dueDate: string; daysUntil: number }>
  rateChanges: Array<{ description: string }>
}

export function buildWeeklyDigestHTML(data: DigestData): string {
  const config = JURISDICTION_CONFIGS[data.jurisdiction]

  const findingRows = data.keyFindings.map((f) => `
    <tr>
      <td style="padding: 8px 12px; border-bottom: 1px solid #1a1a1a; color: #00F5FF; font-size: 13px;">${f.engine}</td>
      <td style="padding: 8px 12px; border-bottom: 1px solid #1a1a1a; color: #e0e0e0; font-size: 13px;">${f.finding}</td>
      <td style="padding: 8px 12px; border-bottom: 1px solid #1a1a1a; color: #00FF88; font-size: 13px; text-align: right;">
        ${f.amount ? `${config.currencySymbol}${f.amount.toLocaleString()}` : '—'}
      </td>
    </tr>
  `).join('')

  const deadlineRows = data.upcomingDeadlines.map((d) => {
    const urgency = d.daysUntil <= 7 ? '#FF4444' : d.daysUntil <= 14 ? '#FFB800' : '#a0a0a0'
    return `
      <div style="display: flex; justify-content: space-between; padding: 6px 0; border-bottom: 1px solid #111;">
        <span style="color: #e0e0e0; font-size: 13px;">${d.name}</span>
        <span style="color: ${urgency}; font-size: 13px;">${d.dueDate} (${d.daysUntil}d)</span>
      </div>
    `
  }).join('')

  return `
    <!DOCTYPE html>
    <html>
    <head><meta charset="utf-8"></head>
    <body style="margin: 0; padding: 0; background-color: #050505; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
      <div style="max-width: 600px; margin: 0 auto; padding: 32px 24px;">
        <div style="text-align: center; margin-bottom: 24px;">
          <h1 style="color: #00F5FF; font-size: 20px; font-weight: 600; margin: 0;">
            Weekly Tax Intelligence Digest
          </h1>
          <p style="color: #a0a0a0; font-size: 14px; margin: 8px 0 0;">
            ${data.organisationName} • ${data.period}
          </p>
        </div>

        <div style="display: flex; gap: 12px; margin-bottom: 20px;">
          <div style="flex: 1; background: #0a0a0a; border: 1px solid #1a1a1a; border-radius: 4px; padding: 16px; text-align: center;">
            <div style="color: #00F5FF; font-size: 28px; font-weight: 700;">${data.analysesCompleted}</div>
            <div style="color: #666; font-size: 11px; text-transform: uppercase; letter-spacing: 1px;">Analyses</div>
          </div>
          <div style="flex: 1; background: #0a0a0a; border: 1px solid #1a1a1a; border-radius: 4px; padding: 16px; text-align: center;">
            <div style="color: #00FF88; font-size: 28px; font-weight: 700;">
              ${config.currencySymbol}${data.totalTaxRecoveryIdentified.toLocaleString()}
            </div>
            <div style="color: #666; font-size: 11px; text-transform: uppercase; letter-spacing: 1px;">Recovery Found</div>
          </div>
        </div>

        ${data.keyFindings.length > 0 ? `
          <div style="background: #0a0a0a; border: 1px solid #1a1a1a; border-radius: 4px; padding: 20px; margin-bottom: 16px;">
            <h2 style="color: #e0e0e0; font-size: 14px; margin: 0 0 12px; text-transform: uppercase; letter-spacing: 1px;">Key Findings</h2>
            <table style="width: 100%; border-collapse: collapse;">
              <tbody>${findingRows}</tbody>
            </table>
          </div>
        ` : ''}

        ${data.upcomingDeadlines.length > 0 ? `
          <div style="background: #0a0a0a; border: 1px solid #1a1a1a; border-radius: 4px; padding: 20px; margin-bottom: 16px;">
            <h2 style="color: #FFB800; font-size: 14px; margin: 0 0 12px; text-transform: uppercase; letter-spacing: 1px;">Upcoming Deadlines</h2>
            ${deadlineRows}
          </div>
        ` : ''}

        <div style="text-align: center; margin-top: 24px;">
          <a href="${process.env.NEXT_PUBLIC_APP_URL || 'https://ato-blush.vercel.app'}/dashboard"
             style="display: inline-block; padding: 12px 24px; background: #00F5FF1a; border: 1px solid #00F5FF4d; border-radius: 4px; color: #00F5FF; text-decoration: none; font-size: 14px; font-weight: 500;">
            View Full Dashboard →
          </a>
        </div>

        <div style="text-align: center; margin-top: 24px; padding-top: 16px; border-top: 1px solid #1a1a1a;">
          <p style="color: #666; font-size: 12px; margin: 0;">
            ${config.taxAuthorityAbbrev} Jurisdiction • Advisory only — no lodgement
          </p>
        </div>
      </div>
    </body>
    </html>
  `
}

export function buildWeeklyDigestText(data: DigestData): string {
  const config = JURISDICTION_CONFIGS[data.jurisdiction]
  let text = `Weekly Tax Intelligence Digest\n`
  text += `${data.organisationName} • ${data.period}\n\n`
  text += `Analyses completed: ${data.analysesCompleted}\n`
  text += `Tax recovery identified: ${config.currencySymbol}${data.totalTaxRecoveryIdentified.toLocaleString()}\n\n`

  if (data.keyFindings.length > 0) {
    text += `KEY FINDINGS:\n`
    for (const f of data.keyFindings) {
      text += `  [${f.engine}] ${f.finding}${f.amount ? ` — ${config.currencySymbol}${f.amount.toLocaleString()}` : ''}\n`
    }
    text += '\n'
  }

  if (data.upcomingDeadlines.length > 0) {
    text += `UPCOMING DEADLINES:\n`
    for (const d of data.upcomingDeadlines) {
      text += `  ${d.dueDate} (${d.daysUntil}d) — ${d.name}\n`
    }
  }

  return text
}
