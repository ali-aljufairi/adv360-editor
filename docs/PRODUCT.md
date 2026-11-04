# adv360-editor — product brief

Owner: Ali Aljufairi · Product owner (agent): Claude Opus · Updated 2026-11-05

## Why

Nick Coutsos's Keymap Editor is discontinuing its GitHub integration. We are building our own
editor, specialized for one keyboard (Kinesis Advantage360 Pro, ZMK) and one config repo:
<https://github.com/ali-aljufairi/Adv360-Pro-ZMK> (branch `V3.0`, files under `config/`).
Ideas may be borrowed from <https://github.com/nickcoutsos/keymap-editor> (MIT) with attribution.

## Non-negotiables

1. **Round-trip fidelity.** Parse → serialize with no edits must be byte-identical to the input.
   Edits are surgical text patches: comments, `#include`, `#if/#endif`, whitespace and column
   alignment outside the edited span must survive. This is Gate 1; nothing ships before it passes
   against `fixtures/adv360/`.
2. **Never flash hardware.** The app may commit, push and trigger GitHub Actions builds, and link
   to firmware artifacts. Flashing is always a separate, human, explicitly approved step.
3. **Preserve unknowns.** Anything the parser does not understand is kept verbatim and shown as
   read-only "raw" content — never dropped or rewritten.
4. **Show the diff before every save/commit.** Undo history and a backup branch per commit.
5. **Single user.** Only GitHub user `ali-aljufairi` may sign in.

## Stack

- TanStack Start (React, TypeScript, Vite). No Create React App.
- pnpm. Vitest for tests. Tailwind CSS.
- Deployed on Vercel (preview deploys per branch). A Docker image may come later; not needed now.
- Auth + repo access: a private GitHub App installed only on `Adv360-Pro-ZMK`, with GitHub login
  restricted to `ali-aljufairi`. All GitHub calls happen server-side (TanStack server functions).

## Decisions log

- 2026-11-05 — **No Effect.** Evaluated Effect 4.1.2 vs plain TS (Octokit + retry/throttling
  plugins + Zod). Effect doubled the server bundle (64 KB vs 32 KB gzip), has no first-party
  TanStack Start adapter, and its ecosystem is mid v3→v4 migration. Use plain TypeScript. GitHub
  access goes through a small `GitHubGateway` interface with a fake for tests.
- 2026-11-05 — **UI direction: Board-first** concept, with a user-selectable theme system
  (many presets, inspired by Ghostty and OpenCode).

## The config (see `fixtures/adv360/`)

- `adv360.keymap` — shared keymap: 4 layers × 76 keys (`default_layer`, `keypad`, `mod`, `macro`),
  a `behaviors` node that `#include "macros.dtsi"` *inside it*, a hold-tap `&tpf`, inline macros,
  a `combos` node containing a `#if defined(CONFIG_ZMK_STUDIO)` block.
- `adv360_left.keymap` / `adv360_right.keymap` — include the shared keymap.
- `macros.dtsi` — custom macros (`zmk,behavior-macro`).
- `info.json` — physical layout (x/y/w/h/r per key) — use it to draw the board.
- `build.yml` — the existing GitHub Actions workflow (artifacts `firmware-clique`, `firmware-no-clique`).
- Layer 2 (`mod`: Bluetooth, bootloader) currently has **no key that activates it** — the
  validator must flag this.

## MVP features (all required)

1. View + edit keys/layers on the real Advantage360 layout; binding picker for ZMK behaviors
   (`&kp`, `&mo`, `&tog`, `&lt`, `&mt`, `&trans`, `&none`, `&bt`, `&rgb_ug`, custom behaviors).
2. Macros & hold-tap editing (visual editors for `zmk,behavior-macro` and `zmk,behavior-hold-tap`).
3. Combos editing + layer checks (unreachable layers, layers with no way back, combo position conflicts).
4. Commit + build: commit to a branch, push, trigger the workflow, show status, link artifacts.
   Never auto-flash.

## Coexistence with ZMK Studio

Studio is being kept in parallel. The `.keymap` file in git is the source of truth; Studio runtime
edits live on the keyboard and can override it. The UI should mention this where relevant.
