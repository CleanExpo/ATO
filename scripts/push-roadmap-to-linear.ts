#!/usr/bin/env tsx
/**
 * Push V1 Finalization & V2 Roadmap to Linear
 *
 * Creates Linear issues from the comprehensive roadmap with:
 * - Proper priorities (P0-P3 → Linear 1-4)
 * - Milestone/project assignments
 * - Rich descriptions with file paths and effort estimates
 * - Labels for tracking (v1-finalization, v2.0, v2.1, v2.2, v2.3)
 *
 * Usage: tsx scripts/push-roadmap-to-linear.ts
 */

import { createLinearClient, mapPriorityToLinear } from '@/lib/linear/api-client';
import { serverConfig } from '@/lib/config/env';

interface RoadmapIssue {
  title: string;
  description: string;
  priority: 'P0' | 'P1' | 'P2' | 'P3';
  milestone: string;
  labels: string[];
  effort?: string;
  risk?: string;
  criticalFiles?: string[];
}

// V1 Finalization Issues (10 critical areas)
const v1Issues: RoadmapIssue[] = [
  {
    title: 'V1: Security & Compliance',
    description: `## Priority: CRITICAL

**Current Gaps:**
- Admin endpoints missing role authorization checks
- No centralized error tracking (Sentry TODO comments only)
- CSRF protection not enforced on state-changing operations
- 496 console.log statements exposing sensitive data in production

**Required Actions:**
- [ ] Implement \`requireAdminRole()\` middleware for all \`/api/admin/*\` routes
- [ ] Complete Sentry integration (remove TODO at \`app/error.tsx:22-25\`)
- [ ] Add CSRF token validation for POST/PUT/DELETE operations
- [ ] Remove all console.log statements from production builds
- [ ] Add rate limiting to authentication endpoints (prevent brute force)
- [ ] Implement audit logging for admin actions (accountant approval/rejection)

**Critical Files:**
- \`app/api/admin/accountant-applications/[id]/approve/route.ts\` (Line 195-197)
- \`app/api/admin/accountant-applications/[id]/reject/route.ts\` (Line 137-138)
- \`app/api/admin/toggle-admin/route.ts\` (Line 64-66)
- \`middleware.ts\` (add role checking)
- \`app/error.tsx\` (Line 22-25)

**Effort:** 1 week
**Risk:** High (security vulnerabilities)`,
    priority: 'P0',
    milestone: 'V1 Finalization',
    labels: ['v1-finalization', 'security', 'critical'],
    effort: '1 week',
    risk: 'High',
  },
  {
    title: 'V1: Payment Integration (Revenue Blocker)',
    description: `## Priority: CRITICAL - Revenue Blocker

**Current Gap:**
Pricing page shows $995/$495 but buttons don't trigger checkout. No Stripe integration exists.

**Required Actions:**
- [ ] Implement Stripe checkout session creation (\`/api/checkout/create\`)
- [ ] Add webhook handler for \`checkout.session.completed\` event
- [ ] Create \`purchases\` table in Supabase to track transactions
- [ ] Link purchases to \`profiles\` table with license status
- [ ] Implement license verification middleware for gated features
- [ ] Add subscription management (upgrade/downgrade/cancel)
- [ ] Create billing history page in dashboard
- [ ] Handle failed payments and retry logic

**Critical Files:**
- \`app/dashboard/pricing/page.tsx\` (add checkout button handlers)
- \`app/api/checkout/create/route.ts\` (NEW - create Stripe session)
- \`app/api/webhooks/stripe/route.ts\` (NEW - handle payment events)
- \`supabase/migrations/004_create_purchases.sql\` (NEW)
- \`lib/stripe/client.ts\` (NEW)
- \`middleware.ts\` (add license verification)

**Effort:** 1 week
**Risk:** High (no revenue without this)`,
    priority: 'P0',
    milestone: 'V1 Finalization',
    labels: ['v1-finalization', 'payments', 'revenue-blocker', 'critical'],
    effort: '1 week',
    risk: 'High',
  },
  {
    title: 'V1: Email Notifications',
    description: `## Priority: HIGH - User Experience

**Current Gap:**
Multiple TODO comments indicate emails not being sent:
- Accountant application approval/rejection
- Welcome emails with magic links
- Recommendation alerts

**Required Actions:**
- [ ] Complete Resend email templates for all notification types
- [ ] Implement transactional email queue (prevent blocking API responses)
- [ ] Add email preferences management (allow users to opt-out)
- [ ] Create email delivery status tracking
- [ ] Implement retry logic for failed deliveries
- [ ] Add email open/click tracking (optional, for engagement metrics)

**Critical Files:**
- \`app/api/admin/accountant-applications/[id]/approve/route.ts\` (Line 195-197)
- \`app/api/admin/accountant-applications/[id]/reject/route.ts\` (Line 137-138)
- \`lib/email/templates/\` (NEW directory)
- \`lib/email/queue.ts\` (NEW - background job processing)

**Effort:** 2-3 days
**Risk:** Medium (poor UX, low user retention)`,
    priority: 'P1',
    milestone: 'V1 Finalization',
    labels: ['v1-finalization', 'email', 'ux'],
    effort: '2-3 days',
    risk: 'Medium',
  },
  {
    title: 'V1: Data Quality & Real-Time Charts (Trust Destroyer)',
    description: `## Priority: HIGH - Trust Destroyer

**Current Gap:**
Dashboard charts use \`Math.random()\` for mock data in 10+ files. This destroys user trust.

**Mock Data Files Found:**
- \`app/dashboard/overview/page.tsx\` (Line 305)
- \`app/dashboard/rnd/page.tsx\` (Line 289)
- \`app/dashboard/deductions/page.tsx\` (Line 234)
- \`app/dashboard/losses/page.tsx\` (Line 267)
- \`components/charts/TaxSavingsChart.tsx\` (Line 45)
- \`components/charts/ComplianceScoreChart.tsx\` (Line 38)
- And 4+ more...

**Required Actions:**
- [ ] Replace all \`Math.random()\` with real Supabase queries
- [ ] Create materialized views for expensive aggregations
- [ ] Implement incremental data refresh (only fetch changed data)
- [ ] Add loading states and skeleton screens for better perceived performance
- [ ] Handle empty state explicitly ("No data available" instead of random values)
- [ ] Add data freshness indicators ("Last updated 5 minutes ago")

**Critical Files:**
- All files in \`app/dashboard/*/page.tsx\`
- All files in \`components/charts/*.tsx\`
- \`lib/reports/dashboard-data-fetcher.ts\` (NEW - centralized data layer)

**Effort:** 1 week
**Risk:** High (user trust, compliance audits)`,
    priority: 'P1',
    milestone: 'V1 Finalization',
    labels: ['v1-finalization', 'data-quality', 'charts', 'trust'],
    effort: '1 week',
    risk: 'High',
  },
  {
    title: 'V1: Testing Infrastructure (Technical Debt)',
    description: `## Priority: HIGH - Technical Debt

**Current Gap:**
Only 2 test files exist (\`lib/analysis/rnd-engine.test.ts\`, \`lib/tax-data/rate-loader.test.ts\`) despite 40+ tax calculation rules and 107+ API endpoints.

**Required Actions:**
- [ ] Implement API route integration tests (Jest + Supertest)
- [ ] Add unit tests for all tax calculation engines (target: 80% coverage)
- [ ] Create E2E tests for critical user flows (Playwright)
  - Xero connection flow
  - R&D assessment workflow
  - Recommendation approval/rejection
  - Payment checkout flow
- [ ] Set up CI/CD pipeline with automated test runs
- [ ] Add test fixtures for realistic tax scenarios
- [ ] Implement snapshot testing for PDF/Excel report generation

**Critical Files:**
- \`__tests__/api/\` (NEW directory)
- \`__tests__/integration/\` (NEW directory)
- \`__tests__/e2e/\` (NEW directory)
- \`jest.config.js\` (configure coverage thresholds)
- \`playwright.config.ts\` (NEW - E2E test configuration)

**Effort:** 3 weeks
**Risk:** High (regressions, production bugs)`,
    priority: 'P1',
    milestone: 'V1 Finalization',
    labels: ['v1-finalization', 'testing', 'technical-debt'],
    effort: '3 weeks',
    risk: 'High',
  },
  {
    title: 'V1: Performance Optimization',
    description: `## Priority: MEDIUM

**Current Issues:**
- 496 console.log statements slow down production builds
- No caching strategy for tax rates (refetched on every request)
- Batch AI analysis processes 100 transactions serially (slow)
- No database query optimization (N+1 queries in report generation)

**Required Actions:**
- [ ] Remove all console.log statements from production code
- [ ] Implement Redis caching for tax rates (24-hour TTL)
- [ ] Optimize batch AI analysis to use concurrent promises (10 parallel)
- [ ] Add database indexes for common query patterns
- [ ] Implement pagination for large transaction lists
- [ ] Add compression for API responses (gzip)
- [ ] Optimize bundle size (currently 2.3MB, target: <1MB)

**Critical Files:**
- All files with console.log (94 files, 496 occurrences)
- \`lib/tax-data/cache-manager.ts\` (add Redis)
- \`lib/ai/batch-processor.ts\` (parallelize)
- \`supabase/migrations/005_add_indexes.sql\` (NEW)

**Effort:** 1 week
**Risk:** Medium (user complaints, slow dashboards)`,
    priority: 'P2',
    milestone: 'V1 Finalization',
    labels: ['v1-finalization', 'performance', 'optimization'],
    effort: '1 week',
    risk: 'Medium',
  },
  {
    title: 'V1: Documentation',
    description: `## Priority: MEDIUM

**Current Gap:**
No user-facing documentation, API documentation, or onboarding guides.

**Required Actions:**
- [ ] Create user onboarding guide (how to connect Xero, interpret recommendations)
- [ ] Write API documentation (for accountants building integrations)
- [ ] Add inline help tooltips for complex tax concepts (Division 355, COT/SBT)
- [ ] Create video tutorials for key workflows (R&D assessment, loss analysis)
- [ ] Document admin procedures (accountant vetting, support escalation)
- [ ] Write deployment guide (Vercel, Supabase, environment variables)

**Critical Files:**
- \`docs/user-guide.md\` (NEW)
- \`docs/api-reference.md\` (NEW)
- \`docs/admin-guide.md\` (NEW)
- \`docs/deployment.md\` (NEW)
- \`app/dashboard/help/page.tsx\` (NEW - in-app help center)

**Effort:** 1 week
**Risk:** Low (user confusion, support burden)`,
    priority: 'P2',
    milestone: 'V1 Finalization',
    labels: ['v1-finalization', 'documentation'],
    effort: '1 week',
    risk: 'Low',
  },
  {
    title: 'V1: MYOB & QuickBooks Integration Completion',
    description: `## Priority: MEDIUM

**Current State:**
Both integrations are ~70% complete but not production-ready.

**MYOB Gaps:**
- Historical data fetcher implemented but not tested
- OAuth flow partially complete
- No error handling for API timeouts

**QuickBooks Gaps:**
- Client implemented but not integrated with UI
- No sandbox testing environment
- Missing transaction mapping logic

**Required Actions:**
- [ ] Complete MYOB OAuth flow and test with production credentials
- [ ] Finish QuickBooks transaction mapping to match Xero schema
- [ ] Add integration testing with sandbox environments
- [ ] Create unified data adapter layer (abstract Xero/MYOB/QuickBooks differences)
- [ ] Update UI to support platform selection during onboarding
- [ ] Add data migration tools (import from one platform to another)

**Critical Files:**
- \`lib/integrations/myob-historical-fetcher.ts\` (complete OAuth)
- \`lib/integrations/quickbooks-client.ts\` (finish transaction mapping)
- \`lib/integrations/adapter.ts\` (NEW - unified interface)
- \`app/api/integrations/*/\` (NEW directory structure)

**Effort:** 2 weeks
**Risk:** Medium (market expansion opportunity)`,
    priority: 'P2',
    milestone: 'V1 Finalization',
    labels: ['v1-finalization', 'integrations', 'myob', 'quickbooks'],
    effort: '2 weeks',
    risk: 'Medium',
  },
  {
    title: 'V1: Critical Bug Fixes',
    description: `## Priority: HIGH

**Known Issues:**

1. **Recommendation Status Not Persisted** (\`app/api/audit/recommendations/[id]/route.ts:96\`)
   - User changes to "approved/rejected/pending" status lost on page refresh
   - Fix: Add database update before returning response

2. **Excel Loss Sheet Not Implemented** (\`lib/reports/excel-generator.ts:35\`)
   - Loss analysis data cannot be exported to Excel
   - Fix: Implement \`createLossesSheet()\` function

3. **Token Refresh Race Condition** (\`lib/xero/client.ts:187\`)
   - Multiple concurrent requests can trigger duplicate token refreshes
   - Fix: Add mutex lock using Redis

4. **Division 7A Interest Rate Hardcoded** (\`lib/analysis/div7a-engine.ts:23\`)
   - Rate is 8.77% but no source attribution or FY context
   - Fix: Fetch from ATO API with fallback and provenance tracking

**Effort:** 1 week
**Risk:** High (data loss, user frustration)`,
    priority: 'P1',
    milestone: 'V1 Finalization',
    labels: ['v1-finalization', 'bugs', 'critical'],
    effort: '1 week',
    risk: 'High',
  },
  {
    title: 'V1: Deployment & Monitoring',
    description: `## Priority: MEDIUM

**Current Gap:**
No production monitoring, uptime checks, or error alerting.

**Required Actions:**
- [ ] Complete Sentry integration for error tracking
- [ ] Set up Vercel Analytics for performance monitoring
- [ ] Implement uptime monitoring (UptimeRobot or Better Uptime)
- [ ] Add health check endpoints (\`/api/health\`, \`/api/status\`)
- [ ] Configure alerting rules (Slack notifications for critical errors)
- [ ] Set up database backup strategy (daily snapshots, 30-day retention)
- [ ] Create disaster recovery runbook

**Critical Files:**
- \`app/api/health/route.ts\` (NEW)
- \`sentry.client.config.ts\` (complete configuration)
- \`vercel.json\` (add analytics configuration)

**Effort:** 3 days
**Risk:** Medium (downtime, data loss)`,
    priority: 'P2',
    milestone: 'V1 Finalization',
    labels: ['v1-finalization', 'monitoring', 'deployment'],
    effort: '3 days',
    risk: 'Medium',
  },
];

// V2.0 "Revenue Accelerator" (Top 10 Features)
const v2_0Issues: RoadmapIssue[] = [
  {
    title: 'V2.0: Stripe Payment Integration',
    description: `## Revenue Blocker - CRITICAL

**Business Impact:** Revenue blocker, 2-week effort, immediate ROI
**Priority Score:** 48/50

**Implementation:**
- Stripe checkout session creation
- Webhook handling for subscription events
- License management and gating
- Subscription plans ($149/mo, $1,490/yr)

**Files:**
- \`app/api/checkout/create/route.ts\`
- \`app/api/webhooks/stripe/route.ts\`
- \`lib/stripe/client.ts\`

**Effort:** 2 weeks`,
    priority: 'P0',
    milestone: 'V2.0 Revenue Accelerator',
    labels: ['v2.0', 'payments', 'revenue'],
    effort: '2 weeks',
  },
  {
    title: 'V2.0: Enterprise Multi-Organisation Support',
    description: `## $50K+ Annual Contracts

**Business Impact:** Accountant firm adoption, enterprise sales
**Priority Score:** 46/50

**Implementation:**
- Single user manages 10+ client organisations
- Consolidated dashboard view
- Organisation switching UI
- Role-based access per organisation

**Files:**
- \`lib/organisations/multi-org-manager.ts\`
- \`app/dashboard/organisations/page.tsx\`

**Effort:** 6 weeks`,
    priority: 'P0',
    milestone: 'V2.0 Revenue Accelerator',
    labels: ['v2.0', 'enterprise', 'multi-org'],
    effort: '6 weeks',
  },
  {
    title: 'V2.0: MYOB Production Launch',
    description: `## 22% Market Share in Australia

**Business Impact:** 50K+ potential users
**Priority Score:** 45/50

**Implementation:**
- Complete OAuth flow (70% done)
- Production testing with real credentials
- Error handling for API timeouts
- Historical data sync

**Files:**
- \`lib/integrations/myob-historical-fetcher.ts\`
- \`lib/integrations/myob-client.ts\`

**Effort:** 2 weeks`,
    priority: 'P0',
    milestone: 'V2.0 Revenue Accelerator',
    labels: ['v2.0', 'integrations', 'myob'],
    effort: '2 weeks',
  },
  {
    title: 'V2.0: QuickBooks Production Launch',
    description: `## 36% Market Share in Australia

**Business Impact:** 80K+ potential users
**Priority Score:** 45/50

**Implementation:**
- Complete transaction mapping (70% done)
- Sandbox testing environment
- UI integration for platform selection
- Data migration tools

**Files:**
- \`lib/integrations/quickbooks-client.ts\`
- \`lib/integrations/adapter.ts\`

**Effort:** 2 weeks`,
    priority: 'P0',
    milestone: 'V2.0 Revenue Accelerator',
    labels: ['v2.0', 'integrations', 'quickbooks'],
    effort: '2 weeks',
  },
  {
    title: 'V2.0: Mobile Apps (iOS/Android)',
    description: `## 60% User Preference

**Business Impact:** Improved engagement, mobile-first users
**Priority Score:** 44/50

**Implementation:**
- React Native for code reuse
- Native iOS app
- Native Android app
- Push notifications for recommendations

**Files:**
- \`mobile/\` (NEW directory)
- \`mobile/ios/\`
- \`mobile/android/\`
- \`mobile/shared/\`

**Effort:** 12 weeks`,
    priority: 'P0',
    milestone: 'V2.0 Revenue Accelerator',
    labels: ['v2.0', 'mobile', 'ios', 'android'],
    effort: '12 weeks',
  },
  {
    title: 'V2.0: Accountant Marketplace',
    description: `## 10% Commission Revenue

**Business Impact:** New revenue stream, $5K-$10K/month potential
**Priority Score:** 41/50

**Implementation:**
- Two-sided marketplace connecting accountants with business owners
- Commission tracking (10% of transactions)
- Accountant profiles and reviews
- Lead management system

**Files:**
- \`app/api/marketplace/*/route.ts\`
- \`app/dashboard/marketplace/page.tsx\`

**Effort:** 8 weeks`,
    priority: 'P1',
    milestone: 'V2.0 Revenue Accelerator',
    labels: ['v2.0', 'marketplace', 'revenue'],
    effort: '8 weeks',
  },
  {
    title: 'V2.0: Predictive Tax Modeling',
    description: `## Differentiated Value Prop

**Business Impact:** Help clients plan cash flow, avoid surprises
**Priority Score:** 43/50

**Implementation:**
- Forecast tax liability for next 12 months
- Based on historical patterns and current transactions
- Scenario modeling (what-if analysis)
- Cash flow planning recommendations

**Files:**
- \`lib/ai/predictive-modeler.ts\`
- \`app/dashboard/forecasting/page.tsx\`

**Effort:** 6 weeks`,
    priority: 'P1',
    milestone: 'V2.0 Revenue Accelerator',
    labels: ['v2.0', 'ai', 'forecasting'],
    effort: '6 weeks',
  },
  {
    title: 'V2.0: Advanced Dashboard Customisation',
    description: `## Improve Retention

**Business Impact:** Personalisation increases satisfaction
**Priority Score:** 34/50

**Implementation:**
- Drag-and-drop widgets
- Save custom layouts per user
- Widget library (charts, metrics, recommendations)
- Export dashboard to PDF

**Files:**
- \`app/dashboard/customise/page.tsx\`
- \`lib/dashboard/widget-manager.ts\`

**Effort:** 4 weeks`,
    priority: 'P1',
    milestone: 'V2.0 Revenue Accelerator',
    labels: ['v2.0', 'dashboard', 'ux'],
    effort: '4 weeks',
  },
  {
    title: 'V2.0: Consolidated Reporting for Accountants',
    description: `## Essential for Accountant Firms

**Business Impact:** Saves 20+ hours/month, enterprise requirement
**Priority Score:** 42/50

**Implementation:**
- Single report aggregating 50+ client organisations
- Cross-client analytics and benchmarking
- Bulk export to Excel/PDF
- White-label report templates

**Files:**
- \`lib/reports/consolidated-report-generator.ts\`
- \`app/dashboard/consolidated/page.tsx\`

**Effort:** 6 weeks`,
    priority: 'P0',
    milestone: 'V2.0 Revenue Accelerator',
    labels: ['v2.0', 'reporting', 'enterprise'],
    effort: '6 weeks',
  },
  {
    title: 'V2.0: SSO/SAML Integration',
    description: `## Enterprise Security

**Business Impact:** Enterprise authentication standard
**Priority Score:** 38/50

**Implementation:**
- Single sign-on with Azure AD, Okta, Google Workspace
- SAML 2.0 support
- Just-in-time provisioning
- Role mapping from IdP

**Files:**
- \`lib/auth/sso-saml-provider.ts\`
- \`app/api/auth/saml/route.ts\`

**Effort:** 3 weeks`,
    priority: 'P1',
    milestone: 'V2.0 Revenue Accelerator',
    labels: ['v2.0', 'auth', 'enterprise', 'saml'],
    effort: '3 weeks',
  },
];

// V2.1 "Platform Maturity" (Top 8 Features)
const v2_1Issues: RoadmapIssue[] = [
  {
    title: 'V2.1: Natural Language Queries',
    description: `## Reduce Learning Curve

**Business Impact:** Accessibility, reduce support tickets
**Priority Score:** 40/50

**Implementation:**
- "How much R&D offset am I eligible for this year?" answered by AI
- Natural language interface to tax data
- Conversational UI with context awareness
- Query history and saved queries

**Files:**
- \`lib/ai/nlp-query-engine.ts\`
- \`app/dashboard/ask/page.tsx\`

**Effort:** 8 weeks`,
    priority: 'P1',
    milestone: 'V2.1 Platform Maturity',
    labels: ['v2.1', 'ai', 'nlp'],
    effort: '8 weeks',
  },
  {
    title: 'V2.1: Continuous Monitoring',
    description: `## Catch Opportunities Immediately

**Business Impact:** Proactive vs reactive, daily automated scans
**Priority Score:** 37/50

**Implementation:**
- Daily automated scans for new opportunities
- Price drops, misclassifications detected automatically
- Email alerts for new recommendations
- Background job processing

**Files:**
- \`lib/ai/continuous-monitor.ts\`
- \`lib/jobs/daily-scan.ts\`

**Effort:** 4 weeks`,
    priority: 'P1',
    milestone: 'V2.1 Platform Maturity',
    labels: ['v2.1', 'ai', 'monitoring'],
    effort: '4 weeks',
  },
  {
    title: 'V2.1: CGT Module ($299 Add-On)',
    description: `## $100K+ Revenue/Year

**Business Impact:** Capital Gains Tax module, high-value add-on
**Priority Score:** 39/50

**Implementation:**
- Analyse asset sales for CGT liability
- Calculate CGT discount (50% for assets held >12 months)
- Optimise timing of asset sales
- Small business CGT concessions (15-year exemption, retirement exemption)

**Files:**
- \`lib/analysis/cgt-engine.ts\`
- \`app/dashboard/cgt/page.tsx\`

**Effort:** 8 weeks`,
    priority: 'P1',
    milestone: 'V2.1 Platform Maturity',
    labels: ['v2.1', 'tax-domain', 'cgt', 'revenue'],
    effort: '8 weeks',
  },
  {
    title: 'V2.1: GST Optimization Module ($199 Add-On)',
    description: `## $50K+ Revenue/Year

**Business Impact:** Find GST input credits missed, BAS reconciliation
**Priority Score:** 33/50

**Implementation:**
- Identify missed GST input credits
- BAS reconciliation and lodgement preparation
- GST cash vs accrual optimization
- Going concern exemptions

**Files:**
- \`lib/analysis/gst-engine.ts\`
- \`app/dashboard/gst/page.tsx\`

**Effort:** 6 weeks`,
    priority: 'P1',
    milestone: 'V2.1 Platform Maturity',
    labels: ['v2.1', 'tax-domain', 'gst', 'revenue'],
    effort: '6 weeks',
  },
  {
    title: 'V2.1: API Access Tier ($299/mo)',
    description: `## Tech-Savvy Accountants

**Business Impact:** Integration partners, developer tier
**Priority Score:** 31/50

**Implementation:**
- Developer tier ($299/mo) for programmatic access
- RESTful API with GraphQL option
- Webhook support for real-time updates
- API documentation (Swagger/OpenAPI)

**Files:**
- \`app/api/v1/*/route.ts\`
- \`docs/api-reference.md\`

**Effort:** 4 weeks`,
    priority: 'P2',
    milestone: 'V2.1 Platform Maturity',
    labels: ['v2.1', 'api', 'developer', 'revenue'],
    effort: '4 weeks',
  },
  {
    title: 'V2.1: Smart Categorisation',
    description: `## 80% Reduction in Manual Audit Time

**Business Impact:** AI-powered transaction classification
**Priority Score:** 32/50

**Implementation:**
- AI suggests transaction reclassifications with confidence scores
- Learn from user corrections
- Auto-apply high-confidence suggestions
- Bulk categorisation with review

**Files:**
- \`lib/ai/smart-categorizer.ts\`
- \`app/dashboard/categorise/page.tsx\`

**Effort:** 3 weeks`,
    priority: 'P2',
    milestone: 'V2.1 Platform Maturity',
    labels: ['v2.1', 'ai', 'categorisation'],
    effort: '3 weeks',
  },
  {
    title: 'V2.1: Advanced Dashboard Customisation (Phase 2)',
    description: `## Complete Phase 1 Features

**Business Impact:** Personalisation increases retention
**Priority Score:** 34/50

**Implementation:**
- Complete drag-and-drop widget library
- Advanced filtering and drill-down
- Custom chart types and visualizations
- Dashboard sharing and templates

**Files:**
- \`app/dashboard/customise/page.tsx\`
- \`lib/dashboard/widget-library.ts\`

**Effort:** 2 weeks`,
    priority: 'P2',
    milestone: 'V2.1 Platform Maturity',
    labels: ['v2.1', 'dashboard', 'ux'],
    effort: '2 weeks',
  },
  {
    title: 'V2.1: Export to PDF/Excel',
    description: `## Share with Accountants

**Business Impact:** Compliance audits, accountant collaboration
**Priority Score:** N/A

**Implementation:**
- Download all reports and recommendations
- Excel export with formulas preserved
- PDF export with branding
- Bulk export for multiple reports

**Files:**
- \`lib/reports/pdf-exporter.ts\`
- \`lib/reports/excel-exporter.ts\`

**Effort:** 2 weeks`,
    priority: 'P2',
    milestone: 'V2.1 Platform Maturity',
    labels: ['v2.1', 'reports', 'export'],
    effort: '2 weeks',
  },
];

// V2.2 "Enterprise Domination" (Top 8 Features)
const v2_2Issues: RoadmapIssue[] = [
  {
    title: 'V2.2: Consolidated Reporting (Single Report for 50+ Clients)',
    description: `## Essential for Accountant Firms

**Business Impact:** Saves 20+ hours/month
**Priority Score:** 42/50

**Implementation:**
- Single report aggregating 50+ client organisations
- Cross-client analytics and benchmarking
- White-label templates for accountant firms
- Scheduled report generation and delivery

**Files:**
- \`lib/reports/consolidated-report-generator.ts\`

**Effort:** 6 weeks`,
    priority: 'P0',
    milestone: 'V2.2 Enterprise Domination',
    labels: ['v2.2', 'reporting', 'enterprise'],
    effort: '6 weeks',
  },
  {
    title: 'V2.2: White-Label Solution ($5K Setup + $500/mo)',
    description: `## $100K+ ARR Potential

**Business Impact:** Enterprise contracts, accountant firm branding
**Priority Score:** 35/50

**Implementation:**
- Rebrandable platform for accountant firms
- Custom logo, colors, domain (clients.firm.com.au)
- Branded emails and reports
- White-label API endpoints

**Files:**
- \`lib/white-label/branding-manager.ts\`
- \`app/dashboard/branding/page.tsx\`

**Effort:** 12 weeks`,
    priority: 'P2',
    milestone: 'V2.2 Enterprise Domination',
    labels: ['v2.2', 'white-label', 'enterprise', 'revenue'],
    effort: '12 weeks',
  },
  {
    title: 'V2.2: Role-Based Access Control (RBAC)',
    description: `## Enterprise Security Requirement

**Business Impact:** Granular permissions (read-only, analyst, reviewer, admin)
**Priority Score:** N/A

**Implementation:**
- Granular permissions per user role
- Organisation-level and resource-level permissions
- Audit trail for permission changes
- Role templates for common scenarios

**Files:**
- \`lib/auth/rbac.ts\`
- \`middleware.ts\` (extend with RBAC checks)

**Effort:** 4 weeks`,
    priority: 'P1',
    milestone: 'V2.2 Enterprise Domination',
    labels: ['v2.2', 'auth', 'rbac', 'enterprise'],
    effort: '4 weeks',
  },
  {
    title: 'V2.2: Audit Trail',
    description: `## Compliance Requirement

**Business Impact:** Fraud prevention, regulatory compliance
**Priority Score:** N/A

**Implementation:**
- Complete history of all user actions (who changed what, when)
- Immutable audit log storage
- Audit log search and filtering
- Export audit logs for compliance

**Files:**
- \`lib/audit/audit-logger.ts\`
- \`app/dashboard/audit/page.tsx\`

**Effort:** 2 weeks`,
    priority: 'P1',
    milestone: 'V2.2 Enterprise Domination',
    labels: ['v2.2', 'audit', 'compliance', 'enterprise'],
    effort: '2 weeks',
  },
  {
    title: 'V2.2: Practice Management Integrations',
    description: `## Accountant Firm Workflow Integration

**Business Impact:** Xero Practice Manager, Ignition, Karbon integration
**Priority Score:** 30/50

**Implementation:**
- Xero Practice Manager integration (tasks, clients, time tracking)
- Ignition integration (proposals, engagement letters)
- Karbon integration (workflows, work-in-progress)
- Two-way sync for client data

**Files:**
- \`lib/integrations/xero-practice-manager.ts\`
- \`lib/integrations/ignition.ts\`
- \`lib/integrations/karbon.ts\`

**Effort:** 6 weeks`,
    priority: 'P1',
    milestone: 'V2.2 Enterprise Domination',
    labels: ['v2.2', 'integrations', 'practice-management'],
    effort: '6 weeks',
  },
  {
    title: 'V2.2: Custom Branding',
    description: `## White-Label for Large Firms

**Business Impact:** Upload logo, change colors, custom domain
**Priority Score:** N/A

**Implementation:**
- Custom logo upload and management
- Brand color customization (primary, secondary, accent)
- Custom domain (clients.firm.com.au)
- Branded email templates

**Files:**
- \`lib/white-label/branding-manager.ts\`

**Effort:** 3 weeks`,
    priority: 'P2',
    milestone: 'V2.2 Enterprise Domination',
    labels: ['v2.2', 'branding', 'white-label'],
    effort: '3 weeks',
  },
  {
    title: 'V2.2: Data Residency Options',
    description: `## Government/Finance Clients

**Business Impact:** Host data in Australia-only region (compliance requirement)
**Priority Score:** N/A

**Implementation:**
- Australia-only data region option
- Data sovereignty compliance
- GDPR and Privacy Act compliance
- Data export and portability

**Files:**
- \`supabase/migrations/006_data_residency.sql\`

**Effort:** 2 weeks`,
    priority: 'P2',
    milestone: 'V2.2 Enterprise Domination',
    labels: ['v2.2', 'data-residency', 'compliance'],
    effort: '2 weeks',
  },
  {
    title: 'V2.2: SLA Guarantees',
    description: `## Enterprise Contracts Require This

**Business Impact:** 99.95% uptime, 4-hour critical support response
**Priority Score:** N/A

**Implementation:**
- 99.95% uptime SLA
- 4-hour critical support response time
- Dedicated support channels for enterprise clients
- SLA monitoring and reporting

**Files:**
- \`app/api/health/route.ts\`
- \`lib/monitoring/sla-tracker.ts\`

**Effort:** 4 weeks`,
    priority: 'P2',
    milestone: 'V2.2 Enterprise Domination',
    labels: ['v2.2', 'sla', 'support', 'enterprise'],
    effort: '4 weeks',
  },
];

// V2.3 "Global Expansion" (Top 10 Features)
const v2_3Issues: RoadmapIssue[] = [
  {
    title: 'V2.3: New Zealand Tax Laws',
    description: `## 5M Population, Similar Legal System

**Business Impact:** 500K+ SMEs, easy expansion
**Priority Score:** 36/50

**Implementation:**
- NZ R&D tax credit (15%)
- Loss carry-forward rules
- Provisional tax
- FBT and GST (15%)

**Files:**
- \`lib/tax-laws/nz/\` (NEW directory)
- \`lib/analysis/nz-rnd-engine.ts\`

**Effort:** 8 weeks`,
    priority: 'P1',
    milestone: 'V2.3 Global Expansion',
    labels: ['v2.3', 'international', 'nz', 'tax-laws'],
    effort: '8 weeks',
  },
  {
    title: 'V2.3: Multi-Currency Support',
    description: `## Enable Global Expansion

**Business Impact:** Handle AUD, NZD, USD, GBP for international clients
**Priority Score:** 29/50

**Implementation:**
- Multi-currency transactions and reporting
- Exchange rate management
- Currency conversion with historical rates
- Multi-currency tax calculations

**Files:**
- \`lib/analysis/currency-converter.ts\`

**Effort:** 3 weeks`,
    priority: 'P1',
    milestone: 'V2.3 Global Expansion',
    labels: ['v2.3', 'international', 'currency'],
    effort: '3 weeks',
  },
  {
    title: 'V2.3: UK Tax Laws (Phase 1)',
    description: `## 67M Population, 5.5M SMEs

**Business Impact:** Large market, R&D super-deduction
**Priority Score:** N/A

**Implementation:**
- UK R&D (130% super-deduction)
- Loss carry-back rules
- Corporation tax
- VAT (20%)

**Files:**
- \`lib/tax-laws/uk/\` (NEW directory)
- \`lib/analysis/uk-rnd-engine.ts\`

**Effort:** 12 weeks`,
    priority: 'P2',
    milestone: 'V2.3 Global Expansion',
    labels: ['v2.3', 'international', 'uk', 'tax-laws'],
    effort: '12 weeks',
  },
  {
    title: 'V2.3: Payroll Tax Analysis Module ($249 Add-On)',
    description: `## Enterprise Clients

**Business Impact:** Calculate payroll tax liability, grouping rules (state-specific)
**Priority Score:** N/A

**Implementation:**
- State-specific payroll tax rules (NSW, VIC, QLD, etc.)
- Grouping rules and related entity tests
- Monthly vs annual lodgement
- Payroll tax exemptions and thresholds

**Files:**
- \`lib/analysis/payroll-tax-engine.ts\`
- \`app/dashboard/payroll-tax/page.tsx\`

**Effort:** 8 weeks`,
    priority: 'P2',
    milestone: 'V2.3 Global Expansion',
    labels: ['v2.3', 'tax-domain', 'payroll-tax', 'revenue'],
    effort: '8 weeks',
  },
  {
    title: 'V2.3: FBT Module ($299 Add-On)',
    description: `## High-Value (47% FBT Rate)

**Business Impact:** Calculate FBT liability, optimise salary packaging
**Priority Score:** N/A

**Implementation:**
- FBT calculations (47% rate)
- Car fringe benefits (statutory formula vs log book)
- Salary packaging optimization
- FBT exemptions and concessions

**Files:**
- \`lib/analysis/fbt-engine.ts\`
- \`app/dashboard/fbt/page.tsx\`

**Effort:** 8 weeks`,
    priority: 'P2',
    milestone: 'V2.3 Global Expansion',
    labels: ['v2.3', 'tax-domain', 'fbt', 'revenue'],
    effort: '8 weeks',
  },
  {
    title: 'V2.3: Trust Tax Returns',
    description: `## 50% of SMEs Use Trusts

**Business Impact:** Big opportunity, Section 99A, UPE compliance
**Priority Score:** N/A

**Implementation:**
- Section 99A anti-avoidance rules
- UPE (Unpaid Present Entitlements) compliance
- Trust distribution streaming rules
- Family trust elections

**Files:**
- \`lib/analysis/trust-engine.ts\`
- \`app/dashboard/trusts/page.tsx\`

**Effort:** 10 weeks`,
    priority: 'P3',
    milestone: 'V2.3 Global Expansion',
    labels: ['v2.3', 'tax-domain', 'trusts', 'revenue'],
    effort: '10 weeks',
  },
  {
    title: 'V2.3: Real-Time Collaboration',
    description: `## Team Workflows

**Business Impact:** Multiple users can view/edit simultaneously (Google Docs-style)
**Priority Score:** N/A

**Implementation:**
- Real-time collaboration on reports and recommendations
- Presence indicators (who's viewing what)
- Commenting and annotations
- Conflict resolution for concurrent edits

**Files:**
- \`lib/collaboration/realtime-sync.ts\`

**Effort:** 8 weeks`,
    priority: 'P2',
    milestone: 'V2.3 Global Expansion',
    labels: ['v2.3', 'collaboration', 'ux'],
    effort: '8 weeks',
  },
  {
    title: 'V2.3: Anomaly Detection',
    description: `## Catch Fraud/Errors Early

**Business Impact:** Flag unusual transactions (duplicate invoices, round-number expenses)
**Priority Score:** N/A

**Implementation:**
- AI-powered anomaly detection
- Duplicate transaction detection
- Round-number expense flagging
- Outlier detection (transactions outside normal patterns)

**Files:**
- \`lib/ai/anomaly-detector.ts\`

**Effort:** 4 weeks`,
    priority: 'P2',
    milestone: 'V2.3 Global Expansion',
    labels: ['v2.3', 'ai', 'fraud-detection'],
    effort: '4 weeks',
  },
  {
    title: 'V2.3: Document Management Integrations',
    description: `## Centralize Tax Documents

**Business Impact:** Sync with Dropbox, Google Drive, SharePoint
**Priority Score:** N/A

**Implementation:**
- Dropbox integration for document storage
- Google Drive integration
- SharePoint integration for enterprise clients
- Automatic document categorization

**Files:**
- \`lib/integrations/dropbox.ts\`
- \`lib/integrations/google-drive.ts\`
- \`lib/integrations/sharepoint.ts\`

**Effort:** 4 weeks`,
    priority: 'P2',
    milestone: 'V2.3 Global Expansion',
    labels: ['v2.3', 'integrations', 'document-management'],
    effort: '4 weeks',
  },
  {
    title: 'V2.3: Referral Program',
    description: `## Low-Cost Customer Acquisition

**Business Impact:** 20% commission for successful referrals, viral growth
**Priority Score:** N/A

**Implementation:**
- Referral tracking and attribution
- 20% commission for successful referrals
- Referral dashboard for users
- Automated payout system

**Files:**
- \`app/api/referrals/*/route.ts\`
- \`app/dashboard/referrals/page.tsx\`

**Effort:** 2 weeks`,
    priority: 'P3',
    milestone: 'V2.3 Global Expansion',
    labels: ['v2.3', 'referral', 'revenue'],
    effort: '2 weeks',
  },
];

async function pushRoadmapToLinear() {
  console.log('🚀 Pushing V1 Finalization & V2 Roadmap to Linear...\n');

  try {
    const client = createLinearClient();
    const team = await client.team(serverConfig.linear.teamId);

    if (!team) {
      throw new Error(`Team ${serverConfig.linear.teamId} not found`);
    }

    console.log(`✅ Connected to Linear team: ${team.name} (${team.key})\n`);

    // Get workflow states
    const states = await team.states();
    const backlogState = states.nodes.find(s => s.type === 'backlog');

    if (!backlogState) {
      throw new Error('Backlog state not found');
    }

    console.log(`📋 Using workflow state: ${backlogState.name}\n`);

    // Create all issues
    const allIssues = [
      ...v1Issues,
      ...v2_0Issues,
      ...v2_1Issues,
      ...v2_2Issues,
      ...v2_3Issues,
    ];

    console.log(`📝 Creating ${allIssues.length} Linear issues...\n`);

    let createdCount = 0;
    const createdIssues: any[] = [];

    for (const issue of allIssues) {
      try {
        const issuePayload = await client.createIssue({
          teamId: team.id,
          title: issue.title,
          description: issue.description,
          priority: mapPriorityToLinear(issue.priority),
          stateId: backlogState.id,
          labelIds: [], // Labels would need to be created first
        });

        if (issuePayload.success) {
          const createdIssue = await issuePayload.issue;
          if (createdIssue) {
            createdIssues.push(createdIssue);
            createdCount++;
            console.log(`✅ Created: ${issue.title}`);
            console.log(`   URL: ${createdIssue.url}`);
            console.log(`   Priority: ${issue.priority} | Effort: ${issue.effort}\n`);
          }
        }

        // Rate limit protection: 4-second delay between requests
        await new Promise(resolve => setTimeout(resolve, 4000));
      } catch (error) {
        console.error(`❌ Failed to create: ${issue.title}`);
        console.error(`   Error: ${error}\n`);
      }
    }

    console.log(`\n✅ Successfully created ${createdCount}/${allIssues.length} Linear issues\n`);

    // Summary by milestone
    const milestones = [
      'V1 Finalization',
      'V2.0 Revenue Accelerator',
      'V2.1 Platform Maturity',
      'V2.2 Enterprise Domination',
      'V2.3 Global Expansion',
    ];

    console.log('📊 Summary by Milestone:\n');
    for (const milestone of milestones) {
      const count = allIssues.filter(i => i.milestone === milestone).length;
      console.log(`   ${milestone}: ${count} issues`);
    }

    console.log('\n🎉 Roadmap successfully pushed to Linear!');
    console.log(`\n👉 View all issues: https://linear.app/${team.key}/active`);

  } catch (error) {
    console.error('❌ Failed to push roadmap to Linear:', error);
    process.exit(1);
  }
}

// Run the script
pushRoadmapToLinear();
