# Keyboard navigation

The on-screen board can be driven by arrow keys, vim motions or emacs motions. The scheme is
chosen in **Settings → Keyboard navigation**, and the arrow keys can stay active in every scheme.

## Schemes

| Action | Arrows | Vim | Emacs |
| --- | --- | --- | --- |
| Left / right / up / down | ← → ↑ ↓ | `h` `l` `k` `j` | `C-b` `C-f` `C-p` `C-n` |
| Next / previous key | `Tab` / `Shift-Tab` | `w` / `b` | `M-f` / `M-b` |
| Start / end of row | `Home` / `End` | `0` or `^` / `$` | `C-a` / `C-e` |
| First / last key | `Cmd/Ctrl-↑` / `Cmd/Ctrl-↓` | `gg` / `G` | `M-<` / `M->` |
| Edit key | `Enter` | `Enter` or `i` | `Enter` |
| Cancel | `Esc` | `Esc` | `C-g` |
| Undo / redo | `Cmd/Ctrl-z` / `Cmd/Ctrl-Shift-z` | `u` / `Ctrl-r` | `C-/` / `C-?` |
| Previous / next layer | `[` / `]` | `gT` / `gt` | unbound |
| Help | `?` | `?` | `F1` |

- **Counts (vim only):** type digits before a motion, so `3l` moves three keys right. `0` starts
  a row motion unless a count is already being typed (`10j` moves ten keys down).
- **Multi-key sequences** (`gg`, `gt`, `gT`, `C-x C-s`) are abandoned after 800 ms of silence.
- **Custom:** rebinding any action in the settings panel copies the current scheme into the
  `custom` scheme, then changes that one action. Custom overrides are kept when you switch
  schemes and apply only while the custom scheme is selected.
- **Arrows always on:** when enabled, the four arrow keys also move the selection in the vim and
  emacs schemes.
- **Wrap:** when enabled, moving past the edge of the board continues from the far key of the
  same row or column. When disabled, the selection stays on the edge key.

## Where keys are ignored

Keys are never handled while focus is inside an `input`, `textarea`, `select` or any
`contenteditable` element, or while a dialog (`<dialog open>` or `role="dialog"` with
`aria-modal`) holds focus. The board also ignores keys that another handler has already
prevented, and IME composition.

## Browser conflicts

The browser decides some shortcuts before the page sees them. `preventDefault()` works for most
combinations, but not for all of them, and the exact behaviour differs by browser and OS.

| Shortcut | Used by | Browser behaviour | Advice |
| --- | --- | --- | --- |
| `Ctrl-N` (Windows/Linux) | emacs `C-n` (down) | Opens a new window in Chrome and Edge; cannot be intercepted | Use `ArrowDown` on Windows/Linux |
| `Ctrl-T`, `Ctrl-W`, `Ctrl-Shift-T` | none | Always reserved by the browser | Not bound by any preset |
| `Ctrl-F`, `Ctrl-B`, `Ctrl-P`, `Ctrl-E`, `Ctrl-A` | emacs motions | Find, bookmarks, print, address bar, select all; usually interceptable | Arrow keys are the fallback |
| `Ctrl-R`, `Cmd-R` | vim redo (`C-r`) | Reloads the page; interceptable in most browsers | If it reloads, rebind redo |
| `Cmd-Q`, `Cmd-W`, `Cmd-N`, `Cmd-T` (macOS) | none | Always reserved by macOS and the browser | Not bound by any preset |
| `Alt-letter` on macOS | emacs `M-f` / `M-b` / `M-<` | Option types a glyph (`ƒ`, `∫`, `≤`) | Matched by physical key, so `M-f` still works |
| `F1` | emacs help | Some platforms open system help | Rebind if needed |

`Ctrl-C`, `Ctrl-V` and `Ctrl-X` are never bound, so clipboard shortcuts keep working. The arrows
scheme binds `Cmd/Ctrl-z` and `Cmd/Ctrl-Shift-z` to undo and redo, as the scheme requires. The
board does not run while focus is in a text field, so text undo inside inputs is unaffected.

## Implementation notes

- `src/lib/navigation/spatial.ts` picks the target key for a move. Candidates sit inside a ±60°
  cone around the direction of travel, with the score `distance × (1 + 2·angle/60)`. For
  left and right moves, keys in the same row band win when any exist.
- `src/lib/navigation/keys.ts` turns keyboard events into tokens such as `C-n`, `M-<`,
  `Meta-S-z` and `S-Tab`. It uses the physical key code for letters and symbols when a modifier
  is held, so macOS Option produces the same token as Alt on other platforms.
- `src/lib/navigation/matcher.ts` matches tokens against bindings and handles counts and the
  800 ms timeout.
- `src/lib/settings/` stores settings in `localStorage` under `adv360.settings` as a versioned
  envelope, and falls back to defaults when storage is missing, corrupt or from a newer version.
