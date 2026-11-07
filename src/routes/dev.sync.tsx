import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import { BuildPanel } from '../components/github/BuildPanel'
import { SyncHeader } from '../components/github/SyncHeader'
import { syncErrorText } from '../components/github/errorText'
import { ChangesSheet } from '../components/panels/ChangesSheet'
import { SidePanel } from '../components/editor/SidePanel'
import type { BuildStatus, CommitResult, SessionUser } from '../lib/github/types'
import type { SyncState } from '../lib/github-sync'

export const Route = createFileRoute('/dev/sync')({ component: SyncPreview })

/** A square placeholder avatar, so the preview works offline. */
const AVATAR = `data:image/svg+xml,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20"><rect width="20" height="20" fill="#7a8a9a"/></svg>',
)}`
const USER: SessionUser = { login: 'ali', name: 'Ali Aljufairi', avatarUrl: AVATAR }
const SOURCE: SyncState['source'] = {
  branch: 'V3.0',
  headSha: 'a1b2c3d4e5f6a7b8c9d0',
  loadedAt: '2026-11-07T10:00:00Z',
  fromCache: false,
}
const COMMIT: CommitResult = {
  branch: 'editor/20261107-1412',
  commitSha: 'f00dfeed12345678',
  commitUrl: 'https://github.com/example/adv360/commit/f00dfeed',
  backupRef: 'editor-backup/20261107-1412-ab12cd3',
}
const RUN = {
  id: 1,
  conclusion: null,
  htmlUrl: 'https://github.com/example/adv360/actions/runs/1',
  createdAt: '2026-11-07T14:12:00Z',
  updatedAt: '2026-11-07T14:13:00Z',
}
const BUILDS: Record<string, BuildStatus> = {
  queued: { commitSha: COMMIT.commitSha, run: { ...RUN, status: 'queued' }, artifacts: [] },
  running: { commitSha: COMMIT.commitSha, run: { ...RUN, status: 'in_progress' }, artifacts: [] },
  success: {
    commitSha: COMMIT.commitSha,
    run: { ...RUN, status: 'completed', conclusion: 'success' },
    artifacts: [
      {
        id: 1,
        name: 'adv360-left-uf2',
        sizeBytes: 1048576 * 0.9,
        expired: false,
        downloadPath: '#',
      },
      {
        id: 2,
        name: 'adv360-right-uf2',
        sizeBytes: 1048576 * 0.92,
        expired: false,
        downloadPath: '#',
      },
    ],
  },
}
const DIFF = {
  'config/adv360.keymap': '@@ -1,2 +1,2 @@\n-  &kp CAPS\n+  &kp ESC\n',
}
const SUMMARY = ['Base · key 12: Caps → Esc']

/**
 * Preview of the GitHub header, review sheet and build dock from plain mock props.
 * @returns The preview page.
 */
function SyncPreview() {
  const [signedIn, setSignedIn] = useState(true)
  const [sheet, setSheet] = useState(false)
  const [build, setBuild] = useState<keyof typeof BUILDS>('success')
  const [remote, setRemote] = useState(false)
  const [timedOut, setTimedOut] = useState(false)
  const errorCode = signedIn ? 'branch-moved' : 'not-allowed'
  return (
    <div className="flex min-h-dvh flex-col gap-6 bg-canvas p-6 text-primary">
      <div className="flex flex-wrap gap-3 text-sm">
        <button type="button" onClick={() => setSignedIn(true)}>
          signed in
        </button>
        <button type="button" onClick={() => setSignedIn(false)}>
          signed out
        </button>
        <button type="button" onClick={() => setRemote((value) => !value)}>
          remote changed
        </button>
        <button type="button" onClick={() => setTimedOut((value) => !value)}>
          build timed out
        </button>
        <button type="button" onClick={() => setSheet(true)}>
          open review
        </button>
        {Object.keys(BUILDS).map((name) => (
          <button key={name} type="button" onClick={() => setBuild(name)}>
            build {name}
          </button>
        ))}
      </div>
      <header
        id="mock-header"
        className="flex flex-wrap items-center justify-end gap-x-4 gap-y-2 border-b border-subtle pb-3"
      >
        <SyncHeader
          phase={remote ? 'remote-changed' : signedIn ? 'ready' : 'signed-out'}
          user={signedIn ? USER : null}
          source={signedIn ? SOURCE : null}
          errorText={syncErrorText({ code: errorCode, message: '' })}
          onRetry={() => undefined}
          remoteSha={remote ? 'c0ffee1234567890' : null}
          onApplyRemote={() => setRemote(false)}
          onSignIn={() => undefined}
          onSignOut={() => undefined}
          onReload={() => undefined}
          onDismiss={() => undefined}
        />
      </header>
      <div className="flex flex-wrap gap-6">
        <div className="relative h-[480px] w-[420px] border border-subtle">
          <SidePanel title="Build" onClose={() => undefined}>
            <BuildPanel
              commit={COMMIT}
              build={BUILDS[build]}
              buildTimedOut={timedOut}
              onRepoll={() => setTimedOut(false)}
            />
          </SidePanel>
        </div>
      </div>
      {sheet ? (
        <ChangesSheet
          diff={DIFF}
          summary={SUMMARY}
          onClose={() => setSheet(false)}
          onDiscard={() => setSheet(false)}
          commit={{
            signedIn,
            committing: false,
            defaultBranch: 'editor/20261107-1412',
            onSignIn: () => undefined,
            onCommit: () => undefined,
          }}
        />
      ) : null}
    </div>
  )
}
