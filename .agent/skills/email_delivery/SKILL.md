---
name: email-delivery
description: Sends tax analysis reports, compliance alerts, and organisation invitations via SendGrid with template rendering and delivery tracking
---

# Email Delivery Skill

Delivers tax reports, compliance deadline alerts, and organisation invitations via the SendGrid API. Handles template rendering, attachment management, delivery status tracking, and bounce/complaint monitoring.

## When to Use

- Sending accountant reports (PDF/Excel attachments) via the send-to-accountant workflow
- Delivering compliance deadline alerts to entity contacts
- Sending organisation invitation emails to team members
- Notifying users of completed forensic analysis results
- Distributing shared report links
- Sending amendment period expiry warnings

## SendGrid Configuration

### Environment Variables

| Variable | Purpose | Required |
|----------|---------|----------|
| `SENDGRID_API_KEY` | API authentication (SG.xxx format) | Yes |
| `NEXT_PUBLIC_APP_URL` | Base URL for links in emails | Yes |

### API Endpoint

```
POST https://api.sendgrid.com/v3/mail/send
Authorization: Bearer $SENDGRID_API_KEY
Content-Type: application/json
```

### Sender Requirements

- Sender email must be verified in SendGrid account
- Use a `noreply@` or `reports@` address for automated emails
- Include reply-to address for accountant communications

## Email Templates

### 1. Accountant Report Delivery

| Field | Content |
|-------|---------|
| Subject | `Tax Analysis Report — {Entity Name} — {FY}` |
| From | `reports@{app-domain}` |
| To | Accountant email (from user input) |
| Body | Summary of key findings + link to full dashboard |
| Attachments | PDF report + Excel data export |
| Disclaimer | TASA 2009 disclaimer in email footer |

### 2. Compliance Alert

| Field | Content |
|-------|---------|
| Subject | `[{Severity}] Tax Deadline: {Obligation} — Due {Date}` |
| From | `alerts@{app-domain}` |
| To | Entity admin email |
| Body | Deadline details, penalty information, action required |
| CTA | "View in Dashboard" button linking to calendar page |

### 3. Organisation Invitation

| Field | Content |
|-------|---------|
| Subject | `You've been invited to {Organisation Name} on ATO Tax Optimizer` |
| From | `invites@{app-domain}` |
| To | Invitee email |
| Body | Invitation details, role description, accept/decline links |
| CTA | "Accept Invitation" button with signed token |
| Expiry | Invitation link expires after 7 days |

### 4. Analysis Complete Notification

| Field | Content |
|-------|---------|
| Subject | `Forensic Analysis Complete — {Entity Name}` |
| From | `notifications@{app-domain}` |
| To | User email |
| Body | Summary: X opportunities found, $X estimated value |
| CTA | "View Results" button linking to recommendations page |

## Attachment Handling

| Format | Max Size | MIME Type | Use |
|--------|----------|-----------|-----|
| PDF | 20MB | `application/pdf` | Tax analysis reports |
| Excel (.xlsx) | 20MB | `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet` | Transaction data exports |
| CSV | 10MB | `text/csv` | Raw data exports |

**SendGrid limits**: 30MB total per email (including encoding overhead).

### Attachment Security

- Never attach files containing raw Xero OAuth tokens
- Never include TFN or sensitive personal information in attachments
- PDF reports must include TASA 2009 disclaimer
- Excel exports must include "ESTIMATE ONLY" header row

## Delivery Tracking

| Event | Action |
|-------|--------|
| `delivered` | Log successful delivery |
| `bounce` | Flag email address, notify user |
| `dropped` | Investigate and notify user |
| `spam_report` | Remove from mailing list immediately |
| `open` | Track engagement (optional) |
| `click` | Track CTA engagement (optional) |

## Rate Limits

| SendGrid Plan | Daily Limit | Rate Limit |
|--------------|------------|------------|
| Free | 100/day | N/A |
| Essentials | 100K/month | N/A |
| Pro | 1.5M/month | N/A |

For this application, expected volume is low (< 50 emails/day). Free tier is sufficient for development.

## Output Format

```xml
<email_delivery_result>
  <message_id>sg_abc123def456</message_id>
  <template>accountant_report</template>
  <to>accountant@example.com</to>
  <subject>Tax Analysis Report — DR Pty Ltd — FY2024-25</subject>
  <status>accepted</status>
  <sent_at>2026-02-13T10:30:00+11:00</sent_at>
  <attachments>
    <attachment name="DR-Pty-Ltd-Tax-Analysis-FY2024-25.pdf" size_kb="245" />
    <attachment name="DR-Pty-Ltd-Transactions-FY2024-25.xlsx" size_kb="180" />
  </attachments>
  <includes_disclaimer>true</includes_disclaimer>
</email_delivery_result>
```

## Best Practices

- **Always include TASA 2009 disclaimer** in email body and attachments
- **Never send unsolicited emails** — only send to users who opted in or were explicitly invited
- **Handle bounces immediately** — remove bounced addresses to protect sender reputation
- **Use signed URLs** for dashboard links — prevents unauthorized access
- **Limit attachment size** — prefer dashboard links over large attachments
- **Log all sends** for audit trail (who, when, what, to whom)
- **Respect unsubscribe** — include unsubscribe link in all non-transactional emails
- **Test in sandbox first** — SendGrid sandbox mode prevents accidental sends
