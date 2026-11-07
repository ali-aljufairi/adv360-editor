# M4 contracts — GitHub sign-in, load, commit, build

Shared types: `src/lib/github/types.ts` (fixed contract). Never flash hardware; the app only
commits, pushes and links to firmware artifacts.

## Environment (Vercel + `.env.local`)

| Name                                        | Meaning                                                                         |
| ------------------------------------------- | ------------------------------------------------------------------------------- |
| `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` | The private GitHub App's OAuth credentials                                      |
| `SESSION_SECRET`                            | ≥ 32 random bytes (base64) used to encrypt the session cookie                   |
| `ALLOWED_GITHUB_LOGINS`                     | Comma list; default `ali-aljufairi`                                             |
| `APP_URL`                                   | Optional public origin, e.g. `https://editor.aljufairi.org` (else from request) |

GitHub App callback URLs: `https://editor.aljufairi.org/api/auth/callback`,
`http://localhost:3000/api/auth/callback`. Permissions: Contents read/write, Actions read,
Metadata read. Installed only on `Adv360-Pro-ZMK`. "Expire user authorization tokens" on.

## Piece A — auth (`src/server/auth/**`, `src/routes/api/auth/**`, Terra)

- Session = one httpOnly, Secure (except localhost), SameSite=Lax cookie `adv360_session`,
  AES-256-GCM encrypted JSON `{ user: SessionUser, accessToken, accessExpiresAt,
refreshToken, refreshExpiresAt }`, Max-Age 180 days. Sign-in survives reloads and browser
  restarts; GitHub App user tokens (8 h) are refreshed automatically with the refresh token
  (6 months), and the cookie is rewritten. Only `ALLOWED_GITHUB_LOGINS` may sign in.
- Routes: `GET /api/auth/login?returnTo=/` (state cookie, redirect to GitHub),
  `GET /api/auth/callback` (verify state, exchange code, check login, set cookie, redirect),
  `POST /api/auth/logout` (clear cookie).
- Exports (server-only) from `src/server/auth/session.ts`:
  - `getSessionUser(): Promise<SessionUser | null>` (for a `getSession` server fn)
  - `requireGitHubToken(): Promise<{ token: string; user: SessionUser }>` — refreshes if
    needed, sharing concurrent refreshes. Transient failures throw `transient-refresh: …` and
    preserve the session; invalid or expired refresh tokens clear it. Throws `Error('not-signed-in: …')` when there is no valid session.
- Server fn `getSession` in `src/server/auth/functions.ts` → `SessionUser | null`.

## Piece B — repository service (`src/server/repo/**`, `src/routes/api/artifacts/**`, Terra)

Server fns in `src/server/repo/functions.ts` (all call `requireGitHubToken()`):

- `loadConfig({ profileId, branch? })` → `LoadedConfig`: every text file under the profile's
  `configRoot` at the branch head (default the profile branch), via the git trees + blobs API.
- `commitChanges(CommitRequest)` → `CommitResult`: git data API (blobs → tree with base_tree →
  commit → update ref, non-force). If the branch head ≠ `baseSha`, throw `branch-moved: …`.
  Before moving an existing branch, create `refs/heads/editor-backup/<yyyymmdd-HHMM>-<sha7>`
  at the old head, reusing an identical ref or adding a unique suffix on collision. Direct commits
  to the profile default branch require `CommitRequest.allowDefaultBranch: true`; otherwise the
  server returns `protected-branch: …`. Author/committer = the signed-in user (GitHub does this for user tokens).
- `getBuildStatus({ profileId, commitSha })` → `BuildStatus`: workflow runs filtered by
  `head_sha` for the profile's workflow; artifacts once completed.
- `GET /api/artifacts/:id` → streams the artifact zip (GitHub redirect followed server-side,
  `Content-Disposition: attachment`), auth required.
- Pushing a commit triggers the workflow (`on: push`); no dispatch needed.
- Use the existing `GitHubGateway` / `ConditionalGitHub` (`src/server/github.ts`) for GETs.

## Piece C — client sync (`src/lib/github-sync/**`, Terra)

- A store/hook that: reads the session; when signed in, loads the config (cached in
  localStorage per profile+sha for instant start, then revalidated), calls `editor.load()`;
  commits the changed files with `CommitRequest`; polls `getBuildStatus` every 10 s until
  completed; exposes `{ user, source: { branch, headSha, loadedAt } | null, status, error,
signIn(), signOut(), reload(), commit(message, branch), build: BuildStatus | null }`.
- Cache entries are keyed by profile and commit SHA, with a branch lookup for the latest entry.
  Revalidation of the displayed SHA updates `source.loadedAt` without resetting editor history.
  If a different SHA arrives while dirty, `phase` is `remote-changed` and `remoteSha` identifies
  the pending remote commit. `applyRemote()` explicitly discards edits and loads that version.
  A clean editor loads the new version automatically. `reload()` revalidates and supersedes older
  in-flight loads; logout invalidates them too.
- `buildTimedOut` becomes true when polling reaches 30 minutes without completion;
  `repollBuild()` starts a new polling window for the last commit. `commit()` accepts optional
  `allowDefaultBranch: true` for the explicit default-branch override.
- After a successful commit the new commit becomes the baseline (editor.load with the
  committed files and `commitSha`).
- Signed out: the bundled fixture stays usable (read-only demo of the editor).

## Piece D — UI (Haiku)

Sign-in/avatar in the header, source line (branch @ sha), commit form in the Changes sheet,
build progress + artifact downloads in the right dock. Follows the `ui-craft` skill.
