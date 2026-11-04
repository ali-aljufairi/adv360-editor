import type { PhysicalKey } from './types'
export function loadPhysicalLayout(
  info: string | { layouts: Record<string, { layout: Record<string, unknown>[] }> },
  name = 'LAYOUT',
): PhysicalKey[] {
  const data = typeof info === 'string' ? JSON.parse(info) : info
  const layout = data.layouts?.[name]?.layout
  if (!Array.isArray(layout)) throw new Error(`Missing layout ${name}`)
  return layout.map((key: Record<string, unknown>, index: number) => ({
    ...key,
    index,
    x: Number(key.x),
    y: Number(key.y),
    w: Number(key.w ?? 1),
    h: Number(key.h ?? 1),
    r: Number(key.r ?? 0),
  }))
}
