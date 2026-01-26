# Phase 8: Dashboard Enhancements

## Status: NOT STARTED

## Objective
Improve the user experience of the forensic audit dashboard with interactive features and real-time feedback.

## Requirements

### 1. Real-Time Analysis Progress
- WebSocket or polling-based progress updates
- Transaction count display during analysis
- Estimated time remaining
- Batch completion notifications

### 2. Interactive Transaction Explorer
- Filterable transaction table
- Sort by amount, date, category, confidence
- Search by supplier name or description
- Inline details expansion

### 3. Drill-Down Recommendations
- Click recommendation to see underlying transactions
- Legislative reference links (ATO website)
- Evidence display with supporting documents
- Confidence breakdown visualization

### 4. Direct Export
- Export to Excel (.xlsx) from UI
- Export to PDF with branding
- Selective export (choose sections)
- Email report directly to accountant

## Technical Approach
- Use React Server Components for initial data
- Client components for interactive filtering
- Tanstack Table for data grid
- React Query for data fetching
- WebSocket via Vercel for real-time updates

## Success Criteria
- [ ] Analysis progress visible in real-time
- [ ] Transactions filterable within 100ms response
- [ ] Export generates in <5 seconds
- [ ] Mobile-responsive design

## Dependencies
- Phase 7 completed (data available)
- Vercel deployment configured
- Supabase real-time enabled

## Estimated Effort
- UI components: 3-5 days
- Real-time infrastructure: 2-3 days
- Export functionality: 2 days
- Testing and polish: 2 days
