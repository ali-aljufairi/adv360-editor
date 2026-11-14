import { describe, expect, it, vi } from 'vitest'
import { createSyncStore, defaultCommitMessage } from '../../src/lib/github-sync/store'
import type { CommitRequest, LoadedConfig } from '../../src/lib/github/types'

const config: LoadedConfig = {
  profileId: 'p',
  owner: 'ali',
  repo: 'config',
  branch: 'V3.0',
  headSha: 'old',
  files: { a: 'old' },
  loadedAt: '',
}
function setup() {
  let dirty = false
  const memory = new Map<string, string>()
  const deps = {
    profileId: 'p',
    branch: 'V3.0',
    getSession: vi.fn(async () => ({ login: 'ali', name: null, avatarUrl: '' })),
    loadConfig: vi.fn(async () => config),
    commitChanges: vi.fn(async (request: CommitRequest) => ({
      branch: request.branch,
      commitSha: 'new',
      commitUrl: 'url',
      backupRef: null,
    })),
    restoreConfig: vi.fn(async () => ({
      commit: { branch: 'editor/test', commitSha: 'restore', commitUrl: 'url', backupRef: null },
      config: { ...config, branch: 'editor/test', headSha: 'restore' },
    })),
    getBuildStatus: vi.fn(async () => ({ commitSha: 'new', run: null, artifacts: [] })),
    getBranchHistory: vi.fn(async () => []),
    now: () => new Date(2026, 0, 2, 3, 4),
    setTimeout: vi.fn(),
    onLoaded: vi.fn(),
    isDirty: () => dirty,
    storage: {
      getItem: (key: string) => memory.get(key) ?? null,
      setItem: (key: string, value: string) => {
        memory.set(key, value)
      },
      removeItem: (key: string) => {
        memory.delete(key)
      },
    },
  }
  return {
    deps,
    store: createSyncStore(deps),
    memory,
    setDirty: (value: boolean) => {
      dirty = value
    },
  }
}
const push = { message: 'Update', changedFiles: { a: 'new' } }
const flush = async () => {
  await Promise.resolve()
  await Promise.resolve()
}

describe('one-click push and restore', () => {
  it('automatically creates a branch, reuses it, and remembers it after remount', async () => {
    const { store, deps } = setup()
    await store.init()
    await store.commit(push)
    const branch = deps.commitChanges.mock.calls[0][0].branch
    expect(branch).toMatch(/^editor\/20260102-0304-/)
    expect(store.getSnapshot().undoSha).toBe('old')
    await store.commit({ ...push, changedFiles: { a: 'newer' } })
    expect(deps.commitChanges.mock.calls[1][0]).toMatchObject({ branch, baseSha: 'new' })
    const remounted = createSyncStore(deps)
    await remounted.init()
    expect(deps.loadConfig).toHaveBeenLastCalledWith({ profileId: 'p', branch })
  })
  it('keeps a stable destination on a failed push and preserves local baseline', async () => {
    const { store, deps } = setup()
    await store.init()
    deps.commitChanges.mockRejectedValueOnce(new Error('forbidden: POST /git/refs'))
    await store.commit(push)
    expect(store.getSnapshot()).toMatchObject({
      source: { headSha: 'old' },
      error: { code: 'forbidden' },
    })
    await store.commit(push)
    expect(deps.commitChanges.mock.calls[0][0].branch).toBe(
      deps.commitChanges.mock.calls[1][0].branch,
    )
  })
  it('ignores duplicate pushes and reloads during a write', async () => {
    const { store, deps } = setup()
    await store.init()
    let resolve!: (result: Awaited<ReturnType<typeof deps.commitChanges>>) => void
    deps.commitChanges.mockReturnValueOnce(
      new Promise((done) => {
        resolve = done
      }),
    )
    const pending = store.commit(push)
    await store.commit(push)
    await store.reload()
    expect(deps.commitChanges).toHaveBeenCalledTimes(1)
    expect(deps.loadConfig).toHaveBeenCalledTimes(1)
    resolve({ branch: 'editor/test', commitSha: 'new', commitUrl: 'url', backupRef: null })
    await pending
  })
  it('separates Actions permission errors from successful pushes', async () => {
    const { store, deps } = setup()
    deps.getBuildStatus.mockRejectedValue(
      new Error('forbidden: GET /actions/workflows/build.yml/runs'),
    )
    await store.init()
    await store.commit(push)
    await flush()
    expect(store.getSnapshot()).toMatchObject({
      error: null,
      lastCommit: { commitSha: 'new' },
      buildError: { code: 'forbidden' },
    })
  })
  it('restores through a new commit and refuses to overwrite local edits', async () => {
    const { store, deps, setDirty } = setup()
    await store.init()
    await store.commit(push)
    setDirty(true)
    await store.restore('old')
    expect(deps.restoreConfig).not.toHaveBeenCalled()
    setDirty(false)
    await store.restore('old')
    expect(deps.restoreConfig).toHaveBeenCalledWith(
      expect.objectContaining({ baseSha: 'new', targetSha: 'old' }),
    )
    expect(deps.onLoaded).toHaveBeenLastCalledWith(config.files, 'restore')
    expect(store.getSnapshot()).toMatchObject({ source: { headSha: 'restore' }, undoSha: 'new' })
  })
  it('generates messages without requiring a form', () => {
    expect(defaultCommitMessage(['Base · key 12: Caps → Esc'])).toBe('Base · key 12: Caps → Esc')
    expect(defaultCommitMessage(['one', 'two', 'three'])).toBe('Update keymap (3 changes)')
  })
})
