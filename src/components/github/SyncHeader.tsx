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
  /** Retry handler; null hides the Retry action. */
  onRetry: (() => void) | null
  onSignIn(): void
  onSignOut(): void
  onReload(): void
  onDismiss(): void
}

/**
 * Sign-in or account menu, the source line and the error line for the top bar. Renders plain
 * inline items so the caller decides where they sit.
 * @param props - Sync state and actions.
 * @returns The header items.
 */
export function SyncHeader({
  phase,
  user,
  source,
  errorText,
  onRetry,
  onSignIn,
  onSignOut,
  onReload,
  onDismiss,
}: SyncHeaderProps) {
  return (
    <>
      {phase === 'loading' ? <span className="text-sm text-muted">Loading…</span> : null}
      {!user && phase !== 'loading' ? (
        <button
          type="button"
          onClick={onSignIn}
          className="px-1 py-1 text-sm text-secondary hover:text-primary"
        >
          Sign in with GitHub
        </button>
      ) : null}
      {user ? <AccountMenu user={user} onReload={onReload} onSignOut={onSignOut} /> : null}
      {user && source && phase !== 'loading' ? (
        <span className="hidden text-sm text-muted sm:inline">
          {`${source.branch} @ ${source.headSha.slice(0, 7)}${source.fromCache ? ' · cached' : ''}`}
        </span>
      ) : null}
      {errorText ? (
        <p role="alert" className="basis-full text-right text-sm text-[var(--status-error)]">
          {errorText}
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
function AccountMenu({
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
          className="absolute right-0 top-full z-30 mt-1 flex min-w-44 flex-col border border-subtle bg-raised py-1 text-sm"
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
