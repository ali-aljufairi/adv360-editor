export type FileMap = Record<string, string>
export interface Span {
  file: string
  start: number
  end: number
}
export interface Token extends Span {
  kind: 'word' | 'string' | 'punct' | 'trivia' | 'directive'
  text: string
}
export interface Property extends Span {
  kind: 'property'
  name: string
  value: string
  valueSpan?: Span
}
export interface Node extends Span {
  kind: 'node'
  name: string
  label?: string
  nameSpan: Span
  bodyStart: number
  bodyEnd: number
  children: (Node | Property)[]
}
export interface CST {
  file: string
  source: string
  tokens: Token[]
  children: (Node | Property)[]
}
export interface Binding extends Span {
  behavior: string
  params: string[]
  text: string
}
export interface Layer extends Span {
  name: string
  displayName?: string
  bindings: Binding[]
  node: Node
}
export interface Behavior extends Span {
  name: string
  label?: string
  compatible: string
  properties: Record<string, string>
  bindings: Binding[]
  waitMs?: number
  tapMs?: number
  node: Node
}
export interface Combo extends Span {
  name: string
  bindings: Binding[]
  keyPositions: number[]
  timeoutMs?: number
  layers?: number[]
  condition?: string
  node: Node
}
export interface Model {
  layers: Layer[]
  behaviors: Behavior[]
  macros: Behavior[]
  combos: Combo[]
  files: Record<string, CST>
  missingIncludes: string[]
  boardBehaviors: string[]
}

/** A diagnostic with a source range. */
export interface Issue extends Span {
  code: string
  severity: 'error' | 'warning' | 'info'
  message: string
  layer?: number
  key?: number
}
export interface PhysicalKey {
  index: number
  x: number
  y: number
  w: number
  h: number
  r: number
  [key: string]: unknown
}
