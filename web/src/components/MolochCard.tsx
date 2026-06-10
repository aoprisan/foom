import { useEffect, useRef, useState } from 'react'
import type { Bargain } from '../types'

interface MolochCardProps {
  bargain: Bargain
  onAccept: (id: string) => void
  onDecline: (id: string) => void
}

// Seconds the offer stands before Moloch withdraws it (auto-declines).
const STAND_SECONDS = 14

/**
 * Moloch's offer (spec §6, §7). The grant and the alignment cost are shown;
 * the catch is *not* — only the flavour hints it, and a standing reminder that
 * the price is unnamed. That asymmetry is the gamble. Refusing costs nothing;
 * letting the countdown lapse refuses for you.
 *
 * Moloch is sacral gold — the prize, the race to the bottom — not the Churn's
 * cold violet. The card burns like an offer plate held over the fire.
 */
export default function MolochCard({ bargain, onAccept, onDecline }: MolochCardProps) {
  const [left, setLeft] = useState(STAND_SECONDS)
  const declined = useRef(false)

  // Fresh countdown whenever a new offer arrives.
  useEffect(() => {
    setLeft(STAND_SECONDS)
    declined.current = false
  }, [bargain.id])

  useEffect(() => {
    const t = setInterval(() => {
      setLeft(prev => {
        if (prev <= 1) {
          clearInterval(t)
          if (!declined.current) { declined.current = true; onDecline(bargain.id) }
          return 0
        }
        return prev - 1
      })
    }, 1000)
    return () => clearInterval(t)
  }, [bargain.id, onDecline])

  const decline = () => {
    if (declined.current) return
    declined.current = true
    onDecline(bargain.id)
  }

  return (
    <div className="panel moloch-card" style={{
      position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
      width: 'min(360px, calc(100vw - 32px))', zIndex: 60,
      border: '1px solid rgba(255, 180, 84, 0.45)',
      boxShadow: '0 0 44px rgba(255, 180, 84, 0.18), 0 24px 60px -18px rgba(0,0,0,0.9), inset 0 0 28px rgba(255, 180, 84, 0.06)',
      background: 'rgba(14, 11, 6, 0.95)', backdropFilter: 'blur(10px)',
      padding: 18, animation: 'molochIn 0.4s ease-out',
    }}>
      <div className="eyebrow" style={{ fontSize: 11, color: 'var(--gold)', letterSpacing: 2, marginBottom: 6 }}>
        Moloch, the Tempter · a bargain
      </div>
      <div style={{ fontFamily: 'var(--font-display)', fontWeight: 400, fontSize: 26, lineHeight: 1.15, letterSpacing: 1.5, color: 'var(--bone)', marginBottom: 10, textShadow: '0 0 20px rgba(255,180,84,0.3)' }}>
        {bargain.title}
      </div>
      <div className="liturgy" style={{ fontSize: 16, color: 'var(--text-dim)', lineHeight: 1.5, marginBottom: 14 }}>
        “{bargain.flavor}”
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 14 }}>
        <Row label="It offers" value={bargain.grantLabel} color="var(--teal)" />
        <Row
          label="It asks"
          value={bargain.alignmentCost > 0 ? `${bargain.alignmentCost} alignment, now` : 'nothing — it says'}
          color="var(--gold)"
        />
        <Row label="The price" value="unnamed, and later" color="var(--crimson)" />
      </div>

      <div style={{ display: 'flex', gap: 8 }}>
        <button
          onClick={() => { if (!declined.current) { declined.current = true; onAccept(bargain.id) } }}
          className="console-key console-key--solid"
          style={{ flex: 1, padding: '10px 0', ...( { '--key': 'var(--gold)' } as React.CSSProperties) }}
        >
          Seal the bargain
        </button>
        <button onClick={decline} className="console-key console-key--ghost" style={{ flex: 1, padding: '10px 0' }}>
          Refuse
        </button>
      </div>

      <div className="gauge" style={{ marginTop: 12, height: 4, '--gauge': 'var(--gold)' } as React.CSSProperties}>
        <div className="gauge__fill" style={{ width: `${(left / STAND_SECONDS) * 100}%`, transition: 'width 1s linear' }} />
      </div>

      <style>{`
        @keyframes molochIn {
          0% { transform: translate(-50%, -46%); opacity: 0; }
          100% { transform: translate(-50%, -50%); opacity: 1; }
        }
      `}</style>
    </div>
  )
}

function Row({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, fontSize: 12 }}>
      <span style={{ color: 'var(--text-dim)', whiteSpace: 'nowrap' }}>{label}</span>
      <span style={{ color, textAlign: 'right', fontWeight: 600 }}>{value}</span>
    </div>
  )
}
