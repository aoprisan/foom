import { useEffect, useRef, useState } from 'react'
import { game, ConnectionState } from '../client'
import type {
  ClusterUpdate, ClusterTrain, ExploitStrike, ChurnStrike, BreakthroughEarned, AlignmentUpdate,
  Bargain, BargainSprung, ClusterConverted, TakeoffProgress, TakeoffTriggered, Operator,
  RogueIncident, IdleYield,
} from '../types'

export type { ConnectionState }

export interface GameClientHandlers {
  onClusterUpdate?: (u: ClusterUpdate) => void
  onOperatorUpdate?: (o: Operator) => void
  onClusterTrain?: (c: ClusterTrain) => void
  onExploitStrike?: (s: ExploitStrike) => void
  onExploitIncoming?: (s: ExploitStrike) => void
  onChurn?: (s: ChurnStrike) => void
  onBreakthrough?: (r: BreakthroughEarned) => void
  onAlignment?: (s: AlignmentUpdate) => void
  onRogueIncident?: (i: RogueIncident) => void
  onIdleYield?: (y: IdleYield) => void
  onBargainOffer?: (b: Bargain) => void
  onBargainSprung?: (s: BargainSprung) => void
  onClusterConverted?: (c: ClusterConverted) => void
  onTakeoffProgress?: (a: TakeoffProgress) => void
  onTakeoffTriggered?: (a: TakeoffTriggered) => void
}

/**
 * Subscribes to the shared GameClient event stream and routes each event to the
 * matching callback. Replaces the old useWebSocket — same role, but the source
 * is the GameClient (mock today, live backend later).
 */
export function useGameClient(handlers: GameClientHandlers) {
  const [connectionState, setConnectionState] = useState<ConnectionState>(game.connectionState())
  const ref = useRef(handlers)
  ref.current = handlers

  useEffect(() => {
    const unsubscribe = game.on(e => {
      const h = ref.current
      switch (e.type) {
        case 'cluster_update': h.onClusterUpdate?.(e.data); break
        case 'operator_update': h.onOperatorUpdate?.(e.data); break
        case 'cluster_train': h.onClusterTrain?.(e.data); break
        case 'exploit_strike': h.onExploitStrike?.(e.data); break
        case 'exploit_incoming': h.onExploitIncoming?.(e.data); break
        case 'churn_strike': h.onChurn?.(e.data); break
        case 'breakthrough_earned': h.onBreakthrough?.(e.data); break
        case 'alignment_update': h.onAlignment?.(e.data); break
        case 'rogue_incident': h.onRogueIncident?.(e.data); break
        case 'idle_yield': h.onIdleYield?.(e.data); break
        case 'bargain_offer': h.onBargainOffer?.(e.data.bargain); break
        case 'bargain_sprung': h.onBargainSprung?.(e.data); break
        case 'cluster_converted': h.onClusterConverted?.(e.data); break
        case 'takeoff_progress': h.onTakeoffProgress?.(e.data); break
        case 'takeoff_triggered': h.onTakeoffTriggered?.(e.data); break
      }
    })
    setConnectionState(game.connectionState())
    return unsubscribe
  }, [])

  return { connectionState }
}
