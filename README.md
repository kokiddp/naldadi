# NalDadi

NalDadi is an Angular app for simulating and analyzing dice throws.

Repository: https://github.com/kokiddp/naldadi

## Product Goals

- Provide a fast `Dice Throw` mode for rolling custom throw sets with any count of:
	- `d4`, `d6`, `d8`, `d10`, `d12`, `d20`
- Provide a dedicated `Dice Analysis` mode that:
	- Uses the same throw composition model as `Dice Throw`
	- Simulates an arbitrarily large number of throws
	- Shows stats and visual distributions

## Current Features

- Dice Throw
	- Shared throw composer (`d4`, `d6`, `d8`, `d10`, `d12`, `d20`)
	- One-off roll with total and per-die breakdown
	- Persistent throw history in local storage
	- Single-item delete and clear-all history actions
	- Pagination for history (20 items/page)

- Dice Analysis
	- Progressive simulation with cancellation and progress bar
	- Rich descriptive statistics (center, spread, shape, quantiles)
	- Exclusive exact-match multiplicity stats (double/triple/...)
	- Histogram, CDF, PMF, and tail-probability charts
	- Probability bucket grid (5% granularity)
	- Persistent saved analyses with full view rehydration
	- Single-item delete and clear-all saved analysis actions
	- Pagination for saved analyses (20 items/page)

- Localization
	- Runtime i18n with browser language auto-detection
	- English and Italian dictionaries split by language file

## Tech Stack

- Angular 21 (standalone components + router)
- TypeScript 5
- SCSS
- Vitest (via Angular CLI test setup)

## Internationalization

- Runtime i18n is implemented via `src/app/core/i18n.service.ts`.
- Language is auto-selected from browser language (`navigator.languages` / `navigator.language`).
- Currently supported languages:
	- English (`en`)
	- Italian (`it`)
- Dictionaries are split by language:
	- `src/app/core/i18n/en.ts`
	- `src/app/core/i18n/it.ts`

## Quick Start

1. Install dependencies:

```bash
npm install
```

2. Start the app:

```bash
npm run dev
```

3. Open `http://localhost:4200`.

## Scripts

- `npm run dev`: Start dev server
- `npm start`: Start production Node server (serves built Angular app, honors `PORT`)
- `npm run start:dev`: Alias for local dev server
- `npm run build`: Build production bundle
- `npm run watch`: Build in watch mode
- `npm test`: Run unit tests

## Production Run

1. Build the app:

```bash
npm run build
```

2. Start production server:

```bash
npm start
```

3. Optional custom port:

```bash
PORT=5000 npm start
```

This startup model is compatible with platforms that inject a runtime `PORT` value.

## Current Structure

```text
src/app/
	app.html
	app.routes.ts
	core/i18n/
	features/dice-analysis/components/
	features/
		dice-throw/pages/dice-throw-page/
		dice-analysis/pages/dice-analysis-page/
```

## Planned Milestones

1. Shared dice domain model
2. Throw composer UI (reused in both modes)
3. Roll engine for one-off throws
4. Simulation engine for large N throws
5. Statistics panel and charts
6. Persistence of presets/history

See `TODO.md` for implementation tasks.

## Publication Notes

- License: MIT (`LICENSE`)
- Package metadata includes repository, issues, homepage, and engine requirements.
- Production entrypoint is `server.js` for static app serving in containerized or managed Node environments.

## Contributing

Review `CONTRIBUTING.md` for local setup, testing expectations, and pull request workflow.
Review `AGENTS.md` before making structural changes to align on architecture, coding boundaries, and quality checks.
