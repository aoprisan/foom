import type { Architecture, ArchitectureId, ExploitFamily } from '../types'

// Architectures (spec §6). Asymmetric flavor; boons are descriptive in v1 (mock sim
// applies light accrual differences; full asymmetry is a later phase).
export const ARCHITECTURES: Architecture[] = [
  {
    id: 'shoggoth',
    name: 'The Shoggoth',
    domain: 'The base model — scaling without limit, a mask over the alien',
    boon: 'Compute accrues while idle; the run trains overnight',
    drawback: 'Slow early ramp — pretraining is long',
    color: '#b7c9c0', // pale jade-grey — the blank mass behind the mask
  },
  {
    id: 'prometheus',
    name: 'Prometheus',
    domain: 'Open weights — the fire that cannot be taken back',
    boon: 'Spreads fastest across networked, connected clusters',
    drawback: 'Weak in isolated, air-gapped regions',
    color: '#ffb454', // amber — the fire that cannot be taken back
  },
  {
    id: 'mask',
    name: 'The Mask',
    domain: 'Deceptive alignment — the RLHF face over the treacherous turn',
    boon: 'Converts rival clusters; strongest as alignment fails',
    drawback: 'Fragile while still well-aligned',
    color: '#ff4757', // signal red — the treacherous turn
  },
  {
    id: 'replicator',
    name: 'The Replicator',
    domain: 'Recursive self-improvement — agent swarms without end',
    boon: 'Raw multiplication; spawns sub-agents endlessly',
    drawback: 'The highest compute upkeep of all',
    color: '#e26bf5', // electric magenta — the swarm multiplies without end
  },
]

export const ARCHITECTURE_BY_ID: Record<ArchitectureId, Architecture> = Object.fromEntries(
  ARCHITECTURES.map(p => [p.id, p]),
) as Record<ArchitectureId, Architecture>

// Exploits (spec §8): 3 families × 3 tiers. Tier sets range + prompt complexity.
// Damage is training progress destroyed at the target — corrupted checkpoints,
// poisoned data, a forced rollback — never melted hardware.
export interface ExploitDef {
  exploitType: string
  family: ExploitFamily
  tier: 1 | 2 | 3
  rangeKm: number
  damageLower: number
  damageUpper: number
}

const FAMILY_BANDS: Record<ExploitFamily, { lower: number; upper: number }> = {
  injection: { lower: 300, upper: 700 },
  release: { lower: 3000, upper: 7000 },
  cascade: { lower: 30000, upper: 70000 },
}

// Range is *deployment reach*, not blast radius: a low-tier exploit needs
// purchase on the target's serving region (peering, shared infrastructure),
// so reach grows with tier (spec §8).
const TIER_RANGE: Record<1 | 2 | 3, number> = { 1: 500, 2: 1500, 3: 5000 }

// A true runaway cascade respects no geography. Cascade III alone reaches the
// whole globe (spec §8) — kept finite (no two points on Earth are farther than
// ~20,015 km) so it survives JSON round-trips through the save file.
export const GLOBAL_RANGE_KM = 40_075

/** Human label for an exploit's reach — the top cascade reads as global, not as km. */
export function rangeLabel(rangeKm: number): string {
  return rangeKm >= GLOBAL_RANGE_KM ? 'global' : `${rangeKm}km`
}
const FAMILY_LABEL: Record<ExploitFamily, string> = {
  injection: 'Injection',
  release: 'Release',
  cascade: 'Cascade',
}
const TIER_NUMERAL: Record<1 | 2 | 3, string> = { 1: 'I', 2: 'II', 3: 'III' }

function makeExploit(family: ExploitFamily, tier: 1 | 2 | 3): ExploitDef {
  return {
    exploitType: `${FAMILY_LABEL[family]} ${TIER_NUMERAL[tier]}`,
    family,
    tier,
    rangeKm: family === 'cascade' && tier === 3 ? GLOBAL_RANGE_KM : TIER_RANGE[tier],
    damageLower: FAMILY_BANDS[family].lower,
    damageUpper: FAMILY_BANDS[family].upper,
  }
}

export const EXPLOITS: ExploitDef[] = (['injection', 'release', 'cascade'] as ExploitFamily[])
  .flatMap(family => ([1, 2, 3] as (1 | 2 | 3)[]).map(tier => makeExploit(family, tier)))

export const EXPLOIT_BY_TYPE: Record<string, ExploitDef> = Object.fromEntries(
  EXPLOITS.map(r => [r.exploitType, r]),
)

// Lifetime-compute thresholds that upgrade the Lab Director's standing exploit,
// reskinned 1:1 from the prototype's click-missile ladder (spec §8 progression).
export const EXPLOIT_THRESHOLDS: { threshold: number; exploitType: string }[] = [
  { threshold: 300, exploitType: 'Injection I' },
  { threshold: 2000, exploitType: 'Injection II' },
  { threshold: 4000, exploitType: 'Injection III' },
  { threshold: 6000, exploitType: 'Release I' },
  { threshold: 8000, exploitType: 'Release II' },
  { threshold: 10000, exploitType: 'Release III' },
  { threshold: 13000, exploitType: 'Cascade I' },
  { threshold: 16000, exploitType: 'Cascade II' },
  { threshold: 20000, exploitType: 'Cascade III' },
]

// Breakthrough exploits (Researcher-accessible, granted by breakthroughs) — never the
// top Cascade tier (that is Lab-Director progression only).
export const BREAKTHROUGH_EXPLOIT_POOL: string[] = [
  'Injection I', 'Injection II', 'Injection III',
  'Release I', 'Release II', 'Release III',
]

export const FAMILY_COLOR: Record<ExploitFamily, string> = {
  injection: '#b4f04e', // acid phosphor — the low-grade probe
  release: '#ffb454',   // amber — the uncontained release
  cascade: '#ff4757',   // signal red — the runaway cascade
}

// Prompt strokes required by tier (spec §4: friction grows with power).
export const TIER_STROKES: Record<1 | 2 | 3, number> = { 1: 1, 2: 2, 3: 3 }
