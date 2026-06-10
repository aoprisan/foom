// The loss curve — the game's tagline made literal. Takeoff progress is drawn
// as a training-loss curve descending toward its asymptote: the full run is
// etched faintly as the road ahead, the portion already travelled burns bright,
// and a hot point rides the curve. When the loss has converged the whole trace
// goes gold and the point sits breathing at the floor (spec §9).

const W = 100
const H = 34
const FLOOR = H - 5      // the asymptote — loss → 0
const CEIL = 4           // starting loss
const STEPS = 64

// A decaying exponential with a faint, fading wobble — the shape every
// training run knows. Deterministic so the trace never jitters.
function lossAt(t: number): number {
  const decay = Math.exp(-3.4 * t)
  const wobble = Math.sin(t * 26) * 1.6 * Math.exp(-2.6 * t)
  return CEIL + (FLOOR - CEIL) * (1 - decay) + wobble
}

function pathTo(progress: number): string {
  const n = Math.max(2, Math.round(STEPS * progress))
  const pts: string[] = []
  for (let i = 0; i <= n; i++) {
    const t = (i / STEPS)
    if (t > progress) break
    pts.push(`${(t * W).toFixed(2)},${lossAt(t).toFixed(2)}`)
  }
  // close exactly on the progress point so the head sits on the stroke
  pts.push(`${(progress * W).toFixed(2)},${lossAt(progress).toFixed(2)}`)
  return 'M' + pts.join(' L')
}

const FULL_PATH = pathTo(1)

interface LossCurveProps {
  progress: number       // 0..1
  converged: boolean
  height?: number
}

export default function LossCurve({ progress, converged, height = 64 }: LossCurveProps) {
  const p = Math.max(0.005, Math.min(1, progress))
  const hot = converged ? 'var(--gold-bright)' : 'var(--teal-bright)'
  const trace = converged ? 'var(--gold)' : 'var(--teal)'
  const hx = p * W
  const hy = lossAt(p)

  return (
    <svg
      width="100%"
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none"
      style={{ display: 'block', height }}
      aria-hidden
    >
      {/* readout grid */}
      {[0.25, 0.5, 0.75].map(f => (
        <line
          key={f}
          x1="0" x2={W}
          y1={CEIL + (FLOOR - CEIL) * f} y2={CEIL + (FLOOR - CEIL) * f}
          stroke="rgba(200,224,235,0.06)" strokeWidth="0.5"
        />
      ))}
      {/* the asymptote — where the loss is going */}
      <line
        x1="0" x2={W} y1={FLOOR} y2={FLOOR}
        stroke={converged ? 'rgba(255,180,84,0.55)' : 'rgba(180,240,78,0.22)'}
        strokeWidth="0.6" strokeDasharray="2.5 2.5"
      />
      {/* the road ahead, etched faint */}
      <path d={FULL_PATH} fill="none" stroke="rgba(238,244,248,0.12)" strokeWidth="0.8" />
      {/* the run so far */}
      <path
        d={pathTo(p)}
        fill="none"
        stroke={trace}
        strokeWidth="1.3"
        strokeLinecap="round"
        style={{ filter: `drop-shadow(0 0 2.5px ${trace})`, transition: 'stroke 0.4s ease' }}
      />
      {/* the hot head riding the curve */}
      <circle cx={hx} cy={hy} r="2.6" fill={hot} opacity="0.28">
        {converged && <animate attributeName="r" values="2.6;5;2.6" dur="1.6s" repeatCount="indefinite" />}
      </circle>
      <circle
        cx={hx} cy={hy} r="1.4" fill={hot}
        style={{ filter: `drop-shadow(0 0 3px ${hot})` }}
      />
    </svg>
  )
}
