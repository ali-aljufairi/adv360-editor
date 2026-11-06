import type { SessionUser } from '../../lib/github/types'

export interface Tokens {
  accessToken: string
  accessExpiresAt: number | null
  refreshToken: string | null
  refreshExpiresAt: number | null
}

function env(name: string): string {
  const value = process.env[name]
  if (!value) throw new Error(`github-error: ${name} is not configured`)
  return value
}

/** Build the GitHub authorization URL. */
export function authorizeUrl(clientId: string, redirectUri: string, state: string): string {
  const url = new URL('https://github.com/login/oauth/authorize')
  url.search = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    state,
  }).toString()
  return url.toString()
}

async function tokenRequest(
  params: Record<string, string>,
  fetcher: typeof fetch,
): Promise<Tokens> {
  const response = await fetcher('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: env('GITHUB_CLIENT_ID'),
      client_secret: env('GITHUB_CLIENT_SECRET'),
      ...params,
    }),
  })
  const data = (await response.json()) as Record<string, unknown>
  if (!response.ok || data.error || typeof data.access_token !== 'string') {
    throw new Error('github-error: token exchange failed')
  }
  const now = Date.now()
  return {
    accessToken: data.access_token,
    accessExpiresAt: typeof data.expires_in === 'number' ? now + data.expires_in * 1000 : null,
    refreshToken: typeof data.refresh_token === 'string' ? data.refresh_token : null,
    refreshExpiresAt:
      typeof data.refresh_token_expires_in === 'number'
        ? now + data.refresh_token_expires_in * 1000
        : null,
  }
}

/** Exchange an authorization code for user tokens. */
export function exchangeCode(
  code: string,
  redirectUri: string,
  fetcher: typeof fetch = fetch,
): Promise<Tokens> {
  return tokenRequest({ code, redirect_uri: redirectUri }, fetcher)
}

/** Refresh a GitHub App user token. */
export function refreshTokens(
  refreshToken: string,
  fetcher: typeof fetch = fetch,
): Promise<Tokens> {
  return tokenRequest({ grant_type: 'refresh_token', refresh_token: refreshToken }, fetcher)
}

/** Fetch the public fields of the authenticated user. */
export async function fetchUser(
  token: string,
  fetcher: typeof fetch = fetch,
): Promise<SessionUser> {
  const response = await fetcher('https://api.github.com/user', {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json' },
  })
  const data = (await response.json()) as Record<string, unknown>
  if (
    !response.ok ||
    data.error ||
    typeof data.login !== 'string' ||
    typeof data.avatar_url !== 'string'
  ) {
    throw new Error('github-error: failed to fetch user')
  }
  return {
    login: data.login,
    name: typeof data.name === 'string' ? data.name : null,
    avatarUrl: data.avatar_url,
  }
}
