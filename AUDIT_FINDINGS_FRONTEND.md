# AUDIT_FINDINGS_FRONTEND.md

**Audit Type:** UX/UI, Frontend & Accessibility
**Auditor:** Senior UX/UI & Frontend Auditor (Agent #3)
**Date:** 2026-02-12
**Scope:** All dashboard pages, shared components, design system compliance, WCAG 2.1 AA, TaxDisclaimer coverage

---

## Executive Summary

**Total findings: 47**

| Severity | Count |
|----------|-------|
| CRITICAL | 6 |
| HIGH | 16 |
| MEDIUM | 17 |
| LOW | 8 |

The application has strong foundations (well-implemented shared components, good accessibility patterns in AccessibleChart/SkipLink/EmptyState, proper WCAG keyboard navigation on calendar). However, **3 pages use light-mode classes in a dark-only app**, **5 pages are missing the legally-required TaxDisclaimer**, GlassCard is duplicated in 7 files instead of being shared, and border-radius violations are pervasive. Loading state consistency is poor: 8+ pages use `loading-spinner` or custom spinners instead of the standardised `PageSkeleton`. Multiple pages contain dead/non-functional buttons that mislead users.

---

## CRITICAL Findings

### C-01: Light-mode classes in dark-only application (team page)

**File:** `app/dashboard/team/page.tsx`
**Lines:** Throughout (262 lines)

The entire team page uses light-mode Tailwind classes incompatible with the OLED dark-only theme:
- `bg-gray-800`, `border-gray-700`, `text-gray-400`
- `bg-blue-600 hover:bg-blue-700` (buttons)
- `bg-yellow-100 dark:bg-yellow-900/30` (dual-mode classes)
- `getRoleColor()` returns `bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200` patterns

**Impact:** Page renders with gray backgrounds and blue accents instead of OLED black + spectral cyan. Visually broken against every other dashboard page.

**Fix:** Replace all classes with design system tokens (`glass-card`, `var(--accent)`, `var(--bg-dashboard)`, `text-white/60`).

---

### C-02: Light-mode classes in dark-only application (alerts page)

**File:** `app/dashboard/alerts/page.tsx`
**Lines:** 1-51

Uses `bg-gray-50 dark:bg-gray-950`, `text-gray-900 dark:text-white` -- dual light/dark mode classes in an app that has no light mode.

**Impact:** Gray-50 background renders in light mode context. Inconsistent appearance with OLED black theme.

**Fix:** Replace with `bg-[var(--bg-dashboard)]` or equivalent CSS custom property classes.

---

### C-03: Light-mode classes in dark-only application (historical analysis)

**File:** `app/dashboard/forensic-audit/historical/page.tsx`
**Lines:** 108, 138, 144-165

Uses `bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900` (gray gradient, not OLED black). Also uses `bg-blue-500/10`, `text-blue-400`, `border-blue-500`, `text-gray-300`, `text-gray-400` instead of design system colour tokens.

**Impact:** Inconsistent visual appearance. Gray gradient background instead of pure black.

**Fix:** Use `bg-[var(--bg-dashboard)]` and spectral colour tokens.

---

### C-04: Light-mode classes in dark-only application (organization pages)

**Files:**
- `app/dashboard/organization/settings/page.tsx` (lines 138, 148, 170)
- `app/dashboard/organization/members/page.tsx` (lines 142, 153)

Both pages use `bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900`, `bg-blue-500/10`, `bg-green-500/10`, `rounded-lg`, `text-gray-400` etc. Completely inconsistent with OLED dark theme and design system.

**Impact:** Organization settings and member management pages look visually different from the rest of the dashboard.

**Fix:** Migrate to design system CSS custom properties and glass-card pattern.

---

### C-05: Missing TaxDisclaimer on pages with tax recommendations

**Pages missing TaxDisclaimer (TASA 2009 compliance requirement):**

| Page | File | Has Tax Content |
|------|------|-----------------|
| Admin Intelligence | `app/dashboard/admin/page.tsx` | Yes (processing stats, analysis data) |
| Team Management | `app/dashboard/team/page.tsx` | No (but displays in tax context) |
| Agent Monitor | `app/dashboard/agent-monitor/page.tsx` | Yes (agent health for tax analysis) |
| Pricing | `app/dashboard/pricing/page.tsx` | Yes (describes tax analysis services) |
| Grant Accelerator | `app/dashboard/strategies/grant-accelerator/page.tsx` | Yes (grant eligibility analysis) |
| Org Settings | `app/dashboard/organization/settings/page.tsx` | Yes (tax preferences config) |
| Org Members | `app/dashboard/organization/members/page.tsx` | No |

**Impact:** TASA 2009 s 50-5 penalty exposure. The TaxDisclaimer is the primary defence against unregistered tax agent services claims. Missing on 5+ pages that display tax-related content or analysis.

**Fix:** Add `<TaxDisclaimer />` to all listed pages (at minimum: admin, agent-monitor, pricing, grant-accelerator, org settings).

---

### C-06: Dynamic Tailwind class will not render

**File:** `app/dashboard/admin/page.tsx`
**Line:** ~185 (in resource usage section)

Uses `bg-${res.color}-500` pattern for dynamic background colours. Tailwind CSS purges unused classes at build time. Dynamic class interpolation does not work without explicit safelist configuration.

**Impact:** Resource usage bars render without background colour -- invisible to the user.

**Fix:** Use a lookup object mapping colour names to full Tailwind classes, or use inline styles.

---

## HIGH Findings

### H-01: GlassCard component duplicated in 7 files

**Files with local GlassCard definition:**
1. `app/dashboard/overview/page.tsx`
2. `app/dashboard/strategies/page.tsx`
3. `app/dashboard/losses/page.tsx`
4. `app/dashboard/tax-reporting/page.tsx`
5. `app/dashboard/data-quality/page.tsx`
6. `app/dashboard/admin/page.tsx`
7. `components/dashboard/ConsolidatedDashboard.tsx`

Each defines an identical `GlassCard` component with `motion.div`, `glass-card` class, and optional `highlight` prop.

**Impact:** Maintenance burden. Changes to the card pattern require editing 7 files. Risk of divergence.

**Fix:** Extract to `components/ui/GlassCard.tsx` and import everywhere.

---

### H-02: Inconsistent loading states across pages

**Pages using non-standard loading patterns:**

| Page | Loading Pattern | Expected |
|------|----------------|----------|
| `admin/page.tsx` | `loading-spinner` div | `PageSkeleton` |
| `tax-reporting/page.tsx` | `loading-spinner` div | `PageSkeleton` |
| `agent-monitor/page.tsx` | Custom text "Loading..." | `PageSkeleton` |
| `forensic-audit/historical/page.tsx` | `loading-spinner` + text | `PageSkeleton` |
| `forensic-audit/advanced/page.tsx` | `loading-spinner` div | `PageSkeleton` |
| `forensic-audit/cost-monitoring/page.tsx` | `loading-spinner` div | `PageSkeleton` |
| `organization/settings/page.tsx` | None (empty state only) | `PageSkeleton` |
| `organization/members/page.tsx` | Inline "Loading..." text | `PageSkeleton` |

**Impact:** Inconsistent user experience. The `PageSkeleton` component exists with 3 variants (default, analysis, form) and follows the design system's shimmer animation pattern.

**Fix:** Replace all custom loading states with `<PageSkeleton variant="analysis" />` or appropriate variant.

---

### H-03: Dead/non-functional buttons across multiple pages

| Page | Button | Issue |
|------|--------|-------|
| `rnd/page.tsx` | "Export Schedule" | No click handler |
| `rnd/page.tsx` | "Register Activities" | No click handler |
| `losses/page.tsx` | "Generate Draft Agreement" | No click handler |
| `losses/page.tsx` | "Identify Transactions" | No click handler |
| `strategies/page.tsx` | "Update Intelligence Rules" | No click handler |
| `strategies/grant-accelerator/page.tsx` | "Open Grant Portal" | No click handler |
| `strategies/grant-accelerator/page.tsx` | "Download Prepared Asset Package" | No click handler |
| `forensic-audit/advanced/page.tsx` | "Download Client-Friendly Report" | No click handler |
| `forensic-audit/advanced/page.tsx` | "Download Technical PDF" | No click handler |
| `forensic-audit/advanced/page.tsx` | "Export Excel Workbook" | No click handler |
| `forensic-audit/advanced/page.tsx` | "Amendment Schedules" | No click handler |

**Impact:** Users click buttons expecting functionality that does not exist. This erodes trust and creates confusion.

**Fix:** Either implement the functionality or hide/disable the buttons with a "Coming Soon" indicator.

---

### H-04: Broken navigation links

| Source Page | Link Target | Issue |
|-------------|-------------|-------|
| `rnd/page.tsx` | `/dashboard/help` | Route does not exist in the app |
| `pricing/page.tsx` | `/accountant/apply` | Route does not exist (should be `/dashboard/accountant` or external) |

**Impact:** Users encounter 404 errors when clicking these links.

**Fix:** Update links to valid routes or remove them.

---

### H-05: Pervasive border-radius violations

The design system specifies `2px` border-radius for rectangular containers (DESIGN_SYSTEM.md). Nearly every page violates this:

| Pattern | Violation Count (approx) | Pages |
|---------|-------------------------|-------|
| `rounded-2xl` | 20+ | accountant, overview, losses, settings, pricing |
| `rounded-3xl` | 10+ | forensic-audit/page.tsx, consolidated reports |
| `rounded-xl` | 30+ | Most pages via inline styles `rounded-xl` |
| `rounded-lg` | 20+ | team, historical, org settings, org members |
| `rounded-[40px]` | 3 | losses, grant-accelerator |
| `rounded-full` | Many | Badges, pills -- acceptable per spec for `9999px` circles |

**Impact:** Visual inconsistency across the application. The design system's sharp, precise aesthetic is undermined.

**Fix:** Systematic replacement with `rounded-sm` (2px) for cards and containers. Keep `rounded-full` for pills/badges/avatars only.

---

### H-06: Incorrect Div7A benchmark rate display

**File:** `app/dashboard/losses/page.tsx`
**Line:** 219

Displays "8.27% (FY25)" as the Division 7A benchmark rate. The correct FY2024-25 rate is **8.77%** per TD 2024/3 (as correctly shown in `accountant/div7a/page.tsx` line 116).

**Impact:** Users see an incorrect compliance rate, potentially leading to incorrect minimum repayment calculations.

**Fix:** Update to "8.77% (FY25)" and ideally fetch dynamically from the rates infrastructure.

---

### H-07: Hardcoded stale data in grant-accelerator

**File:** `app/dashboard/strategies/grant-accelerator/page.tsx`

Contains hardcoded values that will become stale:
- Line ~78: Deadline "30 Jan, 5:00 PM" (already past)
- Line ~95: "$553,530.52" revenue figure
- Line ~100: "Active since 2019"
- Line ~105: "12 Active Staff"
- Line ~140: "96%" eligibility match

**Impact:** Users see outdated, org-specific data that does not reflect their actual business. Misleading.

**Fix:** Fetch dynamic data from Xero/analysis APIs or display prominent "Demo Data" labels.

---

### H-08: N+1 API calls in recommendations page

**File:** `app/dashboard/forensic-audit/recommendations/page.tsx`
**Lines:** ~200-230 (status fetch loop)

Fetches status for each recommendation individually in a `for` loop, creating N+1 API calls (1 for list + N for individual statuses).

**Impact:** Performance degradation. With 40 recommendations (DR Qld has 40), this creates 41 API calls on page load.

**Fix:** Batch status fetching into a single API call that accepts multiple IDs.

---

### H-09: Fake "CONNECTED" status indicators

**File:** `app/dashboard/strategies/page.tsx`
**Lines:** 296-308

Displays "CONNECTED" status for "ATO.gov.au", "Business.gov.au", and "Grants.gov.au" discovery sources. None of these are actual integrations.

**Impact:** Users are misled into believing the application has live connections to these government data sources.

**Fix:** Remove fake status indicators or change to "AVAILABLE" / "PLANNED".

---

### H-10: Error handling uses alert() and raw text

| Page | Error Pattern | Issue |
|------|--------------|-------|
| `reports/consolidated/page.tsx` | `alert()` for download failure | Poor UX, non-themed |
| `organization/members/page.tsx` | `alert()` for remove/revoke errors | Poor UX, non-themed |
| `tax-reporting/page.tsx` | Raw error text in div | No retry, no ErrorState component |
| `overview/page.tsx` | No error state at all | Silently fails |
| `losses/page.tsx` | No error state at all | console.error only |

**Impact:** Inconsistent error handling. Users either see browser-native alert boxes (jarring in a polished UI) or get no feedback at all when operations fail.

**Fix:** Use the `ErrorState` component consistently. Replace all `alert()` calls with toast notifications or inline error messages.

---

### H-11: Emoji usage in production UI

| Page | Emoji | Context |
|------|-------|---------|
| `agent-monitor/page.tsx` | `statusIcon = { healthy: '✅', warning: '⚠️', error: '❌' }` | Agent status indicators |
| `forensic-audit/advanced/page.tsx` | `🎯` | Client view section |
| `accountant/documents/page.tsx` | `⚠️` | Risk warning |
| `accountant/reconciliation/page.tsx` | `✓` | Best practice indicator |

**Impact:** Emojis render inconsistently across OS/browsers. They violate the "Professional Elegant" design language. Screen reader support for emojis is inconsistent.

**Fix:** Replace with Lucide React icons (CheckCircle2, AlertTriangle, Target, etc.).

---

### H-12: No error states for failed data fetches

**Files:**
- `app/dashboard/overview/page.tsx` -- fetches data but has no error UI; `_error` state variable unused
- `app/dashboard/losses/page.tsx` -- catches error in `console.error` only, no user-facing feedback
- `app/dashboard/accountant/page.tsx` -- no loading skeleton, empty defaults if fetch fails

**Impact:** Users see blank or default-zero data with no indication that their data failed to load.

**Fix:** Add `ErrorState` component with retry button when fetches fail.

---

### H-13: `window.print()` for PDF generation

**File:** `app/dashboard/forensic-audit/page.tsx` (and possibly others)

Uses `window.print()` for generating PDF reports. This opens the browser print dialog rather than generating a proper PDF.

**Impact:** Unprofessional output. Print styles may not match the dark theme. No control over PDF formatting.

**Fix:** Use a proper PDF library (jspdf, @react-pdf/renderer) or server-side PDF generation.

---

### H-14: Accountant sub-pages lack empty state fallback

**Files:** All 6 accountant workflow sub-pages (`sundries`, `deductions`, `fbt`, `div7a`, `documents`, `reconciliation`)

When `fetchFindings()` returns an empty array (which it does when there are no matching rows or on error), the WorkflowFindings component receives `initialFindings={[]}`. If WorkflowFindings does not handle the empty state internally, users see a blank page.

**Impact:** No guidance for users when there are no findings to review.

**Fix:** Verify WorkflowFindings has empty state handling; if not, add inline empty state with "No findings for this workflow area" message and link to run forensic audit.

---

### H-15: Accountant sub-pages all use `select('*')`

**Files:** All 6 accountant workflow sub-pages fetch from `accountant_findings` with `.select('*')`.

**Impact:** Over-fetching data. Sends all columns to the client including potential internal fields. Per security best practice (B-4 remediation pattern), explicit column selection is preferred.

**Fix:** Replace `select('*')` with explicit column names matching the `AccountantFindingRow` interface.

---

### H-16: `cursor-crosshair` on R&D page

**File:** `app/dashboard/rnd/page.tsx`

Uses `cursor-crosshair` CSS class on interactive elements.

**Impact:** Confusing non-standard cursor. Users expect pointer or default cursor on clickable elements. Crosshair cursor suggests image editing or coordinate selection.

**Fix:** Remove `cursor-crosshair`. Use default cursor or `cursor-pointer` for interactive elements.

---

## MEDIUM Findings

### M-01: `text-[10px]` used extensively for compliance labels

**Files (partial list):**
- `strategies/page.tsx` -- 7+ instances
- `losses/page.tsx` -- 5+ instances
- `overview/page.tsx` -- 3+ instances
- `forensic-audit/recommendations/page.tsx` -- footer disclaimer

While `text-[10px]` (10px) is above the absolute minimum for decorative text, it is at the edge of readability for important labels like "VERIFIED ELIGIBLE", "RISK DETECTED", and compliance footer text.

**Impact:** WCAG 2.1 AA does not specify minimum font size but recommends 12px+ for body text. 10px text at low opacity (`text-white/20`, `text-white/40`) may fail contrast ratios.

**Fix:** Increase to `text-[11px]` minimum for labels. Ensure contrast ratio of at least 4.5:1 for all text against `#050505` background.

---

### M-02: Multiple `formatCurrency` implementations

Duplicated utility functions across pages:
- `components/ui/AccessibleChart.tsx` -- exports `formatCurrency`
- `app/dashboard/overview/page.tsx` -- local `formatCurrency`
- `app/dashboard/reports/consolidated/page.tsx` -- local formatter
- `app/dashboard/forensic-audit/transactions/page.tsx` -- local formatter

**Impact:** Maintenance burden. Risk of inconsistent currency formatting.

**Fix:** Import from `AccessibleChart.tsx` or extract to shared `lib/utils/format.ts`.

---

### M-03: Dead code in transactions page

**File:** `app/dashboard/forensic-audit/transactions/page.tsx`

`_formatDate` function is defined but never used (prefixed with underscore to suppress lint warning).

**Impact:** Dead code adds noise to the codebase.

**Fix:** Remove the unused function.

---

### M-04: Pages not wrapped in consistent layout container

Some pages use `min-h-screen bg-[var(--bg-dashboard)] px-4 sm:px-6 lg:px-8 py-6 sm:py-8` while others use `min-h-screen bg-gradient-to-br from-gray-900...` or `min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900`.

**Inconsistent background patterns:**
- Design system: `bg-[var(--bg-dashboard)]` (10 pages)
- Gray gradient: `bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900` (4 pages)
- Missing entirely (1 page uses parent layout only)

**Impact:** Visual inconsistency between pages during navigation.

**Fix:** Standardise on `bg-[var(--bg-dashboard)]` across all pages.

---

### M-05: Inconsistent page header patterns

At least 3 different header patterns are used:

1. **Scientific Luxury** (forensic-audit sub-pages): Font mono, uppercase tracking, BrainCircuit/Zap icons, `text-5xl font-black tracking-tighter`
2. **Standard** (overview, losses, strategies): Similar to #1 but varying sizes (`text-6xl` vs `text-5xl` vs `text-4xl`)
3. **Generic** (org settings, org members, historical): `text-3xl font-bold` with `bg-blue-500/10 rounded-lg` icon container

**Impact:** No consistent visual hierarchy across the application.

**Fix:** Create a shared `PageHeader` component with standard variants.

---

### M-06: No mobile bottom navigation on several pages

Pages with `MobileNav` component:
- agent-monitor, forensic-audit/recommendations, forensic-audit/transactions, forensic-audit/reconciliation, forensic-audit/cost-monitoring

Pages WITHOUT mobile navigation:
- overview, losses, strategies, rnd, admin, team, projections, calendar, audit, tax-reporting, settings, pricing, all accountant sub-pages, all organization pages

**Impact:** Mobile users on pages without MobileNav have no bottom navigation and must use the sidebar hamburger menu.

**Fix:** Add MobileNav to all dashboard pages or handle through the dashboard layout.

---

### M-07: Hardcoded values on admin page

**File:** `app/dashboard/admin/page.tsx`

- "2.4k / hr" processing rate (line ~120)
- "84%" / "12%" / "45%" resource utilisation values (line ~180)

**Impact:** These static values do not reflect actual system state. Misleading to administrators.

**Fix:** Fetch from actual monitoring metrics or mark prominently as placeholder.

---

### M-08: `select` dropdowns have no accessible labels in some pages

**Files:**
- `losses/page.tsx` lines 110-116 -- `<select>` with no associated `<label>` element
- `losses/page.tsx` lines 117-124 -- FY selector with no label

**Impact:** WCAG 2.1 AA requires all form controls to have programmatically associated labels.

**Fix:** Add `aria-label` or wrap with `<label>`.

---

### M-09: Inconsistent use of `aria-live` for dynamic content

Only the calendar page and some forensic-audit pages use `aria-live="polite"` for dynamically updating content. Pages like overview (with AnimatedCounter) and strategies (with loading recommendations) do not announce updates to screen readers.

**Impact:** Screen reader users are not informed when content loads or changes on most pages.

**Fix:** Add `aria-live="polite"` regions around dynamically loading content.

---

### M-10: No focus management after data loads

When pages transition from loading skeleton to content (e.g., overview, strategies, losses), focus is not programmatically moved to the new content.

**Impact:** Keyboard users must re-navigate from the top of the page after content loads.

**Fix:** Move focus to a heading or landmark after content renders using `useEffect` + `ref.focus()`.

---

### M-11: Color-only information in some status indicators

**File:** `app/dashboard/losses/page.tsx` line 164

"Risk Detected" badge uses `bg-red-500/10 border border-red-500/20 text-red-500` with no accompanying icon or aria-label to convey the "risk" meaning for colour-blind users.

The design system requires icon + colour + text (never colour alone), but several pages use colour-only status dots (e.g., strategies page line 58: small coloured dot with no text for status).

**Impact:** WCAG 1.4.1 (Use of Color) violation.

**Fix:** Add icon alongside all status indicators. The strategies page line 58 has `sr-only` text (good) but should also have a visible icon.

---

### M-12: Select option backgrounds may be invisible in dark theme

**Files:** All pages with `<select>` elements using `bg-white/5` or `bg-white/10`

Browser-native `<option>` elements do not inherit custom backgrounds in most browsers. On dark themes, option dropdowns may show white text on white background (or vice versa).

**Impact:** Dropdown menus may be unreadable depending on browser/OS.

**Fix:** Use a custom dropdown component (Headless UI Listbox or Radix Select) or apply explicit option styling.

---

### M-13: `confirm()` dialog for destructive actions

**File:** `app/dashboard/organization/members/page.tsx` line 102

Uses `confirm()` for member removal confirmation. Browser-native confirm dialogs are un-themed and jarring.

**Impact:** Inconsistent with the polished UI. No ability to style or add additional context.

**Fix:** Use a custom confirmation modal component.

---

### M-14: Duplicate `AccountantFindingRow` interface

**Files:** All 6 accountant sub-pages (`sundries`, `deductions`, `fbt`, `div7a`, `documents`, `reconciliation`) each define an identical `AccountantFindingRow` interface and identical `fetchFindings()` function.

**Impact:** 6x code duplication. If the database schema changes, all 6 files need updating.

**Fix:** Extract to shared `lib/types/accountant.ts` and `lib/data/accountant-findings.ts`.

---

### M-15: Missing `key` prop warnings potential

**File:** `app/dashboard/strategies/page.tsx` line 243

Uses array index as key: `key={i}`. If recommendations are reordered or filtered, this will cause incorrect React reconciliation.

**Impact:** Potential rendering bugs when list items change.

**Fix:** Use recommendation ID or title as key: `key={rec.title}` or a unique identifier.

---

### M-16: Inconsistent spacing and max-width containers

Pages use varying `max-w-*` values:
- `max-w-7xl` (most pages)
- `max-w-6xl` (org members)
- `max-w-4xl` (org settings)
- No max-width (some forensic-audit sub-pages)

**Impact:** Content width varies between pages during navigation.

**Fix:** Standardise on `max-w-7xl` via the dashboard layout or a shared wrapper.

---

### M-17: Invitation dialog lacks accessibility

**File:** `app/dashboard/organization/members/page.tsx` lines 396-525

The InviteDialog modal:
- Backdrop has `onClick={onClose}` but no `role="presentation"` or `aria-hidden`
- Dialog container has no `role="dialog"` or `aria-modal="true"`
- No focus trap (Tab key escapes the modal)
- No Escape key handler to close
- No `aria-labelledby` pointing to the dialog title

**Impact:** WCAG 2.1 AA violations. Screen readers and keyboard users cannot properly interact with the modal.

**Fix:** Add proper ARIA dialog attributes, focus trap, and Escape key handling.

---

## LOW Findings

### L-01: `_error` and `_isLoading` unused state variables

**Files:**
- `strategies/page.tsx` line 101: `_error` state set but never rendered
- `organization/settings/page.tsx` line 27: `_isLoading` state set but never used

**Impact:** Dead code / lint warnings.

**Fix:** Remove unused state or render error states to users.

---

### L-02: Inconsistent icon sizes

Pages use varying icon sizes without a clear pattern:
- Header icons: `w-4 h-4` to `w-8 h-8`
- Inline icons: `w-3 h-3` to `w-6 h-6`
- Status icons: `w-2 h-2` to `w-5 h-5`

The design system does not specify icon scale rules.

**Impact:** Minor visual inconsistency.

**Fix:** Document icon size scale in design system (e.g., 16px for inline, 20px for actions, 24px for section headers, 32px for page headers).

---

### L-03: `<Link>` wrapping `<button>` in strategies page

**File:** `app/dashboard/strategies/page.tsx` line 87-91

```tsx
<Link href={href || '#'}>
  <button className="btn btn-primary btn-sm px-6">
    {action} <ArrowRight ... />
  </button>
</Link>
```

**Impact:** Semantically incorrect. A link should not wrap a button. Screen readers may announce this confusingly.

**Fix:** Use `<Link className="btn btn-primary...">` directly, or use `<button onClick={() => router.push(href)}>`.

---

### L-04: Missing `rel="noopener"` on external links

No external links were found to have `rel="noopener noreferrer"`, though most links are internal. The grant-accelerator has buttons that imply opening external portals but have no handlers.

**Impact:** Low risk since there are few actual external links.

**Fix:** Audit and add `rel="noopener noreferrer"` to any external link targets.

---

### L-05: Inconsistent animation usage

Some pages use `framer-motion` (overview, strategies, losses, admin) with `motion.div initial={{ opacity: 0, y: 20 }}` while others use Tailwind `animate-in fade-in` (PageSkeleton) or no animation at all (org pages, historical).

**Impact:** Inconsistent transition feel between pages.

**Fix:** Standardise on one animation approach (framer-motion OR Tailwind animate-in) for page entry transitions.

---

### L-06: Accountant sub-pages use inline hex colours

**Files:** All accountant sub-pages use inline hex colours like `#00D9FF`, `#FF0080`, `#FFFF00`, `#00FF00`, `#FF00FF`, `#FF6B00` in both style props and Tailwind arbitrary values.

While these are spectral colours that fit the design language, they are not referenced via CSS custom properties.

**Impact:** Minor. If the design system colours change, these 6 files need manual updating.

**Fix:** Map to CSS custom properties or import from a shared colour constants file.

---

### L-07: `rounded-2xl` used consistently in accountant sub-pages

**Files:** All accountant sub-pages use `rounded-2xl` in the help section via `className="p-6 rounded-2xl"`.

**Impact:** Minor design system violation but consistent within the accountant workflow area.

**Fix:** Align with 2px radius design system specification.

---

### L-08: Potential XSS vector in recommendation descriptions

**File:** `app/dashboard/strategies/page.tsx` line 73

Recommendation `description` from API is rendered directly in JSX: `<p ...>{description}</p>`. While React escapes HTML by default, if descriptions contain markdown or special characters they may render incorrectly.

**Impact:** Low (React's JSX escaping prevents actual XSS). May display raw markdown syntax.

**Fix:** Sanitise or format descriptions if they can contain markdown/HTML from AI analysis output.

---

## Shared Component Assessment

### Well-Implemented Components

| Component | File | Assessment |
|-----------|------|------------|
| `PageSkeleton` | `components/skeletons/PageSkeleton.tsx` | 3 variants, uses CSS vars, shimmer animation. Well-built. |
| `EmptyState` | `components/ui/EmptyState.tsx` | Clean, uses CSS vars, supports both link and callback actions. |
| `ErrorState` | `components/ui/ErrorState.tsx` | Has retry support, themed correctly. |
| `AccessibleChart` | `components/ui/AccessibleChart.tsx` | Proper `role="img"`, hidden data table with `<caption>`, `<th scope="col">`. WCAG compliant. |
| `SkipLink` | `components/ui/SkipLink.tsx` | Minimal, correct implementation. Uses `.skip-link` class from globals.css. |
| `TaxDisclaimer` | `components/dashboard/TaxDisclaimer.tsx` | TASA 2009 reference, 12px font, 60% opacity, `role="contentinfo"`. Meets compliance spec. |

### Under-Utilised Components

| Component | Issue |
|-----------|-------|
| `PageSkeleton` | Not used on 8+ pages that have their own loading patterns |
| `EmptyState` | Not used on losses, admin, agent-monitor pages |
| `ErrorState` | Not used on overview, losses, or accountant pages |

---

## Summary of Required Actions (Priority Order)

### Immediate (P0)

1. Add `TaxDisclaimer` to all pages with tax content (C-05)
2. Fix dynamic Tailwind class in admin page (C-06)
3. Fix Div7A rate from 8.27% to 8.77% on losses page (H-06)

### Short-term (P1)

4. Migrate team, alerts, historical, org-settings, org-members pages to OLED dark theme (C-01 through C-04)
5. Extract shared GlassCard component (H-01)
6. Standardise loading states to PageSkeleton (H-02)
7. Fix or disable all dead buttons (H-03)
8. Fix broken navigation links (H-04)
9. Remove hardcoded stale data from grant-accelerator (H-07)
10. Remove fake "CONNECTED" indicators (H-09)

### Medium-term (P2)

11. Systematic border-radius audit and fix (H-05)
12. Replace alert()/confirm() with themed components (H-10, M-13)
13. Add ARIA attributes to InviteDialog modal (M-17)
14. Add `aria-label` to unlabelled form controls (M-08)
15. Add `aria-live` regions for dynamic content (M-09)
16. Extract shared formatCurrency utility (M-02)
17. Extract shared AccountantFindingRow + fetchFindings (M-14)
18. Replace emojis with Lucide icons (H-11)
19. Batch recommendation status API calls (H-08)
20. Add error states to overview and losses pages (H-12)

---

*Audit completed 2026-02-12. 47 findings across 30+ pages and 6+ shared components.*
