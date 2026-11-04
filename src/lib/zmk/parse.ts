import type { CST, Node, Property } from './types'
import { tokenize } from './tokenize'
/** Parse source into a lossless concrete syntax tree. */
export function parse(source: string, file = ''): CST {
  const tokens = tokenize(source, file)
  const sig = tokens.filter((token) => token.kind !== 'trivia' && token.kind !== 'directive')
  let i = 0
  const children = (nested: boolean): (Node | Property)[] => {
    const out: (Node | Property)[] = []
    while (i < sig.length && (!nested || sig[i].text !== '}')) {
      const begin = i
      let j = i
      let depth = 0
      let parentheses = 0
      while (j < sig.length) {
        const currentSource = sig[j].text
        if (currentSource === '(') parentheses++
        if (currentSource === ')') parentheses--
        if (
          currentSource === '(' ||
          currentSource === '[' ||
          (currentSource === '<' && parentheses === 0)
        )
          depth++
        if (
          currentSource === ')' ||
          currentSource === ']' ||
          (currentSource === '>' && parentheses === 0)
        )
          depth--
        if (
          depth === 0 &&
          (currentSource === '{' || currentSource === ';' || currentSource === '}')
        )
          break
        j++
      }
      if (j >= sig.length || sig[j].text === '}') {
        i = j
        break
      }
      const head = sig.slice(begin, j)
      if (!head.length) {
        i = j + 1
        continue
      }
      if (sig[j].text === '{') {
        const colon = head.findIndex((currentToken) => currentToken.text === ':')
        const nameTok = head[colon >= 0 ? colon + 1 : 0]
        if (!nameTok) {
          i = j + 1
          continue
        }
        const open = sig[j]
        i = j + 1
        const kids = children(true)
        const close = sig[i]
        if (close?.text === '}') i++
        const semi = sig[i]?.text === ';' ? sig[i++] : close
        out.push({
          kind: 'node',
          file,
          start: head[0].start,
          end: semi?.end ?? source.length,
          name: nameTok.text,
          label: colon >= 0 ? head[0].text : undefined,
          nameSpan: { file, start: nameTok.start, end: nameTok.end },
          bodyStart: open.end,
          bodyEnd: close?.start ?? source.length,
          children: kids,
        })
      } else {
        const eq = head.findIndex((nextToken) => nextToken.text === '=')
        const name = head[0].text
        const currentValue = eq >= 0 ? head.slice(eq + 1) : []
        out.push({
          kind: 'property',
          file,
          start: head[0].start,
          end: sig[j].end,
          name,
          value: currentValue.length
            ? source.slice(currentValue[0].start, currentValue[currentValue.length - 1].end)
            : '',
          valueSpan: currentValue.length
            ? { file, start: currentValue[0].start, end: currentValue[currentValue.length - 1].end }
            : undefined,
        })
        i = j + 1
      }
    }
    return out
  }
  return { file, source, tokens, children: children(false) }
}
/** Return the original source of a concrete syntax tree. */
export function serialize(cst: CST): string {
  return cst.tokens.map((otherToken) => otherToken.text).join('')
}
