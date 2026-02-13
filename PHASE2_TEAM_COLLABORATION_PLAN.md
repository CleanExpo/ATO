# UNI-230 Phase 2: Team Collaboration

**Status**: 🚧 In Progress
**Estimated Duration**: 8-12 hours
**Start Date**: 2026-01-29

---

## 🎯 Objectives

Enable seamless collaboration for accounting teams managing multiple client organizations:

1. **Activity Feed** - Real-time stream of all organization actions
2. **Notification System** - Alert team members of important events
3. **Team Member Management** - UI for inviting, managing, and removing members
4. **Real-time Updates** - Live collaboration using Supabase Realtime
5. **Role-based Visibility** - Activity and notifications filtered by role permissions

---

## 🏗️ Architecture

### 1. Activity Feed System

**Database Table**: `organization_activity_log` (already exists)
```sql
- id: UUID (primary key)
- organization_id: UUID (foreign key)
- user_id: UUID (who performed the action)
- action: TEXT (action type)
- entity_type: TEXT (what was affected)
- entity_id: UUID (affected entity ID)
- metadata: JSONB (additional data)
- created_at: TIMESTAMPTZ
```

**Action Types**:
- `member_invited`, `member_joined`, `member_removed`, `member_role_changed`
- `platform_connected`, `platform_disconnected`, `platform_synced`
- `analysis_started`, `analysis_completed`
- `recommendation_created`, `recommendation_accepted`, `recommendation_rejected`
- `organization_created`, `organization_updated`, `organization_deleted`
- `invitation_sent`, `invitation_accepted`, `invitation_revoked`

**API Endpoints**:
- `GET /api/organizations/[id]/activity` - Fetch activity feed (paginated)
- `GET /api/activity/consolidated` - Consolidated feed across all user's organizations

### 2. Notification System

**Database Table**: `notifications` (new)
```sql
CREATE TABLE notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,

    -- Notification content
    type TEXT NOT NULL,
    title TEXT NOT NULL,
    message TEXT NOT NULL,

    -- Related entities
    related_entity_type TEXT,
    related_entity_id UUID,
    action_url TEXT,

    -- Status tracking
    read BOOLEAN DEFAULT FALSE,
    read_at TIMESTAMPTZ,

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_notifications_user_id ON notifications(user_id);
CREATE INDEX idx_notifications_organization_id ON notifications(organization_id);
CREATE INDEX idx_notifications_read ON notifications(read);
CREATE INDEX idx_notifications_created_at ON notifications(created_at DESC);
```

**Notification Types**:
- `invitation_received` - You've been invited to join an organization
- `member_joined` - New member joined your organization
- `analysis_complete` - Forensic analysis finished
- `recommendation_ready` - New tax opportunities identified
- `sync_failed` - Platform sync encountered errors
- `role_changed` - Your role in an organization changed

**API Endpoints**:
- `GET /api/notifications` - Fetch user's notifications (paginated)
- `POST /api/notifications/[id]/read` - Mark notification as read
- `POST /api/notifications/mark-all-read` - Mark all as read
- `DELETE /api/notifications/[id]` - Delete notification

### 3. Team Member Management UI

**Components**:
- `TeamMembersList` - Display all members with roles
- `InviteMemberDialog` - Send new invitations
- `MemberRoleEditor` - Change member roles (admins only)
- `RemoveMemberDialog` - Remove members with confirmation

**Features**:
- Search and filter members
- Bulk actions (invite multiple, remove multiple)
- Role badges with color coding
- Last active timestamp
- Pending invitation status

### 4. Real-time Updates

**Supabase Realtime Channels**:
```typescript
// Organization-specific channel
const channel = supabase
  .channel(`org:${organizationId}`)
  .on('postgres_changes', {
    event: 'INSERT',
    schema: 'public',
    table: 'organization_activity_log',
    filter: `organization_id=eq.${organizationId}`,
  }, handleNewActivity)
  .on('postgres_changes', {
    event: 'INSERT',
    schema: 'public',
    table: 'notifications',
    filter: `user_id=eq.${userId}`,
  }, handleNewNotification)
  .subscribe()
```

**Real-time Features**:
- Live activity feed updates
- Instant notification badges
- Member presence indicators
- Typing indicators (future)

---

## 📋 Implementation Plan

### Day 1: Database & Backend (4-5 hours)

**Task 1.1**: Create notification system migration
- Create `notifications` table
- Add RLS policies
- Create helper functions

**Task 1.2**: Build notification API endpoints
- GET, POST, DELETE routes
- Pagination support
- Unread count endpoint

**Task 1.3**: Enhance activity logging
- Create utility function for logging activities
- Update existing endpoints to log activities
- Add activity feed API endpoints

**Task 1.4**: Notification triggers
- Database trigger for important activities
- Background job for digest notifications (future)

### Day 2: Frontend UI (4-5 hours)

**Task 2.1**: Team Member Management Page
- `/dashboard/organization/members` page
- TeamMembersList component
- InviteMemberDialog component
- Role management UI

**Task 2.2**: Activity Feed Component
- ActivityFeed component
- Activity item cards
- Filtering and search
- Load more pagination

**Task 2.3**: Notification System UI
- NotificationBell component in header
- NotificationDropdown with unread badge
- Notification item cards
- Mark as read functionality

**Task 2.4**: Real-time Integration
- Supabase Realtime setup
- Live activity updates
- Live notification updates
- Optimistic UI updates

---

## 🎨 Design System

Following Scientific Luxury design patterns:

**Activity Feed**:
- OLED black background (#050505)
- Cyan accents for user actions (#00F5FF)
- Emerald for positive events (#00FF88)
- Amber for warnings (#FFB800)
- Red for errors (#FF4444)

**Notification Badge**:
- Pulsing animation for unread
- Gradient glow effect
- Number badge with max 99+

**Team Members**:
- Avatar with role badge overlay
- Status indicators (online/offline)
- Smooth hover interactions

---

## 🔐 Security Considerations

**Activity Logging**:
- Sanitize sensitive data in metadata
- Never log passwords, tokens, or secrets
- Limit metadata size (max 5KB per log entry)

**Notifications**:
- Users only receive notifications for their organizations
- RLS enforces user-specific notifications
- No sensitive data in notification messages

**Real-time**:
- Channel authentication via Supabase JWT
- Organization-scoped channels
- Rate limiting on subscriptions

---

## 📊 Success Criteria

Phase 2 complete when:
- [ ] Notifications table and RLS policies created
- [ ] Notification API endpoints functional
- [ ] Activity feed API returns filtered activities
- [ ] Team member management page displays all members
- [ ] Users can invite members from UI
- [ ] Users can change member roles (admins only)
- [ ] Notification bell shows unread count
- [ ] Notification dropdown displays recent notifications
- [ ] Activity feed updates in real-time
- [ ] Notifications appear instantly
- [ ] All features tested end-to-end

---

## 💡 Future Enhancements (Phase 3+)

- Email digest notifications (daily/weekly summaries)
- Slack/Teams integration for notifications
- @mention system in comments
- In-app chat between team members
- File sharing and collaborative document editing
- Mobile push notifications
- Advanced filtering and search
- Activity export (CSV, PDF)

---

**Created**: 2026-01-29 23:50 AEST
**Author**: Claude (Senior Systems Architect)
