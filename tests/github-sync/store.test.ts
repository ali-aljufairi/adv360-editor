import { afterEach, describe, expect, it, vi } from 'vitest'
import { changedFiles, createSyncStore, defaultBranchName } from '../../src/lib/github-sync/store'
import type { BuildStatus, LoadedConfig } from '../../src/lib/github/types'

const fresh: LoadedConfig = {
  profileId: 'test',
  owner: 'owner',
  repo: 'repo',
  branch: 'main',
  headSha: 'old',
  files: { a: 'old' },
  loadedAt: '2026-01-01T00:00:00.000Z',
}
const result = { branch: 'main', commitSha: 'new', commitUrl: 'url', backupRef: null }
const user = { login: 'user', name: null, avatarUrl: 'avatar' }
const key = 'adv360-editor:config:test:main'

function setup() {
  const data = new Map<string, string>()
  const queue: (() => void)[] = []
  let time = new Date('2026-01-01T00:00:00Z')
  const deps = {
    profileId: 'test',
    branch: 'main',
    getSession: vi.fn(async () => user as typeof user | null),
    loadConfig: vi.fn(async () => fresh),
    commitChanges: vi.fn(async () => result),
    getBuildStatus: vi.fn(async (): Promise<BuildStatus> => ({
      commitSha: 'new',
      run: null,
      artifacts: [],
    })),
    storage: {
      getItem: (k: string) => data.get(k) ?? null,
      setItem: (k: string, value: string) => {
        data.set(k, value)
      },
      removeItem: (k: string) => {
        data.delete(k)
      },
    },
    now: () => time,
    setTimeout: (fn: () => void, delay: number) => {
      expect(delay).toBe(10000)
      queue.push(fn)
    },
    onLoaded: vi.fn(),
  }
  const store = createSyncStore(deps)
  return {
    store,
    deps,
    data,
    queue,
    setTime: (value: Date) => {
      time = value
    },
  }
}

async function flush() {
  await Promise.resolve()
  await Promise.resolve()
}
afterEach(() => {
  vi.unstubAllGlobals()
})

describe('sync store', () => {
  it('initializes signed out without loading', async () => {
    const { store, deps } = setup()
    deps.getSession.mockResolvedValue(null)
    await store.init()
    expect(store.getSnapshot().phase).toBe('signed-out')
    expect(deps.loadConfig).not.toHaveBeenCalled()
  })

  it('loads and caches a fresh config', async () => {
    const { store, deps, data } = setup()
    const phases: string[] = []
    store.subscribe(() => phases.push(store.getSnapshot().phase))
    await store.init()
    expect(phases).toContain('loading')
    expect(store.getSnapshot()).toMatchObject({ phase: 'ready', source: { fromCache: false } })
    expect(deps.onLoaded).toHaveBeenCalledExactlyOnceWith(fresh.files, 'old')
    expect(JSON.parse(data.get(key)!)).toEqual(fresh)
    expect(JSON.parse(data.get('adv360-editor:config:test:sha:old')!)).toEqual(fresh)
  })

  it('applies cache before revalidation', async () => {
    const { store, deps, data } = setup()
    const cached = { ...fresh, headSha: 'cached' }
    data.set(key, JSON.stringify(cached))
    let resolve!: (value: LoadedConfig) => void
    deps.loadConfig.mockReturnValue(
      new Promise((done) => {
        resolve = done
      }),
    )
    const init = store.init()
    await flush()
    expect(store.getSnapshot().source).toMatchObject({ headSha: 'cached', fromCache: true })
    expect(deps.onLoaded).toHaveBeenCalledWith(cached.files, 'cached')
    resolve(fresh)
    await init
    expect(store.getSnapshot().source).toMatchObject({ headSha: 'old', fromCache: false })
    expect(deps.onLoaded).toHaveBeenCalledTimes(2)
  })

  it.each([
    ['not-found: x', 'not-found'],
    ['oops', 'unknown'],
  ])('maps load error %s', async (message, code) => {
    const { store, deps } = setup()
    deps.loadConfig.mockRejectedValue(new Error(message))
    await store.init()
    expect(store.getSnapshot()).toMatchObject({ phase: 'error', error: { code, message } })
  })

  it('commits the baseline and polls until completed', async () => {
    const { store, deps, data, queue } = setup()
    await store.init()
    await store.commit({ message: 'save', branch: 'main', changedFiles: { a: 'new' } })
    expect(deps.commitChanges).toHaveBeenCalledWith({
      profileId: 'test',
      branch: 'main',
      baseSha: 'old',
      message: 'save',
      files: { a: 'new' },
    })
    expect(store.getSnapshot()).toMatchObject({ source: { headSha: 'new' }, lastCommit: result })
    expect(JSON.parse(data.get(key)!)).toMatchObject({ headSha: 'new', files: { a: 'new' } })
    expect(deps.onLoaded).toHaveBeenLastCalledWith({ a: 'new' }, 'new')
    await flush()
    expect(queue).toHaveLength(1)
    deps.getBuildStatus.mockResolvedValue({
      commitSha: 'new',
      artifacts: [],
      run: {
        id: 1,
        status: 'completed',
        conclusion: 'success',
        htmlUrl: '',
        createdAt: '',
        updatedAt: '',
      },
    })
    queue.shift()!()
    await flush()
    expect(store.getSnapshot().build?.run?.status).toBe('completed')
    expect(queue).toHaveLength(0)
  })

  it.each(['cap', 'stop'])('stops polling on %s', async (reason) => {
    const { store, deps, queue, setTime } = setup()
    await store.init()
    await store.commit({ message: 'save', branch: 'main', changedFiles: {} })
    await flush()
    if (reason === 'cap') setTime(new Date('2026-01-01T00:30:00Z'))
    else store.stopPolling()
    queue.shift()!()
    await flush()
    expect(deps.getBuildStatus).toHaveBeenCalledTimes(1)
    expect(queue).toHaveLength(0)
  })

  it('preserves the baseline after a branch-moved error', async () => {
    const { store, deps, data } = setup()
    await store.init()
    deps.commitChanges.mockRejectedValue(new Error('branch-moved: changed'))
    await store.commit({ message: 'save', branch: 'main', changedFiles: { a: 'new' } })
    expect(store.getSnapshot()).toMatchObject({
      phase: 'ready',
      source: { headSha: 'old' },
      error: { code: 'branch-moved' },
    })
    expect(JSON.parse(data.get(key)!)).toEqual(fresh)
    expect(deps.onLoaded).toHaveBeenCalledTimes(1)
  })

  it('logs out and clears state and cache', async () => {
    const { store, data } = setup()
    const fetchMock = vi.fn(async () => new Response())
    vi.stubGlobal('fetch', fetchMock)
    await store.init()
    await store.signOut()
    expect(fetchMock).toHaveBeenCalledWith('/api/auth/logout', { method: 'POST' })
    expect(data.size).toBe(0)
    expect(store.getSnapshot()).toEqual({
      phase: 'signed-out',
      user: null,
      source: null,
      error: null,
      build: null,
      lastCommit: null,
      remoteSha: null,
      buildTimedOut: false,
    })
  })
})

it('returns changed and added files and formats local branch names', () => {
  expect(
    changedFiles({ a: 'same', b: 'old', c: 'deleted' }, { a: 'same', b: 'new', d: 'add' }),
  ).toEqual({ b: 'new', d: 'add' })
  expect(defaultBranchName(new Date(2026, 0, 2, 3, 4))).toBe('editor/20260102-0304')
})
