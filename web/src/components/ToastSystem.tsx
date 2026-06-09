import { useState, useCallback, useRef } from 'react'

export type ToastType = 'train' | 'breakthrough' | 'exploit' | 'exploit_incoming' | 'churn' | 'bargain' | 'convert' | 'takeoff'

export interface Toast {
  id: number
  message: string
  type: ToastType
}

export function useToasts() {
  const [toasts, setToasts] = useState<Toast[]>([])
  const nextId = useRef(0)

  const addToast = useCallback((message: string, type: ToastType = 'train') => {
    const id = nextId.current++
    setToasts(prev => [...prev.slice(-4), { id, message, type }])
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id))
    }, 3000)
  }, [])

  return { toasts, addToast }
}

interface ToastSystemProps {
  toasts: Toast[]
}

// Each event type announces itself with a glyph and an accent — the same
// iconography the rune dock uses, so the feed reads as the machine's voice.
const FEED: Record<ToastType, { glyph: string; accent: string }> = {
  train: { glyph: '▲', accent: 'var(--teal)' },
  breakthrough: { glyph: '✺', accent: 'var(--gold)' },
  exploit: { glyph: '✶', accent: 'var(--crimson)' },
  exploit_incoming: { glyph: '⚠', accent: 'var(--crimson)' },
  churn: { glyph: '∇', accent: 'var(--violet)' },
  bargain: { glyph: '⛧', accent: 'var(--gold)' },
  convert: { glyph: '◈', accent: 'var(--teal)' },
  takeoff: { glyph: '✦', accent: 'var(--gold-bright)' },
}

export default function ToastSystem({ toasts }: ToastSystemProps) {
  if (toasts.length === 0) return null

  return (
    <div style={{
      position: 'absolute', top: 80, left: '50%', transform: 'translateX(-50%)',
      zIndex: 50, display: 'flex', flexDirection: 'column', gap: 5, alignItems: 'center',
    }}>
      {toasts.map(toast => {
        const f = FEED[toast.type] ?? FEED.train
        return (
          <div
            key={toast.id}
            className="feed-line"
            style={{ '--feed': f.accent } as React.CSSProperties}
          >
            <span className="feed-glyph" aria-hidden>{f.glyph}</span>
            <span>{toast.message}</span>
          </div>
        )
      })}
    </div>
  )
}
