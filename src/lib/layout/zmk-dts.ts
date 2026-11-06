import { nodes, prop } from '../zmk/model'
import { parse } from '../zmk/parse'
import { tokenize } from '../zmk/tokenize'
import type { Node, PhysicalKey, Property } from '../zmk/types'
import type { LayoutSelection, LayoutSource, PhysicalLayout } from './types'

const unquote = (value: string | undefined) => value?.match(/^"((?:\\.|[^"\\])*)"/)?.[1]

function numberFrom(tokens: string[], offset: number): number | undefined {
  const token = tokens[offset]
  if (!token) return undefined
  const value = token.replace(/[()]/g, '')
  const result = Number(value)
  return Number.isFinite(result) ? result : undefined
}

function keyTuples(property: Property): PhysicalKey[] {
  const source = property.value
  const tokens = tokenize(source, property.file).filter(
    (token) => token.kind !== 'trivia' && token.kind !== 'directive',
  )
  const keys: PhysicalKey[] = []
  for (let index = 0; index < tokens.length; index++) {
    if (tokens[index].text !== '<') continue
    const end = tokens.findIndex((token, next) => next > index && token.text === '>')
    if (end < 0) throw new Error('Unclosed key tuple in zmk,physical-layout keys property')
    const tuple = tokens.slice(index + 1, end).map((token) => token.text)
    if (!tuple[0]?.startsWith('&key_physical_attrs')) {
      index = end
      continue
    }
    // Parenthesized values are single logical numbers even though tokenized as "(" + value + ")".
    const values: string[] = []
    for (let cursor = 1; cursor < tuple.length; cursor++) {
      if (tuple[cursor] === '(' && tuple[cursor + 2] === ')') {
        values.push(`(${tuple[cursor + 1]})`)
        cursor += 2
      } else values.push(tuple[cursor])
    }
    if (values.length < 7) throw new Error(`Expected 7 key attributes, found ${values.length}`)
    const numbers = values.map((_, valueIndex) => numberFrom(values, valueIndex))
    if (numbers.some((value) => value === undefined))
      throw new Error(`Invalid numeric key attributes: ${values.join(' ')}`)
    const [width, height, xPos, yPos, rotation, rotationX, rotationY] = numbers as number[]
    keys.push({
      index: keys.length,
      w: width / 100,
      h: height / 100,
      x: xPos / 100,
      y: yPos / 100,
      r: rotation / 100,
      rx: rotationX / 100,
      ry: rotationY / 100,
    })
    index = end
  }
  return keys
}

function physicalLayoutNodes(items: (Node | Property)[]): Node[] {
  const found: Node[] = []
  for (const node of nodes(items)) {
    if (unquote(prop(node, 'compatible')?.value) === 'zmk,physical-layout') found.push(node)
    found.push(...physicalLayoutNodes(node.children))
  }
  return found
}

/** Parse explicit zmk,physical-layout nodes without evaluating DTS preprocessing. */
export function loadZmkDtsLayout(input: string, selection: LayoutSelection = {}): PhysicalLayout {
  const cst = parse(input, selection.nodeLabel ?? selection.layoutName ?? '')
  const candidates = physicalLayoutNodes(cst.children)
  const match = candidates.filter((node) => {
    if (selection.nodeLabel) return node.label === selection.nodeLabel
    if (selection.layoutName)
      return unquote(prop(node, 'display-name')?.value) === selection.layoutName || node.name === selection.layoutName
    return true
  })
  if (!match.length) {
    const selector = selection.nodeLabel
      ? ` with label "${selection.nodeLabel}"`
      : selection.layoutName
        ? ` named "${selection.layoutName}"`
        : ''
    throw new Error(`No zmk,physical-layout node${selector} found`)
  }
  if (!selection.nodeLabel && !selection.layoutName && match.length > 1)
    throw new Error(`Found ${match.length} physical layouts; select one by node label or layout name`)
  const node = match[0]
  const keysProperty = prop(node, 'keys')
  if (!keysProperty) throw new Error(`Physical layout ${node.label ?? node.name} has no keys property`)
  const keys = keyTuples(keysProperty)
  if (!keys.length) throw new Error(`Physical layout ${node.label ?? node.name} has no key tuples`)
  return {
    keys,
    name: unquote(prop(node, 'display-name')?.value) ?? node.name,
    source: 'zmk-dts',
    verified: true,
  }
}

export const zmkDtsLayoutSource: LayoutSource = {
  kind: 'zmk-dts',
  load: loadZmkDtsLayout,
}
