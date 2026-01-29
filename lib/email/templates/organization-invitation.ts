/**
 * Organization Invitation Email Template
 *
 * Sent when a user is invited to join an organization
 */

import { OrganizationRole } from '@/lib/types/multi-tenant'

export interface OrganizationInvitationData {
  inviteeName: string
  inviterName: string
  organizationName: string
  role: OrganizationRole
  invitationUrl: string
  expiresAt: Date
}

export function getOrganizationInvitationSubject(data: OrganizationInvitationData): string {
  return `${data.inviterName} invited you to join ${data.organizationName} on Australian Tax Optimizer`
}

export function getOrganizationInvitationHtml(data: OrganizationInvitationData): string {
  const roleDescriptions: Record<OrganizationRole, string> = {
    owner: 'full administrative access and control',
    admin: 'manage settings and team members',
    accountant: 'view and analyze tax data',
    read_only: 'read-only access to view data',
  }

  const roleDescription = roleDescriptions[data.role]
  const expiryDate = data.expiresAt.toLocaleDateString('en-AU', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Organization Invitation</title>
  <style>
    body {
      margin: 0;
      padding: 0;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      background-color: #050505;
      color: #ffffff;
    }
    .container {
      max-width: 600px;
      margin: 0 auto;
      padding: 40px 20px;
    }
    .header {
      text-align: center;
      margin-bottom: 40px;
    }
    .logo {
      font-size: 32px;
      font-weight: 700;
      color: #00F5FF;
      letter-spacing: 2px;
    }
    .tagline {
      font-size: 12px;
      color: rgba(255, 255, 255, 0.4);
      text-transform: uppercase;
      letter-spacing: 3px;
      margin-top: 8px;
    }
    .card {
      background: linear-gradient(135deg, rgba(0, 245, 255, 0.05) 0%, rgba(0, 0, 0, 0.8) 100%);
      border: 1px solid rgba(0, 245, 255, 0.2);
      border-radius: 8px;
      padding: 32px;
      margin-bottom: 24px;
    }
    .title {
      font-size: 24px;
      font-weight: 600;
      margin: 0 0 16px 0;
      color: #00F5FF;
    }
    .text {
      font-size: 16px;
      line-height: 1.6;
      color: rgba(255, 255, 255, 0.8);
      margin: 0 0 16px 0;
    }
    .highlight {
      color: #00F5FF;
      font-weight: 600;
    }
    .role-badge {
      display: inline-block;
      padding: 6px 12px;
      background: rgba(0, 245, 255, 0.1);
      border: 1px solid rgba(0, 245, 255, 0.3);
      border-radius: 4px;
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 1px;
      color: #00F5FF;
      margin: 8px 0;
    }
    .cta-button {
      display: inline-block;
      padding: 16px 32px;
      background: linear-gradient(135deg, #00F5FF 0%, #00B8D4 100%);
      color: #000000;
      text-decoration: none;
      border-radius: 6px;
      font-weight: 600;
      font-size: 16px;
      margin: 24px 0;
      transition: transform 0.2s;
    }
    .cta-button:hover {
      transform: translateY(-2px);
    }
    .info-box {
      background: rgba(255, 255, 255, 0.02);
      border: 1px solid rgba(255, 255, 255, 0.06);
      border-radius: 6px;
      padding: 16px;
      margin: 16px 0;
    }
    .info-label {
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 1px;
      color: rgba(255, 255, 255, 0.4);
      margin-bottom: 4px;
    }
    .info-value {
      font-size: 14px;
      color: rgba(255, 255, 255, 0.8);
    }
    .footer {
      text-align: center;
      padding-top: 32px;
      border-top: 1px solid rgba(255, 255, 255, 0.06);
      font-size: 12px;
      color: rgba(255, 255, 255, 0.4);
      line-height: 1.6;
    }
    .footer a {
      color: #00F5FF;
      text-decoration: none;
    }
    .divider {
      height: 1px;
      background: linear-gradient(90deg, transparent 0%, rgba(0, 245, 255, 0.2) 50%, transparent 100%);
      margin: 24px 0;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="logo">ATO</div>
      <div class="tagline">Australian Tax Optimizer</div>
    </div>

    <div class="card">
      <h1 class="title">You've Been Invited</h1>

      <p class="text">
        <span class="highlight">${data.inviterName}</span> has invited you to join their organization on the Australian Tax Optimizer platform.
      </p>

      <div class="divider"></div>

      <div class="info-box">
        <div class="info-label">Organization</div>
        <div class="info-value highlight">${data.organizationName}</div>
      </div>

      <div class="info-box">
        <div class="info-label">Your Role</div>
        <div class="info-value">
          <span class="role-badge">${data.role}</span>
          <br />
          <span style="font-size: 13px; color: rgba(255, 255, 255, 0.6);">
            You'll have ${roleDescription}
          </span>
        </div>
      </div>

      <div style="text-align: center;">
        <a href="${data.invitationUrl}" class="cta-button">
          Accept Invitation →
        </a>
      </div>

      <p class="text" style="font-size: 14px; margin-top: 24px;">
        This invitation expires on <span class="highlight">${expiryDate}</span>.
        After that, you'll need to request a new invitation.
      </p>
    </div>

    <div class="card" style="background: rgba(255, 184, 0, 0.05); border-color: rgba(255, 184, 0, 0.2);">
      <p class="text" style="font-size: 14px; margin-bottom: 8px;">
        <strong>What is the Australian Tax Optimizer?</strong>
      </p>
      <p class="text" style="font-size: 13px; color: rgba(255, 255, 255, 0.6); margin-bottom: 0;">
        A forensic tax analysis platform that identifies R&D tax offsets, unclaimed deductions,
        and compliance risks across Xero, QuickBooks, and MYOB. Used by accountants to recover
        $200K-$500K+ per client.
      </p>
    </div>

    <div class="footer">
      <p>
        If you didn't expect this invitation, you can safely ignore this email.
      </p>
      <p style="margin-top: 16px;">
        <a href="https://ato.app">Australian Tax Optimizer</a> ·
        Enterprise Tax Recovery Platform
      </p>
      <p style="margin-top: 8px; font-size: 11px;">
        © ${new Date().getFullYear()} Australian Tax Optimizer. All rights reserved.
      </p>
    </div>
  </div>
</body>
</html>
  `.trim()
}

export function getOrganizationInvitationText(data: OrganizationInvitationData): string {
  const roleDescriptions: Record<OrganizationRole, string> = {
    owner: 'full administrative access and control',
    admin: 'manage settings and team members',
    accountant: 'view and analyze tax data',
    read_only: 'read-only access to view data',
  }

  const roleDescription = roleDescriptions[data.role]
  const expiryDate = data.expiresAt.toLocaleDateString('en-AU', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })

  return `
You've Been Invited to Join ${data.organizationName}

${data.inviterName} has invited you to join their organization on the Australian Tax Optimizer platform.

Organization: ${data.organizationName}
Your Role: ${data.role.toUpperCase()}
Access Level: You'll have ${roleDescription}

Accept your invitation here:
${data.invitationUrl}

This invitation expires on ${expiryDate}. After that, you'll need to request a new invitation.

---

What is the Australian Tax Optimizer?

A forensic tax analysis platform that identifies R&D tax offsets, unclaimed deductions, and compliance risks across Xero, QuickBooks, and MYOB. Used by accountants to recover $200K-$500K+ per client.

---

If you didn't expect this invitation, you can safely ignore this email.

Australian Tax Optimizer
Enterprise Tax Recovery Platform
https://ato.app

© ${new Date().getFullYear()} Australian Tax Optimizer. All rights reserved.
  `.trim()
}
