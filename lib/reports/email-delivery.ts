/**
 * Email Delivery System
 *
 * Sends reports via email using SendGrid API.
 * Supports PDF and Excel attachments.
 */

import sgMail from '@sendgrid/mail'
import { createLogger } from '@/lib/logger'

const log = createLogger('reports:email-delivery')

sgMail.setApiKey(process.env.SENDGRID_API_KEY || 'SG.placeholder')

/**
 * Email configuration
 */
export interface EmailConfig {
  to: string | string[]
  subject: string
  from?: string
  replyTo?: string
  cc?: string | string[]
  bcc?: string | string[]
}

/**
 * Attachment configuration
 */
export interface EmailAttachment {
  filename: string
  content: Buffer
  contentType: string
}

/**
 * Send report email with attachments
 *
 * @param config - Email configuration
 * @param htmlContent - HTML email body
 * @param attachments - File attachments
 * @returns Message ID from SendGrid
 */
export async function sendReportEmail(
  config: EmailConfig,
  htmlContent: string,
  attachments: EmailAttachment[] = []
): Promise<{ id: string; success: boolean }> {
  try {
    const msg: sgMail.MailDataRequired = {
      from: config.from || 'ATO Tax Optimizer <support@carsi.com.au>',
      to: Array.isArray(config.to) ? config.to : [config.to],
      subject: config.subject,
      html: htmlContent,
      replyTo: config.replyTo || 'phill.m@carsi.com.au',
      cc: config.cc ? (Array.isArray(config.cc) ? config.cc : [config.cc]) : undefined,
      bcc: config.bcc ? (Array.isArray(config.bcc) ? config.bcc : [config.bcc]) : undefined,
      attachments: attachments.map((att) => ({
        filename: att.filename,
        content: att.content.toString('base64'),
        type: att.contentType,
        disposition: 'attachment' as const,
      })),
    }

    const [response] = await sgMail.send(msg)
    const messageId = response.headers['x-message-id'] || ''

    log.info('Email sent successfully', { messageId, statusCode: response.statusCode })
    return {
      id: messageId,
      success: true,
    }
  } catch (error) {
    console.error('Failed to send email:', error)
    throw error
  }
}

/**
 * Send forensic audit report
 */
export async function sendForensicReport(
  recipientEmail: string,
  organizationName: string,
  pdfBuffer: Buffer,
  excelBuffer?: Buffer
): Promise<{ id: string; success: boolean }> {
  const subject = `Forensic Tax Audit Report - ${organizationName}`

  const htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      line-height: 1.6;
      color: #1e293b;
      max-width: 600px;
      margin: 0 auto;
      padding: 20px;
    }
    .header {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 30px;
      border-radius: 12px;
      text-align: center;
      margin-bottom: 30px;
    }
    .header h1 {
      margin: 0;
      font-size: 24px;
    }
    .content {
      background: #f8fafc;
      padding: 25px;
      border-radius: 8px;
      margin-bottom: 20px;
    }
    .highlight {
      background: white;
      padding: 20px;
      border-left: 4px solid #6366f1;
      border-radius: 4px;
      margin: 20px 0;
    }
    .button {
      display: inline-block;
      background: #6366f1;
      color: white;
      padding: 12px 24px;
      text-decoration: none;
      border-radius: 6px;
      margin: 10px 5px;
      font-weight: 600;
    }
    .footer {
      text-align: center;
      font-size: 12px;
      color: #64748b;
      margin-top: 40px;
      padding-top: 20px;
      border-top: 1px solid #e2e8f0;
    }
    ul {
      padding-left: 20px;
    }
    li {
      margin: 8px 0;
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>🎯 Your Forensic Tax Audit Report is Ready</h1>
    <p style="margin: 10px 0 0 0; opacity: 0.95;">
      ${organizationName}
    </p>
  </div>

  <div class="content">
    <h2 style="margin-top: 0; color: #1e293b;">Report Summary</h2>
    <p>
      Your comprehensive forensic tax audit has been completed. This report identifies
      potential tax optimization opportunities across:
    </p>
    <ul>
      <li><strong>R&D Tax Incentive</strong> (Division 355) - 43.5% refundable offset</li>
      <li><strong>General Deductions</strong> - Unclaimed business expenses</li>
      <li><strong>Loss Carry-Forward</strong> - Tax loss optimization</li>
      <li><strong>Division 7A Compliance</strong> - Private company loan analysis</li>
    </ul>

    <div class="highlight">
      <p style="margin: 0; font-size: 14px; color: #64748b;">
        <strong>⚡ Quick Actions:</strong>
      </p>
      <ol style="margin: 10px 0 0 0;">
        <li>Review the attached PDF report</li>
        <li>Consult with your tax accountant</li>
        <li>Prioritize recommendations by deadline</li>
        <li>Gather supporting documentation</li>
      </ol>
    </div>
  </div>

  <div style="text-align: center; margin: 30px 0;">
    <p style="color: #64748b; margin-bottom: 15px;">
      Attached files:
    </p>
    <div>
      📄 Forensic_Audit_Report.pdf
    </div>
    ${excelBuffer ? '<div>📊 Analysis_Workbook.xlsx</div>' : ''}
  </div>

  <div class="content">
    <h3 style="margin-top: 0; color: #1e293b;">Important Notice</h3>
    <p style="font-size: 14px; color: #475569;">
      This report is based on automated AI analysis of your financial data and is for
      informational purposes only. It does not constitute legal or tax advice. All
      recommendations should be reviewed by a qualified tax professional before taking action.
    </p>
  </div>

  <div class="footer">
    <p>
      <strong>ATO Tax Optimizer</strong><br>
      Powered by AI-driven forensic analysis
    </p>
    <p style="margin-top: 15px;">
      Questions? Reply to this email or contact your account manager.
    </p>
  </div>
</body>
</html>
  `

  const attachments: EmailAttachment[] = [
    {
      filename: `Forensic_Audit_Report_${organizationName.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`,
      content: pdfBuffer,
      contentType: 'application/pdf',
    },
  ]

  if (excelBuffer) {
    attachments.push({
      filename: `Analysis_Workbook_${organizationName.replace(/[^a-zA-Z0-9]/g, '_')}.xlsx`,
      content: excelBuffer,
      contentType:
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    })
  }

  return sendReportEmail(
    {
      to: recipientEmail,
      subject,
    },
    htmlContent,
    attachments
  )
}

/**
 * Send R&D claim summary email
 */
export async function sendRndSummaryEmail(
  recipientEmail: string,
  organizationName: string,
  summary: {
    totalProjects: number
    totalExpenditure: number
    totalOffset: number
    averageConfidence: number
  }
): Promise<{ id: string; success: boolean }> {
  const subject = `R&D Tax Incentive Summary - ${organizationName}`

  const htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      line-height: 1.6;
      color: #1e293b;
      max-width: 600px;
      margin: 0 auto;
      padding: 20px;
    }
    .header {
      background: linear-gradient(135deg, #10b981 0%, #059669 100%);
      color: white;
      padding: 30px;
      border-radius: 12px;
      text-align: center;
      margin-bottom: 30px;
    }
    .stat {
      text-align: center;
      padding: 20px;
      background: #f0fdf4;
      border-radius: 8px;
      margin: 10px 0;
    }
    .stat-value {
      font-size: 36px;
      font-weight: bold;
      color: #10b981;
      margin: 10px 0;
    }
    .stat-label {
      font-size: 14px;
      color: #64748b;
      text-transform: uppercase;
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>🔬 R&D Tax Incentive Analysis</h1>
    <p>${organizationName}</p>
  </div>

  <div class="stat">
    <div class="stat-label">Total R&D Projects</div>
    <div class="stat-value">${summary.totalProjects}</div>
  </div>

  <div class="stat">
    <div class="stat-label">Eligible Expenditure</div>
    <div class="stat-value">$${summary.totalExpenditure.toLocaleString()}</div>
  </div>

  <div class="stat">
    <div class="stat-label">Estimated 43.5% Offset</div>
    <div class="stat-value">$${summary.totalOffset.toLocaleString()}</div>
  </div>

  <div class="stat">
    <div class="stat-label">Average Confidence</div>
    <div class="stat-value">${summary.averageConfidence}%</div>
  </div>

  <div style="margin-top: 30px; padding: 20px; background: #fef3c7; border-left: 4px solid #f59e0b; border-radius: 4px;">
    <p style="margin: 0; font-weight: 600;">⚠️ Next Steps</p>
    <ol style="margin: 10px 0;">
      <li>Register R&D activities with AusIndustry (within 10 months)</li>
      <li>Maintain detailed project documentation</li>
      <li>Lodge R&D Tax Incentive schedule with tax return</li>
    </ol>
  </div>
</body>
</html>
  `

  return sendReportEmail(
    {
      to: recipientEmail,
      subject,
    },
    htmlContent
  )
}

/**
 * Send deadline reminder email
 */
export async function sendDeadlineReminder(
  recipientEmail: string,
  organizationName: string,
  deadline: {
    action: string
    date: Date
    daysRemaining: number
  }
): Promise<{ id: string; success: boolean }> {
  const subject = `⏰ Tax Deadline Reminder - ${deadline.action}`

  const urgencyColor =
    deadline.daysRemaining <= 7
      ? '#ef4444'
      : deadline.daysRemaining <= 30
        ? '#f59e0b'
        : '#6366f1'

  const htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      max-width: 600px;
      margin: 0 auto;
      padding: 20px;
    }
    .header {
      background: ${urgencyColor};
      color: white;
      padding: 30px;
      border-radius: 12px;
      text-align: center;
    }
    .countdown {
      font-size: 48px;
      font-weight: bold;
      margin: 20px 0;
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>⏰ Tax Deadline Reminder</h1>
    <div class="countdown">${deadline.daysRemaining} days</div>
    <p style="margin: 0; font-size: 18px;">${deadline.action}</p>
  </div>

  <div style="padding: 20px; margin: 20px 0; background: #f8fafc; border-radius: 8px;">
    <p><strong>Organization:</strong> ${organizationName}</p>
    <p><strong>Deadline:</strong> ${deadline.date.toLocaleDateString()}</p>
    <p><strong>Action Required:</strong> ${deadline.action}</p>
  </div>

  ${
    deadline.daysRemaining <= 7
      ? `
  <div style="padding: 15px; background: #fee2e2; border-left: 4px solid #dc2626; border-radius: 4px;">
    <strong>🚨 URGENT:</strong> This deadline is approaching fast. Please take immediate action.
  </div>
  `
      : ''
  }
</body>
</html>
  `

  return sendReportEmail(
    {
      to: recipientEmail,
      subject,
    },
    htmlContent
  )
}
