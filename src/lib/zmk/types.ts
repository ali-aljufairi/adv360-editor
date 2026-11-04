/** File contents indexed by path. */
export type FileMap = Record<string, string>
/** A source range within a file. */
export interface Span {
  file: string
  start: number
  end: number
}
/** A lossless lexical token. */
export interface Token extends Span {
  kind: 'word' | 'string' | 'punct' | 'trivia' | 'directive'
  text: string
}
/** A parsed device tree property. */
export interface Property extends Span {
  kind: 'property'
  name: string
  value: string
  valueSpan?: Span
}
/** A parsed device tree node. */
export interface Node extends Span {
  kind: 'node'
  name: string
  label?: string
  nameSpan: Span
  bodyStart: number
  bodyEnd: number
  children: (Node | Property)[]
}
/** A concrete syntax tree and its source. */
export interface CST {
  file: string
  source: string
  tokens: Token[]
  children: (Node | Property)[]
}
/** A behavior binding and its arguments. */
export interface Binding extends Span {
  behavior: string
  params: string[]
  text: string
  /** False when the binding is an opaque preprocessor expression. */
  editable: boolean
  /** Why the editor cannot safely rewrite this binding. */
  reason?: string
}
/** A keymap layer and its bindings. */
export interface Layer extends Span {
  name: string
  displayName?: string
  bindings: Binding[]
  /** Raw sensor-bindings property value, retained verbatim when present. */
  sensorBindings?: string
  node: Node
}
/** A resolved behavior or macro. */
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
/** A resolved key combination. */
export interface Combo extends Span {
  name: string
  bindings: Binding[]
  keyPositions: number[]
  timeoutMs?: number
  layers?: number[]
  condition?: string
  node: Node
}
/** A conditional layer rule that activates a target layer when source layers are active. */
export interface ConditionalLayer extends Span {
  name: string
  ifLayers: number[]
  thenLayer?: number
}
/** The resolved keymap and its dependencies. */
export interface Model {
  layers: Layer[]
  behaviors: Behavior[]
  macros: Behavior[]
  combos: Combo[]
  conditionalLayers: ConditionalLayer[]
  files: Record<string, CST>
  missingIncludes: string[]
  boardBehaviors: string[]
}

/** Physical key from board layout metadata. */
export interface PhysicalKey {
  index: number
  x: number
  y: number
  w: number
  h: number
  r: number
  label?: string
  [key: string]: unknown
}

/** A diagnostic with a source range. */
export interface Issue extends Span {
  code: string
  severity: 'error' | 'warning' | 'info'
  message: string
  layer?: number
  key?: number
}
