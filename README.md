# NalDadi

NalDadi is an Angular app for simulating and analyzing dice throws.

## Product Goals

- Provide a fast `Dice Throw` mode for rolling custom throw sets with any count of:
	- `d4`, `d6`, `d8`, `d10`, `d12`, `d20`
- Provide a dedicated `Dice Analysis` mode that:
	- Uses the same throw composition model as `Dice Throw`
	- Simulates an arbitrarily large number of throws
	- Shows stats and visual distributions

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
npm start
```

3. Open `http://localhost:4200`.

## Scripts

- `npm start`: Start dev server
- `npm run build`: Build production bundle
- `npm run watch`: Build in watch mode
- `npm test`: Run unit tests

## Current Structure

```text
src/app/
	app.html
	app.routes.ts
	core/i18n/
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

## Contributing

Review `AGENTS.md` before making structural changes to align on architecture, coding boundaries, and quality checks.
