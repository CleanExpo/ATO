# CONSTITUTION — Immutable Rules

> **Authority**: Human-only editable. Agents read, never write.
> **Purpose**: Context drift defence. Re-read after every compaction.

---

## Identity

- **Project**: Australian Tax Optimizer (ATO) — multi-jurisdiction tax recovery platform
- **Jurisdictions**: AU (ATO), NZ (IRD), UK (HMRC)
- **Stack**: Next.js 16.1, React 19, TypeScript 5, Supabase PostgreSQL 15, Gemini 3 Flash
- **Deployment**: Vercel (syd1 region), live at https://ato-blush.vercel.app
- **Locale**: en-AU (colour, behaviour, optimisation, organised, licence). Dates: DD/MM/YYYY. Currency: AUD/NZD/GBP.

## Non-Negotiable Rules

1. **Read-only Xero access** — Never request write/delete OAuth scopes
2. **Advisory only** — Never file with ATO/IRD/HMRC. No lodgement. No submission.
3. **Verification before completion** — Never claim "done" without proof (test output, build pass, screenshot)
4. **TDD enforcement** — Failing test → watch fail → minimal code → watch pass → refactor
5. **Anti-hallucination** — Never invent API endpoints, DB schemas, file paths, env vars, or package versions
6. **Legislative citations** — Every tax engine result must cite the specific Act, Division, or Section
7. **Tenant isolation** — RLS on all user data. AES-256-GCM on stored tokens. Never leak cross-tenant.
8. **Additive changes** — Prefer new files over modifying existing code. Zero existing engine modifications unless explicitly approved.

## Retrieval Order

1. Memory files (this file, current-state.md, architectural-decisions.md)
2. Context7 MCP (library docs)
3. Skills (.agent/skills/)
4. Codebase search (Grep/Glob)
5. Web search (last resort)

## Design System

- OLED black `#050505`, spectral accents (Cyan `#00F5FF`, Emerald `#00FF88`, Amber `#FFB800`, Red `#FF4444`)
- `rounded-sm` only (exception: orbs/status use `rounded-full`)
- Framer Motion only — no CSS transitions
- Borders: `border-[0.5px] border-white/[0.06]`
