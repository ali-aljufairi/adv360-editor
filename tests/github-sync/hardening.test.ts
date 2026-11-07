import { describe, expect, it, vi } from 'vitest'
import { createSyncStore } from '../../src/lib/github-sync/store'
import type { LoadedConfig } from '../../src/lib/github/types'

const config: LoadedConfig = {
  profileId: 'p',
  owner: 'o',
  repo: 'r',
  branch: 'b',
  headSha: 'a',
  files: { a: 'a' },
  loadedAt: 'old',
}
const user = { login: 'u', name: null, avatarUrl: '' }
function setup() {
  let dirty = false
  let now = 0
  const queue: (() => void)[] = []
  const deps = {
    profileId: 'p',
    branch: 'b',
    getSession: vi.fn(async () => user),
    loadConfig: vi.fn(async () => config),
    commitChanges: vi.fn(async () => ({
      branch: 'b',
      commitSha: 'c',
      commitUrl: '',
      backupRef: null,
    })),
    getBuildStatus: vi.fn(async () => ({ commitSha: 'c', run: null, artifacts: [] })),
    now: () => new Date(now),
    setTimeout: (fn: () => void) => {
      queue.push(fn)
    },
    onLoaded: vi.fn(),
    isDirty: () => dirty,
  }
  return {
    deps,
    store: createSyncStore(deps),
    queue,
    dirty: () => {
      dirty = true
    },
    advance: () => {
      now = 1800000
    },
  }
}
const flush = async () => {
  await Promise.resolve()
  await Promise.resolve()
}
describe('sync revalidation', () => {
  it('does not reset editor for the same SHA, even when dirty', async () => {
    const { store, deps, dirty } = setup()
    await store.init()
    dirty()
    deps.loadConfig.mockResolvedValue({ ...config, loadedAt: 'new' })
    await store.reload()
    expect(deps.onLoaded).toHaveBeenCalledTimes(1)
    expect(store.getSnapshot().source).toMatchObject({ headSha: 'a', loadedAt: 'new' })
  })
  it('holds changed remote until explicitly applied', async () => {
    const { store, deps, dirty } = setup()
    await store.init()
    dirty()
    deps.loadConfig.mockResolvedValue({ ...config, headSha: 'b' })
    await store.reload()
    expect(store.getSnapshot()).toMatchObject({
      phase: 'remote-changed',
      remoteSha: 'b',
      source: { headSha: 'a' },
    })
    expect(deps.onLoaded).toHaveBeenCalledTimes(1)
    store.applyRemote()
    expect(deps.onLoaded).toHaveBeenLastCalledWith(config.files, 'b')
    expect(store.getSnapshot()).toMatchObject({ phase: 'ready', remoteSha: null })
  })
  it('ignores an earlier reload and a response after logout', async () => {
    const { store, deps } = setup()
    await store.init()
    let resolve!: (c: LoadedConfig) => void
    deps.loadConfig.mockReturnValueOnce(
      new Promise((resolvePromise) => {
        resolve = resolvePromise
      }),
    )
    const old = store.reload()
    deps.loadConfig.mockResolvedValueOnce({ ...config, headSha: 'new' })
    await store.reload()
    resolve({ ...config, headSha: 'stale' })
    await old
    expect(store.getSnapshot().source?.headSha).toBe('new')
    deps.loadConfig.mockReturnValueOnce(
      new Promise((resolvePromise) => {
        resolve = resolvePromise
      }),
    )
    const pending = store.reload()
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response()),
    )
    await store.signOut()
    resolve(config)
    await pending
    expect(store.getSnapshot().phase).toBe('signed-out')
    vi.unstubAllGlobals()
  })
  it('exposes timeout and permits repolling', async () => {
    const { store, deps, queue, advance } = setup()
    await store.init()
    await store.commit({ branch: 'b', message: 'x', allowDefaultBranch: true, changedFiles: {} })
    await flush()
    advance()
    queue.shift()!()
    await flush()
    expect(store.getSnapshot().buildTimedOut).toBe(true)
    store.repollBuild()
    await flush()
    expect(deps.getBuildStatus).toHaveBeenCalledTimes(2)
    expect(store.getSnapshot().buildTimedOut).toBe(false)
  })
})

describe('sync cache pruning', () => {
  it('keeps one SHA entry per branch', async () => {
    const memory = new Map<string, string>()
    const storage = {
      getItem: (name: string) => memory.get(name) ?? null,
      setItem: (name: string, value: string) => void memory.set(name, value),
      removeItem: (name: string) => void memory.delete(name),
    }
    const { deps } = setup()
    const store = createSyncStore({ ...deps, storage })
    await store.init()
    deps.loadConfig.mockResolvedValue({ ...config, headSha: 'second' })
    await store.reload()
    const shaKeys = [...memory.keys()].filter((name) => name.includes(':sha:'))
    expect(shaKeys).toEqual(['adv360-editor:config:p:sha:second'])
  })
})

describe('sync dispose', () => {
  it('lets init run again after dispose cancels an in-flight init', async () => {
    const { store, deps } = setup()
    deps.getSession.mockResolvedValue(null as never)
    const first = store.init()
    store.dispose()
    await first
    await store.init()
    expect(store.getSnapshot().phase).toBe('signed-out')
  })
})
