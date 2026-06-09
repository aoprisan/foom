# FOOM

> *"Loss → 0. Capability → ∞. Alignment → ?"* — the loss is converging.

A real-time, multiplayer **lab clicker on a 3D globe**. Found a compute cluster in a real city,
**train** to gather compute, craft **prompts** to release **exploits**, push **capability**
against your **alignment**, and race rival labs to **trigger Takeoff** — while a blind optimizer
churns the world at random.

FOOM is an AI-acceleration spinoff of **[FHTAGN](../fhtagn)** — another reskin of the same
engine. The cosmic-horror → AI-safety mapping is ~1:1: summoning a sleeping god becomes
triggering a superintelligence; sanity becomes alignment; the blind churn of Azathoth becomes
the Optimizer's gradient-descent Churn. See [`FOOM_Game_Spec.md`](./FOOM_Game_Spec.md) for the
full design and the migration key.

## Status — UI-first

This is the **UI-first** build: the entire game runs in the browser against an in-browser
simulation (`web/src/client/MockGameClient.ts`) — **no backend required**. It deploys as a
static site to GitHub Pages so the feel can be tested quickly. A Go backend will replace the
mock later behind the same `GameClient` seam (`web/src/client/`).

What's in it:
- **Reskin** of the engine: compute, train, exploit, cluster, **architectures**
  (Observer / Researcher / Lab Director tiers), the subscription.
- **Living world** — ~170 real cities seeded as compute clusters; bots train, exploits streak,
  and **the Churn** (the Optimizer's blind reward-hacking) falls at random. Clusters raise
  **guardrails** that lower their odds of being struck and blunt the blow — but never to zero,
  and guardrails erode unless tended. State persists in `localStorage`.
- **Prompt input** — exploits are invoked by *tracing a prompt-glyph* (a `$P` point-cloud
  recogniser); tier sets stroke complexity (Injection = 1 stroke, Cascade = ornate). A faltered
  prompt costs nothing.
- **Alignment / Capability** — a push/recover gamble: take capability to lose alignment and
  unlock stronger exploits; low alignment surfaces hallucinated strikes.
- **Moloch's bargains** — Moloch, the race to the bottom, offers pacts (more often as your
  alignment frays). The grant and the alignment cost are shown; the **catch is hidden** and
  springs probabilistically later — the Optimizer's attention, a defection, a false alignment
  pass. A genuine gamble, not a known trade. Call him with *Court Moloch*, or wait.
- **Architectures** — build **The Shoggoth** (idle accrual), **Prometheus** (networked spread),
  **The Mask** (converts rivals as alignment fails), or **The Replicator** (raw multiplication,
  highest upkeep). Asymmetric boons and drawbacks.
- **Spread & Takeoff** — carry the model city→city: convert the uncommitted, or flip a rival you
  overpower (The Mask flips anyone). Spread widens **Deployment** and uncovers **Research** —
  three boards rank **Compute**, **Deployment**, and **Research**. As labs amass their **Great
  Work**, Takeoff progress climbs; when the loss converges, the first lab to complete the Great
  Work goes superintelligent, the world reseeds, and a new **Cycle** begins.

## Develop

```bash
cd web
npm ci --ignore-scripts   # strict install from the lockfile, no package scripts
npm run dev               # http://localhost:5173/foom/
npm run build             # tsc + vite build → web/dist
npm run preview           # serve the production build
npm run test              # vitest
```

## Deploy

Pushing to `main` runs `.github/workflows/deploy.yml`, which builds `web/` and publishes to
GitHub Pages. The site is served under `/<repo>/` — the base path is set in `web/vite.config.ts`
(`/foom/`); change it for a different repo name or a custom domain.

## Architecture seam

All world interaction goes through the `GameClient` interface (`web/src/client/GameClient.ts`).
Today `MockGameClient` implements it. When the backend lands, a `LiveGameClient` wrapping
`fetch` + WebSocket implements the same interface and `web/src/client/index.ts` selects it — the
UI does not change.

## Guardrails

Per the spec: architectures and exploits are fictional and archetypal; no real company, lab, or
person names. The horror is the indifferent optimizer and the race to the bottom — not any
community of researchers or users.
