import type { Binding, CST, FileMap, Model, Node, Property, Layer, Behavior, Combo } from './types'
import { tokenize } from './tokenize'
import { parse } from './parse'
/** Select node children from a mixed list. */
export const nodes = (items: (Node | Property)[]): Node[] =>
  items.filter((currentItem): currentItem is Node => currentItem.kind === 'node')
/** Find a named property on a node. */
export const prop = (node: Node, name: string): Property | undefined =>
  node.children.find(
    (nextItem): nextItem is Property => nextItem.kind === 'property' && nextItem.name === name,
  )
const unquote = (currentValue: string | undefined) =>
  currentValue?.match(/^"((?:\\.|[^"\\])*)"/)?.[1]
function bindings(currentProperty: Property | undefined, source: string): Binding[] {
  if (!currentProperty?.valueSpan) return []
  const ts = tokenize(currentProperty.value, currentProperty.file).filter(
    (token) => token.kind !== 'trivia' && token.kind !== 'directive',
  )
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
      const currentToken = ts[i]
      if (
        depth === 0 &&
        (currentToken.text.startsWith('&') ||
          currentToken.text === '>' ||
          currentToken.text === ',')
      ) {
        i--
        break
      }
      if (depth === 0 && part && currentToken.start > end) {
        params.push(part)
        part = ''
      }
      part += currentToken.text
      end = currentToken.end
      if (currentToken.text === '(') depth++
      if (currentToken.text === ')') depth--
    }
    if (part) params.push(part)
    const absolute = currentProperty.valueSpan.start
    result.push({
      file: currentProperty.file,
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
  for (const nextProperty of relative.split('/')) {
    if (nextProperty === '..') parts.pop()
    else if (nextProperty !== '.') parts.push(nextProperty)
  }
  return parts.join('/')
}
function conditions(cst: CST, position: number): string | undefined {
  const stack: { previous: string[]; current: string }[] = []
  for (const nextToken of cst.tokens) {
    if (nextToken.start >= position) break
    if (nextToken.kind !== 'directive') continue
    const currentMatch = nextToken.text.trim().match(/^#(if|ifdef|ifndef|elif|else|endif)\b\s*(.*)/)
    if (!currentMatch) continue
    const frame = stack[stack.length - 1]
    if (currentMatch[1] === 'endif') stack.pop()
    else if (currentMatch[1] === 'elif' && frame) {
      frame.previous.push(frame.current)
      frame.current = currentMatch[2]
    } else if (currentMatch[1] === 'else' && frame) {
      frame.previous.push(frame.current)
      frame.current = '1'
    } else if (['if', 'ifdef', 'ifndef'].includes(currentMatch[1]))
      stack.push({
        previous: [],
        current:
          currentMatch[1] === 'ifdef'
            ? `defined(${currentMatch[2]})`
            : currentMatch[1] === 'ifndef'
              ? `!defined(${currentMatch[2]})`
              : currentMatch[2],
      })
  }
  return stack.length
    ? stack
        .map(
          (currentFile) =>
            [
              ...currentFile.previous.map((otherProperty) => `!(${otherProperty})`),
              ...(currentFile.current === '1' ? [] : [currentFile.current]),
            ].join(' && ') || '1',
        )
        .join(' && ')
    : undefined
}
/** Resolve keymap files into a semantic model. */
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
      for (const otherToken of cst.tokens)
        if (
          otherToken.kind === 'directive' &&
          otherToken.start >= start &&
          otherToken.end <= end &&
          !nodes(items).some(
            (currentNode) =>
              otherToken.start >= currentNode.start && otherToken.end <= currentNode.end,
          )
        ) {
          const nextMatch = otherToken.text.match(/^\s*#include\s+"([^"]+)"/)
          if (nextMatch) entries.push({ start: otherToken.start, include: nextMatch[1] })
        }
      entries.sort((first, binding) => first.start - binding.start)
      for (const editor of entries) {
        if (editor.include) {
          const path = resolvePath(file, editor.include)
          if (path in files) visit(path, parent, next)
          else if (!missingIncludes.includes(path)) missingIncludes.push(path)
          continue
        }
        const nextNode = editor.node!
        const get = (key: string) => prop(nextNode, key)?.value
        const bs = bindings(prop(nextNode, 'bindings'), cst.source)
        const compatible = unquote(get('compatible'))
        if (parent === 'keymap')
          layers.push({
            ...nextNode,
            name: nextNode.name,
            displayName: unquote(get('display-name')) ?? unquote(get('label')),
            bindings: bs,
            node: nextNode,
          })
        if (
          compatible &&
          (compatible.startsWith('zmk,behavior-') || parent === 'behaviors' || parent === 'macros')
        ) {
          const properties: Record<string, string> = {}
          for (const candidateProperty of nextNode.children)
            if (candidateProperty.kind === 'property')
              properties[candidateProperty.name] = candidateProperty.value
          behaviors.push({
            ...nextNode,
            name: nextNode.name,
            label: nextNode.label,
            compatible,
            properties,
            bindings: bs,
            waitMs:
              get('wait-ms') === undefined
                ? undefined
                : Number(get('wait-ms')?.match(/-?\d+/)?.[0]),
            tapMs:
              get('tap-ms') === undefined ? undefined : Number(get('tap-ms')?.match(/-?\d+/)?.[0]),
            node: nextNode,
          })
        }
        if (parent === 'combos' && prop(nextNode, 'key-positions')) {
          const nums = (nextValue: string | undefined) =>
            (nextValue?.match(/-?\d+/g) ?? []).map(Number)
          combos.push({
            ...nextNode,
            name: nextNode.name,
            bindings: bs,
            keyPositions: nums(get('key-positions')),
            timeoutMs: nums(get('timeout-ms'))[0],
            layers: get('layers') === undefined ? undefined : nums(get('layers')),
            condition: conditions(cst, nextNode.start),
            node: nextNode,
          })
        }
        walk(nextNode.children, nextNode.name, nextNode.bodyStart, nextNode.bodyEnd)
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
    macros: behaviors.filter(
      (currentBinding) => currentBinding.compatible === 'zmk,behavior-macro',
    ),
    combos,
    files: parsed,
    missingIncludes,
    boardBehaviors,
  }
}
