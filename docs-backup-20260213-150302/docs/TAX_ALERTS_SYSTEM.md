# Tax Alerts System Documentation

## Overview

The Tax Alerts System provides automated notifications for tax deadlines, opportunities, compliance issues, and legislative changes. The system monitors analysis results and scheduled deadlines to keep users informed about critical tax matters.

## Architecture

### Components

1. **Alert Generation Engine** (`lib/alerts/alert-generator.ts`)
   - Triggered after AI analysis completes
   - Analyzes transactions for tax opportunities and issues
   - Generates alerts based on alert definitions

2. **Scheduled Checker** (`lib/alerts/scheduled-checker.ts`)
   - Runs daily via Vercel Cron
   - Checks for deadline-based alerts (BAS, tax return, FBT)
   - Cleans up old dismissed/actioned alerts

3. **Email Notifier** (`lib/alerts/email-notifier.ts`)
   - Sends HTML email notifications via Resend
   - Processes pending email queue
   - Tracks email delivery status

4. **API Endpoints**
   - `GET /api/alerts` - Fetch alerts with filters
   - `PATCH /api/alerts/[id]` - Update alert status
   - `DELETE /api/alerts/[id]` - Delete alerts
   - `GET/POST /api/alerts/preferences` - Manage preferences
   - `POST /api/alerts/cron` - Cron job endpoint

5. **UI Components**
   - `AlertNotificationBell` - Notification icon with unread count
   - `AlertCard` - Individual alert display with actions
   - `AlertsList` - Filterable list of alerts
   - `/dashboard/alerts` - Main alerts page
   - `/dashboard/alerts/preferences` - Preferences page

### Database Schema

#### `tax_alert_definitions`
Master list of alert types and configurations.

```sql
CREATE TABLE tax_alert_definitions (
  id UUID PRIMARY KEY,
  alert_type TEXT NOT NULL CHECK (alert_type IN (
    'rnd_registration_deadline',
    'rnd_claim_deadline',
    'tax_loss_expiring',
    'div7a_loan_unpaid',
    'div7a_minimum_repayment',
    'deduction_opportunity',
    'instant_writeoff_threshold',
    'bas_lodgment_due',
    'tax_return_due',
    'fbt_return_due',
    'legislative_change',
    'rate_change',
    'compliance_warning'
  )),
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  severity TEXT NOT NULL CHECK (severity IN ('info', 'warning', 'critical')),
  category TEXT NOT NULL CHECK (category IN ('deadline', 'opportunity', 'compliance', 'legislative', 'financial')),
  advance_notice_days INTEGER,
  legislation_reference TEXT,
  is_active BOOLEAN DEFAULT true
);
```

#### `tax_alerts`
User-specific alert instances.

```sql
CREATE TABLE tax_alerts (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES auth.users(id),
  alert_definition_id UUID REFERENCES tax_alert_definitions(id),
  alert_type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  severity TEXT NOT NULL,
  category TEXT NOT NULL,
  financial_year TEXT,
  platform TEXT,
  related_transaction_ids TEXT[],
  triggered_at TIMESTAMPTZ DEFAULT NOW(),
  due_date TIMESTAMPTZ,
  status TEXT DEFAULT 'unread' CHECK (status IN ('unread', 'read', 'acknowledged', 'dismissed', 'actioned')),
  action_url TEXT,
  email_sent BOOLEAN DEFAULT false,
  metadata JSONB
);
```

#### `tax_alert_preferences`
User notification preferences.

```sql
CREATE TABLE tax_alert_preferences (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL UNIQUE REFERENCES auth.users(id),
  alerts_enabled BOOLEAN DEFAULT true,
  email_notifications BOOLEAN DEFAULT true,
  in_app_notifications BOOLEAN DEFAULT true,
  rnd_alerts BOOLEAN DEFAULT true,
  deadline_alerts BOOLEAN DEFAULT true,
  opportunity_alerts BOOLEAN DEFAULT true,
  compliance_alerts BOOLEAN DEFAULT true,
  legislative_alerts BOOLEAN DEFAULT true,
  advance_notice_days INTEGER DEFAULT 30,
  digest_frequency TEXT DEFAULT 'daily' CHECK (digest_frequency IN ('realtime', 'daily', 'weekly')),
  notification_email TEXT
);
```

#### `tax_alert_history`
Audit log of alert events.

```sql
CREATE TABLE tax_alert_history (
  id UUID PRIMARY KEY,
  alert_id UUID NOT NULL REFERENCES tax_alerts(id),
  tenant_id UUID NOT NULL REFERENCES auth.users(id),
  event_type TEXT NOT NULL CHECK (event_type IN ('created', 'read', 'acknowledged', 'dismissed', 'actioned', 'email_sent', 'email_opened', 'link_clicked')),
  user_agent TEXT,
  ip_address TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

## Alert Types

### Analysis-Triggered Alerts

Generated automatically after AI analysis completes:

1. **R&D Registration Deadline** (`rnd_registration_deadline`)
   - Triggered when R&D candidates found
   - Deadline: 10 months after FY end
   - Severity: Critical
   - Advance notice: 60 days

2. **R&D Claim Deadline** (`rnd_claim_deadline`)
   - Triggered when R&D candidates found
   - Deadline: 15 months after FY end (with tax return)
   - Severity: Critical
   - Advance notice: 30 days

3. **Division 7A Loan** (`div7a_loan_unpaid`)
   - Triggered when large payments to directors/shareholders detected
   - Deadline: FY end
   - Severity: Warning
   - Advance notice: 60 days

4. **Deduction Opportunity** (`deduction_opportunity`)
   - Triggered when AI identifies unclaimed deductions > $5,000
   - Severity: Info
   - No deadline

5. **Instant Asset Write-Off** (`instant_writeoff_threshold`)
   - Triggered when assets < $20,000 found
   - Deadline: FY end
   - Severity: Info
   - Advance notice: 60 days

6. **Compliance Warning** (`compliance_warning`)
   - Triggered when transactions flagged with compliance issues
   - Severity: Warning
   - No deadline

### Schedule-Triggered Alerts

Generated by scheduled cron job:

1. **BAS Lodgment Due** (`bas_lodgment_due`)
   - Checked daily
   - Deadlines: Oct 28, Feb 28, May 28, Aug 28 (quarterly)
   - Severity: Critical if < 7 days, Warning otherwise
   - Advance notice: 14 days

2. **Tax Return Lodgment Due** (`tax_return_due`)
   - Checked daily
   - Deadline: May 15 (with tax agent)
   - Severity: Critical if < 14 days, Warning otherwise
   - Advance notice: 30 days

3. **FBT Return Lodgment Due** (`fbt_return_due`)
   - Checked daily
   - Deadline: May 21
   - Severity: Warning
   - Advance notice: 30 days

## Alert Generation Flow

### 1. Analysis-Triggered Generation

```
AI Analysis Completes
  ↓
batch-processor.ts calls triggerAlertGeneration()
  ↓
alert-generator.ts analyzes results
  ↓
Checks each alert type:
  - checkRnDOpportunities()
  - checkDeductionOpportunities()
  - checkDivision7ALoans()
  - checkInstantWriteoffOpportunities()
  - checkComplianceIssues()
  ↓
storeGeneratedAlerts() saves to database
  ↓
Alert history logged
```

### 2. Schedule-Triggered Generation

```
Vercel Cron (8:00 AM AEST daily)
  ↓
POST /api/alerts/cron
  ↓
runScheduledAlertChecks()
  ↓
Checks deadline types:
  - checkBASDeadlines()
  - checkTaxReturnDeadlines()
  - checkFBTDeadlines()
  ↓
Creates alerts for users with deadline_alerts enabled
  ↓
Alert history logged
```

### 3. Email Notification Flow

```
Vercel Cron (8:00 AM AEST daily)
  ↓
POST /api/alerts/cron
  ↓
sendPendingAlertEmails()
  ↓
Fetches users with email_notifications enabled
  ↓
Gets unread alerts with email_sent=false
  ↓
For each alert:
  - sendAlertEmail() via Resend
  - Update email_sent=true
  - Log in alert_history
```

## Email Templates

HTML email notifications include:

- **Header**: Gradient banner with urgency level
- **Alert Badge**: Category and severity
- **Title**: Alert title
- **Message**: Detailed explanation
- **Due Date**: Countdown with urgency styling
- **Metadata**: Key figures (potential benefit, transaction count, etc.)
- **Action Button**: Link to relevant dashboard page
- **Footer**: Unsubscribe and preferences links

### Severity Styling

- **Info**: Blue (ℹ️) - For Your Information
- **Warning**: Orange (⚠️) - Action Recommended
- **Critical**: Red (🚨) - Urgent Action Required

## Alert Status Lifecycle

```
unread → read → acknowledged → actioned
   ↓              ↓
dismissed      dismissed
```

- **unread**: Alert created, not viewed
- **read**: User viewed alert
- **acknowledged**: User acknowledged awareness
- **dismissed**: User dismissed as not relevant
- **actioned**: User clicked action button

## User Preferences

Users can configure:

### Global Settings
- **Enable/disable all alerts**: Master toggle
- **Email notifications**: Receive via email
- **In-app notifications**: Show in dashboard
- **Notification email**: Custom email address

### Alert Type Preferences
- **R&D alerts**: R&D opportunities and deadlines
- **Deadline alerts**: BAS, tax return, FBT deadlines
- **Opportunity alerts**: Deductions, write-offs
- **Compliance alerts**: Division 7A, loss expiry
- **Legislative alerts**: Law changes, rate updates

### Timing Preferences
- **Advance notice days**: 7, 14, 30, 60, or 90 days
- **Email digest frequency**: Realtime, daily, or weekly

## Cron Configuration

### Vercel Cron

In `vercel.json`:

```json
{
  "crons": [
    {
      "path": "/api/alerts/cron",
      "schedule": "0 8 * * *"
    }
  ]
}
```

Schedule: Daily at 8:00 AM AEST (cron: `0 8 * * *`)

### Authentication

Cron endpoint requires `CRON_SECRET` environment variable:

```bash
curl -X POST https://ato.app/api/alerts/cron \
  -H "Authorization: Bearer $CRON_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"jobType": "all"}'
```

### Job Types

- `all` (default): Run all jobs (checks + emails)
- `checks`: Only run deadline checks
- `emails`: Only send pending emails
- `cleanup`: Clean up old dismissed/actioned alerts

## API Usage

### Fetch Alerts

```typescript
// Get all unread alerts
const response = await fetch('/api/alerts?status=unread')
const data = await response.json()
console.log(data.alerts, data.unreadCount)

// Get critical alerts for specific FY
const response = await fetch('/api/alerts?severity=critical&financialYear=2024')
const data = await response.json()
```

### Update Alert Status

```typescript
// Mark as read
await fetch(`/api/alerts/${alertId}`, {
  method: 'PATCH',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ status: 'read' })
})

// Mark as actioned
await fetch(`/api/alerts/${alertId}`, {
  method: 'PATCH',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ status: 'actioned' })
})
```

### Update Preferences

```typescript
await fetch('/api/alerts/preferences', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    email_notifications: true,
    advance_notice_days: 60,
    digest_frequency: 'daily'
  })
})
```

## Integration with Existing Systems

### Batch Processor Integration

In `lib/ai/batch-processor.ts`:

```typescript
import { triggerAlertGeneration } from '@/lib/alerts/alert-generator'

// After analysis completes
const financialYear = businessContext.financialYear || new Date().getFullYear().toString()
const alertCount = await triggerAlertGeneration(tenantId, financialYear, platform)
console.log(`✅ Generated ${alertCount} tax alerts`)
```

### Navigation Integration

Add notification bell to main navigation:

```tsx
import AlertNotificationBell from '@/components/alerts/AlertNotificationBell'

<AlertNotificationBell
  tenantId={user.id}
  onClick={() => router.push('/dashboard/alerts')}
/>
```

## Environment Variables

Required environment variables:

```bash
# Resend API Key for email notifications
RESEND_API_KEY=re_...

# Cron job authentication
CRON_SECRET=your-random-secret-string

# Application URL for email links
NEXT_PUBLIC_APP_URL=https://ato.app
```

## Testing

### Test Alert Generation

```typescript
// Trigger alert generation manually
import { triggerAlertGeneration } from '@/lib/alerts/alert-generator'

const alertCount = await triggerAlertGeneration(
  'tenant-uuid',
  '2024',
  'xero'
)
console.log(`Generated ${alertCount} alerts`)
```

### Test Email Sending

```typescript
// Send test email
import { sendAlertEmail } from '@/lib/alerts/email-notifier'

const result = await sendAlertEmail(
  {
    id: 'test-alert-id',
    tenant_id: 'tenant-uuid',
    alert_type: 'rnd_claim_deadline',
    title: 'Test R&D Claim Alert',
    message: 'This is a test alert',
    severity: 'critical',
    category: 'deadline',
    due_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
  },
  'test@example.com'
)

console.log(result)
```

### Test Scheduled Checks

```bash
# Trigger cron manually
curl -X POST http://localhost:3000/api/alerts/cron \
  -H "Authorization: Bearer your-cron-secret" \
  -H "Content-Type: application/json" \
  -d '{"jobType": "checks"}'
```

## Performance Considerations

### Database Indexes

Optimized for common queries:

```sql
CREATE INDEX idx_tax_alerts_tenant_status ON tax_alerts(tenant_id, status);
CREATE INDEX idx_tax_alerts_tenant_unread ON tax_alerts(tenant_id, status) WHERE status = 'unread';
CREATE INDEX idx_tax_alerts_due_date ON tax_alerts(due_date);
CREATE INDEX idx_tax_alerts_triggered_at ON tax_alerts(triggered_at DESC);
```

### Rate Limiting

- Email notifications: 100ms delay between emails
- Resend API: Respects rate limits automatically

### Alert Deduplication

Alerts are deduplicated by:
- `(alert_type, financial_year, tenant_id)`

Prevents duplicate alerts for the same opportunity/deadline.

### Cleanup

Old alerts are automatically deleted:
- Dismissed alerts: 30 days
- Actioned alerts: 90 days

Run weekly via cron: `{"jobType": "cleanup"}`

## Security

### Row Level Security (RLS)

All tables have RLS enabled:

```sql
-- Users can only access their own alerts
CREATE POLICY "Users can access own alerts"
  ON tax_alerts FOR ALL
  USING (auth.uid() = tenant_id);

-- Users can only access their own preferences
CREATE POLICY "Users can access own preferences"
  ON tax_alert_preferences FOR ALL
  USING (auth.uid() = tenant_id);
```

### Cron Authentication

Cron endpoint requires Bearer token:

```typescript
const authHeader = request.headers.get('authorization')
if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
}
```

### Email Content Security

- Sanitizes all user-provided content
- Uses HTML templates with parameterized values
- No script injection possible

## Monitoring

### Alert History

All alert events are logged in `tax_alert_history`:

```sql
SELECT
  event_type,
  COUNT(*) as count
FROM tax_alert_history
WHERE created_at > NOW() - INTERVAL '7 days'
GROUP BY event_type
ORDER BY count DESC;
```

### Email Delivery

Track email delivery success:

```sql
SELECT
  email_sent,
  COUNT(*) as count
FROM tax_alerts
WHERE triggered_at > NOW() - INTERVAL '7 days'
GROUP BY email_sent;
```

### Alert Response Rate

Track user engagement:

```sql
SELECT
  status,
  COUNT(*) as count,
  AVG(EXTRACT(EPOCH FROM (acknowledged_at - triggered_at))) / 3600 as avg_hours_to_acknowledge
FROM tax_alerts
WHERE triggered_at > NOW() - INTERVAL '30 days'
GROUP BY status;
```

## Future Enhancements

### Phase 2 (Optional)

1. **SMS Notifications**
   - Integration with Twilio
   - SMS preferences per alert type

2. **Slack/Teams Integration**
   - Webhook notifications to Slack channels
   - Microsoft Teams adaptive cards

3. **Alert Analytics Dashboard**
   - Alert effectiveness metrics
   - User engagement tracking
   - ROI measurement

4. **Smart Alert Timing**
   - Machine learning for optimal send times
   - User activity pattern analysis

5. **Alert Snoozing**
   - Snooze alerts for 1 day, 1 week, 1 month
   - Automatic reminder when snooze expires

6. **Alert Delegation**
   - Forward alerts to accountant/tax agent
   - Team alert management

## Troubleshooting

### Alerts Not Triggering

1. Check alert preferences are enabled
2. Verify analysis completed successfully
3. Check alert definition is active
4. Review advance notice period configuration

### Emails Not Sending

1. Verify `RESEND_API_KEY` is set
2. Check email notifications enabled in preferences
3. Review Resend dashboard for delivery errors
4. Verify `notification_email` is valid

### Cron Not Running

1. Verify `CRON_SECRET` is set
2. Check Vercel cron configuration in dashboard
3. Review cron execution logs in Vercel
4. Test endpoint manually with curl

## Support

For issues or questions:
- Check logs in Vercel dashboard
- Review Supabase database for alert records
- Test API endpoints manually with curl
- Contact development team

---

**Last Updated**: 2026-01-28
**Version**: 1.0.0
