import { useEffect, useRef, useCallback, useMemo, useState } from 'react'
import GlobeGL from 'react-globe.gl'
import * as THREE from 'three'
import type { Cluster } from '../types'
import * as topojson from 'topojson-client'

// Bundled locally (see public/) so GitHub Pages works with no third-party calls.
const WORLD_ATLAS_URL = `${import.meta.env.BASE_URL}countries-110m.json`

interface GlobeProps {
  clusters: Cluster[]
  userClusterId: string | null
  onClusterClick: (cluster: Cluster) => void
  selectedClusterId: string | null
  pulsingClusterId: string | null
  churnStrike?: { lat: number; lng: number; key: number } | null  // the Churn falls here
  targetableClusterIds?: Set<string> | null
  targeting?: boolean
  paused?: boolean   // stop auto-rotation (e.g. while aiming a exploit)
}

interface Beam { mesh: THREE.Mesh; mat: THREE.MeshBasicMaterial; born: number }

export default function Globe({
  clusters, userClusterId, onClusterClick, selectedClusterId, pulsingClusterId,
  churnStrike, targetableClusterIds, targeting, paused,
}: GlobeProps) {
  const globeRef = useRef<any>(null)
  const [polygons, setPolygons] = useState<any[]>([])
  const [dimensions, setDimensions] = useState({ width: window.innerWidth, height: window.innerHeight })
  // Active Churn shockwaves (violet rings) and the descending beams that drive them.
  const [churnRings, setChurnRings] = useState<{ lat: number; lng: number; id: number }[]>([])
  const beamsRef = useRef<Beam[]>([])

  useEffect(() => {
    let timeout: ReturnType<typeof setTimeout>
    const handleResize = () => {
      clearTimeout(timeout)
      timeout = setTimeout(() => {
        setDimensions({ width: window.innerWidth, height: window.innerHeight })
      }, 150)
    }
    window.addEventListener('resize', handleResize)
    return () => {
      window.removeEventListener('resize', handleResize)
      clearTimeout(timeout)
    }
  }, [])

  // Load country polygons
  useEffect(() => {
    fetch(WORLD_ATLAS_URL)
      .then(r => r.json())
      .then(worldData => {
        const countries = topojson.feature(worldData, worldData.objects.countries)
        setPolygons((countries as any).features)
      })
      .catch(() => {})
  }, [])

  // Auto-rotate (paused while aiming a exploit, so targets hold still) and
  // constrain how far the seeker may draw in / pull back from the dark.
  useEffect(() => {
    if (!globeRef.current) return
    const controls = globeRef.current.controls()
    if (controls) {
      controls.autoRotate = !paused
      controls.autoRotateSpeed = 0.35
      controls.enableDamping = false
      controls.enableZoom = true
      controls.zoomSpeed = 0.8
      controls.minDistance = 140   // closest the eye may press to the sphere
      controls.maxDistance = 520   // farthest it may recede
    }
  }, [paused])

  // Zoom by nudging the camera altitude toward/away from the surface. Reads the
  // live point-of-view so taps compound, and animates so it feels like drifting.
  const zoom = useCallback((factor: number) => {
    if (!globeRef.current) return
    const pov = globeRef.current.pointOfView()
    const altitude = Math.max(0.35, Math.min(3.6, pov.altitude * factor))
    globeRef.current.pointOfView({ ...pov, altitude }, 400)
  }, [])

  // the Optimizer's strike: a tapering violet column lances down from the dark onto the
  // cluster, wide at the sky and narrowing to the point of impact. Added straight to
  // the scene and animated in the render loop above (react-globe.gl has no beam layer).
  const spawnBeam = useCallback((lat: number, lng: number) => {
    const globe = globeRef.current
    if (!globe?.getCoords || !globe.scene) return
    const scene = globe.scene()
    if (!scene) return
    const b = globe.getCoords(lat, lng, 0.004)
    const t = globe.getCoords(lat, lng, 0.62)
    const baseV = new THREE.Vector3(b.x, b.y, b.z)
    const topV = new THREE.Vector3(t.x, t.y, t.z)
    const height = baseV.distanceTo(topV)
    const dir = topV.clone().sub(baseV).normalize()
    const geo = new THREE.CylinderGeometry(2.6, 0.5, height, 18, 1, true)  // wide at the dark
    const mat = new THREE.MeshBasicMaterial({
      color: new THREE.Color(0x8d85f3),
      transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending,
      depthWrite: false, side: THREE.DoubleSide,
    })
    const mesh = new THREE.Mesh(geo, mat)
    mesh.position.copy(baseV.clone().add(topV).multiplyScalar(0.5))
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir)
    scene.add(mesh)
    beamsRef.current.push({ mesh, mat, born: Date.now() })
  }, [])

  // When the Churn falls, lance a beam down and ripple a violet shockwave out;
  // the ring clears itself once it has propagated.
  useEffect(() => {
    if (!churnStrike) return
    spawnBeam(churnStrike.lat, churnStrike.lng)
    const ring = { lat: churnStrike.lat, lng: churnStrike.lng, id: churnStrike.key }
    setChurnRings(prev => [...prev, ring])
    const timer = setTimeout(() => {
      setChurnRings(prev => prev.filter(r => r.id !== ring.id))
    }, 1400)
    return () => clearTimeout(timer)
  }, [churnStrike?.key, spawnBeam])

  // Cold void globe: a dark sphere with a slow phosphor breath, no Earth texture.
  useEffect(() => {
    if (!globeRef.current) return
    const globe = globeRef.current

    let frameId: number
    let globeMat: THREE.MeshPhongMaterial | null = null

    const animate = () => {
      const t = Date.now() * 0.001
      const scene = globe.scene()

      if (!globeMat && scene) {
        scene.traverse((obj: THREE.Object3D) => {
          if (globeMat) return
          if (obj instanceof THREE.Mesh && obj.material instanceof THREE.MeshPhongMaterial && obj.geometry instanceof THREE.SphereGeometry) {
            globeMat = obj.material
            globeMat.color = new THREE.Color(0x05090d)
            globeMat.emissive = new THREE.Color(0x0c1f1a)
            globeMat.emissiveIntensity = 0.4
          }
        })
      }

      if (globeMat) {
        const intensity = 0.26 + 0.12 * Math.sin(t * 0.35)
        globeMat.emissiveIntensity = intensity
        const hue = 0.42 + 0.04 * Math.sin(t * 0.2) // cold range — sea-glass to steel
        globeMat.emissive.setHSL(hue, 0.45, 0.07)
      }

      // Landmass faint glow
      if (scene && !(scene as any).__glowApplied) {
        scene.traverse((obj: THREE.Object3D) => {
          if (obj instanceof THREE.Mesh && obj.material) {
            const mats = Array.isArray(obj.material) ? obj.material : [obj.material]
            for (const mat of mats) {
              if (mat instanceof THREE.MeshLambertMaterial && mat.color) {
                mat.emissive = new THREE.Color(0x14241c)
                mat.emissiveIntensity = 0.4
              }
            }
          }
        })
        ;(scene as any).__glowApplied = true
      }

      // The Churn's deployment: fade each descending beam, slam it home, then retire it.
      if (scene) {
        const beams = beamsRef.current
        for (let i = beams.length - 1; i >= 0; i--) {
          const b = beams[i]
          const age = (Date.now() - b.born) / 1000
          if (age >= 1) {
            scene.remove(b.mesh)
            b.mesh.geometry.dispose()
            b.mat.dispose()
            beams.splice(i, 1)
            continue
          }
          const k = age            // 0 → 1 over one second
          const flicker = 0.7 + 0.3 * Math.abs(Math.sin(age * 42))
          b.mat.opacity = 0.85 * (1 - k) * flicker
          const slamY = k < 0.15 ? 1.3 - (k / 0.15) * 0.3 : 1
          b.mesh.scale.set(1 + k * 0.5, slamY, 1 + k * 0.5)
        }
      }

      frameId = requestAnimationFrame(animate)
    }

    const timer = setTimeout(() => { frameId = requestAnimationFrame(animate) }, 1000)

    return () => {
      clearTimeout(timer)
      cancelAnimationFrame(frameId)
    }
  }, [])

  // Fly to the player's cluster — ONCE per cluster. Clusters tick constantly (compute),
  // so without this guard the flight would re-fire on every update and snap the
  // camera back to altitude 1.5, undoing any zoom the seeker has set.
  const flownToRef = useRef<string | null>(null)
  useEffect(() => {
    if (!globeRef.current || !userClusterId) return
    if (flownToRef.current === userClusterId) return
    const cluster = clusters.find(c => c.id === userClusterId)
    if (cluster) {
      flownToRef.current = userClusterId
      setTimeout(() => {
        globeRef.current.pointOfView({ lat: cluster.lat, lng: cluster.lng, altitude: 1.5 }, 1500)
      }, 500)
    }
  }, [userClusterId, clusters])

  const maxCompute = useMemo(() => Math.max(1, ...clusters.map(c => c.compute)), [clusters])

  const pointAltitude = useCallback((d: any) => {
    const cluster = d as Cluster
    if (cluster.compute === 0) return 0.001
    return 0.001 + 0.012 * Math.log10(cluster.compute) / Math.log10(Math.max(10, maxCompute))
  }, [maxCompute])

  const pointColor = useCallback((d: any) => {
    const cluster = d as Cluster
    if (targeting && targetableClusterIds) {
      if (cluster.id === userClusterId) return '#ffd28a'
      return targetableClusterIds.has(cluster.id) ? '#d9ff8a' : 'rgba(126, 145, 158, 0.22)'
    }
    if (cluster.id === userClusterId) return '#ffd28a'       // amber — yours
    if (cluster.id === selectedClusterId) return '#eef4f8'   // white-hot — selected
    return cluster.compute > 0 ? '#b4f04ecc' : '#b4f04e3a'   // phosphor — the rest
  }, [targeting, targetableClusterIds, userClusterId, selectedClusterId])

  const pointRadius = useCallback((d: any) => {
    const cluster = d as Cluster
    if (targeting && targetableClusterIds?.has(cluster.id)) return 0.58
    if (cluster.id === userClusterId) return 0.4 + Math.min(0.4, 0.4 * Math.log10(Math.max(1, clusters.find(c => c.id === userClusterId)?.compute ?? 1)) / Math.log10(Math.max(10, maxCompute)))
    if (cluster.compute > 0) return 0.15 + Math.min(0.35, 0.35 * Math.log10(cluster.compute) / Math.log10(Math.max(10, maxCompute)))
    return 0.12
  }, [targeting, targetableClusterIds, userClusterId, maxCompute, clusters])

  const handlePointClick = useCallback((point: any) => {
    const cluster = point as Cluster
    onClusterClick(cluster)
    if (globeRef.current) {
      globeRef.current.pointOfView({ lat: cluster.lat, lng: cluster.lng, altitude: 1.8 }, 800)
    }
  }, [onClusterClick])

  const pointLabel = useCallback((d: any) => {
    const cluster = d as Cluster
    const targetStatus = targeting && targetableClusterIds
      ? `<br/><span style="color: ${targetableClusterIds.has(cluster.id) ? '#d9ff8a' : '#7e919e'};">${targetableClusterIds.has(cluster.id) ? 'valid target' : 'out of reach'}</span>`
      : ''
    return `<div style="font-family: 'Chivo Mono', monospace; font-size: 12px; color: #eef4f8; text-align: center;">
      <b>${cluster.name}</b>, ${cluster.country}<br/>
      <span style="color: #ffd28a;">${cluster.compute.toLocaleString()} compute</span>${targetStatus}
    </div>`
  }, [targeting, targetableClusterIds])

  const cellsRef = useRef(clusters)
  cellsRef.current = clusters
  const ringsData = useMemo(() => {
    const out: { lat: number; lng: number; kind: 'pulse' | 'churn' }[] = []
    if (pulsingClusterId) {
      const cluster = cellsRef.current.find(c => c.id === pulsingClusterId)
      if (cluster) out.push({ lat: cluster.lat, lng: cluster.lng, kind: 'pulse' })
    }
    for (const r of churnRings) out.push({ lat: r.lat, lng: r.lng, kind: 'churn' })
    return out
  }, [pulsingClusterId, churnRings])

  return (
    <>
    <GlobeGL
      ref={globeRef}
      // No Earth/space textures — the dark is the aesthetic and keeps us CDN-free.
      backgroundColor="#04070a"
      polygonsData={polygons}
      polygonCapColor={() => 'rgba(14, 24, 30, 0.65)'}
      polygonSideColor={() => 'rgba(180, 240, 78, 0.04)'}
      polygonStrokeColor={() => 'rgba(140, 168, 182, 0.30)'}
      polygonAltitude={0.006}
      pointsData={clusters}
      pointLat="lat"
      pointLng="lng"
      pointAltitude={pointAltitude}
      pointColor={pointColor}
      pointRadius={pointRadius}
      pointLabel={pointLabel}
      onPointClick={handlePointClick}
      pointsTransitionDuration={0}
      ringsData={ringsData}
      ringLat="lat"
      ringLng="lng"
      // The Churn rings ride the same layer as the phosphor pulse, but ripple
      // faster, wider, and in the Optimizer's indigo, fading as they spread.
      ringColor={(d: any) => (d.kind === 'churn' ? (t: number) => `rgba(141, 133, 243, ${(1 - t) * 0.9})` : '#d9ff8a')}
      ringMaxRadius={(d: any) => (d.kind === 'churn' ? 7 : 3)}
      ringPropagationSpeed={(d: any) => (d.kind === 'churn' ? 6 : 2)}
      ringRepeatPeriod={(d: any) => (d.kind === 'churn' ? 280 : 800)}
      atmosphereColor="#46707f"
      atmosphereAltitude={0.2}
      animateIn={true}
      width={dimensions.width}
      height={dimensions.height}
    />

    {/* Zoom controls — left side, clear of the train orb (bottom-right) and the
        dock. Sized for a thumb. */}
    <div className="globe-zoom">
      <button aria-label="Draw closer" onClick={() => zoom(0.72)}>+</button>
      <button aria-label="Pull back" onClick={() => zoom(1.38)}>−</button>
    </div>

    <style>{`
      .globe-zoom {
        position: absolute;
        left: 18px;
        bottom: 32px;
        z-index: 10;
        display: flex;
        flex-direction: column;
        gap: 10px;
      }
      .globe-zoom button {
        width: 46px;
        height: 46px;
        border-radius: 0;
        border: 1px solid rgba(200, 224, 235, 0.28);
        background: rgba(7, 13, 18, 0.88);
        color: var(--teal-bright);
        font-family: var(--font-mono);
        font-size: 22px;
        line-height: 1;
        font-weight: 400;
        cursor: pointer;
        box-shadow: 0 10px 26px -10px rgba(0,0,0,0.8);
        touch-action: manipulation;
        -webkit-tap-highlight-color: transparent;
        transition: transform 0.1s ease, box-shadow 0.2s ease, border-color 0.2s ease;
        display: flex;
        align-items: center;
        justify-content: center;
      }
      .globe-zoom button:active {
        transform: scale(0.92);
        border-color: rgba(180, 240, 78, 0.6);
        box-shadow: 0 0 18px rgba(180, 240, 78, 0.3);
      }
      @media (max-width: 768px) {
        .globe-zoom {
          left: 16px;
          bottom: calc(var(--dock-h) + var(--safe-b) + 14px);
        }
        .globe-zoom button { width: 54px; height: 54px; font-size: 30px; }
      }
    `}</style>
    </>
  )
}
