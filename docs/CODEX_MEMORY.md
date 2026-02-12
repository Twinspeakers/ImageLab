

# CODEX_MEMORY

Purpose: stable reference for ongoing work in ImageLab.

This file is intentionally short and durable. Update only when core direction changes.

## Product Intent
- Image editor + lightweight DAW feel.
- Fast local-first UX.
- Photoshop-like interaction expectations where practical.
- Illustrator-like interaction expectations where practical.

## Core UX Decisions (Current)
- Start screen is an overlay on top of editor, not a separate page.
- Right column supports grouped + split-by-drag behavior without mode-switch dependency for everyday use.
- Grouped tabs should not reorder when clicked.
- Layer and panel drop indicators should be subtle and full-width edge-aligned.
- Selection tool uses marquee ("marching ants") behavior.
- Moving marquee with Move tool moves selection bounds only (not content) unless a tool/action explicitly edits content.
- Crop should be undoable and behave as a regular history action.
- Left tool rail includes foreground/background color swatches (default black/white) with picker modal on click.
- Foreground/background swatches now drive outputs:
  - New text layer fill uses foreground color.
  - New shape layer uses foreground fill + background stroke.
  - Layer menu includes background actions to set background from foreground/background swatches.
  - Shortcuts: `Alt+Backspace` applies foreground fill to selected fill-capable layer; `Ctrl+Backspace` applies background fill.
- Project tabs can be dragged into workspace to detach as floating project windows over the dotted workspace, with Dock action to return to tabs.

## Engineering Guardrails
- Prefer incremental, reversible edits.
- Keep feature behavior stable while refactoring structure.
- Preserve persistence invariants in Zustand + IndexedDB.
- Avoid adding dependencies unless absolutely necessary.
- Build must pass after every meaningful change.
- Keep `EditorPage` orchestration-focused; do not let it become a monolith again.

## Architecture Rule (Tools/Features)
- New UI surface: create/update a focused component in `src/features/editor/components` or `src/features/editor/panels`.
- New stateful behavior or interaction workflow: create/update a hook in `src/features/editor/hooks`.
- Pure helpers/math/transforms: place in `src/features/editor/utils`.
- Menu/command mapping: keep in `src/features/editor/menu` or dedicated action hooks.
- Keep page-level files (`src/features/editor/EditorPage.tsx`) for composition and wiring only.
- If adding a new tool, prefer adding at least one dedicated hook/module rather than expanding page logic inline.

## Refactor Priority (When Time Allows)
- Split `src/routes/EditorScreen.tsx` into:
  - interaction hook(s)
  - dock/panel layout component(s)
  - panel subcomponents (Layers/Properties/etc.)
  - menu/command mapping module

## Collaboration Style
- Default to direct implementation over long planning.
- Keep visual polish subtle and intentional.
- If uncertain, bias toward predictable desktop-editor conventions.
