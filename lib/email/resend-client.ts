/**
 * Resend Email Client
 *
 * Email delivery service for organization invitations and notifications
 */

import { Resend } from 'resend'

// Initialize Resend client with fallback for build time
const resend = new Resend(process.env.RESEND_API_KEY || 're_placeholder')

// Default sender email (must be verified in Resend)
const DEFAULT_FROM_EMAIL =
  process.env.RESEND_FROM_EMAIL || 'noreply@yourdomain.com'

export interface SendInvitationEmailParams {
  to: string
  organizationName: string
  inviterName: string
  role: string
  invitationUrl: string
  expiresAt: string
}

/**
 * Send organization invitation email
 */
export async function sendInvitationEmail(
  params: SendInvitationEmailParams
): Promise<{ success: boolean; error?: string; messageId?: string }> {
  try {
    const { data, error } = await resend.emails.send({
      from: DEFAULT_FROM_EMAIL,
      to: params.to,
      subject: `Invitation to join ${params.organizationName} on ATO Tax Optimizer`,
      html: getInvitationEmailHTML(params),
      text: getInvitationEmailText(params),
    })

    if (error) {
      console.error('Resend error:', error)
      return { success: false, error: error.message }
    }

    return { success: true, messageId: data?.id }
  } catch (error) {
    console.error('Failed to send invitation email:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

/**
 * Generate HTML email template for invitation
 */
function getInvitationEmailHTML(params: SendInvitationEmailParams): string {
  const expiryDate = new Date(params.expiresAt).toLocaleDateString('en-AU', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Organization Invitation</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f3f4f6;">
  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #f3f4f6;">
    <tr>
      <td style="padding: 40px 20px;">
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);">

          <!-- Header -->
          <tr>
            <td style="padding: 40px 40px 20px; text-align: center; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 8px 8px 0 0;">
              <h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: 600;">
                ATO Tax Optimizer
              </h1>
            </td>
          </tr>

          <!-- Content -->
          <tr>
            <td style="padding: 40px;">
              <h2 style="margin: 0 0 16px; color: #111827; font-size: 20px; font-weight: 600;">
                You've been invited!
              </h2>

              <p style="margin: 0 0 24px; color: #4b5563; font-size: 16px; line-height: 1.5;">
                <strong>${params.inviterName}</strong> has invited you to join <strong>${params.organizationName}</strong> on ATO Tax Optimizer.
              </p>

              <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="width: 100%; margin: 0 0 24px;">
                <tr>
                  <td style="padding: 16px; background-color: #f9fafb; border-radius: 6px; border-left: 4px solid #667eea;">
                    <p style="margin: 0; color: #374151; font-size: 14px;">
                      <strong>Your Role:</strong> ${getRoleDisplayName(params.role)}
                    </p>
                    <p style="margin: 8px 0 0; color: #6b7280; font-size: 13px;">
                      ${getRoleDescription(params.role)}
                    </p>
                  </td>
                </tr>
              </table>

              <!-- Call to Action Button -->
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="width: 100%; margin: 0 0 24px;">
                <tr>
                  <td style="text-align: center;">
                    <a href="${params.invitationUrl}" style="display: inline-block; padding: 14px 32px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: #ffffff; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 16px;">
                      Accept Invitation
                    </a>
                  </td>
                </tr>
              </table>

              <p style="margin: 0 0 16px; color: #6b7280; font-size: 14px; line-height: 1.5;">
                Or copy and paste this link into your browser:
              </p>
              <p style="margin: 0 0 24px; color: #667eea; font-size: 13px; word-break: break-all;">
                ${params.invitationUrl}
              </p>

              <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="width: 100%; margin: 0 0 24px;">
                <tr>
                  <td style="padding: 12px; background-color: #fef3c7; border-radius: 6px; border-left: 4px solid #f59e0b;">
                    <p style="margin: 0; color: #92400e; font-size: 13px;">
                      ⏰ This invitation expires on <strong>${expiryDate}</strong>
                    </p>
                  </td>
                </tr>
              </table>

              <p style="margin: 0; color: #9ca3af; font-size: 13px; line-height: 1.5;">
                If you didn't expect this invitation, you can safely ignore this email.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 24px 40px; background-color: #f9fafb; border-top: 1px solid #e5e7eb; border-radius: 0 0 8px 8px; text-align: center;">
              <p style="margin: 0; color: #6b7280; font-size: 12px;">
                © ${new Date().getFullYear()} ATO Tax Optimizer. All rights reserved.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim()
}

/**
 * Generate plain text email template for invitation
 */
function getInvitationEmailText(params: SendInvitationEmailParams): string {
  const expiryDate = new Date(params.expiresAt).toLocaleDateString('en-AU', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })

  return `
You've been invited to ATO Tax Optimizer!

${params.inviterName} has invited you to join ${params.organizationName}.

Your Role: ${getRoleDisplayName(params.role)}
${getRoleDescription(params.role)}

Accept your invitation by clicking this link:
${params.invitationUrl}

⏰ This invitation expires on ${expiryDate}

If you didn't expect this invitation, you can safely ignore this email.

© ${new Date().getFullYear()} ATO Tax Optimizer
  `.trim()
}

/**
 * Get role display name
 */
function getRoleDisplayName(role: string): string {
  const names: Record<string, string> = {
    owner: 'Owner',
    admin: 'Administrator',
    accountant: 'Accountant',
    read_only: 'Read Only',
  }
  return names[role] || role
}

/**
 * Get role description
 */
function getRoleDescription(role: string): string {
  const descriptions: Record<string, string> = {
    owner: 'Full control over organisation, including billing and deletion',
    admin: 'Manage users and settings, generate reports and analysis',
    accountant: 'View all data, generate reports, and run tax analysis',
    read_only: 'View-only access to reports and analysis results',
  }
  return descriptions[role] || ''
}
