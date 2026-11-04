import { loadQmkInfoJson } from '../layout/qmk-info-json'
import type { PhysicalKey } from './types'

/** Backward-compatible info.json key loader. */
export function loadPhysicalLayout(
  info: string | { layouts: Record<string, { layout: Record<string, unknown>[] }> },
  name = 'LAYOUT',
): PhysicalKey[] {
  return loadQmkInfoJson(info, name).keys
}
