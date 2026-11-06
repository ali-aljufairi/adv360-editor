import '@tanstack/react-start/server-only'
import { deleteCookie, getCookie, getRequest, setCookie } from '@tanstack/react-start/server'
import type { SessionUser } from '../../lib/github/types'
import { seal, unseal } from './crypto'
import { refreshTokens } from './github-oauth'
import type { Tokens } from './github-oauth'

export type Session = Tokens & { user: SessionUser }
const cookieName = 'adv360_session'

function secret(): string {
  if (!process.env.SESSION_SECRET) throw new Error('github-error: SESSION_SECRET is not configured')
  return process.env.SESSION_SECRET
}

/** Cookie attributes appropriate to the current request. */
export function cookieOptions(maxAge: number) {
  const hostname = new URL(getRequest().url).hostname
  return {
    httpOnly: true,
    sameSite: 'lax' as const,
    path: '/',
    secure: hostname !== 'localhost' && hostname !== '127.0.0.1',
    maxAge,
  }
}

/** Check whether a GitHub login may sign in. */
export function isAllowed(login: string): boolean {
  return (process.env.ALLOWED_GITHUB_LOGINS ?? 'ali-aljufairi')
    .split(',')
    .some((entry) => entry.trim().toLowerCase() === login.toLowerCase())
}

/** Write an encrypted session cookie. */
export async function setSession(session: Session): Promise<void> {
  setCookie(cookieName, await seal(session, secret()), cookieOptions(180 * 24 * 60 * 60))
}

/** Remove the session cookie. */
export function clearSession(): void {
  deleteCookie(cookieName, cookieOptions(0))
}

async function readSession(): Promise<Session | null> {
  const value = getCookie(cookieName)
  if (!value) return null
  const session = await unseal<Session>(value, secret())
  if (
    !session ||
    !session.user ||
    typeof session.user.login !== 'string' ||
    typeof session.accessToken !== 'string' ||
    !isAllowed(session.user.login)
  )
    return null
  return session
}

/** Return the signed-in user, if a valid session exists. */
export async function getSessionUser(): Promise<SessionUser | null> {
  try {
    return (await requireGitHubToken()).user
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('not-signed-in:')) return null
    throw error
  }
}

/** Return a usable GitHub token, refreshing the session when needed. */
export async function requireGitHubToken(): Promise<{ token: string; user: SessionUser }> {
  let session = await readSession()
  if (!session) throw new Error('not-signed-in: no valid session')
  if (session.accessExpiresAt !== null && session.accessExpiresAt <= Date.now() + 300_000) {
    try {
      if (
        !session.refreshToken ||
        (session.refreshExpiresAt !== null && session.refreshExpiresAt <= Date.now())
      ) {
        throw new Error('expired')
      }
      session = { user: session.user, ...(await refreshTokens(session.refreshToken)) }
      await setSession(session)
    } catch {
      clearSession()
      throw new Error('not-signed-in: session expired')
    }
  }
  return { token: session.accessToken, user: session.user }
}
