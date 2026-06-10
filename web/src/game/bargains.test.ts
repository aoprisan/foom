import { describe, it, expect } from 'vitest'
import { rollBargain, perTickSpringChance } from './bargains'

// A deterministic RNG so the gamble's structure can be asserted exactly.
function seq(values: number[]): () => number {
  let i = 0
  return () => values[i++ % values.length]
}

describe('rollBargain', () => {
  it('always produces an offer across the whole alignment range', () => {
    for (let s = 0; s <= 100; s += 5) {
      expect(rollBargain(s, `id-${s}`, () => 0.5)).not.toBeNull()
    }
  })

  it('sets exactly the carried id and a single grant kind', () => {
    const b = rollBargain(80, 'fixed-id', seq([0, 0.5]))!
    expect(b.id).toBe('fixed-id')
    const grants = [b.grantExploitType, b.grantCompute, b.grantAlignment].filter(g => g !== undefined)
    expect(grants).toHaveLength(1)
  })

  it('never tempts an aligned lab with the deep-only templates (pass, forbidden)', () => {
    // At full alignment only capability/surge are eligible — pick() lands on each via rng.
    for (const r of [0, 0.49, 0.99]) {
      const b = rollBargain(100, 'x', () => r)!
      expect(['capability', 'surge']).toContain(b.kind)
    }
  })

  it('makes the gamble sharper as alignment falls: deeper offers carry a higher catch chance', () => {
    // Same template (capability = first eligible, rng→0 picks it) at high vs low alignment.
    const aligned = rollBargain(95, 'a', seq([0, 0, 0, 0]))!
    const fraying = rollBargain(20, 'b', seq([0, 0, 0, 0]))!
    expect(aligned.kind).toBe('capability')
    expect(fraying.kind).toBe('capability')
    expect(fraying.catch.chance).toBeGreaterThan(aligned.catch.chance)
  })

  it('hides the catch as numbers the UI never receives in the visible fields', () => {
    const b = rollBargain(30, 'c', seq([0.5, 0.5]))!
    // The catch carries a chance in (0,1) — the hidden half of the trade.
    expect(b.catch.chance).toBeGreaterThan(0)
    expect(b.catch.chance).toBeLessThan(1)
  })
})

describe('perTickSpringChance', () => {
  it('compounds over the window to the overall chance', () => {
    const window = 8
    const chance = 0.45
    const perTick = perTickSpringChance(chance, window)
    // P(never springs) = (1 - perTick)^window = 1 - chance
    const cumulative = 1 - Math.pow(1 - perTick, window)
    expect(cumulative).toBeCloseTo(chance, 10)
  })

  it('degrades to the raw chance for a zero/negative window', () => {
    expect(perTickSpringChance(0.3, 0)).toBe(0.3)
  })
})
