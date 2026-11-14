const action =
  'px-2 py-1 text-sm text-secondary hover:text-primary focus-visible:outline-2 focus-visible:outline-focus-ring disabled:text-muted disabled:cursor-not-allowed'

/** Compact, non-modal save controls; details are always optional. */
export function ChangesBar({
  count,
  busy,
  canPush,
  signedIn,
  detailsOpen,
  onCommit,
  onDiscard,
  onDetails,
  onSignIn,
}: {
  count: number
  busy: boolean
  canPush: boolean
  signedIn: boolean
  detailsOpen: boolean
  onCommit(): void
  onDiscard(): void
  onDetails(): void
  onSignIn(): void
}) {
  if (count === 0 && !busy) return null
  return (
    <div
      aria-label="Unsaved changes"
      aria-busy={busy}
      className="flex shrink-0 flex-wrap items-center justify-end gap-x-3 gap-y-1 border-t border-subtle bg-canvas px-4 py-2"
    >
      <span className="mr-auto text-sm tabular-nums text-muted">
        {count} {count === 1 ? 'change' : 'changes'}
      </span>
      <button
        type="button"
        className={action}
        aria-expanded={detailsOpen}
        aria-controls="change-details"
        disabled={busy}
        onClick={onDetails}
      >
        Details
      </button>
      <button type="button" className={action} disabled={busy} onClick={onDiscard}>
        Discard
      </button>
      <button
        type="button"
        disabled={busy || (signedIn && !canPush)}
        onClick={signedIn ? onCommit : onSignIn}
        className={`${action} min-w-32 font-medium text-accent-primary`}
      >
        {busy ? 'Pushing…' : signedIn ? 'Commit & push' : 'Sign in to push'}
      </button>
    </div>
  )
}

/** Persistent live region for the latest reversible action; never takes focus. */
export function SyncFeedback({
  message,
  actionLabel,
  onAction,
  disabled = false,
}: {
  message: string | null
  actionLabel?: string
  onAction?: () => void
  disabled?: boolean
}) {
  return (
    <div
      className={
        message
          ? 'flex shrink-0 flex-wrap items-center justify-end gap-2 border-t border-subtle bg-canvas px-4 py-2 text-sm'
          : ''
      }
    >
      <p role="status" aria-live="polite" aria-atomic="true" className="text-secondary">
        {message}
      </p>
      {message && onAction ? (
        <button
          type="button"
          className={`${action} underline underline-offset-4`}
          disabled={disabled}
          onClick={onAction}
        >
          {actionLabel}
        </button>
      ) : null}
    </div>
  )
}
