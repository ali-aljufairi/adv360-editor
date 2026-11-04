# Cache and deployment

The cache and services are server-only and are not wired into UI or GitHub authentication yet.
TanStack's server-only import guard marks their modules. `getCache()` creates one adapter per
warm Node process; it is not a shared global across Vercel instances. Cache failures return misses,
failed writes are ignored and one warning is logged per Valkey adapter. Single-flight only covers
one process. An outage can increase GitHub traffic or produce duplicate builds. Rate limits also
fail open, so this helper is not a security boundary. Memory mode is bounded but per process and
is unsuitable for enforcing a global multi-user limit.

## Development

Run `docker compose up -d`, copy `.env.example` to `.env`, and uncomment `CACHE_URL`. The
local-only password is intentionally public and the container binds to loopback. Run the optional
integration test with `CACHE_URL=valkey://:local-development-only@127.0.0.1:6379 pnpm vitest run tests/cache`.
Stop with `docker compose down`; the named volume persists. Unset `CACHE_URL` for memory mode.
`valkey://`, `valkeys://`, `redis://`, and `rediss://` are accepted; the `s` schemes enable TLS.

## Production

Prefer a managed Valkey service with TLS, authentication, and network access compatible with
Vercel; for example [Amazon ElastiCache for Valkey](https://docs.aws.amazon.com/AmazonElastiCache/latest/dg/WhatIs.html).
Check its private network connectivity requirements and costs before choosing it. Alternatively,
operate Valkey on your Kubernetes cluster with a TLS endpoint, strong credentials, persistence,
monitoring, backup and patching. Never expose Valkey without both TLS and authentication.
Vercel egress IPs are not fixed by default; [Static IPs or Secure Compute](https://vercel.com/kb/guide/can-i-get-a-fixed-ip-address)
are options when allowlisting or private connectivity is required. Do not rely on IP filtering alone.
Use a separate secret per environment and never store credentials in source control or client bundles.

The example `deploy/k8s/valkey/valkey.yaml` is an internal single-replica starting point, not a
public endpoint or HA deployment. Create `valkey-auth` with a `password` key using your secret
manager. Its NetworkPolicy only permits pods labelled `app: valkey-tls-proxy`; configure a
TLS-terminating proxy with that label, valid certificates and tightly restricted ingress before
exposing anything. Ensure the CNI enforces NetworkPolicy, secure proxy-to-Valkey traffic (for
example with mTLS or native Valkey TLS), and adjust storage, resources, backups and failover for
your cluster. No proxy, public Service, certificate, or secret is provisioned by the example.

## Integration contracts

Use a stable GitHub installation/user and representation scope; do not use credentials in cache
keys. Normalize response header names to lowercase in the gateway. The conditional service records
ETags, returns cached bodies on 304, and throws `GitHubBackoffError` until the advertised reset
when remaining requests are low. GitHub documents that [properly authorized conditional 304
requests do not count against the primary rate limit](https://docs.github.com/en/rest/using-the-rest-api/best-practices-for-using-the-rest-api#use-conditional-requests-if-appropriate).
Backoff is process-local; handle secondary limits and retries in the eventual gateway as well.

Build callers must enumerate every transitive build input, including keymaps, includes, west
manifest, board files, workflow-dependent files and any external module revisions; the cache cannot
discover missing dependencies. Hash input bytes exactly: even whitespace inside a comment changes
the key. Scope by repository and any relevant authorization boundary. Record only a verified
successful run correlated to the exact commit and configured workflow, after fetching artifact IDs,
names and expiration times. Artifact expiration is checked, but manual deletion/revocation must be
checked by the caller if required. Unknown or missing artifacts should never be recorded as success.
Rate limiting requires a trustworthy client IP derived from the deployment's trusted proxy chain.
