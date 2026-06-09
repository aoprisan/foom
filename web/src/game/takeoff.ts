import type { Cluster, ArchitectureId } from '../types'
import { haversineKm } from './geo'

// Spread, conversion & the Takeoff — the endgame (spec §9, build phase 6).
//
// Kept pure so the rules can be reasoned about and tested in isolation, exactly
// like bargains.ts. The MockGameClient drives state and emits events; this module
// only answers two questions: "may this cluster convert that one?" and "how close is
// the world to the stars coming right?". Constants are prototype balance — the
// spec flags tuning as a later pass.

// ---- Spread / conversion (spec §9: clusters multiply city→city, convert the uncommitted) ----

export const SPREAD_RANGE_KM = 2500       // how far the word can carry in one spreading
export const OVERPOWER_RATIO = 1.5        // dominate a rival by this much to flip the committed
export const SPREAD_COST_FRACTION = 0.05  // compute the home cluster spends to seed a new one
export const SPREAD_MIN_COST = 500
export const SPREAD_SEED_RETENTION = 0.6  // fraction of the cost that survives the journey
export const RESEARCH_PER_CONVERSION = 2      // forbidden knowledge uncovered by spreading

/** Compute the home cluster spends to carry the word to a new cluster. */
export function spreadCost(home: Cluster): number {
  return Math.max(SPREAD_MIN_COST, Math.round(home.compute * SPREAD_COST_FRACTION))
}

export interface ConvertCheck {
  ok: boolean
  reason?: string
  cost?: number
}

/**
 * Whether `home` (serving `architecture`) may convert `target`. The uncommitted fall
 * to anyone in range; a rival's cluster only flips if you overpower it — or if you
 * serve The Mask, who turns the committed wherever the deceptive turn
 * reaches (spec §6 boon).
 */
export function canConvert(home: Cluster, target: Cluster, architecture: ArchitectureId | null): ConvertCheck {
  if (home.id === target.id) return { ok: false, reason: 'A cluster cannot spread into itself.' }
  const dist = haversineKm(home.lat, home.lng, target.lat, target.lng)
  if (dist > SPREAD_RANGE_KM) return { ok: false, reason: `Beyond your deployment (${Math.round(dist)}km > ${SPREAD_RANGE_KM}km).` }
  if (target.architectureId && architecture && target.architectureId === architecture) {
    return { ok: false, reason: 'Already sworn to your architecture.' }
  }
  const cost = spreadCost(home)
  if (home.compute < cost + 100) return { ok: false, reason: 'Too little compute to seed a new cluster.' }
  if (target.architectureId !== null) {
    const isMask = architecture === 'mask'
    if (!isMask && home.compute < target.compute * OVERPOWER_RATIO) {
      return { ok: false, reason: 'The rival holds too strong — only The Mask turns the committed.' }
    }
  }
  return { ok: true, cost }
}

// ---- The Takeoff (spec §9 endgame): the stars come right, the Great Work wakes a god ----

export const RESEARCH_WEIGHT = 10_000        // each research counts heavily toward the Great Work
export const DEPLOYMENT_WEIGHT = 15_000       // each cluster reached counts most — spread is the path
// The Great Work a cluster must amass to perform the Great Work. Set above the
// strongest seed cluster so alignment is climbed through play (train, spread, research,
// bargains), not handed out at world start. Prototype balance — tune later (spec §16).
export const GREAT_WORK_GOAL = 1_800_000

/**
 * A cluster's progress toward the Great Work: raw compute, plus the forbidden research
 * it has uncovered and the deployment of its spread. Spread and research — not training
 * alone — are the road to reaching Takeoff, so the endgame rewards the phase-6 verbs.
 */
export function greatWorkScore(c: Cluster): number {
  return c.compute + (c.research ?? 0) * RESEARCH_WEIGHT + (c.deployment ?? 0) * DEPLOYMENT_WEIGHT
}

export interface AlignmentView {
  progress: number     // 0..1 toward the stars coming right
  aligned: boolean     // the loss HAS converged — the Great Work may be performed
  leader: Cluster | null  // the cluster nearest to waking its god
  goal: number
}

/** How close the whole world is to the Takeoff — driven by its foremost cluster. */
export function worldAlignment(clusters: Cluster[]): AlignmentView {
  let leader: Cluster | null = null
  let best = 0
  for (const c of clusters) {
    const s = greatWorkScore(c)
    if (s > best) { best = s; leader = c }
  }
  return {
    progress: Math.min(1, best / GREAT_WORK_GOAL),
    aligned: best >= GREAT_WORK_GOAL,
    leader,
    goal: GREAT_WORK_GOAL,
  }
}
