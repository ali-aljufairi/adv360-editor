import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import { BuildPanel } from '../components/github/BuildPanel'
import { AccountMenu, SignInButton, SyncHeader } from '../components/github/SyncHeader'
import { syncErrorText } from '../components/github/errorText'
import { ChangesBar, SyncFeedback } from '../components/github/ChangesBar'
import { ChangesDetails } from '../components/github/ChangesDetails'
import { SidePanel } from '../components/editor/SidePanel'
import type { BranchCommit, BuildStatus, CommitResult, SessionUser } from '../lib/github/types'
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

const HISTORY: BranchCommit[] = [
  {
    sha: COMMIT.commitSha,
    message: SUMMARY[0],
    url: COMMIT.commitUrl,
    author: 'Ali',
    date: SOURCE!.loadedAt,
    parentSha: 'a1b2c3d4e5f6a7b8c9d0',
  },
  {
    sha: 'a1b2c3d4e5f6a7b8c9d0',
    message: 'Previous keymap',
    url: '#',
    author: 'Ali',
    date: SOURCE!.loadedAt,
    parentSha: null,
  },
]

/** Local-only controls exercise success, loading, permission, and reversible states. */
function SyncPreview() {
  const [signedIn, setSignedIn] = useState(true)
  const [details, setDetails] = useState(false)
  const [message, setMessage] = useState(SUMMARY[0])
  const [dirty, setDirty] = useState(true)
  const [busy, setBusy] = useState(false)
  const [feedback, setFeedback] = useState<string | null>(null)
  const [build, setBuild] = useState<keyof typeof BUILDS>('success')
  const [remote, setRemote] = useState(false)
  const [timedOut, setTimedOut] = useState(false)
  const [error, setError] = useState<'forbidden' | 'branch-moved' | null>(null)
  const [permission, setPermission] = useState<'ready' | 'contents' | 'actions' | 'installation'>(
    'ready',
  )
  const [history, setHistory] = useState(HISTORY)
  const push = () => {
    setBusy(true)
    setTimeout(() => {
      setBusy(false)
      setDirty(false)
      setDetails(false)
      setFeedback(`Pushed ${COMMIT.commitSha.slice(0, 7)}`)
    }, 600)
  }
  const restore = () => {
    setBusy(true)
    setTimeout(() => {
      setBusy(false)
      setFeedback('Pushed abc1234')
      setHistory([
        { ...HISTORY[0], sha: 'abc1234', message: 'Restore keymap to a1b2c3d' },
        ...history,
      ])
    }, 600)
  }
  const permissionMessage =
    permission === 'contents'
      ? 'Pushing requires Contents: read and write. Update the GitHub App permissions and accept the installation update.'
      : permission === 'actions'
        ? 'Pushing is available. Grant Actions: read to see firmware builds.'
        : permission === 'installation'
          ? 'Give the GitHub App access to ali-aljufairi/Adv360-Pro-ZMK in its repository selection.'
          : null
  const accessUrl = 'https://github.com/ali-aljufairi/Adv360-Pro-ZMK/settings/installations'
  return (
    <div className="flex min-h-dvh flex-col gap-6 bg-canvas p-4 text-primary sm:p-6">
      <div className="flex flex-wrap gap-3 text-sm">
        <button type="button" onClick={() => setSignedIn((value) => !value)}>
          Toggle sign in
        </button>
        <button type="button" onClick={() => setRemote((value) => !value)}>
          Remote changed
        </button>
        <button type="button" onClick={() => setTimedOut((value) => !value)}>
          Build timed out
        </button>
        <button
          type="button"
          onClick={() => {
            setDirty(true)
            setFeedback(null)
          }}
        >
          Edit a key
        </button>
        <button type="button" onClick={() => setError('branch-moved')}>
          Branch conflict
        </button>
        <button type="button" onClick={() => setError('forbidden')}>
          Push forbidden
        </button>
        {(['ready', 'installation', 'contents', 'actions'] as const).map((name) => (
          <button
            key={name}
            type="button"
            onClick={() => {
              setPermission(name)
              setError(null)
            }}
          >
            {name} access
          </button>
        ))}
        {Object.keys(BUILDS).map((name) => (
          <button key={name} type="button" onClick={() => setBuild(name)}>
            Build {name}
          </button>
        ))}
      </div>
      <header className="flex flex-wrap items-center justify-end gap-x-4 gap-y-2 border-b border-subtle pb-3">
        <div className="mr-auto">
          {signedIn ? (
            <AccountMenu
              user={USER}
              onReload={() => undefined}
              onSignOut={() => setSignedIn(false)}
            />
          ) : (
            <SignInButton onSignIn={() => setSignedIn(true)} />
          )}
        </div>
        <SyncHeader
          phase={remote ? 'remote-changed' : signedIn ? 'ready' : 'signed-out'}
          user={signedIn ? USER : null}
          source={signedIn ? SOURCE : null}
          errorText={error ? syncErrorText({ code: error, message: '' }) : permissionMessage}
          accessUrl={permissionMessage || error === 'forbidden' ? accessUrl : null}
          onRetry={() => {
            setPermission('ready')
            setError(null)
          }}
          remoteSha={remote ? 'c0ffee1234567890' : null}
          onApplyRemote={() => setRemote(false)}
          onDismiss={() => {
            setError(null)
            setPermission('ready')
          }}
        />
      </header>
      <div className="flex min-h-0 flex-col gap-6 md:flex-row">
        <div className="min-w-0 flex-1">
          <div className="flex min-h-48 items-center justify-center text-muted">
            Keyboard preview
          </div>
          {details ? (
            <ChangesDetails
              diff={DIFF}
              summary={SUMMARY}
              message={message}
              onMessage={setMessage}
              branch="New editor branch · V3.0 stays untouched"
            />
          ) : null}
          <ChangesBar
            count={dirty ? 1 : 0}
            busy={busy}
            signedIn={signedIn}
            canPush={!remote && permission !== 'contents' && permission !== 'installation'}
            detailsOpen={details}
            onCommit={push}
            onDiscard={() => {
              setDirty(false)
              setDetails(false)
              setFeedback('Discarded')
            }}
            onDetails={() => setDetails((value) => !value)}
            onSignIn={() => setSignedIn(true)}
          />
          <SyncFeedback
            message={feedback}
            actionLabel={feedback === 'Discarded' ? 'Restore' : 'Undo'}
            disabled={busy || dirty}
            onAction={
              feedback === 'Discarded'
                ? () => {
                    setDirty(true)
                    setFeedback(null)
                  }
                : restore
            }
          />
        </div>
        <SidePanel title="Build & history" stacked onClose={() => undefined}>
          <BuildPanel
            commit={COMMIT}
            build={BUILDS[build]}
            buildTimedOut={timedOut}
            onRepoll={() => setTimedOut(false)}
            history={history}
            currentSha={history[0]?.sha}
            restoreDisabled={
              dirty || busy || permission === 'contents' || permission === 'installation'
            }
            onRestore={restore}
            onRefreshHistory={() => undefined}
            buildError={
              permission === 'actions' ? 'GitHub denied build access. Grant Actions: read.' : null
            }
            accessUrl={accessUrl}
          />
        </SidePanel>
      </div>
    </div>
  )
}
