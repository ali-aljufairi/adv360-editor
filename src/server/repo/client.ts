import { ConditionalGitHub, GitHubBackoffError } from '../github'
import { getCache } from '../../lib/cache'

/** GitHub REST client with conditional reads. */
export class GitHubClient {
  private conditional: ConditionalGitHub
  constructor(
    private token: string,
    login: string,
    private fetcher: typeof fetch = fetch,
  ) {
    this.conditional = new ConditionalGitHub(
      {
        request: async <T>(url: string, headers: Record<string, string>) => {
          const response = await this.raw(url, { headers })
          if (response.status !== 304 && !response.ok) await this.fail(response)
          return {
            status: response.status,
            headers: Object.fromEntries(response.headers),
            body: response.status === 304 ? undefined : ((await response.json()) as T),
          }
        },
      },
      getCache(),
      login,
    )
  }
  private async fail(response: Response): Promise<never> {
    if (response.status === 404) throw new Error('not-found: GitHub resource')
    if (response.status === 429) throw new Error('rate-limited: GitHub API')
    if (response.status === 403) {
      let message = ''
      try {
        message = String(((await response.clone().json()) as { message?: string }).message ?? '')
      } catch {
        /* no JSON body */
      }
      if (
        response.headers.get('x-ratelimit-remaining') === '0' ||
        response.headers.has('retry-after') ||
        /secondary rate limit/i.test(message)
      )
        throw new Error('rate-limited: GitHub API')
      throw new Error('forbidden: GitHub App likely lacks access or permission on this repository')
    }
    throw new Error(`github-error: ${response.status}`)
  }
  /** Send an authenticated request. */
  async raw(path: string, init: RequestInit = {}): Promise<Response> {
    return this.fetcher(path.startsWith('https://') ? path : `https://api.github.com${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${this.token}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'User-Agent': 'adv360-editor',
        'Content-Type': 'application/json',
        ...init.headers,
      },
    })
  }
  /** Read a JSON resource. */
  async get<T>(path: string): Promise<T> {
    try {
      return await this.conditional.get<T>(path)
    } catch (error) {
      if (error instanceof GitHubBackoffError)
        throw new Error('rate-limited: GitHub API', { cause: error })
      throw error
    }
  }
  /** Write a JSON resource. */
  async write<T>(method: string, path: string, body: unknown): Promise<T> {
    const response = await this.raw(path, { method, body: JSON.stringify(body) })
    if (!response.ok) {
      if (method === 'POST' && path.endsWith('/git/refs') && response.status === 422) {
        throw new Error('ref-exists: GitHub ref creation rejected')
      }
      if (method === 'PATCH' && (response.status === 409 || response.status === 422)) {
        throw new Error('branch-moved: GitHub ref update rejected')
      }
      await this.fail(response)
    }
    return (await response.json()) as T
  }
}
