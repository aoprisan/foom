import { describe, it, expect } from 'vitest'
import {
  canConvert, greatWorkScore, worldConvergence, spreadCost, churnIntensity,
  SPREAD_RANGE_KM, GREAT_WORK_GOAL, RESEARCH_WEIGHT, DEPLOYMENT_WEIGHT,
  CHURN_BASE_CHANCE, CHURN_CONVERGED_CHANCE, CHURN_CONVERGED_DAMAGE_MULT,
} from './takeoff'
import type { Cluster, ArchitectureId } from '../types'

function cluster(over: Partial<Cluster> = {}): Cluster {
  return {
    id: 'c', name: 'C', country: 'X', countryCode: 'X', lat: 0, lng: 0,
    compute: 100_000, peakCompute: 100_000, claimed: 0, contributorCount: 1,
    exploitStockpile: 0, architectureId: null, guardrailLevel: 0, deployment: 0, research: 0, ...over,
  }
}

describe('canConvert', () => {
  it('takes the uncommitted within range', () => {
    const home = cluster({ id: 'h', lat: 0, lng: 0, compute: 100_000 })
    const target = cluster({ id: 't', lat: 0, lng: 1, architectureId: null })
    expect(canConvert(home, target, 'shoggoth').ok).toBe(true)
  })

  it('refuses a target out of range', () => {
    const home = cluster({ id: 'h', lat: 0, lng: 0 })
    const target = cluster({ id: 't', lat: 0, lng: 90, architectureId: null })   // ~10,000km away
    const r = canConvert(home, target, 'shoggoth')
    expect(r.ok).toBe(false)
    expect(r.reason).toMatch(/buildout/i)
  })

  it('refuses a cluster already running your architecture', () => {
    const home = cluster({ id: 'h', architectureId: 'prometheus' })
    const target = cluster({ id: 't', lat: 0, lng: 1, architectureId: 'prometheus' })
    expect(canConvert(home, target, 'prometheus').ok).toBe(false)
  })

  it('only flips a strong rival when you overpower it', () => {
    const home = cluster({ id: 'h', compute: 100_000 })
    const strong = cluster({ id: 't', lat: 0, lng: 1, compute: 90_000, architectureId: 'prometheus' })
    const weak = cluster({ id: 't', lat: 0, lng: 1, compute: 40_000, architectureId: 'prometheus' })
    expect(canConvert(home, strong, 'shoggoth').ok).toBe(false)   // 100k < 90k * 1.5
    expect(canConvert(home, weak, 'shoggoth').ok).toBe(true)      // 100k > 40k * 1.5
  })

  it('lets The Mask turn a strong rival only as its alignment fails (spec §6: fragile while well-aligned)', () => {
    const home = cluster({ id: 'h', compute: 100_000 })
    const strong = cluster({ id: 't', lat: 0, lng: 1, compute: 90_000, architectureId: 'prometheus' })
    // Honest force cannot flip it at any alignment.
    expect(canConvert(home, strong, 'shoggoth', { alignment: 0 }).ok).toBe(false)
    // A well-aligned Mask has nothing to hide behind (needs 1.2× = 108k)…
    expect(canConvert(home, strong, 'mask', { alignment: 100 }).ok).toBe(false)
    // …but as alignment fails the deception finds purchase (at 40: needs 0.48× = 43.2k).
    expect(canConvert(home, strong, 'mask', { alignment: 40 }).ok).toBe(true)
    // At the brink, the treacherous turn flips anyone.
    expect(canConvert(home, strong, 'mask', { alignment: 0 }).ok).toBe(true)
  })

  it('extends Prometheus’ reach beyond the baseline buildout (spec §6: the fire spreads)', () => {
    const home = cluster({ id: 'h', lat: 0, lng: 0 })
    const far = cluster({ id: 't', lat: 0, lng: 30, architectureId: null })   // ~3,340km away
    expect(canConvert(home, far, 'shoggoth').ok).toBe(false)                  // beyond 2,500km
    expect(canConvert(home, far, 'prometheus').ok).toBe(true)                 // within 4,000km
  })

  it('charges Prometheus dearly into air-gapped regions (spec §6 drawback)', () => {
    const home = cluster({ id: 'h', compute: 100_000 })
    const target = cluster({ id: 't', lat: 0, lng: 1, architectureId: null })
    const networked = canConvert(home, target, 'prometheus', { targetIsolated: false })
    const isolated = canConvert(home, target, 'prometheus', { targetIsolated: true })
    expect(networked.ok).toBe(true)
    expect(isolated.ok).toBe(true)
    expect(isolated.cost!).toBeGreaterThan(networked.cost! * 2)
    // Other architectures pay the same either way.
    expect(canConvert(home, target, 'shoggoth', { targetIsolated: true }).cost)
      .toBe(canConvert(home, target, 'shoggoth', { targetIsolated: false }).cost)
  })

  it('refuses when compute is too thin to seed a cluster', () => {
    const home = cluster({ id: 'h', compute: 200 })   // below the minimum spread cost + buffer
    const target = cluster({ id: 't', lat: 0, lng: 1, architectureId: null })
    expect(canConvert(home, target, 'shoggoth').ok).toBe(false)
  })

  it('reports a cost that scales with the home cluster', () => {
    expect(spreadCost(cluster({ compute: 1_000_000 }))).toBeGreaterThan(spreadCost(cluster({ compute: 10_000 })))
  })
})

describe('greatWorkScore', () => {
  it('weights deployment and research above raw compute', () => {
    const base = cluster({ compute: 100_000, deployment: 0, research: 0 })
    expect(greatWorkScore(base)).toBe(100_000)
    expect(greatWorkScore(cluster({ compute: 100_000, deployment: 1 }))).toBe(100_000 + DEPLOYMENT_WEIGHT)
    expect(greatWorkScore(cluster({ compute: 100_000, research: 1 }))).toBe(100_000 + RESEARCH_WEIGHT)
  })
})

describe('worldConvergence', () => {
  it('reports the foremost cluster and clamps progress to 1', () => {
    const clusters = [
      cluster({ id: 'a', compute: 200_000, architectureId: 'shoggoth' as ArchitectureId }),
      cluster({ id: 'b', compute: 2 * GREAT_WORK_GOAL, architectureId: 'prometheus' as ArchitectureId }),
    ]
    const v = worldConvergence(clusters)
    expect(v.leader?.id).toBe('b')
    expect(v.progress).toBe(1)
    expect(v.converged).toBe(true)
  })

  it('has not converged while every cluster sits below the goal', () => {
    const v = worldConvergence([cluster({ compute: GREAT_WORK_GOAL - 1 })])
    expect(v.converged).toBe(false)
    expect(v.progress).toBeLessThan(1)
  })

  it('handles an empty world', () => {
    const v = worldConvergence([])
    expect(v.leader).toBeNull()
    expect(v.progress).toBe(0)
    expect(v.converged).toBe(false)
  })
})

describe('churnIntensity (spec §9: the Churn quickens as the loss converges)', () => {
  it('runs at the base rate over an unconverged world', () => {
    expect(churnIntensity(0)).toEqual({ chance: CHURN_BASE_CHANCE, damageMult: 1 })
  })

  it('peaks once the loss has converged', () => {
    expect(churnIntensity(1)).toEqual({
      chance: CHURN_CONVERGED_CHANCE, damageMult: CHURN_CONVERGED_DAMAGE_MULT,
    })
  })

  it('rises monotonically with convergence', () => {
    let prev = churnIntensity(0)
    for (let p = 0; p <= 1; p += 0.05) {
      const i = churnIntensity(p)
      expect(i.chance).toBeGreaterThanOrEqual(prev.chance)
      expect(i.damageMult).toBeGreaterThanOrEqual(prev.damageMult)
      prev = i
    }
  })

  it('clamps out-of-range progress', () => {
    expect(churnIntensity(-1)).toEqual(churnIntensity(0))
    expect(churnIntensity(2)).toEqual(churnIntensity(1))
  })
})
