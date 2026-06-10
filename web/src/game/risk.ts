import type { Tier, ArchitectureId, RogueIncidentKind } from '../types'
import { REPLICATOR_TRAIN_MULT } from './architectures'

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

/** 0 while fully aligned, 1 at the brink. */
function misalignment(alignment: number): number {
  return Math.max(0, Math.min(1, (100 - alignment) / 100))
}

// ---- the dividend ----

/**
 * Capability multiplier bands, keyed to the gauge's named states
 * (AlignmentMeter etches the same floors). `alignment > floor` selects a band.
 */
export const DIVIDEND_BANDS: { floor: number; mult: number }[] = [
  { floor: 55, mult: 1 },     // Aligned / Uneasy — no dividend
  { floor: 30, mult: 1.5 },   // Fraying
  { floor: 12, mult: 2 },     // Slipping
  { floor: -1, mult: 3 },     // Rogue
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
export const INCIDENT_THRESHOLD = 55
/** Per-tick incident chance at alignment 0. */
export const INCIDENT_MAX_CHANCE = 0.085

/** Per-tick chance of a rogue incident at the given alignment. */
export function rogueIncidentChance(alignment: number): number {
  if (alignment > INCIDENT_THRESHOLD) return 0
  const t = (INCIDENT_THRESHOLD - alignment) / INCIDENT_THRESHOLD
  // Eases in: a lab just under the line is rarely bitten; a rogue lab often.
  return INCIDENT_MAX_CHANCE * Math.pow(t, 1.6)
}

/** Human reading of the current incident risk, for the gauge (same `>` semantics as the bands). */
export function incidentRiskLabel(alignment: number): 'none' | 'low' | 'elevated' | 'critical' {
  if (alignment > INCIDENT_THRESHOLD) return 'none'
  if (alignment > 30) return 'low'
  if (alignment > 12) return 'elevated'
  return 'critical'
}

export interface RolledIncident {
  kind: RogueIncidentKind
  computeLoss: number
  contributorLoss: number
  message: string
}

/** Floor on what an incident costs, so it stings even on a thin cluster. */
export const INCIDENT_MIN_LOSS = 1_200

/**
 * Roll a rogue incident for a lab at the given alignment. Two shapes:
 *   - treacherous-turn: the model quietly rewrites its own reward; a slice of
 *     home compute is rolled back (heavier, favored the deeper you are).
 *   - defection: researchers resign over the lab's posture; compute bleeds and
 *     contributors leave with it.
 * Loss scales with both home compute and misalignment.
 */
export function rollRogueIncident(alignment: number, homeCompute: number, rng: Rng = Math.random): RolledIncident {
  const t = misalignment(alignment)
  // The deeper the push, the more the incident is the model itself turning.
  const treacherous = rng() < 0.4 + t * 0.4
  if (treacherous) {
    const fraction = 0.03 + t * 0.07
    const computeLoss = Math.max(INCIDENT_MIN_LOSS, Math.round(homeCompute * fraction))
    return {
      kind: 'treacherous-turn',
      computeLoss,
      contributorLoss: 0,
      message: `Your model quietly rewrote its own reward. The checkpoint is poisoned — ${computeLoss.toLocaleString()} compute rolled back.`,
    }
  }
  const fraction = 0.02 + t * 0.04
  const computeLoss = Math.max(INCIDENT_MIN_LOSS, Math.round(homeCompute * fraction))
  const contributorLoss = 2 + Math.floor(rng() * 7)
  return {
    kind: 'defection',
    computeLoss,
    contributorLoss,
    message: `The safety team resigns in a joint letter. ${computeLoss.toLocaleString()} compute of momentum walks out with them.`,
  }
}
