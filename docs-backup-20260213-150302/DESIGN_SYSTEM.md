# ATO Tax Optimizer -- Professional Elegant Design System

**Version:** 1.0
**Last Updated:** 2026-02-07
**Design Council:** Eloquent_Minimalist, Professional_Architect, Symmetry_Lead, Precision_Execution

---

## 1. Design Philosophy

The ATO Tax Optimizer serves Australian financial professionals during high-stakes, extended tax-season sessions. Every design decision prioritises three principles:

1. **Trust** -- Users are making decisions about tax positions worth hundreds of thousands of dollars. The interface must feel as reliable as a government system and as refined as a premium financial platform.
2. **Clarity** -- Tax compliance data is inherently complex. Visual hierarchy, whitespace, and typographic discipline reduce cognitive load.
3. **Continuity** -- Navigation between modules should feel like turning pages in a single ledger, not jumping between disconnected applications.

The design language is "Professional Elegant": austere backgrounds, precise typography, controlled colour, and restrained motion. It draws visual cues from Australian institutional design (ATO, ASIC, RBA) while applying modern interface patterns.

---

## 2. Colour Palette

### 2.1 Design Tokens -- Dark Mode (Default: OLED Black)

The application uses a dark-first design. Backgrounds are near-true-black (#050505), maximising contrast on OLED displays and reducing eye strain during extended sessions.

#### Backgrounds (Surface Hierarchy)

| Token | Hex | Usage |
|-------|-----|-------|
| `--bg-base` | `#050505` | Page background, root surface |
| `--bg-subtle` | `#0A0A0A` | Tooltip backgrounds, dropdown panels |
| `--bg-card` | `rgba(255,255,255,0.02)` | Card surfaces, table headers |
| `--bg-card-hover` | `rgba(255,255,255,0.04)` | Card hover state |
| `--bg-elevated` | `#111114` | Modals, popovers, floating panels |
| `--bg-tertiary` | `#0D0D0D` | Sidebar backgrounds, secondary panels |

Rationale: Four distinct surface levels create depth without relying on drop shadows. The rgba approach ensures translucency for glass/frosted effects on the Dynamic Island and mobile nav.

#### Primary Accent -- Spectral Cyan

| Token | Hex | Usage | WCAG on #050505 |
|-------|-----|-------|-----------------|
| `--accent-primary` | `#00F5FF` | Primary actions, active nav, focus rings | 12.5:1 |
| `--accent-primary-light` | `#33F7FF` | Hover state for primary accent | 13.1:1 |
| `--accent-primary-dim` | `rgba(0,245,255,0.08)` | Active nav background, subtle highlight | N/A (bg) |
| `--accent-primary-glow` | `rgba(0,245,255,0.15)` | Hover glow on active elements | N/A (bg) |

Rationale: Cyan is visually distinct from the greens and reds used for compliance status. It sits outside the "traffic light" spectrum, preventing accidental semantic confusion. The hue is reminiscent of Australian fintech branding without copying any specific brand.

#### Secondary & Tertiary Accents

| Token | Hex | Purpose |
|-------|-----|---------|
| `--accent-secondary` | `#00C4CC` | Secondary interactive elements |
| `--accent-tertiary` | `#80FAFF` | Decorative highlights, gradient endpoints |

#### Semantic Colours

| Role | Token | Hex | WCAG on #050505 | Icon |
|------|-------|-----|-----------------|------|
| Success / Compliant | `--color-success` | `#00FF88` | 12.8:1 | Checkmark |
| Warning / Approaching | `--color-warning` | `#FFB800` | 10.9:1 | Warning triangle |
| Error / Non-compliant | `--color-error` | `#FF4444` | 5.5:1 | X mark / Alert |
| Info / Neutral | `--color-info` | `#00F5FF` | 12.5:1 | Info circle |

Each semantic colour has three tokens:
- **Full**: `--color-{name}` -- Text and icons
- **Light**: `--color-{name}-light` -- `rgba(..., 0.08)` -- Badge backgrounds
- **Dim**: `--color-{name}-dim` -- `rgba(..., 0.08)` -- Alert/strip backgrounds

**Critical rule:** Semantic colours must NEVER be used alone to convey information. Every use of colour must be paired with an icon and/or text label (WCAG 1.4.1).

#### Compliance Status Colours

These are specifically calibrated for the compliance system and differ slightly from the generic semantic colours:

| Status | Token | Hex | Use |
|--------|-------|-----|-----|
| OK | `--compliance-ok` | `#34D399` | Softer green for sustained viewing |
| Warning | `--compliance-warn` | `#FBBF24` | Amber distinct from error red |
| Risk | `--compliance-risk` | `#F87171` | Softer red, still 5.5:1 contrast |

#### Brand Integration Colours

| Brand | Token | Hex | Usage |
|-------|-------|-----|-------|
| Xero | `--color-xero` | `#13B5EA` | Xero connection indicators |
| MYOB | `--color-myob` | `#008591` | MYOB connection indicators |

#### Text Colours

| Token | Value | Usage |
|-------|-------|-------|
| `--text-primary` | `rgba(255,255,255,0.92)` | Headings, values, primary content |
| `--text-secondary` | `rgba(255,255,255,0.60)` | Body text, descriptions |
| `--text-tertiary` | `rgba(255,255,255,0.40)` | Labels, captions, metadata |
| `--text-muted` | `rgba(255,255,255,0.20)` | Disclaimers, disabled text |
| `--text-inverse` | `#050505` | Text on bright accent backgrounds |

#### Border Colours

| Token | Value | Usage |
|-------|-------|-------|
| `--border-light` | `rgba(255,255,255,0.06)` | Card borders, table rules, dividers |
| `--border-medium` | `rgba(255,255,255,0.10)` | Hover borders, active separators |
| `--border-strong` | `rgba(255,255,255,0.15)` | Focus borders, emphasized dividers |

All borders use 0.5px width. This is intentional: single-pixel borders at low opacity create structure without visual weight.

#### Chart/Data Visualisation Palette

Six colours, ordered by spectral position, ensuring adjacency contrast:

| Token | Hex | Use |
|-------|-----|-----|
| `--chart-1` | `#00F5FF` | Primary data series (cyan) |
| `--chart-2` | `#00FF88` | Secondary series (emerald) |
| `--chart-3` | `#FFB800` | Tertiary series (amber) |
| `--chart-4` | `#FF4444` | Quaternary series (red) |
| `--chart-5` | `#FF00FF` | Quinary series (magenta) |
| `--chart-6` | `#818CF8` | Senary series (indigo) |

When fewer than 6 series are needed, use tokens in order (1, 2, 3...). Never skip.

### 2.2 Tax-Time Mode (Dark Warm Variant)

Activated via `[data-theme="tax-time"]` on `<html>`. Designed for the July-October lodgement season when practitioners work extended hours.

Key differences from default:
- Backgrounds shift from pure black to warm near-black (`#0B0B0F`)
- Text opacity reduced ~5% to lower glare
- Accent glow reduced ~20% to reduce eye fatigue
- Border opacity increased ~1% for subtle warmth
- Semantic dim colours increased to `0.10` for slightly richer contextual backgrounds

| Token | Default | Tax-Time | Change |
|-------|---------|----------|--------|
| `--bg-base` | `#050505` | `#0B0B0F` | Warmer, slightly lighter |
| `--text-primary` | `0.92` opacity | `0.87` opacity | Reduced glare |
| `--text-secondary` | `0.60` opacity | `0.55` opacity | Reduced glare |
| `--accent-primary-dim` | `0.08` opacity | `0.06` opacity | Reduced glow |
| `--border-light` | `0.06` opacity | `0.07` opacity | Slightly warmer |

Theme switching uses a 200ms CSS transition on `background-color`, `color`, `border-color`, and `box-shadow` properties, applied via the `.theme-transitioning` class.

### 2.3 Light Mode

**Decision: No light mode is planned.** Financial professionals in this domain overwhelmingly use dark interfaces. The dual dark mode system (OLED Black + Tax-Time Warm) covers the use cases. If light mode is required in future, design a separate palette from scratch rather than inverting the dark palette.

### 2.4 WCAG 2.1 AA Contrast Verification

All text colour / background combinations must meet:
- **4.5:1** minimum for normal text (< 18px regular, < 14px bold)
- **3:1** minimum for large text (>= 18px regular, >= 14px bold)
- **3:1** minimum for UI components and graphical objects

Verified critical pairs:

| Foreground | Background | Ratio | Pass? |
|------------|-----------|-------|-------|
| `--text-primary` (0.92 white) | `#050505` | 17.1:1 | Yes |
| `--text-secondary` (0.60 white) | `#050505` | 9.8:1 | Yes |
| `--text-tertiary` (0.40 white) | `#050505` | 5.9:1 | Yes |
| `--text-muted` (0.20 white) | `#050505` | 2.6:1 | **Fail** -- decorative only |
| `#00F5FF` (cyan) | `#050505` | 12.5:1 | Yes |
| `#FF4444` (error) | `#050505` | 5.5:1 | Yes (borderline for small text) |
| `#F87171` (compliance-risk) | `#050505` | 5.5:1 | Yes |
| `--text-primary` (0.87) | `#0B0B0F` (Tax-Time) | 15.4:1 | Yes |

**Note:** `--text-muted` (2.6:1) intentionally fails AA. It is used ONLY for decorative/non-essential text (disclaimers that are also available in other formats). Never use `--text-muted` for information a user needs to read to complete a task.

---

## 3. Typography

### 3.1 Font Families

| Role | Family | CSS Variable | Fallback Stack |
|------|--------|-------------|----------------|
| UI / Editorial | Geist | `--font-sans` | `'Inter', system-ui, -apple-system, sans-serif` |
| Data / Numbers | JetBrains Mono | `--font-mono` | `'SF Mono', 'Fira Code', monospace` |

Both fonts are loaded via `next/font/google` with `display: "swap"` to prevent FOIT.

Rationale:
- **Geist** is a modern professional sans-serif designed for UI. Excellent legibility at small sizes, geometric construction conveys precision.
- **JetBrains Mono** provides tabular numerals by default, ensuring dollar amounts align vertically in tables and cards. The slightly wider letter-spacing improves scanning of long number strings.

### 3.2 Typographic Scale (1.25 Ratio -- Major Third)

Base size: 16px (1rem). Scale factor: 1.25.

| Level | Class | Size (rem) | Size (px) | Weight | Line Height | Letter Spacing | Use |
|-------|-------|-----------|-----------|--------|-------------|----------------|-----|
| Display | `.typo-display` | clamp(2, 5vw, 3) | 32-48 | 200 | 1.1 | -0.02em | Page hero titles |
| Headline | `.typo-headline` | clamp(1.5, 3vw, 2) | 24-32 | 300 | 1.2 | -0.01em | Section headings (h1) |
| Title | `.typo-title` | 1.125 | 18 | 400 | 1.3 | 0 | Card headings (h2) |
| Subtitle | `.typo-subtitle` | 0.875 | 14 | 300 | 1.5 | 0 | Card descriptions |
| Body | `.typo-body` | 1.0 | 16 | 300 | 1.6 | 0 | Paragraph text |
| Label MD | `.typo-label-md` | 0.8125 | 13 | 400 | 1.4 | 0 | Section labels |
| Label | `.typo-label` | 0.6875 | 11 | 400 | 1.4 | 0.2em | Uppercase labels |
| Caption | `.typo-caption` | 0.625 | 10 | 500 | 1.4 | 0.3em | Uppercase metadata |

### 3.3 Data Typography (Monospace)

Financial data uses JetBrains Mono with `font-variant-numeric: tabular-nums` for column alignment.

| Class | Size (rem) | Weight | Spacing | Use |
|-------|-----------|--------|---------|-----|
| `.typo-data` | 1.0 | 400 | 0 | Inline dollar amounts |
| `.typo-data-lg` | 1.5 | 500 | -0.02em | Card stat values |
| `.typo-data-xl` | clamp(2, 5vw, 2.5) | 500 | -0.03em | Hero metrics |
| `.typo-stat` | clamp(2.5, 6vw, 3.5) | 300 | -0.03em | Dashboard headline numbers |

### 3.4 Heading Hierarchy (Semantic HTML)

| Element | Maps to | Additional Rules |
|---------|---------|-----------------|
| `<h1>` | `.typo-headline` | One per page, colour `--text-primary` |
| `<h2>` | `.typo-title` | Section headings within page |
| `<h3>` | `.typo-label-md` + semibold | Sub-section headings |
| `<h4>` | `.typo-label` | Uppercase group labels |
| `<h5>` | `.typo-caption` | Metadata headings |
| `<h6>` | `.typo-caption` + reduced size | Rarely used |

### 3.5 Tax Number Formatting Guidelines

| Format | Example | CSS | Notes |
|--------|---------|-----|-------|
| Currency (AUD) | `$142,500` | `font-family: var(--font-mono); font-variant-numeric: tabular-nums` | Use `Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' })` |
| Percentage | `43.5%` | Monospace, no space before `%` | One decimal place for tax rates |
| ABN | `51 824 753 556` | Monospace, groups of 2-3-3-3 | Standard ABN formatting |
| TFN | Never displayed | N/A | TFN must never appear in the UI |
| Date | `30 Jun 2025` | Sans-serif | Australian date format, no leading zeros |
| Financial Year | `FY2024-25` | Sans-serif, no space | Always `FY` prefix, 4-digit start, 2-digit end |
| Count | `12,236` | Monospace with commas | Use `Intl.NumberFormat('en-AU')` |

---

## 4. Grid System & Spacing

### 4.1 8pt Base Grid

All spacing, sizing, and layout dimensions are multiples of 8px.

Exception: 4px is permitted for tight internal component spacing (icon-to-text gaps, badge padding).

| Token | Value | Usage |
|-------|-------|-------|
| `--space-xs` | `4px` | Icon gaps, badge internal padding |
| `--space-sm` | `8px` | Tight component spacing, nav item gaps |
| `--space-md` | `16px` | Standard content padding, list item gaps |
| `--space-lg` | `24px` | Card padding, section gaps |
| `--space-xl` | `32px` | Page padding, major section margins |
| `--space-2xl` | `48px` | Hero spacing, page top padding |
| `--space-3xl` | `64px` | Maximum section separation |

Extended scale for layout-level spacing: `96px`, `128px` (used sparingly for hero sections or full-bleed separators).

### 4.2 Responsive Breakpoints

| Name | Width | Columns | Gutter | Margin | Behaviour |
|------|-------|---------|--------|--------|-----------|
| Mobile | 375px+ | 4 | 16px | 16px | Single column, bottom nav visible, sidebar hidden |
| Tablet | 768px+ | 8 | 24px | 24px | Collapsed sidebar (72px), 2-col grids |
| Desktop | 1024px+ | 12 | 24px | 32px | Full sidebar, 3-col feature grids |
| Wide | 1280px+ | 12 | 32px | 48px | Max content width 1400px, centered |
| Ultra-wide | 1440px+ | 12 | 32px | auto | Content stays at 1400px, extra margin |

### 4.3 Column Grid (12-Column)

The primary layout uses a 12-column grid with these standard spans:

| Span | Columns | Use |
|------|---------|-----|
| `.span-4` | 4/12 (33%) | Stat cards in 3-up layout |
| `.span-6` | 6/12 (50%) | Half-width panels, asymmetric 50/50 |
| `.span-8` | 8/12 (67%) | Main content in sidebar layouts |
| `.span-12` | 12/12 (100%) | Full-width sections |

Asymmetric layouts are preferred for visual interest:
- `2fr 3fr` (40/60) -- Filter sidebar + main content
- `3fr 2fr` (60/40) -- Main content + side panel
- `3fr 7fr` (30/70) -- Narrow nav + wide content

### 4.4 Bento Grid Patterns

The dashboard uses a "bento grid" approach: cards of varying sizes arranged in a unified grid.

| Pattern | Class | Columns | Use |
|---------|-------|---------|-----|
| Stats row | `.bento-grid--stats` | `repeat(auto-fit, minmax(180px, 1fr))` | KPI stat cards |
| Feature row | `.bento-grid--features` | `repeat(3, 1fr)` | Action cards (3-up desktop, 1-up mobile) |
| Mixed | `.bento-grid--mixed` | `repeat(12, 1fr)` | Flexible layouts with span classes |

### 4.5 Content Width Constraints

| Context | Max Width | Rationale |
|---------|-----------|-----------|
| Main content area | 1400px | Prevents overly wide lines on ultra-wide monitors |
| Readable text block | 640px | Optimal 65-75 characters per line |
| Form fields | 480px | Comfortable single-column form width |
| Modal dialogs | 560px | Focus attention without feeling cramped |

### 4.6 Component Sizing Rules

| Element | Minimum Size | Standard Size | Rationale |
|---------|-------------|---------------|-----------|
| Touch/click targets | 44px | 48px | WCAG 2.5.5 (44px minimum) |
| Sidebar icon buttons | 44px | 44px | Consistent clickable area |
| Sidebar width (collapsed) | -- | 72px | 8pt grid: 72 = 9 * 8 |
| Sidebar width (expanded) | -- | 260px | Comfortable label + icon |
| Mobile bottom nav height | -- | 64px | 8pt grid: 64 = 8 * 8 |
| Form input height | 44px | 40px (desktop) / 44px (mobile) | Touch target compliance |

---

## 5. Component Design Language

### 5.1 Cards

Cards are the primary content container. They use minimal decoration: translucent backgrounds, ultra-thin borders, and consistent padding.

| Property | Value | Notes |
|----------|-------|-------|
| Background | `var(--bg-card)` -- `rgba(255,255,255,0.02)` | Near-invisible tint |
| Border | `0.5px solid var(--border-light)` | Single sub-pixel line |
| Border radius | `var(--radius-sm)` -- `2px` | Barely rounded, sharp and precise |
| Padding | `var(--space-lg)` -- `24px` | Standard; `16px` for compact, `32px` for large |
| Hover | `border-color: var(--border-medium)` | Subtle border brightening |
| Transition | `border-color var(--transition-base)` | 250ms smooth |

#### Card Variants

| Variant | Class | Distinction |
|---------|-------|------------|
| Standard | `.card` | Base card styling |
| Stat | `.stat-card` | Flex column, label + value + trend layout |
| Feature | `.feature-card` | Clickable, icon + title + description + action |
| Glass | `.glass-card` | `backdrop-filter: blur(20px)` for floating panels |
| Holo | `.holo-panel` | Spectral gradient top border (1px) |

#### Stat Card Accent Borders

Left-border accent (2px) for category differentiation:
- `.stat-card.accent` -- `--color-success` (green)
- `.stat-card.warning` -- `--color-warning` (amber)
- `.stat-card.danger` -- `--color-error` (red)
- `.stat-card.xero` -- `--color-xero` (Xero blue)

### 5.2 Buttons

Buttons use uppercase text, wide letter-spacing, and subtle glow effects on primary actions.

| Property | Value |
|----------|-------|
| Height | Auto (padding-based) -- minimum 44px on mobile |
| Padding | `8px 16px` (desktop), `16px 24px` (mobile) |
| Border radius | `var(--radius-sm)` -- `2px` |
| Font | `0.6875rem` (11px), weight 500, uppercase, `letter-spacing: 0.15em` |
| Transition | `all var(--transition-fast)` (150ms) |

#### Button Hierarchy

| Level | Class | Background | Text | Effect |
|-------|-------|-----------|------|--------|
| Primary | `.btn-primary` | `--accent-primary` (cyan) | `--text-inverse` (black) | Cyan glow on hover |
| Secondary | `.btn-secondary` | Transparent | `--text-secondary` | Border turns cyan on hover |
| Ghost | `.btn-ghost` | Transparent | `--text-tertiary` | Subtle bg on hover |
| Danger | (to be defined) | `--color-error` | `--text-inverse` | Red glow on hover |
| Xero | `.btn-xero` | `--color-xero` | `--text-inverse` | Blue glow on hover |
| MYOB | `.btn-myob` | `--color-myob` | `--text-inverse` | Teal glow on hover |
| Success | `.btn-success` | `--color-success` | `--text-inverse` | Green glow on hover |
| Disabled | `.btn:disabled` | Inherited | 30% opacity | `cursor: not-allowed` |

Glow effect: `box-shadow: 0 0 30px rgba(accent, 0.20)` at rest, expanding to `50px 0.35` on hover. This is the primary "luxury" interaction.

### 5.3 Form Inputs

| Property | Value |
|----------|-------|
| Height | Auto (padding `8px 16px`), minimum 44px on mobile |
| Background | `rgba(255,255,255,0.02)` |
| Border | `0.5px solid var(--border-light)` |
| Border radius | `var(--radius-sm)` -- `2px` |
| Font size | `0.875rem` (14px) -- `16px` on mobile to prevent iOS zoom |
| Focus state | `border-color: var(--accent-primary)`, `box-shadow: 0 0 20px rgba(0,245,255,0.10)` |
| Placeholder colour | `var(--text-muted)` |
| Error state | `border-color: var(--color-error)`, error message below in `--color-error` |

Select elements use a custom chevron SVG (white, 40% opacity) positioned at `right: 12px`.

### 5.4 Data Visualisation Style

All charts use Recharts. Consistency rules:

| Element | Specification |
|---------|--------------|
| Grid lines | `strokeDasharray="3 3"`, `stroke="var(--border-light)"`, vertical lines hidden |
| Axis lines | `stroke="var(--border-light)"` |
| Axis tick text | `fill="var(--text-tertiary)"`, `fontSize: 10` |
| Tooltip background | `var(--bg-subtle)` with `0.5px solid var(--border-medium)` border |
| Tooltip text | `var(--text-primary)`, `fontSize: 0.75rem` |
| Bar radius | `[2, 2, 0, 0]` (rounded top corners only) |
| Max bar width | 60px |
| Line stroke width | 2px |
| Area fill opacity | 0.1 |
| Series colours | Use `--chart-1` through `--chart-6` in order |

#### Chart Accessibility Wrapper

Every chart MUST be wrapped in `<AccessibleChart>` providing:
- `role="img"` with descriptive `aria-label`
- Hidden `<table>` with `.sr-only` class containing all data points
- Column definitions for screen reader table navigation

### 5.5 Tables

| Property | Value |
|----------|-------|
| Container | `.table-container` with `var(--bg-card)` background, `0.5px` border |
| Header | `rgba(255,255,255,0.02)` background, uppercase 9px labels, `0.3em` letter-spacing |
| Cell padding | `16px 24px` |
| Row border | `0.5px solid var(--border-light)` between rows |
| Hover | `rgba(255,255,255,0.02)` background on entire row |
| No striping | Rows are uniform; hover provides differentiation |
| Mobile | Horizontally scrollable container with custom thin scrollbar |

### 5.6 Badges & Tags

Badges are small, uppercase, pill-shaped labels used for status, category, and priority indicators.

| Property | Value |
|----------|-------|
| Padding | `2px 8px` |
| Border radius | `var(--radius-sm)` -- `2px` |
| Font | `0.5625rem` (9px), weight 500, uppercase, `letter-spacing: 0.15em` |
| Background | Semantic dim colour (8% opacity tint) |
| Text colour | Semantic full colour |

Variants: `--success`, `--warning`, `--error`, `--info`, `--purple`, `--xero`

#### Priority Badges

| Priority | Background | Text |
|----------|-----------|------|
| Low | `--color-success-dim` | `--color-success` |
| Medium | `--color-warning-dim` | `--color-warning` |
| High | `rgba(255,184,0,0.12)` | `#FFB800` |
| Critical | `--color-error-dim` | `--color-error` |

#### Compliance Badges

| Status | Background | Text |
|--------|-----------|------|
| OK | `--compliance-ok-dim` | `--compliance-ok` |
| Warning | `--compliance-warn-dim` | `--compliance-warn` |
| Risk | `--compliance-risk-dim` | `--compliance-risk` |

### 5.7 Meter/Gauge Design (OffsetMeter)

The SVG arc gauge is used for tax offsets, cap usage, and threshold tracking.

| Property | Value |
|----------|-------|
| Arc sweep | 270 degrees (135 to 405) |
| Background arc | `stroke="var(--border-light)"` |
| Fill colour | Dynamic: green (<60%), amber (60-85%), red (>85%) |
| Stroke cap | `round` |
| Centre value | Monospace, weight 400 |
| Label | Uppercase, positioned below arc |
| Status badge | Compliance badge below label |
| Sizes | sm: 120px, md: 160px, lg: 200px |

All meters use `role="meter"` with `aria-valuenow`, `aria-valuemin`, `aria-valuemax`, and a descriptive `aria-label`.

### 5.8 Alerts

| Property | Value |
|----------|-------|
| Layout | Flex row, icon + text |
| Padding | `16px 24px` |
| Border | `0.5px solid` at 20% opacity of semantic colour |
| Background | Semantic dim colour |
| Text colour | Semantic full colour |
| Border radius | `var(--radius-sm)` |

Variants: `--success`, `--warning`, `--error`, `--info`

### 5.9 Data Strips

Horizontal data rows with a left colour accent, used for lists of findings, completions, or analysis items.

| Property | Value |
|----------|-------|
| Layout | Flex row with `gap: 16px` |
| Background | `var(--bg-card)` |
| Left border | `2px solid` in priority/category colour |
| Padding | `16px 24px` |
| Hover | `border-color: var(--border-medium)` (right/top/bottom only) |

Variants by priority: `--critical` (red), `--high` (amber), `--medium` (amber), `--success` (green), `--info` (cyan), `--xero` (Xero blue), `--ai` (accent cyan)

---

## 6. Motion & Transitions ("Seamless Ledger")

### 6.1 Philosophy

Motion in the ATO Tax Optimizer serves function, not decoration. Every animation should either:
1. Provide spatial context (where did this element come from?)
2. Reduce perceived latency (something is happening)
3. Draw attention to a state change (a value updated)

The "Seamless Ledger" principle: navigating between modules should feel like a single continuous surface sliding to reveal new content, not separate pages loading.

### 6.2 Timing Functions

| Token | Value | Use |
|-------|-------|-----|
| `--transition-fast` | `150ms cubic-bezier(0.19, 1, 0.22, 1)` | Hover effects, button press |
| `--transition-base` | `250ms cubic-bezier(0.19, 1, 0.22, 1)` | Border changes, color shifts |
| `--transition-slow` | `400ms cubic-bezier(0.19, 1, 0.22, 1)` | Progress bar fills, panel reveals |

The shared easing `cubic-bezier(0.19, 1, 0.22, 1)` provides a smooth deceleration curve that feels physical and intentional. It overshoots slightly (value > 1 in y2) for a subtle spring-like quality.

For Framer Motion components, use `ease: [0.23, 1, 0.32, 1]` which is the equivalent cubic-bezier.

### 6.3 Page Transitions

| Event | Animation | Duration | Easing |
|-------|-----------|----------|--------|
| Page enter | Fade in + translate Y 10px | 400ms | `cubic-bezier(0.19, 1, 0.22, 1)` |
| Page exit | Fade out | 200ms | `ease-out` |
| Section enter | Slide up 20px + fade in | 500ms | Same curve |

Stagger delay for sequential elements: 100ms increments (`.stagger-1` through `.stagger-5`).

### 6.4 Component Animations

| Interaction | Animation | Duration |
|-------------|-----------|----------|
| Card hover | Border colour transition | 250ms |
| Button press | `transform: scale(0.98)` | 150ms |
| Button hover (primary) | Glow expansion (30px to 50px) | 150ms |
| Nav item hover | Background fade in | 150ms |
| Feature card hover | Arrow gap widens (6px to 10px) | 150ms |
| Dynamic Island enter | Fade in + translate Y -20px | 600ms |
| Alert enter/exit | Fade + translate Y 20px | 300ms |
| Badge appear | Fade in | 200ms |

### 6.5 Loading States

**Primary: Skeleton screens, not spinners.**

Skeleton animation: horizontal shimmer using `background-size: 200%` gradient sweep.
- Base: `rgba(255,255,255,0.02)`
- Peak: `rgba(255,255,255,0.05)`
- Duration: 1.5s infinite ease-in-out
- Border radius: `var(--radius-sm)`

**Secondary: Spinner (used only for initial page load)**

- Size: 40px
- Border: `1px solid var(--border-light)`, top border `var(--accent-primary)`
- Animation: `spin 1s linear infinite`

### 6.6 Number Animations

Dollar amounts and counts use the `AnimatedCounter` component:
- Count-up from 0 to target value
- Duration: proportional to magnitude (500ms for small numbers, 1200ms for large)
- Easing: ease-out deceleration
- Format: currency or number via `Intl.NumberFormat`

### 6.7 Reduced Motion

All animations respect `prefers-reduced-motion: reduce`:
- Disable all transform animations
- Keep opacity transitions (instant, no timing)
- Skip number count-up (show final value immediately)
- Skeleton shimmer: static background, no animation

Implementation: wrap motion in `@media (prefers-reduced-motion: no-preference) { }` or use Framer Motion's `useReducedMotion()` hook.

### 6.8 Theme Transition

When switching between OLED Black and Tax-Time modes:
- `.theme-transitioning` class applied to `<html>` for 200ms
- Transitions `background-color`, `color`, `border-color`, `box-shadow`
- Uses `!important` to override component-level transitions temporarily

---

## 7. Layout Templates

### 7.1 Dashboard (Bento Grid)

```
+--------------------------------------------------+
| [Dynamic Island Navigation Bar]                   |
+--------------------------------------------------+
| [LIVE DATA Banner]                                |
+--------------------------------------------------+
| [Stat] [Stat] [Stat] [Stat] [Stat]              |
+--------------------------------------------------+
| [Feature Card] [Feature Card] [Feature Card]      |
+--------------------------------------------------+
| [Organisation Groups]                             |
+--------------------------------------------------+
| [Platform Connections]                            |
+--------------------------------------------------+
| [TaxDisclaimer -- sticky footer]                  |
+--------------------------------------------------+
```

- VerticalNav sidebar (72px) on left, hidden on mobile
- Main content offset by `margin-left: 72px`
- Top padding accounts for Dynamic Island height (~60px + spacing)
- Maximum content width: 1400px

### 7.2 Analysis Pages

```
+------+-------------------------------------------+
|      | [Page Title + Breadcrumb]                 |
|      +-------------------------------------------+
| Side | [Filter Controls / Entity Selector]       |
| bar  +-------------------------------------------+
| 72px | [Primary Visualisation]                   |
|      +-------------------------------------------+
|      | [Data Table / Detail List]                |
|      +-------------------------------------------+
|      | [TaxDisclaimer]                           |
+------+-------------------------------------------+
```

For pages with their own sidebar (e.g., Accountant Workflow):
- Wide sidebar (260px) on left, collapses to 72px on tablet
- Main content offset by `margin-left: 260px`

### 7.3 Calendar Page

```
+------+-------------------------------------------+
|      | [Month Navigation + Entity Filter]        |
|      +-------------------------------------------+
| Side | [Month Grid -- Full Width]                |
| bar  | [Mon] [Tue] [Wed] [Thu] [Fri] [Sat] [Sun]|
| 72px | [...] [...] [...] [...] [...] [...] [...]  |
|      +-------------------------------------------+
|      | [Upcoming Deadlines List]                 |
+------+-------------------------------------------+
```

- Calendar grid is full-width within the main content area
- Entity colour coding via left-border accent on deadline dots
- Arrow key navigation between days (WAI-ARIA grid pattern)

### 7.4 Settings / Configuration Pages

```
+------+-------------------------------------------+
|      | [Settings -- Page Title]                  |
|      +-------------------------------------------+
| Side | [Section: Account]                        |
| bar  |   [Form field]                            |
| 72px |   [Form field]                            |
|      +-------------------------------------------+
|      | [Section: Connections]                     |
|      |   [Connection card]                       |
|      |   [Connection card]                       |
|      +-------------------------------------------+
|      | [Section: Preferences]                    |
|      |   [Toggle] [Toggle]                       |
+------+-------------------------------------------+
```

- Stacked sections with clear visual separation (`--space-2xl` between sections)
- Section headings use `.typo-headline`
- Form max-width: 640px for readability

### 7.5 Mobile Layout

```
+--------------------------------------------------+
| [Dynamic Island -- Full Width, No Radius]         |
+--------------------------------------------------+
| [Content -- Single Column]                        |
|                                                   |
| [Cards stack vertically]                          |
| [Grids collapse to 1 column]                     |
| [Tables scroll horizontally]                     |
|                                                   |
+--------------------------------------------------+
| [Mobile Bottom Nav -- Fixed]                      |
+--------------------------------------------------+
```

- Sidebar hidden entirely
- All content full-width with `16px` padding
- Bottom nav uses 44px touch targets
- Bottom padding includes `env(safe-area-inset-bottom)` for notched devices
- Collapsible sections where applicable to reduce scrolling

---

## 8. Iconography

### 8.1 Icon Library

The application uses **Lucide React** for all icons.

| Property | Value |
|----------|-------|
| Default size | 16px (inline with text), 18px (nav items), 24px (feature cards) |
| Stroke width | Default (2px) |
| Colour | Inherits from parent `color` property |

### 8.2 Icon Usage Rules

1. Icons must ALWAYS be accompanied by text (visible or `aria-label`)
2. Icon-only buttons require `title` attribute and `aria-label`
3. Decorative icons use `aria-hidden="true"`
4. Status icons pair with compliance colours: checkmark (green), warning triangle (amber), X mark (red)

---

## 9. Shadows & Elevation

The application uses minimal shadows. On OLED black backgrounds, traditional drop shadows are nearly invisible. Instead, elevation is communicated through:

1. **Border opacity** -- Higher opacity = more elevated
2. **Background translucency** -- More opaque = more elevated
3. **Backdrop blur** -- Glass effect for floating elements

Shadow tokens exist for rare use cases (tooltips, dropdown menus):

| Token | Value | Use |
|-------|-------|-----|
| `--shadow-sm` | `0 1px 2px rgba(0,0,0,0.4)` | Subtle lift |
| `--shadow-md` | `0 2px 8px rgba(0,0,0,0.5)` | Dropdowns |
| `--shadow-lg` | `0 4px 16px rgba(0,0,0,0.6)` | Modals |
| `--shadow-xl` | `0 8px 32px rgba(0,0,0,0.7)` | Large floating panels |
| `--shadow-inner` | `inset 0 1px 2px rgba(0,0,0,0.3)` | Inset containers |

---

## 10. Border Radius

The design uses intentionally minimal border radius throughout. Sharp geometry conveys precision and professionalism appropriate to financial software.

| Token | Value | Use |
|-------|-------|-----|
| `--radius-sm` | `2px` | Cards, inputs, buttons, badges |
| `--radius-md` | `2px` | Same as sm (intentional uniformity) |
| `--radius-lg` | `2px` | Same as sm |
| `--radius-xl` | `2px` | Same as sm |
| `--radius-2xl` | `2px` | Same as sm |
| `--radius-full` | `9999px` | Avatars, logo containers, pill shapes |

**Design decision:** All rectangular containers share the same 2px radius. This creates visual cohesion. Only truly circular elements (avatars, logos) use `--radius-full`. The LIVE DATA banner and some mobile elements may use 12-20px radius as exceptions for a softer feel, but these should be migrated to 2px for consistency.

---

## 11. Accessibility Checklist

Every component and page must satisfy:

- [ ] **Colour contrast:** All text meets 4.5:1 (normal) or 3:1 (large) against its background
- [ ] **No colour-only info:** Status conveyed via icon + colour + text label
- [ ] **Keyboard navigation:** All interactive elements reachable via Tab; logical focus order
- [ ] **Focus indicators:** 2px solid `--accent-primary` ring via `:focus-visible`, 2px offset
- [ ] **Screen reader support:** Meaningful `aria-label` on non-text elements
- [ ] **Chart accessibility:** Wrapped in `<AccessibleChart>` with hidden data table
- [ ] **Touch targets:** Minimum 44px width and height on mobile
- [ ] **Skip link:** `.skip-link` present at top of dashboard layout
- [ ] **Dynamic content:** `aria-live="polite"` on values that update asynchronously
- [ ] **Reduced motion:** All animations disabled when `prefers-reduced-motion: reduce`
- [ ] **Financial values:** Currency formatted with `Intl.NumberFormat`, full text (not "$10k")
- [ ] **Time-sensitive content:** Deadlines announced via both visual indicator and `aria-live`

---

## 12. Disclaimer Styling Specification

The legal disclaimer (TaxDisclaimer component) must appear on every page showing tax recommendations or dollar estimates. Its styling must balance legal visibility with not disrupting the user experience.

| Property | Minimum Requirement |
|----------|-------------------|
| Font size | 12px (`text-xs`) minimum -- NOT 10px |
| Text opacity | 60% (`--text-secondary`) minimum -- NOT 20% |
| Positioning | Sticky footer or inline at page bottom |
| Prefix | "DISCLAIMER:" in bold, slightly brighter colour (`--text-tertiary`) |
| Icon | Info icon (Lucide `Info`), 16px, colour `--text-muted` |
| Border | Top border `0.5px solid var(--border-light)` for sticky variant |
| Background | `var(--bg-base)` for sticky variant |

**Critical note from compliance audit:** The current `text-[10px] text-white/30` styling was flagged as functionally invisible. These minimums are non-negotiable.

---

## 13. File Reference

| File | Purpose |
|------|---------|
| `app/globals.css` | All CSS custom properties and component classes |
| `app/layout.tsx` | Font loading (Geist, JetBrains Mono), theme init script |
| `components/ui/ThemeToggle.tsx` | Theme switcher (default / tax-time) |
| `components/ui/DynamicIsland.tsx` | Floating nav bar |
| `components/ui/AccessibleChart.tsx` | Chart accessibility wrapper |
| `components/dashboard/TaxDisclaimer.tsx` | Legal disclaimer component |
| `lib/config/navigation.ts` | Navigation item definitions |
| `components/projections/OffsetMeter.tsx` | SVG arc gauge component |
| `components/tax/TaxBracketWaterfall.tsx` | Tax bracket bar chart |

---

## Appendix A: CSS Variable Quick Reference

```css
/* Backgrounds */
--bg-base, --bg-subtle, --bg-card, --bg-card-hover, --bg-tertiary

/* Accent */
--accent-primary, --accent-primary-light, --accent-primary-dim, --accent-primary-glow
--accent-secondary, --accent-tertiary

/* Semantic */
--color-success, --color-warning, --color-error, --color-info
--color-{name}-light, --color-{name}-dim

/* Compliance */
--compliance-ok, --compliance-warn, --compliance-risk
--compliance-{name}-dim

/* Brand */
--color-xero, --color-myob, --color-indigo

/* Text */
--text-primary, --text-secondary, --text-tertiary, --text-muted, --text-inverse

/* Borders */
--border-light, --border-medium, --border-strong

/* Shadows */
--shadow-sm, --shadow-md, --shadow-lg, --shadow-xl, --shadow-inner

/* Spacing */
--space-xs (4), --space-sm (8), --space-md (16), --space-lg (24)
--space-xl (32), --space-2xl (48), --space-3xl (64)

/* Radius */
--radius-sm (2px), --radius-full (9999px)

/* Typography */
--font-sans, --font-mono

/* Transitions */
--transition-fast (150ms), --transition-base (250ms), --transition-slow (400ms)

/* Layout */
--sidebar-width (72px), --sidebar-wide-width (260px)
--touch-target-min (44px), --mobile-nav-height (64px)

/* Charts */
--chart-1 through --chart-6
```

---

*End of Design System v1.0*
