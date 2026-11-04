import { createTwoFilesPatch } from 'diff'

export type FileMap = Record<string, string>
export interface Span { file: string; start: number; end: number }
export interface Token extends Span { kind: 'word' | 'string' | 'punct' | 'trivia' | 'directive'; text: string }
export interface Property extends Span { kind: 'property'; name: string; value: string; valueSpan?: Span }
export interface Node extends Span { kind: 'node'; name: string; label?: string; nameSpan: Span; bodyStart: number; bodyEnd: number; children: (Node | Property)[] }
export interface CST { file: string; source: string; tokens: Token[]; children: (Node | Property)[] }
export interface Binding extends Span { behavior: string; params: string[]; text: string }
export interface Layer extends Span { name: string; displayName?: string; bindings: Binding[]; node: Node }
export interface Behavior extends Span { name: string; label?: string; compatible: string; properties: Record<string, string>; bindings: Binding[]; waitMs?: number; tapMs?: number; node: Node }
export interface Combo extends Span { name: string; bindings: Binding[]; keyPositions: number[]; timeoutMs?: number; layers?: number[]; condition?: string; node: Node }
export interface Model { layers: Layer[]; behaviors: Behavior[]; macros: Behavior[]; combos: Combo[]; files: Record<string, CST>; missingIncludes: string[] }

/** Token offsets are UTF-16 string offsets, suitable for slicing the original source. */
export function tokenize(source: string, file = ''): Token[] {
  const re = /(?:^[ \t]*\#(?:include|define|if|ifdef|ifndef|elif|else|endif|undef|pragma|error|warning)\b[^\r\n]*(?:\\\r?\n[^\r\n]*)*)|(?:\/\*[\s\S]*?(?:\*\/|$))|(?:\/\/[^\r\n]*)|(?:\r?\n|[^\S\r\n]+)|(?:"(?:\\[\s\S]|[^"\\])*(?:"|$))|(?:[{};=<>:,()[\]])|(?:[^\s{};=<>:,()[\]"\/]+)|(?:.)/gm
  return Array.from(source.matchAll(re), m => {
    const text = m[0]; const start = m.index!;
    const kind: Token['kind'] = /^\s*#(?:include|define|if|ifdef|ifndef|elif|else|endif|undef|pragma|error|warning)\b/.test(text) ? 'directive' : /^(?:\s|\/\*|\/\/)/.test(text) ? 'trivia' : text.startsWith('"') ? 'string' : /^[{};=<>:,()[\]]$/.test(text) ? 'punct' : 'word'
    return {kind, text, file, start, end: start + text.length}
  })
}
export function parse(source: string, file = ''): CST {
  const tokens = tokenize(source, file); const sig = tokens.filter(t => t.kind !== 'trivia' && t.kind !== 'directive'); let i = 0
  const children = (nested: boolean): (Node | Property)[] => {
    const out: (Node | Property)[] = []
    while (i < sig.length && (!nested || sig[i].text !== '}')) {
      const begin = i; let j = i; let depth = 0
      while (j < sig.length) { const s = sig[j].text; if (s === '<' || s === '(' || s === '[') depth++; if (s === '>' || s === ')' || s === ']') depth--; if (depth === 0 && (s === '{' || s === ';' || s === '}')) break; j++ }
      if (j >= sig.length || sig[j].text === '}') { i = j; break }
      const head = sig.slice(begin, j); if (!head.length) { i = j + 1; continue }
      if (sig[j].text === '{') {
        const colon = head.findIndex(t => t.text === ':'); const nameTok = head[colon >= 0 ? colon + 1 : 0];
        if (!nameTok) { i = j + 1; continue }
        const open = sig[j]; i = j + 1; const kids = children(true); const close = sig[i]; if (close?.text === '}') i++; const semi = sig[i]?.text === ';' ? sig[i++] : close
        out.push({kind:'node', file, start:head[0].start, end:semi?.end ?? source.length, name:nameTok.text, label:colon >= 0 ? head[0].text : undefined, nameSpan:{file,start:nameTok.start,end:nameTok.end}, bodyStart:open.end, bodyEnd:close?.start ?? source.length, children:kids})
      } else {
        const eq = head.findIndex(t => t.text === '='); const name = head[0].text; const v = eq >= 0 ? head.slice(eq + 1) : []
        out.push({kind:'property',file,start:head[0].start,end:sig[j].end,name,value:v.length ? source.slice(v[0].start,v[v.length-1].end) : '',valueSpan:v.length ? {file,start:v[0].start,end:v[v.length-1].end} : undefined}); i = j + 1
      }
    }
    return out
  }
  return {file,source,tokens,children:children(false)}
}
const nodes = (items: (Node | Property)[]): Node[] => items.filter((x): x is Node => x.kind === 'node')
const prop = (node: Node, name: string): Property | undefined => node.children.find((x): x is Property => x.kind === 'property' && x.name === name)
const unquote = (v?: string) => v?.match(/^"((?:\\.|[^"\\])*)"/)?.[1]
function bindings(p: Property | undefined, source: string): Binding[] {
  if (!p?.valueSpan) return []
  const ts = tokenize(p.value, p.file).filter(t => t.kind !== 'trivia' && t.kind !== 'directive'); const result: Binding[] = []
  for (let i = 0; i < ts.length; i++) {
    if (!ts[i].text.startsWith('&')) continue
    const start = ts[i].start; const behavior = ts[i].text.slice(1); let end = ts[i].end; const params: string[] = []; let depth = 0; let part = ''
    for (i++; i < ts.length; i++) { const t = ts[i]; if (depth === 0 && (t.text.startsWith('&') || t.text === '>' || t.text === ',')) { i--; break }
      if (depth === 0 && part && t.start > end) { params.push(part); part = '' }
      part += t.text; end = t.end; if (t.text === '(') depth++; if (t.text === ')') depth--
    }
    if (part) params.push(part)
    const absolute = p.valueSpan.start; result.push({file:p.file,start:absolute+start,end:absolute+end,behavior,params,text:source.slice(absolute+start,absolute+end)})
  }
  return result
}
function resolvePath(base: string, relative: string): string { const parts = base.split('/'); parts.pop(); for (const p of relative.split('/')) { if (p === '..') parts.pop(); else if (p !== '.') parts.push(p) } return parts.join('/') }
function conditions(cst: CST, position: number): string | undefined {
  const stack: { previous: string[]; current: string }[] = []
  for (const t of cst.tokens) {
    if (t.start >= position) break
    if (t.kind !== 'directive') continue
    const m = t.text.trim().match(/^#(if|ifdef|ifndef|elif|else|endif)\b\s*(.*)/)
    if (!m) continue
    const frame = stack[stack.length - 1]
    if (m[1] === 'endif') stack.pop()
    else if (m[1] === 'elif' && frame) { frame.previous.push(frame.current); frame.current = m[2] }
    else if (m[1] === 'else' && frame) { frame.previous.push(frame.current); frame.current = '1' }
    else if (['if','ifdef','ifndef'].includes(m[1])) stack.push({previous:[],current:m[1] === 'ifdef' ? `defined(${m[2]})` : m[1] === 'ifndef' ? `!defined(${m[2]})` : m[2]})
  }
  return stack.length ? stack.map(f => [...f.previous.map(p => `!(${p})`), ...(f.current === '1' ? [] : [f.current])].join(' && ') || '1').join(' && ') : undefined
}
export function resolve(files: FileMap, entry: string): Model {
  if (!(entry in files)) throw new Error(`Missing entry: ${entry}`)
  const parsed: Record<string,CST> = {}; const missingIncludes: string[] = []; const layers: Layer[] = []; const behaviors: Behavior[] = []; const combos: Combo[] = []
  const visit = (file: string, context: string, active: Set<string>) => {
    if (active.has(file)) return; const next = new Set(active).add(file); const cst = parsed[file] ??= parse(files[file],file)
    const walk = (items: (Node | Property)[], parent: string, start: number, end: number) => {
      const entries: ({start:number; node?:Node; include?:string})[] = nodes(items).map(node => ({start:node.start,node}))
      for (const t of cst.tokens) if (t.kind === 'directive' && t.start >= start && t.end <= end && !nodes(items).some(n => t.start >= n.start && t.end <= n.end)) { const m = t.text.match(/^\s*#include\s+"([^"]+)"/); if (m) entries.push({start:t.start,include:m[1]}) }
      entries.sort((a,b) => a.start-b.start)
      for (const e of entries) { if (e.include) { const path = resolvePath(file,e.include); if (path in files) visit(path,parent,next); else if (!missingIncludes.includes(path)) missingIncludes.push(path); continue }
        const n = e.node!; const get = (key:string) => prop(n,key)?.value; const bs = bindings(prop(n,'bindings'),cst.source); const compatible = unquote(get('compatible'))
        if (parent === 'keymap') layers.push({...n,name:n.name,displayName:unquote(get('display-name')) ?? unquote(get('label')),bindings:bs,node:n})
        if (compatible && (compatible.startsWith('zmk,behavior-') || parent === 'behaviors' || parent === 'macros')) { const properties: Record<string,string> = {}; for (const p of n.children) if (p.kind === 'property') properties[p.name] = p.value; behaviors.push({...n,name:n.name,label:n.label,compatible,properties,bindings:bs,waitMs: get('wait-ms') === undefined ? undefined : Number(get('wait-ms')?.match(/-?\d+/)?.[0]),tapMs: get('tap-ms') === undefined ? undefined : Number(get('tap-ms')?.match(/-?\d+/)?.[0]),node:n}) }
        if (parent === 'combos' && prop(n,'key-positions')) { const nums = (v?:string) => (v?.match(/-?\d+/g) ?? []).map(Number); combos.push({...n,name:n.name,bindings:bs,keyPositions:nums(get('key-positions')),timeoutMs:nums(get('timeout-ms'))[0],layers:get('layers') === undefined ? undefined : nums(get('layers')),condition:conditions(cst,n.start),node:n}) }
        walk(n.children,n.name,n.bodyStart,n.bodyEnd)
      }
    }; walk(cst.children,context,0,cst.source.length)
  }; visit(entry,'',new Set()); return {layers,behaviors,macros:behaviors.filter(b => b.compatible === 'zmk,behavior-macro'),combos,files:parsed,missingIncludes}
}
export interface Issue { code: string; message: string; span?: Span }
export function validate(model: Model): Issue[] {
  const issues: Issue[] = []; const count = model.layers.length; const edges: number[][] = model.layers.map(() => []); const persistent: [number,number,Binding][] = []
  const add = (from:number,b:Binding) => { if (!['mo','lt','tog','to','sl'].includes(b.behavior)) return; const target = Number(b.params[0]); if (!Number.isInteger(target) || target < 0 || target >= count) return; edges[from].push(target); if (['tog','to'].includes(b.behavior)) persistent.push([from,target,b]) }
  model.layers.forEach((l,i) => { if (l.bindings.length !== 76) issues.push({code:'binding-count',message:`Layer ${i} has ${l.bindings.length} bindings, expected 76`,span:l}); l.bindings.forEach(b => add(i,b)) })
  for (const c of model.combos) { const active = c.layers ?? model.layers.map((_,i)=>i); for (const pos of c.keyPositions) if (pos < 0 || pos >= 76) issues.push({code:'combo-position',message:`Combo ${c.name} position ${pos} is out of range`,span:c}); for (const i of active) if (edges[i]) c.bindings.forEach(b => add(i,b)) }
  const reachable = (start:number) => { const seen = new Set<number>([start]); const queue = [start]; for (const n of queue) for (const v of edges[n] ?? []) if (!seen.has(v)) {seen.add(v);queue.push(v)} return seen }
  const fromZero = reachable(0); model.layers.forEach((l,i) => { if (!fromZero.has(i)) issues.push({code:'unreachable-layer',message:`Layer ${i} (${l.name}) is unreachable`,span:l}) })
  for (const [from,to,b] of persistent) if (to !== from && !reachable(to).has(from)) issues.push({code:'no-return',message:`Layer ${to} has no path back to layer ${from}`,span:b})
  for (let i=0;i<model.combos.length;i++) for(let j=i+1;j<model.combos.length;j++) { const a=model.combos[i], b=model.combos[j]; if (a.keyPositions.some(p=>b.keyPositions.includes(p)) && (!a.layers || !b.layers || a.layers.some(l=>b.layers!.includes(l)))) issues.push({code:'combo-overlap',message:`Combos ${a.name} and ${b.name} overlap`,span:b}) }
  const known = new Set(['kp','mo','lt','tog','to','sl','mt','trans','none','bt','rgb_ug','bl','bootloader','studio_unlock','mkp','mmv','msc','sk','caps_word','sys_reset','ext_power','out','macro_pause_for_release','macro_press','macro_release','macro_tap','macro_wait_time','macro_tap_time',...model.behaviors.map(b=>b.label ?? b.name)])
  for (const b of [...model.layers.flatMap(l=>l.bindings),...model.combos.flatMap(c=>c.bindings),...model.behaviors.flatMap(x=>x.bindings)]) if (!known.has(b.behavior)) issues.push({code:'undefined-behavior',message:`Undefined behavior &${b.behavior}`,span:b})
  return issues
}
export interface PhysicalKey { index:number; x:number; y:number; w:number; h:number; r:number; [key:string]: unknown }
export function loadPhysicalLayout(info: string | {layouts: Record<string,{layout: Record<string,unknown>[]}>}, name = 'LAYOUT'): PhysicalKey[] { const data = typeof info === 'string' ? JSON.parse(info) : info; const layout = data.layouts?.[name]?.layout; if (!Array.isArray(layout)) throw new Error(`Missing layout ${name}`); return layout.map((key:Record<string,unknown>,index:number)=>({...key,index,x:Number(key.x),y:Number(key.y),w:Number(key.w ?? 1),h:Number(key.h ?? 1),r:Number(key.r ?? 0)})) }

/** Edits apply immediately; each operation reparses the current files so spans stay valid. */
export class ZmkEditor {
  private original: FileMap
  private current: FileMap
  readonly entry: string
  constructor(files: FileMap, entry: string) { this.entry = entry; this.original = {...files}; this.current = {...files}; resolve(this.current,entry) }
  get model(): Model { return resolve(this.current,this.entry) }
  private patch(span: Span, text: string) { const s = this.current[span.file]; if (s === undefined) throw new Error(`Missing file ${span.file}`); this.current[span.file] = s.slice(0,span.start)+text+s.slice(span.end) }
  setBinding(layerIndex: number, keyIndex: number, binding: string) { const b = this.model.layers[layerIndex]?.bindings[keyIndex]; if (!b) throw new RangeError('Binding not found'); if (!/^&[^\s<>;,{}]+(?:\s+[^<>;,{}]+)*$/.test(binding.trim()) || /[\r\n]/.test(binding)) throw new Error('Expected a single binding'); const s=this.current[b.file]; const whitespace=s.slice(b.end).match(/^[ \t]+/)?.[0] ?? ''; const delta=binding.trim().length-(b.end-b.start); const padding=whitespace ? ' '.repeat(Math.max(1,whitespace.length-delta)) : ''; this.patch({...b,end:b.end+whitespace.length},binding.trim()+padding) }
  updateHoldTapProperty(name: string, property: string, value: string) { const b=this.model.behaviors.find(x=>(x.label===name || x.name===name) && x.compatible==='zmk,behavior-hold-tap'); if(!b) throw new Error(`Hold-tap ${name} not found`); this.updateProperty(b.node,property,value) }
  private updateProperty(node:Node, name:string, value:string) { if (!/^[#\w,.-]+$/.test(name) || /[;{}]/.test(value)) throw new Error('Invalid property'); const p=prop(node,name); if (p?.valueSpan) this.patch(p.valueSpan,value); else if (p) this.patch(p,`${name} = ${value};`); else this.patch({file:node.file,start:node.bodyEnd,end:node.bodyEnd},`    ${name} = ${value};\n`) }
  private findContainer(name:string): Node { const cst=this.model.files[this.entry]; const find=(items:(Node|Property)[]):Node|undefined => { for(const n of nodes(items)) { if(n.name===name) return n; const child=find(n.children); if(child) return child } }; const n=find(cst.children); if(!n) throw new Error(`Container ${name} not found`); return n }
  private insert(container:Node, raw:string) { if (!raw.trim()) throw new Error('Empty node'); const s=this.current[container.file]; const lineStart=s.lastIndexOf('\n',container.bodyEnd-1)+1; const indent=s.slice(lineStart,container.bodyEnd); const at=/^[ \t]*$/.test(indent) ? lineStart : container.bodyEnd; const eol=s.includes('\r\n')?'\r\n':'\n'; this.patch({file:container.file,start:at,end:at},`${raw.replace(/\r?\n/g,eol)}${eol}`) }
  addMacro(rawNode:string, container='macros', file?:string) { if (!file) { this.insert(this.findContainer(container),rawNode); return } const s=this.current[file]; if (s === undefined) throw new Error(`Missing file ${file}`); const eol=s.includes('\r\n')?'\r\n':'\n'; this.patch({file,start:s.length,end:s.length},`${s && !s.endsWith('\n') ? eol : ''}${rawNode.replace(/\r?\n/g,eol)}${eol}`) }
  updateMacro(name:string, rawNode:string) { const m=this.model.macros.find(x=>x.label===name || x.name===name); if(!m) throw new Error(`Macro ${name} not found`); this.patch(m,rawNode) }
  removeMacro(name:string) { const m=this.model.macros.find(x=>x.label===name || x.name===name); if(!m) throw new Error(`Macro ${name} not found`); this.patch(m,'') }
  addCombo(rawNode:string) { this.insert(this.findContainer('combos'),rawNode) }
  updateCombo(name:string,rawNode:string) { const c=this.model.combos.find(x=>x.name===name); if(!c) throw new Error(`Combo ${name} not found`); this.patch(c,rawNode) }
  removeCombo(name:string) { const c=this.model.combos.find(x=>x.name===name); if(!c) throw new Error(`Combo ${name} not found`); this.patch(c,'') }
  addLayer(rawNode:string) { this.insert(this.findContainer('keymap'),rawNode) }
  removeLayer(index:number) { const layer=this.model.layers[index]; if(!layer) throw new RangeError('Layer not found'); this.patch(layer,'') }
  renameLayer(index:number,name:string) { const layer=this.model.layers[index]; if(!layer) throw new RangeError('Layer not found'); if(!/^[A-Za-z_][\w,.-]*$/.test(name)) throw new Error('Invalid node name'); this.patch(layer.node.nameSpan,name) }
  serialize(): FileMap { return {...this.current} }
  diff(): Record<string,string> { const result:Record<string,string>={}; for(const file of Object.keys(this.current)) if(this.original[file]!==this.current[file]) result[file]=createTwoFilesPatch(`a/${file}`,`b/${file}`,this.original[file] ?? '',this.current[file]); return result }
}
export function createEditor(files:FileMap, entry:string): ZmkEditor { return new ZmkEditor(files,entry) }
export function serialize(cst:CST): string { return cst.tokens.map(t=>t.text).join('') }
export function diff(before:FileMap,after:FileMap): Record<string,string> { const result:Record<string,string>={}; for(const file of new Set([...Object.keys(before),...Object.keys(after)])) if(before[file]!==after[file]) result[file]=createTwoFilesPatch(`a/${file}`,`b/${file}`,before[file] ?? '',after[file] ?? ''); return result }
