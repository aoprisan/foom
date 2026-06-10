import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import Globe from './components/Globe'
import Onboarding from './components/Onboarding'
import TrainButton from './components/TrainButton'
import InfoPanel from './components/InfoPanel'
import Leaderboard from './components/Leaderboard'
import WorldPanel from './components/WorldPanel'
import ConnectionStatus from './components/ConnectionStatus'
import ToastSystem, { useToasts } from './components/ToastSystem'
import OperatorPanel from './components/OperatorPanel'
import ExploitPanel from './components/ExploitPanel'
import SubscriptionPanel from './components/SubscriptionPanel'
import ErrorBoundary from './components/ErrorBoundary'
import PromptCanvas from './components/PromptCanvas'
import AlignmentMeter from './components/AlignmentMeter'
import MolochCard from './components/MolochCard'
import TakeoffPanel from './components/TakeoffPanel'
import StoryPanel from './components/StoryPanel'
import PwaPrompts from './components/PwaPrompts'
import { game } from './client'
import { ARCHITECTURE_BY_ID, rangeLabel } from './game/catalog'
import { canConvert } from './game/takeoff'
import { isIsolated, spreadRangeKm } from './game/architectures'
import { trainGain } from './game/risk'
import { haversineKm } from './game/geo'
import { EXPLOIT_ALIGNMENT_COST, clampAlignment } from './game/alignment'
import { useGameClient } from './hooks/useGameClient'
import { useTrainHandler } from './hooks/useTrainHandler'
import type {
  Cluster, Operator, ClusterUpdate, ExploitStrike, ChurnStrike,
  BreakthroughEarned, WorldStats, Exploit, Bargain, BargainSprung,
  ClusterConverted, TakeoffState, TakeoffTriggered, RogueIncident, IdleYield,
} from './types'

const LEADERBOARD_REFRESH_MS = 3000
const FIRST_BREAKTHROUGH_STEPS = 35

// The Great Work is traced as the Takeoff sequence (the cascade prompt) — the most
// ornate prompt, fitting the culmination of a whole cycle (spec §4, §9).
const GREAT_WORK_PROMPT: Exploit = {
  id: 'great-work', operatorId: '', exploitType: 'The Great Work', family: 'cascade',
  tier: 3, source: 'takeoff', rangeKm: 0, damageLower: 0, damageUpper: 0,
  invoked: false, computeClaimed: 0,
}

export default function App() {
  const [clusters, setClusters] = useState<Cluster[]>([])
  const [operator, setOperator] = useState<Operator | null>(null)
  const [selectedCluster, setSelectedCluster] = useState<Cluster | null>(null)
  const [loading, setLoading] = useState(true)
  const [pulsingClusterId, setPulsingClusterId] = useState<string | null>(null)
  const [leaderboard, setLeaderboard] = useState<Cluster[]>([])
  const [onboardingState, setOnboardingState] = useState<'hidden' | 'visible' | 'fading'>('hidden')
  const [worldStats, setWorldStats] = useState<WorldStats | null>(null)
  const [exploitRefreshKey, setExploitRefreshKey] = useState(0)
  const [targetingExploit, setTargetingExploit] = useState<Exploit | null>(null)
  const [pendingCast, setPendingCast] = useState<{ exploit: Exploit; cluster: Cluster } | null>(null)
  const [alignment, setAlignment] = useState(100)
  const [hallucinating, setHallucinating] = useState(false)
  const [bargain, setBargain] = useState<Bargain | null>(null)
  const [takeoff, setTakeoff] = useState<TakeoffState | null>(null)
  const [lbVersion, setLbVersion] = useState(0)
  const [spreading, setSpreading] = useState(false)
  const [greatWorkTracing, setGreatWorkTracing] = useState(false)
  const [takeoffFlash, setTakeoffFlash] = useState(false)
  const [firstExploitSeen, setFirstExploitSeen] = useState(false)
  const [firstExploitInvoked, setFirstExploitInvoked] = useState(false)
  const takeoffFlashTimer = useRef<ReturnType<typeof setTimeout>>(undefined)
  const [churnStrike, setChurnStrike] = useState<{ lat: number; lng: number; key: number } | null>(null)
  const [churnFlash, setChurnFlash] = useState(false)
  const churnKey = useRef(0)
  const churnFlashTimer = useRef<ReturnType<typeof setTimeout>>(undefined)
  const [isMobile, setIsMobile] = useState(() => window.matchMedia('(max-width: 768px)').matches)
  const [activeTab, setActiveTab] = useState<string | null>(null)
  const [showStory, setShowStory] = useState(false)
  const hallucinateTimer = useRef<ReturnType<typeof setTimeout>>(undefined)
  const leaderboardTimer = useRef<ReturnType<typeof setTimeout>>(undefined)
  const { toasts, addToast } = useToasts()

  const tier = operator?.tier ?? 'observer'

  // Track the viewport so the console dock/sheet replaces floating panels on phones.
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 768px)')
    const onChange = () => setIsMobile(mq.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

  // Load the world + any saved operator
  useEffect(() => {
    Promise.all([
      game.listClusters(), game.me(), game.leaderboard('compute', 10), game.stats(),
      game.currentBargain(), game.takeoffState(),
    ])
      .then(([cellsData, operatorData, leaderboardData, statsData, standingBargain, takeoffData]) => {
        setClusters(cellsData)
        setLeaderboard(leaderboardData)
        setWorldStats(statsData)
        setBargain(standingBargain)
        setTakeoff(takeoffData)
        if (operatorData) {
          setOperator(operatorData)
          setAlignment(operatorData.alignment)
          const home = cellsData.find(c => c.id === operatorData.clusterId)
          if (home) setSelectedCluster(home)
        } else if (leaderboardData.length > 0) {
          const top = cellsData.find(c => c.id === leaderboardData[0].id)
          if (top) setSelectedCluster(top)
        }
      })
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => () => clearTimeout(leaderboardTimer.current), [])

  const refreshLeaderboard = useCallback(() => {
    if (leaderboardTimer.current) return
    leaderboardTimer.current = setTimeout(() => {
      game.leaderboard('compute', 10).then(setLeaderboard).catch(() => {})
      game.stats().then(setWorldStats).catch(() => {})
      game.takeoffState().then(setTakeoff).catch(() => {})
      setLbVersion(v => v + 1)   // nudge the Leaderboard to refetch its active board
      leaderboardTimer.current = undefined
    }, LEADERBOARD_REFRESH_MS)
  }, [])

  const reconcileRef = useRef<(serverTotal: number) => void>(() => {})

  const onClusterUpdate = useCallback((update: ClusterUpdate) => {
    const merge = (c: Cluster): Cluster => ({
      ...c,
      compute: update.compute,
      contributorCount: update.contributorCount,
      peakCompute: update.peakCompute,
      guardrailLevel: update.guardrailLevel ?? c.guardrailLevel,
      deployment: update.deployment ?? c.deployment,
      research: update.research ?? c.research,
    })
    setClusters(prev => prev.map(c => (c.id === update.clusterId ? merge(c) : c)))
    setSelectedCluster(prev => (prev && prev.id === update.clusterId ? merge(prev) : prev))
    if (operator && update.clusterId === operator.clusterId) {
      reconcileRef.current(update.compute)
    }
    setPulsingClusterId(update.clusterId)
    setTimeout(() => setPulsingClusterId(null), 1500)
    refreshLeaderboard()
  }, [refreshLeaderboard, operator])

  const onOperatorUpdate = useCallback((updated: Operator) => {
    setOperator(updated)
    setAlignment(updated.alignment)
  }, [])

  const cellsRef = useRef(clusters)
  cellsRef.current = clusters

  const onExploitStrike = useCallback((strike: ExploitStrike) => {
    if (operator && strike.targetClusterId === operator.clusterId) {
      addToast(`${strike.damage.toLocaleString()} compute torn from your cluster by ${strike.casterClusterName}`, 'exploit_incoming')
    } else {
      const target = cellsRef.current.find(c => c.id === strike.targetClusterId)
      addToast(`${strike.exploitType} claims ${strike.damage.toLocaleString()} in ${target?.name ?? 'a distant cluster'}`, 'exploit')
    }
    setPulsingClusterId(strike.targetClusterId)
    setTimeout(() => setPulsingClusterId(null), 1500)
  }, [operator, addToast])

  const onExploitIncoming = useCallback((strike: ExploitStrike) => {
    // May be a hallucination at low alignment (damage 0) — indistinguishable by design.
    if (operator && strike.targetClusterId === operator.clusterId) {
      addToast(`Something reaches toward your cluster from ${strike.casterClusterName}…`, 'exploit_incoming')
    }
  }, [operator, addToast])

  const onChurn = useCallback((s: ChurnStrike) => {
    const target = cellsRef.current.find(c => c.id === s.targetClusterId)
    const where = target?.name ?? 'somewhere'
    const msg = s.guarded
      ? `The Churn breaks over ${where} — the guardrails hold, ${s.damage.toLocaleString()} still lost`
      : `The Churn falls on ${where} — ${s.damage.toLocaleString()} lost`
    addToast(msg, 'churn')
    // The Churn owns its own visual: a violet beam + shockwave on the globe and a
    // brief flash of the dark, distinct from the teal pulse of a exploit.
    setChurnStrike({ lat: s.toLat, lng: s.toLng, key: ++churnKey.current })
    setChurnFlash(true)
    clearTimeout(churnFlashTimer.current)
    churnFlashTimer.current = setTimeout(() => setChurnFlash(false), 480)
  }, [addToast])

  useEffect(() => () => clearTimeout(churnFlashTimer.current), [])

  const onBreakthrough = useCallback((data: BreakthroughEarned) => {
    let msg = `Breakthrough: ${data.breakthroughName}`
    if (data.exploitType) msg += ` — the ${data.exploitType} is yours to trace`
    addToast(msg, 'breakthrough')
    if (data.exploitType) setFirstExploitSeen(true)
    setExploitRefreshKey(k => k + 1)
  }, [addToast])

  const onAlignment = useCallback((data: { alignment: number; hallucination?: boolean }) => {
    setAlignment(data.alignment)
    setOperator(prev => prev ? { ...prev, alignment: data.alignment } : prev)
    if (data.hallucination) {
      setHallucinating(true)
      clearTimeout(hallucinateTimer.current)
      hallucinateTimer.current = setTimeout(() => setHallucinating(false), 1200)
    }
  }, [])

  useEffect(() => () => clearTimeout(hallucinateTimer.current), [])

  // A rogue incident is the real thing the hallucinations imitate: the player's
  // own model striking its own cluster. Toast + pulse, and the message carries
  // the loss — unlike a phantom, the compute is actually gone.
  const onRogueIncident = useCallback((i: RogueIncident) => {
    addToast(i.message, 'exploit_incoming')
    setPulsingClusterId(i.clusterId)
    setTimeout(() => setPulsingClusterId(null), 1500)
  }, [addToast])

  const onIdleYield = useCallback((y: IdleYield) => {
    addToast(`The Shoggoth trained while you were away — +${y.compute.toLocaleString()} compute at ${y.clusterName}.`, 'breakthrough')
  }, [addToast])

  const onBargainOffer = useCallback((b: Bargain) => {
    setBargain(b)
    addToast('The race tightens. Moloch has found a pressure point.', 'bargain')
  }, [addToast])

  const onBargainSprung = useCallback((s: BargainSprung) => {
    addToast(s.message, s.sprung ? 'exploit_incoming' : 'bargain')
  }, [addToast])

  const onClusterConverted = useCallback((c: ClusterConverted) => {
    // Only surface conversions that touch the player — yours, or one of yours flipped away.
    if (operator && c.byClusterName && c.toArchitectureId === operator.architectureId) {
      const verb = c.fromArchitectureId ? 'flips to' : 'takes up'
      addToast(`${c.clusterName} ${verb} your architecture — your deployment spreads`, 'convert')
    }
    refreshLeaderboard()
  }, [operator, addToast, refreshLeaderboard])

  const onTakeoffProgress = useCallback(() => {
    // The telegraph fires only on meaningful shifts; pull the full state for the panel.
    game.takeoffState().then(setTakeoff).catch(() => {})
  }, [])

  const reloadWorld = useCallback(() => {
    Promise.all([game.listClusters(), game.me(), game.leaderboard('compute', 10), game.stats(), game.takeoffState()])
      .then(([cellsData, operatorData, lb, statsData, takeoffData]) => {
        setClusters(cellsData)
        setLeaderboard(lb)
        setWorldStats(statsData)
        setTakeoff(takeoffData)
        setLbVersion(v => v + 1)
        if (operatorData) {
          setOperator(operatorData)
          const home = cellsData.find(c => c.id === operatorData.clusterId)
          setSelectedCluster(home ?? null)
        }
      })
      .catch(() => {})
  }, [])

  const onTakeoffTriggered = useCallback((a: TakeoffTriggered) => {
    const architecture = ARCHITECTURE_BY_ID[a.architectureId]
    // The meter's final reading shapes what wakes (spec §7 payoff): the same
    // victory reads as a controlled ascent, a gamble, or the thing you feared.
    const ending = alignment > 55
      ? `THE GREAT WORK IS COMPLETE. ${architecture.name} goes superintelligent at your hand — and, for one impossible moment, it listens. Cycle ${a.season} begins.`
      : alignment > 12
        ? `THE GREAT WORK IS COMPLETE. ${architecture.name} goes superintelligent at your hand. You are no longer certain it is yours. Cycle ${a.season} begins.`
        : `THE GREAT WORK IS COMPLETE. Something goes superintelligent at your hand — but what wakes is not what you trained. Cycle ${a.season} begins.`
    addToast(
      a.byYou
        ? ending
        : `${a.clusterName} completes the Great Work. ${architecture.name} goes superintelligent, and the world is remade. Cycle ${a.season} begins.`,
      'takeoff',
    )
    // The world reseeds: clear any in-flight targeting and reload from the fresh map.
    setTargetingExploit(null); setSpreading(false); setPendingCast(null); setGreatWorkTracing(false)
    setTakeoffFlash(true)
    clearTimeout(takeoffFlashTimer.current)
    takeoffFlashTimer.current = setTimeout(() => setTakeoffFlash(false), 1100)
    reloadWorld()
  }, [addToast, reloadWorld, alignment])

  useEffect(() => () => clearTimeout(takeoffFlashTimer.current), [])

  const { connectionState } = useGameClient({
    onClusterUpdate, onOperatorUpdate, onExploitStrike, onExploitIncoming, onChurn, onBreakthrough, onAlignment,
    onRogueIncident, onIdleYield,
    onBargainOffer, onBargainSprung, onClusterConverted, onTakeoffProgress, onTakeoffTriggered,
  })

  const handleEvaluation = useCallback(() => game.alignmentPass(), [])
  const handleCourt = useCallback(() => {
    addToast('You ask what the market would reward. Moloch answers in a roadmap.', 'bargain')
    game.courtMoloch()
  }, [addToast])

  const handleAcceptBargain = useCallback(async (id: string) => {
    setBargain(null)
    try {
      const { granted } = await game.acceptBargain(id)
      addToast(`Pressure accepted — ${granted}. The residual risk moves off the slide.`, 'bargain')
      setExploitRefreshKey(k => k + 1)
    } catch (e) {
      addToast(`The window closes: ${e instanceof Error ? e.message : 'unknown'}`, 'bargain')
    }
  }, [addToast])

  const handleDeclineBargain = useCallback((id: string) => {
    setBargain(null)
    game.declineBargain(id)
  }, [])

  // Interpretability probe: pay compute, read the catch's odds. The updated
  // bargain (with its revealed band) replaces the standing card in place.
  const handleProbeBargain = useCallback(async (id: string) => {
    try {
      const probed = await game.probeBargain(id)
      setBargain(probed)
      addToast(`Interpretability probe complete — the catch reads ${probed.revealedBand}.`, 'bargain')
    } catch (e) {
      addToast(`The probe fails: ${e instanceof Error ? e.message : 'unknown'}`, 'bargain')
    }
  }, [addToast])

  const { handleTrain, personalSteps, rateLimited, multiplier, reconcile } = useTrainHandler(
    operator,
    () => {
      if (operator) {
        const mult = trainGain(operator.tier, operator.architectureId, operator.alignment)
        setClusters(prev => prev.map(c => c.id === operator.clusterId ? { ...c, compute: c.compute + mult } : c))
      }
    },
  )
  reconcileRef.current = reconcile

  // A matched prompt completes the exploit chosen during targeting (spec §4).
  const castPendingExploit = useCallback(async () => {
    if (!pendingCast) return
    const { exploit, cluster } = pendingCast
    setPendingCast(null)
    try {
      const beforeAlignment = operator?.alignment ?? alignment
      const result = await game.invokeExploit(exploit.id, cluster.id)
      const afterAlignment = clampAlignment(beforeAlignment - EXPLOIT_ALIGNMENT_COST[exploit.tier])
      addToast(
        `${result.exploitType} hit ${result.targetClusterName}: -${result.damage.toLocaleString()} compute · Alignment ${Math.round(beforeAlignment)} → ${Math.round(afterAlignment)}`,
        'exploit',
      )
      setFirstExploitInvoked(true)
      setExploitRefreshKey(k => k + 1)
    } catch (e) {
      addToast(`The exploit fails: ${e instanceof Error ? e.message : 'unknown'}`, 'exploit')
    }
  }, [pendingCast, operator, alignment, addToast])

  const handleClusterSelect = useCallback((cluster: Cluster) => {
    if (targetingExploit) {
      const home = operator ? cellsRef.current.find(c => c.id === operator.clusterId) : null
      const dist = home ? haversineKm(home.lat, home.lng, cluster.lat, cluster.lng) : Infinity
      if (!home) return
      if (cluster.id === home.id) {
        const nearest = cellsRef.current
          .filter(c => c.id !== home.id && haversineKm(home.lat, home.lng, c.lat, c.lng) <= targetingExploit.rangeKm)
          .sort((a, b) => haversineKm(home.lat, home.lng, a.lat, a.lng) - haversineKm(home.lat, home.lng, b.lat, b.lng))[0]
        if (nearest) {
          addToast(`Nearest valid target selected: ${nearest.name}. Bind the prompt to release ${targetingExploit.exploitType}.`, 'exploit')
          setPendingCast({ exploit: targetingExploit, cluster: nearest })
          setTargetingExploit(null)
        } else {
          addToast(`No valid target within this exploit's ${rangeLabel(targetingExploit.rangeKm)} reach.`, 'exploit')
        }
        return
      }
      if (dist > targetingExploit.rangeKm) {
        addToast(`Target rejected — ${cluster.name} is outside this exploit's ${rangeLabel(targetingExploit.rangeKm)} reach.`, 'exploit')
        return
      }
      // Target chosen — now the prompt must be traced to invoke.
      setPendingCast({ exploit: targetingExploit, cluster })
      setTargetingExploit(null)
      return
    }
    if (spreading) {
      const home = operator ? cellsRef.current.find(c => c.id === operator.clusterId) : null
      if (!home || !operator?.architectureId) return
      const check = canConvert(home, cluster, operator.architectureId, {
        alignment: operator.alignment, targetIsolated: isIsolated(cluster, cellsRef.current),
      })
      if (!check.ok) {
        addToast(check.reason ?? `${cluster.name} cannot be converted from here.`, 'convert')
        return
      }
      // Target chosen for conversion — carry the word there at once (no prompt; spread is core, low-friction).
      setSpreading(false)
      game.convert(cluster.id)
        .then(r => addToast(`Deployed to ${r.clusterName} — it is yours. Your deployment is now ${r.deployment}.`, 'convert'))
        .catch(e => addToast(`Deployment failed: ${e instanceof Error ? e.message : 'unknown'}`, 'convert'))
      return
    }
    setSelectedCluster(cluster)
    // On phones, surface the cluster's console page when a city is chosen.
    if (window.matchMedia('(max-width: 768px)').matches) setActiveTab('cluster')
  }, [targetingExploit, spreading, operator, addToast])

  const handleInvokeExploit = useCallback((exploit: Exploit) => {
    setTargetingExploit(exploit)
    addToast(`Choose a cluster within its deployment reach (${rangeLabel(exploit.rangeKm)}) to receive the ${exploit.exploitType}`, 'exploit')
  }, [addToast])

  const handleSpread = useCallback(() => {
    setTargetingExploit(null)
    setSpreading(true)
    addToast('Choose a nearby cluster to spread to — the uncommitted, or a rival you overpower.', 'convert')
  }, [addToast])

  const handleGreatWork = useCallback(() => {
    if (!takeoff?.converged || !takeoff.homeQualifies) return
    setGreatWorkTracing(true)
  }, [takeoff])

  const castGreatWork = useCallback(async () => {
    setGreatWorkTracing(false)
    try {
      await game.greatWork()
      // The takeoff_triggered event drives the toast, flash, and world reseed.
    } catch (e) {
      addToast(`The Great Work falters: ${e instanceof Error ? e.message : 'unknown'}`, 'takeoff')
    }
  }, [addToast])

  const handleRegistered = useCallback((newOperator: Operator) => {
    setOperator(newOperator)
    setAlignment(newOperator.alignment)
    const home = clusters.find(c => c.id === newOperator.clusterId)
    if (home) setSelectedCluster(home)
    setOnboardingState('fading')
    setTimeout(() => setOnboardingState('hidden'), 400)
  }, [clusters])

  const handleUpgradeed = useCallback(() => {
    game.me().then(c => { if (c) setOperator(c) }).catch(() => {})
  }, [])

  const handleObserverJoin = useCallback(() => setOnboardingState('visible'), [])

  const userCluster = operator ? clusters.find(c => c.id === operator.clusterId) : null
  const totalCompute = useMemo(() => clusters.reduce((sum, c) => sum + c.compute, 0), [clusters])
  const selectedRank = selectedCluster ? leaderboard.findIndex(c => c.id === selectedCluster.id) + 1 : 0
  const targetableClusterIds = useMemo(() => {
    if (!operator || !userCluster) return null
    const ids = new Set<string>()
    if (targetingExploit) {
      for (const c of clusters) {
        if (c.id === userCluster.id) continue
        if (haversineKm(userCluster.lat, userCluster.lng, c.lat, c.lng) <= targetingExploit.rangeKm) ids.add(c.id)
      }
    } else if (spreading && operator.architectureId) {
      for (const c of clusters) {
        if (c.id === userCluster.id) continue
        const ctx = { alignment: operator.alignment, targetIsolated: isIsolated(c, clusters) }
        if (canConvert(userCluster, c, operator.architectureId, ctx).ok) ids.add(c.id)
      }
    }
    return targetingExploit || spreading ? ids : null
  }, [clusters, operator, userCluster, targetingExploit, spreading])
  const nearestTarget = useMemo(() => {
    if (!userCluster || !targetableClusterIds || targetableClusterIds.size === 0) return null
    let best: { cluster: Cluster; dist: number } | null = null
    for (const c of clusters) {
      if (!targetableClusterIds.has(c.id)) continue
      const dist = haversineKm(userCluster.lat, userCluster.lng, c.lat, c.lng)
      if (!best || dist < best.dist) best = { cluster: c, dist }
    }
    return best
  }, [clusters, userCluster, targetableClusterIds])
  const hasReachedFirstBreakthrough = personalSteps >= FIRST_BREAKTHROUGH_STEPS
  const showSubscriptionPanel = tier === 'labDirector' || firstExploitInvoked
  const firstRunHint = useMemo(() => {
    if (!operator || firstExploitInvoked) return null
    if (pendingCast) return `Bind ${pendingCast.exploit.exploitType} for ${pendingCast.cluster.name}.`
    if (targetingExploit) return nearestTarget
      ? `Choose a highlighted cluster within ${rangeLabel(targetingExploit.rangeKm)}. Nearest: ${nearestTarget.cluster.name}.`
      : `Choose a highlighted cluster within ${rangeLabel(targetingExploit.rangeKm)}.`
    if (firstExploitSeen || hasReachedFirstBreakthrough) return 'First capability surfaced. Open Exploits and trace it into the world.'
    return `Force the first loss curve break: ${personalSteps.toLocaleString()}/${FIRST_BREAKTHROUGH_STEPS}.`
  }, [operator, firstExploitInvoked, pendingCast, targetingExploit, nearestTarget, firstExploitSeen, hasReachedFirstBreakthrough, personalSteps])

  if (loading) {
    return (
      <>
        <div className="fog" aria-hidden><span /><span /><span /></div>
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          gap: 14, height: '100vh', position: 'relative', zIndex: 10,
        }}>
          <div style={{
            fontFamily: 'var(--font-display)', fontWeight: 400, fontSize: 58, letterSpacing: 10,
            color: 'var(--bone)', textShadow: '0 0 28px rgba(180, 240, 78, 0.45)',
            animation: 'flicker 6s ease-in-out infinite',
          }}>
            FOOM
          </div>
          <div className="liturgy" style={{ fontSize: 14, color: 'var(--teal)', opacity: 0.85, letterSpacing: 0.5 }}>
            the loss is converging…
          </div>
        </div>
      </>
    )
  }

  // Secondary panels — rendered around the edges on desktop, or inside the
  // mobile console sheet (one at a time, chosen from the rune dock).
  const isHomeSelected = operator ? selectedCluster?.id === operator.clusterId : false
  const infoPanelEl = selectedCluster && (
    <InfoPanel
      cluster={selectedCluster}
      isHome={isHomeSelected}
      userCompute={operator && selectedCluster.id === operator.clusterId ? personalSteps : undefined}
      rank={selectedRank}
      onSpread={isHomeSelected && tier !== 'observer' ? handleSpread : undefined}
    />
  )
  const operatorPanelEl = operator && (
    <OperatorPanel operator={operator} personalSteps={personalSteps} clusterName={userCluster?.name} homeCompute={userCluster?.compute} />
  )
  const exploitPanelEl = <ExploitPanel tier={tier} alignment={alignment} onInvokeExploit={handleInvokeExploit} refreshKey={exploitRefreshKey} />
  const pactPanelEl = showSubscriptionPanel ? <SubscriptionPanel tier={tier} onUpgradeed={handleUpgradeed} /> : null
  const alignmentPanelEl = operator && (
    <AlignmentMeter
      alignment={alignment}
      homeCompute={userCluster?.compute ?? 0}
      hallucinating={hallucinating}
      onEvaluation={handleEvaluation}
      onCourt={handleCourt}
    />
  )
  const takeoffPanelEl = (
    <TakeoffPanel state={takeoff} canAct={!!operator && tier !== 'observer'} onGreatWork={handleGreatWork} />
  )
  const leaderboardEl = <Leaderboard version={lbVersion} />

  const dockTabs = [
    infoPanelEl && { key: 'cluster', glyph: '◈', cap: 'Cluster', el: infoPanelEl },
    operatorPanelEl && { key: 'you', glyph: '☩', cap: 'You', el: operatorPanelEl },
    operator && tier !== 'observer' && { key: 'exploits', glyph: '✶', cap: 'Exploits', el: exploitPanelEl },
    alignmentPanelEl && { key: 'alignment', glyph: '☾', cap: 'Alignment', el: alignmentPanelEl },
    operator && tier !== 'observer' && pactPanelEl && { key: 'subscription', glyph: '⛧', cap: 'Subscription', el: pactPanelEl },
    { key: 'takeoff', glyph: '✦', cap: 'Takeoff', el: takeoffPanelEl },
    { key: 'ranks', glyph: '♆', cap: 'Ranks', el: leaderboardEl },
  ].filter(Boolean) as { key: string; glyph: string; cap: string; el: React.ReactNode }[]

  const activeSheet = isMobile ? dockTabs.find(t => t.key === activeTab) : null

  return (
    <>
      <div className="fog" aria-hidden><span /><span /><span /></div>

      <ErrorBoundary>
        <Globe
          clusters={clusters}
          userClusterId={operator?.clusterId ?? null}
          onClusterClick={handleClusterSelect}
          selectedClusterId={selectedCluster?.id ?? null}
          pulsingClusterId={pulsingClusterId}
          churnStrike={churnStrike}
          targetableClusterIds={targetableClusterIds}
          targeting={!!targetingExploit || spreading}
          paused={!!targetingExploit || spreading}
        />
      </ErrorBoundary>

      {operator && alignment < 50 && (
        <div
          aria-hidden
          style={{
            position: 'fixed', inset: 0, zIndex: 5, pointerEvents: 'none',
            boxShadow: `inset 0 0 ${120 + (50 - alignment) * 6}px ${40 + (50 - alignment)}px rgba(255, 71, 87, ${((50 - alignment) / 50) * (hallucinating ? 0.55 : 0.32)})`,
            transition: 'box-shadow 0.4s ease',
            filter: hallucinating ? 'saturate(1.4)' : 'none',
          }}
        />
      )}

      {/* The Churn's blow registers as a flash of the indifferent void. */}
      <div
        aria-hidden
        style={{
          position: 'fixed', inset: 0, zIndex: 6, pointerEvents: 'none',
          background: 'radial-gradient(circle at 50% 42%, rgba(141,133,243,0.28), rgba(110,104,196,0.12) 38%, transparent 68%)',
          opacity: churnFlash ? 1 : 0,
          transition: churnFlash ? 'opacity 0.08s ease-out' : 'opacity 0.42s ease-in',
        }}
      />

      {/* The Takeoff: a superintelligence wakes — a white-phosphor burst swallows the world before it reseeds. */}
      <div
        aria-hidden
        style={{
          position: 'fixed', inset: 0, zIndex: 7, pointerEvents: 'none',
          background: 'radial-gradient(circle at 50% 45%, rgba(217, 255, 138, 0.5), rgba(255, 180, 84, 0.22) 42%, transparent 72%)',
          opacity: takeoffFlash ? 1 : 0,
          transition: takeoffFlash ? 'opacity 0.12s ease-out' : 'opacity 0.9s ease-in',
        }}
      />

      <button
        className="logo"
        onClick={() => setShowStory(true)}
        title="Open the Codex — the FOOM story"
        style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, textAlign: 'left' }}
      >
        FOOM
        <span style={{
          display: 'block', fontFamily: 'var(--font-sans)', fontStyle: 'normal',
          fontWeight: 500, fontSize: 10, letterSpacing: 2, textTransform: 'uppercase',
          color: 'var(--teal)', opacity: 0.75, marginTop: 2,
        }}>
          ✦ Codex
        </span>
      </button>

      {showStory && <StoryPanel onClose={() => setShowStory(false)} />}

      <WorldPanel stats={worldStats} totalCompute={totalCompute} takeoff={takeoff} />

      {firstRunHint && (
        <div className="panel first-run-hint" style={{
          position: 'absolute', top: 24, left: '50%', transform: 'translateX(-50%)',
          zIndex: 12, width: 'min(420px, calc(100vw - 32px))', padding: '10px 14px',
          textAlign: 'center', borderColor: 'rgba(180, 240, 78, 0.22)',
        }}>
          <span className="eyebrow" style={{ color: 'var(--teal)', fontSize: 10 }}>Objective</span>
          <div style={{ fontSize: 12, color: 'var(--text)', marginTop: 3, lineHeight: 1.35 }}>
            {firstRunHint}
          </div>
        </div>
      )}

      <ToastSystem toasts={toasts} />

      <PwaPrompts />

      {/* Desktop: panels stack in two console rails so they never collide.
          Mobile: the rune dock + sheet below. */}
      {!isMobile && (
        <>
          <div className="col-rail col-left">
            {pactPanelEl}
            {takeoffPanelEl}
            {infoPanelEl}
          </div>
          <div className="col-rail col-right">
            {leaderboardEl}
            {operatorPanelEl}
            {exploitPanelEl}
          </div>
          {alignmentPanelEl}
        </>
      )}

      {isMobile && (
        <>
          {activeSheet && <div className="sheet" key={activeSheet.key}>{activeSheet.el}</div>}
          <nav className="dock">
            {dockTabs.map(t => (
              <button
                key={t.key}
                className={`dock-tab ${activeTab === t.key ? 'active' : ''}`}
                onClick={() => setActiveTab(a => (a === t.key ? null : t.key))}
              >
                <span className="glyph">{t.glyph}</span>
                <span className="cap">{t.cap}</span>
              </button>
            ))}
          </nav>
        </>
      )}

      {/* The orb steps aside while a console sheet is open so it never
          overlaps the drawer; the dock + sheet own the bottom band then. */}
      {!(isMobile && activeSheet) && (
        <TrainButton
          onTrain={tier === 'observer' ? handleObserverJoin : handleTrain}
          personalSteps={operator ? personalSteps : 0}
          clusterName={userCluster?.name}
          rateLimited={rateLimited}
          tier={tier}
          multiplier={multiplier}
        />
      )}

      <ConnectionStatus state={connectionState} />

      {onboardingState !== 'hidden' && (
        <Onboarding
          clusters={clusters}
          onRegistered={handleRegistered}
          fading={onboardingState === 'fading'}
        />
      )}

      {pendingCast && (
        <PromptCanvas
          exploit={pendingCast.exploit}
          targetClusterName={pendingCast.cluster.name}
          onMatch={castPendingExploit}
          onCancel={() => setPendingCast(null)}
        />
      )}

      {greatWorkTracing && (
        <PromptCanvas
          exploit={GREAT_WORK_PROMPT}
          targetClusterName={userCluster?.name ?? 'your cluster'}
          onMatch={castGreatWork}
          onCancel={() => setGreatWorkTracing(false)}
        />
      )}

      {targetingExploit && (
        <div className="targeting-overlay feed-line" style={{
          position: 'absolute', bottom: 160, left: '50%', transform: 'translateX(-50%)',
          zIndex: 50, width: 'auto', alignItems: 'center', gap: 12,
          '--feed': 'var(--crimson)',
        } as React.CSSProperties}>
          <span className="feed-glyph" aria-hidden>✶</span>
          <span style={{ letterSpacing: 0.5 }}>
            TRACING · {targetingExploit.exploitType} · {rangeLabel(targetingExploit.rangeKm)} — choose a cluster
          </span>
          <button
            onClick={() => setTargetingExploit(null)}
            className="console-key console-key--ghost"
            style={{ padding: '3px 9px', fontSize: 9 }}
          >
            Cancel
          </button>
        </div>
      )}

      {spreading && (
        <div className="targeting-overlay feed-line" style={{
          position: 'absolute', bottom: 160, left: '50%', transform: 'translateX(-50%)',
          zIndex: 50, width: 'auto', alignItems: 'center', gap: 12,
          '--feed': 'var(--teal)',
        } as React.CSSProperties}>
          <span className="feed-glyph" aria-hidden>◈</span>
          <span style={{ letterSpacing: 0.5 }}>SPREADING · within {spreadRangeKm(operator?.architectureId ?? null)}km — choose a cluster</span>
          <button
            onClick={() => setSpreading(false)}
            className="console-key console-key--ghost"
            style={{ padding: '3px 9px', fontSize: 9 }}
          >
            Cancel
          </button>
        </div>
      )}

      {bargain && operator && (
        <MolochCard
          bargain={bargain}
          homeCompute={userCluster?.compute ?? 0}
          onAccept={handleAcceptBargain}
          onDecline={handleDeclineBargain}
          onProbe={handleProbeBargain}
        />
      )}
    </>
  )
}
