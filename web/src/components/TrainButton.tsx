import { useState, useCallback, useRef } from 'react'
import type { Tier } from '../types'

interface Particle {
  id: number
  dx: number
  dy: number
  size: number
  color: string
}

interface FloatNum {
  id: number
  value: number
  dx: number
}

interface TrainButtonProps {
  onTrain: () => void
  personalSteps: number
  clusterName?: string
  rateLimited?: boolean
  tier: Tier
  multiplier: number
}

// Combo: rapid clicks (within COMBO_WINDOW of each other) stack heat that
// intensifies the orb's glow, throws more/faster embers, and raises the
// click pitch. It decays once you stop. spec §clicker-juice.
const COMBO_WINDOW = 600 // ms between clicks to keep the streak alive
const COMBO_MAX = 30

// Lazily-built WebAudio "thunk". Created on the first click so it honors the
// browser's user-gesture requirement for audio.
let audioCtx: AudioContext | null = null
function playThunk(combo: number) {
  try {
    if (!audioCtx) {
      const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
      if (!Ctx) return
      audioCtx = new Ctx()
    }
    const ctx = audioCtx
    if (ctx.state === 'suspended') void ctx.resume()
    const now = ctx.currentTime

    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    // Pitch climbs with the streak — a rising ladder that rewards rhythm.
    const base = 160 + Math.min(combo, COMBO_MAX) * 11
    osc.type = 'triangle'
    osc.frequency.setValueAtTime(base * 1.5, now)
    osc.frequency.exponentialRampToValueAtTime(base, now + 0.08)

    gain.gain.setValueAtTime(0.0001, now)
    gain.gain.exponentialRampToValueAtTime(0.18, now + 0.005)
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.14)

    osc.connect(gain).connect(ctx.destination)
    osc.start(now)
    osc.stop(now + 0.16)
  } catch {
    // audio is a nicety — never let it break the click
  }
}

export default function TrainButton({ onTrain, personalSteps, clusterName, rateLimited, tier, multiplier }: TrainButtonProps) {
  const [pressing, setPressing] = useState(false)
  const [ripples, setRipples] = useState<number[]>([])
  const [particles, setParticles] = useState<Particle[]>([])
  const [floats, setFloats] = useState<FloatNum[]>([])
  const [combo, setCombo] = useState(0)
  const lastClick = useRef(0)
  const comboDecay = useRef<ReturnType<typeof setTimeout>>(undefined)

  const handleTrain = useCallback(() => {
    if (tier === 'observer') {
      onTrain() // triggers the joining flow
      return
    }

    const now = Date.now()
    const streak = now - lastClick.current < COMBO_WINDOW ? Math.min(combo + 1, COMBO_MAX) : 1
    lastClick.current = now
    setCombo(streak)
    clearTimeout(comboDecay.current)
    comboDecay.current = setTimeout(() => setCombo(0), COMBO_WINDOW + 200)

    const heat = streak / COMBO_MAX // 0..1

    // haptics on supporting devices
    navigator.vibrate?.(8 + Math.round(heat * 12))
    playThunk(streak)

    setPressing(true)
    setTimeout(() => setPressing(false), 90)

    const id = now
    setRipples(prev => [...prev, id])
    setTimeout(() => setRipples(prev => prev.filter(r => r !== id)), 600)

    // floating "+N" — flies up from the orb, drifts slightly off-center
    setFloats(prev => [...prev, { id, value: multiplier, dx: (Math.random() - 0.5) * 36 }])
    setTimeout(() => setFloats(prev => prev.filter(f => f.id !== id)), 750)

    // data bits — more of them, flung further, as the streak heats up
    const count = 8 + Math.round(heat * 10)
    const dist = 50 + Math.random() * 20 + heat * 40
    const newParticles: Particle[] = Array.from({ length: count }, (_, i) => {
      const angle = ((360 / count) * i + Math.random() * 20 - 10) * (Math.PI / 180)
      return {
        id: id + i,
        dx: Math.cos(angle) * dist,
        dy: Math.sin(angle) * dist,
        size: 3 + Math.random() * 4,
        color: Math.random() < 0.35 ? 'var(--gold-bright)' : 'var(--teal)',
      }
    })
    setParticles(prev => [...prev, ...newParticles])
    setTimeout(() => setParticles(prev => prev.filter(p => !newParticles.some(np => np.id === p.id))), 600)

    onTrain()
  }, [onTrain, tier, multiplier, combo])

  const buttonLabel = tier === 'observer' ? 'JOIN' : `TRAIN +${multiplier}`
  const heat = combo / COMBO_MAX

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
        {floats.map(f => (
          <div key={f.id} style={{
            position: 'absolute', left: '50%', top: '50%',
            transform: 'translate(-50%, -50%)',
            pointerEvents: 'none', zIndex: 30,
            fontFamily: 'var(--font-mono)', fontWeight: 600,
            fontSize: 18, color: 'var(--teal-bright)',
            textShadow: '0 0 10px rgba(180,240,78,0.7)',
            opacity: 0,
            animation: 'floatUp 0.75s ease-out forwards',
            '--fdx': `${f.dx}px`,
          } as React.CSSProperties}>
            +{f.value}
          </div>
        ))}

        {particles.map(p => (
          <div key={p.id} style={{
            position: 'absolute', left: '50%', top: '50%', width: p.size, height: p.size,
            borderRadius: 1, background: p.color,
            boxShadow: `0 0 6px ${p.color}`,
            pointerEvents: 'none', zIndex: 20,
            opacity: 0,
            animation: 'particleFade 0.6s ease-out forwards',
            '--dx': `${p.dx}px`, '--dy': `${p.dy}px`,
          } as React.CSSProperties} />
        ))}

        {ripples.map(id => (
          <div key={id} style={{
            position: 'absolute', inset: -8,
            borderRadius: 4, border: '1px solid var(--teal)',
            animation: 'ripple 0.6s ease-out forwards',
            pointerEvents: 'none',
          }} />
        ))}

        <button
          onClick={handleTrain}
          className="train-orb"
          style={{
            width: 124, height: 124, borderRadius: 6,
            background: 'linear-gradient(180deg, #0d1812, #070d0a 60%, #040805)',
            border: tier === 'observer'
              ? '1px solid rgba(255, 180, 84, 0.6)'
              : '1px solid rgba(180, 240, 78, 0.55)',
            cursor: 'pointer',
            // trainPulse animates box-shadow, so heat rides on filter instead
            // (brighter + a hotter phosphor halo as the streak builds).
            boxShadow: '0 0 0 1px rgba(0,0,0,0.7), 0 12px 30px -10px rgba(0,0,0,0.85), 0 0 26px rgba(180,240,78,0.22), inset 0 1px 0 rgba(255,255,255,0.08), inset 0 -10px 18px rgba(0,0,0,0.6)',
            filter: `brightness(${1 + heat * 0.35}) drop-shadow(0 0 ${heat * 22}px rgba(180,240,78,${heat * 0.8}))`,
            transition: pressing
              ? 'transform 0.06s ease-out, filter 0.12s ease-out'
              : 'transform 0.32s cubic-bezier(0.34, 1.7, 0.5, 1), filter 0.4s ease-out', // springy overshoot on release
            transform: pressing ? 'translateY(3px) scale(0.96)' : 'translateY(0) scale(1)',
            touchAction: 'manipulation',
            WebkitTapHighlightColor: 'transparent',
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4,
            fontFamily: 'var(--font-display)', fontSize: 23, fontWeight: 400,
            letterSpacing: 2, color: tier === 'observer' ? 'var(--gold-bright)' : 'var(--teal-bright)',
            textShadow: '0 0 14px rgba(180,240,78,0.5)',
            animation: 'trainPulse 3.4s ease-in-out infinite',
          }}
        >
          {buttonLabel}
          <span style={{
            fontFamily: 'var(--font-mono)', fontSize: 8, fontWeight: 500,
            letterSpacing: 2.5, color: 'var(--text-dim)', textShadow: 'none',
          }}>
            {tier === 'observer' ? 'COME ONLINE' : 'GRADIENT STEP'}
          </span>
        </button>
      </div>

      {tier !== 'observer' && (
        <span className="mono" style={{ fontSize: 16, color: 'var(--gold-bright)', textShadow: '0 0 12px rgba(255,180,84,0.4)' }}>
          {personalSteps.toLocaleString()}
        </span>
      )}

      {combo >= 5 && (
        <span className="mono" style={{
          fontSize: 13, color: 'var(--teal-bright)',
          textShadow: `0 0 ${6 + heat * 12}px rgba(180,240,78,0.8)`,
          letterSpacing: 1,
        }}>
          ×{combo} streak
        </span>
      )}

      {rateLimited && (
        <span style={{
          fontSize: 11, color: 'var(--crimson)', fontFamily: 'var(--font-sans)',
          animation: 'fadeInOut 2s ease-out forwards',
        }}>
          The pipeline saturates — slow down.
        </span>
      )}

      <style>{`
        @keyframes ripple {
          0% { transform: scale(1); opacity: 0.55; }
          100% { transform: scale(1.6); opacity: 0; }
        }
        @keyframes particleFade {
          0% { transform: translate(0, 0) scale(1); opacity: 1; }
          100% { transform: translate(var(--dx), var(--dy)) scale(0.3); opacity: 0; }
        }
        @keyframes floatUp {
          0% { transform: translate(calc(-50% + 0px), -50%) scale(0.7); opacity: 0; }
          25% { opacity: 1; }
          100% { transform: translate(calc(-50% + var(--fdx)), calc(-50% - 64px)) scale(1.15); opacity: 0; }
        }
        @keyframes fadeInOut {
          0% { opacity: 1; }
          70% { opacity: 1; }
          100% { opacity: 0; }
        }
        @keyframes trainPulse {
          0%, 100% { box-shadow: 0 0 0 1px rgba(0,0,0,0.7), 0 12px 30px -10px rgba(0,0,0,0.85), 0 0 26px rgba(180,240,78,0.22), inset 0 1px 0 rgba(255,255,255,0.08), inset 0 -10px 18px rgba(0,0,0,0.6); }
          50% { box-shadow: 0 0 0 1px rgba(0,0,0,0.7), 0 12px 30px -10px rgba(0,0,0,0.85), 0 0 40px rgba(180,240,78,0.4), inset 0 1px 0 rgba(255,255,255,0.08), inset 0 -10px 18px rgba(0,0,0,0.6); }
        }
        @media (prefers-reduced-motion: reduce) {
          .train-orb { animation: none !important; }
        }
      `}</style>
    </div>
  )
}
