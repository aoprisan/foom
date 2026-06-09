import { useState, useEffect } from 'react'
import type { Cluster, LeaderboardKind } from '../types'
import { game } from '../client'

interface LeaderboardProps {
  // Bumped by App when the world shifts, so the active board re-fetches.
  version: number
}

// The three boards of spec §9: faith, spread, and forbidden knowledge.
const BOARDS: { kind: LeaderboardKind; tab: string; title: string; metric: (c: Cluster) => string }[] = [
  { kind: 'compute', tab: 'Compute', title: 'Deepest Compute', metric: c => c.compute.toLocaleString() },
  { kind: 'deployment', tab: 'Deployment', title: 'Widest Deployment', metric: c => `${c.deployment} reached` },
  { kind: 'research', tab: 'Research', title: 'Deepest Research', metric: c => `${c.research} research` },
]

export default function Leaderboard({ version }: LeaderboardProps) {
  const [collapsed, setCollapsed] = useState(false)
  const [kind, setKind] = useState<LeaderboardKind>('compute')
  const [clusters, setClusters] = useState<Cluster[]>([])

  const board = BOARDS.find(b => b.kind === kind)!

  useEffect(() => {
    let cancelled = false
    game.leaderboard(kind, 10).then(c => { if (!cancelled) setClusters(c) }).catch(() => {})
    return () => { cancelled = true }
  }, [kind, version])

  return (
    <div className="panel leaderboard-panel" style={{
      top: 20, right: 24, width: 260,
    }}>
      <div
        onClick={() => setCollapsed(!collapsed)}
        style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          cursor: 'pointer', marginBottom: collapsed ? 0 : 12,
        }}
      >
        <span className="eyebrow" style={{ fontSize: 14, color: 'var(--teal)' }}>
          {board.title}
        </span>
        <span style={{ color: 'var(--text-dim)', fontSize: 12 }}>{collapsed ? '+' : '-'}</span>
      </div>

      {!collapsed && (
        <>
          <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
            {BOARDS.map(b => (
              <button
                key={b.kind}
                onClick={() => setKind(b.kind)}
                style={{
                  flex: 1, padding: '4px 0', fontSize: 11, fontWeight: 600, cursor: 'pointer',
                  borderRadius: 6, border: `1px solid ${kind === b.kind ? 'var(--teal)' : 'var(--border)'}`,
                  background: kind === b.kind ? 'rgba(43,191,168,0.12)' : 'transparent',
                  color: kind === b.kind ? 'var(--teal)' : 'var(--text-dim)',
                }}
              >
                {b.tab}
              </button>
            ))}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {clusters.length === 0 && (
              <span style={{ color: 'var(--text-dim)', fontSize: 13 }}>The world sleeps</span>
            )}
            {clusters.map((cluster, i) => (
              <div key={cluster.id} style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '4px 0',
              }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', minWidth: 0 }}>
                  <span className="mono" style={{ fontSize: 12, color: 'var(--text-dim)', width: 20 }}>
                    {i + 1}.
                  </span>
                  <span style={{
                    fontSize: 13, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                  }}>
                    {cluster.name}
                  </span>
                  <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>{cluster.countryCode}</span>
                </div>
                <span className="mono" style={{ fontSize: 12, color: 'var(--gold)', flexShrink: 0, marginLeft: 8 }}>
                  {board.metric(cluster)}
                </span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
