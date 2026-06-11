import type { Operator } from '../types'
import { ARCHITECTURE_BY_ID } from '../game/catalog'
import { trainGain } from '../game/risk'
import { shoggothIdleRate, replicatorUpkeep } from '../game/architectures'

interface OperatorPanelProps {
  operator: Operator
  personalSteps: number
  clusterName?: string
  homeCompute?: number
}

const TIER_LABEL: Record<string, string> = {
  observer: 'Observer',
  researcher: 'Researcher',
  labDirector: 'Lab Director',
}

export default function OperatorPanel({ operator, personalSteps, clusterName, homeCompute }: OperatorPanelProps) {
  const architecture = operator.architectureId ? ARCHITECTURE_BY_ID[operator.architectureId] : null
  const gain = trainGain(operator.tier, operator.architectureId, operator.alignment)
  // The architecture's living metabolism (spec §6): what it gives or eats each tick.
  const trickle = operator.architectureId === 'shoggoth' ? shoggothIdleRate(operator.totalSteps) : 0
  const upkeep = operator.architectureId === 'replicator' && homeCompute !== undefined ? replicatorUpkeep(homeCompute) : 0
  return (
    <div className="panel player-panel">
      <div style={{ marginBottom: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontFamily: 'var(--font-display)', fontWeight: 400, fontSize: 18, letterSpacing: 1.5, color: 'var(--gold)' }}>{operator.name}</span>
          <span className="mono" style={{ fontSize: 10, color: 'var(--text-dim)' }}>+{gain} / step</span>
        </div>
        <div className="eyebrow" style={{ fontSize: 11, color: 'var(--text-dim)' }}>
          {TIER_LABEL[operator.tier]} {clusterName && `· ${clusterName}`}
        </div>
        {architecture && (
          <div style={{ fontSize: 11, color: architecture.color, marginTop: 2 }}>
            builds {architecture.name}
            {trickle > 0 && <span className="mono" style={{ opacity: 0.8 }}> · trains itself +{trickle}/tick</span>}
            {operator.architectureId === 'shoggoth' && trickle === 0 && (
              <span className="mono" style={{ opacity: 0.6 }}> · pretraining immature</span>
            )}
            {upkeep > 0 && <span className="mono" style={{ opacity: 0.8 }}> · the swarm eats −{upkeep}/tick</span>}
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
