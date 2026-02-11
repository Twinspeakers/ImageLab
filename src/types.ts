export type ProjectType = 'raster' | 'vector'

export type ToolId = 'move' | 'select' | 'hand' | 'zoom' | 'text' | 'shape' | 'pen' | 'crop'

export type PanelId = 'layers' | 'properties' | 'assets' | 'swatches' | 'history'

export type BackgroundMode = 'transparent' | 'white' | 'black' | 'custom'

export interface DocumentSpec {
  width: number
  height: number
  backgroundMode: BackgroundMode
  backgroundColor: string
}

export interface Vec2 {
  x: number
  y: number
}

export interface LayerBase {
  id: string
  name: string
  protected?: boolean
  visible: boolean
  locked: boolean
  opacity: number
  x: number
  y: number
  rotation: number
  scaleX: number
  scaleY: number
}

export interface RasterImageLayer extends LayerBase {
  kind: 'raster-image'
  assetId: string
  width: number
  height: number
}

export interface RasterTextLayer extends LayerBase {
  kind: 'raster-text'
  text: string
  fontSize: number
  fill: string
}

export interface VectorRectLayer extends LayerBase {
  kind: 'vector-rect'
  width: number
  height: number
  fill: string
  stroke: string
  strokeWidth: number
  segments?: Array<{
    x: number
    y: number
    width: number
    height: number
  }>
}

export interface VectorEllipseLayer extends LayerBase {
  kind: 'vector-ellipse'
  radiusX: number
  radiusY: number
  fill: string
  stroke: string
  strokeWidth: number
}

export interface VectorTextLayer extends LayerBase {
  kind: 'vector-text'
  text: string
  fontSize: number
  fill: string
}

export interface PathPoint {
  id: string
  anchor: Vec2
  inHandle: Vec2
  outHandle: Vec2
  smooth: boolean
}

export interface VectorPathLayer extends LayerBase {
  kind: 'vector-path'
  points: PathPoint[]
  closed: boolean
  fill: string
  stroke: string
  strokeWidth: number
}

export interface VectorReferenceLayer extends LayerBase {
  kind: 'vector-reference'
  assetId: string
  width: number
  height: number
}

export type Layer =
  | RasterImageLayer
  | RasterTextLayer
  | VectorRectLayer
  | VectorEllipseLayer
  | VectorTextLayer
  | VectorPathLayer
  | VectorReferenceLayer

export interface Project {
  id: string
  name: string
  type: ProjectType
  createdAt: string
  updatedAt: string
  document: DocumentSpec
  layers: Layer[]
  selectedLayerId: string | null
  activeTool: ToolId
  view: {
    panX: number
    panY: number
    zoom: number
  }
}

export type AssetKind = 'raster' | 'svg'

export interface AssetRecord {
  id: string
  name: string
  kind: AssetKind
  mimeType: string
  createdAt: string
  updatedAt: string
  tags: string[]
  favorite: boolean
  width?: number
  height?: number
}

export interface AssetBlobRecord extends AssetRecord {
  blob?: Blob
  svgText?: string
}

export interface Swatch {
  id: string
  name: string
  type: 'solid' | 'linear-gradient' | 'radial-gradient'
  value: string
}

export interface FloatingPanel {
  id: string
  panelId: PanelId
  x: number
  y: number
  width: number
  height: number
  z: number
}

export interface WorkspacePrefs {
  panelOrder: PanelId[]
  hiddenPanels: PanelId[]
  activePanel: PanelId
  floatingPanels: FloatingPanel[]
  swatches: Swatch[]
  rasterizeScale: 1 | 2 | 4
}

export interface HistoryState {
  past: Project[]
  future: Project[]
  labels: string[]
}

export interface RecentProject {
  id: string
  name: string
  updatedAt: string
  type: ProjectType
}
