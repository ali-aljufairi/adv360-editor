/** Parse CSS hex colors into normalized sRGB. */
export function parseColor(value: string): [number, number, number] {
  const match = /^#([\da-f]{3}|[\da-f]{6})$/i.exec(value.trim())
  if (!match) throw new Error(`Invalid color: ${value}`)
  const value250 =
    match[1].length === 3 ? [...match[1]].map((value304) => value304 + value304).join('') : match[1]
  return [0, 2, 4].map((i) => parseInt(value250.slice(i, i + 2), 16) / 255) as [
    number,
    number,
    number,
  ]
}
/**
 *
 */
export function toHex(rgb: readonly number[]): string {
  return (
    '#' +
    rgb
      .map((value572) =>
        Math.round(Math.max(0, Math.min(1, value572)) * 255)
          .toString(16)
          .padStart(2, '0'),
      )
      .join('')
  )
}
/**
 *
 */
export function mix(value760: string, value778: string, value796: number): string {
  const value832 = parseColor(value760),
    value869 = parseColor(value778)
  return toHex(value832.map((value930, i) => value930 * (1 - value796) + value869[i] * value796))
}
/**
 *
 */
export function luminance(color: string): number {
  return parseColor(color)
    .map((value1100) =>
      value1100 <= 0.04045 ? value1100 / 12.92 : ((value1100 + 0.055) / 1.055) ** 2.4,
    )
    .reduce((value1210, value1221, i) => value1210 + value1221 * [0.2126, 0.7152, 0.0722][i], 0)
}
/**
 *
 */
export function contrast(value1332: string, value1351: string): number {
  const value1388 = luminance(value1332),
    value1426 = luminance(value1351)
  return (Math.max(value1388, value1426) + 0.05) / (Math.min(value1388, value1426) + 0.05)
}
/**
 *
 */
export function ensureContrast(fg: string, bg: string, target: number): string {
  if (contrast(fg, bg) >= target) return fg
  const end = contrast('#000000', bg) > contrast('#ffffff', bg) ? '#000000' : '#ffffff'
  let lo = 0,
    hi = 1
  for (let i = 0; i < 24; i++) {
    const mid = (lo + hi) / 2
    if (contrast(mix(fg, end, mid), bg) >= target) hi = mid
    else lo = mid
  }
  return mix(fg, end, hi)
}
/** Convert sRGB to OKLCH (L in 0..1, hue in degrees). */
export function srgbToOklch(color: string): [number, number, number] {
  const [value2112, value2123, value2134] = parseColor(color).map((value2170) =>
    value2170 <= 0.04045 ? value2170 / 12.92 : ((value2170 + 0.055) / 1.055) ** 2.4,
  )
  const value2281 = Math.cbrt(
      0.4122214708 * value2112 + 0.5363325363 * value2123 + 0.0514459929 * value2134,
    ),
    value2388 = Math.cbrt(
      0.2119034982 * value2112 + 0.6806995451 * value2123 + 0.1073969566 * value2134,
    ),
    value2495 = Math.cbrt(
      0.0883024619 * value2112 + 0.2817188376 * value2123 + 0.6299787005 * value2134,
    )
  const value2605 = 0.2104542553 * value2281 + 0.793617785 * value2388 - 0.0040720468 * value2495,
    value2700 = 1.9779984951 * value2281 - 2.428592205 * value2388 + 0.4505937099 * value2495,
    bb = 0.0259040371 * value2281 + 0.7827717662 * value2388 - 0.808675766 * value2495
  return [
    value2605,
    Math.hypot(value2700, bb),
    ((Math.atan2(bb, value2700) * 180) / Math.PI + 360) % 360,
  ]
}
/** Convert OKLCH to clipped sRGB. */
export function oklchToSrgb([value3054, value3065, value3076]: readonly [
  number,
  number,
  number,
]): string {
  const value3141 = value3065 * Math.cos((value3076 * Math.PI) / 180),
    value3208 = value3065 * Math.sin((value3076 * Math.PI) / 180)
  const value3278 = (value3054 + 0.3963377774 * value3141 + 0.2158037573 * value3208) ** 3,
    value3366 = (value3054 - 0.1055613458 * value3141 - 0.0638541728 * value3208) ** 3,
    value3454 = (value3054 - 0.0894841775 * value3141 - 1.291485548 * value3208) ** 3
  return toHex(
    [
      4.0767416621 * value3278 - 3.3077115913 * value3366 + 0.2309699292 * value3454,
      -1.2684380046 * value3278 + 2.6097574011 * value3366 - 0.3413193965 * value3454,
      -0.0041960863 * value3278 - 0.7034186147 * value3366 + 1.707614701 * value3454,
    ].map((value3828) =>
      value3828 <= 0.0031308 ? 12.92 * value3828 : 1.055 * value3828 ** (1 / 2.4) - 0.055,
    ),
  )
}
