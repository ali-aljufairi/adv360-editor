import type { Token } from './types'
/** Token offsets are UTF-16 string offsets, suitable for slicing the original source. */
export function tokenize(source: string, file = ''): Token[] {
  const re = new RegExp(
    [
      String.raw`(?:^[ \t]*#(?:include|define|if|ifdef|ifndef|elif|else|endif|undef|pragma|error|warning)\b[^\r\n]*(?:\\\r?\n[^\r\n]*)*)`,
      String.raw`(?:/\*[\s\S]*?(?:\*/|$))`,
      String.raw`(?://[^\r\n]*)`,
      String.raw`(?:\r?\n|[^\S\r\n]+)`,
      String.raw`(?:"(?:\\[\s\S]|[^"\\])*(?:"|$))`,
      String.raw`(?:[{};=<>:,()[\]])`,
      String.raw`(?:[^\s{};=<>:,()[\]"/]+)`,
      String.raw`(?:.)`,
    ].join('|'),
    'gm',
  )
  return Array.from(source.matchAll(re), (match) => {
    const text = match[0]
    const start = match.index!
    const kind: Token['kind'] =
      /^\s*#(?:include|define|if|ifdef|ifndef|elif|else|endif|undef|pragma|error|warning)\b/.test(
        text,
      )
        ? 'directive'
        : /^(?:\s|\/\*|\/\/)/.test(text)
          ? 'trivia'
          : text.startsWith('"')
            ? 'string'
            : /^[{};=<>:,()[\]]$/.test(text)
              ? 'punct'
              : 'word'
    return { kind, text, file, start, end: start + text.length }
  })
}
