import type { KeyboardProfile } from '../../lib/profile/types'
import type { BuildStatus } from '../../lib/github/types'
import type { GitHubClient } from './client'

/** Get the newest build and its successful artifacts. */
export async function getBuildStatus(
  client: GitHubClient,
  profile: KeyboardProfile,
  commitSha: string,
): Promise<BuildStatus> {
  const root = `/repos/${profile.repo.owner}/${profile.repo.name}`
  const workflow = profile.build.workflowPath.split('/').pop()
  type Run = {
    id: number
    status: NonNullable<BuildStatus['run']>['status']
    conclusion: string | null
    html_url: string
    created_at: string
    updated_at: string
  }
  const result = await client.get<{ workflow_runs: Run[] }>(
    `${root}/actions/workflows/${workflow}/runs?head_sha=${encodeURIComponent(commitSha)}&per_page=5`,
  )
  const run = result.workflow_runs.sort((left, right) =>
    right.created_at.localeCompare(left.created_at),
  )[0]
  if (!run) return { commitSha, run: null, artifacts: [] }
  let artifacts: BuildStatus['artifacts'] = []
  if (run.status === 'completed' && run.conclusion === 'success') {
    const response = await client.get<{
      artifacts: { id: number; name: string; size_in_bytes: number; expired: boolean }[]
    }>(`${root}/actions/runs/${run.id}/artifacts`)
    artifacts = response.artifacts.map((item) => ({
      id: item.id,
      name: item.name,
      sizeBytes: item.size_in_bytes,
      expired: item.expired,
      downloadPath: `/api/artifacts/${item.id}?profileId=${encodeURIComponent(profile.id)}`,
    }))
  }
  return {
    commitSha,
    run: {
      id: run.id,
      status: run.status,
      conclusion: run.conclusion,
      htmlUrl: run.html_url,
      createdAt: run.created_at,
      updatedAt: run.updated_at,
    },
    artifacts,
  }
}
