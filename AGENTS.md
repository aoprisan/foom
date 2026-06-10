# AGENTS.md

This file provides guidance to Codex (Codex.ai/code) when working with code in this repository.

## What this is

FOOM is a real-time, multiplayer **lab clicker on a 3D globe** — an AI-acceleration reskin of the FHTAGN engine (the cosmic-horror → AI-safety mapping is ~1:1: summoning a god → triggering superintelligence; sanity → alignment; Azathoth's churn → the Optimizer's gradient-descent Churn). The full design and the FHTAGN→FOOM migration key live in [`FOOM_Game_Spec.md`](./FOOM_Game_Spec.md); section references (`spec §N`) throughout the code point there.

This is a **UI-first** build: the whole game runs in the browser against an in-browser simulation, **no backend required**, and deploys as a static site to GitHub Pages. A Go backend will replace the mock later behind the same `GameClient` seam.

All code lives in `web/`.

## Commands

```bash
cd web
npm ci --ignore-scripts   # strict install from lockfile, no package scripts
npm run dev               # http://localhost:5173/foom/
npm run build             # tsc -b && vite build → web/dist
npm run preview           # serve the production build
npm run test              # vitest run (one-shot)
npx vitest path/to/file.test.ts        # run a single test file
npx vitest -t "name of test"           # run tests matching a name
npm run icons             # regenerate PWA icons from public/icon.svg
```

Note the Vite **base path is `/foom/`** (`web/vite.config.ts`) — the dev server and all built URLs are served under `/foom/`, not `/`. Change the base for a different repo name or custom domain.

## Architecture

### The client seam — the most important abstraction
Every interaction with the world goes through the `GameClient` interface (`web/src/client/GameClient.ts`). It is the single seam between UI and world. `web/src/client/index.ts` exports one shared `game` instance; today it is always `MockGameClient`. When the Go backend lands, a `LiveGameClient` wrapping `fetch` + WebSocket implements the **same interface** and `index.ts` selects it via an env flag — **the UI does not change**. When adding world behavior, add it to the `GameClient` interface first, then implement in the mock.

`MockGameClient` (`web/src/client/MockGameClient.ts`, ~800 lines) is the entire game simulation: it seeds ~170 real cities as clusters, runs bot training / exploit streaks / the Churn on timers, manages alignment, bargains, conversion/spread, and Takeoff, and persists state to `localStorage`. Reads are `Promise`-returning; mutating actions (`train`, `guardrail`, `courtMoloch`, …) are fire-and-forget `void` and report results by **emitting `GameEvent`s** through the `EventBus` (synchronous pub/sub, also in `GameClient.ts`).

### Event flow
The UI is event-driven. `App.tsx` subscribes via `useGameClient` / `client.on(handler)` and updates React state in response to `GameEvent`s (`cluster_update`, `exploit_strike`, `churn_strike`, `alignment_update`, `bargain_offer`, `bargain_sprung`, `cluster_converted`, `takeoff_progress`, `takeoff_triggered`, …). The full event union is `GameEvent` in `web/src/types.ts` — that file is the canonical domain model (Cluster, Operator, Exploit, Bargain, TakeoffState, etc.) and the contract both the mock and any future live client must satisfy.

### Layout
- `web/src/types.ts` — all domain types and the `GameEvent` union. Start here.
- `web/src/client/` — the `GameClient` seam, `MockGameClient`, `EventBus`, and `index.ts` selector.
- `web/src/game/` — pure-ish game logic and data, unit-tested in isolation:
  - `catalog.ts` — static defs: architectures (Shoggoth / Prometheus / Mask / Replicator), exploits by family (injection / release / cascade) and tier, breakthrough pools, exploit thresholds, family colors, tier→stroke-count.
  - `bargains.ts` — Moloch's pacts: visible grant + alignment cost, **hidden catch** that springs probabilistically later.
  - `takeoff.ts` — endgame: spread range, Great Work readiness, reseed.
  - `seedClusters.ts` / `geo.ts` — world seeding from real cities.
  - `prompt/` — the `$P` point-cloud recognizer (`recognizer.ts`) and prompt-glyph templates (`prompts.ts`); exploits are invoked by *tracing* a glyph, tier sets stroke complexity.
- `web/src/components/` — React 19 components. `Globe.tsx` is the `react-globe.gl` / three.js 3D globe; `PromptCanvas.tsx` captures glyph strokes; the rest are panels/HUD.
- `web/src/hooks/` — `useGameClient` (subscribe + connection state), `useTrainHandler` (the click-to-train loop).
- `App.tsx` — composition root: holds top-level game state, wires events to components.

## Conventions & guardrails

- **Spec is source of truth.** Code comments cite `spec §N`; when changing game mechanics, reconcile with `FOOM_Game_Spec.md`.
- **Content guardrail (from the spec):** architectures and exploits are fictional and archetypal — **no real company, lab, or person names**. The horror is the indifferent optimizer and the race to the bottom, not any real researchers or users.
- **Tests** are colocated `*.test.ts` next to game logic (vitest + jsdom; `@testing-library/react` available; setup in `src/test/setup.ts`). Game-logic modules are tested directly; favor keeping new mechanics in `web/src/game/` so they stay unit-testable apart from the mock.
- Deploy is automatic: pushing to `main` runs `.github/workflows/deploy.yml` (builds `web/`, copies `dist/index.html`→`404.html` for SPA deep-link fallback, publishes to Pages).
