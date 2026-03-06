# AGENTS - NalDadi Engineering Notes

This file defines implementation boundaries and expectations for coding agents and contributors.

## Scope

The app has two product features only:

- `Dice Throw`: compose and execute one throw.
- `Dice Analysis`: compose the same throw format, run many simulated throws, and present stats/charts.

No unrelated game systems should be introduced unless explicitly requested.

## Architecture Guidelines

- Keep domain logic framework-agnostic inside `src/app/core/`.
- Keep UI route pages under `src/app/features/<feature>/page/`.
- Extract reusable UI pieces (throw composer, results table, charts wrapper) to `src/app/shared/`.
- Keep random/simulation logic in pure functions and injectable services for testability.

## Data Model Rules

- Allowed die types are fixed: `d4`, `d6`, `d8`, `d10`, `d12`, `d20`.
- A throw must allow any non-negative count per die type.
- Analysis mode must use the same throw configuration model as throw mode.

## Performance Rules

- Treat analysis runs as potentially very large.
- Prefer batched calculations and immutable summaries over storing every roll when possible.
- Consider Web Worker offloading once chart rendering is added.

## Testing Requirements

- Every statistics calculation must have deterministic unit tests.
- Roll engine tests should validate inclusive min/max bounds per die type.
- Feature pages should have at least one route-level smoke test.

## Delivery Rules

- Keep docs (`README.md`, `TODO.md`) updated when scope shifts.
- Keep changes incremental and buildable.
- Run `npm run build` before handing off substantial changes.
