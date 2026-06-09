import { describe, it, expect } from 'vitest'
import {
  canConvert, greatWorkScore, worldAlignment, spreadCost,
  SPREAD_RANGE_KM, GREAT_WORK_GOAL, RESEARCH_WEIGHT, DEPLOYMENT_WEIGHT,
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
    expect(r.reason).toMatch(/deployment/i)
  })

  it('refuses a cluster already sworn to your architecture', () => {
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

  it('lets The Mask turn even a strong rival (the deceptive alignment boon)', () => {
    const home = cluster({ id: 'h', compute: 100_000 })
    const strong = cluster({ id: 't', lat: 0, lng: 1, compute: 90_000, architectureId: 'prometheus' })
    expect(canConvert(home, strong, 'shoggoth').ok).toBe(false)
    expect(canConvert(home, strong, 'mask').ok).toBe(true)
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

describe('worldAlignment', () => {
  it('reports the foremost cluster and clamps progress to 1', () => {
    const clusters = [
      cluster({ id: 'a', compute: 200_000, architectureId: 'shoggoth' as ArchitectureId }),
      cluster({ id: 'b', compute: 2 * GREAT_WORK_GOAL, architectureId: 'prometheus' as ArchitectureId }),
    ]
    const v = worldAlignment(clusters)
    expect(v.leader?.id).toBe('b')
    expect(v.progress).toBe(1)
    expect(v.aligned).toBe(true)
  })

  it('is not aligned while every cluster sits below the goal', () => {
    const v = worldAlignment([cluster({ compute: GREAT_WORK_GOAL - 1 })])
    expect(v.aligned).toBe(false)
    expect(v.progress).toBeLessThan(1)
  })

  it('handles an empty world', () => {
    const v = worldAlignment([])
    expect(v.leader).toBeNull()
    expect(v.progress).toBe(0)
    expect(v.aligned).toBe(false)
  })
})
