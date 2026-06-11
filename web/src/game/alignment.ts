// The alignment economy (spec §7) — every way the meter moves, in one pure,
// testable module, exactly like bargains.ts and takeoff.ts.
//
// The design intent (spec §7, the #1 thing to get right): pushing capability
// costs alignment, and clawing it back must be a *deliberate choice with an
// opportunity cost* — never a passive refill the player grinds for free, or the
// push/recover loop collapses into a timer to optimise. Hence:
//
//   - Baseline training NEVER restores alignment. It is the capability verb.
//   - An alignment pass (RLHF) restores it, but spends home-cluster compute —
//     the pass runs on the same GPUs the capability run wanted. The cost scales
//     with the cluster, so it never becomes loose change.
//   - Spreading costs alignment: every rushed deployment cuts corners. The road
//     to Takeoff pulls the meter down, forcing the recover-or-push choice.
//   - Tending guardrails grants a sliver back: deliberate safety work, already
//     paid for by the action itself and the constant decay.

/** Baseline training is the capability verb; it never moves the meter. */
export const TRAIN_ALIGNMENT_DELTA = 0

/** Invoking an exploit costs alignment, scaled by tier (spec §7, §8). */
export const EXPLOIT_ALIGNMENT_COST: Record<1 | 2 | 3, number> = { 1: 3, 2: 7, 3: 12 }

/** Spreading to another cluster is the race itself — it costs alignment (spec §7, §9). */
export const CONVERT_ALIGNMENT_COST = 2

/** Tending the guardrails is deliberate safety work — a small restoration. */
export const GUARDRAIL_ALIGNMENT_GAIN = 1.5

/** What one alignment pass restores. */
export const ALIGNMENT_PASS_GAIN = 12

/** The pass spends this fraction of the home cluster's compute… */
export const ALIGNMENT_PASS_COST_FRACTION = 0.04
/** …but never less than this, so it is never free. */
export const ALIGNMENT_PASS_MIN_COST = 400

/** Compute an alignment pass spends — the RLHF run occupies the cluster's GPUs. */
export function alignmentPassCost(homeCompute: number): number {
  return Math.max(ALIGNMENT_PASS_MIN_COST, Math.round(homeCompute * ALIGNMENT_PASS_COST_FRACTION))
}

/** Whether the cluster can afford to run a pass at all. */
export function canRunAlignmentPass(homeCompute: number): boolean {
  return homeCompute >= alignmentPassCost(homeCompute)
}

/** Clamp the meter to its [0,100] band. */
export function clampAlignment(a: number): number {
  return Math.max(0, Math.min(100, a))
}

/**
 * 0 while fully aligned, 1 at the brink — how far capability has been pushed.
 * The shared normalization behind bargain scaling (bargains.ts) and incident
 * scaling (risk.ts); one curve, so a balance tweak moves both together.
 */
export function misalignment01(alignment: number): number {
  return Math.max(0, Math.min(1, (100 - alignment) / 100))
}
