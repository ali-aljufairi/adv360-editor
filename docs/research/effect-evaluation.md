# Effect evaluation for adv360-editor

Checked 2026-11-05 against the product brief and the read-only `feat/parser-gate` tree in `/Users/ali/github/adv360-editor`.

## Verdict

**Don't adopt Effect in the app yet.** It is a strong fit for the retrying, typed GitHub workflow orchestration, and the spike shows its core version can express that flow in fewer lines than the equivalent promise-and-Result implementation. For this single-user app, Octokit already covers most GitHub transport needs and a small `Result`/error union is enough for the remaining flow; Effect's concepts and new v4 APIs are a larger ongoing cost than the backend currently warrants. Keep Effect as a server-only option if GitHub work grows into several coordinated services or long-running workflows, and keep the parser and React UI conventional either way.

## Project fit

| Part | Would Effect help? | Recommendation |
| --- | --- | --- |
| Pure ZMK tokenizer/parser/CST/model/editor/validator | Little | Keep it pure TypeScript. Round-trip fidelity and source-span patches are deterministic domain logic; Effect does not improve the core algorithm or its byte-identical tests. Add runtime schemas only at untrusted input boundaries, not around every internal model. |
| GitHub App auth, repo reads/writes, commits, Actions and artifacts | Potentially | This is the only credible adoption target. `Effect<A, E, R>` makes success, typed failure, and required services visible; `Context.Service`/`Layer` lets a fake or live GitHub implementation be supplied without module mocking. The spike demonstrates that seam. For the current endpoint count, Octokit plus a small `Result` and a few explicit helpers remains simpler overall. |
| React editor, undo/redo, optimistic state, diff, themes | Low | Keep React state/reducer and the project's query/cache approach. Effect does not replace a need in these features. A React binding exists as `@effect/atom-react`, but it would add a second state model. |
| Future Studio/Web Serial/WebUSB and streaming progress | Maybe later | Effect `Stream` and scoped resource management could help if device RPC needs cancellation, retries, and concurrent streams. GitHub Actions progress is remote polling, though: a stream inside one Vercel invocation is not automatically a durable job or a browser stream. Start with short server calls plus client polling; revisit for a real SSE/WebSocket or device session. |

### Typed errors, schemas, and dependencies

The Effect error channel is the clearest advantage over ordinary promises: transport, authorization, validation, rate-limit, conflict, timeout, and missing-run cases can be modeled as a union and selectively retried or translated. The plain baseline can also have a typed `Result`, but maintaining its propagation and retry semantics is manual. The Effect spike's `Actions` service is swapped with `Layer.succeed(...)` in tests; plain TypeScript receives the fake as a function argument. Both are testable without network or secrets.

Effect `Schema` is more than a validator: current docs cover decode/encode codecs, JSON Schema, arbitrary generation, and a Standard Schema V1 view. This can give one schema for decoding GitHub JSON, validating server-function input, and deriving types. TanStack Start's current server-function guide documents `.validator()` with Zod and with a callback; it does not document a named Effect integration. A callback can call `Schema.decodeUnknownSync` or an effectful decoder, and TanStack Form directly lists Effect Schema among its Standard Schema validators. Zod is the lower-friction choice if we stay with the baseline; Effect Schema is compelling if Effect is adopted for backend code and consolidating schema tools reduces duplication. Valibot is also a Standard Schema option. Avoid wrapping the parser's known internal values in schema boilerplate without a boundary need.

### GitHub APIs, retries, schedules, and timeout behavior

Octokit has generated REST request/response types, repository/workflow helpers, and a familiar boundary for GitHub App credentials. `@octokit/plugin-retry` and `@octokit/plugin-throttling` can provide transport retries and GitHub rate-limit callbacks. These still need deliberate limits and error mapping: retrying a create-branch/commit/dispatch call blindly can duplicate side effects, so only retry idempotent reads or use a safe retry key / inspect state before repeating mutations. For polling, ordinary capped exponential delay plus an overall timeout is enough; Effect `Schedule` makes retry and repeat policies composable and interruption-aware, while the plain baseline can implement the same small policy directly.

Effect v4 has an HTTP client API in `effect/http` and platform adapters such as `@effect/platform-node` and `@effect/platform-browser`. The v4 `HttpClient` API reference marks it **unstable**. For this app, retain Octokit as the GitHub transport rather than replacing generated GitHub endpoints with hand-built REST calls. If a non-Octokit HTTP integration is needed later, evaluate the v4 HttpClient on its own. **Do not pair Effect 4 with `@effect/platform` 0.x**: npm currently reports that package's peer dependency as `effect ^3.22.2`; v4 platform adapters are the separately versioned `@effect/platform-node` / `@effect/platform-browser` packages.

The spike dispatches the workflow, then polls for a run created after the dispatch started (to avoid mistaking a previous completed run for this build), with capped exponential backoff and a hard overall timeout. The Effect timeout interrupts the Effect and passes its abort signal to Octokit. The plain implementation uses `AbortController` and a timeout race. Neither library can make GitHub Actions itself durable: if a Vercel function returns or dies between polls, the next invocation needs to look up the run again.

### Config, observability, and deployment

Effect `Config` can validate environment values and `Config.Redacted` avoids revealing a secret through its string representation. It does not replace Vercel's environment-variable/secret store or solve GitHub App private-key rotation. With one private key, app ID, installation ID, and one user allowlist, ordinary env access plus a Zod/Effect schema is enough. Avoid a long-lived managed runtime that captures a user-specific token; if Effect is introduced, provide request-scoped identity/config and keep only safe, reusable services at module scope.

Effect has tracing/logging support and an `@effect/opentelemetry` package, while Vercel exposes OpenTelemetry via `@vercel/otel` and automatically shows invocation and outbound-fetch spans when tracing is enabled. Wiring Effect spans into the Vercel provider is possible but must be verified as one OTel setup; it is not automatic merely because code uses Effect. For this app, Vercel fetch spans plus structured logs and correlation IDs likely suffice until a production debugging need appears.

The size build below bundles both variants for Node and includes Octokit plus retry/throttling plugins in each. It is not a Vercel cold-start benchmark. The measured Effect server entry is 32.7 KB gzip larger than the plain entry, still tiny against Vercel's current 250 MB compressed function bundle limit, but more code to parse and initialize. No real Vercel deployment or cold-start latency measurement was made. TanStack Start's compiler turns server-function imports into client RPC stubs, so server-only Effect should not enter the browser bundle when it is isolated behind server functions. If Effect is also imported for client state, measure that actual client chunk: this spike's combined server bundle is not a client bundle estimate.

## Current versions and integration state

Versions below were checked against npm registry metadata on 2026-11-05 (the latest dist-tag where available):

| Package | Current version | Relevance |
| --- | ---: | --- |
| `effect` | 4.1.2 | v4 is current `latest`; npm lists v3.22.4 as `prev`. |
| `@effect/platform` | 0.97.2 | Effect 3 platform package; peer dependency is `effect ^3.22.2`. |
| `@effect/platform-node` / `@effect/platform-browser` | 4.1.2 | v4 platform adapter package versions. |
| `@effect/atom-react` | 4.1.2 | React bindings exist; not a TanStack Start integration. Its v4 atom/reactivity APIs are marked unstable. |
| `@effect/opentelemetry` | 4.1.2 | Current Effect 4 OTel integration package. |
| `@octokit/rest` / retry / throttling | 22.0.1 / 8.1.1 / 11.0.5 | Versions installed in the spike. |
| `zod` / `valibot` | 4.6.7 / 1.5.0 | Current alternatives checked for the baseline comparison. |
| `@tanstack/react-start` | 1.169.4 | Matches the product repo's declared version at inspection. |

Effect 4.0 shipped as the current stable major about a month before this check; npm lists 4.1.2 as latest and the Effect release post promises at least three years of LTS support. Effect 3 remains published and maintained, so v3/v4 coexistence is real. The core release is stable, but v4 `HttpClient`, Atom/reactivity and some related APIs are explicitly unstable and can change in minor/patch releases. Pin versions and use their versioned docs. The project has TypeScript 6.0.2, which meets Effect's documented minimum of 5.9; Effect recommends TypeScript 7 for best compatibility/performance, so adopting it does not require an immediate compiler upgrade.

TanStack Start's current model is a regular `createServerFn().validator(...).handler(async ({ data }) => ...)`. A practical boundary would run the Effect inside the handler and return a serializable DTO, translating typed errors to a serializable error shape or HTTP response. Do not return Effect runtime objects, fibers, or `Error` instances across the server-function boundary. The Effect docs describe `ManagedRuntime` as an integration mechanism for external frameworks such as React, but there is no first-party TanStack Start adapter/pattern documented by either project. A direct `Effect.runPromise(Effect.provide(program, requestLayer))` inside the handler is sufficient for this app; use a managed runtime only if a measured need for reusable scoped resources/layer acquisition appears.

## Spike results

The isolated pnpm package implements the same surface twice: `triggerAndWait` (dispatch, poll with capped exponential delay, stop at completion or timeout) and `listArtifacts`. Both versions use the same Octokit adapter with `@octokit/rest`, retry and throttling plugins. Tests inject a fake `ActionsGithub`; no network call or token is used.

| Measurement | Effect | Plain TypeScript + Octokit |
| --- | ---: | ---: |
| Workflow implementation LOC (`src/effect.ts` / `src/plain.ts`) | 57 | 77 |
| Full Node bundle minified | 233,529 bytes | 138,356 bytes |
| Full Node bundle minified + gzip | 64,300 bytes | 31,568 bytes |
| Delta | +95,173 bytes | +32,732 bytes gzip (+104%) |
| Test path | Fake supplied via Effect `Layer`; typed timeout asserted | Fake passed as argument; success and artifact path asserted |

Readability is a trade-off rather than a clear win: the Effect version expresses the happy path as a typed workflow and makes the dependency/error requirements explicit, with fewer lines. It also requires a reader to understand `Effect.gen`, service tags/layers, tagged errors, interruption, and runtime execution. The plain version is longer because its timeout/result handling is explicit imperative code, but more TypeScript maintainers and coding agents can edit it without learning another programming model. The shared GitHub adapter is 75 LOC and is intentionally excluded from the per-implementation LOC row. `pnpm test` passed (2 tests); `pnpm typecheck` passed; `pnpm size` produced the sizes above. The bundle script uses esbuild, `target: node22`, ESM, package bundling and minification; gzip uses Node's `gzipSync`.

For a fuller apples-to-apples adoption comparison, repeat this if the GitHub workflow expands: the spike's Effect variant still uses Octokit's retry/throttling plugins, so it measures Effect orchestration/runtime overhead, not a comparison between Effect HttpClient and Octokit. This is intentional because the current recommendation is to keep Octokit either way.

## Scores

Scores are relative for this project (5 = best fit).

| Criterion | Effect | Plain TS baseline | Why |
| --- | ---: | ---: | --- |
| Visible typed failures | 5 | 3 | Effect tracks error unions through composition; plain can do it with a small Result, but callers must propagate it manually. |
| Replaceable GitHub dependency | 5 | 4 | Effect Layer is a clean service graph; passing an interface to a factory is already good and simpler here. |
| Polling, retries, timeout, cancellation | 5 | 4 | Effect Schedule/fibers compose these well; capped delay + AbortController is adequate for one poller. |
| Runtime input validation | 4 | 4 | Effect Schema is a codec/toolkit; Zod is simpler and directly shown in TanStack Start docs. Both can support Standard Schema consumers. |
| Fit for pure parser/editor | 1 | 5 | The parser's hard requirement is preserving bytes and source spans; Effect adds no leverage. |
| TanStack Start / React fit | 3 | 5 | Direct handlers work, but Start has no documented Effect adapter; current React state is simpler. |
| Vercel observability | 4 | 4 | Effect OTel spans can help when correctly wired; Vercel already traces invocations/fetches and plain logs work now. |
| Owner/agent maintenance cost | 2 | 4 | Effect's API knowledge and v3/v4 split are substantial for one maintainer; familiar TS has lower friction. |
| Bundle / cold-start cost | 3 | 4 | Measured addition is 32.7 KB gzip in this server bundle; real Vercel latency was not measured and should not be inferred from bundle size alone. |

## Recommendation and migration path

**Scope: none for the initial implementation.** Use Octokit with `@octokit/plugin-retry` and `@octokit/plugin-throttling`, Zod for request/config schemas, and a small discriminated `Result`/domain error union for workflow operations. Put GitHub/App operations behind a narrow interface and keep pure parser/edit/validate modules separate. Keep retry policy conservative and idempotency-aware; make every server function perform its own authorization check and return only serializable data.

If the server layer later develops a multi-step failure graph (for example, commit + dispatch + polling + artifact retrieval with compensating behavior, several external services, or request cancellation across long-lived streams), trial Effect **only in server modules**. Start with one read-only GitHub action and its fake layer, then one Actions polling service; compare readability with the current spike, export only plain DTOs across TanStack functions, and keep UI, parser, and domain model free of Effect types. If that trial does not make error/retry behavior materially clearer, stay on the plain baseline. Avoid a v3-to-v4 migration later by either choosing pinned v4 from the first trial or not introducing Effect until the project has that concrete need.

## Sources checked

- [Effect on npm](https://www.npmjs.com/package/effect) and [Effect 4.0/LTS release post](https://effect.website/blog/releases/effect/40)
- [Effect v4 installation requirements](https://effect.website/docs/v4/getting-started/installation), [Schema](https://effect.website/docs/v4/schema/introduction), [services/layers](https://effect.website/docs/v4/requirements-management/layers), [schedules](https://effect.website/docs/v4/scheduling/using-schedules), [Config/Redacted](https://effect.website/docs/v4/configuration), [HttpClient API reference](https://effect.website/docs/v4/api/effect/http/HttpClient), [platform overview](https://effect.website/docs/v4/platform/introduction), [ManagedRuntime](https://effect.website/docs/v4/runtime)
- [@effect/platform npm metadata](https://www.npmjs.com/package/%40effect/platform), [@effect/platform-node](https://www.npmjs.com/package/%40effect/platform-node), [@effect/platform-browser](https://www.npmjs.com/package/%40effect/platform-browser), [@effect/atom-react](https://www.npmjs.com/package/%40effect/atom-react), [@effect/opentelemetry](https://www.npmjs.com/package/%40effect/opentelemetry)
- [TanStack Start server functions](https://tanstack.com/start/latest/docs/framework/react/guide/server-functions), [TanStack Form Standard Schema validation](https://tanstack.com/form/latest/docs/framework/react/guides/validation), [Effect Atom React API](https://effect.website/docs/v4/api/atom-react/ScopedAtom)
- [Octokit retry plugin](https://www.npmjs.com/package/%40octokit/plugin-retry), [Octokit throttling plugin source/docs](https://github.com/octokit/plugin-throttling.js)
- [Vercel tracing](https://vercel.com/docs/tracing), [Vercel instrumentation](https://vercel.com/docs/tracing/instrumentation), [Vercel Function limits](https://vercel.com/docs/functions/limitations)
