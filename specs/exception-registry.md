# Exception Registry — ATO Platform
# Documented exceptions to Swarm Enforcement Rule 9

Each exception has a key, justification, scope, and review date.
Exceptions are NOT blanket approvals — they apply only within the stated scope.

---

## XERO-SDK-CAST

**Rule:** No `any` type
**Exception:** `any[]` casting permitted for Xero SDK response bodies
**Scope:** Files in `lib/xero/`, and Xero response handling in `app/api/xero/`

**Justification:**
xero-node v13+ returns SDK types with optional fields that don't align with
our local interfaces (XeroContact, XeroAsset, etc.). The SDK types have
deeply nested optionals that make strict typing impractical at the boundary.

**Pattern:**
```typescript
// PERMITTED: Xero SDK boundary casting
const contacts = (response.body.contacts || []) as any[];

// NOT PERMITTED: any deeper in the codebase
const data: any = getStuff(); // STILL A FAILURE
```

**Review:** When xero-node releases improved type exports


## XERO-SDK-WORKAROUND

**Rule:** No `@ts-ignore` without justification
**Exception:** `@ts-ignore` or `@ts-expect-error` permitted for Xero SDK enum issues
**Scope:** Files in `lib/xero/` only

**Justification:**
Xero SDK v13+ uses TypeScript enums (AccountType, StatusEnum, CurrencyCode)
that are not assignable to `string` in strict mode. Some SDK methods require
enum values but accept string at runtime.

**Pattern:**
```typescript
// PREFERRED: Use String() conversion
const status = String(contact.contactStatus);

// PERMITTED: When String() doesn't work (rare SDK edge cases)
// @ts-expect-error xero-node v13 enum not assignable to string param
xeroClient.accountingApi.getContacts(tenantId, undefined, filter);
```

**Review:** When xero-node fixes enum type exports


## API-ERROR-CONTEXT

**Rule:** No `console.log` in production code
**Exception:** `console.warn` and `console.error` permitted in API route catch blocks
**Scope:** `app/api/**/*.ts` — catch blocks only

**Justification:**
Next.js server-side logging uses console methods for Vercel log streaming.
The project does not yet have a structured logging library. This exception
is temporary.

**Pattern:**
```typescript
// PERMITTED: In API route catch blocks
catch (error) {
  console.error('Analysis failed:', { operation, tenantId, error });
  return createErrorResponse(error, context, 500);
}

// NOT PERMITTED: Debug logging left in production
console.log('got here');           // FAILURE
console.log('data:', someObject);  // FAILURE
```

**Review:** When structured logging (e.g., pino, winston) is implemented


## DEFERRED-COMPLIANCE

**Rule:** No `// TODO` or `// FIXME`
**Exception:** Permitted for items tracked in the Deferred Compliance registry
**Scope:** `lib/analysis/` engine files

**Justification:**
Certain compliance items are intentionally deferred per the remediation plan.
These are tracked in `CLAUDE.md` under "Deferred Compliance Items" and have
corresponding Linear issues.

**Known deferred items:**
- R-3: R&D clawback (s 355-450)
- 7A-3: Amalgamated loans
- 7A-4: Safe harbour exclusions
- T-1: Ordinary family dealing
- T-2: Trustee penalty 47% not 45%
- L-2: SBT implementation

**Pattern:**
```typescript
// PERMITTED: References a tracked deferred item
// TODO(R-3): Implement R&D clawback per s 355-450 — LINEAR-XXX

// NOT PERMITTED: Vague or untracked TODOs
// TODO: fix this later
// FIXME: something is wrong here
```

**Review:** Each deferred item reviewed quarterly per remediation plan


## TAX-ENGINE-CALC

**Rule:** Functions must be < 50 lines
**Exception:** Tax calculation functions may exceed 50 lines
**Scope:** `lib/analysis/*-engine.ts` — primary calculation functions only

**Justification:**
ATO compliance calculations (R&D offset tiers, Division 7A minimum repayment
schedules, CGT discount cascades) involve multi-step legislative logic that
reads more clearly as a single function than split across helpers. Splitting
risks obscuring the legislative flow that auditors need to trace.

**Constraints:**
- Maximum 80 lines (hard limit, even for tax engines)
- Must include inline comments referencing the ITAA section
- Each logical step (legislative test) should be visually separated
- If >80 lines, must be decomposed

**Review:** Per engine, when legislative logic changes


## NEXT-ROUTE-ASYNC-PARAMS

**Rule:** General TypeScript strictness
**Exception:** Next.js 16 route params require Promise wrapping
**Scope:** `app/**/*.ts` route handlers

**Justification:**
Next.js 16 changed route handler params to be Promise-wrapped. This is a
framework requirement, not a code quality issue.

**Pattern:**
```typescript
// REQUIRED by Next.js 16
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  // ...
}
```
