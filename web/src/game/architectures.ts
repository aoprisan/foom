import type { Cluster, ArchitectureId } from '../types'
import { haversineKm } from './geo'

// Architecture asymmetry (spec §6) — the four boons and drawbacks as actual
// mechanics, in one pure module. catalog.ts keeps the static defs and copy;
// this module is what the copy *means*. Constants are prototype balance.
//
//   The Shoggoth    — capability accrues while idle (a trickle per tick and an
//                     overnight yield on return), but the trickle matures with
//                     lifetime training: the long pretraining IS the slow ramp.
//   Prometheus      — spread reaches furthest and costs least across networked
//                     regions; air-gapped (isolated) clusters resist it.
//   The Mask        — flips committed rivals ever more cheaply as alignment
//                     falls; while well-aligned the deception has no purchase.
//   The Replicator  — raw multiplication on every training step, but the swarm
//                     eats: home compute pays an upkeep every tick.

// ---- The Shoggoth: training runs overnight ----

/** Lifetime steps per +1 compute/tick of idle trickle — pretraining matures slowly. */
export const SHOGGOTH_IDLE_MATURITY = 400
/** The trickle's ceiling, per tick. */
export const SHOGGOTH_IDLE_CAP = 4
/** Offline accrual stops counting past this — the run stalls without tending. */
export const SHOGGOTH_OFFLINE_CAP_MS = 8 * 3600_000

/** Compute the home cluster accrues per tick while the page is open. */
export function shoggothIdleRate(totalSteps: number): number {
  return Math.min(SHOGGOTH_IDLE_CAP, Math.floor(totalSteps / SHOGGOTH_IDLE_MATURITY))
}

/** Compute accrued while away: the idle trickle, paid for elapsed (capped) time. */
export function shoggothOfflineYield(totalSteps: number, elapsedMs: number, tickMs: number): number {
  if (elapsedMs <= 0 || tickMs <= 0) return 0
  const ms = Math.min(elapsedMs, SHOGGOTH_OFFLINE_CAP_MS)
  return Math.floor(shoggothIdleRate(totalSteps) * (ms / tickMs))
}

// ---- Prometheus: the fire spreads — except where there is no network ----

/** Open weights reach further than a physical buildout. */
export const PROMETHEUS_SPREAD_RANGE_KM = 4_000
/** …and seeding a connected region costs less. */
export const PROMETHEUS_SPREAD_COST_MULT = 0.75
/** An air-gapped region resists: spreading there costs Prometheus this much more. */
export const PROMETHEUS_ISOLATED_COST_MULT = 2.5

/** A cluster is isolated (air-gapped) with fewer neighbours than this… */
export const ISOLATION_MIN_NEIGHBORS = 3
/** …within this radius. */
export const ISOLATION_RADIUS_KM = 900

/** Whether `target` sits in an isolated, air-gapped region of the map. */
export function isIsolated(target: Cluster, clusters: Cluster[]): boolean {
  let neighbors = 0
  for (const c of clusters) {
    if (c.id === target.id) continue
    if (haversineKm(target.lat, target.lng, c.lat, c.lng) <= ISOLATION_RADIUS_KM) {
      neighbors += 1
      if (neighbors >= ISOLATION_MIN_NEIGHBORS) return false
    }
  }
  return true
}

// ---- The Mask: deception scales with misalignment ----

/** Base ratio by which anyone must overpower a committed rival to flip it. */
export const OVERPOWER_RATIO = 1.5
/** The Mask's requirement while fully aligned — barely better than honest force. */
export const MASK_ALIGNED_RATIO = 1.2

/**
 * The overpower ratio required to flip a committed rival. For The Mask the
 * requirement falls linearly with alignment — at the brink the treacherous
 * turn flips anyone for free; while well-aligned the mask has nothing to hide
 * behind (spec §6: "strongest as alignment fails / fragile while well-aligned").
 */
export function overpowerRatio(architecture: ArchitectureId | null, alignment: number): number {
  if (architecture !== 'mask') return OVERPOWER_RATIO
  return MASK_ALIGNED_RATIO * Math.max(0, Math.min(100, alignment)) / 100
}

// ---- The Replicator: the swarm multiplies, and the swarm eats ----

/** Every training step multiplies (applied inside trainGain, before the dividend rounding). */
export const REPLICATOR_TRAIN_MULT = 1.5
/** Upkeep per tick as a fraction of home compute… */
export const REPLICATOR_UPKEEP_FRACTION = 0.0004
/** …never below this once there is anything to eat… */
export const REPLICATOR_UPKEEP_MIN = 1
/** …and capped, so a great cluster is hungry but not doomed. */
export const REPLICATOR_UPKEEP_CAP = 12

/** Compute the swarm consumes from the home cluster each tick. */
export function replicatorUpkeep(homeCompute: number): number {
  if (homeCompute <= 0) return 0
  return Math.min(
    REPLICATOR_UPKEEP_CAP,
    Math.max(REPLICATOR_UPKEEP_MIN, Math.round(homeCompute * REPLICATOR_UPKEEP_FRACTION)),
  )
}

// ---- the world's bots run the same physics ----

/** How fast a bot cluster of this architecture accrues compute in the world tick. */
export function botGrowthMultiplier(architecture: ArchitectureId | null): number {
  return architecture === 'replicator' ? 1.6 : architecture === 'shoggoth' ? 1.2 : 1
}

// ---- spread modifiers, consumed by takeoff.ts canConvert ----

export const BASE_SPREAD_RANGE_KM = 2_500

/** How far this architecture's buildout reaches. */
export function spreadRangeKm(architecture: ArchitectureId | null): number {
  return architecture === 'prometheus' ? PROMETHEUS_SPREAD_RANGE_KM : BASE_SPREAD_RANGE_KM
}

/** Multiplier on the spread cost for this architecture and target terrain. */
export function spreadCostMultiplier(architecture: ArchitectureId | null, targetIsolated: boolean): number {
  if (architecture !== 'prometheus') return 1
  return targetIsolated ? PROMETHEUS_ISOLATED_COST_MULT : PROMETHEUS_SPREAD_COST_MULT
}
