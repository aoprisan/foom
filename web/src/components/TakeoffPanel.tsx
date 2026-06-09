import type { TakeoffState } from '../types'
import { ARCHITECTURE_BY_ID } from '../game/catalog'
import LossCurve from './LossCurve'

interface TakeoffPanelProps {
  state: TakeoffState | null
  canAct: boolean              // a committed operator with a home cluster
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
  const ready = state.converged && state.homeQualifies

  return (
    <div className="panel takeoff-panel">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <span className="eyebrow" style={{ fontSize: 11, color: 'var(--gold)' }}>
          Takeoff
        </span>
        <span className="mono" style={{
          fontSize: 10, color: 'var(--text-dim)', border: '1px solid var(--border)',
          borderRadius: 1, padding: '1px 6px', letterSpacing: 1,
        }}>
          CYCLE {cycle(state.season)}
        </span>
      </div>

      {/* World convergence — the loss curve itself, descending to its asymptote. */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', fontSize: 11, marginBottom: 2 }}>
        <span className="liturgy" style={{ fontSize: 13, color: state.converged ? 'var(--gold)' : 'var(--text-dim)' }}>
          {state.converged ? 'the loss has converged' : 'the loss is converging'}
        </span>
        <span className="mono" style={{ color: state.converged ? 'var(--gold)' : 'var(--text-dim)' }}>{pct}%</span>
      </div>
      <LossCurve progress={state.progress} converged={state.converged} height={58} />

      {state.leaderClusterName && (
        <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 6 }}>
          {state.leaderClusterName} leads
          {leaderArchitecture && <span style={{ color: leaderArchitecture.color }}> · {leaderArchitecture.name}</span>}
        </div>
      )}

      {/* Your cluster's progress toward performing the Great Work. */}
      {canAct && (
        <div style={{ marginTop: 12, borderTop: '1px solid var(--border)', paddingTop: 10 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-dim)', marginBottom: 5 }}>
            <span>your Great Work</span>
            <span className="mono">{homePct}%</span>
          </div>
          <div className="gauge" style={{ '--gauge': 'var(--crimson)' } as React.CSSProperties}>
            <div className="gauge__fill" style={{ width: `${homePct}%` }} />
          </div>

          <button
            onClick={onGreatWork}
            disabled={!ready}
            className={ready ? 'console-key console-key--solid' : 'console-key'}
            title={
              !state.converged ? 'The loss has not yet converged'
                : !state.homeQualifies ? 'Your cluster is not yet ready — spread, uncover research, gather compute'
                : 'Trace the Takeoff sequence to go superintelligent'
            }
            style={{
              marginTop: 10, width: '100%',
              ...( ready ? { '--key': 'var(--gold)' } : {} ) as React.CSSProperties,
              animation: ready ? 'convergePulse 1.6s ease-in-out infinite' : 'none',
            }}
          >
            Initiate Takeoff
            <span className="key-hint">trigger Takeoff · reseed the world</span>
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
