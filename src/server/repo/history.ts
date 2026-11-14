import type { BranchCommit, RestoreRequest, RestoreResult } from '../../lib/github/types'
import type { KeyboardProfile } from '../../lib/profile/types'
import type { GitHubClient } from './client'
import { loadConfigAtSha } from './config'
import { commitChanges } from './commit'

/** Last ten commits, newest first, scoped to the current editor branch. */
export async function getBranchHistory(
  client: GitHubClient,
  profile: KeyboardProfile,
  branch: string,
): Promise<BranchCommit[]> {
  if (!branch.startsWith('editor/')) return []
  const commits = await client.get<
    {
      sha: string
      html_url: string
      parents: { sha: string }[]
      commit: { message: string; author: { name: string; date: string } | null }
    }[]
  >(
    `/repos/${profile.repo.owner}/${profile.repo.name}/commits?sha=${encodeURIComponent(branch)}&per_page=10`,
  )
  return commits.map((item) => ({
    sha: item.sha,
    url: item.html_url,
    message: item.commit.message.split('\n')[0],
    author: item.commit.author?.name ?? 'Unknown',
    date: item.commit.author?.date ?? '',
    parentSha: item.parents[0]?.sha ?? null,
  }))
}

/** Restore only config files with a new, non-forced commit; other repository files survive. */
export async function restoreConfig(
  client: GitHubClient,
  profile: KeyboardProfile,
  request: RestoreRequest,
): Promise<RestoreResult> {
  if (request.branch === profile.branch || !request.branch.startsWith('editor/'))
    throw new Error('protected-branch: history restoration requires an editor branch')
  if (!/^[a-f0-9]{40}$/i.test(request.targetSha))
    throw new Error('github-error: invalid target commit')
  const root = `/repos/${profile.repo.owner}/${profile.repo.name}`
  const ref = await client.get<{ object: { sha: string } }>(
    `${root}/git/ref/heads/${request.branch}`,
  )
  if (ref.object.sha !== request.baseSha) throw new Error('branch-moved: branch head changed')
  const current = await loadConfigAtSha(client, profile, ref.object.sha, request.branch)
  const comparison = await client.get<{ status: string }>(
    `${root}/compare/${request.targetSha}...${current.headSha}`,
  )
  if (comparison.status !== 'ahead' && comparison.status !== 'identical')
    throw new Error('github-error: restore target must be an ancestor of this branch')
  const target = await loadConfigAtSha(client, profile, request.targetSha, request.branch)
  const files = Object.fromEntries(
    Object.entries(target.files).filter(([path, text]) => current.files[path] !== text),
  )
  const deletePaths = Object.keys(current.files).filter((path) => !(path in target.files))
  if (!Object.keys(files).length && !deletePaths.length)
    throw new Error('github-error: this keymap version is already current')
  const commit = await commitChanges(client, profile, {
    profileId: profile.id,
    branch: request.branch,
    baseSha: current.headSha,
    message: `Restore keymap to ${request.targetSha.slice(0, 7)}`,
    files,
    deletePaths,
  })
  return {
    commit,
    config: { ...target, headSha: commit.commitSha, loadedAt: new Date().toISOString() },
  }
}
