import { useState, useCallback, useRef, useEffect } from 'react'
import { game } from '../client'
import type { Operator, Tier } from '../types'

const RATE_LIMIT = 100
const RATE_WINDOW = 60_000 // 60 seconds

/**
 * Train input with optimistic update + reconciliation. Reskin of the prototype's
 * useClickHandler — the optimistic/reconcile logic is preserved verbatim; only
 * the verb (click→train) and the multiplier source (role→tier) changed.
 */
export function useTrainHandler(
  operator: Operator | null,
  onOptimisticTrain: () => void,
) {
  const [pendingSteps, setPendingSteps] = useState(0)
  const trainTimestamps = useRef<number[]>([])

  const [rateLimited, setRateLimited] = useState(false)
  const rateLimitTimer = useRef<ReturnType<typeof setTimeout>>(undefined)
  useEffect(() => () => clearTimeout(rateLimitTimer.current), [])

  const multiplier = operator?.tier === 'labDirector' ? 2 : 1

  useEffect(() => {
    setPendingSteps(0)
  }, [operator?.id, operator?.totalSteps])

  const handleTrain = useCallback(() => {
    if (!operator || operator.tier === 'observer') return

    const now = Date.now()
    trainTimestamps.current = trainTimestamps.current.filter(t => now - t < RATE_WINDOW)
    if (trainTimestamps.current.length >= RATE_LIMIT) {
      setRateLimited(true)
      clearTimeout(rateLimitTimer.current)
      rateLimitTimer.current = setTimeout(() => setRateLimited(false), 2000)
      return
    }
    trainTimestamps.current.push(now)

    setPendingSteps(prev => prev + multiplier)
    onOptimisticTrain()

    game.train()
  }, [operator, onOptimisticTrain, multiplier])

  // Personal compute is confirmed by operator_update. Cluster compute is a shared
  // world value and can move because of bots, exploits, or the Churn, so it must
  // never be used as the player's personal total.
  const reconcile = useCallback((_serverTotal: number) => {}, [])

  const personalSteps = (operator?.totalSteps ?? 0) + pendingSteps

  return { handleTrain, personalSteps, pendingSteps, rateLimited, multiplier, reconcile }
}

export type { Tier }
