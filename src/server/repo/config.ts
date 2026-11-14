import type { KeyboardProfile } from '../../lib/profile/types'
import type { LoadedConfig } from '../../lib/github/types'
import type { GitHubClient } from './client'

/** Load text configuration files at a branch head. */
export async function loadConfig(
  client: GitHubClient,
  profile: KeyboardProfile,
  branch = profile.branch,
): Promise<LoadedConfig> {
  const root = `/repos/${profile.repo.owner}/${profile.repo.name}`
  const ref = await client.get<{ object: { sha: string } }>(`${root}/git/ref/heads/${branch}`)
  return loadConfigAtSha(client, profile, ref.object.sha, branch)
}

/** Load immutable config content for history restoration. */
export async function loadConfigAtSha(
  client: GitHubClient,
  profile: KeyboardProfile,
  headSha: string,
  branch: string,
): Promise<LoadedConfig> {
  const root = `/repos/${profile.repo.owner}/${profile.repo.name}`
  const tree = await client.get<{
    tree: { path: string; type: string; sha: string }[]
    truncated: boolean
  }>(`${root}/git/trees/${headSha}?recursive=1`)
  if (tree.truncated) throw new Error('github-error: truncated tree')
  const entries = tree.tree.filter(
    (entry) =>
      entry.type === 'blob' &&
      entry.path.startsWith(`${profile.configRoot}/`) &&
      /\.(keymap|dtsi|dts|h|json|conf|yml|yaml|overlay)$/i.test(entry.path),
  )
  const files: Record<string, string> = {}
  let index = 0
  await Promise.all(
    Array.from({ length: Math.min(6, entries.length) }, async () => {
      while (index < entries.length) {
        const entry = entries[index++]
        const blob = await client.get<{ content: string }>(`${root}/git/blobs/${entry.sha}`)
        files[entry.path] = Buffer.from(blob.content, 'base64').toString('utf8')
      }
    }),
  )
  return {
    profileId: profile.id,
    owner: profile.repo.owner,
    repo: profile.repo.name,
    branch,
    headSha,
    files,
    loadedAt: new Date().toISOString(),
  }
}
