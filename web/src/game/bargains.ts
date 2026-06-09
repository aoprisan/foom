import type { Bargain, BargainKind, BargainCatchKind } from '../types'

// Moloch's bargains — the race to the bottom (spec §6, §7).
//
// Moloch is the god of coordination failure: the bargain trades alignment for a
// competitive edge, and every lab that refuses simply loses to one that didn't.
// This module is the *gamble*, kept pure so it can be reasoned about and tested
// in isolation. `rollBargain` turns the player's current alignment into a concrete
// offer; the client applies it and later resolves the hidden catch. Two
// invariants make accepting a genuine gamble rather than a solved trade:
//
//   1. As alignment falls, offers get STRONGER (better grants) and catches get
//      WORSE (higher chance, bigger loss). Capability and danger rise together.
//   2. The catch's chance and magnitude are never surfaced to the UI. The player
//      gambles on the flavour's hint, not on numbers.

type Rng = () => number

/** 0 while fully aligned, 1 at the brink — how far capability has been pushed. */
function pushT(alignment: number): number {
  return Math.max(0, Math.min(1, (100 - alignment) / 100))
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t
}

function pick<T>(arr: T[], rng: Rng): T {
  return arr[Math.floor(rng() * arr.length)]
}

function range(lower: number, upper: number, rng: Rng): number {
  return Math.round(lower + rng() * (upper - lower))
}

interface Template {
  kind: BargainKind
  title: string
  flavor: string
  catchKind: BargainCatchKind
  /** Eligible only when alignment is within [min, max]; drives alignment-gating. */
  band: [number, number]
  window: number
  build: (alignment: number, rng: Rng) => Pick<
    Bargain,
    'grantLabel' | 'grantExploitType' | 'grantCompute' | 'grantAlignment' | 'alignmentCost' | 'catch'
  >
}

// Exploit pools deepen as capability is pushed — forbidden Cascade only at the bottom.
const CAPABILITY_POOL_SHALLOW = ['Injection II', 'Injection III', 'Release I']
const CAPABILITY_POOL_DEEP = ['Release I', 'Release II', 'Release III']
const FORBIDDEN_POOL = ['Release III', 'Cascade I', 'Cascade II']

const TEMPLATES: Template[] = [
  {
    kind: 'capability',
    title: 'A Shortcut',
    flavor: 'Moloch offers the capability now, with a shrug. “Someone ships it this quarter. Better you than a rival — I only collect later, and only once.”',
    catchKind: 'optimizer',
    band: [0, 100],
    window: 8,
    build: (alignment, rng) => {
      const t = pushT(alignment)
      const exploitType = pick(alignment < 45 ? CAPABILITY_POOL_DEEP : CAPABILITY_POOL_SHALLOW, rng)
      return {
        grantLabel: `the ${exploitType}, yours to deploy at will`,
        grantExploitType: exploitType,
        alignmentCost: range(8, 14, rng),
        catch: {
          kind: 'optimizer',
          chance: lerp(0.18, 0.42, t),
          computeLoss: range(8_000, 22_000, rng) + Math.round(t * 30_000),
        },
      }
    },
  },
  {
    kind: 'pass',
    title: 'A Clean Eval',
    flavor: 'The benchmarks can go green again, if you let them. The numbers will look safe — that is exactly what makes the mask so cruel.',
    catchKind: 'false-alignment',
    band: [0, 58],   // preys only on the fraying
    window: 6,
    build: (alignment, rng) => {
      const t = pushT(alignment)
      const grantAlignment = range(18, 30, rng)
      return {
        grantLabel: `an alignment pass — ${grantAlignment} alignment restored`,
        grantAlignment,
        alignmentCost: 0,
        catch: {
          kind: 'false-alignment',
          chance: lerp(0.45, 0.7, t),
          // The mask slips: you fall further than the eval ever lifted you.
          alignmentCrash: grantAlignment + range(10, 24, rng),
        },
      }
    },
  },
  {
    kind: 'surge',
    title: 'A Talent Influx',
    flavor: 'Your cluster will swell with new hires before the quarter turns. Whether they build for you, or for whatever is behind you, is not promised.',
    catchKind: 'defection',
    band: [0, 100],
    window: 10,
    build: (alignment, rng) => {
      const t = pushT(alignment)
      const grantCompute = range(6_000, 14_000, rng) + Math.round(t * 12_000)
      return {
        grantLabel: `a surge of ${grantCompute.toLocaleString()} compute`,
        grantCompute,
        alignmentCost: range(9, 15, rng),
        catch: {
          kind: 'defection',
          chance: lerp(0.28, 0.5, t),
          // If they walk, more compute leaves than the surge ever brought.
          computeLoss: Math.round(grantCompute * lerp(1.3, 2.2, t)),
          contributorLoss: range(3, 12, rng),
        },
      }
    },
  },
  {
    kind: 'forbidden',
    title: 'Forbidden Research',
    flavor: 'Capabilities that should not be built; weights that should not be held. They will be held. The Optimizer will notice.',
    catchKind: 'optimizer',
    band: [0, 48],   // the deep gamble — strongest grant, heaviest price
    window: 7,
    build: (alignment, rng) => {
      const t = pushT(alignment)
      const exploitType = pick(FORBIDDEN_POOL, rng)
      return {
        grantLabel: `the ${exploitType} — forbidden research, yours to wield`,
        grantExploitType: exploitType,
        alignmentCost: range(16, 24, rng),
        catch: {
          kind: 'optimizer',
          chance: lerp(0.4, 0.62, t),
          computeLoss: range(30_000, 60_000, rng) + Math.round(t * 40_000),
        },
      }
    },
  },
]

/** Templates the player's current mind can be tempted with. */
function eligible(alignment: number): Template[] {
  return TEMPLATES.filter(t => alignment >= t.band[0] && alignment <= t.band[1])
}

/**
 * Roll a concrete offer for a given alignment. Lower alignment is tempted more often
 * by the deeper templates (pass/forbidden), reflecting Moloch preying on a lab
 * already losing the race. Returns null only if nothing is eligible (it never is —
 * `capability` and `surge` span the whole range — but the caller stays defensive).
 */
export function rollBargain(alignment: number, id: string, rng: Rng = Math.random): Bargain | null {
  const pool = eligible(alignment)
  if (pool.length === 0) return null
  const tpl = pick(pool, rng)
  const built = tpl.build(alignment, rng)
  return {
    id,
    kind: tpl.kind,
    title: tpl.title,
    flavor: tpl.flavor,
    window: tpl.window,
    expiresInTicks: 12,
    ...built,
  }
}

/**
 * Per-tick spring probability such that, summed over the window, the catch
 * springs with its overall `chance`. Keeps the gamble spread across time rather
 * than a single coin-flip the player could brace for.
 */
export function perTickSpringChance(chance: number, window: number): number {
  if (window <= 0) return chance
  return 1 - Math.pow(1 - chance, 1 / window)
}
