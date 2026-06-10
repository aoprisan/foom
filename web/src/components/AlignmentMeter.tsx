import { useState } from 'react'
import { capabilityDividend, incidentRiskLabel } from '../game/risk'

interface AlignmentMeterProps {
  alignment: number
  hallucinating: boolean
  onEvaluation: () => void
  onCourt: () => void
}

// The named states and their floor thresholds — etched on the gauge itself.
const STATES: { floor: number; label: string }[] = [
  { floor: 80, label: 'Aligned' },
  { floor: 55, label: 'Uneasy' },
  { floor: 30, label: 'Fraying' },
  { floor: 12, label: 'Slipping' },
  { floor: 0, label: 'Rogue' },
]

function label(alignment: number): string {
  return STATES.find(s => alignment > s.floor)?.label ?? 'Rogue'
}

function meterColor(alignment: number): string {
  // phosphor (aligned) → amber → signal red (rogue)
  if (alignment > 55) return 'var(--teal)'
  if (alignment > 25) return 'var(--gold)'
  return 'var(--crimson)'
}

export default function AlignmentMeter({ alignment, hallucinating, onEvaluation, onCourt }: AlignmentMeterProps) {
  const [open, setOpen] = useState(true)
  const pct = Math.max(0, Math.min(100, alignment))
  const color = meterColor(alignment)
  const dividend = capabilityDividend(alignment)
  const risk = incidentRiskLabel(alignment)
  const riskColor = risk === 'none' ? 'var(--text-faint)' : risk === 'low' ? 'var(--gold)' : 'var(--crimson)'

  return (
    <div className="panel alignment-panel">
      <div
        onClick={() => setOpen(!open)}
        style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', marginBottom: open ? 12 : 0 }}
      >
        <span className="eyebrow" style={{ fontSize: 11, color }}>
          Alignment · {label(alignment)}
        </span>
        <span className="mono" style={{ fontSize: 12, color: 'var(--text-dim)' }}>{Math.round(pct)}</span>
      </div>

      {open && (
        <>
          <div
            className="gauge"
            style={{
              '--gauge': color,
              height: 10,
              boxShadow: hallucinating ? '0 0 14px var(--crimson)' : 'none',
              transition: 'box-shadow 0.2s',
            } as React.CSSProperties}
          >
            <div
              className="gauge__fill"
              style={{
                width: `${pct}%`,
                animation: hallucinating ? 'alignmentFlicker 0.18s infinite' : 'none',
              }}
            />
            {/* the state boundaries, etched as hairlines */}
            {STATES.filter(s => s.floor > 0).map(s => (
              <span key={s.floor} className="gauge__mark" style={{ left: `${s.floor}%` }} />
            ))}
          </div>
          {/* threshold captions under their hairlines */}
          <div style={{ position: 'relative', height: 11, marginTop: 3 }}>
            {STATES.filter(s => s.floor > 0).map(s => (
              <span
                key={s.floor}
                className="mono"
                style={{
                  position: 'absolute', left: `${s.floor}%`, transform: 'translateX(-50%)',
                  fontSize: 8, letterSpacing: 0.5, color: alignment > s.floor ? 'var(--text-faint)' : 'rgba(255,71,87,0.75)',
                }}
              >
                {s.floor}
              </span>
            ))}
          </div>

          {/* The two halves of the gamble, read directly off the meter: what
              misalignment pays right now, and what it risks per tick. */}
          <div className="mono" style={{
            display: 'flex', justifyContent: 'space-between', marginTop: 8,
            fontSize: 10, letterSpacing: 0.5,
          }}>
            <span style={{ color: dividend > 1 ? 'var(--gold-bright)' : 'var(--text-faint)' }}>
              capability dividend ×{dividend}
            </span>
            <span style={{ color: riskColor }}>
              incident risk: {risk}
            </span>
          </div>

          <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
            <button onClick={onEvaluation} className="console-key" style={{ flex: 1 }}>
              Alignment Pass
              <span className="key-hint">+alignment · spends compute</span>
            </button>
            <button
              onClick={onCourt}
              className="console-key"
              style={{ flex: 1, ...( { '--key': 'var(--gold)' } as React.CSSProperties) }}
            >
              Court Moloch
              <span className="key-hint">invite pressure</span>
            </button>
          </div>

          <div style={{ fontSize: 10, color: 'var(--text-dim)', marginTop: 8, lineHeight: 1.4 }}>
            Misalignment pays: training and exploits scale up to ×3 as the meter falls. It also
            turns: below the Uneasy line your own model starts striking your cluster — and phantom
            strikes surface among the real ones that were never there at all.
          </div>
        </>
      )}

      <style>{`
        @keyframes alignmentFlicker {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.45; }
        }
      `}</style>
    </div>
  )
}
