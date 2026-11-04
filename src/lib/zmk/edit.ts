import { parse } from './parse'
import { tokenize } from './tokenize'
import { formatBinding, formatNode } from './format'
import type { BindingInput, ComboInput, MacroInput, HoldTapInput } from './format'
import { createTwoFilesPatch } from 'diff'
import type { FileMap, Model, Node, Property, Span } from './types'
import { nodes, prop, resolve } from './model'
/** A numeric layer reference changed by a layer operation. */
export interface LayerRewrite extends Span {
  before: string
  after: string
  layer?: number
  key?: number
  reason: string
}
/** Raised when removing a layer that is still referenced. */
export class LayerReferencedError extends Error {
  constructor(public readonly references: LayerRewrite[]) {
    super(
      `Layer is referenced at ${references.map((reference) => `${reference.file}:${reference.start}`).join(', ')}`,
    )
    this.name = 'LayerReferencedError'
  }
}

/** A symbolic layer reference has no numeric definition in the edited files. */
export class UnresolvedLayerSymbolError extends Error {
  constructor(public readonly locations: Span[]) {
    super(`Unresolved layer symbol at ${locations.map((p) => `${p.file}:${p.start}`).join(', ')}`)
    this.name = 'UnresolvedLayerSymbolError'
  }
}
/** Layer arithmetic cannot be rewritten safely. */
export class UnsupportedLayerExpressionError extends Error {
  constructor(public readonly locations: Span[]) {
    super(
      `Unsupported layer expression at ${locations.map((p) => `${p.file}:${p.start}`).join(', ')}`,
    )
    this.name = 'UnsupportedLayerExpressionError'
  }
}

/** Edits apply immediately; each operation reparses the current files so spans stay valid. */
export class ZmkEditor {
  private original: FileMap
  private current: FileMap
  private bindingHistory: {
    layer: number
    key: number
    before: string
    after: string
    padding: string
  }[] = []
  readonly entry: string
  constructor(files: FileMap, entry: string) {
    this.entry = entry
    this.original = { ...files }
    this.current = { ...files }
    resolve(this.current, entry)
  }
  get model(): Model {
    return resolve(this.current, this.entry)
  }
  private patch(span: Span, text: string) {
    const s = this.current[span.file]
    if (s === undefined) throw new Error(`Missing file ${span.file}`)
    this.current[span.file] = s.slice(0, span.start) + text + s.slice(span.end)
  }
  setBinding(layerIndex: number, keyIndex: number, bindingInput: BindingInput) {
    const binding = formatBinding(bindingInput)
    const b = this.model.layers[layerIndex]?.bindings[keyIndex]
    if (!b) throw new RangeError('Binding not found')
    if (!/^&[^\s<>;,{}]+(?:\s+[^<>;,{}]+)*$/.test(binding.trim()) || /[\r\n]/.test(binding))
      throw new Error('Expected a single binding')
    const s = this.current[b.file]
    const whitespace = s.slice(b.end).match(/^[ \t]+/)?.[0] ?? ''
    const previous = this.bindingHistory.at(-1)
    if (
      previous &&
      previous.layer === layerIndex &&
      previous.key === keyIndex &&
      previous.before === binding &&
      previous.after === b.text
    ) {
      this.patch({ ...b, end: b.end + whitespace.length }, previous.before + previous.padding)
      this.bindingHistory.pop()
      return
    }
    this.bindingHistory.push({
      layer: layerIndex,
      key: keyIndex,
      before: b.text,
      after: binding,
      padding: whitespace,
    })
    const delta = binding.trim().length - (b.end - b.start)
    const padding =
      delta === 0
        ? whitespace
        : whitespace
          ? ' '.repeat(Math.max(1, whitespace.length - delta))
          : ''
    this.patch({ ...b, end: b.end + whitespace.length }, binding.trim() + padding)
  }
  updateHoldTapProperty(name: string, property: string, value: string) {
    const b = this.model.behaviors.find(
      (x) => (x.label === name || x.name === name) && x.compatible === 'zmk,behavior-hold-tap',
    )
    if (!b) throw new Error(`Hold-tap ${name} not found`)
    this.updateProperty(b.node, property, value)
  }
  private updateProperty(node: Node, name: string, value: string) {
    if (!/^[#\w,.-]+$/.test(name) || /[;{}]/.test(value)) throw new Error('Invalid property')
    const existing = prop(node, name)
    const declaration = value ? `${name} = ${value};` : `${name};`
    if (existing?.valueSpan && value) this.patch(existing.valueSpan, value)
    else if (existing) this.patch(existing, declaration)
    else {
      const source = this.current[node.file]
      const lineStart = source.lastIndexOf('\n', node.bodyEnd - 1) + 1
      const closingIndent = source.slice(lineStart, node.bodyEnd)
      const sibling = node.children[0]
      const siblingIndent =
        sibling && source.slice(source.lastIndexOf('\n', sibling.start - 1) + 1, sibling.start)
      const indent =
        siblingIndent && /^[ \t]*$/.test(siblingIndent) ? siblingIndent : `${closingIndent}    `
      const eol = source.includes('\r\n') ? '\r\n' : '\n'
      const at = /^[ \t]*$/.test(closingIndent) ? lineStart : node.bodyEnd
      this.patch({ file: node.file, start: at, end: at }, `${indent}${declaration}${eol}`)
    }
  }
  private findContainer(name: string): Node {
    const cst = this.model.files[this.entry]
    const find = (items: (Node | Property)[]): Node | undefined => {
      for (const n of nodes(items)) {
        if (n.name === name) return n
        const child = find(n.children)
        if (child) return child
      }
    }
    const n = find(cst.children)
    if (!n) throw new Error(`Container ${name} not found`)
    return n
  }
  private insert(container: Node, raw: string) {
    if (!raw.trim()) throw new Error('Empty node')
    const s = this.current[container.file]
    const lineStart = s.lastIndexOf('\n', container.bodyEnd - 1) + 1
    const indent = s.slice(lineStart, container.bodyEnd)
    const at = /^[ \t]*$/.test(indent) ? lineStart : container.bodyEnd
    const eol = s.includes('\r\n') ? '\r\n' : '\n'
    this.patch({ file: container.file, start: at, end: at }, `${raw.replace(/\r?\n/g, eol)}${eol}`)
  }
  addMacro(input: MacroInput) {
    const container = this.findContainer('macros')
    this.insert(container, formatNode(input, this.current[container.file], container))
  }
  addCombo(input: ComboInput) {
    const container = this.findContainer('combos')
    this.insert(container, formatNode(input, this.current[container.file], container))
  }
  updateMacro(name: string, changes: Partial<MacroInput>) {
    const macro = this.model.macros.find((item) => item.label === name || item.name === name)
    if (!macro) throw new Error(`Macro ${name} not found`)
    this.updateFields(macro.node, changes, { waitMs: 'wait-ms', tapMs: 'tap-ms' })
  }
  updateCombo(name: string, changes: Partial<ComboInput>) {
    const combo = this.model.combos.find((item) => item.name === name)
    if (!combo) throw new Error(`Combo ${name} not found`)
    this.updateFields(combo.node, changes, {
      keyPositions: 'key-positions',
      timeoutMs: 'timeout-ms',
      layers: 'layers',
      requirePriorIdleMs: 'require-prior-idle-ms',
      slowRelease: 'slow-release',
    })
  }
  updateHoldTap(label: string, changes: HoldTapInput) {
    const behavior = this.model.behaviors.find(
      (item) =>
        (item.label === label || item.name === label) &&
        item.compatible === 'zmk,behavior-hold-tap',
    )
    if (!behavior) throw new Error(`Hold-tap ${label} not found`)
    this.updateFields(behavior.node, changes, {
      flavor: 'flavor',
      tappingTermMs: 'tapping-term-ms',
      quickTapMs: 'quick-tap-ms',
      requirePriorIdleMs: 'require-prior-idle-ms',
      holdTriggerKeyPositions: 'hold-trigger-key-positions',
    })
  }
  private updateFields(node: Node, changes: object, names: Record<string, string>) {
    for (const [key, value] of Object.entries(changes)) {
      // Reparse after each patch so subsequent offsets are current.
      const fresh = this.model.files[node.file]
      const find = (items: (Node | Property)[]): Node | undefined => {
        for (const item of nodes(items)) {
          if (item.start === node.start) return item
          const found = find(item.children)
          if (found) return found
        }
      }
      const current = find(fresh.children)
      if (!current) throw new Error('Node not found')
      if (key === 'name') {
        this.patch(current.nameSpan, String(value))
        continue
      }
      if (key === 'label') throw new Error('Changing labels is not supported')
      const property = key === 'bindings' ? 'bindings' : names[key]
      if (!property || value === undefined) continue
      if (typeof value === 'boolean') {
        const existing = prop(current, property)
        if (!value && existing) this.patch(existing, '')
        else if (value && !existing) this.updateProperty(current, property, '')
        continue
      }
      const text =
        key === 'bindings'
          ? `<${(value as BindingInput[]).map(formatBinding).join(' ')}>`
          : Array.isArray(value)
            ? `<${value.join(' ')}>`
            : typeof value === 'number'
              ? `<${value}>`
              : `"${value}"`
      this.updateProperty(current, property, text)
    }
  }
  addMacroRaw(rawNode: string, container = 'macros', file?: string) {
    if (!file) {
      this.insert(this.findContainer(container), rawNode)
      return
    }
    const s = this.current[file]
    if (s === undefined) throw new Error(`Missing file ${file}`)
    const eol = s.includes('\r\n') ? '\r\n' : '\n'
    this.patch(
      { file, start: s.length, end: s.length },
      `${s && !s.endsWith('\n') ? eol : ''}${rawNode.replace(/\r?\n/g, eol)}${eol}`,
    )
  }
  updateMacroRaw(name: string, rawNode: string) {
    const m = this.model.macros.find((x) => x.label === name || x.name === name)
    if (!m) throw new Error(`Macro ${name} not found`)
    this.patch(m, rawNode)
  }
  removeMacro(name: string) {
    const m = this.model.macros.find((x) => x.label === name || x.name === name)
    if (!m) throw new Error(`Macro ${name} not found`)
    this.patch(m, '')
  }
  addComboRaw(rawNode: string) {
    this.insert(this.findContainer('combos'), rawNode)
  }
  updateComboRaw(name: string, rawNode: string) {
    const c = this.model.combos.find((x) => x.name === name)
    if (!c) throw new Error(`Combo ${name} not found`)
    this.patch(c, rawNode)
  }
  removeCombo(name: string) {
    const c = this.model.combos.find((x) => x.name === name)
    if (!c) throw new Error(`Combo ${name} not found`)
    this.patch(c, '')
  }
  addLayer(rawNode: string) {
    this.insert(this.findContainer('keymap'), rawNode)
  }
  private layerReferences(
    mapping: (index: number) => number | null,
    removed?: number,
  ): LayerRewrite[] {
    const model = this.model
    const rewrites: LayerRewrite[] = []
    const unresolved: Span[] = []
    const expressions: Span[] = []
    const definitions = new Map<string, { value: number; span: Span }[]>()
    for (const [file, source] of Object.entries(this.current)) {
      for (const token of tokenize(source, file)) {
        if (token.kind !== 'directive') continue
        const match = token.text.match(/^\s*#define[ \t]+([A-Za-z_]\w*)[ \t]+(\d+)[ \t]*$/)
        if (!match) continue
        const start = token.start + token.text.lastIndexOf(match[2])
        const entries = definitions.get(match[1]) ?? []
        entries.push({
          value: Number(match[2]),
          span: { file, start, end: start + match[2].length },
        })
        definitions.set(match[1], entries)
      }
    }
    for (const [file, source] of Object.entries(this.current)) {
      const cst = parse(source, file)
      const masked = source.split('')
      for (const token of cst.tokens) {
        if (token.kind === 'trivia' || token.kind === 'string' || token.kind === 'directive') {
          for (let i = token.start; i < token.end; i++) if (!/\s/.test(source[i])) masked[i] = ' '
        }
      }
      const clean = masked.join('')
      const walk = (items: (Node | Property)[], conditional = false, inCombos = false) => {
        for (const item of items) {
          if (item.kind === 'node') {
            const isConditional =
              prop(item, 'compatible')?.value.includes('zmk,conditional-layers') ?? false
            const combo =
              inCombos || model.combos.some((c) => c.file === file && c.start === item.start)
            const relevant = item.children.filter(
              (p): p is Property =>
                p.kind === 'property' &&
                (conditional
                  ? ['if-layers', 'then-layer'].includes(p.name)
                  : combo && p.name === 'layers'),
            )
            const values = relevant.flatMap((p) =>
              Array.from(
                clean.slice(p.valueSpan?.start, p.valueSpan?.end).matchAll(/\b\d+\b/g),
                (m) => Number(m[0]),
              ),
            )
            if (
              removed !== undefined &&
              values.includes(removed) &&
              (conditional || (combo && values.every((value) => value === removed)))
            ) {
              rewrites.push({
                file,
                start: item.start,
                end: item.end,
                before: source.slice(item.start, item.end),
                after: '',
                reason: conditional
                  ? 'Remove conditional layer entry'
                  : 'Remove combo with no layers',
              })
              continue
            }
            walk(item.children, isConditional, item.name === 'combos')
            continue
          }
          if (!item.valueSpan) continue
          const add = (
            start: number,
            end: number,
            old: number,
            fullStart = start,
            fullEnd = end,
            replacement = '&none',
          ) => {
            if (
              removed !== undefined &&
              model.layers[removed]?.file === file &&
              start >= model.layers[removed].start &&
              start < model.layers[removed].end
            )
              return
            const next = mapping(old)
            if (next === old) return
            const absoluteStart = next === null ? fullStart : start
            const absoluteEnd = next === null ? fullEnd : end
            const layer = model.layers.findIndex(
              (candidate) =>
                candidate.file === file && start >= candidate.start && start < candidate.end,
            )
            const key =
              layer >= 0
                ? model.layers[layer].bindings.findIndex(
                    (binding) => start >= binding.start && start < binding.end,
                  )
                : -1
            rewrites.push({
              file,
              start: absoluteStart,
              end: absoluteEnd,
              before: source.slice(absoluteStart, absoluteEnd),
              after: next === null ? replacement : String(next),
              reason: next === null ? 'Remove layer reference' : 'Renumber layer reference',
              ...(layer >= 0 ? { layer } : {}),
              ...(key >= 0 ? { key } : {}),
            })
          }
          if (item.name === 'bindings') {
            const value = clean.slice(item.valueSpan.start, item.valueSpan.end)
            const pattern = /&(mo|lt|tog|to|sl)\s+(\([^)]*\)|[A-Za-z_]\w*|\d+)/g
            for (const match of value.matchAll(pattern)) {
              const fullStart = item.valueSpan.start + match.index
              if (
                removed !== undefined &&
                model.layers[removed]?.file === file &&
                fullStart >= model.layers[removed].start &&
                fullStart < model.layers[removed].end
              )
                continue
              const cell = match[2]
              const cellStart = fullStart + match[0].indexOf(cell)
              const location = { file, start: cellStart, end: cellStart + cell.length }
              if (cell.startsWith('(')) {
                expressions.push(location)
                continue
              }
              const defs = /^\d+$/.test(cell) ? undefined : definitions.get(cell)
              if (!/^\d+$/.test(cell) && (!defs || defs.length !== 1)) {
                unresolved.push(location)
                continue
              }
              const old = defs ? defs[0].value : Number(cell)
              const next = mapping(old)
              if (defs && next !== null) {
                if (
                  next !== old &&
                  !rewrites.some(
                    (r) => r.file === defs[0].span.file && r.start === defs[0].span.start,
                  )
                ) {
                  const span = defs[0].span
                  rewrites.push({
                    ...span,
                    before: this.current[span.file].slice(span.start, span.end),
                    after: String(next),
                    reason: 'Renumber layer symbol definition',
                  })
                }
                continue
              }
              const tapMatch =
                match[1] === 'lt'
                  ? value.slice(match.index + match[0].length).match(/^\s+([^\s<>;,{}]+)/)
                  : null
              const tap = tapMatch?.[1]
              add(
                cellStart,
                cellStart + cell.length,
                old,
                fullStart,
                tapMatch
                  ? fullStart + match[0].length + tapMatch[0].length
                  : cellStart + cell.length,
                tap ? `&kp ${tap}` : '&none',
              )
            }
          } else if (['layers', 'if-layers', 'then-layer'].includes(item.name)) {
            for (const match of clean
              .slice(item.valueSpan.start, item.valueSpan.end)
              .matchAll(/\b\d+\b/g)) {
              const start = item.valueSpan.start + match.index
              add(
                start,
                start + match[0].length,
                Number(match[0]),
                start,
                start + match[0].length,
                '',
              )
            }
          }
        }
      }
      walk(cst.children)
    }
    if (expressions.length) throw new UnsupportedLayerExpressionError(expressions)
    if (unresolved.length) throw new UnresolvedLayerSymbolError(unresolved)
    return rewrites
  }
  private applyRewrites(rewrites: LayerRewrite[]) {
    for (const rewrite of [...rewrites].sort((left, right) => right.start - left.start))
      this.patch(rewrite, rewrite.after)
  }
  removeLayer(index: number, options: { force?: boolean } = {}): LayerRewrite[] {
    const layer = this.model.layers[index]
    if (!layer) throw new RangeError('Layer not found')
    const rewrites = this.layerReferences(
      (target) => (target === index ? null : target > index ? target - 1 : target),
      index,
    )
    const references = rewrites.filter((rewrite) => !rewrite.reason.startsWith('Renumber layer'))
    if (references.length && !options.force) throw new LayerReferencedError(references)
    this.applyRewrites([...rewrites, { ...layer, before: '', after: '', reason: 'Remove layer' }])
    return rewrites
  }
  moveLayer(from: number, to: number): LayerRewrite[] {
    const layers = this.model.layers
    if (!layers[from] || !layers[to]) throw new RangeError('Layer not found')
    if (from === to) return []
    if (layers[from].file !== layers[to].file) throw new Error('Cannot move layers between files')
    const rewrites = this.layerReferences((target) => {
      if (target === from) return to
      if (from < to && target > from && target <= to) return target - 1
      if (from > to && target >= to && target < from) return target + 1
      return target
    })
    this.applyRewrites(rewrites)
    const updated = this.model.layers
    const first = Math.min(from, to),
      last = Math.max(from, to)
    const source = this.current[updated[first].file]
    const pieces = updated
      .slice(first, last + 1)
      .map((layer) => source.slice(layer.start, layer.end))
    const moved = pieces.splice(from - first, 1)[0]
    pieces.splice(to - first, 0, moved)
    const patches = updated
      .slice(first, last + 1)
      .map((layer, index) => ({ ...layer, before: '', after: pieces[index], reason: 'Move layer' }))
    this.applyRewrites(patches)
    return rewrites
  }
  renameLayer(index: number, name: string) {
    const layer = this.model.layers[index]
    if (!layer) throw new RangeError('Layer not found')
    if (!/^[A-Za-z_][\w,.-]*$/.test(name)) throw new Error('Invalid node name')
    this.patch(layer.node.nameSpan, name)
  }
  serialize(): FileMap {
    return { ...this.current }
  }
  diff(): Record<string, string> {
    const result: Record<string, string> = {}
    for (const file of Object.keys(this.current))
      if (this.original[file] !== this.current[file])
        result[file] = createTwoFilesPatch(
          `a/${file}`,
          `b/${file}`,
          this.original[file] ?? '',
          this.current[file],
        )
    return result
  }
}
export function createEditor(files: FileMap, entry: string): ZmkEditor {
  return new ZmkEditor(files, entry)
}
