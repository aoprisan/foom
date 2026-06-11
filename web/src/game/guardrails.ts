import { GUARDRAIL_ALIGNMENT_GAIN } from './alignment'

// Guardrails — the containment layer (spec §7, §9), in one pure, testable
// module. Alignment is the model's *disposition*; guardrails are the
// *containment* around it, and that containment is now load-bearing in three
// systems: they blunt the Churn, they catch a treacherous turn mid-swing
// (risk.ts), and they blunt incoming exploit strikes from rivals. One set of
// rules, so a balance tweak moves all three together.
//
// Two invariants:
//   - Containment is never total: mitigation caps below 100%, and a strike
//     that lands always takes something.
//   - Containment is never free: a caught strike spends the guardrail, and
//     every tick erodes it — safety mitigations rot unless tended.

/** A fully-tended guardrail caps mitigation at 80% — never total. */
export const GUARDRAIL_MAX = 80
/** Each act of tending raises the guardrail this much. */
export const GUARDRAIL_STEP = 18
/** Guardrails erode each tick; they must be tended, not set-and-forget. */
export const GUARDRAIL_DECAY = 1.2
/** A strike that lands spends part of the guardrail blunting it. */
export const GUARDRAIL_ABSORB = 22

/** Mitigation in [0, GUARDRAIL_MAX/100] a guardrail of the given level grants. */
export function guardrailMitigation(guardrailLevel: number): number {
  return Math.min(GUARDRAIL_MAX, Math.max(0, guardrailLevel)) / 100
}

export interface ContainedStrike {
  damage: number     // what still gets through
  level: number      // the guardrail after spending itself on the catch
  guarded: boolean   // whether any containment was in place at all
}

/**
 * Apply containment to an incoming strike — the Churn, a rival's exploit.
 * The damage is blunted (never to zero) and the guardrail spends itself on
 * the catch. A bare cluster takes the strike in full.
 */
export function containStrike(rawDamage: number, guardrailLevel: number): ContainedStrike {
  const guarded = guardrailLevel > 0
  return {
    damage: Math.round(rawDamage * (1 - guardrailMitigation(guardrailLevel))),
    level: guarded ? Math.max(0, guardrailLevel - GUARDRAIL_ABSORB) : guardrailLevel,
    guarded,
  }
}

export interface TendResult {
  level: number          // the guardrail after the reinforcement
  alignmentGain: number  // the sliver of alignment the safety work restores
}

/**
 * Tend the guardrails. The alignment sliver scales with the reinforcement
 * actually applied — deliberate safety work restores the model's alignment,
 * but re-tending a guardrail already at cap reinforces nothing and restores
 * nothing. (Otherwise tending at cap would be a free alignment grind, and the
 * push/recover gamble collapses into a timer — spec §7's #1 rule.)
 */
export function tendGuardrail(guardrailLevel: number): TendResult {
  const level = Math.min(GUARDRAIL_MAX, guardrailLevel + GUARDRAIL_STEP)
  const applied = level - guardrailLevel
  return { level, alignmentGain: GUARDRAIL_ALIGNMENT_GAIN * (applied / GUARDRAIL_STEP) }
}
