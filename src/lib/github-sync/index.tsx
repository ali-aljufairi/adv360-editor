import { createContext, useContext, useEffect, useRef, useSyncExternalStore } from 'react'
import type { ReactNode } from 'react'
import { getSession } from '../../server/auth/functions'
import {
  commitChangesFn,
  getBuildStatusFn,
  loadConfigFn,
  getRepositoryAccessFn,
  getBranchHistoryFn,
  restoreConfigFn,
} from '../../server/repo/functions'
import { createSyncStore } from './store'
import type { SyncDeps, SyncStore } from './store'
import type { KeyboardProfile } from '../profile'
export * from './store'

const Context = createContext<SyncStore | null>(null)
/** Provide a sync store and initialize it on its first subscription. */
export function SyncProvider({
  children,
  onLoaded,
  isDirty,
  profile,
}: {
  children: ReactNode
  profile: KeyboardProfile
  onLoaded: SyncDeps['onLoaded']
  isDirty?: SyncDeps['isDirty']
}) {
  const ref = useRef<SyncStore | null>(null)
  if (!ref.current)
    ref.current = createSyncStore({
      getSession: () => getSession(),
      loadConfig: (data) => loadConfigFn({ data }),
      commitChanges: (data) => commitChangesFn({ data }),
      getBuildStatus: (data) => getBuildStatusFn({ data }),
      getRepositoryAccess: (data) => getRepositoryAccessFn({ data }),
      getBranchHistory: (data) => getBranchHistoryFn({ data }),
      restoreConfig: (data) => restoreConfigFn({ data }),
      storage: typeof window === 'undefined' ? undefined : window.localStorage,
      now: () => new Date(),
      setTimeout: (callback, delay) => setTimeout(callback, delay),
      profileId: profile.id,
      branch: profile.branch,
      onLoaded,
      isDirty,
    })
  const store = ref.current
  useEffect(() => () => store.dispose(), [store])
  return <Context.Provider value={store}>{children}</Context.Provider>
}
/** Read sync state and actions. */
export function useSync() {
  const store = useContext(Context)
  if (!store) throw new Error('useSync must be used inside SyncProvider')
  const state = useSyncExternalStore(
    (listener) => {
      const unsubscribe = store.subscribe(listener)
      void store.init()
      return unsubscribe
    },
    store.getSnapshot,
    store.getSnapshot,
  )
  return { ...state, ...store }
}
