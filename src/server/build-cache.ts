import '@tanstack/react-start/server-only'
import { createHash } from 'node:crypto'
import { cacheKey, getJson, setJson } from '../lib/cache'
import type { Cache } from '../lib/cache'

export interface BuildInputs {
  /** All transitive build inputs, keyed by repository path; bytes are never normalized. */
  files: Record<string, string | Uint8Array>
  firmwareRevision: string
  workflowPath: string
  target: string
}
export interface Artifact {
  id: number
  name: string
  expiresAt: string
}
export interface SuccessfulBuild {
  runId: number
  commitSha: string
  artifacts: Artifact[]
}
export interface BuildGateway {
  dispatch(inputs: BuildInputs): Promise<{ runId: number }>
}

/** Hash length-delimited paths and bytes, sorted by path, plus build identity. */
export function buildKey(inputs: BuildInputs): string {
  const hash = createHash('sha256')
  const add = (value: string | Uint8Array) => {
    const bytes = typeof value === 'string' ? Buffer.from(value) : Buffer.from(value)
    hash.update(`${bytes.length}:`).update(bytes)
  }
  add('adv360-build-v1')
  add(inputs.firmwareRevision)
  add(inputs.workflowPath)
  add(inputs.target)
  for (const path of Object.keys(inputs.files).sort()) {
    add(path)
    add(inputs.files[path])
  }
  return hash.digest('hex')
}

/** Cache only verified successful runs with artifacts; callers record results after polling. */
export class FirmwareBuildCache {
  constructor(
    private readonly cache: Cache,
    private readonly scope: string,
    private readonly now = Date.now,
  ) {}
  async lookup(inputs: BuildInputs): Promise<SuccessfulBuild | null> {
    const key = cacheKey('build', this.scope, buildKey(inputs))
    const build = await getJson<SuccessfulBuild>(this.cache, key)
    if (
      !build ||
      !Array.isArray(build.artifacts) ||
      build.artifacts.length === 0 ||
      build.artifacts.some(
        (artifact) =>
          !Number.isFinite(Date.parse(artifact.expiresAt)) ||
          Date.parse(artifact.expiresAt) <= this.now(),
      )
    ) {
      if (build) await this.cache.delete(key)
      return null
    }
    return build
  }
  async record(inputs: BuildInputs, build: SuccessfulBuild): Promise<void> {
    const expiry = Math.min(
      ...build.artifacts.map((artifact) => Date.parse(artifact.expiresAt)),
    )
    const ttl = Math.floor((expiry - this.now()) / 1000)
    if (build.artifacts.length && Number.isFinite(ttl) && ttl > 0) {
      await setJson(
        this.cache,
        cacheKey('build', this.scope, buildKey(inputs)),
        build,
        ttl,
      )
    }
  }
  async dispatchOrReuse(
    inputs: BuildInputs,
    gateway: BuildGateway,
  ): Promise<
    { cached: true; build: SuccessfulBuild } | { cached: false; runId: number }
  > {
    const build = await this.lookup(inputs)
    if (build) return { cached: true, build }
    return { cached: false, ...(await gateway.dispatch(inputs)) }
  }
}
