import data from './presets.generated.json'
import { fromTerminal } from './fromTerminal'
import { fromOpenCode } from './opencode'
import type { Mode, ThemeDef, Tokens } from './tokens'
export const presets = data as ThemeDef[]
export function resolveTheme(theme: ThemeDef, mode: Mode): Tokens {
 const fallback=presets.find(p=>p.id===`ghostty:catppuccin-${mode==='dark'?'mocha':'latte'}`)!
 const base=fromTerminal(theme.palette || fallback.palette!)
 return theme.type==='semantic'?fromOpenCode(theme,mode,base,fallback.palette!.ansi).tokens:base
}
