import type { FileMap } from '../zmk/types'

/** The signed-in GitHub user, as the browser may see it (never includes tokens). */
export interface SessionUser {
  login: string
  name: string | null
  avatarUrl: string
}

/** Config files loaded from the repository at one commit. */
export interface LoadedConfig {
  profileId: string
  owner: string
  repo: string
  branch: string
  /** The commit the files were read at; the baseline for the next commit. */
  headSha: string
  /** Repo-relative paths (e.g. `config/adv360.keymap`) → text. */
  files: FileMap
  loadedAt: string
}

/** What the editor sends to commit its changes. Only changed files are included. */
export interface CommitRequest {
  profileId: string
  /** Branch to commit to. Created from `baseSha` if it does not exist. */
  branch: string
  /** The headSha the edits were made against; the commit is refused if the branch moved. */
  baseSha: string
  /** Explicitly permit committing to the profile default branch. */
  allowDefaultBranch?: boolean
  message: string
  /** Changed files only: repo-relative path → full new text. */
  files: FileMap
}

/** The result of a successful commit. */
export interface CommitResult {
  branch: string
  commitSha: string
  commitUrl: string
  /** Ref holding the branch's previous head, e.g. `editor-backup/20261107-1412-ab12cd3`. */
  backupRef: string | null
}

/** Firmware build state for one commit. */
export interface BuildStatus {
  commitSha: string
  /** null until GitHub has created a workflow run for the commit. */
  run: {
    id: number
    status: 'queued' | 'in_progress' | 'completed' | 'waiting' | 'requested' | 'pending'
    conclusion: string | null
    htmlUrl: string
    createdAt: string
    updatedAt: string
  } | null
  /** Present once the run completed successfully. Download through `downloadPath`. */
  artifacts: {
    id: number
    name: string
    sizeBytes: number
    expired: boolean
    downloadPath: string
  }[]
}

/** Error codes server functions throw (as `Error.message` prefix `code:`), for the UI. */
export type GitHubErrorCode =
  | 'not-signed-in'
  | 'not-allowed'
  | 'branch-moved'
  | 'not-found'
  | 'rate-limited'
  | 'github-error'
  | 'forbidden'
  | 'protected-branch'
  | 'remote-changed'
  | 'timeout'
  | 'transient-refresh'
