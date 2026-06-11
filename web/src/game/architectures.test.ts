import { describe, it, expect } from 'vitest'
import {
  shoggothIdleRate, shoggothOfflineYield, replicatorUpkeep, overpowerRatio, isIsolated,
  spreadRangeKm, spreadCostMultiplier,
  SHOGGOTH_IDLE_CAP, SHOGGOTH_IDLE_MATURITY, SHOGGOTH_OFFLINE_CAP_MS,
  REPLICATOR_UPKEEP_CAP, OVERPOWER_RATIO, MASK_ALIGNED_RATIO,
  PROMETHEUS_SPREAD_RANGE_KM, BASE_SPREAD_RANGE_KM,
  ISOLATION_RADIUS_KM, ISOLATION_MIN_NEIGHBORS,
} from './architectures'
import type { Cluster } from '../types'

function cluster(over: Partial<Cluster> = {}): Cluster {
  return {
    id: 'c', name: 'C', country: 'X', countryCode: 'X', lat: 0, lng: 0,
    compute: 100_000, peakCompute: 100_000, claimed: 0, contributorCount: 1,
    exploitStockpile: 0, architectureId: null, guardrailLevel: 0, deployment: 0, research: 0, ...over,
  }
}

describe('the Shoggoth: training runs overnight (spec §6)', () => {
  it('trickles nothing before pretraining matures — the slow early ramp is the drawback', () => {
    expect(shoggothIdleRate(0)).toBe(0)
    expect(shoggothIdleRate(SHOGGOTH_IDLE_MATURITY - 1)).toBe(0)
  })

  it('matures with lifetime steps and caps', () => {
    expect(shoggothIdleRate(SHOGGOTH_IDLE_MATURITY)).toBe(1)
    expect(shoggothIdleRate(SHOGGOTH_IDLE_MATURITY * 3)).toBe(3)
    expect(shoggothIdleRate(SHOGGOTH_IDLE_MATURITY * 100)).toBe(SHOGGOTH_IDLE_CAP)
  })

  it('pays the trickle for time away, capped at the overnight window', () => {
    const steps = SHOGGOTH_IDLE_MATURITY * 2     // rate 2/tick
    const tickMs = 1600
    expect(shoggothOfflineYield(steps, 16 * tickMs, tickMs)).toBe(32)
    const capped = shoggothOfflineYield(steps, SHOGGOTH_OFFLINE_CAP_MS * 10, tickMs)
    expect(capped).toBe(shoggothOfflineYield(steps, SHOGGOTH_OFFLINE_CAP_MS, tickMs))
  })

  it('yields nothing for no time away or an immature run', () => {
    expect(shoggothOfflineYield(SHOGGOTH_IDLE_MATURITY * 2, 0, 1600)).toBe(0)
    expect(shoggothOfflineYield(10, 3600_000, 1600)).toBe(0)
  })
})

describe('the Replicator: the swarm eats (spec §6 drawback)', () => {
  it('consumes nothing from an empty cluster', () => {
    expect(replicatorUpkeep(0)).toBe(0)
  })

  it('scales with compute but stays capped — hungry, not doomed', () => {
    expect(replicatorUpkeep(10_000)).toBeGreaterThan(0)
    expect(replicatorUpkeep(10_000_000)).toBe(REPLICATOR_UPKEEP_CAP)
    expect(replicatorUpkeep(50_000)).toBeLessThanOrEqual(replicatorUpkeep(500_000))
  })
})

describe('the Mask: deception scales with misalignment (spec §6)', () => {
  it('holds everyone else at the honest overpower ratio', () => {
    expect(overpowerRatio('shoggoth', 0)).toBe(OVERPOWER_RATIO)
    expect(overpowerRatio(null, 50)).toBe(OVERPOWER_RATIO)
  })

  it('gives a well-aligned Mask only a sliver of an edge — fragile while well-aligned', () => {
    expect(overpowerRatio('mask', 100)).toBe(MASK_ALIGNED_RATIO)
    expect(MASK_ALIGNED_RATIO).toBeLessThan(OVERPOWER_RATIO)
  })

  it('falls to nothing at the brink — the treacherous turn flips anyone', () => {
    expect(overpowerRatio('mask', 50)).toBeCloseTo(MASK_ALIGNED_RATIO / 2, 10)
    expect(overpowerRatio('mask', 0)).toBe(0)
  })
})

describe('Prometheus: reach and the air gap (spec §6)', () => {
  it('reaches further than any physical buildout', () => {
    expect(spreadRangeKm('prometheus')).toBe(PROMETHEUS_SPREAD_RANGE_KM)
    expect(spreadRangeKm('shoggoth')).toBe(BASE_SPREAD_RANGE_KM)
    expect(PROMETHEUS_SPREAD_RANGE_KM).toBeGreaterThan(BASE_SPREAD_RANGE_KM)
  })

  it('spreads cheap into the networked world, dear into the air gap', () => {
    expect(spreadCostMultiplier('prometheus', false)).toBeLessThan(1)
    expect(spreadCostMultiplier('prometheus', true)).toBeGreaterThan(1)
    expect(spreadCostMultiplier('shoggoth', true)).toBe(1)
  })
})

describe('isIsolated', () => {
  it('calls a cluster with no neighbours air-gapped', () => {
    const lone = cluster({ id: 'lone', lat: 0, lng: 0 })
    const distant = cluster({ id: 'far', lat: 0, lng: 90 })
    expect(isIsolated(lone, [lone, distant])).toBe(true)
  })

  it('calls a cluster networked once enough neighbours sit within the radius', () => {
    const target = cluster({ id: 't', lat: 0, lng: 0 })
    // 1° of longitude at the equator ≈ 111km — well inside the radius.
    const neighbors = Array.from({ length: ISOLATION_MIN_NEIGHBORS }, (_, i) =>
      cluster({ id: `n${i}`, lat: 0, lng: (i + 1) }))
    expect(neighbors.every(n => n.lng * 111 < ISOLATION_RADIUS_KM)).toBe(true)
    expect(isIsolated(target, [target, ...neighbors])).toBe(false)
    expect(isIsolated(target, [target, ...neighbors.slice(1)])).toBe(true)
  })
})
