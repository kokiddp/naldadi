# NalDadi Architecture (Initial)

## Route Map

- `/dice-throw`: one-off throw flow
- `/dice-analysis`: high-volume simulation flow

## Planned Layers

- `core/`: dice domain models, random roll logic, simulation and stats engines
- `core/i18n/`: runtime translation dictionaries (`en.ts`, `it.ts`) and shared types
- `shared/`: reusable UI components used by both features
- `features/dice-analysis/components/`: extracted analysis-only presentation components (`probability-buckets`, `saved-analysis-runs`)
- `features/dice-throw/`: throw mode page and feature-local presentation
- `features/dice-analysis/`: analysis page and chart/stat presentation

## Localization

- UI strings are translated through `I18nService`.
- Active language is inferred from browser locale (Italian fallback rule: language starts with `it`).
- Translation keys are centralized and consumed by both feature pages and shared components.

## Shared Contract

Both features consume the same throw definition object to guarantee parity between real throws and simulated throws.

## Persistence Strategy

- Throw history is stored in local storage as compact summary entries.
- Analysis history stores only aggregated snapshots:
	- throw config
	- simulation stats
	- distribution points
- No raw per-iteration simulation events are persisted.

## Deployment Runtime

- Production runtime uses a lightweight Node server (`server.js`) that serves Angular build artifacts.
- Runtime port is read from `PORT` environment variable, with fallback for local execution.
- This keeps deployment target-agnostic behavior for managed runtimes and container platforms.
