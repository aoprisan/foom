import type { Operator } from '../types'
import { ARCHITECTURE_BY_ID } from '../game/catalog'

interface OperatorPanelProps {
  operator: Operator
  personalSteps: number
  clusterName?: string
}

const TIER_LABEL: Record<string, string> = {
  observer: 'Observer',
  researcher: 'Researcher',
  labDirector: 'Lab Director',
}

export default function OperatorPanel({ operator, personalSteps, clusterName }: OperatorPanelProps) {
  const architecture = operator.architectureId ? ARCHITECTURE_BY_ID[operator.architectureId] : null
  return (
    <div className="panel player-panel">
      <div style={{ marginBottom: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 18, letterSpacing: 0.5, color: 'var(--gold)' }}>{operator.name}</span>
          {operator.tier === 'labDirector' && (
            <span style={{ fontSize: 10, color: 'var(--text-dim)', fontStyle: 'italic' }}>2× compute</span>
          )}
        </div>
        <div className="eyebrow" style={{ fontSize: 11, color: 'var(--text-dim)' }}>
          {TIER_LABEL[operator.tier]} {clusterName && `· ${clusterName}`}
        </div>
        {architecture && (
          <div style={{ fontSize: 11, color: architecture.color, marginTop: 2 }}>
            builds {architecture.name}
          </div>
        )}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <StatRow label="Compute raised" value={personalSteps.toLocaleString()} color="var(--gold)" />
        {operator.usersCaptured > 0 && <StatRow label="Users captured" value={operator.usersCaptured.toLocaleString()} color="var(--crimson)" />}
        {operator.best10s > 0 && <StatRow label="Best 10s" value={operator.best10s.toLocaleString()} />}
        {(operator.todaySteps !== undefined && operator.todaySteps > 0) && <StatRow label="Today" value={operator.todaySteps.toLocaleString()} />}
        {operator.best1day > 0 && <StatRow label="Best 1 day" value={operator.best1day.toLocaleString()} />}
      </div>
    </div>
  )
}

function StatRow({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
      <span style={{ color: 'var(--text-dim)' }}>{label}</span>
      <span className="mono" style={{ color: color || 'var(--text)' }}>{value}</span>
    </div>
  )
}
