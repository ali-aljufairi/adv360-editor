import { useEffect, useRef, useState } from 'react'
import type { SessionUser } from '../../lib/github/types'
import type { SyncState } from '../../lib/github-sync'

/** Props for the GitHub part of the top bar. Plain data and callbacks only. */
export interface SyncHeaderProps {
  phase: SyncState['phase']
  user: SessionUser | null
  source: SyncState['source']
  /** Sentence to show, or null when there is nothing to report. */
  errorText: string | null
  /** Exact installation settings page, or the repo integrations page. */
  accessUrl?: string | null
  diagnostic?: string
  /** Retry handler; null hides the Retry action. */
  onRetry: (() => void) | null
  /** SHA of the newer GitHub version, set while phase is remote-changed. */
  remoteSha: string | null
  onApplyRemote(): void
  onDismiss(): void
}

/**
 * Sign-in button shown on the left of the top bar while signed out.
 * @param props - The click handler.
 * @returns The button.
 */
export function SignInButton({ onSignIn }: { onSignIn(): void }) {
  return (
    <button
      type="button"
      onClick={onSignIn}
      className="flex items-center gap-1.5 px-1 py-1 text-sm text-secondary hover:text-primary"
    >
      <svg aria-hidden="true" width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
        <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
      </svg>
      Sign in with GitHub
    </button>
  )
}

/**
 * Account menu, the source line and the error line for the top bar. Renders plain inline items
 * so the caller decides where they sit. The signed-out sign-in button is rendered separately
 * with SignInButton.
 * @param props - Sync state and actions.
 * @returns The header items.
 */
export function SyncHeader({
  phase,
  user,
  source,
  errorText,
  accessUrl,
  diagnostic,
  onRetry,
  remoteSha,
  onApplyRemote,
  onDismiss,
}: SyncHeaderProps) {
  const [confirmRemote, setConfirmRemote] = useState(false)
  const loadRemote = () => {
    if (confirmRemote) {
      onApplyRemote()
      setConfirmRemote(false)
    } else setConfirmRemote(true)
  }
  return (
    <>
      {phase === 'loading' ? <span className="text-sm text-muted">Loading…</span> : null}
      {phase === 'remote-changed' && remoteSha ? (
        <p role="alert" className="basis-full text-right text-sm text-[var(--status-warning)]">
          {`Changed on GitHub (${remoteSha.slice(0, 7)})`}
          <button type="button" onClick={loadRemote} className="ml-3 underline underline-offset-4">
            {confirmRemote ? 'Discard edits & load remote' : 'Load remote'}
          </button>
          {confirmRemote ? (
            <button
              type="button"
              className="ml-3 text-muted"
              onClick={() => setConfirmRemote(false)}
            >
              Cancel
            </button>
          ) : null}
        </p>
      ) : null}
      {user && source && phase !== 'loading' ? (
        <span className="hidden text-sm text-muted sm:inline">
          {`${source.branch} @ ${source.headSha.slice(0, 7)}${source.fromCache ? ' · cached' : ''}`}
        </span>
      ) : null}
      {errorText ? (
        <p role="alert" className="basis-full text-right text-sm text-[var(--status-error)]">
          <span title={diagnostic}>{errorText}</span>
          {accessUrl ? (
            <a
              href={accessUrl}
              target="_blank"
              rel="noreferrer"
              className="ml-3 underline underline-offset-4"
            >
              Manage GitHub App access
            </a>
          ) : null}
          {onRetry ? (
            <button type="button" onClick={onRetry} className="ml-3 underline underline-offset-4">
              Retry
            </button>
          ) : null}
          <button type="button" onClick={onDismiss} className="ml-3 text-muted hover:text-primary">
            Dismiss
          </button>
        </p>
      ) : null}
    </>
  )
}

/**
 * The signed-in account: a square avatar and login that opens a small menu.
 * @param props - The user and the menu actions.
 * @returns The account button and its menu.
 */
export function AccountMenu({
  user,
  onReload,
  onSignOut,
}: {
  user: SessionUser
  onReload(): void
  onSignOut(): void
}) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const onPointer = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onPointer)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onPointer)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])
  const choose = (action: () => void) => {
    setOpen(false)
    action()
  }
  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
        className="flex items-center gap-2 px-1 py-1 text-sm text-secondary hover:text-primary"
      >
        <img src={user.avatarUrl} alt="" width={20} height={20} className="size-5 rounded-none" />
        <span>{user.login}</span>
      </button>
      {open ? (
        <div
          role="menu"
          className="absolute left-0 top-full z-30 mt-1 flex min-w-44 flex-col border border-subtle bg-raised py-1 text-sm"
        >
          <button
            type="button"
            role="menuitem"
            onClick={() => choose(onReload)}
            className="px-3 py-1.5 text-left text-secondary hover:text-primary"
          >
            Reload from GitHub
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={() => choose(onSignOut)}
            className="px-3 py-1.5 text-left text-secondary hover:text-primary"
          >
            Sign out
          </button>
        </div>
      ) : null}
    </div>
  )
}
