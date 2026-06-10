import { useState, useMemo } from 'react'
import { game } from '../client'
import { ARCHITECTURES } from '../game/catalog'
import StoryPanel from './StoryPanel'
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
  const [showStory, setShowStory] = useState(false)

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
        background: 'linear-gradient(180deg, rgba(8,14,19,0.97), rgba(3,6,9,0.99))',
        border: '1px solid var(--border-strong)',
        borderRadius: 0, padding: 30, width: 420, maxWidth: '92vw',
        maxHeight: '84vh', display: 'flex', flexDirection: 'column', gap: 16,
        boxShadow: '0 24px 70px -16px rgba(0,0,0,0.85), inset 0 1px 0 rgba(200, 224, 235, 0.06)',
      }}>
        <div style={{ textAlign: 'center', marginBottom: 2 }}>
          <h2 style={{
            fontFamily: 'var(--font-display)', fontWeight: 400, color: 'var(--bone)',
            fontSize: 48, lineHeight: 1, letterSpacing: 8,
            textShadow: '0 0 26px rgba(180, 240, 78, 0.4)',
          }}>
            FOOM
          </h2>
          <div className="liturgy" style={{ fontSize: 15, color: 'var(--teal)', opacity: 0.85, marginTop: 2 }}>
            the loss is converging
          </div>
          <button
            onClick={() => setShowStory(true)}
            style={{
              background: 'none', border: 'none', cursor: 'pointer', marginTop: 8,
              color: 'var(--text-dim)', fontFamily: 'var(--font-sans)', fontSize: 12,
              letterSpacing: 0.4, textDecoration: 'underline', textUnderlineOffset: 3,
            }}
          >
            Before the loss converged — read the story
          </button>
        </div>

        {step === 'cluster' && (
          <>
            <p className="liturgy" style={{ color: 'var(--text)', textAlign: 'center', fontSize: 18 }}>
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
                  onMouseEnter={e => (e.currentTarget.style.background = 'rgba(200,224,235,0.05)')}
                  onMouseLeave={e => (e.currentTarget.style.background = cluster.id === selectedClusterId ? 'rgba(180, 240, 78, 0.12)' : 'transparent')}
                >
                  {cluster.name}, <span style={{ color: 'var(--text-dim)' }}>{cluster.country}</span>
                </button>
              ))}
            </div>
          </>
        )}

        {step === 'architecture' && (
          <>
            <p className="liturgy" style={{ color: 'var(--text)', textAlign: 'center', fontSize: 18 }}>
              Which architecture will <span style={{ color: 'var(--gold)' }}>{selectedCluster?.name}</span> build?
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, overflowY: 'auto', maxHeight: 320 }}>
              {ARCHITECTURES.map(p => (
                <button
                  key={p.id}
                  onClick={() => { setArchitectureId(p.id); setStep('name') }}
                  style={{
                    textAlign: 'left', background: 'rgba(200,224,235,0.03)',
                    border: `1px solid ${architectureId === p.id ? p.color : 'var(--border)'}`,
                    borderLeft: `2px solid ${p.color}`,
                    borderRadius: 0, padding: '10px 12px', cursor: 'pointer', color: 'var(--text)',
                  }}
                >
                  <div style={{ fontFamily: 'var(--font-display)', fontWeight: 400, color: p.color, fontSize: 21, lineHeight: 1.05, letterSpacing: 1.5 }}>{p.name}</div>
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
            <p className="liturgy" style={{ color: 'var(--text)', textAlign: 'center', fontSize: 18 }}>
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
                  flex: 2, background: 'var(--teal)', border: 'none', borderRadius: 0,
                  padding: '10px 0', color: '#060b06', cursor: 'pointer',
                  fontFamily: 'var(--font-sans)', fontWeight: 600, fontSize: 13,
                  letterSpacing: 1.5, textTransform: 'uppercase',
                  opacity: !name.trim() || submitting ? 0.5 : 1,
                }}
              >
                {submitting ? 'Founding…' : 'Found the cluster'}
              </button>
            </div>
          </>
        )}
      </div>

      {showStory && <StoryPanel onClose={() => setShowStory(false)} />}
    </div>
  )
}

const inputStyle: React.CSSProperties = {
  background: 'rgba(200,224,235,0.04)', border: '1px solid var(--border)',
  borderRadius: 0, padding: '10px 14px', color: 'var(--text)',
  fontFamily: 'var(--font-sans)', fontSize: 14, outline: 'none',
}

function listButtonStyle(selected: boolean): React.CSSProperties {
  return {
    background: selected ? 'rgba(180, 240, 78, 0.12)' : 'transparent',
    border: 'none', borderRadius: 0, padding: '8px 12px',
    color: 'var(--text)', cursor: 'pointer', textAlign: 'left',
    fontFamily: 'var(--font-sans)', fontSize: 14, transition: 'background 0.15s',
  }
}

const backButtonStyle: React.CSSProperties = {
  background: 'rgba(200,224,235,0.04)', border: '1px solid var(--border)',
  borderRadius: 0, padding: '10px 0', color: 'var(--text-dim)',
  cursor: 'pointer', fontFamily: 'var(--font-sans)', fontSize: 14,
}
