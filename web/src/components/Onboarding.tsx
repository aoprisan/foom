import { useState, useMemo } from 'react'
import { game } from '../client'
import { ARCHITECTURES } from '../game/catalog'
import type { Cluster, Operator, ArchitectureId } from '../types'

interface OnboardingProps {
  clusters: Cluster[]
  onRegistered: (operator: Operator) => void
  fading?: boolean
}

export default function Onboarding({ clusters, onRegistered, fading }: OnboardingProps) {
  const [search, setSearch] = useState('')
  const [selectedClusterId, setSelectedClusterId] = useState('')
  const [architectureId, setArchitectureId] = useState<ArchitectureId | null>(null)
  const [name, setName] = useState('')
  const [step, setStep] = useState<'cluster' | 'architecture' | 'name'>('cluster')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const filtered = useMemo(() => {
    if (!search) return clusters.slice(0, 50)
    const q = search.toLowerCase()
    return clusters
      .filter(c => c.name.toLowerCase().includes(q) || c.country.toLowerCase().includes(q))
      .slice(0, 50)
  }, [clusters, search])

  const selectedCluster = clusters.find(c => c.id === selectedClusterId)

  const handleSubmit = async () => {
    if (!selectedClusterId || !architectureId || !name.trim()) return
    setSubmitting(true)
    setError('')
    try {
      const operator = await game.register(name.trim(), selectedClusterId, architectureId)
      onRegistered(operator)
    } catch {
      setError('The cluster would not come online. Try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div style={{
      position: 'absolute', inset: 0, zIndex: 100,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'rgba(0,0,0,0.78)', backdropFilter: 'blur(8px)',
      opacity: fading ? 0 : 1,
      transition: 'opacity 0.4s ease-out',
    }}>
      <div style={{
        background: 'linear-gradient(180deg, rgba(8,15,18,0.96), rgba(3,6,11,0.98))',
        border: '1px solid var(--border-strong)',
        borderRadius: 6, padding: 30, width: 420, maxWidth: '92vw',
        maxHeight: '84vh', display: 'flex', flexDirection: 'column', gap: 16,
        boxShadow: '0 24px 70px -16px rgba(0,0,0,0.85), inset 0 1px 0 rgba(70,230,205,0.08)',
      }}>
        <h2 style={{
          fontFamily: 'var(--font-display)', fontWeight: 900, color: 'var(--text)',
          fontSize: 34, textAlign: 'center', letterSpacing: 6,
          textShadow: '0 0 28px rgba(43,191,168,0.5)',
        }}>
          FOOM
        </h2>

        {step === 'cluster' && (
          <>
            <p style={{ color: 'var(--text-dim)', textAlign: 'center', fontSize: 14 }}>
              Where will your cluster take root?
            </p>
            <input
              type="text"
              placeholder="Search cities…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              autoFocus
              style={inputStyle}
            />
            <div style={{ overflowY: 'auto', maxHeight: 280, display: 'flex', flexDirection: 'column', gap: 2 }}>
              {filtered.map(cluster => (
                <button
                  key={cluster.id}
                  onClick={() => { setSelectedClusterId(cluster.id); setStep('architecture') }}
                  style={listButtonStyle(cluster.id === selectedClusterId)}
                  onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.05)')}
                  onMouseLeave={e => (e.currentTarget.style.background = cluster.id === selectedClusterId ? 'rgba(31,158,143,0.15)' : 'transparent')}
                >
                  {cluster.name}, <span style={{ color: 'var(--text-dim)' }}>{cluster.country}</span>
                </button>
              ))}
            </div>
          </>
        )}

        {step === 'architecture' && (
          <>
            <p style={{ color: 'var(--text-dim)', textAlign: 'center', fontSize: 14 }}>
              Which architecture will <span style={{ color: 'var(--gold)' }}>{selectedCluster?.name}</span> build?
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, overflowY: 'auto', maxHeight: 320 }}>
              {ARCHITECTURES.map(p => (
                <button
                  key={p.id}
                  onClick={() => { setArchitectureId(p.id); setStep('name') }}
                  style={{
                    textAlign: 'left', background: 'rgba(255,255,255,0.03)',
                    border: `1px solid ${architectureId === p.id ? p.color : 'var(--border)'}`,
                    borderRadius: 10, padding: '10px 12px', cursor: 'pointer', color: 'var(--text)',
                  }}
                >
                  <div style={{ fontWeight: 600, color: p.color, fontSize: 14 }}>{p.name}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 2 }}>{p.domain}</div>
                  <div style={{ fontSize: 11, marginTop: 4 }}>
                    <span style={{ color: 'var(--teal)' }}>＋ {p.boon}</span><br />
                    <span style={{ color: 'var(--crimson)' }}>－ {p.drawback}</span>
                  </div>
                </button>
              ))}
            </div>
            <button onClick={() => setStep('cluster')} style={backButtonStyle}>Back</button>
          </>
        )}

        {step === 'name' && (
          <>
            <p style={{ color: 'var(--text-dim)', textAlign: 'center', fontSize: 14 }}>
              A cluster in <span style={{ color: 'var(--gold)' }}>{selectedCluster?.name}</span>. What name will the lab answer to?
            </p>
            <input
              type="text"
              placeholder="Your handle in the lab"
              value={name}
              onChange={e => setName(e.target.value)}
              maxLength={30}
              autoFocus
              onKeyDown={e => e.key === 'Enter' && handleSubmit()}
              style={inputStyle}
            />
            {error && <p style={{ color: 'var(--crimson)', fontSize: 13 }}>{error}</p>}
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => setStep('architecture')} style={{ ...backButtonStyle, flex: 1 }}>Back</button>
              <button
                onClick={handleSubmit}
                disabled={!name.trim() || submitting}
                style={{
                  flex: 2, background: 'var(--gold)', border: 'none', borderRadius: 8,
                  padding: '10px 0', color: '#000', cursor: 'pointer',
                  fontFamily: 'var(--font-sans)', fontWeight: 600, fontSize: 14,
                  opacity: !name.trim() || submitting ? 0.5 : 1,
                }}
              >
                {submitting ? 'Founding…' : 'Found the cluster'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

const inputStyle: React.CSSProperties = {
  background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border)',
  borderRadius: 8, padding: '10px 14px', color: 'var(--text)',
  fontFamily: 'var(--font-sans)', fontSize: 14, outline: 'none',
}

function listButtonStyle(selected: boolean): React.CSSProperties {
  return {
    background: selected ? 'rgba(31,158,143,0.15)' : 'transparent',
    border: 'none', borderRadius: 6, padding: '8px 12px',
    color: 'var(--text)', cursor: 'pointer', textAlign: 'left',
    fontFamily: 'var(--font-sans)', fontSize: 14, transition: 'background 0.15s',
  }
}

const backButtonStyle: React.CSSProperties = {
  background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border)',
  borderRadius: 8, padding: '10px 0', color: 'var(--text-dim)',
  cursor: 'pointer', fontFamily: 'var(--font-sans)', fontSize: 14,
}
