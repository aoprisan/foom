import { useEffect, useRef, useState } from 'react'
import type { Cluster, Contributor } from '../types'
import { game } from '../client'
import { ARCHITECTURE_BY_ID } from '../game/catalog'
import CapabilityViz from './CapabilityViz'

const CONTRIBUTOR_REFRESH_MS = 5000

interface InfoPanelProps {
  cluster: Cluster
  isHome: boolean
  userCompute?: number
  rank?: number
  onSpread?: () => void
}

export default function InfoPanel({ cluster, isHome, userCompute, rank, onSpread }: InfoPanelProps) {
  const [contributors, setContributors] = useState<Contributor[]>([])
  const [dailyChangePercent, setDailyChangePercent] = useState<number>(0)
  const refreshTimer = useRef<ReturnType<typeof setTimeout>>(undefined)
  const lastClusterId = useRef(cluster.id)

  useEffect(() => {
    let cancelled = false
    const clusterChanged = cluster.id !== lastClusterId.current
    lastClusterId.current = cluster.id

    const doFetch = () => {
      game.getClusterDetail(cluster.id).then(detail => {
        if (!cancelled) {
          setContributors(detail.topContributors)
          setDailyChangePercent(detail.dailyChangePercent)
        }
      }).catch(() => {})
    }

    if (clusterChanged) {
      clearTimeout(refreshTimer.current)
      doFetch()
    } else {
      if (!refreshTimer.current) {
        refreshTimer.current = setTimeout(() => {
          refreshTimer.current = undefined
          doFetch()
        }, CONTRIBUTOR_REFRESH_MS)
      }
    }

    return () => {
      cancelled = true
      clearTimeout(refreshTimer.current)
      refreshTimer.current = undefined
    }
  }, [cluster.id, cluster.compute])

  const architecture = cluster.architectureId ? ARCHITECTURE_BY_ID[cluster.architectureId] : null

  return (
    <div className="panel info-panel">
      <div style={{ marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 4 }}>
          <span style={{ fontFamily: 'var(--font-display)', fontWeight: 400, fontSize: 22, letterSpacing: 1.5, color: 'var(--bone)' }}>{cluster.name}</span>
          {isHome && (
            <span className="mono" style={{
              fontSize: 8.5, letterSpacing: 1.5, fontWeight: 600,
              color: 'var(--gold-bright)', border: '1px solid rgba(255,180,84,0.5)',
              background: 'rgba(255,180,84,0.1)', padding: '2px 6px', borderRadius: 0,
              whiteSpace: 'nowrap',
            }}>
              YOURS
            </span>
          )}
        </div>
        <span style={{ fontSize: 13, color: 'var(--text-dim)' }}>{cluster.country}</span>
        {architecture && (
          <div style={{ fontSize: 11, color: architecture.color, marginTop: 4 }}>
            runs {architecture.name}
          </div>
        )}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {rank !== undefined && rank > 0 && (
          <Row label="Rank" value={`#${rank}`} color="var(--gold)" />
        )}

        <Row label="Compute" value={cluster.compute.toLocaleString()} color="var(--gold)" />

        {dailyChangePercent !== 0 && (
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 12, color: 'var(--text-dim)' }}>Daily change</span>
            <span className="mono" style={{
              fontSize: 14,
              color: dailyChangePercent > 0 ? 'var(--teal)' : 'var(--crimson)',
            }}>
              {dailyChangePercent > 0 ? '+' : ''}{dailyChangePercent.toFixed(1)}%
            </span>
          </div>
        )}

        {cluster.peakCompute > 0 && cluster.peakCompute !== cluster.compute && (
          <Row label="Peak compute" value={cluster.peakCompute.toLocaleString()} />
        )}

        <Row label="Researchers" value={cluster.contributorCount.toLocaleString()} />

        {cluster.exploitStockpile > 0 && (
          <Row label="Exploits armed" value={String(cluster.exploitStockpile)} color="var(--crimson)" />
        )}

        {cluster.claimed > 0 && (
          <Row label="Compute lost" value={cluster.claimed.toLocaleString()} color="var(--crimson)" />
        )}

        {(cluster.deployment > 0 || isHome) && (
          <Row label="Deployment" value={`${cluster.deployment} clusters`} color="var(--teal)" />
        )}

        {(cluster.research > 0 || isHome) && (
          <Row label="Research" value={String(cluster.research)} color="var(--gold)" />
        )}

        {(cluster.guardrailLevel > 0 || isHome) && (
          <Row label="Guardrails" value={`${Math.round(cluster.guardrailLevel)}%`} color="var(--violet)" />
        )}

        {userCompute !== undefined && (
          <Row label="Your compute" value={userCompute.toLocaleString()} color="var(--gold)" />
        )}
      </div>

      {isHome && (
        <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
          <button
            onClick={() => game.guardrail()}
            title="Raise the guardrails — they blunt the Churn and contain your own model's treacherous turn, and they erode unless tended"
            className="console-key"
            style={{ flex: 1, ...( { '--key': 'var(--violet)' } as React.CSSProperties) }}
          >
            Guardrails
            <span className="key-hint">contain Churn & your model</span>
          </button>
          {onSpread && (
            <button
              onClick={onSpread}
              title="Spread to a nearby cluster — convert the uncommitted, or flip a rival you overpower"
              className="console-key"
              style={{ flex: 1 }}
            >
              Spread
              <span className="key-hint">convert a nearby cluster</span>
            </button>
          )}
        </div>
      )}

      {contributors.length > 0 && (
        <div style={{ marginTop: 12, borderTop: '1px solid var(--border)', paddingTop: 10 }}>
          <span className="eyebrow" style={{ fontSize: 11, color: 'var(--teal)' }}>
            Top Researchers
          </span>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 6 }}>
            {contributors.map((c, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                <span style={{ color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 160 }}>
                  {c.name}
                </span>
                <span className="mono" style={{ color: 'var(--text-dim)', flexShrink: 0, marginLeft: 8 }}>
                  {c.compute.toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {cluster.compute > 0 && (
        <div style={{ marginTop: 16, borderTop: '1px solid var(--border)', paddingTop: 12 }}>
          <CapabilityViz compute={cluster.compute} />
        </div>
      )}
    </div>
  )
}

function Row({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
      <span style={{ fontSize: 12, color: 'var(--text-dim)' }}>{label}</span>
      <span className="mono" style={{ fontSize: 14, color: color || 'var(--text)' }}>{value}</span>
    </div>
  )
}
