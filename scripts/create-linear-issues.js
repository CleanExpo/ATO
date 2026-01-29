#!/usr/bin/env node
/**
 * Create Linear Issues from Priority List
 *
 * Reads LINEAR_ISSUES_PRIORITY.md and creates issues in Linear
 * Requires LINEAR_API_KEY in .env.local
 */

require('dotenv').config({ path: '.env.local' });
const https = require('https');

const LINEAR_API_KEY = process.env.LINEAR_API_KEY;
const LINEAR_TEAM_ID = process.env.LINEAR_TEAM_ID || 'unite-hub';
const LINEAR_PROJECT_ID = process.env.LINEAR_PROJECT_ID || 'ato-3f31f766c467';

if (!LINEAR_API_KEY) {
  console.error('❌ LINEAR_API_KEY not found in .env.local');
  console.log('\nGet your API key from: https://linear.app/unite-hub/settings/api');
  console.log('Then add to .env.local:\n');
  console.log('LINEAR_API_KEY=lin_api_xxxxxxxxxx');
  console.log('LINEAR_TEAM_ID=unite-hub');
  console.log('LINEAR_PROJECT_ID=ato-3f31f766c467');
  process.exit(1);
}

// Issue definitions from LINEAR_ISSUES_PRIORITY.md
const issues = [
  {
    title: 'OAuth Connections Not Persisting to Database',
    priority: 0, // P0 - Urgent
    status: 'Done', // Already fixed
    labels: ['bug', 'database', 'oauth', 'blocking'],
    description: `OAuth callback completes successfully and redirects to \`?connected=true\`, but no data is saved to database. Users see empty state after "successful" connection.

**Root Cause:**
Callback code at \`app/api/auth/xero/callback/route.ts:162\` was trying to insert \`organization_id\` column that didn't exist in \`xero_connections\` table schema.

**Fix Applied:**
- Created migration \`020_add_organization_id_to_xero_connections.sql\`
- Column \`organization_id UUID\` added with foreign key to \`organizations(id)\`
- Index created for performance
- Migration verified applied to production database

**Verification Steps:**
1. User must retry connecting all 3 Xero accounts
2. Check \`xero_connections\` table has records
3. Check \`organizations\` table has matching records
4. Verify \`organization_id\` foreign keys are populated

**Files Changed:**
- \`supabase/migrations/020_add_organization_id_to_xero_connections.sql\` (created)
- \`app/api/auth/xero/callback/route.ts:162\` (uses organization_id)`
  },
  {
    title: 'Single-User Mode Not Respected in Auth Middleware',
    priority: 0,
    status: 'Done',
    labels: ['bug', 'authentication', 'single-user-mode'],
    description: `All protected API endpoints returned 401 errors even when \`SINGLE_USER_MODE=true\` was set in environment variables. This prevented dashboard from loading organization data.

**Root Cause:**
\`lib/auth/middleware.ts\` didn't check \`SINGLE_USER_MODE\` environment variable, forcing authentication even in single-user deployments.

**Fix Applied:**
- Added \`SINGLE_USER_MODE\` check at start of \`authMiddleware\` function (lines 75-88)
- Returns mock user \`{id: 'single-user', email: 'single-user@local', role: 'owner'}\` when enabled
- Uses service client instead of user-specific auth

**Files Changed:**
- \`lib/auth/middleware.ts:75-88\` (commit 70e707a)`
  },
  {
    title: 'Hardcoded Single-User Mode Flag in Code',
    priority: 1,
    labels: ['bug', 'configuration', 'technical-debt'],
    description: `Multiple API routes have \`const SINGLE_USER_MODE = process.env.SINGLE_USER_MODE === 'true' || true\` which ALWAYS evaluates to true, bypassing environment variable.

**Impact:**
- Multi-user mode will not work even if environment variable is unset
- Security risk: auth can't be enforced in production
- Testing difficulty: can't toggle modes without code changes

**Affected Files:**
- \`app/api/audit/analyze/route.ts:36\`
- \`app/api/xero/organizations/route.ts:7\` (already fixed to remove \`|| true\`)
- Potentially others (needs grep audit)

**Recommended Fix:**
\`\`\`typescript
// Remove || true fallback
const SINGLE_USER_MODE = process.env.SINGLE_USER_MODE === 'true'
\`\`\`

**Verification:**
\`\`\`bash
grep -r "SINGLE_USER_MODE.*||.*true" app/api/
\`\`\``
  },
  {
    title: 'Silent Failures in OAuth Callback',
    priority: 1,
    labels: ['bug', 'error-handling', 'oauth', 'ux'],
    description: `When database inserts fail in OAuth callback (due to schema mismatch or other errors), the callback still redirects to \`?connected=true\` giving false success indicator.

**Impact:**
- Users think connection succeeded when it failed
- No error message shown to user
- Difficult to diagnose without checking server logs

**Affected Code:**
\`app/api/auth/xero/callback/route.ts:160-176\`

**Recommended Fix:**
\`\`\`typescript
const { error: connectionError } = await supabase
    .from('xero_connections')
    .upsert({...})

if (connectionError) {
    console.error('Failed to save Xero connection:', connectionError)
    // Redirect with error parameter
    return NextResponse.redirect(
        \`\${redirectUrl}?error=connection_failed&message=\${encodeURIComponent(connectionError.message)}\`
    )
}
\`\`\``
  },
  {
    title: 'Environment Variables Not Validated at Startup',
    priority: 1,
    labels: ['enhancement', 'configuration', 'devx'],
    description: `Missing or invalid environment variables (like \`GOOGLE_AI_API_KEY\`, \`XERO_CLIENT_ID\`) are only discovered when features are used, not at application startup.

**Impact:**
- Runtime errors in production
- Poor developer experience
- Difficult to diagnose configuration issues

**Recommended Fix:**
Create startup validation in \`lib/config/env.ts\`:
\`\`\`typescript
export function validateRequiredEnv() {
  const required = [
    'NEXT_PUBLIC_SUPABASE_URL',
    'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    'SUPABASE_SERVICE_ROLE_KEY',
    'XERO_CLIENT_ID',
    'XERO_CLIENT_SECRET',
  ]

  const missing = required.filter(key => !process.env[key])

  if (missing.length > 0) {
    throw new Error(\`Missing required env vars: \${missing.join(', ')}\`)
  }
}
\`\`\`

Call in \`app/layout.tsx\` or \`middleware.ts\`.`
  },
  {
    title: 'Rate Limit Handling Issues',
    priority: 1,
    labels: ['bug', 'rate-limiting', 'reliability'],
    description: `All 4 comprehensive testing agents hit rate limits and failed to complete full testing. System doesn't gracefully handle Claude API rate limits.

**Evidence:**
\`\`\`
"error": "rate_limit"
"message": "You've hit your limit · resets 6pm (Australia/Brisbane)"
\`\`\`

**Impact:**
- Automated testing can't complete
- May affect production AI analysis features
- No retry logic or backoff strategy

**Recommended Fix:**
1. Implement exponential backoff in \`lib/ai/forensic-analyzer.ts\`
2. Add rate limit detection and queuing
3. Show user-friendly message when rate limited
4. Consider adding Redis-based rate limiting tracker`
  },
  {
    title: 'Missing Database Column Documentation',
    priority: 2,
    labels: ['documentation', 'technical-debt'],
    description: `Migration \`020_add_organization_id_to_xero_connections.sql\` adds column that wasn't in original schema. Schema documentation (\`supabase/schema.sql\`) is out of sync with applied migrations.

**Impact:**
- New developers see incorrect schema
- Schema drift between documentation and reality
- Difficult to understand database structure

**Files Affected:**
- \`supabase/schema.sql\` (lines 14-42) - missing \`organization_id\`
- \`supabase/migrations/001_create_xero_connections.sql\` - original migration

**Recommended Fix:**
1. Update \`supabase/schema.sql\` to include \`organization_id\` column
2. Add comments explaining multi-org support
3. Consider regenerating schema from live database: \`supabase db dump --schema public\``
  },
  {
    title: 'Agent Testing Hit Rate Limits',
    priority: 2,
    labels: ['testing', 'infrastructure', 'rate-limiting'],
    description: `Comprehensive system testing requested by user couldn't complete due to rate limits:
- Agent ae3c284 (OAuth testing) - rate limited
- Agent a2a1d78 (Data sync testing) - rate limited
- Agent ac5fa31 (Code review) - rate limited
- Agent abd9a97 (Feature mapping) - still running

**Impact:**
- Incomplete test coverage
- Can't verify all system functionality
- Delayed issue identification

**Recommendations:**
1. Space out agent testing over longer period
2. Reduce agent context size to minimize token usage
3. Implement test result caching
4. Consider using multiple API keys for testing`
  },
  {
    title: 'Inconsistent SINGLE_USER_MODE Pattern',
    priority: 2,
    labels: ['code-quality', 'consistency'],
    description: `Different API routes implement single-user mode checks differently:
- Some check at function start
- Some check in middleware
- Some have \`|| true\` fallback
- Inconsistent variable naming

**Affected Files:**
- \`app/api/xero/organizations/route.ts:7\`
- \`app/api/audit/analyze/route.ts:36\`
- \`lib/auth/middleware.ts:76\`

**Recommended Fix:**
1. Centralize single-user mode check in middleware
2. Remove all inline checks from route handlers
3. Use \`requireAuth\` or \`requireAuthOnly\` consistently
4. Document pattern in CLAUDE.md`
  },
  {
    title: 'Missing Error Context in Callback',
    priority: 2,
    labels: ['logging', 'observability'],
    description: `OAuth callback errors don't include sufficient context for debugging:
- No tenant_id in error logs
- No user_id in error logs
- No timestamp correlation

**Recommended Fix:**
\`\`\`typescript
console.error('Failed to save Xero connection:', {
    error: connectionError,
    tenantId: tenant.tenantId,
    userId: userId || 'single-user',
    timestamp: new Date().toISOString(),
    step: 'database_insert'
})
\`\`\``
  }
];

// Linear GraphQL API helper
function linearQuery(query, variables = {}) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({ query, variables });

    const options = {
      hostname: 'api.linear.app',
      path: '/graphql',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': LINEAR_API_KEY,
        'Content-Length': data.length
      }
    };

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        try {
          const response = JSON.parse(body);
          if (response.errors) {
            reject(new Error(response.errors[0].message));
          } else {
            resolve(response.data);
          }
        } catch (e) {
          reject(e);
        }
      });
    });

    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

async function getTeamId() {
  console.log('🔍 Finding team ID...');
  const query = `
    query {
      teams {
        nodes {
          id
          name
          key
        }
      }
    }
  `;

  const data = await linearQuery(query);
  const team = data.teams.nodes.find(t => t.key === LINEAR_TEAM_ID || t.name.includes('Unite'));

  if (!team) {
    throw new Error(`Team not found: ${LINEAR_TEAM_ID}`);
  }

  console.log(`✅ Found team: ${team.name} (${team.id})`);
  return team.id;
}

async function getProjectId(teamId) {
  console.log('🔍 Finding project ID...');
  const query = `
    query {
      projects {
        nodes {
          id
          name
          slugId
        }
      }
    }
  `;

  const data = await linearQuery(query);
  const project = data.projects.nodes.find(p =>
    p.name.toLowerCase().includes('ato') || p.slugId?.includes('ato')
  );

  if (!project) {
    console.log('   Available projects:');
    data.projects.nodes.forEach(p => console.log(`     - ${p.name} (${p.slugId})`));
    throw new Error(`Project not found with name containing 'ato'`);
  }

  console.log(`✅ Found project: ${project.name} (${project.id})`);
  return project.id;
}

async function createIssue(teamId, projectId, issue) {
  const query = `
    mutation($input: IssueCreateInput!) {
      issueCreate(input: $input) {
        success
        issue {
          id
          identifier
          title
          url
        }
      }
    }
  `;

  const input = {
    teamId,
    projectId,
    title: issue.title,
    description: issue.description,
    priority: issue.priority,
    labelIds: [], // Would need to fetch/create labels first
  };

  if (issue.status === 'Done') {
    // Get workflow state ID for "Done"
    // For now, just create as backlog
  }

  try {
    const data = await linearQuery(query, { input });
    if (data.issueCreate.success) {
      return data.issueCreate.issue;
    } else {
      throw new Error('Failed to create issue');
    }
  } catch (error) {
    console.error(`❌ Failed to create issue: ${issue.title}`);
    console.error(`   Error: ${error.message}`);
    return null;
  }
}

async function main() {
  console.log('\n🚀 Creating Linear Issues from Priority List\n');

  try {
    const teamId = await getTeamId();
    const projectId = await getProjectId(teamId);

    console.log(`\n📝 Creating ${issues.length} issues...\n`);

    let created = 0;
    let failed = 0;

    for (const issue of issues) {
      console.log(`   ${issue.title}`);
      const result = await createIssue(teamId, projectId, issue);

      if (result) {
        console.log(`   ✅ Created: ${result.identifier} - ${result.url}`);
        created++;
      } else {
        failed++;
      }

      // Rate limit: wait 1 second between requests
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    console.log(`\n✅ Summary:`);
    console.log(`   Created: ${created}`);
    console.log(`   Failed: ${failed}`);
    console.log(`\n🔗 View issues: https://linear.app/unite-hub/project/ato-3f31f766c467/issues\n`);

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    process.exit(1);
  }
}

main();
