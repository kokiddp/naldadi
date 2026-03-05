# NalDadi Architecture (Initial)

## Route Map

- `/dice-throw`: one-off throw flow
- `/dice-analysis`: high-volume simulation flow

## Planned Layers

- `core/`: dice domain models, random roll logic, simulation and stats engines
- `core/i18n/`: runtime translation dictionaries (`en.ts`, `it.ts`) and shared types
- `shared/`: reusable UI components used by both features
- `features/dice-throw/`: throw mode page and feature-local presentation
- `features/dice-analysis/`: analysis page and chart/stat presentation

## Localization

- UI strings are translated through `I18nService`.
- Active language is inferred from browser locale (Italian fallback rule: language starts with `it`).
- Translation keys are centralized and consumed by both feature pages and shared components.

## Shared Contract

Both features consume the same throw definition object to guarantee parity between real throws and simulated throws.
