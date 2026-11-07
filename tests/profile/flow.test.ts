import { expect, it, vi } from 'vitest'
import { checkProfileSwitch } from '../../src/lib/profile/active'
import { ADV360_PROFILE } from '../../src/lib/profile/registry'
import { createEditorForProfile, validate } from '../../src/lib/zmk'
import { createSyncStore } from '../../src/lib/github-sync/store'
import { loadConfig } from '../../src/server/repo/config'
import { commitChanges } from '../../src/server/repo/commit'
import { getBuildStatus } from '../../src/server/repo/build'
import type { GitHubClient } from '../../src/server/repo/client'
import type { FileMap } from '../../src/lib/zmk/types'

const profile = {
  ...ADV360_PROFILE,
  id: 'fake',
  name: 'Fake',
  repo: { owner: 'test-owner', name: 'test-repo' },
  branch: 'stable',
  keymap: { path: 'config/fake.keymap', sharedAcrossParts: false },
  layout: {
    source: 'zmk-dts' as const,
    path: 'config/layout.dtsi',
    nodeLabel: 'fake_layout',
    keyCount: 2,
    verified: true,
  },
  build: { ...ADV360_PROFILE.build, workflowPath: '.github/workflows/fake.yml' },
}
const source: FileMap = {
  'config/fake.keymap':
    '#include "locale.h"\n/ { keymap { compatible = "zmk,keymap"; base { bindings = <&kp LOCAL_ALIAS &kp CUSTOM_UNKNOWN>; }; }; };',
  'config/locale.h': '#define LOCAL_ALIAS A\n',
  'config/layout.dtsi':
    '/ { fake_layout: layout { compatible = "zmk,physical-layout"; keys = <&key_physical_attrs 100 100 0 0 0 0 0>, <&key_physical_attrs 100 100 100 0 0 0 0>; }; };',
}

it('loads, validates, edits, commits and tracks a second profile', async () => {
  const calls: Array<{ path: string; body?: unknown }> = []
  const client = {
    get: vi.fn(async (path: string) => {
      calls.push({ path })
      if (path.includes('/actions/workflows/')) return { workflow_runs: [] }
      if (path.includes('/git/ref/')) return { object: { sha: 'head' } }
      if (path.includes('/git/trees/'))
        return {
          truncated: false,
          tree: Object.keys(source).map((name) => ({ path: name, type: 'blob', sha: name })),
        }
      if (path.includes('/git/blobs/'))
        return { content: Buffer.from(source[path.split('/git/blobs/')[1]]).toString('base64') }
      if (path.includes('/git/commits/')) return { tree: { sha: 'tree' } }
      throw new Error(`Unexpected ${path}`)
    }),
    write: vi.fn(async (_method: string, path: string, body: unknown) => {
      calls.push({ path, body })
      return path.endsWith('/git/commits') ? { sha: 'commit', html_url: 'url' } : { sha: 'tree' }
    }),
  } as unknown as GitHubClient
  let editor: ReturnType<typeof createEditorForProfile>
  const store = createSyncStore({
    profileId: profile.id,
    branch: profile.branch,
    getSession: async () => ({ login: 'test', name: null, avatarUrl: '' }),
    loadConfig: ({ branch }) => loadConfig(client, profile, branch),
    commitChanges: (request) => commitChanges(client, profile, request),
    getBuildStatus: ({ commitSha }) => getBuildStatus(client, profile, commitSha),
    now: () => new Date(),
    setTimeout: () => undefined,
    onLoaded: (files) => {
      editor = createEditorForProfile(profile, files)
    },
  })
  await store.init()
  expect(editor!.layout?.keys).toHaveLength(2)
  expect(
    validate(editor!.model, { physicalLayout: editor!.layout!.keys }).some(
      (issue) => issue.code === 'binding-count',
    ),
  ).toBe(false)
  expect(
    validate(editor!.model, { expectedKeyCount: 3 }).some(
      (issue) => issue.code === 'binding-count',
    ),
  ).toBe(true)
  expect(validate(editor!.model).some((issue) => issue.code === 'unknown-keycode')).toBe(true)
  expect(editor!.model.userKeycodes.some((key) => key.name === 'LOCAL_ALIAS')).toBe(true)
  editor!.setBinding(0, 1, '&kp 0x70004')
  const edited = editor!.serialize()
  expect(edited['config/fake.keymap']).toContain('LOCAL_ALIAS')
  expect(edited['config/fake.keymap']).toContain('0x70004')
  expect(
    validate(createEditorForProfile(profile, edited).model).filter(
      (issue) => issue.code === 'unknown-keycode',
    ),
  ).toHaveLength(2)
  await store.commit({
    message: 'save',
    branch: 'edit',
    changedFiles: { 'config/fake.keymap': edited['config/fake.keymap'] },
  })
  await vi.waitFor(() =>
    expect(
      calls.some((call) => call.path.includes('/actions/workflows/fake.yml/runs?head_sha=commit')),
    ).toBe(true),
  )
  expect(calls.every((call) => call.path.startsWith('/repos/test-owner/test-repo/'))).toBe(true)
  expect(calls.some((call) => call.path.endsWith('/git/refs/heads/edit'))).toBe(true)
  expect(calls.some((call) => JSON.stringify(call.body)?.includes('config/fake.keymap'))).toBe(true)
  store.dispose()
})

it('refuses a dirty profile switch unless explicitly discarded', () => {
  const profiles = [ADV360_PROFILE, profile]
  expect(checkProfileSwitch(profiles, 'adv360', 'fake', true)).toEqual({
    ok: false,
    reason: 'dirty',
  })
  expect(checkProfileSwitch(profiles, 'adv360', 'fake', true, true)).toEqual({ ok: true })
  expect(checkProfileSwitch(profiles, 'adv360', 'missing', false)).toEqual({
    ok: false,
    reason: 'unknown-profile',
  })
})
