/**
 * Send Organization Invitation Emails
 *
 * Uses SendGrid to send invitation emails to new organization members
 */

import sgMail from '@sendgrid/mail'
import {
  getOrganizationInvitationSubject,
  getOrganizationInvitationHtml,
  getOrganizationInvitationText,
  type OrganizationInvitationData,
} from './templates/organization-invitation'
import { createLogger } from '@/lib/logger'
import { optionalConfig } from '@/lib/config/env'

const log = createLogger('email:invitation')

// Initialize SendGrid
let _sgInitialized = false;

function ensureSendGridInit(): void {
  if (!_sgInitialized) {
    const apiKey = optionalConfig.sendgridApiKey;
    if (!apiKey) {
      throw new Error('SENDGRID_API_KEY not configured. Email delivery unavailable.');
    }
    sgMail.setApiKey(apiKey);
    _sgInitialized = true;
  }
}

// Sender (must be verified in SendGrid)
const FROM_EMAIL = 'ATO Tax Optimizer <support@carsi.com.au>'
const REPLY_TO = 'phill.m@carsi.com.au'

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
    if (!optionalConfig.sendgridApiKey) {
      console.error('SENDGRID_API_KEY environment variable is not set')
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

    ensureSendGridInit()

    // Generate email content
    const subject = getOrganizationInvitationSubject(params.invitationData)
    const html = getOrganizationInvitationHtml(params.invitationData)
    const text = getOrganizationInvitationText(params.invitationData)

    // Send email via SendGrid
    const [response] = await sgMail.send({
      from: FROM_EMAIL,
      to: params.to,
      replyTo: REPLY_TO,
      subject,
      html,
      text,
      categories: ['organization-invitation'],
    })

    const messageId = response.headers['x-message-id'] || ''

    log.info('Organization invitation email sent', {
      messageId,
      to: params.to,
      organization: params.invitationData.organizationName,
    })

    return {
      success: true,
      messageId,
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
  // Send emails in parallel
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
