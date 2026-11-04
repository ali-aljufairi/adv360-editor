import type { Binding, CST, FileMap, Model, Node, Property, Layer, Behavior, Combo } from './types'
import { tokenize } from './tokenize'
import { parse } from './parse'
export const nodes = (items: (Node | Property)[]): Node[] =>
  items.filter((x): x is Node => x.kind === 'node')
export const prop = (node: Node, name: string): Property | undefined =>
  node.children.find((x): x is Property => x.kind === 'property' && x.name === name)
const unquote = (v?: string) => v?.match(/^"((?:\\.|[^"\\])*)"/)?.[1]
function bindings(p: Property | undefined, source: string): Binding[] {
  if (!p?.valueSpan) return []
  const ts = tokenize(p.value, p.file).filter((t) => t.kind !== 'trivia' && t.kind !== 'directive')
  const result: Binding[] = []
  for (let i = 0; i < ts.length; i++) {
    if (!ts[i].text.startsWith('&')) continue
    const start = ts[i].start
    const behavior = ts[i].text.slice(1)
    let end = ts[i].end
    const params: string[] = []
    let depth = 0
    let part = ''
    for (i++; i < ts.length; i++) {
      const t = ts[i]
      if (depth === 0 && (t.text.startsWith('&') || t.text === '>' || t.text === ',')) {
        i--
        break
      }
      if (depth === 0 && part && t.start > end) {
        params.push(part)
        part = ''
      }
      part += t.text
      end = t.end
      if (t.text === '(') depth++
      if (t.text === ')') depth--
    }
    if (part) params.push(part)
    const absolute = p.valueSpan.start
    result.push({
      file: p.file,
      start: absolute + start,
      end: absolute + end,
      behavior,
      params,
      text: source.slice(absolute + start, absolute + end),
    })
  }
  return result
}
function resolvePath(base: string, relative: string): string {
  const parts = base.split('/')
  parts.pop()
  for (const p of relative.split('/')) {
    if (p === '..') parts.pop()
    else if (p !== '.') parts.push(p)
  }
  return parts.join('/')
}
function conditions(cst: CST, position: number): string | undefined {
  const stack: { previous: string[]; current: string }[] = []
  for (const t of cst.tokens) {
    if (t.start >= position) break
    if (t.kind !== 'directive') continue
    const m = t.text.trim().match(/^#(if|ifdef|ifndef|elif|else|endif)\b\s*(.*)/)
    if (!m) continue
    const frame = stack[stack.length - 1]
    if (m[1] === 'endif') stack.pop()
    else if (m[1] === 'elif' && frame) {
      frame.previous.push(frame.current)
      frame.current = m[2]
    } else if (m[1] === 'else' && frame) {
      frame.previous.push(frame.current)
      frame.current = '1'
    } else if (['if', 'ifdef', 'ifndef'].includes(m[1]))
      stack.push({
        previous: [],
        current:
          m[1] === 'ifdef' ? `defined(${m[2]})` : m[1] === 'ifndef' ? `!defined(${m[2]})` : m[2],
      })
  }
  return stack.length
    ? stack
        .map(
          (f) =>
            [...f.previous.map((p) => `!(${p})`), ...(f.current === '1' ? [] : [f.current])].join(
              ' && ',
            ) || '1',
        )
        .join(' && ')
    : undefined
}
export function resolve(files: FileMap, entry: string): Model {
  if (!(entry in files)) throw new Error(`Missing entry: ${entry}`)
  const parsed: Record<string, CST> = {}
  const missingIncludes: string[] = []
  const layers: Layer[] = []
  const behaviors: Behavior[] = []
  const combos: Combo[] = []
  const visit = (file: string, context: string, active: Set<string>) => {
    if (active.has(file)) return
    const next = new Set(active).add(file)
    const cst = (parsed[file] ??= parse(files[file], file))
    const walk = (items: (Node | Property)[], parent: string, start: number, end: number) => {
      const entries: { start: number; node?: Node; include?: string }[] = nodes(items).map(
        (node) => ({ start: node.start, node }),
      )
      for (const t of cst.tokens)
        if (
          t.kind === 'directive' &&
          t.start >= start &&
          t.end <= end &&
          !nodes(items).some((n) => t.start >= n.start && t.end <= n.end)
        ) {
          const m = t.text.match(/^\s*#include\s+"([^"]+)"/)
          if (m) entries.push({ start: t.start, include: m[1] })
        }
      entries.sort((a, b) => a.start - b.start)
      for (const e of entries) {
        if (e.include) {
          const path = resolvePath(file, e.include)
          if (path in files) visit(path, parent, next)
          else if (!missingIncludes.includes(path)) missingIncludes.push(path)
          continue
        }
        const n = e.node!
        const get = (key: string) => prop(n, key)?.value
        const bs = bindings(prop(n, 'bindings'), cst.source)
        const compatible = unquote(get('compatible'))
        if (parent === 'keymap')
          layers.push({
            ...n,
            name: n.name,
            displayName: unquote(get('display-name')) ?? unquote(get('label')),
            bindings: bs,
            node: n,
          })
        if (
          compatible &&
          (compatible.startsWith('zmk,behavior-') || parent === 'behaviors' || parent === 'macros')
        ) {
          const properties: Record<string, string> = {}
          for (const p of n.children) if (p.kind === 'property') properties[p.name] = p.value
          behaviors.push({
            ...n,
            name: n.name,
            label: n.label,
            compatible,
            properties,
            bindings: bs,
            waitMs:
              get('wait-ms') === undefined
                ? undefined
                : Number(get('wait-ms')?.match(/-?\d+/)?.[0]),
            tapMs:
              get('tap-ms') === undefined ? undefined : Number(get('tap-ms')?.match(/-?\d+/)?.[0]),
            node: n,
          })
        }
        if (parent === 'combos' && prop(n, 'key-positions')) {
          const nums = (v?: string) => (v?.match(/-?\d+/g) ?? []).map(Number)
          combos.push({
            ...n,
            name: n.name,
            bindings: bs,
            keyPositions: nums(get('key-positions')),
            timeoutMs: nums(get('timeout-ms'))[0],
            layers: get('layers') === undefined ? undefined : nums(get('layers')),
            condition: conditions(cst, n.start),
            node: n,
          })
        }
        walk(n.children, n.name, n.bodyStart, n.bodyEnd)
      }
    }
    walk(cst.children, context, 0, cst.source.length)
  }
  visit(entry, '', new Set())
  const boardBehaviors: string[] = []
  for (const [file, source] of Object.entries(files)) {
    if (!/^boards\/.*\.dtsi$/.test(file)) continue
    const collect = (items: (Node | Property)[]) => {
      for (const item of nodes(items)) {
        if (item.label && unquote(prop(item, 'compatible')?.value)?.startsWith('zmk,behavior-'))
          boardBehaviors.push(item.label)
        collect(item.children)
      }
    }
    collect(parse(source, file).children)
  }
  return {
    layers,
    behaviors,
    macros: behaviors.filter((b) => b.compatible === 'zmk,behavior-macro'),
    combos,
    files: parsed,
    missingIncludes,
    boardBehaviors,
  }
}
