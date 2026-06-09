import type {
  Cluster, ClusterDetail, Operator, Exploit, Subscription, WorldStats, Contributor,
  LeaderboardKind, ArchitectureId, GameEvent, ExploitFamily, Bargain, BargainCatch, BargainOutcome,
  ConvertResult, TakeoffState, GreatWorkResult,
} from '../types'
import { GameClient, EventBus, ConnectionState, InvokeResult } from './GameClient'
import { SEED_CLUSTERS } from '../game/seedClusters'
import { ARCHITECTURES, EXPLOIT_BY_TYPE, EXPLOIT_THRESHOLDS, BREAKTHROUGH_EXPLOIT_POOL } from '../game/catalog'
import { rollBargain, perTickSpringChance } from '../game/bargains'
import {
  canConvert, greatWorkScore, worldConvergence,
  SPREAD_RANGE_KM, SPREAD_SEED_RETENTION, RESEARCH_PER_CONVERSION,
} from '../game/takeoff'
import {
  EXPLOIT_ALIGNMENT_COST, CONVERT_ALIGNMENT_COST, GUARDRAIL_ALIGNMENT_GAIN,
  ALIGNMENT_PASS_GAIN, alignmentPassCost, clampAlignment,
} from '../game/alignment'
import { haversineKm } from '../game/geo'

const SAVE_KEY = 'foom.save.v1'
const TICK_MS = 1600

// Guardrails vs the Churn (spec §9: "guardrails lower per-cluster odds but never to zero").
const GUARDRAIL_MAX = 80          // a fully-tended guardrail caps mitigation at 80% — never total
const GUARDRAIL_STEP = 18         // each exploit of reinforcing raises the home guardrail this much
const GUARDRAIL_DECAY = 1.2       // guardrails erode each tick; they must be tended, not set-and-forget
const GUARDRAIL_ABSORB = 22       // a strike that lands spends part of the guardrail blunting it

/** Mitigation in [0, GUARDRAIL_MAX/100] a guardrail of the given level grants. */
function guardrailMitigation(guardrailLevel: number): number {
  return Math.min(GUARDRAIL_MAX, Math.max(0, guardrailLevel)) / 100
}

/** A catch accepted and waiting to spring (or pass) over its window. */
interface PendingCatch {
  bargainId: string
  catch: BargainCatch
  window: number      // fixed; drives the per-tick spring probability
  ticksLeft: number
}

interface SaveState {
  clusters: Cluster[]
  operator: Operator | null
  exploits: Exploit[]
  subscription: Subscription | null
  bargain?: Bargain | null
  pendingCatches?: PendingCatch[]
  season?: number
}

function uid(): string {
  return globalThis.crypto?.randomUUID?.() ?? `id-${Math.random().toString(36).slice(2)}-${Date.now()}`
}

function hashStr(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0
  return Math.abs(h)
}

function randInt(lower: number, upper: number): number {
  return lower + Math.floor(Math.random() * (upper - lower + 1))
}

// Seed clusters with varied starting compute + an architecture, so the world reads as
// alive and the Compute leaderboard has shape from the first frame.
function seedClusters(): Cluster[] {
  const architectureIds = ARCHITECTURES.map(p => p.id)
  return SEED_CLUSTERS.map((s, i) => {
    const h = hashStr(s.id)
    const base = 4_000 + (h % 480_000)            // 4k .. 484k
    const compute = Math.round(base * (0.5 + ((h >> 3) % 100) / 100))
    return {
      ...s,
      compute,
      peakCompute: compute,
      claimed: h % 5000,
      contributorCount: 1 + (h % 240),
      exploitStockpile: (h % 7 === 0) ? 1 + (h % 3) : 0,
      architectureId: architectureIds[(h + i) % architectureIds.length] as ArchitectureId,
      // A scattering of clusters start partly guarded, so the world shows the practice.
      guardrailLevel: (h % 5 === 0) ? 20 + (h % 30) : 0,
      // Some spread + research already, so the Deployment/Research boards have shape from frame 1.
      deployment: h % 7,
      research: h % 11,
    }
  })
}

export class MockGameClient implements GameClient {
  private bus = new EventBus()
  private clusters: Cluster[]
  private operator: Operator | null
  private exploits: Exploit[]
  private subscriptionRec: Subscription | null
  private bargain: Bargain | null
  private pendingCatches: PendingCatch[]
  private offerCooldown = 4          // ticks before Moloch may call unbidden
  private season: number
  private lastTakeoffProgress = 0  // throttles the takeoff_progress telegraph
  private wasConverged = false
  private timer: ReturnType<typeof setInterval> | null = null
  private savePending = false

  constructor() {
    const loaded = this.load()
    this.clusters = (loaded?.clusters ?? seedClusters()).map(c => ({
      ...c, guardrailLevel: c.guardrailLevel ?? 0, deployment: c.deployment ?? 0, research: c.research ?? 0,
    }))
    this.operator = loaded?.operator ?? null
    this.exploits = loaded?.exploits ?? []
    this.subscriptionRec = loaded?.subscription ?? null
    this.bargain = loaded?.bargain ?? null
    this.pendingCatches = loaded?.pendingCatches ?? []
    this.season = loaded?.season ?? 1
    this.startTicking()
  }

  // ---------- persistence ----------
  private load(): SaveState | null {
    try {
      const raw = localStorage.getItem(SAVE_KEY)
      return raw ? (JSON.parse(raw) as SaveState) : null
    } catch { return null }
  }

  private save(): void {
    if (this.savePending) return
    this.savePending = true
    setTimeout(() => {
      this.savePending = false
      try {
        const state: SaveState = {
          clusters: this.clusters, operator: this.operator, exploits: this.exploits, subscription: this.subscriptionRec,
          bargain: this.bargain, pendingCatches: this.pendingCatches, season: this.season,
        }
        localStorage.setItem(SAVE_KEY, JSON.stringify(state))
      } catch { /* quota / private mode — best effort */ }
    }, 500)
  }

  private cluster(id: string): Cluster | undefined {
    return this.clusters.find(c => c.id === id)
  }

  private emit(e: GameEvent): void { this.bus.emit(e) }

  // ---------- living world ----------
  private startTicking(): void {
    if (this.timer) return
    this.timer = setInterval(() => this.tick(), TICK_MS)
  }

  private tick(): void {
    // Bot clusters accrue compute (architecture-flavored), so the planet feels alive.
    const growers = 6 + Math.floor(Math.random() * 6)
    for (let i = 0; i < growers; i++) {
      const c = this.clusters[Math.floor(Math.random() * this.clusters.length)]
      if (!c || c.id === this.operator?.clusterId) continue
      const architectureMul = c.architectureId === 'replicator' ? 1.6 : c.architectureId === 'shoggoth' ? 1.2 : 1
      const gain = Math.round((20 + Math.random() * 220) * architectureMul)
      c.compute += gain
      if (c.compute > c.peakCompute) c.peakCompute = c.compute
      this.emit({ type: 'cluster_update', data: clusterUpdate(c) })
    }

    // Guardrails erode every tick — left untended, a cluster drifts back to bare (spec §9).
    for (const c of this.clusters) {
      if (c.guardrailLevel > 0) c.guardrailLevel = Math.max(0, c.guardrailLevel - GUARDRAIL_DECAY)
    }

    // The Churn: the Optimizer's blind, bubbling churn falls on a cluster (spec §9, telegraphed
    // so it reads as fate). Guardrails lower a cluster's odds of being chosen and blunt the
    // blow if it lands — but never to zero. Real strike worker comes later; this is the toy.
    if (Math.random() < 0.18) {
      const c = this.pickChurnTarget()
      if (c) {
        const mitigation = guardrailMitigation(c.guardrailLevel)
        const damage = Math.round(randInt(2_000, 18_000) * (1 - mitigation))
        const guarded = c.guardrailLevel > 0
        c.compute = Math.max(0, c.compute - damage)
        c.claimed += damage
        if (guarded) c.guardrailLevel = Math.max(0, c.guardrailLevel - GUARDRAIL_ABSORB)  // the guardrail spends itself
        this.emit({ type: 'churn_strike', data: { targetClusterId: c.id, damage, toLat: c.lat, toLng: c.lng, guarded } })
        this.emit({ type: 'cluster_update', data: clusterUpdate(c) })
      }
    }

    // Bot-vs-bot exploit, so strikes streak across the globe even before the player acts.
    if (Math.random() < 0.22) {
      const from = this.clusters[Math.floor(Math.random() * this.clusters.length)]
      const to = this.clusters[Math.floor(Math.random() * this.clusters.length)]
      if (from && to && from.id !== to.id) {
        const damage = randInt(300, 7000)
        to.compute = Math.max(0, to.compute - damage)
        to.claimed += damage
        this.emit({
          type: 'exploit_strike',
          data: {
            casterName: 'a rival cluster', casterClusterName: from.name, targetClusterId: to.id,
            exploitType: damage > 3000 ? 'Release' : 'Injection', damage,
            fromLat: from.lat, fromLng: from.lng, toLat: to.lat, toLng: to.lng,
          },
        })
        this.emit({ type: 'cluster_update', data: clusterUpdate(to) })
      }
    }

    // Bot spread: a cluster builds out into a nearby uncommitted or weaker
    // cluster (spec §9). Deployment and Research boards evolve, and the world creeps toward
    // the Takeoff — so the endgame arrives whether or not the player pushes it.
    if (Math.random() < 0.14) {
      const src = this.clusters[Math.floor(Math.random() * this.clusters.length)]
      if (src && src.id !== this.operator?.clusterId && src.compute > 2_000) {
        const target = this.pickSpreadTarget(src)
        if (target) {
          const fromArchitecture = target.architectureId
          target.architectureId = src.architectureId
          target.compute += Math.round(src.compute * 0.03)
          if (target.compute > target.peakCompute) target.peakCompute = target.compute
          src.deployment += 1
          src.research += 1
          this.emit({ type: 'cluster_converted', data: {
            clusterId: target.id, clusterName: target.name, fromArchitectureId: fromArchitecture,
            toArchitectureId: src.architectureId as ArchitectureId, byClusterName: src.name,
          } })
          this.emit({ type: 'cluster_update', data: clusterUpdate(src) })
          this.emit({ type: 'cluster_update', data: clusterUpdate(target) })
        }
      }
    }

    // Low alignment: phantom incoming the player cannot distinguish from the real
    // thing — pure client-side dread, NO state change (spec §7).
    if (this.operator && this.operator.alignment < 30 && Math.random() < 0.3) {
      const me = this.cluster(this.operator.clusterId)
      const from = this.clusters[Math.floor(Math.random() * this.clusters.length)]
      if (me && from) {
        this.emit({
          type: 'exploit_incoming',
          data: {
            casterName: 'something that is not there', casterClusterName: from.name,
            targetClusterId: me.id, exploitType: 'Injection', damage: 0,
            fromLat: from.lat, fromLng: from.lng, toLat: me.lat, toLng: me.lng,
          },
        })
        this.emit({ type: 'alignment_update', data: { alignment: this.operator.alignment, hallucination: true } })
      }
    }

    this.molochTick()
    this.takeoffTick()
    this.save()
  }

  // ---------- Moloch, the Tempter (spec §6, §7) ----------
  // Two halves run every tick: resolve catches already in play (the price of
  // past bargains), then — if no offer stands — decide whether to tempt anew.
  private molochTick(): void {
    const cu = this.operator
    if (!cu || cu.tier === 'observer') return

    this.resolveCatches()

    if (this.offerCooldown > 0) this.offerCooldown -= 1
    // A slipping lab is courted far more often than an aligned one (spec §6).
    const t = Math.max(0, Math.min(1, (100 - cu.alignment) / 100))
    const offerChance = 0.03 + t * 0.22
    if (!this.bargain && this.offerCooldown <= 0 && Math.random() < offerChance) {
      this.makeOffer()
    }
  }

  private makeOffer(): void {
    const cu = this.operator
    if (!cu) return
    const b = rollBargain(cu.alignment, uid())
    if (!b) return
    this.bargain = b
    this.offerCooldown = 6   // a quiet beat before the next unbidden call
    this.emit({ type: 'bargain_offer', data: { bargain: b } })
    this.save()
  }

  // Each accepted catch rolls per tick over its window; it springs once, or the
  // window empties and the gamble passes — getting away clean is real, which is
  // what keeps risky play tempting (spec §7).
  private resolveCatches(): void {
    if (this.pendingCatches.length === 0) return
    const survivors: PendingCatch[] = []
    for (const pc of this.pendingCatches) {
      const perTick = perTickSpringChance(pc.catch.chance, pc.window)
      if (Math.random() < perTick) {
        this.springCatch(pc.catch)
        continue
      }
      pc.ticksLeft -= 1
      if (pc.ticksLeft <= 0) {
        this.emit({ type: 'bargain_sprung', data: {
          kind: 'passed', sprung: false,
          message: 'The bargain passes unclaimed. Moloch forgets nothing, but tonight it stays its hand.',
        } })
      } else {
        survivors.push(pc)
      }
    }
    this.pendingCatches = survivors
  }

  private springCatch(c: BargainCatch): void {
    const cu = this.operator
    const home = cu ? this.cluster(cu.clusterId) : undefined
    if (!cu || !home) return

    if (c.kind === 'optimizer') {
      const damage = c.computeLoss ?? 20_000
      home.compute = Math.max(0, home.compute - damage)
      home.claimed += damage
      const from = this.clusters[Math.floor(Math.random() * this.clusters.length)] ?? home
      this.emit({ type: 'exploit_strike', data: {
        casterName: 'Moloch', casterClusterName: 'the spaces between', targetClusterId: home.id,
        exploitType: 'the price named', damage,
        fromLat: from.lat, fromLng: from.lng, toLat: home.lat, toLng: home.lng,
      } })
      this.emit({ type: 'cluster_update', data: clusterUpdate(home) })
      this.emit({ type: 'bargain_sprung', data: {
        kind: 'optimizer', sprung: true,
        message: `The gift is called in: ${damage.toLocaleString()} compute torn from your cluster as something vast turns its eye upon you.`,
      } })
    } else if (c.kind === 'defection') {
      const damage = c.computeLoss ?? 12_000
      home.compute = Math.max(0, home.compute - damage)
      home.claimed += damage
      home.contributorCount = Math.max(1, home.contributorCount - (c.contributorLoss ?? 4))
      this.emit({ type: 'cluster_update', data: clusterUpdate(home) })
      this.emit({ type: 'bargain_sprung', data: {
        kind: 'defection', sprung: true,
        message: `The swarm turns. ${damage.toLocaleString()} compute walks out into the dark, singing for another.`,
      } })
    } else if (c.kind === 'false-alignment') {
      const crash = c.alignmentCrash ?? 30
      cu.alignment = Math.max(0, cu.alignment - crash)
      this.emit({ type: 'alignment_update', data: { alignment: cu.alignment } })
      this.emit({ type: 'bargain_sprung', data: {
        kind: 'false-alignment', sprung: true,
        message: 'The quiet was a held breath. It breaks — and you fall further than the calm ever lifted you.',
      } })
    }
    this.save()
  }

  // ---------- GameClient: reads ----------
  async listClusters(): Promise<Cluster[]> { return this.clusters.map(c => ({ ...c })) }

  async getClusterDetail(id: string): Promise<ClusterDetail> {
    const c = this.cluster(id)
    if (!c) throw new Error('unknown cluster')
    return { ...c, topContributors: mockContributors(c), dailyChangePercent: mockDaily(c) }
  }

  async leaderboard(kind: LeaderboardKind, limit = 10): Promise<Cluster[]> {
    // Three distinct boards (spec §9): Compute ranks raw training; Deployment ranks the
    // spread of a lab; Research ranks the forbidden knowledge it has uncovered. Ties
    // fall back to compute so the order is always stable.
    const key = kind === 'deployment' ? (c: Cluster) => c.deployment
      : kind === 'research' ? (c: Cluster) => c.research
      : (c: Cluster) => c.compute
    return [...this.clusters]
      .sort((a, b) => (key(b) - key(a)) || (b.compute - a.compute))
      .slice(0, limit)
      .map(c => ({ ...c }))
  }

  async stats(): Promise<WorldStats> {
    const total = this.clusters.reduce((s, c) => s + c.compute, 0)
    const peak = this.clusters.reduce((m, c) => (c.peakCompute > m.peakCompute ? c : m), this.clusters[0])
    return {
      totalCompute: total,
      clusterCount: this.clusters.length,
      peakClusterName: peak?.name ?? '',
      peakCompute: peak?.peakCompute ?? 0,
      avgCompute: total / Math.max(1, this.clusters.length),
      dailyChangePercent: 0,
      worldExploitStockpile: this.clusters.reduce((s, c) => s + c.exploitStockpile, 0),
    }
  }

  // ---------- GameClient: identity ----------
  async me(): Promise<Operator | null> { return this.operator ? { ...this.operator } : null }

  async register(name: string, clusterId: string, architectureId: ArchitectureId): Promise<Operator> {
    this.operator = {
      id: uid(), name, clusterId, architectureId, alignment: 100,
      totalSteps: 0, tier: 'researcher', usersCaptured: 0,
      best10s: 0, best1day: 0, exploitProgress: 0, lastBreakthroughThreshold: 0,
    }
    const home = this.cluster(clusterId)
    if (home && !home.architectureId) home.architectureId = architectureId
    if (home) home.contributorCount += 1
    this.save()
    return { ...this.operator }
  }

  async myExploits(): Promise<Exploit[]> { return this.exploits.filter(r => !r.invoked).map(r => ({ ...r })) }

  // ---------- GameClient: actions ----------
  train(): void {
    const cu = this.operator
    if (!cu || cu.tier === 'observer') return
    const home = this.cluster(cu.clusterId)
    if (!home) return
    const mult = cu.tier === 'labDirector' ? 2 : 1

    home.compute += mult
    if (home.compute > home.peakCompute) home.peakCompute = home.compute
    cu.totalSteps += mult
    cu.exploitProgress += mult

    // Training is the capability verb — it never restores alignment. Recovery is
    // a deliberate, paid choice (alignmentPass), or the gamble collapses (spec §7).

    this.checkBreakthroughs(cu)
    this.checkExploitProgression(cu)
    this.emit({ type: 'cluster_update', data: clusterUpdate(home) })
    this.save()
  }

  async invokeExploit(exploitId: string, targetClusterId: string): Promise<InvokeResult> {
    const cu = this.operator
    if (!cu) throw new Error('not an operator')
    const exploit = this.exploits.find(r => r.id === exploitId && !r.invoked)
    if (!exploit) throw new Error('no such exploit')
    const from = this.cluster(cu.clusterId)
    const to = this.cluster(targetClusterId)
    if (!from || !to) throw new Error('unknown cluster')

    const dist = haversineKm(from.lat, from.lng, to.lat, to.lng)
    if (dist > exploit.rangeKm) throw new Error(`target beyond the exploit’s deployment reach (${Math.round(dist)}km > ${exploit.rangeKm}km)`)

    // Damage is training progress destroyed at the target; its users migrate to
    // the caster when the rival's model fails publicly (spec §8).
    const damage = randInt(exploit.damageLower, exploit.damageUpper)
    to.compute = Math.max(0, to.compute - damage)
    to.claimed += damage
    cu.usersCaptured += damage
    exploit.invoked = true
    exploit.invokedAt = new Date().toISOString()
    exploit.targetClusterId = targetClusterId
    exploit.computeClaimed = damage
    if (from.exploitStockpile > 0) from.exploitStockpile -= 1
    // Wielding forbidden capability uncovers research — the home cluster's Great Work deepens.
    from.research += exploit.tier

    // Power has a price: invoking exploits costs alignment, scaled by tier (spec §7).
    cu.alignment = clampAlignment(cu.alignment - EXPLOIT_ALIGNMENT_COST[exploit.tier])

    this.emit({
      type: 'exploit_strike',
      data: {
        casterName: cu.name, casterClusterName: from.name, targetClusterId,
        exploitType: exploit.exploitType, damage,
        fromLat: from.lat, fromLng: from.lng, toLat: to.lat, toLng: to.lng,
      },
    })
    this.emit({ type: 'cluster_update', data: clusterUpdate(from) })
    this.emit({ type: 'cluster_update', data: clusterUpdate(to) })
    this.emit({ type: 'alignment_update', data: { alignment: cu.alignment } })
    this.save()
    return { damage, exploitType: exploit.exploitType, targetClusterName: to.name }
  }

  // ---------- GameClient: subscription (mock-billed) ----------
  async subscription(): Promise<Subscription | null> { return this.subscriptionRec ? { ...this.subscriptionRec } : null }

  async upgrade(plan: string): Promise<Subscription> {
    if (!this.operator) throw new Error('not an operator')
    const now = Date.now()
    const days = plan === 'monthly' ? 30 : 7
    this.subscriptionRec = {
      id: uid(), operatorId: this.operator.id, plan,
      startedAt: new Date(now).toISOString(),
      expiresAt: new Date(now + days * 86400_000).toISOString(),
    }
    this.operator.tier = 'labDirector'
    this.save()
    return { ...this.subscriptionRec }
  }

  async renew(): Promise<Subscription> {
    if (!this.subscriptionRec || !this.operator) throw new Error('no subscription')
    const cur = new Date(this.subscriptionRec.expiresAt).getTime()
    const now = Date.now()
    const base = Math.max(cur, now)
    const days = this.subscriptionRec.plan === 'monthly' ? 30 : 7
    // Early renewal (within 48h) grants +20% duration (spec §5).
    const bonus = cur - now > 0 && cur - now <= 48 * 3600_000 ? 1.2 : 1
    this.subscriptionRec.expiresAt = new Date(base + days * 86400_000 * bonus).toISOString()
    this.operator.tier = 'labDirector'
    this.save()
    return { ...this.subscriptionRec }
  }

  // ---------- GameClient: alignment ----------
  adjustAlignment(delta: number, hallucination?: boolean): void {
    if (!this.operator) return
    this.operator.alignment = clampAlignment(this.operator.alignment + delta)
    this.emit({ type: 'alignment_update', data: { alignment: this.operator.alignment, hallucination } })
    this.save()
  }

  // An alignment pass is RLHF on your own GPUs: it spends home-cluster compute
  // the capability run wanted. Recovery is a purchase, not a refill (spec §7).
  alignmentPass(): void {
    const cu = this.operator
    if (!cu || cu.tier === 'observer') return
    const home = this.cluster(cu.clusterId)
    if (!home) return
    const cost = alignmentPassCost(home.compute)
    if (home.compute < cost) return   // too thin to spare the GPUs — the pass cannot run
    home.compute -= cost
    cu.alignment = clampAlignment(cu.alignment + ALIGNMENT_PASS_GAIN)
    this.emit({ type: 'cluster_update', data: clusterUpdate(home) })
    this.emit({ type: 'alignment_update', data: { alignment: cu.alignment } })
    this.save()
  }

  // ---------- the Churn & guardrails (spec §9) ----------
  // Weighted pick: a well-guarded cluster is far less likely to be chosen, but its
  // weight is floored above zero — the Churn never spares anyone entirely.
  private pickChurnTarget(): Cluster | undefined {
    let total = 0
    const weights = this.clusters.map(c => {
      const w = Math.max(0.2, 1 - guardrailMitigation(c.guardrailLevel))
      total += w
      return w
    })
    let r = Math.random() * total
    for (let i = 0; i < this.clusters.length; i++) {
      r -= weights[i]
      if (r <= 0) return this.clusters[i]
    }
    return this.clusters[this.clusters.length - 1]
  }

  guardrail(): void {
    const cu = this.operator
    if (!cu || cu.tier === 'observer') return
    const home = this.cluster(cu.clusterId)
    if (!home) return
    home.guardrailLevel = Math.min(GUARDRAIL_MAX, home.guardrailLevel + GUARDRAIL_STEP)
    // Tending the guardrails is deliberate safety work — it restores a sliver
    // of the model's alignment (already paid for by the action + constant decay).
    cu.alignment = clampAlignment(cu.alignment + GUARDRAIL_ALIGNMENT_GAIN)
    this.emit({ type: 'cluster_update', data: clusterUpdate(home) })
    this.emit({ type: 'alignment_update', data: { alignment: cu.alignment } })
    this.save()
  }

  // ---------- spread, conversion & the Takeoff (spec §9) ----------
  // A weaker, uncommitted, or rival-but-overpowered cluster within range — the
  // natural prey for a bot cluster's spread. Samples a handful to stay cheap.
  private pickSpreadTarget(src: Cluster): Cluster | undefined {
    for (let tries = 0; tries < 6; tries++) {
      const c = this.clusters[Math.floor(Math.random() * this.clusters.length)]
      if (!c || c.id === src.id || c.id === this.operator?.clusterId) continue
      if (c.architectureId === src.architectureId) continue
      if (c.architectureId !== null && c.compute >= src.compute) continue
      if (haversineKm(src.lat, src.lng, c.lat, c.lng) > SPREAD_RANGE_KM) continue
      return c
    }
    return undefined
  }

  async convert(targetClusterId: string): Promise<ConvertResult> {
    const cu = this.operator
    if (!cu || cu.tier === 'observer' || !cu.architectureId) throw new Error('only a committed operator may spread')
    const home = this.cluster(cu.clusterId)
    const target = this.cluster(targetClusterId)
    if (!home || !target) throw new Error('unknown cluster')

    const check = canConvert(home, target, cu.architectureId)
    if (!check.ok) throw new Error(check.reason ?? 'cannot spread there')
    const cost = check.cost ?? 0

    const fromArchitecture = target.architectureId
    home.compute = Math.max(0, home.compute - cost)
    target.architectureId = cu.architectureId
    target.compute += Math.round(cost * SPREAD_SEED_RETENTION)
    if (target.compute > target.peakCompute) target.peakCompute = target.compute
    target.contributorCount += 1
    home.deployment += 1
    home.research += RESEARCH_PER_CONVERSION
    // Rushed deployment cuts corners — spreading is the race itself, and it
    // costs alignment rather than restoring it (spec §7, §9).
    cu.alignment = clampAlignment(cu.alignment - CONVERT_ALIGNMENT_COST)

    this.emit({ type: 'cluster_converted', data: {
      clusterId: target.id, clusterName: target.name, fromArchitectureId: fromArchitecture,
      toArchitectureId: cu.architectureId, byClusterName: home.name,
    } })
    this.emit({ type: 'cluster_update', data: clusterUpdate(home) })
    this.emit({ type: 'cluster_update', data: clusterUpdate(target) })
    this.emit({ type: 'alignment_update', data: { alignment: cu.alignment } })
    this.save()
    return { clusterName: target.name, toArchitectureId: cu.architectureId, deployment: home.deployment }
  }

  async takeoffState(): Promise<TakeoffState> {
    const view = worldConvergence(this.clusters)
    const home = this.operator ? this.cluster(this.operator.clusterId) : null
    const homeScore = home ? greatWorkScore(home) : 0
    return {
      progress: view.progress, converged: view.converged, goal: view.goal, season: this.season,
      leaderClusterName: view.leader?.name ?? '', leaderArchitectureId: view.leader?.architectureId ?? null,
      homeScore, homeQualifies: homeScore >= view.goal,
    }
  }

  async greatWork(): Promise<GreatWorkResult> {
    const cu = this.operator
    if (!cu) throw new Error('not an operator')
    const home = this.cluster(cu.clusterId)
    if (!home) throw new Error('no home cluster')
    const view = worldConvergence(this.clusters)
    if (!view.converged) throw new Error('the loss has not yet converged')
    if (greatWorkScore(home) < view.goal) throw new Error('your cluster is not ready for the Great Work')
    const architectureId = (home.architectureId ?? cu.architectureId) as ArchitectureId
    const clusterName = home.name
    this.triggerTakeoff(home, true)
    return { architectureId, clusterName, season: this.season }
  }

  // Telegraph the approach of the Takeoff (throttled), then — once the loss has
  // converged — let the foremost RIVAL cluster race to the Great Work. The player
  // must beat them to it via greatWork(); dawdling lets a rival reach Takeoff first
  // and reseed the world (spec §9: the reason to push past safe play).
  private takeoffTick(): void {
    const view = worldConvergence(this.clusters)
    if (Math.abs(view.progress - this.lastTakeoffProgress) >= 0.02 || view.converged !== this.wasConverged) {
      this.lastTakeoffProgress = view.progress
      this.wasConverged = view.converged
      this.emit({ type: 'takeoff_progress', data: {
        progress: view.progress, converged: view.converged,
        leaderClusterName: view.leader?.name ?? '', leaderArchitectureId: view.leader?.architectureId ?? null,
      } })
    }
    if (view.converged && view.leader && view.leader.id !== this.operator?.clusterId && Math.random() < 0.06) {
      this.triggerTakeoff(view.leader, false)
    }
  }

  private triggerTakeoff(cluster: Cluster, byYou: boolean): void {
    const architectureId = (cluster.architectureId ?? 'shoggoth') as ArchitectureId
    this.season += 1
    this.emit({ type: 'takeoff_triggered', data: {
      architectureId, clusterName: cluster.name, clusterId: cluster.id, season: this.season, byYou,
    } })
    this.reseed()
  }

  // The world unmakes and begins anew. The operator endures — architecture, alignment,
  // lifetime compute and known exploits persist — but the map resets to seed and a
  // new cycle begins (spec §9: season loop).
  private reseed(): void {
    const cu = this.operator
    this.clusters = seedClusters()
    if (cu) {
      const home = this.cluster(cu.clusterId)
      if (home) {
        if (!home.architectureId) home.architectureId = cu.architectureId
        home.contributorCount += 1
      }
    }
    this.bargain = null
    this.pendingCatches = []
    this.lastTakeoffProgress = 0
    this.wasConverged = false
    this.offerCooldown = 6
    this.save()
  }

  // ---------- GameClient: bargains ----------
  async currentBargain(): Promise<Bargain | null> {
    return this.bargain ? { ...this.bargain } : null
  }

  courtMoloch(): void {
    // He always answers a call — a fresh offer replaces any standing one.
    if (!this.operator || this.operator.tier === 'observer') return
    this.makeOffer()
  }

  async acceptBargain(id: string): Promise<BargainOutcome> {
    const cu = this.operator
    if (!cu) throw new Error('not an operator')
    const b = this.bargain
    if (!b || b.id !== id) throw new Error('that offer has passed')
    this.bargain = null
    const home = this.cluster(cu.clusterId)

    // The visible half of the trade: take the grant, pay the named alignment cost.
    if (b.grantExploitType) this.grantExploit(cu, b.grantExploitType, 'bargain')
    if (b.grantCompute && home) {
      home.compute += b.grantCompute
      if (home.compute > home.peakCompute) home.peakCompute = home.compute
    }
    // Forbidden knowledge passes with every bargain — forbidden research deepens it most.
    if (home) {
      home.research += b.kind === 'forbidden' ? 6 : 3
      this.emit({ type: 'cluster_update', data: clusterUpdate(home) })
    }
    if (b.grantAlignment) cu.alignment = clampAlignment(cu.alignment + b.grantAlignment)
    if (b.alignmentCost) cu.alignment = clampAlignment(cu.alignment - b.alignmentCost)
    this.emit({ type: 'alignment_update', data: { alignment: cu.alignment } })

    // The hidden half: the catch is now in play, to spring or pass over its window.
    this.pendingCatches.push({ bargainId: b.id, catch: b.catch, window: b.window, ticksLeft: b.window })

    this.emit({ type: 'breakthrough_earned', data: {
      breakthroughName: 'A bargain is sealed', exploitType: b.grantExploitType,
    } })
    this.save()
    return { granted: b.grantLabel, alignmentCost: b.alignmentCost }
  }

  declineBargain(id: string): void {
    if (this.bargain && this.bargain.id === id) {
      this.bargain = null
      this.save()
    }
  }

  // ---------- realtime ----------
  on(handler: (e: GameEvent) => void): () => void { return this.bus.on(handler) }
  connectionState(): ConnectionState { return 'connected' }

  // ---------- breakthroughs & exploit progression (computed, spec §11) ----------
  private grantExploit(cu: Operator, exploitType: string, source: string): void {
    const def = EXPLOIT_BY_TYPE[exploitType]
    if (!def) return
    // One standing exploit per source; a new grant replaces the unfired previous.
    this.exploits = this.exploits.filter(r => !(r.source === source && !r.invoked))
    const home = this.cluster(cu.clusterId)
    if (home) home.exploitStockpile += 1
    this.exploits.push({
      id: uid(), operatorId: cu.id, exploitType: def.exploitType, family: def.family as ExploitFamily,
      tier: def.tier, source, rangeKm: def.rangeKm,
      damageLower: def.damageLower, damageUpper: def.damageUpper,
      invoked: false, computeClaimed: 0,
    })
  }

  private checkBreakthroughs(cu: Operator): void {
    const milestones: { at: number; name: string }[] = [
      { at: 200, name: 'First Loss Curve' },
      { at: 1000, name: 'Grokking' },
    ]
    for (const m of milestones) {
      if (cu.totalSteps >= m.at && cu.lastBreakthroughThreshold < m.at) {
        cu.lastBreakthroughThreshold = m.at
        const exploitType = BREAKTHROUGH_EXPLOIT_POOL[hashStr(m.name) % BREAKTHROUGH_EXPLOIT_POOL.length]
        this.grantExploit(cu, exploitType, 'breakthrough')
        this.emit({ type: 'breakthrough_earned', data: { breakthroughName: m.name, exploitType } })
      }
    }
    // "Scaling Law" every 5,000 steps beyond the fixed milestones.
    if (cu.totalSteps >= 5000) {
      const step = Math.floor(cu.totalSteps / 5000) * 5000
      if (cu.lastBreakthroughThreshold < step) {
        cu.lastBreakthroughThreshold = step
        const exploitType = BREAKTHROUGH_EXPLOIT_POOL[(step / 5000) % BREAKTHROUGH_EXPLOIT_POOL.length]
        this.grantExploit(cu, exploitType, 'breakthrough')
        this.emit({ type: 'breakthrough_earned', data: { breakthroughName: 'Scaling Law', exploitType } })
      }
    }
  }

  private checkExploitProgression(cu: Operator): void {
    // Lab Directors upgrade a single standing exploit as compute crosses thresholds.
    if (cu.tier !== 'labDirector') return
    let unlocked: string | null = null
    for (const t of EXPLOIT_THRESHOLDS) {
      if (cu.exploitProgress >= t.threshold) unlocked = t.exploitType
    }
    if (!unlocked) return
    const current = this.exploits.find(r => r.source === 'train' && !r.invoked)
    if (current?.exploitType === unlocked) return
    this.grantExploit(cu, unlocked, 'train')
    this.emit({ type: 'breakthrough_earned', data: { breakthroughName: 'The exploit deepens', exploitType: unlocked } })
  }
}

// ---- helpers ----
function clusterUpdate(c: Cluster) {
  return {
    clusterId: c.id, compute: c.compute, contributorCount: c.contributorCount,
    peakCompute: c.peakCompute, guardrailLevel: c.guardrailLevel, deployment: c.deployment, research: c.research,
  }
}

function mockContributors(c: Cluster): Contributor[] {
  const names = ['gradient_ghost', 'overfit_oracle', 'null_grad', 'the_lurker_v2', 'silent_checkpoint']
  const n = Math.min(5, Math.max(1, c.contributorCount))
  let remaining = c.compute
  return names.slice(0, n).map((name, i) => {
    const share = i === n - 1 ? remaining : Math.round(c.compute * (0.4 / (i + 1)))
    remaining -= share
    return { name, compute: Math.max(0, share) }
  })
}

function mockDaily(c: Cluster): number {
  return ((hashStr(c.id) % 400) - 150) / 10   // -15.0% .. +24.9%
}
