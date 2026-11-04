import { describe, expect, it } from 'vitest'
import { presets, resolveTheme } from '../../src/lib/theme/catalog'
import { contrast } from '../../src/lib/theme/color'
import { parseGhostty } from '../../src/lib/theme/parseGhostty'
import { fromOpenCode } from '../../src/lib/theme/opencode'

describe('theme engine', () => {
 it('meets contrast targets for all presets and modes', () => {
  for(const p of presets) for(const mode of ['light','dark'] as const) { const t=resolveTheme(p,mode); expect(contrast(t['keycap-legend'],t['keycap-face']),p.name).toBeGreaterThanOrEqual(4.5); expect(contrast(t['keycap-sublegend'],t['keycap-face']),p.name).toBeGreaterThanOrEqual(3); for(const n of ['layer-1','layer-2','layer-3','layer-4'] as const) expect(contrast(t[n],t['surface-canvas']),p.name).toBeGreaterThanOrEqual(3) }
 })
 it('excludes uncleared terminal palettes',()=>{for(const p of presets) if(p.type==='terminal') expect(['MIT','Apache-2.0']).toContain((p as unknown as {license:string}).license)})
 it('maps representative palettes',()=>{expect(['Catppuccin Mocha','Catppuccin Latte','TokyoNight'].map(name=>resolveTheme(presets.find(p=>p.name===name)!,'dark'))).toMatchSnapshot()})
 it('parses Ghostty and OpenCode overrides',()=>{const p=parseGhostty('background = #000\nforeground = #fff\npalette = 4=#112233\nfont-size = 14'); expect(p.ansi[4]).toBe('#112233'); const base=resolveTheme(presets[0],'dark'); const result=fromOpenCode({id:'x',name:'x',type:'semantic',defs:{blue:'#123456'},theme:{background:'blue',unknown:'#fff'}},'dark',base); expect(result.tokens['surface-canvas']).toBe('#123456'); expect(result.unknown).toEqual(['unknown'])})
})
