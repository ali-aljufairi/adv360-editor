import type { KeyboardProfile } from '../../lib/profile/types'
import type { CommitRequest, CommitResult } from '../../lib/github/types'
import type { GitHubClient } from './client'

/** Commit changes against an unchanged branch head. */
export async function commitChanges(
  client: GitHubClient,
  profile: KeyboardProfile,
  request: CommitRequest,
): Promise<CommitResult> {
  if (request.branch === profile.branch && !request.allowDefaultBranch)
    throw new Error('protected-branch: default branch requires explicit approval')
  const entries = Object.entries(request.files)
  const deleted = request.deletePaths ?? []
  if (
    (!entries.length && !deleted.length) ||
    [...entries.map(([path]) => path), ...deleted].some(
      (path) =>
        !path.startsWith(`${profile.configRoot}/`) ||
        path.split('/').some((part) => part === '..' || part === '') ||
        path.includes('\\'),
    )
  )
    throw new Error('github-error: invalid file paths')
  const root = `/repos/${profile.repo.owner}/${profile.repo.name}`
  let head: string
  let existing = true
  try {
    head = (
      await client.get<{ object: { sha: string } }>(`${root}/git/ref/heads/${request.branch}`)
    ).object.sha
  } catch (error) {
    if (!(error instanceof Error) || !error.message.startsWith('not-found:')) throw error
    existing = false
    head = request.baseSha
    await client.write('POST', `${root}/git/refs`, {
      ref: `refs/heads/${request.branch}`,
      sha: head,
    })
  }
  if (head !== request.baseSha) throw new Error('branch-moved: branch head changed')
  let backupRef: string | null = null
  if (existing) {
    const stamp = new Date().toISOString().replace(/[-:]/g, '').slice(0, 13).replace('T', '-')
    backupRef = `editor-backup/${stamp}-${head.slice(0, 7)}`
    const base = backupRef
    for (;;) {
      try {
        await client.write('POST', `${root}/git/refs`, {
          ref: `refs/heads/${backupRef}`,
          sha: head,
        })
        break
      } catch (error) {
        if (!(error instanceof Error) || !error.message.startsWith('ref-exists:')) throw error
        const existingRef = await client.get<{ object: { sha: string } }>(
          `${root}/git/ref/heads/${backupRef}`,
        )
        if (existingRef.object.sha === head) break
        backupRef = `${base}-${crypto.randomUUID().slice(0, 8)}`
      }
    }
  }
  const commit = await client.get<{ tree: { sha: string } }>(`${root}/git/commits/${head}`)
  const tree: { path: string; mode: string; type: string; sha: string | null }[] = []
  for (const [path, content] of entries) {
    const blob = await client.write<{ sha: string }>('POST', `${root}/git/blobs`, {
      content,
      encoding: 'utf-8',
    })
    tree.push({ path, mode: '100644', type: 'blob', sha: blob.sha })
  }
  for (const path of deleted) tree.push({ path, mode: '100644', type: 'blob', sha: null })
  const createdTree = await client.write<{ sha: string }>('POST', `${root}/git/trees`, {
    base_tree: commit.tree.sha,
    tree,
  })
  const created = await client.write<{ sha: string; html_url: string }>(
    'POST',
    `${root}/git/commits`,
    { message: request.message, tree: createdTree.sha, parents: [head] },
  )
  await client.write('PATCH', `${root}/git/refs/heads/${request.branch}`, {
    sha: created.sha,
    force: false,
  })
  return { branch: request.branch, commitSha: created.sha, commitUrl: created.html_url, backupRef }
}
