import type {
  Cluster, ClusterDetail, Operator, Exploit, Subscription, WorldStats,
  LeaderboardKind, ArchitectureId, GameEvent, Bargain, BargainOutcome,
  ConvertResult, TakeoffState, GreatWorkResult,
} from '../types'

export type ConnectionState = 'connecting' | 'connected' | 'disconnected'

export interface InvokeResult {
  damage: number
  exploitType: string
  targetClusterName: string
}

/**
 * The single seam between the UI and the world. Today only MockGameClient
 * exists (in-browser sim, no server). When the Go backend lands, a
 * LiveGameClient wrapping fetch + WebSocket implements this same interface and
 * the UI does not change. See src/client/index.ts for selection.
 */
export interface GameClient {
  // --- world reads ---
  listClusters(): Promise<Cluster[]>
  getClusterDetail(id: string): Promise<ClusterDetail>
  leaderboard(kind: LeaderboardKind, limit?: number): Promise<Cluster[]>
  stats(): Promise<WorldStats>

  // --- identity ---
  me(): Promise<Operator | null>
  register(name: string, clusterId: string, architectureId: ArchitectureId): Promise<Operator>
  myExploits(): Promise<Exploit[]>

  // --- actions ---
  train(): void                                  // emits cluster_update; never moves alignment (spec §7)
  invokeExploit(exploitId: string, targetClusterId: string): Promise<InvokeResult>

  // --- subscription (mock-billed) ---
  subscription(): Promise<Subscription | null>
  upgrade(plan: string): Promise<Subscription>            // Researcher -> Lab Director
  renew(): Promise<Subscription>

  // --- alignment (spec §7) ---
  /** Adjust the local operator's alignment; emits alignment_update. */
  adjustAlignment(delta: number, hallucination?: boolean): void
  /** Run an alignment pass (RLHF): spends home-cluster compute to claw alignment back. Emits alignment_update + cluster_update when it runs. */
  alignmentPass(): void

  // --- the Churn & guardrails (spec §9) ---
  /** Reinforce the home cluster's guardrails against the Churn. Emits cluster_update. */
  guardrail(): void

  // --- spread, conversion & the Takeoff (spec §9, build phase 6) ---
  /** Spread to a cluster: convert the uncommitted or flip a rival. Emits cluster_converted. */
  convert(targetClusterId: string): Promise<ConvertResult>
  /** The endgame snapshot — convergence, season, and your cluster's readiness. */
  takeoffState(): Promise<TakeoffState>
  /** Perform the Great Work — trigger your architecture's Takeoff and reseed the world. Throws unless ready. */
  greatWork(): Promise<GreatWorkResult>

  // --- bargains: Moloch, the Tempter (spec §6, §7) ---
  /** The standing offer, if one is open (for restoring across reloads). */
  currentBargain(): Promise<Bargain | null>
  /** Court Moloch deliberately — he always answers. Emits bargain_offer. */
  courtMoloch(): void
  /** Seal the bargain: take the grant + visible alignment cost; the hidden catch is now in play. */
  acceptBargain(id: string): Promise<BargainOutcome>
  /** Refuse the bargain; the offer is withdrawn, no cost. */
  declineBargain(id: string): void

  // --- realtime ---
  on(handler: (e: GameEvent) => void): () => void   // returns unsubscribe
  connectionState(): ConnectionState
}

/** Minimal synchronous pub/sub used by the mock client and event hooks. */
export class EventBus {
  private handlers = new Set<(e: GameEvent) => void>()

  on(handler: (e: GameEvent) => void): () => void {
    this.handlers.add(handler)
    return () => this.handlers.delete(handler)
  }

  emit(e: GameEvent): void {
    for (const h of this.handlers) {
      try { h(e) } catch { /* never let one listener break the loop */ }
    }
  }
}
