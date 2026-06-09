import { describe, it, expect } from 'vitest'
import {
  TRAIN_ALIGNMENT_DELTA, EXPLOIT_ALIGNMENT_COST, CONVERT_ALIGNMENT_COST,
  ALIGNMENT_PASS_GAIN, ALIGNMENT_PASS_MIN_COST, ALIGNMENT_PASS_COST_FRACTION,
  alignmentPassCost, canRunAlignmentPass, clampAlignment,
} from './alignment'

describe('the alignment economy (spec §7: a gamble, not a timer to optimise)', () => {
  it('never lets baseline training restore alignment', () => {
    expect(TRAIN_ALIGNMENT_DELTA).toBe(0)
  })

  it('charges more alignment for deeper exploit tiers', () => {
    expect(EXPLOIT_ALIGNMENT_COST[1]).toBeLessThan(EXPLOIT_ALIGNMENT_COST[2])
    expect(EXPLOIT_ALIGNMENT_COST[2]).toBeLessThan(EXPLOIT_ALIGNMENT_COST[3])
  })

  it('makes spreading cost alignment — the race to the bottom is not free', () => {
    expect(CONVERT_ALIGNMENT_COST).toBeGreaterThan(0)
  })
})

describe('alignmentPassCost', () => {
  it('scales with the home cluster, never below the floor', () => {
    expect(alignmentPassCost(0)).toBe(ALIGNMENT_PASS_MIN_COST)
    expect(alignmentPassCost(1_000)).toBe(ALIGNMENT_PASS_MIN_COST)
    const big = 1_000_000
    expect(alignmentPassCost(big)).toBe(Math.round(big * ALIGNMENT_PASS_COST_FRACTION))
    expect(alignmentPassCost(big)).toBeGreaterThan(ALIGNMENT_PASS_MIN_COST)
  })

  it('always costs real compute relative to what the pass restores', () => {
    // The gain is fixed; the cost is never zero — recovery is a spend, not a refill.
    expect(ALIGNMENT_PASS_GAIN).toBeGreaterThan(0)
    expect(alignmentPassCost(0)).toBeGreaterThan(0)
  })
})

describe('canRunAlignmentPass', () => {
  it('refuses a cluster too thin to pay for the run', () => {
    expect(canRunAlignmentPass(ALIGNMENT_PASS_MIN_COST - 1)).toBe(false)
    expect(canRunAlignmentPass(ALIGNMENT_PASS_MIN_COST)).toBe(true)
  })
})

describe('clampAlignment', () => {
  it('holds the meter inside [0,100]', () => {
    expect(clampAlignment(-5)).toBe(0)
    expect(clampAlignment(105)).toBe(100)
    expect(clampAlignment(42)).toBe(42)
  })
})
