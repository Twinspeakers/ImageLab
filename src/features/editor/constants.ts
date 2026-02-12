import type { PanelId, Project, ToolId } from '../../types'

export const PANEL_TITLES: Record<PanelId, string> = {
  layers: 'Layers',
  properties: 'Properties',
  assets: 'Assets',
  swatches: 'Swatches',
  history: 'History',
}

export const ALL_PANELS: PanelId[] = ['layers', 'properties', 'assets', 'swatches', 'history']

export const DEFAULT_DOCK_PANEL_HEIGHTS: Record<PanelId, number> = {
  layers: 220,
  properties: 220,
  assets: 220,
  swatches: 180,
  history: 180,
}

export const DEFAULT_MENU_ORDER = ['File', 'Edit', 'Select', 'View', 'Layer', 'Window', 'Workspace', 'Help']

export const toolList = (type: Project['type']): ToolId[] =>
  type === 'vector' ? ['move', 'select', 'text', 'shape', 'pen', 'zoom'] : ['move', 'select', 'text', 'shape', 'zoom']
