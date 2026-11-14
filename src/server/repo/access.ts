import type { KeyboardProfile } from '../../lib/profile/types'
import type { RepositoryAccess } from '../../lib/github/types'
import type { GitHubClient } from './client'

type Installation = {
  id: number
  account: { login: string; type: string }
  permissions: { contents?: string; actions?: string }
  suspended_at: string | null
}

/** User-token installation endpoints only return installations belonging to this App. */
export async function getRepositoryAccess(
  client: GitHubClient,
  profile: KeyboardProfile,
): Promise<RepositoryAccess> {
  const { owner, name } = profile.repo
  const repo = `${owner}/${name}`
  let installation: Installation | undefined
  for (let page = 1; ; page++) {
    const result = await client.get<{ installations: Installation[] }>(
      `/user/installations?per_page=100&page=${page}`,
    )
    installation = result.installations.find(
      (item) => item.account.login.toLowerCase() === owner.toLowerCase(),
    )
    if (installation || result.installations.length < 100) break
  }
  const slug = process.env.GITHUB_APP_SLUG
  const fallback = slug
    ? `https://github.com/apps/${encodeURIComponent(slug)}/installations/new`
    : `https://github.com/${owner}/${name}/settings/installations`
  const result = (
    reason: RepositoryAccess['reason'],
    message: string | null,
    canPush = false,
    canReadBuilds = false,
    settingsUrl = fallback,
  ): RepositoryAccess => ({ reason, message, canPush, canReadBuilds, settingsUrl })
  if (!installation)
    return result(
      'not-installed',
      `Install the GitHub App on ${repo} and grant Contents: read and write, and Actions: read.`,
    )
  const settingsUrl =
    installation.account.type === 'Organization'
      ? `https://github.com/organizations/${owner}/settings/installations/${installation.id}`
      : `https://github.com/settings/installations/${installation.id}`
  if (installation.suspended_at)
    return result(
      'suspended',
      `The GitHub App installation for ${repo} is suspended. Resume it in GitHub.`,
      false,
      false,
      settingsUrl,
    )
  let selected = false
  let userCanPush = false
  for (let page = 1; ; page++) {
    const repos = await client.get<{
      repositories: { full_name: string; permissions?: { push?: boolean } }[]
    }>(`/user/installations/${installation.id}/repositories?per_page=100&page=${page}`)
    const match = repos.repositories.find(
      (item) => item.full_name.toLowerCase() === repo.toLowerCase(),
    )
    if (match) {
      selected = true
      userCanPush = match.permissions?.push !== false
      break
    }
    if (repos.repositories.length < 100) break
  }
  if (!selected)
    return result(
      'repo-not-selected',
      `Give the GitHub App access to ${repo} in its repository selection.`,
      false,
      false,
      settingsUrl,
    )
  const canPush = installation.permissions.contents === 'write' && userCanPush
  const canReadBuilds = ['read', 'write'].includes(installation.permissions.actions ?? '')
  if (!canPush)
    return result(
      'contents-readonly',
      `Pushing to ${repo} requires Contents: read and write for the GitHub App and write access for your account. Update the App permissions and accept the installation update.`,
      false,
      canReadBuilds,
      settingsUrl,
    )
  if (!canReadBuilds)
    return result(
      'actions-readonly',
      `Pushing is available. To see firmware builds for ${repo}, grant the GitHub App Actions: read and accept the installation update.`,
      true,
      false,
      settingsUrl,
    )
  return result('ready', null, true, true, settingsUrl)
}
