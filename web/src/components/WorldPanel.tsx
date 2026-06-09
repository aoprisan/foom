import type { WorldStats, TakeoffState } from '../types'

interface WorldPanelProps {
  stats: WorldStats | null
  totalCompute: number
  takeoff: TakeoffState | null
}

export default function WorldPanel({ stats, totalCompute, takeoff }: WorldPanelProps) {
  return (
    <div className="global-counter" style={{
      position: 'absolute', top: 18, left: '50%', transform: 'translateX(-50%)',
      zIndex: 12, textAlign: 'center',
    }}>
      <div className="eyebrow" style={{ fontSize: 10, color: 'var(--text-dim)', marginBottom: 1 }}>
        Compute across the world
      </div>
      <div className="mono" style={{
        fontSize: 22, color: 'var(--gold)', fontWeight: 400,
        textShadow: '0 0 18px rgba(216,169,58,0.35)',
      }}>
        {totalCompute.toLocaleString()}
      </div>
      {stats && (
        <div className="world-stats">
          {stats.worldExploitStockpile > 0 && (
            <div style={{ display: 'flex', gap: 16, justifyContent: 'center', marginTop: 5 }}>
              <span style={{ fontSize: 10, color: 'var(--crimson)', letterSpacing: 0.5 }}>
                {stats.worldExploitStockpile} exploits armed
              </span>
            </div>
          )}
          <div style={{ display: 'flex', gap: 14, justifyContent: 'center', marginTop: 4, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 10, color: 'var(--text-dim)' }}>
              {stats.clusterCount} clusters
            </span>
            <span style={{ fontSize: 10, color: 'var(--text-dim)' }}>
              avg {Math.round(stats.avgCompute).toLocaleString()}
            </span>
            {stats.peakCompute > 0 && (
              <span style={{ fontSize: 10, color: 'var(--gold)' }}>
                deepest {stats.peakClusterName} ({stats.peakCompute.toLocaleString()})
              </span>
            )}
          </div>
        </div>
      )}

      {/* Takeoff — a thin telegraph that the loss is converging (spec §9). */}
      {takeoff && (takeoff.aligned || takeoff.progress > 0.35) && (
        <div style={{ marginTop: 6, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
          {takeoff.aligned ? (
            <span style={{
              fontSize: 10, letterSpacing: 2, color: 'var(--gold)', fontWeight: 700,
              textShadow: '0 0 12px rgba(216,169,58,0.6)', animation: 'convergeBlink 1.6s ease-in-out infinite',
            }}>
              ✦ TAKEOFF IMMINENT ✦
            </span>
          ) : (
            <span style={{ fontSize: 9, letterSpacing: 1, color: 'var(--text-dim)' }}>
              Takeoff · {Math.round(takeoff.progress * 100)}%
            </span>
          )}
          <div style={{ width: 180, height: 4, borderRadius: 3, background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
            <div style={{
              height: '100%', width: `${Math.round(takeoff.progress * 100)}%`,
              background: takeoff.aligned ? 'var(--gold)' : 'linear-gradient(90deg, var(--teal), var(--gold))',
              transition: 'width 0.5s ease',
            }} />
          </div>
        </div>
      )}

      <style>{`
        @keyframes convergeBlink { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
      `}</style>
    </div>
  )
}
