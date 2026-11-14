---
version: alpha
name: adv360-editor
description: Board-first ZMK workbench with flat, square controls and theme-derived colors.
typography:
  sans:
    fontFamily: system-ui, sans-serif
  mono:
    fontFamily: ui-monospace, monospace
rounded:
  DEFAULT: 0px
omitted:
  - section: colors
    reason: Runtime themes own all palette values; see src/lib/theme/tokens.ts and src/styles.css.
  - section: spacing
    reason: Existing Tailwind spacing utilities own layout geometry.
  - section: components
    reason: Shared component contracts are recorded below with runtime owners.
---

# adv360-editor Design System

## Overview

The physical Advantage360 keyboard is the main working surface. This is an English-language, single-user developer tool for editing ZMK config; no Japan-specific business or locale behavior is established. Preserve the board-first layout and the existing selectable light/dark theme system. Product behavior comes from docs/PRODUCT.md and the current user request.

Runtime colors remain canonical in src/lib/theme/tokens.ts and its theme engine; src/styles.css maps semantic variables to Tailwind utilities. This document introduces no palette overrides. The sync work extends the existing EditorPage and SyncHeader language.

## Colors

Use canvas/raised surfaces, border-subtle, primary/secondary/muted text, accent-primary actions, and status/diff variables. Never hard-code a palette for a workflow. The global themed scrollbar baseline in src/styles.css applies to all overflow regions.

## Typography

Use the existing system sans for controls, restrained medium weight for primary actions, and monospace for refs, SHAs, and diffs. Keep full commit messages readable with wrapping.

## Layout

Keep the board scrollable within the viewport. Unsaved actions occupy a compact bottom row, with optional inline details above it. Build and history use the existing side panel; on narrow screens this panel stacks without blocking the board. Controls wrap within narrow widths.

## Elevation & Depth

Prefer dividers and flat surfaces. Save controls and feedback use no floating shadow or page overlay.

## Shapes

Square corners. No pill tabs, filled chips, or decorative information strips. Underlines identify navigation selection and secondary text actions.

## Components

Canonical sync action controls: src/components/github/ChangesBar.tsx. One-click Commit & push uses an automatic message; optional Details exposes the message and diff through ChangesDetails.tsx. Discard is reversible through the editor's existing Undo history.

Canonical sync feedback: SyncFeedback in ChangesBar.tsx. Keep its polite status region mounted, announce completed actions without stealing focus, and leave Undo available until another push. Move focus to the editor after the save/discard row disappears. Guard duplicate pushes, freeze editing during a push, and disable history restore while local changes exist.

Canonical history: BuildPanel.tsx, with chronological commit entries, SHA/author/time, and Revert to this. Restores create a new commit scoped to config files; never force-push. Errors stay near their operation; build permission failures do not invalidate a successful push.

Canonical permission recovery: SyncHeader.tsx plus server/repo/access.ts. Link to the exact App installation when available; otherwise the configured App install page or repo integrations settings. Name missing repository selection or permissions; retry rechecks capabilities. GitHub remains the authorization authority.

Buttons use visible focus, hover text, disabled text, and stable busy widths. Native disclosure/button/input semantics provide keyboard behavior. Respect the global reduced-motion baseline. Shared modal primitives remain for unrelated editing dialogs; saving itself uses no modal.

## Do's and Don'ts

- Keep the keyboard visible and make saving optional to inspect.
- Preserve the protected V3.0 branch and the current editor branch.
- Do not present build polling failures as failed commits.
- Do not introduce new theme values for sync controls.
