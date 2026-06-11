import { act, renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { useTrainHandler } from './useTrainHandler'
import type { Operator } from '../types'

const { train } = vi.hoisted(() => ({ train: vi.fn() }))

vi.mock('../client', () => ({
  game: { train },
}))

const operator: Operator = {
  id: 'op-1',
  name: 'tester',
  clusterId: 'cluster-1',
  architectureId: 'shoggoth',
  alignment: 100,
  totalSteps: 0,
  tier: 'researcher',
  usersCaptured: 0,
  exploitProgress: 0,
  lastBreakthroughThreshold: 0,
}

describe('useTrainHandler', () => {
  it('keeps personal compute separate from shared cluster compute', () => {
    const optimistic = vi.fn()
    const { result, rerender } = renderHook(
      ({ op }: { op: Operator }) => useTrainHandler(op, optimistic),
      { initialProps: { op: operator } },
    )

    act(() => result.current.handleTrain())

    expect(result.current.personalSteps).toBe(1)
    expect(optimistic).toHaveBeenCalledTimes(1)
    expect(train).toHaveBeenCalledTimes(1)

    act(() => result.current.reconcile(500_000))

    expect(result.current.personalSteps).toBe(1)

    rerender({ op: { ...operator, totalSteps: 1 } })

    expect(result.current.personalSteps).toBe(1)
  })
})
