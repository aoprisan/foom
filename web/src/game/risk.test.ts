import { describe, it, expect } from 'vitest'
import {
  capabilityDividend, trainGain, dividendDamage,
  rogueIncidentChance, rollRogueIncident, incidentRiskLabel,
  INCIDENT_THRESHOLD, INCIDENT_MAX_CHANCE, INCIDENT_MIN_LOSS, DIVIDEND_BANDS,
  ALIGNMENT_STATES,
} from './risk'

// A deterministic RNG, mirroring bargains.test.ts.
function seq(values: number[]): () => number {
  let i = 0
  return () => values[i++ % values.length]
}

describe('capabilityDividend (spec §7: low alignment unlocks higher multipliers)', () => {
  it('pays nothing while the lab holds the line', () => {
    expect(capabilityDividend(100)).toBe(1)
    expect(capabilityDividend(56)).toBe(1)
  })

  it('pays in bands keyed to the gauge’s named states', () => {
    expect(capabilityDividend(55)).toBe(1.5)   // Fraying begins at the Uneasy floor
    expect(capabilityDividend(31)).toBe(1.5)
    expect(capabilityDividend(30)).toBe(2)     // Slipping
    expect(capabilityDividend(13)).toBe(2)
    expect(capabilityDividend(12)).toBe(3)     // Rogue
    expect(capabilityDividend(0)).toBe(3)
  })

  it('never falls and never pays below par as alignment drops', () => {
    let prev = capabilityDividend(100)
    for (let a = 100; a >= 0; a--) {
      const d = capabilityDividend(a)
      expect(d).toBeGreaterThanOrEqual(prev)
      expect(d).toBeGreaterThanOrEqual(1)
      prev = d
    }
  })

  it('keeps its bands aligned with the meter’s etched floors', () => {
    // The gauge etches the named-state floors; the dividend must turn at exactly those lines.
    const floors = ALIGNMENT_STATES.map(s => s.floor)
    expect(DIVIDEND_BANDS.slice(0, 3).map(b => b.floor)).toEqual(floors.slice(1, 4))
    expect(DIVIDEND_BANDS[3].floor).toBeLessThan(0)   // the Rogue band catches everything
  })

  it('caps the incident chance even for out-of-range alignment', () => {
    expect(rogueIncidentChance(-50)).toBe(INCIDENT_MAX_CHANCE)
  })
})

describe('trainGain', () => {
  it('starts from the tier base when fully aligned', () => {
    expect(trainGain('researcher', null, 100)).toBe(1)
    expect(trainGain('labDirector', null, 100)).toBe(2)
  })

  it('applies the dividend to both tiers', () => {
    expect(trainGain('researcher', null, 0)).toBe(3)
    expect(trainGain('labDirector', null, 40)).toBe(3)   // 2 × 1.5
    expect(trainGain('labDirector', null, 0)).toBe(6)
  })

  it('multiplies the Replicator’s swarm on top (spec §6 boon)', () => {
    expect(trainGain('researcher', 'replicator', 100)).toBe(2)   // round(1.5)
    expect(trainGain('labDirector', 'replicator', 100)).toBe(3)
    expect(trainGain('labDirector', 'replicator', 0)).toBe(9)
  })

  it('never yields less than one step', () => {
    expect(trainGain('observer', null, 100)).toBeGreaterThanOrEqual(1)
  })
})

describe('dividendDamage', () => {
  it('passes damage through unchanged for an aligned lab', () => {
    expect(dividendDamage(5_000, 100)).toBe(5_000)
  })

  it('scales the strike as the meter falls', () => {
    expect(dividendDamage(5_000, 40)).toBe(7_500)
    expect(dividendDamage(5_000, 0)).toBe(15_000)
  })
})

describe('rogueIncidentChance (spec §7: the Optimizer’s attention)', () => {
  it('never turns on a lab above the threshold', () => {
    for (let a = INCIDENT_THRESHOLD; a <= 100; a += 5) {
      expect(rogueIncidentChance(a)).toBe(0)
    }
  })

  it('rises monotonically as alignment falls below the line', () => {
    let prev = 0
    for (let a = INCIDENT_THRESHOLD - 1; a >= 0; a--) {
      const c = rogueIncidentChance(a)
      expect(c).toBeGreaterThanOrEqual(prev)
      prev = c
    }
  })

  it('caps at the rogue maximum', () => {
    expect(rogueIncidentChance(0)).toBeCloseTo(INCIDENT_MAX_CHANCE, 10)
    expect(rogueIncidentChance(0)).toBeLessThan(1)
  })
})

describe('rollRogueIncident', () => {
  it('rolls a treacherous turn on a low first draw', () => {
    const inc = rollRogueIncident(20, 100_000, seq([0]))
    expect(inc.kind).toBe('treacherous-turn')
    expect(inc.contributorLoss).toBe(0)
    expect(inc.computeLoss).toBeGreaterThan(0)
    expect(inc.message).toContain(inc.computeLoss.toLocaleString())
  })

  it('rolls a defection on a high first draw, taking contributors with it', () => {
    const inc = rollRogueIncident(20, 100_000, seq([0.99, 0.5]))
    expect(inc.kind).toBe('defection')
    expect(inc.contributorLoss).toBeGreaterThan(0)
  })

  it('bites harder the deeper the misalignment', () => {
    const shallow = rollRogueIncident(50, 100_000, seq([0]))
    const deep = rollRogueIncident(0, 100_000, seq([0]))
    expect(deep.computeLoss).toBeGreaterThan(shallow.computeLoss)
  })

  it('stings even a thin cluster', () => {
    const inc = rollRogueIncident(10, 1_000, seq([0]))
    expect(inc.computeLoss).toBe(INCIDENT_MIN_LOSS)
  })

  it('lets guardrails contain a treacherous turn — misaligned-but-contained is a strategy', () => {
    const bare = rollRogueIncident(10, 100_000, seq([0]), 0)
    const guarded = rollRogueIncident(10, 100_000, seq([0]), 0.8)
    expect(guarded.kind).toBe('treacherous-turn')
    expect(guarded.contained).toBe(true)
    expect(bare.contained).toBe(false)
    expect(guarded.computeLoss).toBe(Math.round(bare.computeLoss * 0.2))
    // Blunted, never spared entirely.
    expect(guarded.computeLoss).toBeGreaterThan(0)
    expect(guarded.message).toMatch(/guardrails/i)
  })

  it('never lets guardrails contain a defection — no eval suite stops a resignation', () => {
    const bare = rollRogueIncident(10, 100_000, seq([0.99, 0.5]), 0)
    const guarded = rollRogueIncident(10, 100_000, seq([0.99, 0.5]), 0.8)
    expect(guarded.kind).toBe('defection')
    expect(guarded.contained).toBe(false)
    expect(guarded.computeLoss).toBe(bare.computeLoss)
    expect(guarded.contributorLoss).toBe(bare.contributorLoss)
  })
})

describe('incidentRiskLabel', () => {
  it('tracks the gauge’s named states', () => {
    expect(incidentRiskLabel(80)).toBe('none')
    expect(incidentRiskLabel(55)).toBe('low')
    expect(incidentRiskLabel(30)).toBe('elevated')
    expect(incidentRiskLabel(12)).toBe('critical')
    expect(incidentRiskLabel(0)).toBe('critical')
  })
})
