/**
 * Resend Email Client
 *
 * Email delivery service for organization invitations and notifications
 */

import { Resend } from 'resend'

// Lazy-initialize Resend client
let resendInstance: Resend | null = null;

function getResendInstance(): Resend {
  if (!resendInstance) {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey || apiKey === 're_placeholder') {
      throw new Error('RESEND_API_KEY not configured. Email delivery unavailable.');
    }
    resendInstance = new Resend(apiKey);
  }
  return resendInstance;
}

const resend = new Proxy({} as Resend, {
  get(_target, prop) {
    return (getResendInstance() as any)[prop];
  },
});

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

export interface SendAccountantWelcomeEmailParams {
  to: string
  firstName: string
  lastName: string
  firmName: string
  pricingTier: 'standard' | 'professional' | 'enterprise'
  loginUrl: string
}

export interface SendAccountantRejectionEmailParams {
  to: string
  firstName: string
  rejectionReason?: string
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
 * Send welcome email to approved accountant
 */
export async function sendAccountantWelcomeEmail(
  params: SendAccountantWelcomeEmailParams
): Promise<{ success: boolean; error?: string; messageId?: string }> {
  try {
    const { data, error } = await resend.emails.send({
      from: DEFAULT_FROM_EMAIL,
      to: params.to,
      subject: `Welcome to ATO Tax Optimizer - Your Application Has Been Approved`,
      html: getAccountantWelcomeEmailHTML(params),
      text: getAccountantWelcomeEmailText(params),
    })

    if (error) {
      console.error('Resend error:', error)
      return { success: false, error: error.message }
    }

    return { success: true, messageId: data?.id }
  } catch (error) {
    console.error('Failed to send welcome email:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

/**
 * Send rejection email to accountant applicant
 */
export async function sendAccountantRejectionEmail(
  params: SendAccountantRejectionEmailParams
): Promise<{ success: boolean; error?: string; messageId?: string }> {
  try {
    const { data, error } = await resend.emails.send({
      from: DEFAULT_FROM_EMAIL,
      to: params.to,
      subject: `ATO Tax Optimizer - Application Status Update`,
      html: getAccountantRejectionEmailHTML(params),
      text: getAccountantRejectionEmailText(params),
    })

    if (error) {
      console.error('Resend error:', error)
      return { success: false, error: error.message }
    }

    return { success: true, messageId: data?.id }
  } catch (error) {
    console.error('Failed to send rejection email:', error)
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

/**
 * Generate HTML email template for accountant welcome
 */
function getAccountantWelcomeEmailHTML(params: SendAccountantWelcomeEmailParams): string {
  const pricingDetails = getPricingDetails(params.pricingTier)

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Welcome to ATO Tax Optimizer</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f3f4f6;">
  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #f3f4f6;">
    <tr>
      <td style="padding: 40px 20px;">
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);">

          <!-- Header -->
          <tr>
            <td style="padding: 40px 40px 20px; text-align: center; background: linear-gradient(135deg, #10b981 0%, #059669 100%); border-radius: 8px 8px 0 0;">
              <h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: 600;">
                Welcome to ATO Tax Optimizer
              </h1>
            </td>
          </tr>

          <!-- Content -->
          <tr>
            <td style="padding: 40px;">
              <div style="text-align: center; margin-bottom: 24px;">
                <span style="display: inline-block; font-size: 48px;">🎉</span>
              </div>

              <h2 style="margin: 0 0 16px; color: #111827; font-size: 20px; font-weight: 600; text-align: center;">
                Congratulations, ${params.firstName}!
              </h2>

              <p style="margin: 0 0 24px; color: #4b5563; font-size: 16px; line-height: 1.5; text-align: center;">
                Your application has been <strong style="color: #10b981;">approved</strong>! You now have access to our platform with wholesale pricing.
              </p>

              <!-- Firm Details -->
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="width: 100%; margin: 0 0 24px;">
                <tr>
                  <td style="padding: 20px; background-color: #f0fdf4; border-radius: 8px; border-left: 4px solid #10b981;">
                    <p style="margin: 0 0 8px; color: #374151; font-size: 15px;">
                      <strong>Firm:</strong> ${params.firmName}
                    </p>
                    <p style="margin: 0 0 8px; color: #374151; font-size: 15px;">
                      <strong>Pricing Tier:</strong> ${pricingDetails.name}
                    </p>
                    <p style="margin: 0; color: #6b7280; font-size: 14px;">
                      ${pricingDetails.description}
                    </p>
                  </td>
                </tr>
              </table>

              <h3 style="margin: 0 0 16px; color: #111827; font-size: 18px; font-weight: 600;">
                What's Next?
              </h3>

              <ol style="margin: 0 0 24px; padding-left: 20px; color: #4b5563; font-size: 15px; line-height: 1.8;">
                <li style="margin-bottom: 8px;">
                  <strong>Sign in to your account</strong> using the button below
                </li>
                <li style="margin-bottom: 8px;">
                  <strong>Upload client Xero data</strong> to begin forensic analysis
                </li>
                <li style="margin-bottom: 8px;">
                  <strong>Review AI-generated insights</strong> for R&D claims, deductions, and tax optimization
                </li>
                <li>
                  <strong>Generate reports</strong> for your clients with one click
                </li>
              </ol>

              <!-- Call to Action Button -->
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="width: 100%; margin: 0 0 24px;">
                <tr>
                  <td style="text-align: center;">
                    <a href="${params.loginUrl}" style="display: inline-block; padding: 14px 32px; background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: #ffffff; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 16px;">
                      Sign In Now
                    </a>
                  </td>
                </tr>
              </table>

              <!-- Support Info -->
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="width: 100%; margin: 0 0 24px;">
                <tr>
                  <td style="padding: 16px; background-color: #eff6ff; border-radius: 6px; border-left: 4px solid #3b82f6;">
                    <p style="margin: 0 0 8px; color: #1e40af; font-size: 14px; font-weight: 600;">
                      Need help getting started?
                    </p>
                    <p style="margin: 0; color: #1e3a8a; font-size: 13px; line-height: 1.5;">
                      Our support team is here to help. Email us at <a href="mailto:support@ato-optimizer.com" style="color: #2563eb; text-decoration: underline;">support@ato-optimizer.com</a> or check our documentation.
                    </p>
                  </td>
                </tr>
              </table>

              <p style="margin: 0; color: #9ca3af; font-size: 13px; line-height: 1.5; text-align: center;">
                We're excited to have ${params.firmName} as part of our accountant network.
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
 * Generate plain text email template for accountant welcome
 */
function getAccountantWelcomeEmailText(params: SendAccountantWelcomeEmailParams): string {
  const pricingDetails = getPricingDetails(params.pricingTier)

  return `
Welcome to ATO Tax Optimizer!

Congratulations, ${params.firstName}!

Your application has been approved! You now have access to our platform with wholesale pricing.

Firm: ${params.firmName}
Pricing Tier: ${pricingDetails.name}
${pricingDetails.description}

What's Next?

1. Sign in to your account: ${params.loginUrl}
2. Upload client Xero data to begin forensic analysis
3. Review AI-generated insights for R&D claims, deductions, and tax optimization
4. Generate reports for your clients with one click

Need help getting started?
Our support team is here to help. Email us at support@ato-optimizer.com

We're excited to have ${params.firmName} as part of our accountant network.

© ${new Date().getFullYear()} ATO Tax Optimizer
  `.trim()
}

/**
 * Generate HTML email template for accountant rejection
 */
function getAccountantRejectionEmailHTML(params: SendAccountantRejectionEmailParams): string {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Application Status Update</title>
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
                Application Status Update
              </h2>

              <p style="margin: 0 0 24px; color: #4b5563; font-size: 16px; line-height: 1.5;">
                Dear ${params.firstName},
              </p>

              <p style="margin: 0 0 24px; color: #4b5563; font-size: 16px; line-height: 1.5;">
                Thank you for your interest in joining ATO Tax Optimizer as an accountant partner.
              </p>

              <p style="margin: 0 0 24px; color: #4b5563; font-size: 16px; line-height: 1.5;">
                After careful review, we're unable to approve your application at this time. ${params.rejectionReason ? `<br><br><strong>Reason:</strong> ${params.rejectionReason}` : ''}
              </p>

              <!-- Reapplication Info -->
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="width: 100%; margin: 0 0 24px;">
                <tr>
                  <td style="padding: 16px; background-color: #eff6ff; border-radius: 6px; border-left: 4px solid #3b82f6;">
                    <p style="margin: 0 0 8px; color: #1e40af; font-size: 14px; font-weight: 600;">
                      You may reapply in the future
                    </p>
                    <p style="margin: 0; color: #1e3a8a; font-size: 13px; line-height: 1.5;">
                      If your circumstances change or you'd like to discuss this decision, please contact us at <a href="mailto:partnerships@ato-optimizer.com" style="color: #2563eb; text-decoration: underline;">partnerships@ato-optimizer.com</a>
                    </p>
                  </td>
                </tr>
              </table>

              <p style="margin: 0; color: #4b5563; font-size: 15px; line-height: 1.5;">
                We appreciate your interest and wish you the best.
              </p>

              <p style="margin: 24px 0 0; color: #6b7280; font-size: 14px;">
                Best regards,<br>
                ATO Tax Optimizer Team
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
 * Generate plain text email template for accountant rejection
 */
function getAccountantRejectionEmailText(params: SendAccountantRejectionEmailParams): string {
  return `
Application Status Update

Dear ${params.firstName},

Thank you for your interest in joining ATO Tax Optimizer as an accountant partner.

After careful review, we're unable to approve your application at this time.${params.rejectionReason ? `\n\nReason: ${params.rejectionReason}` : ''}

You may reapply in the future. If your circumstances change or you'd like to discuss this decision, please contact us at partnerships@ato-optimizer.com

We appreciate your interest and wish you the best.

Best regards,
ATO Tax Optimizer Team

© ${new Date().getFullYear()} ATO Tax Optimizer
  `.trim()
}

// ---------------------------------------------------------------------------
// Stripe webhook emails
// ---------------------------------------------------------------------------

export interface SendPurchaseConfirmationEmailParams {
  to: string
  productType: string
  amountPaid: number
  dashboardUrl: string
}

export interface SendPaymentFailureEmailParams {
  to: string
  pricingUrl: string
}

/**
 * Send purchase confirmation email after successful Stripe checkout
 */
export async function sendPurchaseConfirmationEmail(
  params: SendPurchaseConfirmationEmailParams
): Promise<{ success: boolean; error?: string; messageId?: string }> {
  try {
    const { data, error } = await resend.emails.send({
      from: DEFAULT_FROM_EMAIL,
      to: params.to,
      subject: 'Your ATO Tax Optimizer purchase is confirmed',
      html: getPurchaseConfirmationEmailHTML(params),
      text: getPurchaseConfirmationEmailText(params),
    })

    if (error) {
      console.error('Resend error:', error)
      return { success: false, error: error.message }
    }

    return { success: true, messageId: data?.id }
  } catch (error) {
    console.error('Failed to send purchase confirmation email:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

/**
 * Send payment failure email after a Stripe payment fails
 */
export async function sendPaymentFailureEmail(
  params: SendPaymentFailureEmailParams
): Promise<{ success: boolean; error?: string; messageId?: string }> {
  try {
    const { data, error } = await resend.emails.send({
      from: DEFAULT_FROM_EMAIL,
      to: params.to,
      subject: 'Payment issue with your ATO Tax Optimizer order',
      html: getPaymentFailureEmailHTML(params),
      text: getPaymentFailureEmailText(params),
    })

    if (error) {
      console.error('Resend error:', error)
      return { success: false, error: error.message }
    }

    return { success: true, messageId: data?.id }
  } catch (error) {
    console.error('Failed to send payment failure email:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

function formatProductType(productType: string): string {
  const names: Record<string, string> = {
    individual: 'Individual Plan',
    business: 'Business Plan',
    accountant: 'Accountant Plan',
    additional_organization: 'Additional Organisation',
  }
  return names[productType] || productType
}

function getPurchaseConfirmationEmailHTML(params: SendPurchaseConfirmationEmailParams): string {
  const amountFormatted = `$${(params.amountPaid / 100).toFixed(2)} AUD`

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Purchase Confirmed</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f3f4f6;">
  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #f3f4f6;">
    <tr>
      <td style="padding: 40px 20px;">
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);">

          <!-- Header -->
          <tr>
            <td style="padding: 40px 40px 20px; text-align: center; background: linear-gradient(135deg, #10b981 0%, #059669 100%); border-radius: 8px 8px 0 0;">
              <h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: 600;">
                Purchase Confirmed
              </h1>
            </td>
          </tr>

          <!-- Content -->
          <tr>
            <td style="padding: 40px;">
              <div style="text-align: center; margin-bottom: 24px;">
                <span style="display: inline-block; font-size: 48px;">&#10003;</span>
              </div>

              <h2 style="margin: 0 0 16px; color: #111827; font-size: 20px; font-weight: 600; text-align: center;">
                Thank you for your purchase!
              </h2>

              <p style="margin: 0 0 24px; color: #4b5563; font-size: 16px; line-height: 1.5; text-align: center;">
                Your payment has been processed successfully. Here are the details:
              </p>

              <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="width: 100%; margin: 0 0 24px;">
                <tr>
                  <td style="padding: 20px; background-color: #f0fdf4; border-radius: 8px; border-left: 4px solid #10b981;">
                    <p style="margin: 0 0 8px; color: #374151; font-size: 15px;">
                      <strong>Product:</strong> ${formatProductType(params.productType)}
                    </p>
                    <p style="margin: 0; color: #374151; font-size: 15px;">
                      <strong>Amount Paid:</strong> ${amountFormatted}
                    </p>
                  </td>
                </tr>
              </table>

              <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="width: 100%; margin: 0 0 24px;">
                <tr>
                  <td style="text-align: center;">
                    <a href="${params.dashboardUrl}" style="display: inline-block; padding: 14px 32px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: #ffffff; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 16px;">
                      Go to Dashboard
                    </a>
                  </td>
                </tr>
              </table>

              <p style="margin: 0; color: #9ca3af; font-size: 13px; line-height: 1.5; text-align: center;">
                Your licence is now active. You can start using all features immediately.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 24px 40px; background-color: #f9fafb; border-top: 1px solid #e5e7eb; border-radius: 0 0 8px 8px; text-align: center;">
              <p style="margin: 0; color: #6b7280; font-size: 12px;">
                &copy; ${new Date().getFullYear()} ATO Tax Optimizer. All rights reserved.
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

function getPurchaseConfirmationEmailText(params: SendPurchaseConfirmationEmailParams): string {
  const amountFormatted = `$${(params.amountPaid / 100).toFixed(2)} AUD`

  return `
Thank you for your purchase!

Your payment has been processed successfully.

Product: ${formatProductType(params.productType)}
Amount Paid: ${amountFormatted}

Your licence is now active. Go to your dashboard to get started:
${params.dashboardUrl}

© ${new Date().getFullYear()} ATO Tax Optimizer
  `.trim()
}

function getPaymentFailureEmailHTML(params: SendPaymentFailureEmailParams): string {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Payment Issue</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f3f4f6;">
  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #f3f4f6;">
    <tr>
      <td style="padding: 40px 20px;">
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);">

          <!-- Header -->
          <tr>
            <td style="padding: 40px 40px 20px; text-align: center; background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%); border-radius: 8px 8px 0 0;">
              <h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: 600;">
                Payment Issue
              </h1>
            </td>
          </tr>

          <!-- Content -->
          <tr>
            <td style="padding: 40px;">
              <h2 style="margin: 0 0 16px; color: #111827; font-size: 20px; font-weight: 600;">
                We couldn't process your payment
              </h2>

              <p style="margin: 0 0 24px; color: #4b5563; font-size: 16px; line-height: 1.5;">
                Unfortunately, your recent payment for ATO Tax Optimizer was unsuccessful. This can happen if your card was declined or if there were insufficient funds.
              </p>

              <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="width: 100%; margin: 0 0 24px;">
                <tr>
                  <td style="padding: 16px; background-color: #fef3c7; border-radius: 6px; border-left: 4px solid #f59e0b;">
                    <p style="margin: 0 0 8px; color: #92400e; font-size: 14px; font-weight: 600;">
                      What you can do
                    </p>
                    <ul style="margin: 0; padding-left: 20px; color: #92400e; font-size: 13px; line-height: 1.8;">
                      <li>Check your card details and ensure funds are available</li>
                      <li>Try a different payment method</li>
                      <li>Contact your bank if the issue persists</li>
                    </ul>
                  </td>
                </tr>
              </table>

              <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="width: 100%; margin: 0 0 24px;">
                <tr>
                  <td style="text-align: center;">
                    <a href="${params.pricingUrl}" style="display: inline-block; padding: 14px 32px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: #ffffff; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 16px;">
                      Try Again
                    </a>
                  </td>
                </tr>
              </table>

              <p style="margin: 0; color: #9ca3af; font-size: 13px; line-height: 1.5; text-align: center;">
                If you need assistance, contact us at <a href="mailto:support@ato-optimizer.com" style="color: #667eea; text-decoration: underline;">support@ato-optimizer.com</a>
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 24px 40px; background-color: #f9fafb; border-top: 1px solid #e5e7eb; border-radius: 0 0 8px 8px; text-align: center;">
              <p style="margin: 0; color: #6b7280; font-size: 12px;">
                &copy; ${new Date().getFullYear()} ATO Tax Optimizer. All rights reserved.
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

function getPaymentFailureEmailText(params: SendPaymentFailureEmailParams): string {
  return `
Payment Issue - ATO Tax Optimizer

We couldn't process your payment.

Unfortunately, your recent payment for ATO Tax Optimizer was unsuccessful. This can happen if your card was declined or if there were insufficient funds.

What you can do:
- Check your card details and ensure funds are available
- Try a different payment method
- Contact your bank if the issue persists

Try again here: ${params.pricingUrl}

If you need assistance, contact us at support@ato-optimizer.com

© ${new Date().getFullYear()} ATO Tax Optimizer
  `.trim()
}

/**
 * Get pricing tier details
 */
function getPricingDetails(tier: string): { name: string; description: string } {
  const tiers: Record<string, { name: string; description: string }> = {
    standard: {
      name: 'Standard (15% wholesale discount)',
      description: 'Perfect for firms managing 1-20 clients with full access to AI-powered tax analysis.',
    },
    professional: {
      name: 'Professional (25% wholesale discount)',
      description: 'Ideal for growing firms managing 21-50 clients with priority support.',
    },
    enterprise: {
      name: 'Enterprise (35% wholesale discount)',
      description: 'Custom solutions for firms managing 50+ clients with dedicated account management.',
    },
  }
  return tiers[tier] || tiers.standard
}
