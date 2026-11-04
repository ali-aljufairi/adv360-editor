import { contrast, ensureContrast, parseColor, toHex } from './color'
import { tokenNames } from './tokens'
import type { Mode, ThemeDef, Tokens } from './tokens'
const aliases: Record<string,string> = {primary:'layer-1',secondary:'layer-2',accent:'layer-3',text:'text-primary',textMuted:'text-muted',background:'surface-canvas',backgroundPanel:'surface-panel',backgroundElement:'surface-raised',border:'border-base',borderActive:'focus-ring',warning:'status-warning',error:'status-error',success:'status-success',info:'status-info',diffAdded:'diff-add',diffRemoved:'diff-remove',diffAddedBg:'diff-add-bg',diffRemovedBg:'diff-remove-bg'}
/** Apply and validate OpenCode semantic overrides, reporting unknown keys. */
export function fromOpenCode(def: ThemeDef, mode: Mode, base: Tokens, ansi: string[] = []): { tokens: Tokens; unknown: string[] } {
 const tokens={...base}, unknown:string[]=[]
 const resolve=(value:string|number, seen = new Set<string>()):string=>{
  if(typeof value==='number') { if(!ansi[value]) throw new Error(`Unknown ANSI index ${value}`); return ansi[value] }
  const key=value.replace(/^\$/, '')
  if(def.defs && key in def.defs) { if(seen.has(key)) throw new Error('Circular color definition'); seen.add(key); return resolve(def.defs[key],seen) }
  if(value==='none' || value==='transparent') return 'transparent'
  return toHex(parseColor(value))
 }
 for(const [key, pair] of Object.entries(def.theme || {})) {
  const name=aliases[key] || key.replace(/[A-Z]/g,c=>'-'+c.toLowerCase())
  if(!tokenNames.includes(name as keyof Tokens)) {unknown.push(key); continue}
  tokens[name as keyof Tokens]=resolve(typeof pair==='object'?pair[mode]:pair)
 }
 for(const [name,bg,ratio] of [['keycap-legend','keycap-face',4.5],['keycap-sublegend','keycap-face',3],['text-primary','surface-canvas',4.5],['text-secondary','surface-panel',4.5],['text-muted','surface-panel',3]] as const) tokens[name]=ensureContrast(tokens[name],tokens[bg],ratio)
 for(const name of ['layer-1','layer-2','layer-3','layer-4','arc-holdtap','arc-macro','arc-bluetooth','arc-combo','status-warning','status-error','status-success','status-info','focus-ring','accent-primary'] as const) tokens[name]=ensureContrast(tokens[name],tokens['surface-canvas'],3.15)
 for(const [on,baseName] of [['on-accent','accent-primary'],['on-warning','status-warning'],['on-success','status-success'],['on-combo','arc-combo'],['on-layer-1','layer-1'],['on-layer-2','layer-2'],['on-layer-3','layer-3'],['on-layer-4','layer-4']] as const) { const c=tokens[baseName]; tokens[on]=contrast('#000000',c)>contrast('#ffffff',c)?'#000000':'#ffffff' }
 return {tokens,unknown}
}
