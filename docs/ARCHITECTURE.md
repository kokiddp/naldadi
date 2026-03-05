# NalDadi Architecture (Initial)

## Route Map

- `/dice-throw`: one-off throw flow
- `/dice-analysis`: high-volume simulation flow

## Planned Layers

- `core/`: dice domain models, random roll logic, simulation and stats engines
- `shared/`: reusable UI components used by both features
- `features/dice-throw/`: throw mode page and feature-local presentation
- `features/dice-analysis/`: analysis page and chart/stat presentation

## Shared Contract

Both features consume the same throw definition object to guarantee parity between real throws and simulated throws.
