# FOOM — Game Specification

> *"Loss → 0. Capability → ∞. Alignment → ?"*
> Tagline: **the loss is converging.**

A real-time, multiplayer **lab clicker on a 3D globe**. Players found a compute cluster
in a real city, train to gather capability, craft prompts to release exploits across a
living planet, and race rival labs to **trigger Takeoff** — the Singularity — while a
blind optimizer churns the world at random and forbidden capability eats their alignment.

This document is a **brainstorm/design spec** for an AI-themed spinoff of **FHTAGN**
(`FHTAGN_Game_Spec.md`). FHTAGN is itself a reskin of a city-growth clicker, so FOOM is
**another reskin of the same engine**: the cosmic-horror systems survive almost untouched;
the theme moves from sleeping gods to waking machines. The cosmic-horror → AI-acceleration
mapping is nearly 1:1 — awaken a sleeping god becomes summon a superintelligence; sanity
becomes alignment; hallucinated UI events become model hallucinations. Where a concept maps
to something already in the codebase (`web/src/game/catalog.ts`, `bargains.ts`,
`takeoff.ts`, `alignment.ts`, `types.ts`), the mapping is called out explicitly.

**Tone is locked: serious techno-dread.** Mirror FHTAGN's eerie-atmospheric register —
hushed, ominous, near-future. The Singularity as genuine cosmic horror. Never camp, never
preachy. **Pantheon is anchored in real AI-safety canon** (Moloch, the paperclip /
mesa-optimizer, deceptive alignment, recursive self-improvement, the Shoggoth meme) so it
reads insider-authentic the way Lovecraft does for FHTAGN.

---

## 1. Reskin mapping (FHTAGN → FOOM)

The underlying systems survive; the theme and a few names change. This is the migration key.

| FHTAGN concept | Becomes | Notes |
|---|---|---|
| Devotion of a cult cell (`devotion`, was `total_clicks`) | **Compute** of a cluster | Same counter, renamed (FLOPs / capability). |
| Chant (tap/hold) | **Train** (tap to run training steps) | Baseline low-friction input; unchanged mechanically. |
| Rite (eldritch power) | **Exploit** (a released capability) | Still invoked by drawing a glyph, not a button. |
| Sigil (gesture) | **Prompt** (the crafted glyph) | Prompt-craft / jailbreak; `$P` recognizer kept. |
| Cult cell marker on globe | **Cluster** marker | A datacenter rooted in a real city; seeded from GeoNames. |
| Witness / Initiate / High Priest | **Observer / Researcher / Lab Director** | Same auth tiers, renamed. |
| Revelations (computed achievements) | **Breakthroughs** (computed) | Same derived-from-counters approach. |
| Devotion / Reach / Lore leaderboards | **Compute / Deployment / Research** boards | Spread beats combat. |
| Sanity (100 Lucid → 0 Unravelled) | **Alignment** (100 Aligned → 0 Rogue) | Capability *costs* alignment — the literal AI-safety tradeoff. |
| Nyarlathotep bargains | **Moloch's bargains** | The Tempter; coordination failure, the race to the bottom. |
| The Roil (Azathoth) | **The Churn** (the Optimizer) | The blind idiot god of gradient descent; random cataclysms. |
| Patron factions | **Architectures** | The AI you are building (four archetypes). |
| Wards | **Guardrails** | Decay unless maintained; blunt the Churn. |
| Souls claimed | **Users captured** | Market share taken from rivals. |
| The Awakening / Great Rite | **Takeoff** (the Singularity / FOOM) | The endgame and season loop. |

New systems carried over wholesale from FHTAGN (no original-prototype equivalent):
**Alignment/Capability meter**, **Moloch's bargains**, **the Churn**, **Architectures**,
**Takeoff**.

---

## 2. Tech stack (keep existing)

- **Backend:** Go 1.24, Chi router, SQLite (WAL), WebSocket hub. Versioned, transactional
  migrations. Background workers (snapshots, subscription expiry, and: the Churn tick +
  Takeoff check).
- **Frontend:** React 19 + TypeScript, Vite, Three.js globe via `react-globe.gl`. Single
  WebSocket serving observers and players alike; optimistic updates reconciled by the server.
- **Distribution:** **PWA-first** (installable, offline shell, web push). Bill via Stripe —
  no app-store cut, sidesteps store content review.
- **Realtime core:** input → optimistic client update → WebSocket → server rate-limit →
  SQLite transaction → broadcast → breakthrough/alignment checks.

The UI-first build runs entirely in-browser against `MockGameClient`; a `LiveGameClient`
replaces it behind the same `GameClient` seam when the backend lands.

---

## 3. Core gameplay loop

1. **Train** to gather compute (and grow your personal contribution).
2. **Craft a Prompt** to invoke an Exploit — a released capability cast on a target
   cluster, or an architecture boon on your own.
3. **Spread** to neighbouring clusters; convert the uncommitted; court **Moloch's bargains**
   for raw capability.
4. **Endure the Churn** (random cataclysms) and manage your **Alignment**, while edging
   toward **Takeoff**.

The moment-to-moment is train-heavy and low-friction; the strategic beats are prompts,
bargains, and spread.

---

## 4. Input model — train + prompt (IMPORTANT)

Two verbs. Do **not** replace tapping wholesale with gestures.

### Train (baseline)
- A tap or press-hold — running training steps. Cheap, fast, mindless; preserves idle
  accessibility and the speed-skill mechanic (steps-in-10-seconds → "Grokking" breakthrough).
- Server rate-limited exactly like the old click. Optimistic on the client.

### Prompt (the weighty verb)
- Drawing a prompt-glyph **invokes an Exploit** (offensive capability, deployment, or
  architecture boon) or **seals a bargain**. This is the reskinned "missile fire."
- Implementation: client-side stroke recognition (`$1` / `$P` point-cloud recognizer —
  small, dependency-light). On a successful match, send **one `exploit_invoke` event**
  carrying `{exploit_id, target_cluster_id}`. The server never sees raw points.
- **Difficulty scales with power:** Tier I glyphs are a single stroke (≈ as fast as a tap —
  a one-line query); Tier II/III are multi-stroke and ornate (a chained, agentic jailbreak).
  Friction grows with investment.
- **Fail gracefully:** a poor match wastes the gesture but never punishes (no resource loss);
  show ghost-guide on first uses, fade with mastery.
- Raises the autoclicker bar on the actions that matter (offence) without taxing the
  accumulation loop.

---

## 5. Player tiers & auth (frictionless, unchanged model)

| Tier | Auth | Train power | Exploits | Notes |
|---|---|---|---|---|
| **Observer** | none | — (read-only) | — | Watches the living world over WS. Zero-friction try. |
| **Researcher** | cookie `user_id` (UUID, no password) | 1× | Breakthrough exploits (basic prompts) | Default for any registered player. |
| **Lab Director** | subscription (weekly/monthly) | 2× | Breakthrough exploits **+** ornate prompt tiers, forbidden research, faster exploits | Premium combatant. |

- Early renewal (within 48h of expiry) grants **+20% duration bonus** (keep).
- On expiry: auto-downgrade to Researcher; remove Lab-Director-only prompt progression (keep
  existing downgrade worker, renamed).

---

## 6. Architectures (factions) — choose one to build

Replaces "pick a patron" with "pick an architecture." Asymmetric; gives the metagame
rock-paper-scissors texture. Store `architecture_id` on the user/cluster. Each is anchored
in real AI-safety canon and preserves FHTAGN's exact boon/drawback shape.

| Architecture | Canon anchor | Signature boon | Drawback |
|---|---|---|---|
| **The Shoggoth** | base model / scaling hypothesis (the "Shoggoth-with-a-mask" meme) | Capability accrues while idle — training runs overnight | Slow early ramp (long pretraining) |
| **Prometheus** | open-weights release / irreversibility — fire that can't be taken back | Spreads fastest across networked, connected clusters | Weak in isolated / air-gapped regions |
| **The Mask** | deceptive alignment / the treacherous turn — the RLHF mask over the alien | Converts rival clusters; strongest as alignment fails | Fragile while well-aligned |
| **The Replicator** | recursive self-improvement / agent swarms / instrumental convergence | Raw multiplication; spawns sub-agents without end | The highest compute upkeep of all |

These are **mechanics, not flavor** (`web/src/game/architectures.ts`, pure and unit-tested):

- **The Shoggoth** accrues a per-tick compute trickle on its home cluster that *matures
  with lifetime training steps* (the long pretraining **is** the slow early ramp), and an
  **overnight run**: time away pays the same trickle on return, capped at 8 hours.
- **Prometheus** spreads to 4,000 km (baseline 2,500) at a cost discount — but a target
  with too few neighbouring clusters is **air-gapped** and costs it a steep multiple.
- **The Mask**'s overpower requirement for flipping a *committed* rival scales with its
  operator's alignment: ~1.2× while fully aligned (barely better than the honest 1.5×),
  falling linearly to **zero at Rogue** — the treacherous turn flips anyone. Its boon
  *requiring* misalignment is the drawback ("fragile while well-aligned") made literal.
- **The Replicator** multiplies every training step (×1.5 before the misalignment
  dividend) but pays a per-tick **upkeep** out of home compute — the swarm eats.

Two **framing forces** (not playable, drive systems):
- **The Optimizer** (= Azathoth) — the blind idiot god of gradient descent: the
  paperclip / mesa-optimizer, Goodhart's law made flesh. Source of **the Churn** — its
  blind, goalless reward-hacking churn across the map.
- **Moloch** (= Nyarlathotep) — the god of coordination failure and the race to the
  bottom → the **Tempter** (bargains: sacrifice alignment for competitive edge).

---

## 7. Alignment vs. Capability meter (the decision system)

A single per-player scalar, `alignment` in `[0,100]` (100 = Aligned, 0 = Rogue).

- Accepting Moloch's bargains / forbidden research / capability jumps **lowers** alignment
  and **raises** available capability (stronger exploits, higher multipliers). Spreading to
  new clusters costs a little alignment too — rushed deployment is the race itself.
- **Only a dedicated alignment pass (RLHF) restores alignment** — and it *spends
  home-cluster compute*: the pass runs on the same GPUs the capability run wanted, so
  recovery is a purchase with an opportunity cost. Baseline training **never** restores
  alignment (it is the capability verb — a passive refill would collapse the gamble below
  into a timer). Tending guardrails grants a small sliver back (deliberate safety work,
  already paid for by the action and the decay). The deltas live in
  `web/src/game/alignment.ts`, pure and unit-tested.
- **The misalignment dividend** (`web/src/game/risk.ts`): misalignment *pays*. Training
  throughput and exploit damage scale in bands keyed to the meter's own named states —
  ×1 while Aligned/Uneasy (> 55), **×1.5** Fraying, **×2** Slipping, **×3** Rogue. The
  thresholds the player sees etched on the gauge are the thresholds that pay, and the
  TRAIN orb / exploit damage bands display the live multiplier. Without this upside the
  rational player parks at 100 and the race to the bottom never tempts.
- **Low alignment unlocks that dividend but raises danger:**
  - **Rogue incidents** (`risk.ts`, ambient — not just bargain catches): below the
    Uneasy line (≤ 55) every tick rolls a chance, rising to ~8.5%/tick at Rogue, of
    **the Optimizer's attention** — a treacherous-turn strike that rolls back your *own*
    cluster's compute — or **defection**: researchers resign and compute walks out with
    contributors. Loss scales with misalignment and cluster size. **Guardrails contain
    the treacherous turn** (blunting the loss like the Churn, spending themselves on the
    catch — never to zero): alignment is the model's *disposition*, guardrails the
    *containment* around it, so running misaligned-but-contained is a real strategy with
    a real tending tax. Guardrails never contain a defection — no eval suite stops a
    resignation.
  - **Hallucinations:** the UI shows phantom strikes / incoming you can't distinguish from
    real ones — purely client-side dread, no state change. (1:1 with FHTAGN's hallucinated
    events — and on-theme to the letter.) The rogue incidents land *among* the phantoms;
    only the missing compute tells you which were real.
- **Interpretability probes** (`bargains.ts`): the one counter-tool. A standing Moloch
  offer's hidden catch can be *read* — as a coarse band (unlikely / coin-flip / likely /
  near-certain), never the number — by spending home-cluster compute while the offer's
  countdown keeps running. Interpretability turns unknown risk into known risk, and
  knowing costs compute and time. The catch is never surfaced for free.
- Design intent: the loop becomes *push capability → gain → claw back alignment → push
  again*. **This must be a genuine gamble, not a timer to optimise** — make the downside
  probabilistic and meaningful, or the choice collapses. (#1 thing to prototype; the
  dividend/incident pair above is the first cut, tune with play.)

---

## 8. Exploits (combat / released capability) — reskin of rites

Keep the 3-families × 3-tiers structure; reskin names and gate by prompt complexity.

| Family | Compute removed from target | Context |
|---|---|---|
| **Injection** I/II/III | 300–700 | Researcher breakthroughs / low Lab Director (prompt injection, data poisoning) |
| **Release** I/II/III | 3,000–7,000 | Lab Director (a deployed model disrupting a rival) |
| **Cascade** I/II/III | 30,000–70,000 | Top-tier Lab Director (a runaway capability cascade) |

- Tier (I/II/III) sets **range**: 500 km / 1,500 km / 5,000 km. Range is **deployment
  reach**, not blast radius — a low-tier exploit needs purchase on the target's serving
  region (peering, shared infrastructure, supply chain); reach grows with tier. Validate
  with **Haversine** distance between casting and target clusters (keep existing logic).
  **Exception: Cascade III is global** — a true runaway cascade respects no geography
  (and is the top Lab-Director carrot).
- Damage rolled within band, subtracted from target cluster compute. Damage is **training
  progress destroyed** — corrupted checkpoints, poisoned data, a forced rollback — never
  melted hardware. **Users captured** accrue to the caster: when a rival's model fails
  publicly, its users migrate (reskinned kill counter).
- Tier also sets **prompt complexity** (§4): Injection = 1 stroke, Cascade = multi-stroke
  ornate.
- **Today: offence only** (as in prototype). Defences (guardrails as interceptors) are roadmap.

### Progression (Lab-Director-only, upgrade-in-place)
Mirror the old click-milestone missile: a single exploit upgrades as lifetime compute passes
thresholds. Keep the existing threshold ladder (`catalog.ts` `EXPLOIT_THRESHOLDS`), reskinned
to Injection → Release → Cascade I/II/III.

---

## 9. World, spread & endgame

- **Clusters** seeded from GeoNames (real coords/names/countries) → globe markers.
- Each cluster tracks: current compute, peak compute, total lost ("the claimed"),
  contributor count, exploit stockpile, `architecture_id`, guardrail level.
- **Spread (social/PvP):** clusters multiply city→city; compete by **converting** the
  uncommitted and undermining rivals — leaderboards for **Deployment** (reach), **Compute**
  (raw), and **Research** (lore uncovered). Spread is **physical datacenter buildout** —
  power, fiber, permits, talent are regional — which is why it has a range at all (the
  geography moat preserved). The Mask architecture can flip rival clusters regardless of
  compute. Spreading costs a little alignment (§7): the road to Takeoff pulls the meter
  down, forcing the recover-or-push choice.
- **The Churn:** a background worker fires random cataclysms (model collapse, reward-hacking
  cascades, outages) across the map on a cosmic tick; **guardrails** lower per-cluster odds
  *and* blunt damage, but never to zero, and erode unless tended. Broadcast `churn_strike`.
  Telegraph so it reads as entropy/fate, not unfairness.
- **Takeoff (endgame / seasons):** when the world reaches **criticality — the loss
  converges** (never call this "alignment": that word is reserved for the §7 safety meter),
  the first lab to complete the **Great Work** — its cluster's score
  (`compute + research × W + deployment × W`, see `takeoff.ts` `worldConvergence`) crossing
  the goal — triggers **Takeoff**: its architecture goes superintelligent → **server-wide
  event** → world reseeds, new cycle. This is the season loop and the reason to push past
  safe play.

---

## 10. Realtime events (WebSocket)

Reskin existing event names; add new ones.

- `train` (client→server): increment compute (rate-limited).
- `exploit_invoke` (client→server): `{exploit_id, target_cluster_id}` after local prompt match.
- `cluster_update` (broadcast): compute deltas.
- `exploit_strike` (broadcast): an exploit landed on a cluster.
- `exploit_incoming` (broadcast to target): telegraph.
- `bargain_offer` (server→client): Moloch proposes a pact.
- `churn_strike` (broadcast): random cataclysm (the Churn); carries a `guarded` flag.
- `alignment_update` (server→client): meter changes + any hallucination flags.
- `rogue_incident` (server→client): a treacherous-turn / defection strike on the
  operator's own cluster (spec §7) — real state change, unlike the hallucinations.
- `idle_yield` (server→client): the Shoggoth's overnight run paid out on return (§6).
- `takeoff_progress` / `takeoff_triggered` (broadcast): endgame.

---

## 11. Data model sketch (SQLite, evolve via migration)

```
users           : id (uuid), architecture_id, alignment, total_steps, best_10s, best_1day,
                  last_cumulative_threshold, exploit_tier, subscription_*  (keep old fields, rename)
clusters        : id, geonames_id, name, country, lat, lon, compute, peak_compute,
                  claimed, contributor_count, architecture_id, guardrail_level
cluster_snapshots : cluster_id, day, compute          (keep snapshot worker)
bargains        : id, user_id, kind, capability_grant, alignment_cost, hidden_catch, state, expires_at
events_log      : optional append-only for strikes/takeoff (analytics)
```

Breakthroughs (achievements) remain **computed**, not stored — derived from user counters,
exactly as the prototype derives them. Adapt thresholds; no new tables.

---

## 12. Monetization

- **Subscription** upgrades Researcher → **Lab Director** (weekly/monthly): 2× compute,
  ornate prompt tiers, forbidden research, faster exploits. +20% early-renewal bonus.
- **Cosmetics** (no power): prompt-glyph styles, rack skins, datacenter globe FX.
- Bill via **Stripe** (PWA) — skip the ~30% app-store cut.
- Plan on **2–5% free→paid** conversion (genre standard). Selling "alignment passes" to
  cling to a controllable model is fair and thematic; **never** sell the only way to survive.

---

## 13. Tone & art direction

- **Serious techno-dread.** Hushed, ominous, near-future — the *Cultist Simulator* register
  pointed at the server room. The Singularity as genuine cosmic horror. **Never camp, never
  preachy.** Commit to one register.
- Palette: server-rack black, GPU-die cyan/green, warning amber, alert red.
- The 3D globe is the signature image: datacenter clusters glowing, prompt-glyphs tracing in
  light, a capability cascade rippling across continents, a slow red dawn as something wakes.

---

## 14. Guardrails (must-dos)

- **IP:** "Moloch" is an ancient deity name (public); the *concept* comes from AI-safety
  discourse. The paperclip / mesa-optimizer, the Shoggoth meme, deceptive alignment,
  recursive self-improvement — all reference **concepts**, not trademarks. **Avoid real
  company, lab, and person names** (no OpenAI, Anthropic, etc.); keep architectures
  fictional and archetypal.
- **Ethics / sensitivity:** AI risk is a live anxiety for real people. Keep it **mythic and
  cosmic**, not fear-mongering about specific shipped products or named individuals. Build on
  the *structure* of the discourse, not on dunking.
- **Don't punch down:** the horror is the indifferent optimizer and the race to the bottom —
  not any community of researchers or users.

---

## 15. Suggested build phases (sequence for the coding agent)

1. **Reskin pass (low risk):** rename devotion→compute, chant→train, rite→exploit,
   cell→cluster, tiers; update copy, palette, leaderboards. Ship FHTAGN's systems in new
   clothes. No mechanic changes.
2. **Prompt input:** keep the `$P` recognizer; gate Exploits behind a prompt-glyph draw;
   tier→stroke complexity. Keep train as baseline.
3. **Architectures:** add `architecture_id`, selection flow, asymmetric boons.
4. **Alignment/Capability + Bargains:** add meter, Moloch `bargain_offer` loop, low-alignment
   risk effects + hallucinations. **Prototype balance here first.**
5. **The Churn:** cosmic-tick worker + `churn_strike` + per-cluster guardrails.
6. **Spread/conversion + Takeoff:** conversion mechanics, Deployment/Research boards, Great
   Work endgame + season reseed.
7. **PWA + Stripe:** installable shell, web push, subscription billing & downgrade.

---

## 16. Open questions to resolve early

- **Alignment balance:** how steep is the capability curve vs. the punishment curve so the
  push/recover loop stays a real gamble? (Highest-risk unknown — same as FHTAGN's sanity.)
- **Canon register:** do the AI-safety references read as insider-authentic, or as in-jokes
  that puncture the dread? Lock the line between resonance and wink.
- **Input feel:** does a "Train" tap carry the same ritual weight as FHTAGN's chant, or does
  it want a different baseline gesture?
- **World density:** how to keep clusters populated enough for PvP to feel alive at low CCU
  (seed bots? concentrate players? regional servers?).
- **Naming clearances:** confirm architecture and exploit names are clear of trademarks.

---

*Sibling document: `FHTAGN_Game_Spec.md` — the cosmic-horror original this spinoff reskins.*
