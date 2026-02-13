# Task #2 - Frontend Tax UI Implementation Plan

## Author: Frontend_Dev (Senior Frontend Engineer)
## Date: 2026-02-07
## Status: DRAFT - Awaiting Approval

---

## 1. Executive Summary

Build a professional tax UI with Tax-Time dark mode, interactive tax bracket visualisations, projected offset dashboard, tax compliance calendar, and full WCAG 2.1 AA accessibility -- all integrated into the existing OLED "Scientific Luxury" design system.

No new npm packages required. All built with existing dependencies: recharts, framer-motion, lucide-react, date-fns.

---

## 2. Existing Design System Analysis

After reading all existing UI components and globals.css, the established patterns are:

| Pattern | Implementation |
|---------|---------------|
| **Theme** | CSS custom properties on `:root` in globals.css |
| **Colours** | OLED Black base (#050505), spectral accents (Cyan, Emerald, Amber, Red) |
| **Components** | HoloPanel, MetricBlock, DataStrip -- all use CSS vars |
| **Layout** | Bento grids, asymmetric layouts, VerticalNav sidebar |
| **Typography** | Geist (sans), JetBrains Mono (data), CSS classes (.typo-headline, .typo-data-lg) |
| **Motion** | Framer Motion with cubic-bezier [0.23, 1, 0.32, 1] |
| **Responsive** | Mobile-first, sidebar hidden <768px, MobileNav bottom bar |
| **Charts** | recharts v3.6.0 already installed (used in LiveChart) |

---

## 3. Tax-Time Dark Mode Theme System

### 3.1 Approach

The existing design system is already dark (OLED Black). "Tax-Time" mode will be a second dark variant tuned for long tax-season sessions -- warmer tones, reduced glare, tuned compliance colours.

### 3.2 Implementation

**File: `app/globals.css`** -- Add `[data-theme="tax-time"]` selector:
- Background: #0B0B0F (warmer dark with slight blue tint)
- Text primary: rgba(255, 255, 255, 0.87) (reduced from 0.92)
- Card backgrounds: rgba(255, 255, 255, 0.03) (slightly elevated)
- Compliance colours tuned for WCAG AA on warmer background:
  - Compliant: #34D399 (4.5:1+ contrast)
  - Warning: #FBBF24 (4.5:1+ contrast)
  - Non-compliant: #F87171 (4.5:1+ contrast)
- Reduced glow intensities (20% less to reduce eye strain)

**File: `components/ui/ThemeToggle.tsx`** -- New component:
- System preference detection via `matchMedia`
- Manual toggle in DynamicIsland header
- Persists to `localStorage` key `ato-theme`
- Sets `data-theme` attribute on `<html>` element
- Keyboard shortcut: Ctrl+Shift+T
- `aria-label` describing current state

**File: `app/layout.tsx`** -- Inline script in `<head>` to prevent flash of wrong theme

### 3.3 Why Two Dark Themes

Financial professionals overwhelmingly use dark screens. A light mode would be jarring. The "Tax-Time" variant reduces eye strain during the intense July-October tax lodgement season through warmer tones and lower contrast without sacrificing readability.

---

## 4. Tax Bracket Visualisations

### 4.1 Shared Utilities

**File: `lib/tax-visualisation/brackets.ts`**
- Tax bracket data structures parameterised by FY
- FY2024-25 individual brackets: $0-18,200 (0%), $18,201-45,000 (16%), $45,001-135,000 (30%), $135,001-190,000 (37%), $190,001+ (45%)
- All rates include ITAA 1997 section references
- Helper functions for effective rate, marginal rate, tax payable calculations

### 4.2 Components

**`components/tax/TaxBracketWaterfall.tsx`**
- Individual marginal rate waterfall using Recharts BarChart
- Stacked bars for each bracket, colour-coded with spectral palette
- Interactive hover showing effective rate at each bracket boundary
- Accessible: hidden data table, aria-label on SVG

**`components/tax/CompanyRateComparison.tsx`**
- 25% base rate vs 30% standard comparison
- Grouped bar chart for a given taxable income
- Shows base rate eligibility criteria (turnover < $50M, <=80% passive income)

**`components/tax/CGTDiscountChart.tsx`**
- Pre-discount vs post-discount CGT visualisation
- 50% individual discount, 33.33% super fund, 0% company
- Horizontal bar chart comparing entity types

**`components/tax/DeductionImpactCalculator.tsx`**
- Interactive: slider/input for deduction amount
- Real-time display: gross income, deductions, taxable income, tax payable, effective rate
- Before/after side-by-side using Recharts AreaChart
- `aria-live="polite"` for screen reader updates on calculation changes

---

## 5. Projected Offset Dashboard

### 5.1 Reusable Components

**`components/projections/OffsetMeter.tsx`**
- SVG arc/gauge component (no canvas -- canvas is inaccessible)
- Current value vs projected maximum
- Colour transitions: green -> amber -> red
- Animated fill using CSS transitions
- Screen reader: `role="meter"` with `aria-valuenow`, `aria-valuemin`, `aria-valuemax`

### 5.2 Domain Components

**`components/projections/RnDOffsetProjection.tsx`**
- Uses OffsetMeter for 43.5% offset visualisation
- Data from `/api/audit/recommendations` (R&D area) or Backend_Dev's new `/api/analysis/cgt` endpoint
- Shows eligible expenditure, offset amount, clawback risk

**`components/projections/SmallBusinessCGTConcession.tsx`**
- Eligibility checklist using DataStrip pattern
- Div 152 concession value estimate
- Data from Backend_Dev's CGT engine

**`components/projections/LossCarryForwardTimeline.tsx`**
- Horizontal timeline using Recharts LineChart
- FY axis showing carry-forward losses
- COT/SBT compliance indicators per year

**`components/projections/FBTLiabilityProjection.tsx`**
- OffsetMeter showing FBT liability at 47% rate
- Data from Backend_Dev's FBT engine

**`components/projections/SuperCapUsage.tsx`**
- Dual progress bars: concessional ($30K) and non-concessional ($120K) caps
- Uses existing progress-bar CSS classes

### 5.3 Page

**`app/dashboard/projections/page.tsx`**
- Bento grid layout with HoloPanel containers
- MetricBlock row at top for headline figures
- Detailed projections below in HoloPanelGrid

---

## 6. Tax Compliance Calendar

### 6.1 Components

**`components/calendar/TaxCalendar.tsx`**
- Custom monthly calendar grid (no external library)
- Entity type selector: company, individual, trust, partnership, super fund
- Colour-coded deadline dots
- Keyboard navigation: arrow keys for day navigation (standard grid pattern)
- `role="grid"` with `aria-label`, individual cells as `role="gridcell"`

**`components/calendar/DeadlineCard.tsx`**
- Expandable card per deadline
- Countdown indicator with colour coding:
  - Green: >30 days
  - Amber: 7-30 days
  - Red: <7 days
  - Pulsing: overdue

### 6.2 Data

**`lib/tax-data/deadlines.ts`**
- All Australian tax deadlines with entity type tags
- BAS: monthly (21st following) / quarterly
- PAYG: quarterly instalments
- FBT: return 21 May, payment 28 May
- Income tax: companies 15 May, individuals 31 October (non-agent), 15 May (agent)
- R&D registration: 10 months after FY end
- Super guarantee: quarterly (28th month following quarter)
- FY-parameterised date generation using date-fns

### 6.3 Page

**`app/dashboard/calendar/page.tsx`**
- Full calendar view with upcoming deadlines sidebar
- Filter by entity type
- `export const dynamic = 'force-dynamic'` as per project pattern

---

## 7. WCAG 2.1 AA Accessibility Strategy

### 7.1 Colour-blind Safe Palette

All chart colours verified against protanopia, deuteranopia, tritanopia:
- Use pattern fills (stripes, dots, crosshatch) as secondary differentiators
- Never rely on colour alone -- always pair with icon or pattern
- Compliance status: icon + colour + text

### 7.2 Screen Reader Support

- All financial values: `aria-label="R&D tax offset: $43,500"`
- Charts: hidden `<table>` with `.sr-only` class
- Dynamic updates: `aria-live="polite"` on calculated values
- Calculator results: `role="status"`

### 7.3 Keyboard Navigation

- All interactive elements focusable via Tab
- Calendar: arrow key grid navigation
- Charts: arrow keys for data point navigation
- Theme toggle: Ctrl+Shift+T shortcut
- Skip link at top of dashboard layout

### 7.4 Focus Indicators

Added to globals.css:
- `:focus-visible` ring: 2px solid accent colour
- Both themes have appropriate contrast for focus rings
- No focus ring on mouse click (`:focus:not(:focus-visible)`)

### 7.5 Screen Reader Only Utility

```css
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border-width: 0;
}
```

---

## 8. New File Structure

```
components/
  tax/
    TaxBracketWaterfall.tsx
    CompanyRateComparison.tsx
    CGTDiscountChart.tsx
    DeductionImpactCalculator.tsx
    index.ts
  projections/
    OffsetMeter.tsx
    RnDOffsetProjection.tsx
    SmallBusinessCGTConcession.tsx
    LossCarryForwardTimeline.tsx
    FBTLiabilityProjection.tsx
    SuperCapUsage.tsx
    index.ts
  calendar/
    TaxCalendar.tsx
    DeadlineCard.tsx
    index.ts
  ui/
    ThemeToggle.tsx              (new)
    SkipLink.tsx                 (new)
    AccessibleChart.tsx          (new - recharts a11y wrapper)

lib/
  tax-visualisation/
    brackets.ts
  tax-data/
    deadlines.ts

app/
  dashboard/
    projections/
      page.tsx                   (new)
    calendar/
      page.tsx                   (new)
  globals.css                    (modified)
  layout.tsx                     (modified)

lib/config/
  navigation.ts                  (modified - add Projections + Calendar)
```

---

## 9. Implementation Order

1. Theme System (globals.css + ThemeToggle + layout.tsx) -- foundation
2. Accessibility Utilities (SkipLink, AccessibleChart, focus styles, sr-only)
3. Tax Bracket Visualisations (4 chart components + brackets.ts)
4. Projected Offset Dashboard (OffsetMeter + 5 projection components + page)
5. Tax Compliance Calendar (deadlines.ts + TaxCalendar + DeadlineCard + page)
6. Navigation Updates (add Projections + Calendar to nav config)
7. Integration verification

---

## 10. API Data Dependencies (from Backend_Dev)

| Frontend Component | Backend API | Status |
|-------------------|-------------|--------|
| RnDOffsetProjection | `/api/audit/recommendations` | Existing |
| CGT visualisations | `/api/analysis/cgt` | Backend_Dev building |
| FBTLiabilityProjection | `/api/analysis/fbt` | Backend_Dev building |
| LossCarryForwardTimeline | `/api/analysis/losses` | Existing |
| SuperCapUsage | `/api/analysis/super` | Existing |
| SmallBusinessCGTConcession | `/api/analysis/cgt` | Backend_Dev building |

For APIs not yet available, components will render graceful empty states with "No data available" per CLAUDE.md requirements.

---

## 11. CLAUDE.md Updates

After approval, these sections will be added to CLAUDE.md:
- Frontend design decisions (theme system, accessibility strategy)
- New component architecture documentation
- Accessibility standards and testing checklist
- Tax visualisation component API documentation
