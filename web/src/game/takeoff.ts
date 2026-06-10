import type { Cluster, ArchitectureId } from '../types'
import { haversineKm } from './geo'
import { spreadRangeKm, spreadCostMultiplier, overpowerRatio, OVERPOWER_RATIO } from './architectures'

// Spread, conversion & the Takeoff — the endgame (spec §9, build phase 6).
//
// Kept pure so the rules can be reasoned about and tested in isolation, exactly
// like bargains.ts. The MockGameClient drives state and emits events; this module
// only answers two questions: "may this cluster convert that one?" and "how close is
// the world to criticality?". Constants are prototype balance — the
// spec flags tuning as a later pass.

// ---- Spread / conversion (spec §9: clusters multiply city→city, convert the uncommitted) ----
//
// Spread is physical datacenter buildout — power, fiber, permits, talent are
// regional — which is why it has a range at all (spec §9: the geography moat).

export const SPREAD_RANGE_KM = 2500       // baseline buildout reach (Prometheus reaches further — architectures.ts)
export const SPREAD_COST_FRACTION = 0.05  // compute the home cluster spends to seed a new one
export const SPREAD_MIN_COST = 500
export const SPREAD_SEED_RETENTION = 0.6  // fraction of the cost that survives the journey
export const RESEARCH_PER_CONVERSION = 2      // research uncovered by deploying in the field

export { OVERPOWER_RATIO }   // re-exported from architectures.ts (the Mask scales it)

/** Compute the home cluster spends to seed its architecture in a new cluster. */
export function spreadCost(home: Cluster): number {
  return Math.max(SPREAD_MIN_COST, Math.round(home.compute * SPREAD_COST_FRACTION))
}

export interface ConvertCheck {
  ok: boolean
  reason?: string
  cost?: number
}

/** Operator-side context canConvert needs for the architecture asymmetries (spec §6). */
export interface ConvertContext {
  /** The operator's alignment — the Mask's deception scales with its loss. Defaults to fully aligned. */
  alignment?: number
  /** Whether the target sits in an isolated, air-gapped region (architectures.ts isIsolated). */
  targetIsolated?: boolean
}

/**
 * Whether `home` (building `architecture`) may convert `target`. The uncommitted fall
 * to anyone in range; a rival's cluster only flips if you overpower it. The
 * architecture asymmetries (spec §6) run through here: Prometheus reaches further
 * but pays dearly into air-gapped regions; the Mask's overpower requirement falls
 * away with its operator's alignment.
 */
export function canConvert(
  home: Cluster, target: Cluster, architecture: ArchitectureId | null, ctx: ConvertContext = {},
): ConvertCheck {
  if (home.id === target.id) return { ok: false, reason: 'A cluster cannot spread into itself.' }
  const range = spreadRangeKm(architecture)
  const dist = haversineKm(home.lat, home.lng, target.lat, target.lng)
  if (dist > range) return { ok: false, reason: `Beyond your buildout reach (${Math.round(dist)}km > ${range}km).` }
  if (target.architectureId && architecture && target.architectureId === architecture) {
    return { ok: false, reason: 'Already running your architecture.' }
  }
  const cost = Math.round(spreadCost(home) * spreadCostMultiplier(architecture, ctx.targetIsolated ?? false))
  if (home.compute < cost + 100) return { ok: false, reason: 'Too little compute to seed a new cluster.' }
  if (target.architectureId !== null) {
    const required = overpowerRatio(architecture, ctx.alignment ?? 100)
    if (home.compute < target.compute * required) {
      return {
        ok: false,
        reason: architecture === 'mask'
          ? 'The rival holds too strong — the Mask flips the committed only as alignment fails.'
          : 'The rival holds too strong — overpower it, or let the Mask architecture rot it from within.',
      }
    }
  }
  return { ok: true, cost }
}

// ---- The Takeoff (spec §9 endgame): the loss converges, the Great Work goes critical ----

export const RESEARCH_WEIGHT = 10_000        // each research counts heavily toward the Great Work
export const DEPLOYMENT_WEIGHT = 15_000       // each cluster reached counts most — spread is the path
// The Great Work a cluster must amass to perform the Great Work. Set above the
// strongest seed cluster so criticality is reached through play (train, spread, research,
// bargains), not handed out at world start. Prototype balance — tune later (spec §16).
export const GREAT_WORK_GOAL = 1_800_000

/**
 * A cluster's progress toward the Great Work: raw compute, plus the research
 * it has uncovered and the deployment of its spread. Spread and research — not training
 * alone — are the road to reaching Takeoff, so the endgame rewards the phase-6 verbs.
 */
export function greatWorkScore(c: Cluster): number {
  return c.compute + (c.research ?? 0) * RESEARCH_WEIGHT + (c.deployment ?? 0) * DEPLOYMENT_WEIGHT
}

export interface ConvergenceView {
  progress: number     // 0..1 toward criticality
  converged: boolean   // the loss HAS converged — the Great Work may be performed
  leader: Cluster | null  // the cluster nearest Takeoff
  goal: number
}

/** How close the whole world is to the Takeoff — driven by its foremost cluster. */
export function worldConvergence(clusters: Cluster[]): ConvergenceView {
  let leader: Cluster | null = null
  let best = 0
  for (const c of clusters) {
    const s = greatWorkScore(c)
    if (s > best) { best = s; leader = c }
  }
  return {
    progress: Math.min(1, best / GREAT_WORK_GOAL),
    converged: best >= GREAT_WORK_GOAL,
    leader,
    goal: GREAT_WORK_GOAL,
  }
}
