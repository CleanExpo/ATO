# Spec: Remove Mock Data, Use Real Xero + Government Sources

## Goal
Eliminate all mock/demo data from the UI and APIs. All displayed values must be sourced from:
- Xero connection data (transactions, reports, accounts).
- ATO or other official government resources (rates, thresholds, compliance rules).
If data is not available from an official source, the UI must show an explicit "No data available" state.

## Non-Goals
- No synthetic placeholders, seeded demo records, or hard-coded figures without official sources.
- No auto-filled example text for business-specific values (losses, loan compliance, R&D activities).

## Current Mock Data Inventory
- `app/dashboard/audit/page.tsx` uses `MOCK_FINDINGS`.
- `app/dashboard/losses/page.tsx` uses `MOCK_LOSSES` and `MOCK_LOANS`.
- `app/dashboard/rnd/page.tsx` uses `MOCK_ACTIVITIES`.
- `app/page.tsx` includes "View Demo" copy and static marketing numbers.

## Data Source Policy
1. Every numeric value displayed must include an origin:
   - Xero-derived: from Xero API or reports.
   - Government-derived: from ATO/official sources, stored with citation metadata.
2. No client-side fabrication. If an API does not return data, the UI must display an empty state.
3. Government values must be versioned with effective dates and source URLs.

## Scope
- Replace all mock arrays with live API calls.
- Add empty states for unsupported data.
- Add provenance metadata (source + timestamp) where shown.
- Remove or rename any UI copy implying demo data.

## Requirements by Area

### Dashboard (`app/dashboard/page.tsx`)
- Replace placeholder stats (`$--`, `--`) with:
  - Real counts from API endpoints (e.g., Xero transactions, audit findings).
  - "No data" state if the user has no Xero connection or analysis results.
- Remove "View Demo" copy from `app/page.tsx` or rename to "View Dashboard".

### Tax Audit (`app/dashboard/audit/page.tsx`)
- Replace `MOCK_FINDINGS` with API-driven data:
  - Derive findings from `/api/xero/transactions` (R&D candidates, missing tax types).
  - Any additional categories (misclassification, unclaimed deductions) must be backed by a data source or hidden.
- Add an empty state when no findings exist.

### R&D Assessment (`app/dashboard/rnd/page.tsx`)
- Remove `MOCK_ACTIVITIES`.
- Populate from Xero transactions analysis:
  - Use `/api/xero/transactions` to create R&D candidate list.
  - Only show activities that can be backed by Xero transaction evidence.
- For statutory rates (e.g., 43.5%), read from a government-sourced dataset.

### Loss & Loan Analysis (`app/dashboard/losses/page.tsx`)
- Remove `MOCK_LOSSES` and `MOCK_LOANS`.
- Use Xero reports (`/api/xero/reports`) for P&L-based loss calculations where valid.
- Division 7A loan compliance must be sourced from:
  - Xero loan accounts (if present) AND
  - ATO rules/rates from official sources.
- If required data is not available, display a clear "Not available from Xero" message.

### Government/ATO Data
- Create a data store for official values:
  - Example fields: `key`, `value`, `effective_from`, `effective_to`, `source_url`, `source_title`, `retrieved_at`.
- Only populate from official government sources.
- UI must reference the current effective value and cite the source.

## API Changes
- Add endpoints to:
  - Surface audit findings derived from Xero transactions.
  - Provide R&D candidates derived from Xero transactions.
  - Provide loss metrics derived from Xero reports (if feasible).
- Ensure all endpoints return empty arrays instead of defaults.

## UI Behavior
- No mock values in client state.
- Loading states must transition to either real data or explicit empty state.
- Any stat that cannot be computed must display "Not available" with an explanation.

## Security & Compliance
- All access remains read-only to Xero.
- Log the source and timestamp of every dataset used for display.
- Do not store derived data without attribution.

## Testing
- Unit tests: API handlers return empty arrays when no data exists.
- Integration tests: Xero-connected user sees real data.
- Regression check: ensure no `MOCK_` references remain in UI.

## Acceptance Criteria
- No mock/demo arrays or hard-coded example values are rendered.
- All data rendered is sourced from Xero or official government resources.
- Empty states appear where data is unavailable.
- UI copy does not claim or imply demo data.
