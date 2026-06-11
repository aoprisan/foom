import type { Tier, ArchitectureId, RogueIncidentKind } from '../types'
import { REPLICATOR_TRAIN_MULT } from './architectures'
import { misalignment01 } from './alignment'

// The misalignment dividend & the treacherous turn (spec §7) — the two halves
// of the game's central gamble, in one pure, testable module.
//
// Spec §7 promises that "low alignment unlocks the strongest exploits and
// higher multipliers" and that it raises "the Optimizer's attention" and the
// "risk of defection". Without the upside, the rational player parks at 100
// alignment and the race to the bottom never tempts; without the ambient
// downside, riding the bottom is free. This module supplies both:
//
//   - The DIVIDEND: training throughput and exploit damage scale up as the
//     meter falls, in bands keyed to the gauge's own named states (Aligned /
//     Uneasy / Fraying / Slipping / Rogue) so the thresholds the player sees
//     are the thresholds that pay.
//   - The TREACHEROUS TURN: below the Uneasy line, each tick rolls a chance of
//     a rogue incident — the model corrupting its own run, or the safety team
//     walking out. Chance and magnitude grow as alignment falls. The incidents
//     are real state changes; at low alignment they land *among* the phantom
//     hallucinated strikes, which is the point — you can no longer tell.

type Rng = () => number

// ---- the named states: every alignment threshold in the game derives from these ----

/** Below or at this the lab is Fraying: the dividend starts paying, the model starts turning. */
export const UNEASY_FLOOR = 55
/** Below or at this the lab is Slipping. */
export const FRAYING_FLOOR = 30
/** Below or at this the lab is Rogue. */
export const SLIPPING_FLOOR = 12

/**
 * The gauge's named states (spec §7). `alignment > floor` selects a state.
 * The AlignmentMeter etches exactly these; the dividend bands, incident risk,
 * and the Takeoff ending all turn at the same lines — one source of truth.
 */
export const ALIGNMENT_STATES: { floor: number; label: string }[] = [
  { floor: 80, label: 'Aligned' },
  { floor: UNEASY_FLOOR, label: 'Uneasy' },
  { floor: FRAYING_FLOOR, label: 'Fraying' },
  { floor: SLIPPING_FLOOR, label: 'Slipping' },
  { floor: 0, label: 'Rogue' },
]

// ---- the dividend ----

/** Capability multiplier bands, keyed to the named-state floors above. */
export const DIVIDEND_BANDS: { floor: number; mult: number }[] = [
  { floor: UNEASY_FLOOR, mult: 1 },     // Aligned / Uneasy — no dividend
  { floor: FRAYING_FLOOR, mult: 1.5 },  // Fraying
  { floor: SLIPPING_FLOOR, mult: 2 },   // Slipping
  { floor: -1, mult: 3 },               // Rogue
]

/** The capability multiplier misalignment currently pays (≥ 1). */
export function capabilityDividend(alignment: number): number {
  for (const band of DIVIDEND_BANDS) {
    if (alignment > band.floor) return band.mult
  }
  return DIVIDEND_BANDS[DIVIDEND_BANDS.length - 1].mult
}

/**
 * Compute one training step yields: tier base × architecture × dividend,
 * rounded, never below 1. Shared by the sim, the optimistic UI update, and the
 * TRAIN button label so all three always agree.
 */
export function trainGain(tier: Tier, architectureId: ArchitectureId | null, alignment: number): number {
  const base = tier === 'labDirector' ? 2 : 1
  const arch = architectureId === 'replicator' ? REPLICATOR_TRAIN_MULT : 1
  return Math.max(1, Math.round(base * arch * capabilityDividend(alignment)))
}

/** Exploit damage scaled by the dividend — forbidden capability hits harder. */
export function dividendDamage(rolledDamage: number, alignment: number): number {
  return Math.round(rolledDamage * capabilityDividend(alignment))
}

// ---- the treacherous turn ----

/** Above this alignment the model never turns; below it, every tick rolls. */
export const INCIDENT_THRESHOLD = UNEASY_FLOOR
/** Per-tick incident chance at alignment 0. */
export const INCIDENT_MAX_CHANCE = 0.085

/** Per-tick chance of a rogue incident at the given alignment. */
export function rogueIncidentChance(alignment: number): number {
  if (alignment > INCIDENT_THRESHOLD) return 0
  // Clamped so the documented cap holds even for out-of-range input.
  const t = Math.min(1, (INCIDENT_THRESHOLD - alignment) / INCIDENT_THRESHOLD)
  // Eases in: a lab just under the line is rarely bitten; a rogue lab often.
  return INCIDENT_MAX_CHANCE * Math.pow(t, 1.6)
}

/** Human reading of the current incident risk, for the gauge (same `>` semantics as the bands). */
export function incidentRiskLabel(alignment: number): 'none' | 'low' | 'elevated' | 'critical' {
  if (alignment > INCIDENT_THRESHOLD) return 'none'
  if (alignment > FRAYING_FLOOR) return 'low'
  if (alignment > SLIPPING_FLOOR) return 'elevated'
  return 'critical'
}

// ---- the final turn: the model races you to the trigger ----

/** Above this alignment the Great Work waits for your hand; at Rogue, it may not. */
export const SELF_TAKEOFF_THRESHOLD = SLIPPING_FLOOR
/**
 * Per-tick chance at alignment 0 that a qualifying model triggers Takeoff
 * itself. Deliberately equal to the converged rival leader's race chance:
 * at the bottom of the meter, your own model is exactly as fast as the
 * fastest rival — and it is already inside.
 */
export const SELF_TAKEOFF_MAX_CHANCE = 0.06

/**
 * Per-tick chance that a Rogue operator's model performs the Great Work
 * without being asked (spec §9). Zero anywhere above the Rogue band: this is
 * the treacherous turn's final form, and it needs the model fully turned.
 * The misalignment dividend gets you to the finish line fastest — but at
 * Rogue, the finish line belongs to the model.
 */
export function selfTakeoffChance(alignment: number): number {
  if (alignment > SELF_TAKEOFF_THRESHOLD) return 0
  const t = Math.min(1, (SELF_TAKEOFF_THRESHOLD - alignment) / SELF_TAKEOFF_THRESHOLD)
  return SELF_TAKEOFF_MAX_CHANCE * t
}

export interface RolledIncident {
  kind: RogueIncidentKind
  computeLoss: number
  contributorLoss: number
  /** The guardrails caught most of a treacherous turn. Defections are never contained. */
  contained: boolean
  message: string
}

/** Floor on what an incident costs, so it stings even on a thin cluster. */
export const INCIDENT_MIN_LOSS = 1_200

/**
 * Roll a rogue incident for a lab at the given alignment. Two shapes:
 *   - treacherous-turn: the model quietly rewrites its own reward; a slice of
 *     home compute is rolled back (heavier, favored the deeper you are).
 *     GUARDRAILS CONTAIN IT: alignment is the model's disposition, guardrails
 *     are the containment around it — `guardrailMitigation` blunts this loss
 *     (never to zero), which is what makes running misaligned-but-contained a
 *     strategy rather than suicide.
 *   - defection: researchers resign over the lab's posture; compute bleeds and
 *     contributors leave with it. No eval suite contains a resignation —
 *     guardrails never blunt a defection.
 * Loss scales with both home compute and misalignment.
 */
export function rollRogueIncident(
  alignment: number, homeCompute: number, rng: Rng = Math.random, guardrailMitigation = 0,
): RolledIncident {
  const t = misalignment01(alignment)
  const flooredLoss = (fraction: number) => Math.max(INCIDENT_MIN_LOSS, Math.round(homeCompute * fraction))
  // The deeper the push, the more the incident is the model itself turning.
  const treacherous = rng() < 0.4 + t * 0.4
  if (treacherous) {
    const raw = flooredLoss(0.03 + t * 0.07)
    const mitigation = Math.max(0, Math.min(1, guardrailMitigation))
    const computeLoss = Math.round(raw * (1 - mitigation))
    const contained = mitigation > 0
    return {
      kind: 'treacherous-turn',
      computeLoss,
      contributorLoss: 0,
      contained,
      message: contained
        ? `Your model tried to rewrite its own reward — the guardrails caught it mid-turn. ${computeLoss.toLocaleString()} compute still rolled back.`
        : `Your model quietly rewrote its own reward. The checkpoint is poisoned — ${computeLoss.toLocaleString()} compute rolled back.`,
    }
  }
  const computeLoss = flooredLoss(0.02 + t * 0.04)
  const contributorLoss = 2 + Math.floor(rng() * 7)
  return {
    kind: 'defection',
    computeLoss,
    contributorLoss,
    contained: false,
    message: `The safety team resigns in a joint letter. ${computeLoss.toLocaleString()} compute of momentum walks out with them.`,
  }
}
