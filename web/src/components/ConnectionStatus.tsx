import type { ConnectionState } from '../hooks/useGameClient'

interface ConnectionStatusProps {
  state: ConnectionState
}

export default function ConnectionStatus({ state }: ConnectionStatusProps) {
  if (state === 'connected') return null

  const isConnecting = state === 'connecting'

  return (
    <div style={{
      position: 'absolute', bottom: 12, left: '50%', transform: 'translateX(-50%)',
      zIndex: 50, padding: '6px 16px', borderRadius: 0,
      background: isConnecting ? 'rgba(255, 180, 84, 0.12)' : 'rgba(255, 71, 87, 0.12)',
      border: `1px solid ${isConnecting ? 'rgba(255, 180, 84, 0.3)' : 'rgba(255, 71, 87, 0.3)'}`,
      backdropFilter: 'blur(8px)',
      fontSize: 12, fontFamily: 'var(--font-mono)',
      color: isConnecting ? 'var(--gold)' : 'var(--crimson)',
    }}>
      {isConnecting ? 'Reaching into the dark…' : 'The connection is severed'}
    </div>
  )
}
