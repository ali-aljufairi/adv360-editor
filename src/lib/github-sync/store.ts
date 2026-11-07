import { ADV360_PROFILE } from '../profile'
import type { FileMap } from '../zmk/types'
import type {
  BuildStatus,
  CommitRequest,
  CommitResult,
  GitHubErrorCode,
  LoadedConfig,
  SessionUser,
} from '../github/types'

/** Dependencies used by the sync store. */
export interface SyncDeps {
  getSession: () => Promise<SessionUser | null>
  loadConfig: (input: { profileId: string; branch?: string }) => Promise<LoadedConfig>
  commitChanges: (input: CommitRequest) => Promise<CommitResult>
  getBuildStatus: (input: { profileId: string; commitSha: string }) => Promise<BuildStatus>
  storage?: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>
  now: () => Date
  setTimeout: (callback: () => void, delay: number) => unknown
  onLoaded: (files: FileMap, headSha: string) => void
  isDirty?: () => boolean
  profileId?: string
  branch?: string
}
/** Public sync state. */
export interface SyncState {
  phase: 'signed-out' | 'loading' | 'ready' | 'committing' | 'error' | 'remote-changed'
  remoteSha: string | null
  buildTimedOut: boolean
  user: SessionUser | null
  source: { branch: string; headSha: string; loadedAt: string; fromCache: boolean } | null
  error: { code: GitHubErrorCode | 'unknown'; message: string } | null
  build: BuildStatus | null
  lastCommit: CommitResult | null
}
/** Return changed or added files; deletions are ignored. */
export function changedFiles(baseline: FileMap, current: FileMap): FileMap {
  return Object.fromEntries(
    Object.entries(current).filter(([path, text]) => baseline[path] !== text),
  )
}
/** Generate a local timestamped branch name. */
export function defaultBranchName(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, '0')
  return `editor/${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}-${pad(date.getHours())}${pad(date.getMinutes())}`
}
const codes: string[] = [
  'not-signed-in',
  'not-allowed',
  'branch-moved',
  'not-found',
  'rate-limited',
  'github-error',
  'forbidden',
  'protected-branch',
  'remote-changed',
  'timeout',
  'transient-refresh',
]
function mapError(error: unknown): SyncState['error'] {
  const message = error instanceof Error ? error.message : String(error)
  const code = message.split(':')[0]
  return { code: codes.includes(code) ? (code as GitHubErrorCode) : 'unknown', message }
}
/** Create a React-independent sync store. */
export function createSyncStore(deps: SyncDeps) {
  const profileId = deps.profileId ?? ADV360_PROFILE.id
  const branch = deps.branch ?? ADV360_PROFILE.branch
  const key = (name: string) => `adv360-editor:config:${profileId}:${name}`
  const keys = new Set([key(branch)])
  let state: SyncState = {
    phase: 'signed-out',
    user: null,
    source: null,
    error: null,
    build: null,
    lastCommit: null,
    remoteSha: null,
    buildTimedOut: false,
  }
  let config: LoadedConfig | null = null
  let generation = 0
  let loadGeneration = 0
  let remote: LoadedConfig | null = null
  let initPromise: Promise<void> | undefined
  const listeners = new Set<() => void>()
  const update = (patch: Partial<SyncState>) => {
    state = { ...state, ...patch }
    listeners.forEach((listener) => listener())
  }
  const save = (value: LoadedConfig) => {
    const cacheKey = key(value.branch)
    const shaKey = key(`sha:${value.headSha}`)
    keys.add(cacheKey)
    keys.add(shaKey)
    try {
      // Keep one SHA entry per branch: drop the one this branch pointed at before.
      const previous = deps.storage?.getItem(cacheKey)
      const previousSha = previous ? (JSON.parse(previous) as LoadedConfig).headSha : null
      if (previousSha && previousSha !== value.headSha) {
        const previousKey = key(`sha:${previousSha}`)
        deps.storage?.removeItem(previousKey)
        keys.delete(previousKey)
      }
      deps.storage?.setItem(shaKey, JSON.stringify(value))
      deps.storage?.setItem(cacheKey, JSON.stringify(value))
    } catch {
      /* Storage is optional. */
    }
  }
  const apply = (value: LoadedConfig, fromCache: boolean) => {
    config = value
    remote = null
    deps.onLoaded(value.files, value.headSha)
    update({
      phase: 'ready',
      source: { branch: value.branch, headSha: value.headSha, loadedAt: value.loadedAt, fromCache },
      error: null,
      remoteSha: null,
    })
  }
  const load = async () => {
    const current = ++loadGeneration
    const name = state.source?.branch ?? branch
    try {
      const raw = deps.storage?.getItem(key(name))
      if (raw && !config) {
        const index = JSON.parse(raw) as LoadedConfig
        const shaKey = key(`sha:${index.headSha}`)
        const stored = deps.storage?.getItem(shaKey)
        const cached = stored ? (JSON.parse(stored) as LoadedConfig) : index
        if (cached.headSha !== index.headSha) throw new Error('Invalid cache')
        keys.add(shaKey)
        if (
          cached.profileId === profileId &&
          cached.branch === name &&
          cached.headSha &&
          cached.files
        )
          apply(cached, true)
      }
    } catch {
      /* Ignore unavailable or corrupt cache. */
    }
    if (!config) update({ phase: 'loading', error: null })
    try {
      const fresh = await deps.loadConfig({ profileId, branch: name })
      if (current !== loadGeneration) return
      save(fresh)
      if (config && fresh.headSha === config.headSha && fresh.branch === config.branch) {
        config = { ...config, loadedAt: fresh.loadedAt }
        remote = null
        update({
          phase: 'ready',
          source: {
            branch: config.branch,
            headSha: config.headSha,
            loadedAt: fresh.loadedAt,
            fromCache: false,
          },
          remoteSha: null,
          error: null,
        })
      } else if (config && deps.isDirty?.()) {
        remote = fresh
        update({ phase: 'remote-changed', remoteSha: fresh.headSha, error: null })
      } else apply(fresh, false)
    } catch (error) {
      if (current !== loadGeneration) return
      update({ phase: config ? 'ready' : 'error', error: mapError(error) })
    }
  }
  const stopPolling = () => {
    generation++
  }
  const poll = (sha: string) => {
    stopPolling()
    const current = generation
    const started = deps.now().getTime()
    update({ buildTimedOut: false })
    const tick = async () => {
      if (current !== generation) return
      if (deps.now().getTime() - started >= 1800000) {
        update({ buildTimedOut: true })
        return
      }
      try {
        const build = await deps.getBuildStatus({ profileId, commitSha: sha })
        if (current !== generation) return
        if (deps.now().getTime() - started >= 1800000 && build.run?.status !== 'completed') {
          update({ build, buildTimedOut: true })
          return
        }
        update({ build })
        if (build.run?.status === 'completed') return
      } catch (error) {
        if (current !== generation) return
        update({ error: mapError(error) })
      }
      if (current === generation)
        deps.setTimeout(() => {
          void tick()
        }, 10000)
    }
    void tick()
  }
  return {
    getSnapshot: () => state,
    subscribe: (listener: () => void) => {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    init: () => {
      initPromise ??= (async () => {
        const current = ++loadGeneration
        update({ phase: 'loading' })
        try {
          const user = await deps.getSession()
          if (current !== loadGeneration) return
          update({ user, phase: user ? 'loading' : 'signed-out' })
          if (user) await load()
        } catch (error) {
          if (current !== loadGeneration) return
          update({ phase: 'error', error: mapError(error) })
        }
      })()
      return initPromise
    },
    signIn: () => {
      window.location.assign(
        `/api/auth/login?returnTo=${encodeURIComponent(window.location.pathname + window.location.search + window.location.hash)}`,
      )
    },
    signOut: async () => {
      ++loadGeneration
      stopPolling()
      await fetch('/api/auth/logout', { method: 'POST' })
      for (const cacheKey of keys) {
        try {
          deps.storage?.removeItem(cacheKey)
        } catch {
          /* Ignore storage failures. */
        }
      }
      config = null
      remote = null
      initPromise = undefined
      update({
        phase: 'signed-out',
        user: null,
        source: null,
        error: null,
        build: null,
        lastCommit: null,
        remoteSha: null,
        buildTimedOut: false,
      })
    },
    reload: load,
    applyRemote: () => {
      if (remote) {
        ++loadGeneration
        apply(remote, false)
      }
    },
    repollBuild: () => {
      if (state.lastCommit) poll(state.lastCommit.commitSha)
    },
    commit: async (input: {
      message: string
      branch: string
      changedFiles: FileMap
      allowDefaultBranch?: boolean
    }) => {
      if (!state.source || !config) throw new Error('No configuration loaded')
      if (state.phase === 'remote-changed') {
        update({ error: mapError(new Error('remote-changed: resolve remote changes first')) })
        return
      }
      if (
        profileId === ADV360_PROFILE.id &&
        input.branch === ADV360_PROFILE.branch &&
        !input.allowDefaultBranch
      ) {
        update({
          error: mapError(new Error('protected-branch: default branch requires explicit approval')),
        })
        return
      }
      ++loadGeneration
      update({ phase: 'committing', error: null })
      try {
        const result = await deps.commitChanges({
          profileId,
          branch: input.branch,
          baseSha: state.source.headSha,
          message: input.message,
          files: input.changedFiles,
          ...(input.allowDefaultBranch ? { allowDefaultBranch: true } : {}),
        })
        config = {
          ...config,
          branch: result.branch,
          headSha: result.commitSha,
          loadedAt: deps.now().toISOString(),
          files: { ...config.files, ...input.changedFiles },
        }
        save(config)
        apply(config, false)
        update({ lastCommit: result, build: null })
        poll(result.commitSha)
      } catch (error) {
        update({ phase: 'ready', error: mapError(error) })
      }
    },
    stopPolling,
    dispose: stopPolling,
  }
}
/** Store returned by createSyncStore. */
export type SyncStore = ReturnType<typeof createSyncStore>
