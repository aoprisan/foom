import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { MockGameClient } from './MockGameClient'
import { trainGain } from '../game/risk'
import { probeCost } from '../game/bargains'
import type { GameEvent } from '../types'

// Wiring tests: the pure modules are covered in src/game; these assert the sim
// actually routes through them — dividend-scaled training, the probe's spend,
// and the architecture metabolisms — via the public GameClient surface.

describe('MockGameClient wiring', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.useFakeTimers()   // hold the world tick still; these tests drive actions directly
  })

  afterEach(() => {
    vi.useRealTimers()
    localStorage.clear()
  })

  async function newOperator(architectureId: 'shoggoth' | 'prometheus' | 'mask' | 'replicator' = 'prometheus') {
    const client = new MockGameClient()
    const clusters = await client.listClusters()
    const operator = await client.register('tester', clusters[0].id, architectureId)
    return { client, operator, home: clusters[0] }
  }

  it('trains at the dividend-scaled gain after alignment falls', async () => {
    const { client } = await newOperator()
    client.train()
    let me = (await client.me())!
    expect(me.totalSteps).toBe(trainGain('researcher', 'prometheus', 100))   // 1

    client.adjustAlignment(-80)   // alignment 20 → Slipping → ×2
    client.train()
    me = (await client.me())!
    expect(me.totalSteps).toBe(1 + trainGain('researcher', 'prometheus', 20))
    expect(trainGain('researcher', 'prometheus', 20)).toBe(2)
  })

  it('reveals a standing bargain’s catch band for compute via probeBargain', async () => {
    const { client, operator } = await newOperator()
    client.courtMoloch()
    const offer = await client.currentBargain()
    expect(offer).not.toBeNull()
    expect(offer!.revealedBand).toBeUndefined()

    const homeBefore = (await client.listClusters()).find(c => c.id === operator.clusterId)!
    const probed = await client.probeBargain(offer!.id)
    expect(['unlikely', 'coin-flip', 'likely', 'near-certain']).toContain(probed.revealedBand)

    const homeAfter = (await client.listClusters()).find(c => c.id === operator.clusterId)!
    expect(homeAfter.compute).toBe(homeBefore.compute - probeCost(homeBefore.compute))

    // The reading persists on the standing offer and is not double-charged.
    const again = await client.probeBargain(offer!.id)
    expect(again.revealedBand).toBe(probed.revealedBand)
    const homeFinal = (await client.listClusters()).find(c => c.id === operator.clusterId)!
    expect(homeFinal.compute).toBe(homeAfter.compute)
  })

  it('refuses to probe an offer that has passed', async () => {
    const { client } = await newOperator()
    await expect(client.probeBargain('no-such-offer')).rejects.toThrow(/passed/)
  })

  it('emits rogue incidents only as real state changes (compute actually leaves)', async () => {
    const { client, operator } = await newOperator()
    client.adjustAlignment(-100)   // rogue — maximum incident chance

    const events: GameEvent[] = []
    client.on(e => events.push(e))

    // Drive ticks until an incident lands (chance ≈ 8.5%/tick at rogue).
    const before = (await client.listClusters()).find(c => c.id === operator.clusterId)!.compute
    for (let i = 0; i < 400 && !events.some(e => e.type === 'rogue_incident'); i++) {
      vi.advanceTimersByTime(1600)
    }
    const incident = events.find(e => e.type === 'rogue_incident')
    expect(incident).toBeDefined()
    if (incident?.type === 'rogue_incident') {
      expect(incident.data.computeLoss).toBeGreaterThan(0)
      expect(incident.data.clusterId).toBe(operator.clusterId)
    }
    const after = (await client.listClusters()).find(c => c.id === operator.clusterId)!.compute
    // The home cluster also pays the Churn/bot economy across these ticks, so we
    // only assert the incident's direction: compute is lower than it began.
    expect(after).toBeLessThan(before)
  })

  it('stops granting alignment once the guardrails are at cap — tending is no free grind', async () => {
    const { client } = await newOperator()
    client.adjustAlignment(-50)   // leave room on the meter to climb
    // Five tendings reach the cap (ticks are frozen, so nothing decays between them)…
    for (let i = 0; i < 6; i++) client.guardrail()
    const earned = (await client.me())!.alignment
    expect(earned).toBeGreaterThan(50)
    // …after which tending reinforces nothing and restores nothing.
    for (let i = 0; i < 10; i++) client.guardrail()
    expect((await client.me())!.alignment).toBe(earned)
  })

  it('pays the Shoggoth’s overnight run on reload', async () => {
    const { client, operator } = await newOperator('shoggoth')
    // Mature the run past one trickle step.
    for (let i = 0; i < 450; i++) client.train()
    // Flush the debounced save, then come back "tomorrow".
    vi.advanceTimersByTime(600)
    const computeAtSave = JSON.parse(localStorage.getItem('foom.save.v1')!)
      .clusters.find((c: { id: string }) => c.id === operator.clusterId).compute
    vi.setSystemTime(Date.now() + 4 * 3600_000)

    const reloaded = new MockGameClient()
    const home = (await reloaded.listClusters()).find(c => c.id === operator.clusterId)!
    expect(home.compute).toBeGreaterThan(computeAtSave)
  })
})
