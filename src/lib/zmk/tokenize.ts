import type { Token } from './types'
/** Token offsets are UTF-16 string offsets, suitable for slicing the original source. */
export function tokenize(source: string, file = ''): Token[] {
  const re =
    /(?:^[ \t]*#(?:include|define|if|ifdef|ifndef|elif|else|endif|undef|pragma|error|warning)\b[^\r\n]*(?:\\\r?\n[^\r\n]*)*)|(?:\/\*[\s\S]*?(?:\*\/|$))|(?:\/\/[^\r\n]*)|(?:\r?\n|[^\S\r\n]+)|(?:"(?:\\[\s\S]|[^"\\])*(?:"|$))|(?:[{};=<>:,()[\]])|(?:[^\s{};=<>:,()[\]"/]+)|(?:.)/gm
  return Array.from(source.matchAll(re), (m) => {
    const text = m[0]
    const start = m.index!
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
