/**
 * Send Organization Invitation Emails
 *
 * Uses Resend to send invitation emails to new organization members
 */

import { Resend } from 'resend'
import {
  getOrganizationInvitationSubject,
  getOrganizationInvitationHtml,
  getOrganizationInvitationText,
  type OrganizationInvitationData,
} from './templates/organization-invitation'
import { createLogger } from '@/lib/logger'

const log = createLogger('email:invitation')

// Lazy-initialize Resend client
let resendInstance: Resend | null = null;

function getResendInstance(): Resend {
  if (!resendInstance) {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      throw new Error('RESEND_API_KEY not configured. Email delivery unavailable.');
    }
    resendInstance = new Resend(apiKey);
  }
  return resendInstance;
}

const resend = new Proxy({} as Resend, {
  get(_target, prop) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Proxy pattern requires dynamic property access
    return (getResendInstance() as any)[prop];
  },
});

// Sender email (must be verified domain in Resend)
const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || 'noreply@ato.app'
const FROM_NAME = 'Australian Tax Optimizer'

export interface SendInvitationEmailParams {
  to: string // Invitee email address
  invitationData: OrganizationInvitationData
}

export interface SendInvitationEmailResult {
  success: boolean
  messageId?: string
  error?: string
}

/**
 * Send an organization invitation email
 *
 * @param params - Email parameters including recipient and invitation data
 * @returns Result with success status and message ID or error
 */
export async function sendOrganizationInvitationEmail(
  params: SendInvitationEmailParams
): Promise<SendInvitationEmailResult> {
  try {
    // Validate required environment variables
    if (!process.env.RESEND_API_KEY) {
      console.error('RESEND_API_KEY environment variable is not set')
      return {
        success: false,
        error: 'Email service not configured',
      }
    }

    // Validate email address
    if (!params.to || !isValidEmail(params.to)) {
      return {
        success: false,
        error: 'Invalid recipient email address',
      }
    }

    // Generate email content
    const subject = getOrganizationInvitationSubject(params.invitationData)
    const html = getOrganizationInvitationHtml(params.invitationData)
    const text = getOrganizationInvitationText(params.invitationData)

    // Send email via Resend
    const response = await resend.emails.send({
      from: `${FROM_NAME} <${FROM_EMAIL}>`,
      to: params.to,
      subject,
      html,
      text,
      tags: [
        {
          name: 'type',
          value: 'organization-invitation',
        },
        {
          name: 'organization',
          value: params.invitationData.organizationName,
        },
      ],
    })

    if (!response || !response.data) {
      return {
        success: false,
        error: 'Failed to send email via Resend',
      }
    }

    log.info('Organization invitation email sent', {
      messageId: response.data.id,
      to: params.to,
      organization: params.invitationData.organizationName,
    })

    return {
      success: true,
      messageId: response.data.id,
    }
  } catch (error) {
    console.error('Failed to send organization invitation email:', error)

    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    }
  }
}

/**
 * Validate email address format
 */
function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email)
}

/**
 * Send multiple invitation emails in batch
 *
 * @param invitations - Array of invitation email parameters
 * @returns Array of results for each email
 */
export async function sendBatchInvitationEmails(
  invitations: SendInvitationEmailParams[]
): Promise<SendInvitationEmailResult[]> {
  // Send emails in parallel (Resend supports batch operations)
  const results = await Promise.allSettled(
    invitations.map((invitation) => sendOrganizationInvitationEmail(invitation))
  )

  return results.map((result) => {
    if (result.status === 'fulfilled') {
      return result.value
    } else {
      return {
        success: false,
        error: result.reason instanceof Error ? result.reason.message : 'Failed to send email',
      }
    }
  })
}
