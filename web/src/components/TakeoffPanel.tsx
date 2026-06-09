import type { TakeoffState } from '../types'
import { ARCHITECTURE_BY_ID } from '../game/catalog'

interface TakeoffPanelProps {
  state: TakeoffState | null
  canAct: boolean              // a sworn operator with a home cluster
  onGreatWork: () => void
}

const ROMAN = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X']
function cycle(n: number): string {
  return ROMAN[n] ?? String(n)
}

export default function TakeoffPanel({ state, canAct, onGreatWork }: TakeoffPanelProps) {
  if (!state) return null

  const leaderArchitecture = state.leaderArchitectureId ? ARCHITECTURE_BY_ID[state.leaderArchitectureId] : null
  const pct = Math.round(state.progress * 100)
  const homePct = Math.min(100, Math.round((state.homeScore / state.goal) * 100))

  return (
    <div className="panel takeoff-panel" style={{
      top: 330, left: 24, width: 280,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <span className="eyebrow" style={{ fontSize: 14, color: 'var(--gold)' }}>
          Takeoff
        </span>
        <span className="mono" style={{
          fontSize: 10, color: 'var(--text-dim)', border: '1px solid var(--border)',
          borderRadius: 4, padding: '1px 6px',
        }}>
          Cycle {cycle(state.season)}
        </span>
      </div>

      {/* World alignment — how near the stars are to coming right. */}
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-dim)', marginBottom: 4 }}>
        <span>{state.aligned ? 'the loss has converged' : 'the loss is converging'}</span>
        <span className="mono">{pct}%</span>
      </div>
      <div style={{
        position: 'relative', height: 9, borderRadius: 6,
        background: 'rgba(255,255,255,0.06)', overflow: 'hidden',
        boxShadow: state.aligned ? '0 0 14px var(--gold)' : 'none',
      }}>
        <div style={{
          position: 'absolute', inset: '0 auto 0 0', width: `${pct}%`,
          background: state.aligned ? 'var(--gold)' : 'linear-gradient(90deg, var(--teal), var(--gold))',
          transition: 'width 0.5s ease',
          animation: state.aligned ? 'convergePulse 1.6s ease-in-out infinite' : 'none',
        }} />
      </div>

      {state.leaderClusterName && (
        <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 8 }}>
          {state.leaderClusterName} leads
          {leaderArchitecture && <span style={{ color: leaderArchitecture.color }}> · {leaderArchitecture.name}</span>}
        </div>
      )}

      {/* Your cluster's Great Work toward performing the Great Work. */}
      {canAct && (
        <div style={{ marginTop: 12, borderTop: '1px solid var(--border)', paddingTop: 10 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-dim)', marginBottom: 4 }}>
            <span>your Great Work</span>
            <span className="mono">{homePct}%</span>
          </div>
          <div style={{ position: 'relative', height: 7, borderRadius: 5, background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
            <div style={{
              position: 'absolute', inset: '0 auto 0 0', width: `${homePct}%`,
              background: 'var(--crimson)', transition: 'width 0.4s ease',
            }} />
          </div>

          <button
            onClick={onGreatWork}
            disabled={!state.aligned || !state.homeQualifies}
            title={
              !state.aligned ? 'The loss has not yet converged'
                : !state.homeQualifies ? 'Your cluster is not yet ready — spread, uncover research, gather compute'
                : 'Trace the Takeoff sequence to go superintelligent'
            }
            style={{
              marginTop: 10, width: '100%', borderRadius: 8, padding: '9px 6px',
              fontSize: 12, fontWeight: 700, letterSpacing: 1,
              cursor: state.aligned && state.homeQualifies ? 'pointer' : 'not-allowed',
              border: `1px solid ${state.aligned && state.homeQualifies ? 'var(--gold)' : 'var(--border)'}`,
              background: state.aligned && state.homeQualifies ? 'rgba(245, 185, 66,0.14)' : 'rgba(255,255,255,0.02)',
              color: state.aligned && state.homeQualifies ? 'var(--gold)' : 'var(--text-faint)',
              display: 'flex', flexDirection: 'column', alignItems: 'center',
              animation: state.aligned && state.homeQualifies ? 'convergePulse 1.6s ease-in-out infinite' : 'none',
            }}
          >
            INITIATE TAKEOFF
            <span style={{ fontSize: 9, fontWeight: 400, letterSpacing: 0, marginTop: 2, color: 'var(--text-dim)' }}>
              trigger Takeoff · reseed the world
            </span>
          </button>
        </div>
      )}

      <div style={{ fontSize: 10, color: 'var(--text-dim)', marginTop: 10, lineHeight: 1.4 }}>
        Spread your lab and uncover research to swell the Great Work. When the loss has converged,
        the first lab to complete the Great Work triggers its Takeoff — and the world begins anew.
      </div>

      <style>{`
        @keyframes convergePulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.55; }
        }
      `}</style>
    </div>
  )
}
