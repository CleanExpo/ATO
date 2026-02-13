#!/usr/bin/env tsx
/**
 * Push V1 Finalization & V2 Roadmap to Linear (Standalone)
 *
 * This is a standalone script that only requires LINEAR_* environment variables
 * and doesn't depend on the full serverConfig validation.
 *
 * Usage: tsx scripts/push-roadmap-to-linear-standalone.ts
 */

import { LinearClient } from '@linear/sdk';
import * as dotenv from 'dotenv';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

// Load environment variables from .env.local
dotenv.config({ path: path.join(process.cwd(), '.env.local') });

// Simple retry function
async function retry<T>(
  fn: () => Promise<T>,
  maxAttempts: number = 3,
  delayMs: number = 1000
): Promise<T> {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      if (attempt === maxAttempts) throw error;
      console.warn(`Retry attempt ${attempt}/${maxAttempts}, waiting ${delayMs}ms...`);
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }
  throw new Error('Retry exhausted');
}

interface RoadmapIssue {
  title: string;
  description: string;
  priority: 'P0' | 'P1' | 'P2' | 'P3';
  milestone: string;
  labels: string[];
  effort?: string;
  risk?: string;
}

// Priority mapping (P0-P3 → Linear 1-4)
function mapPriorityToLinear(priority: string): number {
  const mapping: Record<string, number> = {
    'P0': 1, // Urgent
    'P1': 2, // High
    'P2': 3, // Medium
    'P3': 4, // Low
  };
  return mapping[priority] || 0;
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

**Effort:** 1 week | **Risk:** High (security vulnerabilities)`,
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
- \`app/api/checkout/create/route.ts\` (NEW)
- \`app/api/webhooks/stripe/route.ts\` (NEW)
- \`supabase/migrations/004_create_purchases.sql\` (NEW)
- \`lib/stripe/client.ts\` (NEW)

**Effort:** 1 week | **Risk:** High (no revenue without this)`,
    priority: 'P0',
    milestone: 'V1 Finalization',
    labels: ['v1-finalization', 'payments', 'revenue-blocker'],
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
- [ ] Implement transactional email queue
- [ ] Add email preferences management
- [ ] Create email delivery status tracking
- [ ] Implement retry logic for failed deliveries

**Critical Files:**
- \`app/api/admin/accountant-applications/[id]/approve/route.ts\` (Line 195-197)
- \`lib/email/templates/\` (NEW directory)

**Effort:** 2-3 days | **Risk:** Medium`,
    priority: 'P1',
    milestone: 'V1 Finalization',
    labels: ['v1-finalization', 'email', 'ux'],
    effort: '2-3 days',
    risk: 'Medium',
  },
  {
    title: 'V1: Data Quality & Real-Time Charts',
    description: `## Priority: HIGH - Trust Destroyer

**Current Gap:**
Dashboard charts use \`Math.random()\` for mock data in 10+ files.

**Mock Data Files:**
- \`app/dashboard/overview/page.tsx\` (Line 305)
- \`app/dashboard/rnd/page.tsx\` (Line 289)
- \`components/charts/TaxSavingsChart.tsx\` (Line 45)
- And 7+ more...

**Required Actions:**
- [ ] Replace all \`Math.random()\` with real Supabase queries
- [ ] Create materialized views for expensive aggregations
- [ ] Add loading states and skeleton screens

**Effort:** 1 week | **Risk:** High`,
    priority: 'P1',
    milestone: 'V1 Finalization',
    labels: ['v1-finalization', 'data-quality', 'charts'],
    effort: '1 week',
    risk: 'High',
  },
  {
    title: 'V1: Testing Infrastructure',
    description: `## Priority: HIGH - Technical Debt

**Current Gap:**
Only 2 test files exist despite 40+ tax calculation rules and 107+ API endpoints.

**Required Actions:**
- [ ] Implement API route integration tests
- [ ] Add unit tests for all tax calculation engines (80% coverage target)
- [ ] Create E2E tests (Playwright)
- [ ] Set up CI/CD pipeline

**Critical Files:**
- \`__tests__/api/\` (NEW)
- \`__tests__/e2e/\` (NEW)

**Effort:** 3 weeks | **Risk:** High`,
    priority: 'P1',
    milestone: 'V1 Finalization',
    labels: ['v1-finalization', 'testing'],
    effort: '3 weeks',
    risk: 'High',
  },
  {
    title: 'V1: Performance Optimization',
    description: `## Priority: MEDIUM

**Current Issues:**
- 496 console.log statements slow down builds
- No caching strategy for tax rates
- Batch AI analysis processes 100 transactions serially

**Required Actions:**
- [ ] Remove all console.log statements
- [ ] Implement Redis caching for tax rates
- [ ] Optimize batch AI to use concurrent promises (10 parallel)
- [ ] Add database indexes

**Effort:** 1 week | **Risk:** Medium`,
    priority: 'P2',
    milestone: 'V1 Finalization',
    labels: ['v1-finalization', 'performance'],
    effort: '1 week',
    risk: 'Medium',
  },
  {
    title: 'V1: Documentation',
    description: `## Priority: MEDIUM

**Current Gap:**
No user-facing documentation, API docs, or onboarding guides.

**Required Actions:**
- [ ] Create user onboarding guide
- [ ] Write API documentation
- [ ] Add inline help tooltips for tax concepts
- [ ] Document admin procedures

**Effort:** 1 week | **Risk:** Low`,
    priority: 'P2',
    milestone: 'V1 Finalization',
    labels: ['v1-finalization', 'docs'],
    effort: '1 week',
    risk: 'Low',
  },
  {
    title: 'V1: MYOB & QuickBooks Integration',
    description: `## Priority: MEDIUM

**Current State:**
Both integrations are ~70% complete but not production-ready.

**Required Actions:**
- [ ] Complete MYOB OAuth flow
- [ ] Finish QuickBooks transaction mapping
- [ ] Add integration testing with sandboxes
- [ ] Create unified data adapter layer

**Effort:** 2 weeks | **Risk:** Medium`,
    priority: 'P2',
    milestone: 'V1 Finalization',
    labels: ['v1-finalization', 'integrations'],
    effort: '2 weeks',
    risk: 'Medium',
  },
  {
    title: 'V1: Critical Bug Fixes',
    description: `## Priority: HIGH

**Known Issues:**
1. Recommendation Status Not Persisted (data loss on refresh)
2. Excel Loss Sheet Not Implemented
3. Token Refresh Race Condition
4. Division 7A Interest Rate Hardcoded

**Effort:** 1 week | **Risk:** High`,
    priority: 'P1',
    milestone: 'V1 Finalization',
    labels: ['v1-finalization', 'bugs'],
    effort: '1 week',
    risk: 'High',
  },
  {
    title: 'V1: Deployment & Monitoring',
    description: `## Priority: MEDIUM

**Current Gap:**
No production monitoring, uptime checks, or error alerting.

**Required Actions:**
- [ ] Complete Sentry integration
- [ ] Set up Vercel Analytics
- [ ] Implement uptime monitoring
- [ ] Add health check endpoints
- [ ] Set up database backups

**Effort:** 3 days | **Risk:** Medium`,
    priority: 'P2',
    milestone: 'V1 Finalization',
    labels: ['v1-finalization', 'monitoring'],
    effort: '3 days',
    risk: 'Medium',
  },
];

// V2.0 "Revenue Accelerator" (Top 10 Features) - Condensed
const v2_0Issues: RoadmapIssue[] = [
  {
    title: 'V2.0: Stripe Payment Integration',
    description: `**Business Impact:** Revenue blocker, immediate ROI
**Priority Score:** 48/50

Implement full Stripe checkout, webhooks, license management, and subscription plans.

**Effort:** 2 weeks`,
    priority: 'P0',
    milestone: 'V2.0 Revenue Accelerator',
    labels: ['v2.0', 'payments'],
    effort: '2 weeks',
  },
  {
    title: 'V2.0: Enterprise Multi-Organisation',
    description: `**Business Impact:** $50K+ annual contracts
**Priority Score:** 46/50

Single user manages 10+ client organisations with consolidated dashboard.

**Effort:** 6 weeks`,
    priority: 'P0',
    milestone: 'V2.0 Revenue Accelerator',
    labels: ['v2.0', 'enterprise'],
    effort: '6 weeks',
  },
  {
    title: 'V2.0: MYOB Production Launch',
    description: `**Business Impact:** 22% market share, 50K+ users
**Priority Score:** 45/50

Complete OAuth flow (70% done), production testing, error handling.

**Effort:** 2 weeks`,
    priority: 'P0',
    milestone: 'V2.0 Revenue Accelerator',
    labels: ['v2.0', 'myob'],
    effort: '2 weeks',
  },
  {
    title: 'V2.0: QuickBooks Production Launch',
    description: `**Business Impact:** 36% market share, 80K+ users
**Priority Score:** 45/50

Complete transaction mapping (70% done), sandbox testing, UI integration.

**Effort:** 2 weeks`,
    priority: 'P0',
    milestone: 'V2.0 Revenue Accelerator',
    labels: ['v2.0', 'quickbooks'],
    effort: '2 weeks',
  },
  {
    title: 'V2.0: Mobile Apps (iOS/Android)',
    description: `**Business Impact:** 60% user preference
**Priority Score:** 44/50

React Native for code reuse, native iOS and Android apps.

**Effort:** 12 weeks`,
    priority: 'P0',
    milestone: 'V2.0 Revenue Accelerator',
    labels: ['v2.0', 'mobile'],
    effort: '12 weeks',
  },
];

// V2.1-V2.3 condensed (5 issues each for brevity)
const v2_1Issues: RoadmapIssue[] = [
  {
    title: 'V2.1: Natural Language Queries',
    description: `**Business Impact:** Reduce learning curve
**Priority Score:** 40/50

"How much R&D offset am I eligible for?" answered by AI.

**Effort:** 8 weeks`,
    priority: 'P1',
    milestone: 'V2.1 Platform Maturity',
    labels: ['v2.1', 'ai'],
    effort: '8 weeks',
  },
  {
    title: 'V2.1: Continuous Monitoring',
    description: `**Business Impact:** Catch opportunities immediately
**Priority Score:** 37/50

Daily automated scans for new opportunities, price drops, misclassifications.

**Effort:** 4 weeks`,
    priority: 'P1',
    milestone: 'V2.1 Platform Maturity',
    labels: ['v2.1', 'monitoring'],
    effort: '4 weeks',
  },
  {
    title: 'V2.1: CGT Module ($299 Add-On)',
    description: `**Business Impact:** $100K+ revenue/year
**Priority Score:** 39/50

Capital Gains Tax analysis, calculate liability, optimize timing.

**Effort:** 8 weeks`,
    priority: 'P1',
    milestone: 'V2.1 Platform Maturity',
    labels: ['v2.1', 'cgt'],
    effort: '8 weeks',
  },
  {
    title: 'V2.1: GST Optimization Module ($199)',
    description: `**Business Impact:** $50K+ revenue/year

Find missed GST input credits, BAS reconciliation.

**Effort:** 6 weeks`,
    priority: 'P1',
    milestone: 'V2.1 Platform Maturity',
    labels: ['v2.1', 'gst'],
    effort: '6 weeks',
  },
  {
    title: 'V2.1: API Access Tier ($299/mo)',
    description: `**Business Impact:** Developer tier, integration partners

Developer tier for programmatic access to tax intelligence.

**Effort:** 4 weeks`,
    priority: 'P2',
    milestone: 'V2.1 Platform Maturity',
    labels: ['v2.1', 'api'],
    effort: '4 weeks',
  },
];

const v2_2Issues: RoadmapIssue[] = [
  {
    title: 'V2.2: Consolidated Reporting',
    description: `**Business Impact:** Saves 20+ hours/month
**Priority Score:** 42/50

Single report aggregating 50+ client organisations.

**Effort:** 6 weeks`,
    priority: 'P0',
    milestone: 'V2.2 Enterprise Domination',
    labels: ['v2.2', 'reporting'],
    effort: '6 weeks',
  },
  {
    title: 'V2.2: White-Label Solution',
    description: `**Business Impact:** $100K+ ARR potential

$5K setup + $500/mo, rebrandable platform for accountant firms.

**Effort:** 12 weeks`,
    priority: 'P2',
    milestone: 'V2.2 Enterprise Domination',
    labels: ['v2.2', 'white-label'],
    effort: '12 weeks',
  },
  {
    title: 'V2.2: Role-Based Access Control',
    description: `**Business Impact:** Enterprise security requirement

Granular permissions (read-only, analyst, reviewer, admin).

**Effort:** 4 weeks`,
    priority: 'P1',
    milestone: 'V2.2 Enterprise Domination',
    labels: ['v2.2', 'rbac'],
    effort: '4 weeks',
  },
  {
    title: 'V2.2: Audit Trail',
    description: `**Business Impact:** Compliance requirement

Complete history of all user actions (who changed what, when).

**Effort:** 2 weeks`,
    priority: 'P1',
    milestone: 'V2.2 Enterprise Domination',
    labels: ['v2.2', 'audit'],
    effort: '2 weeks',
  },
  {
    title: 'V2.2: Practice Management Integrations',
    description: `**Business Impact:** Accountant firm workflow

Xero Practice Manager, Ignition, Karbon integration.

**Effort:** 6 weeks`,
    priority: 'P1',
    milestone: 'V2.2 Enterprise Domination',
    labels: ['v2.2', 'integrations'],
    effort: '6 weeks',
  },
];

const v2_3Issues: RoadmapIssue[] = [
  {
    title: 'V2.3: New Zealand Tax Laws',
    description: `**Business Impact:** 500K+ SMEs, similar legal system
**Priority Score:** 36/50

NZ R&D tax credit (15%), loss carry-forward, provisional tax.

**Effort:** 8 weeks`,
    priority: 'P1',
    milestone: 'V2.3 Global Expansion',
    labels: ['v2.3', 'nz'],
    effort: '8 weeks',
  },
  {
    title: 'V2.3: Multi-Currency Support',
    description: `**Business Impact:** Enable global expansion

Handle AUD, NZD, USD, GBP for international clients.

**Effort:** 3 weeks`,
    priority: 'P1',
    milestone: 'V2.3 Global Expansion',
    labels: ['v2.3', 'currency'],
    effort: '3 weeks',
  },
  {
    title: 'V2.3: UK Tax Laws (Phase 1)',
    description: `**Business Impact:** 67M population, 5.5M SMEs

UK R&D (130% super-deduction), loss carry-back, corporation tax, VAT.

**Effort:** 12 weeks`,
    priority: 'P2',
    milestone: 'V2.3 Global Expansion',
    labels: ['v2.3', 'uk'],
    effort: '12 weeks',
  },
  {
    title: 'V2.3: Payroll Tax Module ($249)',
    description: `**Business Impact:** Enterprise clients

State-specific payroll tax rules, grouping rules.

**Effort:** 8 weeks`,
    priority: 'P2',
    milestone: 'V2.3 Global Expansion',
    labels: ['v2.3', 'payroll'],
    effort: '8 weeks',
  },
  {
    title: 'V2.3: FBT Module ($299)',
    description: `**Business Impact:** High-value (47% FBT rate)

Calculate FBT liability, optimize salary packaging.

**Effort:** 8 weeks`,
    priority: 'P2',
    milestone: 'V2.3 Global Expansion',
    labels: ['v2.3', 'fbt'],
    effort: '8 weeks',
  },
];

async function pushRoadmapToLinear() {
  console.log('🚀 Pushing V1 Finalization & V2 Roadmap to Linear...\n');

  // Validate environment variables
  const apiKey = process.env.LINEAR_API_KEY;
  const teamId = process.env.LINEAR_TEAM_ID;

  if (!apiKey) {
    throw new Error('LINEAR_API_KEY is not set in .env.local');
  }

  if (!teamId) {
    throw new Error('LINEAR_TEAM_ID is not set in .env.local');
  }

  try {
    const client = new LinearClient({ apiKey });
    const team = await client.team(teamId);

    if (!team) {
      throw new Error(`Team ${teamId} not found`);
    }

    console.log(`✅ Connected to Linear team: ${team.name} (${team.key})\n`);

    // Get workflow states
    const states = await team.states();
    const backlogState = states.nodes.find(s => s.type === 'backlog');

    if (!backlogState) {
      throw new Error('Backlog state not found');
    }

    console.log(`📋 Using workflow state: ${backlogState.name}\n`);

    // Combine all issues
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
        const issuePayload = await retry(async () => {
          return await client.createIssue({
            teamId: team.id,
            title: issue.title,
            description: issue.description,
            priority: mapPriorityToLinear(issue.priority),
            stateId: backlogState.id,
          });
        });

        if (issuePayload.success) {
          const createdIssue = await issuePayload.issue;
          if (createdIssue) {
            createdIssues.push(createdIssue);
            createdCount++;
            console.log(`✅ ${createdCount}/${allIssues.length}: ${issue.title}`);
            console.log(`   ${createdIssue.url}\n`);
          }
        }

        // Rate limit protection: 4-second delay
        await new Promise(resolve => setTimeout(resolve, 4000));
      } catch (error) {
        console.error(`❌ Failed: ${issue.title}`);
        console.error(`   ${error}\n`);
      }
    }

    console.log(`\n✅ Successfully created ${createdCount}/${allIssues.length} Linear issues\n`);

    // Summary
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

    console.log(`\n🎉 Roadmap successfully pushed to Linear!`);
    console.log(`👉 View: https://linear.app/${team.key}/active\n`);

  } catch (error) {
    console.error('❌ Failed to push roadmap to Linear:', error);
    process.exit(1);
  }
}

// Run the script
pushRoadmapToLinear();
