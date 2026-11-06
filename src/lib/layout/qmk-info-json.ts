import type { PhysicalKey } from '../zmk/types'
import type { LayoutSelection, LayoutSource, PhysicalLayout } from './types'

type InfoJson = {
  layouts?: Record<string, { layout?: Record<string, unknown>[] }>
}

/** Read a QMK-style info.json layout. */
export function loadQmkInfoJson(
  input: string | InfoJson,
  name = 'LAYOUT',
): PhysicalLayout {
  const data = typeof input === 'string' ? (JSON.parse(input) as InfoJson) : input
  const layout = data.layouts?.[name]?.layout
  if (!Array.isArray(layout)) throw new Error(`Missing layout ${name}`)
  const keys: PhysicalKey[] = layout.map((key, index) => ({
    ...key,
    index,
    x: Number(key.x),
    y: Number(key.y),
    w: Number(key.w ?? 1),
    h: Number(key.h ?? 1),
    r: Number(key.r ?? 0),
  }))
  return { keys, name, source: 'qmk-info-json', verified: true }
}

export const qmkInfoJsonLayoutSource: LayoutSource = {
  kind: 'qmk-info-json',
  load(input: string, selection?: LayoutSelection) {
    return loadQmkInfoJson(input, selection?.layoutName ?? 'LAYOUT')
  },
}
