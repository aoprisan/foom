import { useCallback, useRef } from 'react'
import { useRegisterSW } from 'virtual:pwa-register/react'

// Single owner of the service-worker registration so both the always-on
// "check for updates" control (top-left toolbar) and the update/offline
// prompts (<PwaPrompts>) read the same state. `useRegisterSW` must be called
// exactly once — calling it in two components would race two registrations.
export interface PwaUpdate {
  offlineReady: boolean
  setOfflineReady: (v: boolean) => void
  needRefresh: boolean
  setNeedRefresh: (v: boolean) => void
  // Activate the waiting build and reload the page onto it.
  updateServiceWorker: (reloadPage?: boolean) => Promise<void>
  // Ask the browser to look for a fresh build now. Resolves false when there
  // is no registration yet (dev, or the SW hasn't installed).
  checkForUpdate: () => Promise<boolean>
}

export function usePwaUpdate(): PwaUpdate {
  const swRef = useRef<ServiceWorkerRegistration | undefined>(undefined)

  const {
    offlineReady: [offlineReady, setOfflineReady],
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_swUrl, r) {
      swRef.current = r ?? undefined
    },
    onRegisterError(err) {
      console.warn('[foom] service worker registration failed', err)
    },
  })

  const checkForUpdate = useCallback(async () => {
    const r = swRef.current
    if (!r) return false
    // If a build is already waiting we surface it immediately; otherwise poke
    // the server for a new one. `onNeedRefresh` flips needRefresh when found.
    try {
      await r.update()
    } catch {
      // Offline or the SW isn't controlling yet — nothing to update against.
    }
    return true
  }, [])

  return { offlineReady, setOfflineReady, needRefresh, setNeedRefresh, updateServiceWorker, checkForUpdate }
}
