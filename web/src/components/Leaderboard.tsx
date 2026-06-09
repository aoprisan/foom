import { useState, useEffect } from 'react'
import type { Cluster, LeaderboardKind } from '../types'
import { game } from '../client'

interface LeaderboardProps {
  // Bumped by App when the world shifts, so the active board re-fetches.
  version: number
}

// The three boards of spec §9: faith, spread, and forbidden knowledge.
const BOARDS: { kind: LeaderboardKind; tab: string; title: string; metric: (c: Cluster) => string; raw: (c: Cluster) => number }[] = [
  { kind: 'compute', tab: 'Compute', title: 'Deepest Compute', metric: c => c.compute.toLocaleString(), raw: c => c.compute },
  { kind: 'deployment', tab: 'Deploy', title: 'Widest Deployment', metric: c => `${c.deployment} reached`, raw: c => c.deployment },
  { kind: 'research', tab: 'Research', title: 'Deepest Research', metric: c => `${c.research} research`, raw: c => c.research },
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

  const top = clusters.length > 0 ? Math.max(1, board.raw(clusters[0])) : 1

  return (
    <div className="panel leaderboard-panel">
      <div
        onClick={() => setCollapsed(!collapsed)}
        style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          cursor: 'pointer', marginBottom: collapsed ? 0 : 12,
        }}
      >
        <span className="eyebrow" style={{ fontSize: 11, color: 'var(--teal)' }}>
          {board.title}
        </span>
        <span style={{ color: 'var(--text-dim)', fontSize: 12 }}>{collapsed ? '+' : '−'}</span>
      </div>

      {!collapsed && (
        <>
          <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
            {BOARDS.map(b => (
              <button
                key={b.kind}
                onClick={() => setKind(b.kind)}
                className="console-key"
                style={{
                  flex: 1, padding: '4px 0', fontSize: 9, letterSpacing: 1.2,
                  ...( kind === b.kind ? {} : { '--key': 'var(--text-dim)', background: 'transparent' } ) as React.CSSProperties,
                }}
              >
                {b.tab}
              </button>
            ))}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            {clusters.length === 0 && (
              <span style={{ color: 'var(--text-dim)', fontSize: 13 }}>The world sleeps</span>
            )}
            {clusters.map((cluster, i) => {
              const first = i === 0
              const share = Math.max(0.02, board.raw(cluster) / top)
              return (
                <div key={cluster.id} style={{
                  position: 'relative',
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '4px 6px',
                  overflow: 'hidden',
                }}>
                  {/* magnitude bar — each cluster's standing relative to the leader */}
                  <div aria-hidden style={{
                    position: 'absolute', inset: '0 auto 0 0',
                    width: `${share * 100}%`,
                    background: first
                      ? 'linear-gradient(90deg, rgba(245,185,66,0.16), rgba(245,185,66,0.03))'
                      : 'linear-gradient(90deg, rgba(255,154,74,0.10), rgba(255,154,74,0.015))',
                    borderLeft: first ? '2px solid rgba(245,185,66,0.7)' : '2px solid rgba(255,154,74,0.35)',
                    transition: 'width 0.6s ease',
                  }} />
                  <div style={{ display: 'flex', gap: 7, alignItems: 'center', minWidth: 0, position: 'relative' }}>
                    <span className="mono" style={{ fontSize: 11, color: first ? 'var(--gold)' : 'var(--text-faint)', width: 16, flexShrink: 0 }}>
                      {first ? '✦' : i + 1}
                    </span>
                    <span style={{
                      fontSize: 13, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                      color: first ? 'var(--gold-bright)' : 'var(--text)',
                      textShadow: first ? '0 0 10px rgba(245,185,66,0.35)' : 'none',
                    }}>
                      {cluster.name}
                    </span>
                    <span style={{ fontSize: 10, color: 'var(--text-faint)' }}>{cluster.countryCode}</span>
                  </div>
                  <span className="mono" style={{
                    position: 'relative', fontSize: 12, flexShrink: 0, marginLeft: 8,
                    color: first ? 'var(--gold-bright)' : 'var(--gold)',
                  }}>
                    {board.metric(cluster)}
                  </span>
                </div>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}
