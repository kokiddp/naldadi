# TODO - NalDadi

## Project Setup

- [x] Initialize Angular app with router and SCSS
- [x] Create feature pages for `dice-throw` and `dice-analysis`
- [x] Establish top-level docs (`README.md`, `TODO.md`, `AGENTS.md`)

## Core Domain

- [ ] Define `DieType` model (`d4|d6|d8|d10|d12|d20`)
- [ ] Define throw request model (list of dice entries with counts)
- [ ] Create shared validation helpers for throw configuration

## Dice Throw Feature

- [ ] Build throw composer component (add/remove die types and counts)
- [ ] Implement one-off roll engine
- [ ] Display per-die results and total sum
- [ ] Add throw history list (latest N throws)

## Dice Analysis Feature

- [ ] Reuse throw composer from throw mode
- [ ] Add simulation control for large iteration counts
- [ ] Implement simulation worker/service for high-volume runs
- [ ] Compute summary statistics (min, max, mean, median, std dev)
- [ ] Display distributions and cumulative probability graphs

## Quality

- [ ] Unit tests for dice roll and simulation engines
- [ ] Unit tests for stats calculations
- [ ] Add E2E smoke test for both routes
- [ ] Add lint/format check to CI pipeline
