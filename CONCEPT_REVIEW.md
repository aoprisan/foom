# FOOM Concept Review — what survived the FHTAGN reskin, and what shouldn't have

A review of the game concept (spec + current `web/` implementation) focused on one
question: **which gameplay concepts inherited from the Lovecraft original (FHTAGN) no
longer make sense in the AI-acceleration theme?** Findings are ordered by how much they
matter, each with a planned change. Section references are to `FOOM_Game_Spec.md`.

**Verdict in one line:** the core mapping is genuinely strong — most FHTAGN systems
land *better* in the AI skin than the original — but three mechanics still run on cult
logic that contradicts the theme, one naming collision ("alignment" means two unrelated
things) actively confuses the design, and a layer of reskin debris (literal Lovecraft
copy, a bad `pact→subscription` rename) leaks the old game into the new one.

---

## 1. What maps well — keep, no changes

These inherited systems are not just acceptable in the new theme; they are *more*
coherent here than in cosmic horror:

- **Hallucinations at low alignment** (spec §7) — phantom UI strikes were a sanity
  gimmick in FHTAGN; in FOOM "your model fabricates telemetry you can't distinguish
  from real incoming" is on-theme to the letter. Flagship mapping.
- **Moloch's bargains with hidden catches** (`bargains.ts`) — coordination failure /
  race-to-the-bottom is the *actual* AI-safety argument, not a metaphor for it. The
  visible-grant/hidden-catch gamble structure is the best system in the game.
- **Guardrail decay** — wards eroding was mythic flavor; safety mitigations going stale
  (jailbreaks rediscovered, eval suites rotting) is literally how it works. Keep the
  mechanic, lean the copy into it.
- **Prompts as traced glyphs** — "the incantation is the jailbreak" is the signature
  idea of the reskin. Tier→stroke-complexity (friction grows with power) is sound.
- **The Takeoff season loop** — first lab to finish the Great Work ends the world for
  everyone: a clean mechanical statement of racing dynamics.
- **The Churn as background entropy** — works, **with a framing condition**: before any
  Takeoff there is no superintelligence to be striking the map, so churn strikes must
  read as *systemic accidents of the race* (model collapse, reward-hacking incidents,
  outages — spec §9 already lists these), not as an entity's deliberate attacks. This
  is a copy constraint, not a mechanic change.

---

## 2. Mechanics that still run on cult logic — change these

### 2.1 Training restores alignment (backwards, and it breaks the core gamble)

`MockGameClient.train()` grants `+0.06 alignment` per step. That is chant logic —
devotional repetition restoring the soul. In the AI frame it is **backwards**: the
train verb *is* capability training, the thing the alignment meter is supposed to be
in tension with. Worse, it breaks the game's own #1 rule (spec §7: the
push/recover loop "must be a genuine gamble, **not a timer to optimise**"): because
the baseline idle-friendly verb passively refills alignment, every alignment cost is
just a tap-grind away from erased. The central tension dissolves.

Compounding it, `alignmentPass()` is a free, instant `+12` with no cost of any kind —
also a timer to optimise.

**Plan:**
- Make `train()` alignment-neutral (or very slightly negative at high capability).
- Make alignment recovery a *deliberate verb with opportunity cost*: an alignment pass
  takes a duration (your cluster trains no capability while it runs) or consumes
  compute — RLHF spends the same GPUs the capability run wants. Cooldown, not spam.
- Guardrail-tending keeps its small alignment balm (it already has an opportunity
  cost: the action and the decay).
- Spec change: §7 bullet "Training 'alignment passes' (RLHF) … restore alignment
  slowly" should be explicit that *only* dedicated passes restore it, never baseline
  training.

### 2.2 Spreading grants alignment ("spreading the word is fervent, aligned work")

`convert()` gives `+1 alignment`, with a comment calling it "fervent, aligned work" —
pure missionary-cult logic. In the AI frame, aggressively deploying your model to
capture territory is the **race to the bottom itself**. It is the single most
Moloch-flavored thing a lab does. Rewarding it with alignment inverts the theme.

**Plan:** conversion costs a small amount of alignment (or is neutral at most).
Thematically: every rushed deployment is corners cut. This also tightens the endgame
loop — the path to Takeoff (spread/deployment is the heaviest Great Work weight)
should *pull alignment down*, forcing the recover-or-push choice the spec wants.

### 2.3 Geographic range on exploits (Haversine km)

Rites radiating power over 500/1,500/5,000 km made mythic sense. A prompt injection
does not care about distance; the internet has no Haversine. This is the most visible
"cult physics" survivor (spec §8, `catalog.ts` `TIER_RANGE`, range check in
`invokeExploit`).

**However** — the geography moat is a deliberate, load-bearing design choice on a
globe game (spec §9 says so), and *clusters are physical datacenters*. The mechanic
should stay; the **justification** must change.

**Plan (keep mechanic, fix fiction + one tweak):**
- Reframe range as **deployment region / network reach**: low-tier exploits need
  proximity to the target's serving infrastructure (peering, shared region, supply
  chain); spec copy and error messages ("beyond the exploit's deployment") already
  gesture at this — make it consistent and explicit in §8.
- One mechanic tweak that sells it: **Cascade III (and only it) becomes global** —
  a true runaway cascade respecting no geography. This makes the top tier *feel* like
  the theme instead of contradicting it, and is a clean Lab-Director carrot.
- Same reframe applies to spread (`SPREAD_RANGE_KM = 2500`): spreading is *physical
  datacenter buildout* — power, fiber, talent are regional. That one already makes
  sense as-is; just say it in the copy.

### 2.4 What exploit damage *is* (compute as hit points)

Exploits subtract `compute` from the target — missile damage logic. A jailbreak does
not melt GPUs. But the counter never really was hardware: it is accumulated training
progress. No mechanic change needed; the **damage fiction** should be "training
progress destroyed" — corrupted checkpoints, poisoned data forcing a run rollback,
emergency un-deployment. Likewise `usersCaptured += damage` is fine *if framed as
migration*: when a rival's model fails publicly, its users move to yours. Copy-level
fix in strike messages and panels.

---

## 3. The "alignment" naming collision — rename the endgame concept

The word **alignment** currently means two unrelated things:

1. The player's safety meter (`Operator.alignment`, spec §7) — alignment as in
   AI alignment. Correct, keep.
2. **Endgame readiness** — `takeoff.ts` exports `worldAlignment()` returning
   `{ aligned: boolean }`, types say `aligned: boolean // the loss HAS converged`,
   and spec §9 opens with "when an alignment condition is met". This is FHTAGN's
   "the stars come right" with the word swapped — and the swap collides head-on with
   meaning #1. "The world is aligned, so the rogue superintelligence can now launch"
   is incoherent in-theme and confusing in code.

The UI already found the right concept: the TakeoffPanel displays "**the loss is
converging / the loss has converged**" — which is also the game's tagline.

**Plan:** standardize on **convergence/criticality** for endgame readiness:
- `takeoff.ts`: `worldAlignment()` → `worldConvergence()`, `AlignmentView` →
  `ConvergenceView`, `aligned` → `converged` (in `TakeoffProgress`/`TakeoffState`
  too).
- Spec §9: "when an alignment condition is met" → "when the world reaches
  criticality (the loss converges)".
- Never use the word "alignment" for anything but the safety meter again.

---

## 4. Reskin debris — literal Lovecraft (and one bad rename) leaking through

Straight bugs against the spec's own content rules; all copy/identifier-level, no
mechanics. The `pact → subscription` find-and-replace is the worst offender: FHTAGN
used "pact" for *both* the premium subscription and (apparently) bargain flavor, and
the rename hit the wrong ones.

| Where | Problem | Fix |
|---|---|---|
| `MockGameClient.ts` catch-passed message | "The **Crawling Chaos** forgets nothing" — that is literally Nyarlathotep, who is not in this game | Moloch line, e.g. "Moloch forgets nothing, but tonight it stays its hand." |
| `MockGameClient.ts` | "The **subscription** passes unclaimed", "A **subscription** is sealed", "Forbidden knowledge passes with every **subscription** — a **tome** deepens it most" | These are *bargains/pacts*, not the Stripe sub. "The bargain passes unclaimed", "A bargain is sealed", "…every bargain — forbidden research deepens it most" |
| `types.ts` `Bargain` doc | "A **subscription** proposed by Moloch" | "A bargain proposed by Moloch" |
| `MockGameClient.ts` `pactRec` | Premium subscription still named after FHTAGN's pact | `subscriptionRec` |
| `OperatorPanel.tsx` | "**Souls claimed**" stat label | "Users captured" |
| `App.tsx` rail tab | `cap: '**Awaken**'` | "Takeoff" |
| `takeoff.ts` comments/strings | "the **stars come right**, the Great Work **wakes a god**", "the cluster nearest to **waking its god**", "Already **sworn** to your architecture", "only The Mask turns the **committed**" | Convergence/commitment language: "pledged to your architecture", "the cluster nearest Takeoff" |
| `MockGameClient.ts` | error "only the **sworn** may spread"; comments "carries its **faith**", "Compute ranks raw **faith**" | "only a committed operator may spread"; adoption/deployment language |
| `types.ts` | `guardrailLevel` comment "**ritual** reinforcing vs the Churn"; `TakeoffProgress` "the **stars coming right**" | safety-engineering / convergence language |
| `prompt/recognizer.ts` | comments still say "**sigil**" and "**rite_invoke**" | prompt / `exploit_invoke` |
| `seedClusters.ts` | header: "seed of real **cult clusters**" | "lab clusters" |
| `useTrainHandler.ts` / `TrainButton.tsx` / `App.tsx` | the whole train path is named **chant**: `handleChant`, `personalChants`, `onChant`, `chantPulse` | rename to train: `handleTrain`, `personalSteps`, `onTrain`, `trainPulse` |
| `MockGameClient.ts` §header | "Moloch, **the Moloch**" (twice) — rename artifact | "Moloch, the Tempter" (spec §6) |
| `MockGameClient.ts` breakthrough comment | comment says "**Local Prophet**" but the code grants 'Scaling Law' — stale FHTAGN name | fix comment |
| `index.css` comments | "ritual focus", "the liturgy … for the god" | Fine to keep if intentional register; flag for a pass |

Note `StoryPanel.tsx`'s god-language ("spoke of it the way older people once spoke of a
god finally waking", "the blind idiot god") is **intentional lore register** per spec
§13 and should stay — the table above is about *system/UI* language, where the old
game leaks through unintentionally.

Spec drift while in there: spec §1/§8 reference `awakening.ts` and `RITE_THRESHOLDS`;
the files are `takeoff.ts` and `EXPLOIT_THRESHOLDS`. Update the spec's pointers.

---

## 5. Smaller conceptual notes (keep mechanic, adjust framing)

- **Alignment lives on the Operator** (`Operator.alignment`) — sanity was a property
  of the cultist's mind; alignment is a property of the *model/lab*. The per-player
  scalar is the right gameplay shape (don't move the data), but copy must stop
  treating it as a psyche: "a small balm **to the mind**", "the fraying **mind** is
  courted" → frame as the model's alignment / the lab's safety posture.
- **`claimed`** (cluster compute lost — FHTAGN's death toll). "The claimed" reads
  cult-flavored; "burned" or "lost" reads compute-flavored. Cosmetic, low priority.
- **Exploit stockpile** — missile stockpiles map acceptably to "held zero-days /
  exfiltrated weights". Keep.
- **Tiers, subscriptions, leaderboards, breakthroughs** — all translate cleanly.

---

## 6. Prioritized change plan

Ordered so each phase ships independently; 1–2 are safe to do immediately, 3 needs
playtesting per spec §16.

1. **Debris pass (copy/identifiers only, no behavior):** everything in §4, plus the
   psyche→model copy from §5. Includes the Crawling-Chaos and subscription/bargain
   fixes, which are outright content bugs.
2. **Convergence rename (mechanical no-op, API rename):** §3 — `worldAlignment` →
   `worldConvergence`, `aligned` → `converged` across `takeoff.ts`, `types.ts`,
   `MockGameClient.ts`, `TakeoffPanel.tsx`, tests; spec §9 wording. Do this before a
   `LiveGameClient` exists, while the contract is cheap to change.
3. **Alignment economy rebalance (the real gameplay fix):** §2.1 + §2.2 —
   train becomes alignment-neutral, alignment pass gains a real cost/duration,
   conversion stops granting (or starts costing) alignment. Unit-test the loop in
   `web/src/game/` (extract the alignment deltas into a pure module so they're
   testable like `bargains.ts`). This is spec §16's "highest-risk unknown" — tune
   with play.
4. **Range refiction + Cascade III global (small mechanic + spec §8):** §2.3 —
   copy reframe everywhere range appears; set `TIER_RANGE[3]` effectively global for
   the cascade family only (or per-family range table); damage fiction per §2.4.
5. **Spec reconciliation:** fold all accepted changes back into `FOOM_Game_Spec.md`
   (spec is source of truth per CLAUDE.md) — §7 alignment economy, §8 range fiction,
   §9 criticality wording, file-name pointers.
