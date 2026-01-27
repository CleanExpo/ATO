# SUMMARY 10-01: R&D Deadline Tracking & Registration Dashboard

## Status: COMPLETE

## Execution Details

**Plan**: R&D Deadline Tracking & Registration Dashboard
**Started**: 2026-01-27
**Completed**: 2026-01-27
**Total Tasks**: 5
**Build Status**: SUCCESS

---

## Tasks Completed

### Task 1: Database Schema
**Commit**: `182c7db`
**Files Created**:
- `lib/supabase/migrations/20260127_rnd_registration.sql` - Migration with tables, indexes, triggers, and views
- `lib/types/rnd-registration.ts` - TypeScript types, enums, configs, and helper functions

**Database Objects**:
- `rnd_registrations` table - Tracks registration status per tenant/FY with deadline, expenditure, AusIndustry reference
- `rnd_deadline_reminders` table - Tracks reminder scheduling at 90/60/30/7 day intervals
- `rnd_deadline_summary` view - Computed urgency levels with days until deadline
- Indexes on tenant_id, financial_year, status, deadline_date, scheduled_date
- Auto-update trigger for `updated_at` timestamp

**TypeScript Types**:
- `RndRegistrationStatus` - not_started, in_progress, submitted, approved, rejected
- `DeadlineUrgency` - completed, overdue, critical, urgent, approaching, open
- `RND_STATUS_CONFIG` - UI styling configuration for each status
- `URGENCY_CONFIG` - UI styling and priority for urgency levels
- Helper functions: `calculateDeadlineFromFY`, `calculateDaysUntilDeadline`, `calculateUrgencyLevel`, `formatDeadlineDate`, `formatDaysUntilDeadline`

---

### Task 2: API Endpoints
**Commit**: `82a4002`
**Files Created**:
- `app/api/rnd/registrations/route.ts` - GET/POST for listing and creating registrations
- `app/api/rnd/registrations/[id]/route.ts` - GET/PATCH/DELETE for single registration operations
- `app/api/rnd/deadlines/route.ts` - GET for upcoming deadlines with urgency levels

**Endpoints**:
| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/rnd/registrations` | GET | List all registrations for tenant with summary stats |
| `/api/rnd/registrations` | POST | Create/update registration (upsert by tenant+FY) |
| `/api/rnd/registrations/[id]` | GET | Get single registration with computed fields |
| `/api/rnd/registrations/[id]` | PATCH | Update registration status/details |
| `/api/rnd/registrations/[id]` | DELETE | Delete registration |
| `/api/rnd/deadlines` | GET | Get all deadlines including untracked FYs with R&D candidates |

**API Features**:
- Computed urgency levels returned with all responses
- Auto-set submission/approval dates on status transitions
- Summary statistics (by status, by urgency, totals)
- Includes untracked FYs that have R&D candidates but no registration record
- Sorted by urgency priority then deadline date

---

### Task 3: Dashboard Components
**Commit**: `774d80a`
**Files Created**:
- `components/rnd/RegistrationStatusCard.tsx` - FY registration card with deadline, urgency, action buttons
- `components/rnd/DeadlineTimeline.tsx` - Vertical timeline with expandable FY details
- `components/rnd/RegistrationWorkflow.tsx` - 5-step registration process guide
- `components/rnd/index.ts` - Barrel export file

**Component Features**:

**RegistrationStatusCard**:
- Displays FY, status badge, deadline countdown
- Urgency-coloured background and border
- Financial summary (eligible expenditure, estimated offset)
- AusIndustry reference display when submitted
- Start/Continue Registration and View Details buttons
- Overdue warning message

**DeadlineTimeline**:
- Vertical timeline with urgency-coloured dots
- Click to expand FY details
- Shows status, deadline, days remaining
- Financial summary in expanded view
- Status-specific guidance text

**RegistrationWorkflow**:
- 5 steps: Prepare, Portal, Register, Submit, Tax Return
- Progress bar showing current step
- Expandable steps with document checklists
- External links to AusIndustry portal and ATO guides
- Mark as Complete button for current step

---

### Task 4: R&D Dashboard Integration
**Commit**: `d32603f`
**Files Modified**:
- `app/dashboard/forensic-audit/rnd/page.tsx`

**Changes**:
- Added imports for new R&D components and types
- Added state for deadlines, loading, selected FY, and workflow visibility
- Added `loadDeadlines` function to fetch from API
- Added `handleStartRegistration` function to create/update registrations
- Added `handleUpdateStatus` function for workflow status changes
- Added Registration Status section with 3-column layout:
  - Left column: Deadline Timeline
  - Right columns: Registration cards or Workflow modal
- Added DeadlineAlertBanner at top of page
- Integrated start/continue registration flow with API

---

### Task 5: DeadlineAlertBanner
**Commit**: `16572f2`
**Files Created**:
- `components/rnd/DeadlineAlertBanner.tsx`

**Features**:
- Sticky banner for critical (7 days), urgent (30 days), and overdue deadlines
- Shows most urgent non-dismissed deadline
- Message text varies by urgency level
- "Take Action" button navigates to registration workflow
- Dismissible with X button (persists 24 hours in localStorage)
- Auto-expires dismissed alerts after 24 hours
- Progress bar showing time remaining (for non-overdue)
- Count of additional urgent deadlines

---

## Commit History

| Commit | Description |
|--------|-------------|
| `182c7db` | feat(10-01): database schema for R&D registration tracking |
| `82a4002` | feat(10-01): API endpoints for R&D registration management |
| `774d80a` | feat(10-01): dashboard components for R&D registration tracking |
| `d32603f` | feat(10-01): integrate registration status into R&D dashboard |
| `16572f2` | feat(10-01): deadline alert banner component |

---

## Files Created/Modified

### New Files (12)
```
lib/supabase/migrations/20260127_rnd_registration.sql
lib/types/rnd-registration.ts
app/api/rnd/registrations/route.ts
app/api/rnd/registrations/[id]/route.ts
app/api/rnd/deadlines/route.ts
components/rnd/RegistrationStatusCard.tsx
components/rnd/DeadlineTimeline.tsx
components/rnd/RegistrationWorkflow.tsx
components/rnd/DeadlineAlertBanner.tsx
components/rnd/index.ts
```

### Modified Files (1)
```
app/dashboard/forensic-audit/rnd/page.tsx
```

---

## Verification

- [x] `npm run build` succeeds without errors
- [x] All 5 tasks completed with individual commits
- [x] API endpoints created and return correct response shapes
- [x] Components follow Scientific Luxury design system
- [x] Dashboard shows deadline timeline and registration cards
- [x] Alert banner appears for urgent deadlines
- [x] Registration workflow displays 5-step process

---

## Usage

### View Registration Status
1. Navigate to `/dashboard/forensic-audit/rnd`
2. Registration Status section shows:
   - Deadline Timeline (left)
   - Registration cards for FYs needing action (right)

### Start Registration
1. Click "Start Registration" on any FY card
2. Registration workflow appears with 5 steps
3. Complete each step and click "Mark as Complete"
4. Progress saved via API to database

### API Usage
```typescript
// Get all registrations
GET /api/rnd/registrations?tenantId=xxx

// Create/update registration
POST /api/rnd/registrations
{ tenantId, financialYear, registrationStatus }

// Get deadlines with urgency
GET /api/rnd/deadlines?tenantId=xxx
```

---

## Notes

- Database migration must be run manually in Supabase
- Deadline calculation: 10 months after FY end (e.g., FY2024-25 deadline = 30 April 2026)
- Urgency levels: critical (<= 7 days), urgent (<= 30 days), approaching (<= 90 days)
- Alert banner dismissals persist 24 hours in localStorage
- Untracked FYs (with R&D candidates but no registration) are included in deadlines API

---

## Next Steps (Future Plans)

- 10-02: Email notifications for deadline reminders
- 10-03: AusIndustry portal integration (if API available)
