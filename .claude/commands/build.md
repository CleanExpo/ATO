# /build — Structured Requirements for Non-Coders

> Use this command every time you want Claude to build or change something.

## Usage

```
/build <paste your description here>
```

## STEP 1: EXTRACT REQUIREMENTS

```
WHAT:       [One sentence — what is being built or changed]
WHERE:      [Which page, URL, or area of the app]
WHO:        [Which user role]
WHEN:       [What triggers this]
SHOULD SEE: [What the user sees when it works]
DON'T DO:   [What to avoid]
SUCCESS:    [Observable outcomes]
```

## STEP 2: ECHO BACK

Before writing any code, restate the requirement. Do NOT start coding until the user confirms.

## STEP 3: PRE-IMPLEMENTATION CHECK

Read ROUTE_REFERENCE.md (if exists), CLAUDE.md, and relevant existing files.

## STEP 4: BUILD

Execute the implementation. Follow project rules and design system.

## STEP 5: INTEGRATION CHECKLIST

- [ ] Navigation wired
- [ ] Route mounted
- [ ] Auth gate applied
- [ ] API client connected
- [ ] Design system followed

## STEP 6: VERIFICATION CHECKLIST

```
VERIFICATION CHECKLIST — [Feature Name]

[ ] Go to: [URL]
[ ] You should see: [expected result]
[ ] You should NOT see: [what should be absent]

Reply "looks good" to close this, or describe what's different.
```

**Do NOT say "done" without this checklist.**
