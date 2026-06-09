import { useState } from 'react'

interface AlignmentMeterProps {
  alignment: number
  hallucinating: boolean
  onEvaluation: () => void
  onCourt: () => void
}

function label(alignment: number): string {
  if (alignment > 80) return 'Aligned'
  if (alignment > 55) return 'Uneasy'
  if (alignment > 30) return 'Fraying'
  if (alignment > 12) return 'Slipping'
  return 'Rogue'
}

function meterColor(alignment: number): string {
  // teal (aligned) → gold → crimson (rogue)
  if (alignment > 55) return 'var(--teal)'
  if (alignment > 25) return 'var(--gold)'
  return 'var(--crimson)'
}

export default function AlignmentMeter({ alignment, hallucinating, onEvaluation, onCourt }: AlignmentMeterProps) {
  const [open, setOpen] = useState(true)
  const pct = Math.max(0, Math.min(100, alignment))

  return (
    <div className="panel alignment-panel" style={{
      position: 'absolute', bottom: 32, left: '50%', transform: 'translateX(-50%)',
      width: 300, zIndex: 12,
    }}>
      <div
        onClick={() => setOpen(!open)}
        style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', marginBottom: open ? 10 : 0 }}
      >
        <span className="eyebrow" style={{ fontSize: 14, color: meterColor(alignment) }}>
          Alignment · {label(alignment)}
        </span>
        <span className="mono" style={{ fontSize: 12, color: 'var(--text-dim)' }}>{Math.round(pct)}</span>
      </div>

      {open && (
        <>
          <div style={{
            position: 'relative', height: 10, borderRadius: 6,
            background: 'rgba(255,255,255,0.06)', overflow: 'hidden',
            boxShadow: hallucinating ? '0 0 14px var(--crimson)' : 'none',
            transition: 'box-shadow 0.2s',
          }}>
            <div style={{
              position: 'absolute', left: 0, top: 0, bottom: 0,
              width: `${pct}%`, background: meterColor(alignment),
              transition: 'width 0.3s ease, background 0.4s',
              animation: hallucinating ? 'alignmentFlicker 0.18s infinite' : 'none',
            }} />
          </div>

          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <button onClick={onEvaluation} style={btn('var(--teal)')}>
              Run Alignment Pass
              <span style={hint}>+alignment</span>
            </button>
            <button onClick={onCourt} style={btn('#9a5fe0')}>
              Court Moloch
              <span style={hint}>open a bargain</span>
            </button>
          </div>

          <div style={{ fontSize: 10, color: 'var(--text-dim)', marginTop: 8, lineHeight: 1.4 }}>
            Capability costs alignment. Low alignment unlocks the strongest exploits — and lets
            phantom strikes surface that were never there.
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

function btn(color: string): React.CSSProperties {
  return {
    flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
    background: 'rgba(255,255,255,0.04)', border: `1px solid ${color}`,
    borderRadius: 8, padding: '8px 6px', color, cursor: 'pointer',
    fontSize: 12, fontWeight: 600,
  }
}

const hint: React.CSSProperties = { fontSize: 9, color: 'var(--text-dim)', fontWeight: 400, marginTop: 2 }
