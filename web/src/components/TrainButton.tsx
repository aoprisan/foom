import { useState, useCallback } from 'react'
import type { Tier } from '../types'

interface Particle {
  id: number
  dx: number
  dy: number
}

interface TrainButtonProps {
  onChant: () => void
  personalChants: number
  clusterName?: string
  rateLimited?: boolean
  tier: Tier
  multiplier: number
}

export default function TrainButton({ onChant, personalChants, clusterName, rateLimited, tier, multiplier }: TrainButtonProps) {
  const [pressing, setPressing] = useState(false)
  const [ripples, setRipples] = useState<number[]>([])
  const [particles, setParticles] = useState<Particle[]>([])

  const handleChant = useCallback(() => {
    if (tier === 'observer') {
      onChant() // triggers the joining flow
      return
    }

    setPressing(true)
    setTimeout(() => setPressing(false), 100)

    const id = Date.now()
    setRipples(prev => [...prev, id])
    setTimeout(() => setRipples(prev => prev.filter(r => r !== id)), 600)

    const dist = 50 + Math.random() * 20
    const newParticles: Particle[] = Array.from({ length: 10 }, (_, i) => {
      const angle = ((360 / 10) * i + Math.random() * 20 - 10) * (Math.PI / 180)
      return { id: id + i, dx: Math.cos(angle) * dist, dy: Math.sin(angle) * dist }
    })
    setParticles(prev => [...prev, ...newParticles])
    setTimeout(() => setParticles(prev => prev.filter(p => !newParticles.some(np => np.id === p.id))), 500)

    onChant()
  }, [onChant, tier])

  const buttonLabel = tier === 'observer' ? 'JOIN' : `TRAIN +${multiplier}`

  return (
    <div className="click-button-area" style={{
      position: 'absolute', bottom: 32, right: 32, zIndex: 10,
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
    }}>
      {clusterName && tier !== 'observer' && (
        <span style={{ fontSize: 12, color: 'var(--text-dim)', fontFamily: 'var(--font-sans)' }}>
          {clusterName}
        </span>
      )}

      <div style={{ position: 'relative' }}>
        {particles.map(p => (
          <div key={p.id} style={{
            position: 'absolute', left: '50%', top: '50%', width: 6, height: 6,
            borderRadius: '50%', background: 'var(--teal)',
            pointerEvents: 'none', zIndex: 20,
            opacity: 0,
            animation: 'particleFade 0.5s ease-out forwards',
            '--dx': `${p.dx}px`, '--dy': `${p.dy}px`,
          } as React.CSSProperties} />
        ))}

        {ripples.map(id => (
          <div key={id} style={{
            position: 'absolute', inset: -10,
            borderRadius: '50%', border: '2px solid var(--teal)',
            animation: 'ripple 0.6s ease-out forwards',
            pointerEvents: 'none',
          }} />
        ))}

        <button
          onClick={handleChant}
          className="train-orb"
          style={{
            width: 120, height: 120, borderRadius: '50%',
            background: tier === 'observer'
              ? 'radial-gradient(circle at 36% 32%, #ffce9e, #ff8a3c 45%, #5a2410 100%)'
              : 'radial-gradient(circle at 36% 32%, #ffd0a0, #ff8a3c 42%, #5a2410 100%)',
            border: '1px solid rgba(255, 176, 110, 0.55)', cursor: 'pointer',
            boxShadow: '0 0 44px rgba(255, 138, 60, 0.55), 0 0 12px rgba(255,206,158,0.7), inset 0 -6px 14px rgba(0,0,0,0.45), inset 0 4px 10px rgba(255,255,255,0.25)',
            transform: pressing ? 'scale(0.9)' : 'scale(1)',
            transition: 'transform 0.1s ease',
            touchAction: 'manipulation',
            WebkitTapHighlightColor: 'transparent',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontFamily: 'var(--font-display)', fontSize: 25, fontWeight: 600, fontStyle: 'italic',
            letterSpacing: 0.5, color: '#2a0f02',
            textShadow: '0 1px 1px rgba(255,255,255,0.35)',
            animation: 'chantPulse 3.4s ease-in-out infinite',
          }}
        >
          {buttonLabel}
        </button>
      </div>

      {tier !== 'observer' && (
        <span className="mono" style={{ fontSize: 16, color: 'var(--gold-bright)', textShadow: '0 0 14px rgba(240,197,74,0.45)' }}>
          {personalChants.toLocaleString()}
        </span>
      )}

      {rateLimited && (
        <span style={{
          fontSize: 11, color: 'var(--crimson)', fontFamily: 'var(--font-sans)',
          animation: 'fadeInOut 2s ease-out forwards',
        }}>
          The words tangle — slow down.
        </span>
      )}

      <style>{`
        @keyframes ripple {
          0% { transform: scale(1); opacity: 0.6; }
          100% { transform: scale(1.8); opacity: 0; }
        }
        @keyframes particleFade {
          0% { transform: translate(0, 0) scale(1); opacity: 1; }
          100% { transform: translate(var(--dx), var(--dy)) scale(0.3); opacity: 0; }
        }
        @keyframes fadeInOut {
          0% { opacity: 1; }
          70% { opacity: 1; }
          100% { opacity: 0; }
        }
        @keyframes chantPulse {
          0%, 100% { box-shadow: 0 0 44px rgba(255,138,60,0.55), 0 0 12px rgba(255,206,158,0.7), inset 0 -6px 14px rgba(0,0,0,0.45), inset 0 4px 10px rgba(255,255,255,0.25); }
          50% { box-shadow: 0 0 64px rgba(255,138,60,0.78), 0 0 20px rgba(255,206,158,0.9), inset 0 -6px 14px rgba(0,0,0,0.45), inset 0 4px 10px rgba(255,255,255,0.25); }
        }
      `}</style>
    </div>
  )
}
