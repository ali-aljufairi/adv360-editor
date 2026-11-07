import { useState } from 'react'
import type { FormEvent } from 'react'
import { ADV360_PROFILE } from '../../lib/profile/registry'

/** Props for the commit form. Plain data and callbacks only. */
export interface CommitFormProps {
  signedIn: boolean
  committing: boolean
  /** Prefilled branch name; the user may change it. */
  defaultBranch: string
  onSignIn(): void
  onCommit(input: { message: string; branch: string; allowDefaultBranch: boolean }): void
}

const DEFAULT_MESSAGE = 'Update keymap via adv360-editor'

/**
 * Commit message and branch for the pending changes, or a sign-in prompt when signed out.
 * @param props - Signed-in state, the default branch and the callbacks.
 * @returns The form.
 */
export function CommitForm({
  signedIn,
  committing,
  defaultBranch,
  onSignIn,
  onCommit,
}: CommitFormProps) {
  const [message, setMessage] = useState(DEFAULT_MESSAGE)
  const [branch, setBranch] = useState(defaultBranch)
  const [allowDefault, setAllowDefault] = useState(false)
  const defaultName = ADV360_PROFILE.branch
  const onDefault = branch.trim() === defaultName
  if (!signedIn) {
    return (
      <button
        type="button"
        onClick={onSignIn}
        className="self-start text-sm text-accent-primary underline underline-offset-4"
      >
        Sign in with GitHub to commit
      </button>
    )
  }
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const trimmedMessage = message.trim()
    const trimmedBranch = branch.trim()
    if (committing || !trimmedMessage || !trimmedBranch) return
    if (onDefault && !allowDefault) return
    onCommit({ message: trimmedMessage, branch: trimmedBranch, allowDefaultBranch: onDefault })
  }
  const field =
    'border-b border-subtle bg-transparent py-1 text-primary outline-none focus:border-accent-primary'
  return (
    <form onSubmit={submit} className="flex flex-col gap-3 text-sm">
      <label className="flex flex-col gap-1">
        <span className="text-muted">Commit message</span>
        <input
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          className={field}
        />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-muted">Branch</span>
        <input
          value={branch}
          onChange={(event) => {
            setBranch(event.target.value)
            setAllowDefault(false)
          }}
          className={field}
        />
        {onDefault ? (
          <span className="text-xs text-[var(--status-warning)]">
            {`This commits directly to ${defaultName}.`}
          </span>
        ) : (
          <span className="text-xs text-muted">
            {`Commits go to this branch; your ${defaultName} stays untouched`}
          </span>
        )}
      </label>
      {onDefault ? (
        <label className="flex items-center gap-2 text-secondary">
          <input
            type="checkbox"
            checked={allowDefault}
            onChange={(event) => setAllowDefault(event.target.checked)}
          />
          Allow committing to the default branch
        </label>
      ) : null}
      <button
        type="submit"
        disabled={committing || (onDefault && !allowDefault)}
        className="self-start text-sm font-medium text-accent-primary underline underline-offset-4 disabled:text-muted disabled:no-underline"
      >
        {committing ? 'Committing…' : 'Commit & build'}
      </button>
    </form>
  )
}
