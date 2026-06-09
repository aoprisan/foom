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
  onOptimisticChant: () => void,
) {
  const [pendingChants, setPendingChants] = useState(0)
  const serverChantsRef = useRef(0)
  const chantTimestamps = useRef<number[]>([])

  const [rateLimited, setRateLimited] = useState(false)
  const rateLimitTimer = useRef<ReturnType<typeof setTimeout>>(undefined)
  useEffect(() => () => clearTimeout(rateLimitTimer.current), [])

  const multiplier = operator?.tier === 'labDirector' ? 2 : 1

  const handleChant = useCallback(() => {
    if (!operator || operator.tier === 'observer') return

    const now = Date.now()
    chantTimestamps.current = chantTimestamps.current.filter(t => now - t < RATE_WINDOW)
    if (chantTimestamps.current.length >= RATE_LIMIT) {
      setRateLimited(true)
      clearTimeout(rateLimitTimer.current)
      rateLimitTimer.current = setTimeout(() => setRateLimited(false), 2000)
      return
    }
    chantTimestamps.current.push(now)

    setPendingChants(prev => prev + multiplier)
    onOptimisticChant()

    game.train()
  }, [operator, onOptimisticChant, multiplier])

  // Called when the world confirms our home cluster's compute via cluster_update.
  const reconcile = useCallback((serverTotal: number) => {
    const prevServer = serverChantsRef.current
    serverChantsRef.current = serverTotal
    if (prevServer === 0) return
    const confirmed = serverTotal - prevServer
    setPendingChants(prev => Math.max(0, prev - confirmed))
  }, [])

  const personalChants = (serverChantsRef.current || (operator?.totalSteps ?? 0)) + pendingChants

  return { handleChant, personalChants, pendingChants, rateLimited, multiplier, reconcile }
}

export type { Tier }
