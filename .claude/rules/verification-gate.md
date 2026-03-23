# Verification Gate — Always-On Rule

> **Authority**: Always loaded. Applies to ALL tasks.
> **Purpose**: Prevents Claude from declaring work complete before visual confirmation.

## The Rule

Before claiming any task is done, Claude MUST produce a **VERIFICATION CHECKLIST** with:
1. Where to check
2. How to get there
3. What to see
4. What NOT to see
5. Confirmation prompt

## Banned Completion Phrases

- "The feature is now complete"
- "Everything is working as expected"
- "I've implemented everything you requested"
- "Ready for testing"
- "Done" / "All set"

## Exceptions

Does NOT apply to: documentation-only, config, test-only, or git operations.
