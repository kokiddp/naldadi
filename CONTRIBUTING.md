# Contributing to NalDadi

Thanks for contributing to NalDadi.

Repository: https://github.com/kokiddp/naldadi

## Ground Rules

- Keep scope aligned with the two product features only:
  - Dice Throw
  - Dice Analysis
- Follow architecture and boundaries in `AGENTS.md`.
- Keep changes incremental and buildable.

## Local Setup

1. Install dependencies:

```bash
npm install
```

2. Start development server:

```bash
npm run dev
```

3. Build production bundle:

```bash
npm run build -- --watch=false
```

4. Run tests:

```bash
npm test -- --watch=false
```

## Coding Guidelines

- Keep dice/domain logic in `src/app/core/` framework-agnostic and testable.
- Put feature pages under `src/app/features/<feature>/pages/`.
- Extract reusable UI to `src/app/shared/` or feature-local `components/` where appropriate.
- Reuse the same throw model between throw and analysis modes.
- Keep i18n strings in dictionaries (`en.ts`, `it.ts`) and avoid hard-coded UI text.

## Testing Expectations

- Add deterministic tests for core statistics and roll/simulation behavior.
- Validate inclusive min/max bounds for each die type logic.
- Keep at least one smoke-level route/component test passing.

## Pull Requests

- Create focused PRs with clear titles and descriptions.
- Mention affected feature(s), risks, and manual verification steps.
- Ensure CI passes (`build + tests`) before requesting review.

## License

By contributing, you agree that your contributions are licensed under the MIT License in `LICENSE`.
