import { PointCloudRecognizer, Pt } from './recognizer'
import type { ExploitFamily } from '../../types'

// Each exploit family has one prompt shape. Tier sets how many strokes the tracing
// must use (spec §4: friction grows with power) — $P is stroke-count agnostic,
// so the shape still matches however the player splits it.

// Guide polylines in a unit box (0..1). Used both as $P templates and as the
// fading ghost-guide drawn for novices.
export const PROMPT_GUIDES: Record<ExploitFamily, [number, number][]> = {
  // Injection — a simple descending V (a one-line query).
  injection: [[0.1, 0.15], [0.5, 0.9], [0.9, 0.15]],
  // Release — a closed triangle (a deployed payload takes shape).
  release: [[0.5, 0.1], [0.9, 0.85], [0.1, 0.85], [0.5, 0.1]],
  // Cascade — a five-pointed star in one continuous path (a runaway cascade).
  cascade: starPath(5),
}

function starPath(points: number): [number, number][] {
  const cx = 0.5, cy = 0.5, r = 0.45
  const order: [number, number][] = []
  // Connect every 2nd vertex to trace a star.
  const step = 2
  for (let i = 0; i <= points; i++) {
    const idx = (i * step) % points
    const ang = -Math.PI / 2 + (idx / points) * Math.PI * 2
    order.push([cx + r * Math.cos(ang), cy + r * Math.sin(ang)])
  }
  return order
}

// Densify a polyline into ~40 points so $P resampling has material to work with.
function densify(poly: [number, number][], perSeg = 12): Pt[] {
  const pts: Pt[] = []
  for (let s = 0; s < poly.length - 1; s++) {
    const [x1, y1] = poly[s]
    const [x2, y2] = poly[s + 1]
    for (let k = 0; k < perSeg; k++) {
      const t = k / perSeg
      pts.push({ x: x1 + t * (x2 - x1), y: y1 + t * (y2 - y1), id: 0 })
    }
  }
  const last = poly[poly.length - 1]
  pts.push({ x: last[0], y: last[1], id: 0 })
  return pts
}

// ── Node-and-edge model (ported from goetia's seal canvas) ──────────────────
// The prompt is a graph: tap-near a node, drag to another node, and the edge
// binds (generous snap, no shape-matching). Derived from the same guide polyline
// so nodes sit exactly on the ghost guide's corners.

export interface PromptNode { x: number; y: number }      // unit coords 0..1
export interface PromptGraph { nodes: PromptNode[]; edges: [number, number][] }

export function edgeKey(a: number, b: number): string {
  return a < b ? `${a}-${b}` : `${b}-${a}`
}

function buildGraph(poly: [number, number][]): PromptGraph {
  const nodes: PromptNode[] = []
  const idOf = (x: number, y: number): number => {
    const i = nodes.findIndex(n => Math.hypot(n.x - x, n.y - y) < 1e-3)
    if (i >= 0) return i
    nodes.push({ x, y })
    return nodes.length - 1
  }
  const seen = new Set<string>()
  const edges: [number, number][] = []
  for (let i = 1; i < poly.length; i++) {
    const a = idOf(poly[i - 1][0], poly[i - 1][1])
    const b = idOf(poly[i][0], poly[i][1])
    if (a === b || seen.has(edgeKey(a, b))) continue
    seen.add(edgeKey(a, b))
    edges.push([a, b])
  }
  return { nodes, edges }
}

export const PROMPT_GRAPHS = Object.fromEntries(
  (Object.keys(PROMPT_GUIDES) as ExploitFamily[]).map(f => [f, buildGraph(PROMPT_GUIDES[f])]),
) as Record<ExploitFamily, PromptGraph>

let recognizer: PointCloudRecognizer | null = null

export function promptRecognizer(): PointCloudRecognizer {
  if (recognizer) return recognizer
  const r = new PointCloudRecognizer()
  ;(Object.keys(PROMPT_GUIDES) as ExploitFamily[]).forEach(family => {
    r.addTemplate(family, densify(PROMPT_GUIDES[family]))
  })
  recognizer = r
  return r
}

// Minimum score for a prompt to be accepted (poor match just wastes the gesture).
// Tuned forgiving: now that a trace is scored only against its own prompt, a
// recognisable-but-shaky gesture should still land the exploit.
export const PROMPT_MATCH_THRESHOLD = 0.70

export const FAMILY_PROMPT_NAME: Record<ExploitFamily, string> = {
  injection: 'the Query',
  release: 'the Payload',
  cascade: 'the Cascade',
}
