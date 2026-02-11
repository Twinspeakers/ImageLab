# CODEX_MEMORY

Purpose: stable reference for ongoing work in ImageLab.

This file is intentionally short and durable. Update only when core direction changes.

## Product Intent
- Image editor + lightweight DAW feel.
- Fast local-first UX.
- Photoshop-like interaction expectations where practical.

## Core UX Decisions (Current)
- Start screen is an overlay on top of editor, not a separate page.
- Right column supports grouped + split-by-drag behavior without mode-switch dependency for everyday use.
- Grouped tabs should not reorder when clicked.
- Layer and panel drop indicators should be subtle and full-width edge-aligned.
- Selection tool uses marquee ("marching ants") behavior.
- Moving marquee with Move tool moves selection bounds only (not content) unless a tool/action explicitly edits content.
- Crop should be undoable and behave as a regular history action.

## Engineering Guardrails
- Prefer incremental, reversible edits.
- Keep feature behavior stable while refactoring structure.
- Preserve persistence invariants in Zustand + IndexedDB.
- Avoid adding dependencies unless absolutely necessary.
- Build must pass after every meaningful change.

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

