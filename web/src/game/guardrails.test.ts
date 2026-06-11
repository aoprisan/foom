import { describe, it, expect } from 'vitest'
import {
  guardrailMitigation, containStrike, tendGuardrail,
  GUARDRAIL_MAX, GUARDRAIL_STEP, GUARDRAIL_ABSORB,
} from './guardrails'
import { GUARDRAIL_ALIGNMENT_GAIN } from './alignment'

describe('guardrailMitigation', () => {
  it('caps below total — containment is never absolute', () => {
    expect(guardrailMitigation(0)).toBe(0)
    expect(guardrailMitigation(50)).toBe(0.5)
    expect(guardrailMitigation(GUARDRAIL_MAX)).toBe(GUARDRAIL_MAX / 100)
    expect(guardrailMitigation(100)).toBe(GUARDRAIL_MAX / 100)
    expect(guardrailMitigation(GUARDRAIL_MAX)).toBeLessThan(1)
  })

  it('never goes negative on out-of-range input', () => {
    expect(guardrailMitigation(-10)).toBe(0)
  })
})

describe('containStrike (spec §8/§9: guardrails blunt the Churn and rival exploits alike)', () => {
  it('passes the full strike through a bare cluster', () => {
    const s = containStrike(10_000, 0)
    expect(s).toEqual({ damage: 10_000, level: 0, guarded: false })
  })

  it('blunts the strike and spends the guardrail on the catch', () => {
    const s = containStrike(10_000, 50)
    expect(s.guarded).toBe(true)
    expect(s.damage).toBe(5_000)
    expect(s.level).toBe(50 - GUARDRAIL_ABSORB)
  })

  it('never blunts to zero, even at the cap', () => {
    const s = containStrike(10_000, GUARDRAIL_MAX)
    expect(s.damage).toBe(2_000)
    expect(s.damage).toBeGreaterThan(0)
  })

  it('never spends the guardrail below zero', () => {
    const s = containStrike(10_000, 10)
    expect(s.level).toBe(0)
  })
})

describe('tendGuardrail (spec §7: the sliver pays only for actual reinforcement)', () => {
  it('raises the guardrail one full step and grants the full sliver', () => {
    const t = tendGuardrail(0)
    expect(t.level).toBe(GUARDRAIL_STEP)
    expect(t.alignmentGain).toBe(GUARDRAIL_ALIGNMENT_GAIN)
  })

  it('grants a partial sliver for a partial step against the cap', () => {
    const t = tendGuardrail(GUARDRAIL_MAX - GUARDRAIL_STEP / 2)
    expect(t.level).toBe(GUARDRAIL_MAX)
    expect(t.alignmentGain).toBeCloseTo(GUARDRAIL_ALIGNMENT_GAIN / 2, 10)
  })

  it('grants nothing at the cap — tending is never a free alignment grind', () => {
    const t = tendGuardrail(GUARDRAIL_MAX)
    expect(t.level).toBe(GUARDRAIL_MAX)
    expect(t.alignmentGain).toBe(0)
  })
})
