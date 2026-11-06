import type { GitHubErrorCode } from '../../lib/github/types'

/** Short, human sentences for sync error codes. */
const messages: Partial<Record<GitHubErrorCode, string>> = {
  'not-signed-in': 'Session expired — sign in again',
  'not-allowed': "This GitHub account isn't allowed",
  'branch-moved': 'The branch changed on GitHub — reload, then re-apply your edits',
  'rate-limited': 'GitHub rate limit — try again shortly',
}

/**
 * Turns a sync error into the sentence shown in the header.
 * @param error - The error code and the raw message from the sync store.
 * @returns A short message for the user.
 */
export function syncErrorText(error: { code: string; message: string }): string {
  const known = messages[error.code as GitHubErrorCode]
  return known ?? error.message
}
