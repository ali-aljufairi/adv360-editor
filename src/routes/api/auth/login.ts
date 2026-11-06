import { createFileRoute } from '@tanstack/react-router'
import { setCookie } from '@tanstack/react-start/server'
import { authorizeUrl } from '../../../server/auth/github-oauth'
import { cookieOptions } from '../../../server/auth/session'
import { sanitizeReturnTo } from '../../../server/auth/redirect'

export const Route = createFileRoute('/api/auth/login')({
  server: {
    handlers: {
      GET: ({ request }) => {
        const clientId = process.env.GITHUB_CLIENT_ID
        if (!clientId) throw new Error('github-error: GITHUB_CLIENT_ID is not configured')
        const url = new URL(request.url)
        const state = crypto.randomUUID()
        setCookie(
          'adv360_oauth_state',
          JSON.stringify({ state, returnTo: sanitizeReturnTo(url.searchParams.get('returnTo')) }),
          cookieOptions(600),
        )
        const redirectUri = `${process.env.APP_URL || url.origin}/api/auth/callback`
        return Response.redirect(authorizeUrl(clientId, redirectUri, state), 302)
      },
    },
  },
})
