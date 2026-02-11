# imagelab

Local-first desktop-style browser editor built with Vite + React + TypeScript.

## Stack
- Vite + React + TypeScript
- Tailwind CSS
- Zustand
- IndexedDB (`idb`)
- `localStorage` for workspace preferences

## Routes
- `/`: Start screen (New Project, Open `.ilp`, Recent Projects)
- `/editor`: Main editor shell

## MVP Features
- Menu bar: File/Edit/View/Layer/Window/Workspace/Help
- Multi-project tabs (raster + vector can coexist)
- Shared toolbar that follows active project type
- Right dock panels:
  - Layers
  - Properties
  - Assets
  - Swatches
  - History
- Dock panel tab reordering, hide/show, pop-out floating panels, re-dock
- Workspace actions: reset layout, dock all, bring floating panels to front
- Pan/zoom UX:
  - wheel pan
  - Ctrl/Cmd + wheel zoom-to-cursor
  - spacebar momentary hand tool
- Undo/Redo command history + History panel list
- Asset import and drag/drop into projects
- Vector MVP:
  - rect/ellipse/text
  - pen path creation with bezier handles
  - reference raster layers (locked, not exported)
  - true SVG export
- Raster MVP:
  - image/text layers
  - transform by move and properties
  - PNG/JPG/WebP/AVIF export (AVIF disabled when unsupported)
- `.ilp` import/export:
  - single JSON file with embedded asset data URLs

## Install / Run / Build
```bash
npm install
npm run dev
npm run build
npm run preview
```

## Persistence
- IndexedDB database: `imagelab-db`
- Stores:
  - `projects`
  - `assets`
  - `recents`
- Workspace preferences key:
  - `localStorage["imagelab-workspace-prefs"]`

Project changes autosave with debounced writes.

## GitHub Pages
1. Set Vite base path in `vite.config.ts` for your repo name, e.g.:
   - `base: '/imagelab/'`
2. Build with `npm run build`.
3. Deploy `dist/` to GitHub Pages.
4. For root custom domains, use `base: '/'`.

## Next Steps (Phase 2)
1. Brush/eraser pipeline for raster painting.
2. Crop tool and non-destructive crop state.
3. Snap-to-grid and guide/snapping system.
4. Boolean vector operations.
5. More complete SVG parser/import fidelity.
