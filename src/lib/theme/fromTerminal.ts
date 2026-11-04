import { contrast, ensureContrast, luminance, mix } from './color'
import type { TerminalPalette, Tokens } from './tokens'

/** Derive the complete editor palette from terminal colors. */
export function fromTerminal(p: TerminalPalette): Tokens {
 const bg=p.background, fg=p.foreground, dark=luminance(bg)<=.42, pick=(n:number)=>p.ansi[n] || fg
 const panel=mix(bg,fg,dark?.045:.035), raised=mix(panel,fg,dark?.08:.055)
 const glyph=(n:number)=>ensureContrast(pick(n),bg,3.15)
 const ink=(c:string)=>contrast('#ffffff',c)>=contrast('#000000',c)?'#ffffff':'#000000'
 const rgba=(c:string,a:number)=>{const h=c.replace('#',''); return `rgba(${[0,2,4].map(i=>parseInt(h.slice(i,i+2),16)).join(',')},${a})`}
 const l=[glyph(4),glyph(2),glyph(3),glyph(5)], warning=glyph(1), success=glyph(2), combo=glyph(13), accent=l[0]
 return {
 'surface-canvas':bg,'surface-panel':panel,'surface-raised':raised,'surface-hover':mix(raised,fg,dark?.09:.06),'surface-glow':rgba(p.selection || pick(4),.1),'surface-dot':rgba(fg,dark?.075:.12),
 'text-primary':ensureContrast(fg,bg,4.5),'text-secondary':ensureContrast(mix(fg,bg,dark?.18:.25),panel,4.5),'text-muted':ensureContrast(mix(fg,bg,dark?.4:.43),panel,3),'border-base':mix(bg,fg,dark?.18:.15),'border-subtle':mix(bg,fg,dark?.1:.08),'focus-ring':ensureContrast(p.cursor || pick(4),bg,3.15),
 'keycap-top':mix(panel,'#ffffff',dark?.1:.35),'keycap-face':panel,'keycap-side':mix(panel,'#000000',dark?.42:.12),'keycap-highlight':rgba('#ffffff',dark?.17:.78),'keycap-legend':ensureContrast(fg,panel,4.5),'keycap-sublegend':ensureContrast(mix(fg,panel,dark?.29:.35),panel,3),'keycap-shadow':rgba('#000000',dark?.52:.24),
 'layer-1':l[0],'layer-2':l[1],'layer-3':l[2],'layer-4':l[3],'arc-holdtap':glyph(5),'arc-macro':glyph(5),'arc-bluetooth':glyph(4),'arc-combo':combo,'status-warning':warning,'status-error':glyph(1),'status-success':success,'status-info':glyph(6),'diff-add':glyph(2),'diff-remove':glyph(1),'diff-add-bg':mix(bg,pick(2),dark?.22:.14),'diff-remove-bg':mix(bg,pick(1),dark?.22:.14),'accent-primary':accent,
 'on-accent':ink(accent),'on-warning':ink(warning),'on-success':ink(success),'on-combo':ink(combo),'on-layer-1':ink(l[0]),'on-layer-2':ink(l[1]),'on-layer-3':ink(l[2]),'on-layer-4':ink(l[3]),'overlay':rgba('#000000',.43),'shadow-ink':rgba('#000000',dark?.45:.12),'shadow-dialog':`0 30px 65px -20px ${rgba('#000000',dark?.74:.37)}`,'shadow-float':`0 16px 36px -16px ${rgba('#000000',dark?.65:.28)}` }
}
