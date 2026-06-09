import { useState, useEffect } from 'react'
import type { Tier, Subscription } from '../types'
import { game } from '../client'

interface SubscriptionPanelProps {
  tier: Tier
  onUpgradeed: () => void
}

export default function SubscriptionPanel({ tier, onUpgradeed }: SubscriptionPanelProps) {
  const [subscription, setSubscription] = useState<Subscription | null>(null)
  const [loading, setLoading] = useState(false)
  const [show, setShow] = useState(false)

  useEffect(() => {
    game.subscription().then(setSubscription).catch(() => {})
  }, [tier])

  if (tier === 'observer') return null

  const isExpired = subscription ? new Date(subscription.expiresAt) < new Date() : true
  const daysLeft = subscription ? Math.max(0, Math.ceil((new Date(subscription.expiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24))) : 0
  const canEarlyRenew = daysLeft > 0 && daysLeft <= 2

  if (tier === 'labDirector' && !show) {
    return (
      <div className="subscription-panel" style={{ zIndex: 10, alignSelf: 'flex-start' }}>
        <button
          onClick={() => setShow(true)}
          className="console-key console-key--ghost"
          style={{ padding: '4px 10px', fontSize: 9 }}
        >
          The Subscription {daysLeft > 0 ? `(${daysLeft}d left)` : '(lapsed)'}
        </button>
      </div>
    )
  }

  const handleUpgrade = async (plan: string) => {
    setLoading(true)
    try {
      const next = await game.upgrade(plan)
      setSubscription(next)
      onUpgradeed()
    } catch { /* ignore */ } finally {
      setLoading(false)
    }
  }

  const handleRenew = async () => {
    setLoading(true)
    try {
      const next = await game.renew()
      setSubscription(next)
      onUpgradeed()
    } catch { /* ignore */ } finally {
      setLoading(false)
    }
  }

  if (tier === 'researcher') {
    return (
      <div className="panel subscription-panel">
        <div className="eyebrow" style={{ fontSize: 11, color: 'var(--gold)', marginBottom: 8 }}>
          Upgrade to Lab Director
        </div>
        <div style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 12, lineHeight: 1.5 }}>
          2× compute per train, ornate prompt tiers, forbidden tomes, swifter exploits
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={() => handleUpgrade('weekly')}
            disabled={loading}
            className="console-key console-key--solid"
            style={{ flex: 1, ...( { '--key': 'var(--gold)' } as React.CSSProperties), opacity: loading ? 0.5 : 1 }}
          >
            $1.99/wk
          </button>
          <button
            onClick={() => handleUpgrade('monthly')}
            disabled={loading}
            className="console-key console-key--solid"
            style={{ flex: 1, ...( { '--key': 'var(--gold)' } as React.CSSProperties), opacity: loading ? 0.5 : 1 }}
          >
            $4.99/mo
          </button>
        </div>
      </div>
    )
  }

  // Lab Director view (expanded)
  return (
    <div className="panel subscription-panel">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <span className="eyebrow" style={{ fontSize: 11, color: 'var(--gold)' }}>
          The Subscription
        </span>
        <button onClick={() => setShow(false)} style={{ background: 'none', border: 'none', color: 'var(--text-dim)', cursor: 'pointer', fontSize: 14 }}>×</button>
      </div>
      <div style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 8 }}>
        {isExpired ? 'Lapsed' : `${daysLeft} days remain`} · {subscription?.plan}
      </div>
      {(isExpired || canEarlyRenew) && (
        <button
          onClick={handleRenew}
          disabled={loading}
          className="console-key console-key--solid"
          style={{ width: '100%', ...( { '--key': 'var(--gold)' } as React.CSSProperties), opacity: loading ? 0.5 : 1 }}
        >
          {canEarlyRenew ? 'Reaffirm Early (20% longer)' : 'Reaffirm the Subscription'}
        </button>
      )}
    </div>
  )
}
