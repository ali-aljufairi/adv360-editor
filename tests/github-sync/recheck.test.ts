import { describe, expect, it, vi } from 'vitest'
import { createSyncStore } from '../../src/lib/github-sync/store'
import type { LoadedConfig, RepositoryAccess } from '../../src/lib/github/types'

const config: LoadedConfig = {
  profileId: 'p',
  owner: 'ali',
  repo: 'config',
  branch: 'V3.0',
  headSha: 'head',
  files: { a: 'a' },
  loadedAt: '',
}
const access = (reason: RepositoryAccess['reason']): RepositoryAccess => ({
  reason,
  message: reason === 'ready' ? null : `blocked: ${reason}`,
  canPush: reason === 'ready' || reason === 'actions-readonly',
  canReadBuilds: reason === 'ready',
  settingsUrl: 'https://github.com/settings/installations/1',
})

function setup(initial: RepositoryAccess['reason']) {
  let clock = 0
  let current = access(initial)
  let loadError: Error | null = null
  const deps = {
    profileId: 'p',
    branch: 'V3.0',
    getSession: vi.fn(async () => ({ login: 'ali', name: null, avatarUrl: '' })),
    loadConfig: vi.fn(async () => {
      if (loadError) throw loadError
      return config
    }),
    commitChanges: vi.fn(),
    getBuildStatus: vi.fn(async () => ({ commitSha: 'head', run: null, artifacts: [] })),
    getRepositoryAccess: vi.fn(async () => current),
    now: () => new Date(clock),
    setTimeout: vi.fn(),
    onLoaded: vi.fn(),
  }
  return {
    deps,
    store: createSyncStore(deps),
    grant: (reason: RepositoryAccess['reason']) => {
      current = access(reason)
    },
    failLoad: (error: Error | null) => {
      loadError = error
    },
    tick: (ms: number) => {
      clock += ms
    },
  }
}

describe('recheckAccess', () => {
  it('heals a blocked repository once access is granted, without a manual retry', async () => {
    const { store, grant, deps } = setup('repo-not-selected')
    await store.init()
    expect(store.getSnapshot().access?.reason).toBe('repo-not-selected')
    grant('ready')
    await store.recheckAccess()
    expect(store.getSnapshot().access?.reason).toBe('ready')
    expect(store.getSnapshot().checkingAccess).toBe(false)
    expect(deps.getRepositoryAccess).toHaveBeenCalledTimes(2)
  })

  it('does nothing when nothing is blocked', async () => {
    const { store, deps } = setup('ready')
    await store.init()
    await store.recheckAccess()
    expect(deps.getRepositoryAccess).toHaveBeenCalledTimes(1)
    expect(deps.loadConfig).toHaveBeenCalledTimes(1)
  })

  it('throttles focus re-checks but lets Retry force one', async () => {
    const { store, deps, tick } = setup('not-installed')
    await store.init()
    await store.recheckAccess()
    await store.recheckAccess()
    expect(deps.getRepositoryAccess).toHaveBeenCalledTimes(2)
    await store.recheckAccess(true)
    expect(deps.getRepositoryAccess).toHaveBeenCalledTimes(3)
    tick(3000)
    await store.recheckAccess()
    expect(deps.getRepositoryAccess).toHaveBeenCalledTimes(4)
  })

  it('recovers from a failed first load (forbidden) when focus returns', async () => {
    const { store, failLoad, grant } = setup('repo-not-selected')
    failLoad(new Error('forbidden: no access'))
    await store.init()
    expect(store.getSnapshot().phase).toBe('error')
    failLoad(null)
    grant('ready')
    await store.recheckAccess()
    expect(store.getSnapshot().phase).toBe('ready')
    expect(store.getSnapshot().error).toBeNull()
    expect(store.getSnapshot().source?.headSha).toBe('head')
  })

  it('reports checkingAccess while the re-check runs', async () => {
    const { store, grant } = setup('suspended')
    await store.init()
    grant('ready')
    const seen: boolean[] = []
    const unsubscribe = store.subscribe(() => seen.push(store.getSnapshot().checkingAccess))
    await store.recheckAccess()
    unsubscribe()
    expect(seen[0]).toBe(true)
    expect(seen.at(-1)).toBe(false)
  })
})
