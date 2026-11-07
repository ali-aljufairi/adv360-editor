import { createFileRoute } from '@tanstack/react-router'
import { ADV360_PROFILE } from '../../../lib/profile/registry'

export const Route = createFileRoute('/api/artifacts/$id')({
  server: {
    handlers: {
      GET: async ({ params }) => {
        if (!/^\d+$/.test(params.id)) return new Response('Invalid artifact', { status: 400 })
        try {
          const { requireGitHubToken } = await import('../../../server/auth/session')
          const { GitHubClient } = await import('../../../server/repo/client')
          const { token, user } = await requireGitHubToken()
          const client = new GitHubClient(token, user.login)
          const root = `/repos/${ADV360_PROFILE.repo.owner}/${ADV360_PROFILE.repo.name}/actions/artifacts/${params.id}`
          const artifact = await client.get<{ name: string }>(root)
          const redirect = await client.raw(`${root}/zip`, { redirect: 'manual' })
          const location = redirect.headers.get('location')
          if (!location || redirect.status < 300 || redirect.status >= 400)
            return new Response('Download unavailable', { status: 502 })
          const download = await fetch(location)
          if (!download.ok) return new Response('Download unavailable', { status: 502 })
          const filename = artifact.name.replace(/[\r\n"\\]/g, '_')
          return new Response(download.body, {
            headers: {
              'Content-Type': 'application/zip',
              'Content-Disposition': `attachment; filename="${filename}.zip"`,
            },
          })
        } catch (error) {
          const message = error instanceof Error ? error.message : ''
          const status = message.startsWith('not-signed-in:')
            ? 401
            : message.startsWith('not-found:')
              ? 404
              : 502
          return Response.json(
            {
              error:
                status === 401
                  ? 'Sign in required'
                  : status === 404
                    ? 'Artifact not found'
                    : 'Download unavailable',
            },
            { status },
          )
        }
      },
    },
  },
})
