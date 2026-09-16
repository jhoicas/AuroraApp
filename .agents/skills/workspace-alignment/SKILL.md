---
name: workspace-alignment
description: "Use when coordinating changes across GitHub Copilot, Cursor and Antigravity in AuroraApp; reads AI_CHANGELOG.md, applies docs/kb standards, records decisions and validates Go, React or Supabase changes."
---

# Workspace Alignment

## Purpose

Coordinate a complete change in AuroraApp while preserving context across AI assistants and protecting domain and tenant boundaries.

## Required inputs

Before acting, read:

1. `AI_CHANGELOG.md`
2. The relevant file and neighboring tests
3. The applicable files under `docs/kb/`
4. `docs/adr/` when the change affects architecture, schema, security, providers or public contracts

## Autonomous workflow

1. Inspect repository status and identify concurrent edits.
2. State the requested outcome, affected bounded context, invariants and one falsifiable implementation hypothesis.
3. Choose the smallest change that addresses the root cause.
4. For database work, verify tenant isolation, RLS, grants, migrations and rollback/compatibility needs.
5. For Go work, preserve dependency direction, context cancellation, error classification and testability.
6. For React work, preserve typed boundaries, accessibility, cancellation and separation between server and UI state.
7. Add or update focused tests before broad refactoring.
8. Run the narrowest useful validation, then the relevant full validation when practical.
9. Create or update an ADR for structural decisions.
10. Prepend a factual session entry to `AI_CHANGELOG.md` with files, behavior, dependencies, validation and risks.

## Completion criteria

- No unrelated files are changed.
- No secrets or service-role credentials are introduced.
- Tenant-scoped reads and writes cannot cross tenant boundaries.
- Tests or validation evidence cover the changed behavior.
- Shared documentation records assumptions and unresolved work.

## Output format

Report:

- Summary of implemented behavior
- Files changed
- Validation commands and results
- ADRs created or updated
- Risks, conflicts and follow-up work
