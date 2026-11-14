import type { GitHubErrorCode } from '../../lib/github/types'

/** Short, human sentences for sync error codes. */
const messages: Partial<Record<GitHubErrorCode, string>> = {
  'not-signed-in': 'Session expired — sign in again',
  forbidden:
    'GitHub denied this request. Check the App’s repository selection and Contents: write / Actions: read permissions',
  'not-found':
    'GitHub could not find this branch or repository. Check the branch and the App’s repository access',
  'protected-branch': 'Choose another branch or explicitly allow the default branch',
  'remote-changed':
    'The configuration changed on GitHub. Load the remote version before pushing or reverting',
  'local-changes': 'Push or discard your local edits before reverting history',
  timeout: 'The build is taking too long; check again',
  'transient-refresh': 'Could not refresh your session; try again',
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
