# Specification: Australian Tax Optimizer (ATO) Platform

## Purpose and Scope

### Mission

The ATO platform is a tax recovery and optimisation system targeting $200K-$500K recovery per client through integration with Xero accounting data and AI-powered forensic analysis.

### Scope

| In Scope | Out of Scope |
|----------|--------------|
| Tax analysis and opportunity identification | ATO filing and submission |
| Xero data extraction (read-only) | Ledger modification |
| AI forensic transaction analysis | Binding tax advice |
| Report generation | Investment recommendations |
| R&D Tax Incentive assessment | Superannuation advice |

### Stakeholders

- **Primary Users**: Business owners, financial controllers
- **Secondary Users**: Tax accountants (receiving reports)
- **Compliance**: All recommendations require professional review

---

## Data Requirements

### Data Source Policy

```xml
<critical_requirement>
ALL displayed values must be sourced from:
1. Xero-derived: From Xero API (transactions, reports, accounts)
2. Government-derived: From ATO/official sources with citation metadata

NO client-side fabrication. NO mock data. NO synthetic placeholders.
</critical_requirement>
```

### Xero Integration Requirements

#### Required Scopes (Read-Only)

```
offline_access
openid profile email
accounting.settings.read
accounting.transactions.read
accounting.reports.read
accounting.contacts.read
```

#### Data Extraction Points

| Endpoint | Data | Purpose |
|----------|------|---------|
| `/Transactions` | Bank transactions, invoices, journals | Tax analysis |
| `/Reports/ProfitAndLoss` | P&L by financial year | Loss tracking |
| `/Reports/BalanceSheet` | Current financial position | Division 7A |
| `/Accounts` | Chart of accounts | Classification audit |
| `/Organisation` | Business details, ABN | Entity context |

#### OAuth Token Management

- Refresh tokens 5 minutes before expiry
- Retry failed requests with exponential backoff
- Log token refresh operations (truncate sensitive data to 8 chars)
- Store tokens encrypted at rest

### Government Data Requirements

#### ATO Rate Store Schema

```typescript
interface GovernmentRateRecord {
  key: string;              // 'rnd_offset_rate', 'corporate_tax_rate'
  value: number;
  effective_from: string;   // ISO date
  effective_to: string;     // ISO date or null
  source_url: string;       // ATO.gov.au URL
  source_title: string;
  retrieved_at: string;     // ISO timestamp
  financial_year: string;   // 'FY2024-25'
}
```

#### Required Government Rates

| Key | Source | Update Frequency |
|-----|--------|-----------------|
| `rnd_offset_rate` | Division 355 ITAA 1997 | Annually |
| `corporate_tax_rate_small` | s 23AA | Annually |
| `corporate_tax_rate_standard` | s 23 | Annually |
| `div7a_benchmark_rate` | s 109N | Annually |
| `instant_writeoff_threshold` | s 328-180 | Per budget |
| `fbt_rate` | FBTAA 1986 | Annually |

---

## API Contract Standards

### Request/Response Format

#### Standard Success Response

```typescript
interface ApiSuccessResponse<T> {
  success: true;
  data: T;
  meta?: {
    page?: number;
    pageSize?: number;
    totalCount?: number;
  };
  timestamp: string;  // ISO format
}
```

#### Standard Error Response

```typescript
interface ApiErrorResponse {
  error: string;           // User-friendly message
  errorId: string;         // Unique ID for log correlation
  timestamp: string;
  context?: Record<string, unknown>;  // Dev only
}
```

### HTTP Status Codes

| Code | Usage |
|------|-------|
| 200 | Success |
| 400 | Validation error (bad input) |
| 401 | Authentication required |
| 403 | Forbidden (tenant access denied) |
| 404 | Resource not found |
| 429 | Rate limit exceeded (include Retry-After header) |
| 500 | Server error |
| 503 | Service unavailable (Xero, AI) |

### Endpoint Conventions

- **Base path**: `/api`
- **Resource naming**: Plural nouns (`/transactions`, `/reports`)
- **Actions**: Use HTTP verbs (GET=read, POST=create/action)
- **Filtering**: Query params (`?financialYear=FY2024-25`)

### Required API Endpoints

#### Authentication

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/auth/xero/connect` | GET | Initiate OAuth flow |
| `/api/auth/xero/callback` | GET | OAuth callback |
| `/api/auth/xero/disconnect` | POST | Revoke connection |

#### Xero Data

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/xero/organisations` | GET | List connected organisations |
| `/api/xero/transactions` | GET | Fetch transactions |
| `/api/xero/reports` | GET | Fetch financial reports |

#### Audit Operations

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/audit/analyze` | POST | Start AI analysis |
| `/api/audit/analysis-status/{tenantId}` | GET | Poll analysis progress |
| `/api/audit/analysis-results` | GET | Get analysis results |
| `/api/audit/recommendations` | GET | Get findings |
| `/api/audit/rnd-summary` | GET | R&D opportunities |
| `/api/audit/opportunities-by-year` | GET | Year breakdown |

#### Reports

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/reports/download-pdf` | POST | Generate PDF report |
| `/api/reports/download-excel` | POST | Generate Excel export |
| `/api/reports/amendment-schedules` | GET | Amendment preparation |

---

## Security Requirements

### Authentication & Authorisation

#### Multi-User Authentication

- Use Supabase Auth for user management
- Implement authentication middleware on all API routes
- Return 401 for unauthenticated requests
- Return 403 for unauthorised tenant access

#### Tenant Isolation

```typescript
// Every data request must validate tenant ownership
async function validateTenantAccess(userId: string, tenantId: string): Promise<boolean> {
  const { data } = await supabase
    .from('user_tenant_access')
    .select('tenant_id')
    .eq('user_id', userId)
    .eq('tenant_id', tenantId)
    .single();

  return !!data;
}
```

#### Xero OAuth 2.0

- Use PKCE extension for additional security
- Store tokens encrypted in Supabase
- Implement token refresh before expiry
- Revoke tokens on disconnect

### Environment Variables

```env
# REQUIRED (application will fail without these)
XERO_CLIENT_ID=<from Xero Developer Portal>
XERO_CLIENT_SECRET=<from Xero Developer Portal>
XERO_REDIRECT_URI=https://ato-blush.vercel.app/api/auth/xero/callback
SUPABASE_SERVICE_ROLE_KEY=<from Supabase>
NEXT_PUBLIC_SUPABASE_URL=<from Supabase>
NEXT_PUBLIC_SUPABASE_ANON_KEY=<from Supabase>

# OPTIONAL (with graceful fallbacks)
GOOGLE_AI_API_KEY=<for Gemini AI - analysis disabled without>
TOKEN_ENCRYPTION_KEY=<32-byte hex key for token encryption>
```

### Data Security

#### Sensitive Data Handling

- Never log full tokens (truncate to first 8 characters)
- Sanitise error messages in production
- Use parameterised queries (Supabase handles this)
- Encrypt tokens at rest with AES-256-GCM

#### Read-Only Guarantee

```xml
<critical_requirement>
The platform MUST only READ from Xero. NEVER modify:
- Transactions
- Accounts
- Contacts
- Any other Xero data
</critical_requirement>
```

### API Security

#### Rate Limiting

| Service | Limit | Backoff Strategy |
|---------|-------|------------------|
| Xero API | 60/minute | Exponential (1s, 2s, 4s) |
| Gemini AI (free) | 15/minute | 4-second delay between requests |
| API endpoints | 60/minute per user | Return 429 with Retry-After |

#### Input Validation

- Validate all request bodies before processing
- Sanitise file paths and identifiers
- Reject requests with unexpected fields
- Type-check all parameters using Zod schemas

```typescript
import { z } from 'zod';

const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(50)
});

const tenantIdSchema = z.string().uuid();

const financialYearSchema = z.string().regex(
  /^FY\d{4}-\d{2}$/,
  'Invalid financial year format. Expected: FY2024-25'
);
```

---

## Testing Requirements

### Test Categories

#### Unit Tests

| Area | Requirements |
|------|-------------|
| Tax calculations | Verify formulas match legislation |
| Date handling | Australian FY boundaries |
| Validators | Each validator has test cases |
| Error handling | All error paths tested |

#### Integration Tests

| Scenario | Requirements |
|----------|-------------|
| Xero OAuth flow | Complete connect/disconnect cycle |
| Data sync | Historical data fetching |
| AI analysis | End-to-end transaction analysis |

#### Regression Tests

- No `MOCK_` references in UI components
- All API endpoints return empty arrays (not defaults) when no data
- Empty states render correctly

### Test Framework

```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./tests/setup.ts'],
    coverage: {
      reporter: ['text', 'html'],
      threshold: { lines: 80 }
    }
  }
});
```

### Validation Test Protocol

```bash
# Run all validators with test data
/test-validators

# Expected output for each validator:
# - PASS with valid data
# - FAIL with invalid data + fix instructions
```

### Test Data Requirements

- Use real Xero demo company data where available
- Document test account credentials separately
- Never commit actual business data

---

## Architectural Principles

### Modularity

#### Engine Separation

Each tax domain has its own analysis engine:

```
lib/analysis/
├── rnd-engine.ts      # Division 355 R&D
├── deduction-engine.ts # Section 8-1 deductions
├── loss-engine.ts     # Subdivision 36-A losses
├── div7a-engine.ts    # Division 7A loans
└── fbt-engine.ts      # Fringe Benefits Tax
```

#### Agent Specialisation

Each agent handles one tax area:

```
.agent/agents/
├── rnd_tax_specialist/     # R&D only
├── deduction_optimizer/    # Deductions only
├── loss_recovery_agent/    # Losses only
└── ...
```

### Scalability

#### Batch Processing

- AI analysis: Max 100 transactions per batch
- Configurable batch size via API
- Progress reporting for long operations

#### Caching Strategy

| Data | TTL | Storage |
|------|-----|---------|
| Tax rates | 24 hours | In-memory |
| Xero transactions | Until re-sync | Supabase |
| Analysis results | Permanent | Supabase |

### Extensibility

#### Adding New Tax Domains

1. Create analysis engine in `lib/analysis/`
2. Create agent in `.agent/agents/`
3. Add validator in `.claude/hooks/validators/`
4. Create API endpoint in `app/api/`
5. Add UI in `app/dashboard/`

#### Plugin Points

- Validators: Hook into post_tool_use events
- Agents: Register in `.agent/AGENTS.md`
- Skills: Define in `.agent/skills/`

---

## UI Requirements

### Empty State Handling

```xml
<critical_requirement>
Every data-driven component MUST handle empty states:
</critical_requirement>
```

```tsx
{transactions.length === 0 ? (
  <EmptyState
    title="No transactions found"
    description="Connect your Xero organisation to see transactions."
    action={<ConnectXeroButton />}
  />
) : (
  <TransactionList transactions={transactions} />
)}
```

### Loading States

- Show skeleton loaders during data fetch
- Display progress for long operations (AI analysis)
- Provide cancel option for operations > 30 seconds

### Data Attribution

All displayed values must show source:

```tsx
<Stat
  label="R&D Offset Rate"
  value="43.5%"
  source="Division 355 ITAA 1997"
  financialYear="FY2024-25"
/>
```

### Confidence Indicators

```tsx
<ConfidenceBadge level={confidence}>
  {confidence >= 80 ? 'High' : confidence >= 60 ? 'Medium' : 'Low'}
</ConfidenceBadge>
```

---

## Compliance Requirements

### Disclaimer Requirements

Every report and recommendation must include:

```
DISCLAIMER: This analysis is provided for informational purposes only and
does not constitute tax advice. All recommendations should be reviewed by
a qualified tax professional before implementation. [Business Name] and
its affiliates accept no liability for actions taken based on this analysis.
```

### Citation Standards

Every tax recommendation must include:

1. **Legislation reference** (e.g., Division 355 ITAA 1997)
2. **ATO ruling/guidance** (where applicable)
3. **Financial year applicability**
4. **Deadline dates** (for time-sensitive claims)

### Audit Trail

Log all significant operations:

- Xero connections/disconnections
- Analysis start/completion
- Report generation
- Recommendation actions

### Professional Review Flags

High-value findings (>$50,000) must be flagged:

```typescript
if (estimatedBenefit > 50000) {
  recommendation.flags.push('REQUIRES_PROFESSIONAL_REVIEW');
  recommendation.notes.push('High-value claim - recommend ATO private ruling');
}
```

---

## Acceptance Criteria

### Data Integrity

- [ ] No mock/demo arrays or hard-coded example values rendered
- [ ] All data rendered is sourced from Xero or official government resources
- [ ] Empty states appear where data is unavailable
- [ ] UI copy does not claim or imply demo data

### API Quality

- [ ] All endpoints return appropriate HTTP status codes
- [ ] Error responses include errorId for correlation
- [ ] Validation errors return 400 with specific messages
- [ ] Rate limiting returns 429 with Retry-After header

### Security

- [ ] Unauthenticated requests return 401
- [ ] Cross-tenant access returns 403
- [ ] Tokens encrypted in database
- [ ] Debug endpoints blocked in production
- [ ] No secrets in logs or error responses
- [ ] All inputs validated before processing

### Testing

- [ ] Unit tests for all tax calculations
- [ ] Integration tests for Xero OAuth flow
- [ ] Validators pass with valid data, fail with invalid
- [ ] No MOCK_ references in production code
- [ ] Coverage > 80%

### Documentation

- [ ] All API endpoints documented with request/response examples
- [ ] Tax legislation references accurate and current
- [ ] CLAUDE.md provides clear coding standards
- [ ] README includes setup instructions

---

## Database Schema

### Core Tables

```sql
-- User-tenant relationship for multi-user access
CREATE TABLE user_tenant_access (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  tenant_id TEXT NOT NULL,
  role TEXT DEFAULT 'viewer' CHECK (role IN ('owner', 'admin', 'viewer')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, tenant_id)
);

-- Row Level Security
ALTER TABLE user_tenant_access ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own access" ON user_tenant_access
  FOR SELECT USING (auth.uid() = user_id);
```

### Xero Connections

```sql
CREATE TABLE xero_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id TEXT UNIQUE NOT NULL,
  tenant_name TEXT,
  access_token_encrypted TEXT NOT NULL,  -- AES-256-GCM encrypted
  refresh_token_encrypted TEXT NOT NULL, -- AES-256-GCM encrypted
  expires_at BIGINT NOT NULL,
  connected_at TIMESTAMPTZ DEFAULT NOW(),
  last_synced_at TIMESTAMPTZ
);
```

---

## Deployment

### Vercel Configuration

- **Framework**: Next.js
- **Build Command**: `npm run build`
- **Output Directory**: `.next`
- **Node Version**: 20.x

### Environment Setup

1. Configure environment variables in Vercel dashboard
2. Update Xero Developer Portal with production redirect URI
3. Run database migrations via Supabase dashboard
4. Verify Gemini API key is active

### Production Checklist

- [ ] All environment variables set
- [ ] Xero OAuth redirect URI matches deployment URL
- [ ] Database migrations applied
- [ ] Error monitoring configured (Sentry recommended)
- [ ] Rate limiting active
- [ ] Token encryption key generated and stored
