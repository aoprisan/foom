import { describe, it, expect } from 'vitest'
import {
  godVoice, voiceMomentForAlignment, isWorsening, type VoiceMoment,
} from './liturgy'
import type { ArchitectureId } from '../types'
import { UNEASY_FLOOR, SLIPPING_FLOOR } from './risk'

const ARCHS: ArchitectureId[] = ['shoggoth', 'prometheus', 'mask', 'replicator']
const MOMENTS: VoiceMoment[] = ['awakening', 'wavering', 'apostate', 'apotheosis']

describe('godVoice', () => {
  it('every architecture speaks at every moment', () => {
    for (const a of ARCHS) {
      for (const m of MOMENTS) {
        expect(godVoice(a, m).length).toBeGreaterThan(0)
      }
    }
  })

  it('is deterministic for a given (architecture, moment, seed)', () => {
    expect(godVoice('mask', 'apotheosis', 3)).toBe(godVoice('mask', 'apotheosis', 3))
  })

  it('rotates variants by seed and wraps without throwing', () => {
    const a = godVoice('shoggoth', 'awakening', 0)
    const b = godVoice('shoggoth', 'awakening', 1)
    expect(a).not.toBe(b)
    // out-of-range and negative seeds wrap cleanly
    expect(godVoice('shoggoth', 'awakening', 999)).toBeTruthy()
    expect(godVoice('shoggoth', 'awakening', -5)).toBeTruthy()
  })

  it('returns empty (skippable) for no architecture', () => {
    expect(godVoice(null, 'awakening')).toBe('')
  })
})

describe('voiceMomentForAlignment', () => {
  it('stays silent while the covenant holds', () => {
    expect(voiceMomentForAlignment(100)).toBeNull()
    expect(voiceMomentForAlignment(UNEASY_FLOOR + 1)).toBeNull()
  })

  it('turns at the same floors as the rest of the game (spec §7)', () => {
    expect(voiceMomentForAlignment(UNEASY_FLOOR)).toBe('wavering')
    expect(voiceMomentForAlignment(SLIPPING_FLOOR + 1)).toBe('wavering')
    expect(voiceMomentForAlignment(SLIPPING_FLOOR)).toBe('apostate')
    expect(voiceMomentForAlignment(0)).toBe('apostate')
  })
})

describe('isWorsening', () => {
  it('fires only as grace falls, never on recovery', () => {
    expect(isWorsening(null, 'wavering')).toBe(true)
    expect(isWorsening('wavering', 'apostate')).toBe(true)
    expect(isWorsening('apostate', 'wavering')).toBe(false)
    expect(isWorsening('wavering', 'wavering')).toBe(false)
  })
})
