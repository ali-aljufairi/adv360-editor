/** Parse CSS hex colors into normalized sRGB. */
export function parseColor(value: string): [number, number, number] {
  const match = /^#([\da-f]{3}|[\da-f]{6})$/i.exec(value.trim())
  if (!match) throw new Error(`Invalid color: ${value}`)
  const h = match[1].length === 3 ? [...match[1]].map((c) => c + c).join('') : match[1]
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255) as [number, number, number]
}
export function toHex(rgb: readonly number[]): string {
  return '#' + rgb.map((v) => Math.round(Math.max(0, Math.min(1, v)) * 255).toString(16).padStart(2, '0')).join('')
}
export function mix(a: string, b: string, t: number): string {
  const x = parseColor(a), y = parseColor(b)
  return toHex(x.map((v, i) => v * (1 - t) + y[i] * t))
}
export function luminance(color: string): number {
  return parseColor(color).map((v) => v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4).reduce((a, v, i) => a + v * [0.2126, 0.7152, 0.0722][i], 0)
}
export function contrast(a: string, b: string): number {
  const x = luminance(a), y = luminance(b)
  return (Math.max(x, y) + .05) / (Math.min(x, y) + .05)
}
export function ensureContrast(fg: string, bg: string, target: number): string {
  if (contrast(fg, bg) >= target) return fg
  const end = contrast('#000000', bg) > contrast('#ffffff', bg) ? '#000000' : '#ffffff'
  let lo = 0, hi = 1
  for (let i = 0; i < 24; i++) { const mid = (lo + hi) / 2; if (contrast(mix(fg, end, mid), bg) >= target) hi = mid; else lo = mid }
  return mix(fg, end, hi)
}
/** Convert sRGB to OKLCH (L in 0..1, hue in degrees). */
export function srgbToOklch(color: string): [number, number, number] {
  const [r,g,b] = parseColor(color).map(v => v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4)
  const l = Math.cbrt(.4122214708*r+.5363325363*g+.0514459929*b), m = Math.cbrt(.2119034982*r+.6806995451*g+.1073969566*b), s = Math.cbrt(.0883024619*r+.2817188376*g+.6299787005*b)
  const L=.2104542553*l+.793617785*m-.0040720468*s, a=1.9779984951*l-2.428592205*m+.4505937099*s, bb=.0259040371*l+.7827717662*m-.808675766*s
  return [L, Math.hypot(a,bb), (Math.atan2(bb,a)*180/Math.PI+360)%360]
}
/** Convert OKLCH to clipped sRGB. */
export function oklchToSrgb([L,C,h]: readonly [number,number,number]): string {
  const a=C*Math.cos(h*Math.PI/180), b=C*Math.sin(h*Math.PI/180)
  const l=(L+.3963377774*a+.2158037573*b)**3, m=(L-.1055613458*a-.0638541728*b)**3, s=(L-.0894841775*a-1.291485548*b)**3
  return toHex([4.0767416621*l-3.3077115913*m+.2309699292*s,-1.2684380046*l+2.6097574011*m-.3413193965*s,-.0041960863*l-.7034186147*m+1.707614701*s].map(v=>v<=.0031308?12.92*v:1.055*v**(1/2.4)-.055))
}
