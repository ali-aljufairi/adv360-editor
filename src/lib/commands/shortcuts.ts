/** Resolve batch shortcuts only while the board owns focus, never in an editable control. */
export function batchShortcut(
  event: { key: string; metaKey: boolean; ctrlKey: boolean; altKey: boolean; shiftKey: boolean },
  boardFocused: boolean,
): 'edit.copy' | 'edit.paste' | 'edit.cut' | null {
  if (!boardFocused || !(event.metaKey || event.ctrlKey) || event.altKey || event.shiftKey)
    return null
  switch (event.key.toLowerCase()) {
    case 'c':
      return 'edit.copy'
    case 'v':
      return 'edit.paste'
    case 'x':
      return 'edit.cut'
    default:
      return null
  }
}
