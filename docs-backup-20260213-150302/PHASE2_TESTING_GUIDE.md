# Phase 2 Testing Guide

Quick guide to verify all Phase 2 Team Collaboration features are working correctly.

---

## Prerequisites

✅ Database setup complete (4 tables created)
✅ Environment variables configured
⏳ Supabase Realtime enabled (see below)

### Enable Supabase Realtime

**IMPORTANT**: You must enable Realtime for the collaboration features to work properly.

1. Go to **Supabase Dashboard** → **Database** → **Replication**
2. Find and enable replication for these tables:
   - ✅ `notifications`
   - ✅ `organization_activity_log`
3. Click **Save**

---

## Testing Checklist

### 1. Notification Bell (Header)

**Location**: Top right of dashboard header (next to Organization Switcher)

**Tests**:
- [ ] Bell icon visible in header
- [ ] Click bell → dropdown opens
- [ ] Close dropdown by clicking outside
- [ ] If no notifications: Shows "No notifications" message

**Manual Test - Create a Notification**:
```sql
-- Run in Supabase SQL Editor
SELECT create_notification(
  auth.uid(),                          -- Your user ID
  NULL,                                -- Organization ID (optional)
  'info',                              -- Type: info/success/warning/error
  'Welcome to Phase 2!',               -- Title
  'Team collaboration features are now live.'  -- Message
);
```

**Expected Result**:
- [ ] Notification appears instantly (no refresh needed)
- [ ] Badge shows "1" on bell icon
- [ ] Dropdown shows the new notification
- [ ] Click ✓ icon → marks as read
- [ ] Badge updates to "0"
- [ ] Click 🗑️ icon → deletes notification

---

### 2. Notification API Endpoints

**Test GET /api/notifications**:
```bash
# Fetch your notifications
curl http://localhost:3000/api/notifications?limit=10
```

**Expected Response**:
```json
{
  "notifications": [...],
  "total": 1,
  "unreadCount": 0,
  "limit": 10,
  "offset": 0
}
```

**Test POST /api/notifications** (Internal):
```bash
curl -X POST http://localhost:3000/api/notifications \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "YOUR_USER_ID",
    "organizationId": "YOUR_ORG_ID",
    "type": "success",
    "title": "Test Notification",
    "message": "This is a test"
  }'
```

---

### 3. Activity Feed

**Location**: Can be embedded in any dashboard page

**Component Usage**:
```tsx
import ActivityFeed from '@/components/collaboration/ActivityFeed';

// Organization-specific feed
<ActivityFeed organizationId={orgId} limit={20} />

// Consolidated feed (all orgs)
<ActivityFeed limit={20} />
```

**Manual Test - Create Activity**:
```sql
-- Run in Supabase SQL Editor
INSERT INTO organization_activity_log (
  organization_id,
  user_id,
  action,
  entity_type,
  metadata
) VALUES (
  'YOUR_ORG_ID',                       -- Replace with actual org ID
  auth.uid(),                          -- Your user ID
  'xero_connected',                    -- Action type
  'integration',                       -- Entity type
  '{"provider": "Xero"}'::jsonb        -- Metadata
);
```

**Expected Result**:
- [ ] Activity appears instantly (no refresh needed)
- [ ] Shows formatted message: "Your Name connected Xero"
- [ ] Shows relative timestamp (e.g., "Just now")
- [ ] Icon shows LinkIcon (for connection activities)

---

### 4. Activity Feed API

**Test GET /api/activity**:
```bash
# Consolidated feed
curl http://localhost:3000/api/activity?limit=10
```

**Test GET /api/organizations/[id]/activity**:
```bash
# Organization-specific feed
curl http://localhost:3000/api/organizations/YOUR_ORG_ID/activity?limit=10
```

**Expected Response**:
```json
{
  "activities": [
    {
      "id": "...",
      "organization_id": "...",
      "user_id": "...",
      "action": "xero_connected",
      "entity_type": "integration",
      "metadata": {...},
      "created_at": "2026-01-29T...",
      "user": {
        "email": "user@example.com",
        "full_name": "User Name"
      }
    }
  ],
  "total": 1,
  "limit": 10,
  "offset": 0,
  "hasMore": false
}
```

---

### 5. Team Management Page

**Location**: `/dashboard/team`

**Tests**:
- [ ] Navigate to `/dashboard/team`
- [ ] Page loads without errors
- [ ] Shows "Coming Soon" message (API not yet connected)
- [ ] Shows role legend with 4 roles
- [ ] "Invite Member" button visible

**Note**: Full team management features require additional API endpoints (Phase 3).

---

### 6. Real-Time Updates

**Test with Two Browser Tabs**:

1. Open dashboard in **Tab 1**
2. Open Supabase SQL Editor in **Tab 2**
3. In Tab 2, create a notification:
   ```sql
   SELECT create_notification(
     auth.uid(),
     NULL,
     'success',
     'Real-time Test',
     'This should appear instantly!'
   );
   ```
4. Switch to **Tab 1**
5. **Expected**: Notification appears instantly without refresh

**Test with Two User Accounts** (if available):

1. User A logs in → navigates to dashboard
2. User B logs in → creates activity in shared organization
3. **Expected**: User A sees activity appear instantly in ActivityFeed

---

## Common Issues & Solutions

### Issue: Bell icon not showing
**Solution**: Check that NotificationBell is imported in DynamicIsland component

### Issue: No notifications appear
**Possible Causes**:
- User is not authenticated
- Database RLS policies blocking access
- No notifications exist for this user

**Debug**:
```sql
-- Check if notifications exist
SELECT * FROM notifications WHERE user_id = auth.uid();

-- Check current user
SELECT auth.uid();
```

### Issue: Real-time updates not working
**Possible Causes**:
- Realtime not enabled in Supabase (most common)
- WebSocket connection blocked
- Browser console shows errors

**Debug**:
1. Check Supabase Dashboard → Database → Replication
2. Ensure `notifications` and `organization_activity_log` are enabled
3. Check browser console for WebSocket errors
4. Test with: `supabase.channel('test').subscribe()`

### Issue: "relation does not exist" errors
**Solution**: Run `RUN_THIS_IN_SUPABASE.sql` to create missing tables

### Issue: "permission denied" errors
**Solution**: Check RLS policies are correctly set up

---

## Performance Testing

### Notification Load Time
```bash
# Measure API response time
time curl http://localhost:3000/api/notifications?limit=10
```

**Target**: < 200ms

### Activity Feed Load Time
```bash
# Measure API response time
time curl http://localhost:3000/api/activity?limit=20
```

**Target**: < 300ms

### Real-Time Latency
1. Create notification in SQL Editor
2. Note the time
3. Check when it appears in UI
**Target**: < 1 second

---

## Database Verification Queries

### Check Tables Exist
```sql
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN (
    'organizations',
    'user_tenant_access',
    'profiles',
    'notifications',
    'organization_activity_log'
  )
ORDER BY table_name;
```

**Expected**: 5 rows

### Check RLS Policies
```sql
SELECT schemaname, tablename, policyname, permissive, cmd
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('notifications', 'organization_activity_log');
```

**Expected**: Multiple policies for SELECT, INSERT, UPDATE, DELETE

### Check Helper Functions
```sql
SELECT routine_name
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name IN (
    'get_user_organizations',
    'create_notification',
    'get_unread_notification_count',
    'mark_all_notifications_read'
  );
```

**Expected**: 4 functions

---

## Manual Test Script

Run this in Supabase SQL Editor to create test data:

```sql
-- 1. Create a test notification
SELECT create_notification(
  auth.uid(),
  NULL,
  'info',
  'Phase 2 Testing',
  'Verifying all collaboration features work correctly'
);

-- 2. Create a success notification
SELECT create_notification(
  auth.uid(),
  NULL,
  'success',
  'Database Setup Complete',
  'All tables and functions are working!'
);

-- 3. Create a warning notification
SELECT create_notification(
  auth.uid(),
  NULL,
  'warning',
  'Action Required',
  'Please review the team members list'
);

-- 4. Create test activity (requires organization ID)
INSERT INTO organization_activity_log (
  organization_id,
  user_id,
  action,
  metadata
) VALUES (
  (SELECT organization_id FROM user_tenant_access WHERE user_id = auth.uid() LIMIT 1),
  auth.uid(),
  'settings_updated',
  '{"setting": "notifications", "value": "enabled"}'::jsonb
);

-- 5. Verify data created
SELECT COUNT(*) as notification_count FROM notifications WHERE user_id = auth.uid();
SELECT COUNT(*) as activity_count FROM organization_activity_log WHERE user_id = auth.uid();
```

---

## Success Criteria

✅ **Phase 2 is working if**:
- [ ] Notification bell shows in header
- [ ] Clicking bell opens dropdown
- [ ] Creating notification via SQL makes it appear instantly
- [ ] Unread count updates correctly
- [ ] Activity feed displays activities
- [ ] Creating activity via SQL makes it appear instantly
- [ ] Team page loads without errors
- [ ] No console errors in browser

---

## Next Steps After Testing

Once testing is complete:

1. **Document any bugs** in GitHub Issues
2. **Create Phase 3 plan** (if additional features needed)
3. **Deploy to staging** for user acceptance testing
4. **Monitor performance** metrics
5. **Gather user feedback**

---

**Last Updated**: 2026-01-29
**Phase**: UNI-230 Phase 2 - Team Collaboration
**Status**: Ready for Testing
