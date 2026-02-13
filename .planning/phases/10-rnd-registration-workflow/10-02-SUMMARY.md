# SUMMARY 10-02: R&D Evidence Collection Wizard

## Plan Executed
`.planning/phases/10-rnd-registration-workflow/10-02-PLAN.md`

## Objective
Build an interactive wizard that guides users through collecting and organizing evidence for each element of the Division 355 four-element test, with document upload integration and evidence sufficiency scoring.

## Execution Summary

### Task 1: Evidence Requirements Schema
**Commit:** `300236e`

Created database schema and TypeScript types for R&D evidence collection.

**Files Created:**
- `lib/supabase/migrations/20260127_rnd_evidence.sql` - SQL migration for rnd_evidence and rnd_evidence_scores tables
- `lib/types/rnd-evidence.ts` - TypeScript interfaces, enums, and helper functions

**Schema Features:**
- Evidence items linked to registration and project
- Four element types: outcome_unknown, systematic_approach, new_knowledge, scientific_method
- Evidence types: document, description, reference
- Contemporaneous evidence flag for ATO audit strength
- Evidence sufficiency scores per element (0-100)

---

### Task 2: Evidence Collection API
**Commit:** `8dd0c35`

Created 3 API route files for evidence CRUD operations and scoring.

**Files Created:**
- `app/api/rnd/evidence/route.ts` - GET/POST for listing and creating evidence
- `app/api/rnd/evidence/[id]/route.ts` - GET/PATCH/DELETE for individual evidence items
- `app/api/rnd/evidence/score/route.ts` - GET for calculating evidence sufficiency scores

**API Features:**
- Tenant-scoped evidence management
- Validation for evidence type requirements (document needs documentId, reference needs URL)
- Score calculation based on:
  - Evidence count per element (0-3 = low, 4-6 = medium, 7+ = high)
  - Document uploads (bonus points)
  - Contemporaneous evidence (bonus points)
  - Description quality (text length proxy)

---

### Task 3: Wizard Components
**Commit:** `697c3cf`

Created 5 React components for the evidence collection wizard.

**Files Created:**
- `components/rnd/EvidenceWizard.tsx` - 4-step wizard container with navigation and progress
- `components/rnd/EvidenceElementStep.tsx` - Per-element evidence collection with guidance display
- `components/rnd/EvidenceItem.tsx` - Individual evidence card with edit/delete actions
- `components/rnd/EvidenceUpload.tsx` - Document upload component for evidence files
- `components/rnd/EvidenceScoreIndicator.tsx` - Visual score display (bar and circular variants)

**Component Features:**
- Scientific Luxury design system (OLED black, spectral colours)
- Framer Motion animations for transitions
- Score indicators with colour coding (red/amber/green)
- Drag-and-drop file upload
- Contemporaneous evidence badge
- Compact and expanded evidence item variants

---

### Task 4: Evidence Guidance Content
**Commit:** `38bcd53`

Created comprehensive guidance content for each four-element test element.

**Files Created:**
- `lib/rnd/evidence-guidance.ts` - Guidance content with descriptions, examples, suggested documents

**Content Includes:**
- Detailed description of what each element requires
- 8+ examples of acceptable evidence per element
- 8+ suggested documents to collect per element
- ATO guidance notes
- Warning notes about common pitfalls

---

### Task 5: Integration
**Commit:** `f784bf9`

Integrated wizard into existing R&D workflow pages.

**Files Created:**
- `app/dashboard/forensic-audit/rnd/evidence/page.tsx` - Evidence wizard page with project context

**Files Updated:**
- `app/dashboard/forensic-audit/rnd/page.tsx` - Added "Collect Evidence" button to project cards
- `components/rnd/RegistrationWorkflow.tsx` - Added evidence wizard link to step 1 (Prepare Documentation)
- `components/rnd/index.ts` - Exported all new evidence wizard components

---

## Files Created (Total: 12)

| Category | File Path |
|----------|-----------|
| Migration | `lib/supabase/migrations/20260127_rnd_evidence.sql` |
| Types | `lib/types/rnd-evidence.ts` |
| API | `app/api/rnd/evidence/route.ts` |
| API | `app/api/rnd/evidence/[id]/route.ts` |
| API | `app/api/rnd/evidence/score/route.ts` |
| Component | `components/rnd/EvidenceWizard.tsx` |
| Component | `components/rnd/EvidenceElementStep.tsx` |
| Component | `components/rnd/EvidenceItem.tsx` |
| Component | `components/rnd/EvidenceUpload.tsx` |
| Component | `components/rnd/EvidenceScoreIndicator.tsx` |
| Content | `lib/rnd/evidence-guidance.ts` |
| Page | `app/dashboard/forensic-audit/rnd/evidence/page.tsx` |

## Files Updated (Total: 3)

| File Path | Change |
|-----------|--------|
| `app/dashboard/forensic-audit/rnd/page.tsx` | Added "Collect Evidence" button |
| `components/rnd/RegistrationWorkflow.tsx` | Added evidence wizard link in step 1 |
| `components/rnd/index.ts` | Exported new evidence components |

---

## Commit Hashes

| Task | Commit Hash | Message |
|------|-------------|---------|
| Task 1 | `300236e` | feat(10-02): add R&D evidence schema and types |
| Task 2 | `8dd0c35` | feat(10-02): add R&D evidence collection API routes |
| Task 3 | `697c3cf` | feat(10-02): add evidence collection wizard components |
| Task 4 | `38bcd53` | feat(10-02): add R&D evidence guidance content |
| Task 5 | `f784bf9` | feat(10-02): integrate evidence wizard into R&D workflow |

---

## Verification

- [x] `npm run build` succeeds
- [x] Evidence schema created (SQL migration)
- [x] TypeScript types defined with helper functions
- [x] API routes implemented with validation
- [x] Wizard navigates through all four elements
- [x] Score calculation implemented
- [x] Scientific Luxury design system applied
- [x] Integration with existing R&D pages complete

---

## User Journey

1. User navigates to **R&D Analysis** page (`/dashboard/forensic-audit/rnd`)
2. Clicks on an R&D project to expand details
3. Clicks **"Collect Evidence"** button
4. Arrives at **Evidence Wizard** page (`/dashboard/forensic-audit/rnd/evidence?project=...`)
5. Wizard guides through 4 steps (one per element):
   - Outcome Unknown
   - Systematic Approach
   - New Knowledge
   - Scientific Method
6. For each element, user can:
   - Read guidance and examples
   - Add written descriptions
   - Upload documents
   - Add external references
   - Mark evidence as contemporaneous
7. Score updates in real-time showing evidence sufficiency
8. Upon completion, user returns to R&D page with evidence collected

---

## Deviations

None. All tasks completed as specified in the plan.

---

## Technical Notes

### Score Calculation Formula
```
Base Score:
- 0 items: 0
- 1-3 items: 25 base
- 4-6 items: 50 base
- 7+ items: 75 base

Bonuses:
- +5 per document upload (max 15)
- +10 per contemporaneous evidence (max 20)
- +0-10 for description quality (based on length)

Overall: weighted average of all 4 elements (capped at 100)
```

### Design System Applied
- OLED black backgrounds (#050505)
- Spectral colours: cyan (#00F5FF), purple (#8855FF), green (#00FF88)
- Single-pixel borders with rgba transparency
- Physics-based animations via Framer Motion

---

## Next Steps (Plan 10-03)

The next plan should focus on:
1. AusIndustry portal deep linking
2. Schedule 16N document generation
3. Registration completion workflow
4. Evidence export for tax filing
