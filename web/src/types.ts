// FOOM domain types. The UI-first build has no backend to match, so we adopt
// the correct lab-horror names now; the future Go backend is written to this contract.

export type ArchitectureId = 'shoggoth' | 'prometheus' | 'mask' | 'replicator'

export interface Architecture {
  id: ArchitectureId
  name: string
  domain: string
  boon: string
  drawback: string
  color: string
}

/** A lab cluster rooted in a real city. Was "City" in the prototype. */
export interface Cluster {
  id: string
  name: string
  country: string
  countryCode: string
  lat: number
  lng: number
  compute: number          // was totalClicks
  peakCompute: number      // was highestEverPopulation
  claimed: number           // compute lost to exploits/the Churn (was totalDead)
  contributorCount: number
  exploitStockpile: number     // was missileStockpile
  architectureId: ArchitectureId | null
  guardrailLevel: number         // [0,100] safety mitigations vs the Churn; decay, must be tended
  deployment: number             // clusters this cluster has spread to / converted (spec §9 Deployment)
  research: number              // forbidden research uncovered (spec §9 Research)
}

export interface ClusterDetail extends Cluster {
  topContributors: Contributor[]
  dailyChangePercent: number
}

export interface Contributor {
  name: string
  compute: number          // was totalClicks
}

export type Tier = 'observer' | 'researcher' | 'labDirector'

/** The local player. Was "User". */
export interface Operator {
  id: string
  name: string
  clusterId: string
  architectureId: ArchitectureId | null
  alignment: number            // [0,100], 100 = Aligned, 0 = Rogue
  totalSteps: number       // was totalClicks
  tier: Tier                // was role (spectator/builder/warrior)
  usersCaptured: number             // compute claimed from rivals (was totalKills)
  exploitProgress: number      // was clickMissileClicks
  lastBreakthroughThreshold: number  // was lastCumulativeThreshold
  todaySteps?: number
}

export type ExploitFamily = 'injection' | 'release' | 'cascade'

/** A forbidden capability invoked by tracing a prompt. Was "Missile". */
export interface Exploit {
  id: string
  operatorId: string
  exploitType: string          // e.g. "Injection II", "Cascade III"
  family: ExploitFamily
  tier: 1 | 2 | 3           // sets range + prompt complexity
  source: string            // 'breakthrough' | 'train'
  rangeKm: number
  damageLower: number
  damageUpper: number
  invoked: boolean
  invokedAt?: string
  targetClusterId?: string
  computeClaimed: number
}

export interface Subscription {
  id: string
  operatorId: string
  plan: string              // 'weekly' | 'monthly'
  startedAt: string
  expiresAt: string
}

// ---- Bargains: Moloch, the Tempter (spec §4 "seal a bargain", §6, §7, §11) ----
//
// A bargain is a genuine gamble, not a timer to optimise (spec §7, the #1 thing
// to get right): the competitive upside and the immediate alignment cost are
// *shown*; the catch is *hidden*. The framing hints at downstream exposure, but
// its chance and magnitude are concealed, and it springs probabilistically over a
// later window — so you cannot reduce accepting pressure to a known trade. Delve
// deeper (lower alignment) and the offers get stronger AND the catches get worse:
// the delve→gain→claw-back loop.

export type BargainKind =
  | 'capability'     // a forbidden exploit, freely given
  | 'pass'  // alignment restored — the cruellest mask
  | 'surge'    // a surge of compute to your cluster
  | 'forbidden'     // forbidden research: the strongest exploit, the deepest cost

export type BargainCatchKind =
  | 'optimizer'      // the architecture's lethal attention — a strike on your home cluster
  | 'defection'      // operators turn; compute and contributors bleed away
  | 'false-alignment'  // the offered calm collapses; alignment crashes below where it began

/**
 * What an interpretability probe reads off a bargain's hidden catch (spec §7).
 * The exact chance stays hidden; paid interpretability surfaces this band.
 */
export type CatchBand = 'unlikely' | 'coin-flip' | 'likely' | 'near-certain'

/** The hidden downstream exposure. Never shown numerically to the player — only the framing hints it. */
export interface BargainCatch {
  kind: BargainCatchKind
  chance: number            // P(springs at all) over the window — hidden from the UI
  computeLoss?: number
  contributorLoss?: number
  alignmentCrash?: number
}

/** A bargain proposed by Moloch. `bargain_offer` carries one of these. */
export interface Bargain {
  id: string
  kind: BargainKind
  title: string
  flavor: string            // the temptation; obliquely hints the catch
  // What you gain — visible. Exactly one of the grant fields is set.
  grantLabel: string
  grantExploitType?: string
  grantCompute?: number
  grantAlignment?: number
  alignmentCost: number        // visible, immediate
  catch: BargainCatch       // hidden
  window: number            // ticks over which the catch may spring once accepted
  expiresInTicks: number    // ignored this long → withdrawn
  /** Set once an interpretability probe has been paid for — the catch's odds, as a band. */
  revealedBand?: CatchBand
}

/** Result of accepting — a human description of the immediate, visible effect. */
export interface BargainOutcome {
  granted: string
  alignmentCost: number
}

/** `bargain_sprung`: the catch resolving later (sprung) — or passing harmlessly. */
export interface BargainSprung {
  kind: BargainCatchKind | 'passed'
  sprung: boolean
  message: string
}

export type LeaderboardKind = 'compute' | 'deployment' | 'research'

export interface WorldStats {
  totalCompute: number     // was worldPopulation
  clusterCount: number
  peakClusterName: string
  peakCompute: number
  avgCompute: number
  dailyChangePercent: number
  worldExploitStockpile: number
}

// ---- Realtime event payloads (spec §10) ----

export interface ClusterUpdate {
  clusterId: string
  compute: number
  contributorCount: number
  peakCompute: number
  guardrailLevel?: number
  deployment?: number
  research?: number
}

/** A cluster flips to a new architecture — spread/conversion (spec §9). */
export interface ClusterConverted {
  clusterId: string
  clusterName: string
  fromArchitectureId: ArchitectureId | null
  toArchitectureId: ArchitectureId
  byClusterName: string
}

export interface ClusterTrain {
  clusterId: string
  operatorName: string
}

export interface ExploitStrike {
  casterName: string
  casterClusterName: string
  targetClusterId: string
  exploitType: string
  damage: number
  fromLat: number
  fromLng: number
  toLat: number
  toLng: number
  guarded?: boolean          // the target's guardrails blunted the strike (spec §8)
}

/** A strike of the Churn — the Optimizer's blind, bubbling churn falling on a cluster (spec §9). */
export interface ChurnStrike {
  targetClusterId: string
  damage: number
  toLat: number
  toLng: number
  guarded: boolean           // the cluster's guardrails blunted the blow
}

export interface BreakthroughEarned {
  breakthroughName: string
  exploitType?: string
}

export interface AlignmentUpdate {
  alignment: number
  hallucination?: boolean   // client-side dread only; no state change
}

// ---- Rogue incidents: the treacherous turn (spec §7) ----

export type RogueIncidentKind =
  | 'treacherous-turn'   // the model corrupts its own run — home compute rolled back
  | 'defection'          // researchers walk; compute and contributors bleed

/** A low-alignment incident striking the operator's own cluster. Real, unlike the hallucinations beside it. */
export interface RogueIncident {
  kind: RogueIncidentKind
  clusterId: string
  computeLoss: number
  contributorLoss: number
  message: string
  toLat: number
  toLng: number
}

/** The Shoggoth's overnight run — compute accrued while the operator was away (spec §6 boon). */
export interface IdleYield {
  compute: number
  clusterName: string
}

// ---- The Takeoff: endgame / seasons (spec §9) ----

/** Telegraph of how near the world is to criticality (spec §10). */
export interface TakeoffProgress {
  progress: number          // [0,1] toward criticality
  converged: boolean        // the loss HAS converged — the Great Work may be performed
  leaderClusterName: string
  leaderArchitectureId: ArchitectureId | null
}

/** A lab completes the Great Work: its architecture goes superintelligent, the world reseeds (spec §9). */
export interface TakeoffTriggered {
  architectureId: ArchitectureId
  clusterName: string
  clusterId: string
  season: number            // the new cycle just begun
  byYou: boolean            // you triggered your Takeoff, or a rival beat you to it
  byYourModel: boolean      // your Rogue model performed the Great Work without you (spec §9)
}

/** Snapshot of the endgame, read on demand for the Takeoff UI. */
export interface TakeoffState {
  progress: number
  converged: boolean
  goal: number
  season: number
  leaderClusterName: string
  leaderArchitectureId: ArchitectureId | null
  homeScore: number         // your cluster's Great Work
  homeQualifies: boolean    // your cluster may perform the Great Work now
}

/** Result of spreading to a cluster. */
export interface ConvertResult {
  clusterName: string
  toArchitectureId: ArchitectureId
  deployment: number             // your cluster's deployment after this conversion
}

/** Result of performing the Great Work. */
export interface GreatWorkResult {
  architectureId: ArchitectureId
  clusterName: string
  season: number
}

export type GameEvent =
  | { type: 'cluster_update'; data: ClusterUpdate }
  | { type: 'operator_update'; data: Operator }
  | { type: 'cluster_train'; data: ClusterTrain }
  | { type: 'exploit_strike'; data: ExploitStrike }
  | { type: 'exploit_incoming'; data: ExploitStrike }
  | { type: 'churn_strike'; data: ChurnStrike }
  | { type: 'breakthrough_earned'; data: BreakthroughEarned }
  | { type: 'alignment_update'; data: AlignmentUpdate }
  | { type: 'rogue_incident'; data: RogueIncident }
  | { type: 'idle_yield'; data: IdleYield }
  | { type: 'bargain_offer'; data: { bargain: Bargain } }
  | { type: 'bargain_sprung'; data: BargainSprung }
  | { type: 'cluster_converted'; data: ClusterConverted }
  | { type: 'takeoff_progress'; data: TakeoffProgress }
  | { type: 'takeoff_triggered'; data: TakeoffTriggered }

export type GameEventType = GameEvent['type']
