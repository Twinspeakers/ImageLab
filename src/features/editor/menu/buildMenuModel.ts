import { ALL_PANELS, PANEL_TITLES } from '../constants'
import type { Layer, PanelId, Project } from '../../../types'

type MenuItem = { label: string; shortcut?: string; onClick: () => void }
export type MenuModel = Record<string, MenuItem[]>

type BuildMenuModelParams = {
  modKeyLabel: string
  isMacPlatform: boolean
  project: Project | null
  selectedLayer: Layer | null
  hiddenPanels: PanelId[]
  onNewProject: () => void
  onOpenProject: () => void
  onSaveProject: () => void
  onExportIlp: () => void
  onPlaceImage: () => void
  onImportAssets: () => void
  onExport: () => void
  onCloseProjectTab: () => void
  onUndo: () => void
  onRedo: () => void
  onCut: () => void
  onCopy: () => void
  onPaste: () => void
  onDuplicateLayer: () => void
  onDeleteLayer: () => void
  onSelectAll: () => void
  onDeselect: () => void
  onZoomIn: () => void
  onZoomOut: () => void
  onFitToScreen: () => void
  onZoom100: () => void
  onCrop: () => void
  onNewTextLayer: () => void
  onNewShapeLayer: () => void
  onTogglePanelVisibility: (panelId: PanelId) => void
  onDockAllPanels: () => void
  onResetWorkspace: () => void
  onBringPanelsToFront: () => void
  onOpenShortcuts: () => void
  onAbout: () => void
}

export const buildMenuModel = ({
  modKeyLabel,
  isMacPlatform,
  project,
  selectedLayer,
  hiddenPanels,
  onNewProject,
  onOpenProject,
  onSaveProject,
  onExportIlp,
  onPlaceImage,
  onImportAssets,
  onExport,
  onCloseProjectTab,
  onUndo,
  onRedo,
  onCut,
  onCopy,
  onPaste,
  onDuplicateLayer,
  onDeleteLayer,
  onSelectAll,
  onDeselect,
  onZoomIn,
  onZoomOut,
  onFitToScreen,
  onZoom100,
  onCrop,
  onNewTextLayer,
  onNewShapeLayer,
  onTogglePanelVisibility,
  onDockAllPanels,
  onResetWorkspace,
  onBringPanelsToFront,
  onOpenShortcuts,
  onAbout,
}: BuildMenuModelParams): MenuModel => ({
  File: [
    { label: 'New Project', shortcut: `${modKeyLabel}+N`, onClick: onNewProject },
    { label: 'Open Project', shortcut: `${modKeyLabel}+O`, onClick: onOpenProject },
    { label: 'Save Project', shortcut: `${modKeyLabel}+S`, onClick: onSaveProject },
    { label: 'Export .ilp', onClick: onExportIlp },
    { label: 'Place Image', onClick: onPlaceImage },
    { label: 'Import Assets', onClick: onImportAssets },
    { label: 'Export...', shortcut: `${modKeyLabel}+E`, onClick: onExport },
    { label: 'Close Project Tab', shortcut: `${modKeyLabel}+W`, onClick: onCloseProjectTab },
  ],
  Edit: [
    { label: 'Undo', shortcut: `${modKeyLabel}+Z`, onClick: onUndo },
    { label: 'Redo', shortcut: isMacPlatform ? 'Cmd+Shift+Z' : 'Ctrl+Y', onClick: onRedo },
    { label: 'Cut', shortcut: `${modKeyLabel}+X`, onClick: onCut },
    { label: 'Copy', shortcut: `${modKeyLabel}+C`, onClick: onCopy },
    { label: 'Paste', shortcut: `${modKeyLabel}+V`, onClick: onPaste },
    { label: 'Duplicate Layer', shortcut: `${modKeyLabel}+Shift+D`, onClick: onDuplicateLayer },
    { label: 'Delete Layer', shortcut: 'Delete', onClick: onDeleteLayer },
  ],
  Select: [
    { label: 'Select All', shortcut: `${modKeyLabel}+A`, onClick: onSelectAll },
    { label: 'Deselect', shortcut: `${modKeyLabel}+D`, onClick: onDeselect },
  ],
  View: [
    { label: 'Zoom In', shortcut: `${modKeyLabel}+Plus`, onClick: onZoomIn },
    { label: 'Zoom Out', shortcut: `${modKeyLabel}+-`, onClick: onZoomOut },
    { label: 'Fit to Screen', shortcut: `${modKeyLabel}+0`, onClick: onFitToScreen },
    { label: '100%', shortcut: `${modKeyLabel}+1`, onClick: onZoom100 },
    { label: 'Crop', shortcut: `${modKeyLabel}+Shift+X`, onClick: onCrop },
  ],
  Layer: [
    { label: 'New Text Layer', onClick: onNewTextLayer },
    { label: 'New Shape Layer', onClick: onNewShapeLayer },
  ],
  Window: [
    ...ALL_PANELS.map((panelId) => ({ label: `${hiddenPanels.includes(panelId) ? '' : '✓ '} ${PANEL_TITLES[panelId]}`, onClick: () => onTogglePanelVisibility(panelId) })),
    { label: 'Dock All Panels', onClick: onDockAllPanels },
    { label: 'Reset Panel Layout', onClick: onResetWorkspace },
    { label: 'Bring All Panels to Front', onClick: onBringPanelsToFront },
  ],
  Workspace: [
    { label: 'Reset Layout', onClick: onResetWorkspace },
    { label: 'Dock All Panels', onClick: onDockAllPanels },
  ],
  Help: [
    { label: 'Keyboard Shortcuts', shortcut: 'Shift+/', onClick: onOpenShortcuts },
    { label: 'About', onClick: onAbout },
  ],
})
