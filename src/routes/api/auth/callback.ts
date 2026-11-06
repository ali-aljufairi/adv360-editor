import { createFileRoute } from '@tanstack/react-router'
import { deleteCookie, getCookie } from '@tanstack/react-start/server'
import { exchangeCode, fetchUser } from '../../../server/auth/github-oauth'
import { cookieOptions, isAllowed, setSession } from '../../../server/auth/session'
import { sanitizeReturnTo } from '../../../server/auth/redirect'

export const Route = createFileRoute('/api/auth/callback')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url)
        const raw = getCookie('adv360_oauth_state')
        deleteCookie('adv360_oauth_state', cookieOptions(0))
        let saved: { state?: string; returnTo?: string } = {}
        try {
          saved = JSON.parse(raw || '{}') as typeof saved
        } catch {
          /* invalid state */
        }
        const code = url.searchParams.get('code')
        if (!saved.state || saved.state !== url.searchParams.get('state') || !code) {
          return new Response('Invalid OAuth state', { status: 400 })
        }
        const tokens = await exchangeCode(
          code,
          `${process.env.APP_URL || url.origin}/api/auth/callback`,
        )
        const user = await fetchUser(tokens.accessToken)
        if (!isAllowed(user.login))
          return Response.redirect(new URL('/?auth=not-allowed', url), 302)
        await setSession({ user, ...tokens })
        return Response.redirect(new URL(sanitizeReturnTo(saved.returnTo ?? null), url), 302)
      },
    },
  },
})
