import type { KeyboardProfile, ProfileRegistry } from './types'

type ValidationResult<T> = { success: true; data: T } | { success: false; errors: string[] }

const record = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)
const string = (value: unknown) => typeof value === 'string' && value.trim().length > 0
const integer = (value: unknown) => Number.isInteger(value) && Number(value) >= 0

/** Validate one profile and return path-specific diagnostics. */
export function validateKeyboardProfile(value: unknown): ValidationResult<KeyboardProfile> {
  const errors: string[] = []
  if (!record(value)) return { success: false, errors: ['profile must be an object'] }
  const checkString = (candidate: unknown, path: string) => {
    if (!string(candidate)) errors.push(`${path} must be a non-empty string`)
  }
  checkString(value.id, 'id')
  checkString(value.name, 'name')
  if (!record(value.repo)) errors.push('repo must be an object')
  else {
    checkString(value.repo.owner, 'repo.owner')
    checkString(value.repo.name, 'repo.name')
  }
  checkString(value.branch, 'branch')
  checkString(value.configRoot, 'configRoot')
  if (!record(value.keymap)) errors.push('keymap must be an object')
  else {
    checkString(value.keymap.path, 'keymap.path')
    if (typeof value.keymap.sharedAcrossParts !== 'boolean')
      errors.push('keymap.sharedAcrossParts must be a boolean')
  }
  if (!record(value.target)) errors.push('target must be an object')
  else {
    checkString(value.target.board, 'target.board')
    if (value.target.shield !== undefined) checkString(value.target.shield, 'target.shield')
    if (value.target.parts !== undefined) {
      if (!Array.isArray(value.target.parts)) errors.push('target.parts must be an array')
      else value.target.parts.forEach((part, index) => {
        if (!record(part)) errors.push(`target.parts[${index}] must be an object`)
        else {
          checkString(part.id, `target.parts[${index}].id`)
          for (const field of ['board', 'shield', 'role'] as const)
            if (part[field] !== undefined) checkString(part[field], `target.parts[${index}].${field}`)
        }
      })
    }
  }
  if (!record(value.layout)) errors.push('layout must be an object')
  else {
    if (
      !['zmk-dts', 'qmk-info-json', 'keymap-drawer', 'kle', 'manual'].includes(
        String(value.layout.source),
      )
    )
      errors.push('layout.source must be zmk-dts, qmk-info-json, keymap-drawer, kle, or manual')
    checkString(value.layout.path, 'layout.path')
    if (value.layout.layoutName !== undefined) checkString(value.layout.layoutName, 'layout.layoutName')
    if (value.layout.nodeLabel !== undefined) checkString(value.layout.nodeLabel, 'layout.nodeLabel')
    if (!integer(value.layout.keyCount) || Number(value.layout.keyCount) < 1)
      errors.push('layout.keyCount must be a positive integer')
    if (typeof value.layout.verified !== 'boolean') errors.push('layout.verified must be a boolean')
  }
  if (!record(value.build)) errors.push('build must be an object')
  else {
    checkString(value.build.workflowPath, 'build.workflowPath')
    if (!['zmk-reusable', 'custom'].includes(String(value.build.kind)))
      errors.push('build.kind must be zmk-reusable or custom')
    if (value.build.matrixPath !== undefined) checkString(value.build.matrixPath, 'build.matrixPath')
    if (!record(value.build.artifactMap)) errors.push('build.artifactMap must be an object')
    else for (const [key, artifacts] of Object.entries(value.build.artifactMap)) {
      if (!string(key)) errors.push('build.artifactMap keys must be non-empty strings')
      if (!Array.isArray(artifacts) || artifacts.some((artifact) => !string(artifact)))
        errors.push(`build.artifactMap.${key} must be an array of non-empty artifact names`)
    }
  }
  if (value.sensors !== undefined) {
    if (!record(value.sensors)) errors.push('sensors must be an object')
    else {
      if (!integer(value.sensors.count)) errors.push('sensors.count must be a non-negative integer')
      if (
        value.sensors.labels !== undefined &&
        (!Array.isArray(value.sensors.labels) ||
          value.sensors.labels.some((label) => !string(label)))
      )
        errors.push('sensors.labels must be an array of non-empty strings')
    }
  }
  return errors.length
    ? { success: false, errors }
    : { success: true, data: value as unknown as KeyboardProfile }
}

/** Validate the versioned profile registry, including unique profile ids. */
export function validateProfileRegistry(value: unknown): ValidationResult<ProfileRegistry> {
  if (!record(value)) return { success: false, errors: ['registry must be an object'] }
  const errors: string[] = []
  if (!Number.isInteger(value.version) || Number(value.version) < 1)
    errors.push('version must be a positive integer')
  if (!Array.isArray(value.profiles)) errors.push('profiles must be an array')
  else {
    const ids = new Set<string>()
    value.profiles.forEach((profile, index) => {
      const result = validateKeyboardProfile(profile)
      if (!result.success) errors.push(...result.errors.map((error) => `profiles[${index}].${error}`))
      else if (ids.has(result.data.id)) errors.push(`profiles[${index}].id duplicates ${result.data.id}`)
      else ids.add(result.data.id)
    })
  }
  return errors.length
    ? { success: false, errors }
    : { success: true, data: value as unknown as ProfileRegistry }
}

/** Throw a readable error when a registry fails validation. */
export function assertValidProfileRegistry(value: unknown): asserts value is ProfileRegistry {
  const result = validateProfileRegistry(value)
  if (!result.success) throw new Error(`Invalid keyboard profile registry:\n- ${result.errors.join('\n- ')}`)
}
