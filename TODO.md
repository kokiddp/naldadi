# TODO - NalDadi

## Project Setup

- [x] Initialize Angular app with router and SCSS
- [x] Create feature pages for `dice-throw` and `dice-analysis`
- [x] Establish top-level docs (`README.md`, `TODO.md`, `AGENTS.md`)

## Core Domain

- [x] Define `DieType` model (`d4|d6|d8|d10|d12|d20`)
- [x] Define throw request model (list of dice entries with counts)
- [x] Create shared validation helpers for throw configuration

## Dice Throw Feature

- [x] Build throw composer component (add/remove die types and counts)
- [x] Implement one-off roll engine
- [x] Display per-die results and total sum
- [x] Add throw history list (latest N throws)

## Dice Analysis Feature

- [x] Reuse throw composer from throw mode
- [x] Add simulation control for large iteration counts
- [ ] Implement simulation worker/service for high-volume runs
- [x] Compute summary statistics (min, max, mean, median, std dev)
- [x] Display distributions and cumulative probability graphs

## Quality

- [ ] Unit tests for dice roll and simulation engines
- [ ] Unit tests for stats calculations
- [ ] Add E2E smoke test for both routes
- [ ] Add lint/format check to CI pipeline

## Internationalization

- [x] Make UI strings translatable via runtime i18n service
- [x] Add Italian translations
- [x] Auto-detect language from browser locale
- [ ] Add translation coverage tests/checks for missing keys
