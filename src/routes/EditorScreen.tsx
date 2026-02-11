import { DragEvent, MouseEvent as ReactMouseEvent, PointerEvent as ReactPointerEvent, WheelEvent, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { exportVectorSvg, renderRasterBlob } from '../lib/export'
import { clamp, isMac, loadImage, modKey, toDataUrl, uid } from '../lib/utils'
import { useAppStore } from '../store/useAppStore'
import { StartOverlay } from '../components/StartOverlay'
import appLogo from '../assets/app-logo.svg'
import type { AssetBlobRecord, Layer, PanelId, PathPoint, Project, ToolId, WorkspacePrefs } from '../types'

const PANEL_TITLES: Record<PanelId, string> = {
  layers: 'Layers',
  properties: 'Properties',
  assets: 'Assets',
  swatches: 'Swatches',
  history: 'History',
}

const ALL_PANELS: PanelId[] = ['layers', 'properties', 'assets', 'swatches', 'history']
const DEFAULT_DOCK_PANEL_HEIGHTS: Record<PanelId, number> = {
  layers: 220,
  properties: 220,
  assets: 220,
  swatches: 180,
  history: 180,
}

const normalizeDockGroups = (panelOrder: PanelId[], hiddenPanels: PanelId[], groups?: PanelId[][]) => {
  const hidden = new Set(hiddenPanels)
  const visibleOrdered = panelOrder.filter((panelId) => !hidden.has(panelId))
  const used = new Set<PanelId>()
  const nextGroups: PanelId[][] = []

  for (const group of groups ?? []) {
    const normalized = group.filter((panelId) => !hidden.has(panelId) && !used.has(panelId))
    if (normalized.length === 0) continue
    normalized.forEach((panelId) => used.add(panelId))
    nextGroups.push(normalized)
  }

  for (const panelId of visibleOrdered) {
    if (used.has(panelId)) continue
    nextGroups.push([panelId])
  }
  return nextGroups
}

const toolList = (type: Project['type']): ToolId[] =>
  type === 'vector' ? ['move', 'select', 'text', 'shape', 'pen', 'zoom'] : ['move', 'select', 'text', 'shape', 'zoom']

const isTextLayer = (layer: Layer): layer is Extract<Layer, { kind: 'vector-text' | 'raster-text' }> =>
  layer.kind === 'vector-text' || layer.kind === 'raster-text'

const toolIcon = (tool: ToolId) => {
  const base = 'h-5 w-5'
  if (tool === 'move') {
    return (
      <svg viewBox="0 0 24 24" className={base} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="m5 3 13 8-6 1 2 7-3 1-2-7-4 4Z" />
      </svg>
    )
  }
  if (tool === 'select') {
    return (
      <svg viewBox="0 0 24 24" className={base} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M4 4h6" />
        <path d="M4 4v6" />
        <path d="M20 4h-6" />
        <path d="M20 4v6" />
        <path d="M4 20h6" />
        <path d="M4 20v-6" />
        <path d="M20 20h-6" />
        <path d="M20 20v-6" />
      </svg>
    )
  }
  if (tool === 'hand') {
    return (
      <svg viewBox="0 0 24 24" className={base} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M7 11V7a1 1 0 1 1 2 0v4" />
        <path d="M10 11V6a1 1 0 1 1 2 0v5" />
        <path d="M13 11V7a1 1 0 1 1 2 0v4" />
        <path d="M16 11V9a1 1 0 1 1 2 0v6a5 5 0 0 1-5 5h-1a6 6 0 0 1-6-6v-3a1 1 0 1 1 2 0" />
      </svg>
    )
  }
  if (tool === 'zoom') {
    return (
      <svg viewBox="0 0 24 24" className={base} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <circle cx="11" cy="11" r="6" />
        <path d="m20 20-4-4" />
      </svg>
    )
  }
  if (tool === 'text') {
    return (
      <svg viewBox="0 0 24 24" className={base} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M5 6h14" />
        <path d="M12 6v12" />
        <path d="M9 18h6" />
      </svg>
    )
  }
  if (tool === 'shape') {
    return (
      <svg viewBox="0 0 24 24" className={base} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <rect x="4" y="5" width="7" height="7" rx="1" />
        <circle cx="16.5" cy="15.5" r="3.5" />
      </svg>
    )
  }
  if (tool === 'pen') {
    return (
      <svg viewBox="0 0 24 24" className={base} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="m3 21 3-1 11-11-2-2L4 18l-1 3Z" />
        <path d="m13 5 2 2" />
      </svg>
    )
  }
  return (
    <svg viewBox="0 0 24 24" className={base} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 6h16" />
      <path d="M4 18h16" />
      <path d="M8 6v12" />
      <path d="M16 6v12" />
    </svg>
  )
}

const documentBackdropStyle = (): CSSProperties => ({
  backgroundColor: '#ffffff',
  backgroundImage: `
    linear-gradient(45deg, #e2e8f0 25%, transparent 25%),
    linear-gradient(-45deg, #e2e8f0 25%, transparent 25%),
    linear-gradient(45deg, transparent 75%, #e2e8f0 75%),
    linear-gradient(-45deg, transparent 75%, #e2e8f0 75%)
  `,
  backgroundSize: '20px 20px',
  backgroundPosition: '0 0, 0 10px, 10px -10px, -10px 0px',
})

const downloadBlob = (blob: Blob, fileName: string) => {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = fileName
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 3000)
}

const defaultMenuOrder = ['File', 'Edit', 'Select', 'View', 'Layer', 'Window', 'Workspace', 'Help']

const docPoint = (event: ReactPointerEvent | DragEvent | WheelEvent, stage: HTMLDivElement, project: Project) => {
  const rect = stage.getBoundingClientRect()
  return {
    x: (event.clientX - rect.left - project.view.panX) / project.view.zoom,
    y: (event.clientY - rect.top - project.view.panY) / project.view.zoom,
  }
}

const rectFromPoints = (a: { x: number; y: number }, b: { x: number; y: number }) => {
  const left = Math.min(a.x, b.x)
  const top = Math.min(a.y, b.y)
  const right = Math.max(a.x, b.x)
  const bottom = Math.max(a.y, b.y)
  return { left, top, right, bottom, width: right - left, height: bottom - top }
}

const getLayerLocalBounds = (layer: Layer): { left: number; top: number; right: number; bottom: number } | null => {
  if ('width' in layer && 'height' in layer) {
    return { left: 0, top: 0, right: layer.width, bottom: layer.height }
  }
  if (isTextLayer(layer)) {
    const fontSize = Math.max(8, layer.fontSize || 16)
    const text = layer.text ?? ''
    const width = Math.max(fontSize * 0.8, text.length * fontSize * 0.58)
    const height = Math.max(18, fontSize * 1.35)
    return { left: 0, top: 0, right: width, bottom: height }
  }
  if (layer.kind === 'vector-path' && layer.points.length > 0) {
    const xs = layer.points.map((p) => p.anchor.x)
    const ys = layer.points.map((p) => p.anchor.y)
    return {
      left: Math.min(...xs),
      top: Math.min(...ys),
      right: Math.max(...xs),
      bottom: Math.max(...ys),
    }
  }
  return null
}

const subtractRect = (
  base: { left: number; top: number; right: number; bottom: number },
  cut: { left: number; top: number; right: number; bottom: number },
) => {
  const overlapLeft = Math.max(base.left, cut.left)
  const overlapTop = Math.max(base.top, cut.top)
  const overlapRight = Math.min(base.right, cut.right)
  const overlapBottom = Math.min(base.bottom, cut.bottom)
  if (overlapLeft >= overlapRight || overlapTop >= overlapBottom) return [base]

  const next: Array<{ left: number; top: number; right: number; bottom: number }> = []
  if (overlapTop > base.top) next.push({ left: base.left, top: base.top, right: base.right, bottom: overlapTop })
  if (overlapBottom < base.bottom) next.push({ left: base.left, top: overlapBottom, right: base.right, bottom: base.bottom })
  if (overlapLeft > base.left) next.push({ left: base.left, top: overlapTop, right: overlapLeft, bottom: overlapBottom })
  if (overlapRight < base.right) next.push({ left: overlapRight, top: overlapTop, right: base.right, bottom: overlapBottom })
  return next.filter((rect) => rect.right - rect.left > 0 && rect.bottom - rect.top > 0)
}

const intersectRect = (
  a: { left: number; top: number; right: number; bottom: number },
  b: { left: number; top: number; right: number; bottom: number },
) => {
  const left = Math.max(a.left, b.left)
  const top = Math.max(a.top, b.top)
  const right = Math.min(a.right, b.right)
  const bottom = Math.min(a.bottom, b.bottom)
  if (left >= right || top >= bottom) return null
  return { left, top, right, bottom }
}

const clampRectToBounds = (
  rect: { left: number; top: number; right: number; bottom: number },
  bounds: { left: number; top: number; right: number; bottom: number },
) => intersectRect(rect, bounds)

const addLayerFromAsset = async (
  project: Project,
  asset: AssetBlobRecord,
  point: { x: number; y: number },
  rasterizeScale: number,
  updateProject: (projectId: string, recipe: (project: Project) => void, label?: string) => void,
) => {
  if (project.type === 'raster') {
    if (asset.kind === 'raster' && asset.blob) {
      const img = await loadImage(await toDataUrl(asset.blob))
      updateProject(project.id, (current) => {
        current.layers.unshift({
          id: uid('layer'),
          kind: 'raster-image',
          name: asset.name,
          visible: true,
          locked: false,
          opacity: 1,
          x: point.x,
          y: point.y,
          rotation: 0,
          scaleX: 1,
          scaleY: 1,
          assetId: asset.id,
          width: img.naturalWidth,
          height: img.naturalHeight,
        })
      }, 'Drop raster asset')
    }
    if (asset.kind === 'svg' && asset.svgText) {
      const img = await loadImage(await toDataUrl(new Blob([asset.svgText], { type: 'image/svg+xml' })))
      updateProject(project.id, (current) => {
        current.layers.unshift({
          id: uid('layer'),
          kind: 'raster-image',
          name: `${asset.name} (${rasterizeScale}x)`,
          visible: true,
          locked: false,
          opacity: 1,
          x: point.x,
          y: point.y,
          rotation: 0,
          scaleX: 1,
          scaleY: 1,
          assetId: asset.id,
          width: img.naturalWidth * rasterizeScale,
          height: img.naturalHeight * rasterizeScale,
        })
      }, 'Drop SVG rasterized')
    }
  } else {
    if (asset.kind === 'svg' && asset.svgText) {
      updateProject(project.id, (current) => {
        current.layers.unshift({
          id: uid('layer'),
          kind: 'vector-rect',
          name: `${asset.name} Vector`,
          visible: true,
          locked: false,
          opacity: 1,
          x: point.x,
          y: point.y,
          rotation: 0,
          scaleX: 1,
          scaleY: 1,
          width: 220,
          height: 140,
          fill: '#14b8a6',
          stroke: '#0f172a',
          strokeWidth: 1,
        })
      }, 'Drop SVG into vector')
    }
    if (asset.kind === 'raster' && asset.blob) {
      const img = await loadImage(await toDataUrl(asset.blob))
      updateProject(project.id, (current) => {
        current.layers.unshift({
          id: uid('layer'),
          kind: 'vector-reference',
          name: `${asset.name} (reference)`,
          visible: true,
          locked: true,
          opacity: 0.8,
          x: point.x,
          y: point.y,
          rotation: 0,
          scaleX: 1,
          scaleY: 1,
          assetId: asset.id,
          width: img.naturalWidth,
          height: img.naturalHeight,
        })
      }, 'Drop raster reference')
    }
  }
}

export const EditorScreen = () => {
  const projects = useAppStore((s) => s.projects)
  const openProjectIds = useAppStore((s) => s.openProjectIds)
  const activeProjectId = useAppStore((s) => s.activeProjectId)
  const workspace = useAppStore((s) => s.workspace)
  const assets = useAppStore((s) => s.assets)
  const historyByProject = useAppStore((s) => s.historyByProject)
  const avifSupported = useAppStore((s) => s.avifSupported)
  const updateProject = useAppStore((s) => s.updateProject)
  const undo = useAppStore((s) => s.undo)
  const redo = useAppStore((s) => s.redo)
  const jumpToHistory = useAppStore((s) => s.jumpToHistory)
  const closeProjectTab = useAppStore((s) => s.closeProjectTab)
  const setActiveProject = useAppStore((s) => s.setActiveProject)
  const setWorkspace = useAppStore((s) => s.setWorkspace)
  const togglePanelVisibility = useAppStore((s) => s.togglePanelVisibility)
  const popoutPanel = useAppStore((s) => s.popoutPanel)
  const redockPanel = useAppStore((s) => s.redockPanel)
  const moveFloatingPanel = useAppStore((s) => s.moveFloatingPanel)
  const dockAllPanels = useAppStore((s) => s.dockAllPanels)
  const bringPanelsToFront = useAppStore((s) => s.bringPanelsToFront)
  const resetWorkspace = useAppStore((s) => s.resetWorkspace)
  const addAssetFromFile = useAppStore((s) => s.addAssetFromFile)
  const exportIlp = useAppStore((s) => s.exportIlp)
  const importIlp = useAppStore((s) => s.importIlp)
  const setShortcutsOpen = useAppStore((s) => s.setShortcutsOpen)
  const shortcutsOpen = useAppStore((s) => s.shortcutsOpen)
  const showStartOverlay = useAppStore((s) => s.showStartOverlay)
  const setShowStartOverlay = useAppStore((s) => s.setShowStartOverlay)

  const project = activeProjectId ? projects[activeProjectId] : null
  const hasOpenProjects = openProjectIds.length > 0
  const overlayVisible = !hasOpenProjects || showStartOverlay
  const history = project ? historyByProject[project.id] : undefined
  const selectedLayer = project?.layers.find((l) => l.id === project.selectedLayerId) ?? null
  const tools = project ? toolList(project.type) : []
  const visiblePanels = workspace.panelOrder.filter((panelId) => !workspace.hiddenPanels.includes(panelId))
  const dockGroups = useMemo(
    () => normalizeDockGroups(workspace.panelOrder, workspace.hiddenPanels, workspace.dockPanelGroups),
    [workspace.panelOrder, workspace.hiddenPanels, workspace.dockPanelGroups],
  )

  const [openMenu, setOpenMenu] = useState<string | null>(null)
  const menuBarRef = useRef<HTMLDivElement | null>(null)
  const [cursor, setCursor] = useState<{ x: number; y: number } | null>(null)
  const [moveLayer, setMoveLayer] = useState<{ id: string; pointerId: number; x: number; y: number; lx: number; ly: number } | null>(null)
  const [zoomScrub, setZoomScrub] = useState<{
    pointerId: number
    startY: number
    startZoom: number
    anchorScreenX: number
    anchorScreenY: number
    anchorDocX: number
    anchorDocY: number
  } | null>(null)
  const [panDrag, setPanDrag] = useState<{ pointerId: number; x: number; y: number; px: number; py: number } | null>(null)
  const [isSpace, setIsSpace] = useState(false)
  const [preSpaceTool, setPreSpaceTool] = useState<ToolId | null>(null)
  const [penDraft, setPenDraft] = useState<PathPoint[]>([])
  const [clipboard, setClipboard] = useState<Layer[] | null>(null)
  const [layerMenu, setLayerMenu] = useState<{ layerId: string; x: number; y: number } | null>(null)
  const layerMenuRef = useRef<HTMLDivElement | null>(null)
  const [textEntry, setTextEntry] = useState<{ layerId: string; value: string } | null>(null)
  const textEntryInputRef = useRef<HTMLDivElement | null>(null)
  const [layerDragState, setLayerDragState] = useState<{ activeId: string; targetId: string | null; position: 'before' | 'after' } | null>(null)
  const [marquee, setMarquee] = useState<{ pointerId: number; start: { x: number; y: number }; current: { x: number; y: number } } | null>(null)
  const [boxSelectedLayerIds, setBoxSelectedLayerIds] = useState<string[]>([])
  const [areaSelection, setAreaSelection] = useState<{ layerId: string; x: number; y: number; width: number; height: number } | null>(null)
  const [canvasSelection, setCanvasSelection] = useState<{ left: number; top: number; right: number; bottom: number } | null>(null)
  const [canvasSelectionMove, setCanvasSelectionMove] = useState<{
    pointerId: number
    startX: number
    startY: number
    origin: { left: number; top: number; right: number; bottom: number }
  } | null>(null)
  const [areaMove, setAreaMove] = useState<{ pointerId: number; startX: number; startY: number; dx: number; dy: number } | null>(null)
  const [layerRename, setLayerRename] = useState<{ layerId: string; value: string } | null>(null)
  const dockResizeRef = useRef<{ panelId: PanelId; pointerId: number; startY: number; startHeight: number } | null>(null)
  const [dockDropTarget, setDockDropTarget] = useState<{ targetLead: PanelId; mode: 'before' | 'merge' | 'after' } | null>(null)
  const [draggingPanelId, setDraggingPanelId] = useState<PanelId | null>(null)

  const assetMap = useMemo(() => new Map(Object.values(assets).map((asset) => [asset.id, asset])), [assets])
  const getDockPanelHeight = (panelId: PanelId) =>
    clamp(workspace.dockPanelHeights?.[panelId] ?? DEFAULT_DOCK_PANEL_HEIGHTS[panelId], 120, 560)

  const commitDockGroups = (nextGroups: PanelId[][]) => {
    setWorkspace((current) => {
      current.dockPanelGroups = nextGroups
      const flatVisible = nextGroups.flat()
      const hidden = current.panelOrder.filter((panelId) => current.hiddenPanels.includes(panelId))
      current.panelOrder = [...flatVisible, ...hidden.filter((panelId) => !flatVisible.includes(panelId))]
      if (!flatVisible.includes(current.activePanel)) {
        current.activePanel = flatVisible[0] ?? current.activePanel
      }
    })
  }

  const placePanelInGroup = (panelId: PanelId, targetLead: PanelId, mode: 'before' | 'merge' | 'after') => {
    const stripped = dockGroups
      .map((group) => group.filter((id) => id !== panelId))
      .filter((group) => group.length > 0)

    const targetIndex = stripped.findIndex((group) => group[0] === targetLead)
    if (targetIndex < 0) {
      commitDockGroups([...stripped, [panelId]])
      return
    }

    if (mode === 'merge') {
      const merged = stripped.map((group, index) =>
        index === targetIndex
          ? group.includes(panelId) ? group : [...group, panelId]
          : group,
      )
      commitDockGroups(merged)
      return
    }

    const insertAt = mode === 'before' ? targetIndex : targetIndex + 1
    const next = stripped.slice()
    next.splice(insertAt, 0, [panelId])
    commitDockGroups(next)
  }

  const resolveDockDropMode = (event: DragEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect()
    const ratio = (event.clientY - rect.top) / Math.max(1, rect.height)
    return ratio < 0.25 ? 'before' : ratio > 0.75 ? 'after' : 'merge'
  }

  const focusPanelInGroup = (panelId: PanelId) => {
    setWorkspace((current) => { current.activePanel = panelId })
  }

  const reorderPanelTabs = (dragPanelId: PanelId, targetPanelId: PanelId) => {
    if (dragPanelId === targetPanelId) return
    setWorkspace((current) => {
      const groups = normalizeDockGroups(current.panelOrder, current.hiddenPanels, current.dockPanelGroups)
      const stripped = groups
        .map((group) => group.filter((panelId) => panelId !== dragPanelId))
        .filter((group) => group.length > 0)
      const targetGroupIndex = stripped.findIndex((group) => group.includes(targetPanelId))
      if (targetGroupIndex < 0) return
      const targetGroup = stripped[targetGroupIndex].slice()
      const insertAt = Math.max(0, targetGroup.indexOf(targetPanelId))
      targetGroup.splice(insertAt, 0, dragPanelId)
      stripped[targetGroupIndex] = targetGroup
      current.dockPanelGroups = stripped
      const flatVisible = stripped.flat()
      const hidden = current.panelOrder.filter((panelId) => current.hiddenPanels.includes(panelId))
      current.panelOrder = [...flatVisible, ...hidden.filter((panelId) => !flatVisible.includes(panelId))]
      current.activePanel = dragPanelId
    })
  }

  const startDockResize = (panelId: PanelId, event: ReactPointerEvent<HTMLDivElement>) => {
    event.preventDefault()
    event.stopPropagation()
    dockResizeRef.current = {
      panelId,
      pointerId: event.pointerId,
      startY: event.clientY,
      startHeight: getDockPanelHeight(panelId),
    }
  }

  useEffect(() => {
    if (!openMenu) return

    const onPointerDown = (event: MouseEvent | TouchEvent) => {
      const root = menuBarRef.current
      if (!root) return
      const target = event.target as Node | null
      if (target && root.contains(target)) return
      setOpenMenu(null)
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpenMenu(null)
    }

    // Capture phase so we close even if an inner component stops propagation.
    document.addEventListener('mousedown', onPointerDown, true)
    document.addEventListener('touchstart', onPointerDown, true)
    document.addEventListener('keydown', onKeyDown, true)

    return () => {
      document.removeEventListener('mousedown', onPointerDown, true)
      document.removeEventListener('touchstart', onPointerDown, true)
      document.removeEventListener('keydown', onKeyDown, true)
    }
  }, [openMenu])

  useEffect(() => {
    if (!layerMenu) return

    const onMouseDown = (event: MouseEvent) => {
      const menu = layerMenuRef.current
      if (!menu) {
        setLayerMenu(null)
        return
      }
      const target = event.target as Node | null
      if (target && menu.contains(target)) return
      setLayerMenu(null)
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setLayerMenu(null)
    }

    window.addEventListener('mousedown', onMouseDown, true)
    window.addEventListener('keydown', onKeyDown, true)
    return () => {
      window.removeEventListener('mousedown', onMouseDown, true)
      window.removeEventListener('keydown', onKeyDown, true)
    }
  }, [layerMenu])

  useEffect(() => {
    const preventPageZoom = (event: globalThis.WheelEvent) => {
      if (!event.ctrlKey && !event.metaKey) return
      event.preventDefault()
    }
    window.addEventListener('wheel', preventPageZoom, { passive: false })
    return () => {
      window.removeEventListener('wheel', preventPageZoom)
    }
  }, [])

  useEffect(() => {
    if (!textEntry) return
    const input = textEntryInputRef.current
    if (!input) return
    // Ensure focus lands after mount/pointer event so caret is visible immediately.
    window.setTimeout(() => {
      input.focus()
      const selection = window.getSelection()
      if (!selection) return
      const range = document.createRange()
      range.selectNodeContents(input)
      range.collapse(false)
      selection.removeAllRanges()
      selection.addRange(range)
    }, 0)
  }, [textEntry])

  useEffect(() => {
    if (!areaSelection) return
    const onMouseDown = (event: MouseEvent) => {
      const stage = document.getElementById('editor-stage')
      const target = event.target as Node | null
      if (stage && target && stage.contains(target)) return
      setAreaSelection(null)
      setAreaMove(null)
    }
    window.addEventListener('mousedown', onMouseDown, true)
    return () => {
      window.removeEventListener('mousedown', onMouseDown, true)
    }
  }, [areaSelection])

  useEffect(() => {
    const onPointerMove = (event: PointerEvent) => {
      const resize = dockResizeRef.current
      if (!resize || event.pointerId !== resize.pointerId) return
      const nextHeight = clamp(resize.startHeight + (event.clientY - resize.startY), 120, 560)
      setWorkspace((current) => {
        current.dockPanelHeights = {
          ...(current.dockPanelHeights ?? DEFAULT_DOCK_PANEL_HEIGHTS),
          [resize.panelId]: nextHeight,
        }
      })
    }
    const onPointerUp = (event: PointerEvent) => {
      if (dockResizeRef.current?.pointerId === event.pointerId) {
        dockResizeRef.current = null
      }
    }
    window.addEventListener('pointermove', onPointerMove)
    window.addEventListener('pointerup', onPointerUp)
    return () => {
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('pointerup', onPointerUp)
    }
  }, [setWorkspace])

  function setZoom(zoom: number) {
    if (!project) return
    updateProject(project.id, (current) => { current.view.zoom = clamp(zoom, 0.1, 16) }, 'Zoom')
  }

  function fitToScreen() {
    if (!project) return
    const stage = document.getElementById('editor-stage') as HTMLDivElement | null
    if (!stage) return
    const rect = stage.getBoundingClientRect()
    const zoom = Math.min((rect.width - 100) / project.document.width, (rect.height - 100) / project.document.height)
    updateProject(project.id, (current) => {
      current.view.zoom = clamp(zoom, 0.1, 8)
      current.view.panX = (rect.width - current.document.width * current.view.zoom) / 2
      current.view.panY = (rect.height - current.document.height * current.view.zoom) / 2
    }, 'Fit')
  }

  function deleteLayer() {
    if (!project) return
    const selectedIds = boxSelectedLayerIds.length > 0 ? boxSelectedLayerIds : selectedLayer ? [selectedLayer.id] : []
    if (selectedIds.length === 0) return
    updateProject(project.id, (current) => {
      if (current.layers.length <= 1) return
      const selectedSet = new Set(selectedIds)
      const deletable = current.layers.filter((layer) => selectedSet.has(layer.id) && !layer.locked && !layer.protected)
      if (deletable.length === 0) return
      if (current.layers.length - deletable.length < 1) return
      const deleteSet = new Set(deletable.map((layer) => layer.id))
      current.layers = current.layers.filter((layer) => !deleteSet.has(layer.id))
      current.selectedLayerId = current.layers[0]?.id ?? null
    }, selectedIds.length > 1 ? 'Delete layers' : 'Delete layer')
    setBoxSelectedLayerIds([])
  }

  function deleteSelectedArea() {
    if (!project || !areaSelection) return
    updateProject(project.id, (current) => {
      const target = current.layers.find((layer) => layer.id === areaSelection.layerId)
      if (!target || target.kind !== 'vector-rect' || target.locked) return
      const cutRect = {
        left: areaSelection.x,
        top: areaSelection.y,
        right: areaSelection.x + areaSelection.width,
        bottom: areaSelection.y + areaSelection.height,
      }
      const baseRects = (target.segments ?? [{
        x: 0,
        y: 0,
        width: target.width,
        height: target.height,
      }]).map((segment) => ({
        left: segment.x,
        top: segment.y,
        right: segment.x + segment.width,
        bottom: segment.y + segment.height,
      }))
      const nextRects = baseRects.flatMap((base) => subtractRect(base, cutRect))
      target.segments = nextRects.map((next) => ({
        x: next.left,
        y: next.top,
        width: next.right - next.left,
        height: next.bottom - next.top,
      }))
    }, 'Delete selected area')
    setAreaSelection(null)
  }

  function cropToSelection() {
    if (!project) return
    if (!canvasSelection && !areaSelection) return
    updateProject(project.id, (current) => {
      let left = 0
      let top = 0
      let right = current.document.width
      let bottom = current.document.height

      if (canvasSelection) {
        left = canvasSelection.left
        top = canvasSelection.top
        right = canvasSelection.right
        bottom = canvasSelection.bottom
      } else if (areaSelection) {
        const source = current.layers.find((layer) => layer.id === areaSelection.layerId)
        if (!source) return
        left = source.x + areaSelection.x
        top = source.y + areaSelection.y
        right = source.x + areaSelection.x + areaSelection.width
        bottom = source.y + areaSelection.y + areaSelection.height
      }

      left = Math.max(0, Math.min(current.document.width, left))
      top = Math.max(0, Math.min(current.document.height, top))
      right = Math.max(left + 1, Math.min(current.document.width, right))
      bottom = Math.max(top + 1, Math.min(current.document.height, bottom))
      const nextWidth = Math.max(1, Math.round(right - left))
      const nextHeight = Math.max(1, Math.round(bottom - top))

      current.layers.forEach((layer) => {
        layer.x -= left
        layer.y -= top
      })

      current.document.width = nextWidth
      current.document.height = nextHeight
      current.view.panX = 40
      current.view.panY = 40
    }, 'Crop')
    setCanvasSelection(null)
    setAreaSelection(null)
    setCanvasSelectionMove(null)
    setAreaMove(null)
  }

  function deselectAll() {
    setAreaSelection(null)
    setCanvasSelection(null)
    setCanvasSelectionMove(null)
    setAreaMove(null)
  }

  function selectAllCanvas() {
    if (!project) return
    setCanvasSelection({
      left: 0,
      top: 0,
      right: project.document.width,
      bottom: project.document.height,
    })
    setAreaSelection(null)
    setCanvasSelectionMove(null)
    setAreaMove(null)
  }

  function deleteLayerById(layerId: string) {
    if (!project) return
    if (project.layers.length <= 1) return
    updateProject(project.id, (current) => {
      if (current.layers.length <= 1) return
      const target = current.layers.find((layer) => layer.id === layerId)
      if (!target || target.locked || target.protected) return
      current.layers = current.layers.filter((layer) => layer.id !== layerId)
      if (current.selectedLayerId === layerId) {
        current.selectedLayerId = current.layers[0]?.id ?? null
      }
    }, 'Delete layer')
  }

  function beginTextEntry(x: number, y: number) {
    if (!project) return
    const layerId = uid('layer')
    updateProject(project.id, (current) => {
      current.layers.push({
        id: layerId,
        kind: current.type === 'vector' ? 'vector-text' : 'raster-text',
        name: 'Text',
        visible: true,
        locked: false,
        opacity: 1,
        x,
        y,
        rotation: 0,
        scaleX: 1,
        scaleY: 1,
        text: '',
        fontSize: 42,
        fill: '#111827',
      })
      current.selectedLayerId = layerId
    }, 'New text')
    setTextEntry({ layerId, value: '' })
  }

  function finishTextEntry(removeWhenEmpty: boolean) {
    if (!project || !textEntry) return
    const { layerId, value } = textEntry
    const hasText = value.length > 0
    updateProject(project.id, (current) => {
      const index = current.layers.findIndex((layer) => layer.id === layerId)
      if (index < 0) return
      const layer = current.layers[index]
      if (layer.kind !== 'vector-text' && layer.kind !== 'raster-text') return
      if (!hasText && removeWhenEmpty && current.layers.length > 1) {
        current.layers.splice(index, 1)
        if (current.selectedLayerId === layerId) {
          current.selectedLayerId = current.layers[0]?.id ?? null
        }
        return
      }
      layer.text = value
    }, hasText ? 'Set text' : 'Cancel text')
    setTextEntry(null)
  }

  function duplicateLayer() {
    if (!project || !selectedLayer) return
    updateProject(project.id, (current) => {
      const copy = structuredClone(selectedLayer)
      copy.id = uid('layer')
      copy.x += 20
      copy.y += 20
      copy.name = `${selectedLayer.name} Copy`
      current.layers.unshift(copy)
      current.selectedLayerId = copy.id
    }, 'Duplicate layer')
  }

  function startLayerRename(layer: Layer) {
    if (!project) return
    setLayerMenu(null)
    setLayerRename({ layerId: layer.id, value: layer.name })
  }

  function updateLayerRenameValue(value: string) {
    setLayerRename((current) => (current ? { ...current, value } : current))
  }

  function commitLayerRename(cancel = false) {
    if (!project || !layerRename) return
    if (cancel) {
      setLayerRename(null)
      return
    }
    const nextName = layerRename.value.trim()
    if (!nextName) {
      setLayerRename(null)
      return
    }
    updateProject(project.id, (current) => {
      const layer = current.layers.find((item) => item.id === layerRename.layerId)
      if (!layer) return
      layer.name = nextName
    }, 'Rename layer')
    setLayerRename(null)
  }

  function pasteLayer() {
    if (!project || !clipboard) return
    updateProject(project.id, (current) => {
      const pasted = clipboard.map((layer) => {
        const clone = structuredClone(layer)
        clone.id = uid('layer')
        clone.x += 24
        clone.y += 24
        clone.name = `${layer.name} Paste`
        return clone
      })
      current.layers = [...pasted, ...current.layers]
      current.selectedLayerId = pasted[0]?.id ?? null
    }, 'Paste')
  }

  function commitPen(closed: boolean) {
    if (!project || project.type !== 'vector' || penDraft.length < 2) return
    updateProject(project.id, (current) => {
      current.layers.unshift({
        id: uid('layer'),
        kind: 'vector-path',
        name: 'Pen Path',
        visible: true,
        locked: false,
        opacity: 1,
        x: 0,
        y: 0,
        rotation: 0,
        scaleX: 1,
        scaleY: 1,
        points: penDraft,
        closed,
        fill: 'transparent',
        stroke: '#0f172a',
        strokeWidth: 2,
      })
      current.selectedLayerId = current.layers[0].id
    }, 'Pen path')
    setPenDraft([])
  }

  async function onExport() {
    if (!project) return
    if (project.type === 'vector') {
      const svg = exportVectorSvg(project, assetMap)
      downloadBlob(new Blob([svg], { type: 'image/svg+xml' }), `${project.name}.svg`)
      return
    }
    const requested = (window.prompt('Format: png/jpg/webp/avif', 'png') ?? 'png').toLowerCase()
    const map: Record<string, string> = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp', avif: 'image/avif' }
    const mime = map[requested]
    if (!mime) return
    if (mime === 'image/avif' && !avifSupported) return
    const blob = await renderRasterBlob(project, assetMap, mime)
    if (blob) downloadBlob(blob, `${project.name}.${requested === 'jpeg' ? 'jpg' : requested}`)
  }

  useEffect(() => {
    const down = (event: KeyboardEvent) => {
      if (!project) return
      const target = event.target as HTMLElement | null
      const isTypingTarget = Boolean(
        target &&
        (
          target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable
        ),
      )
      if (isTypingTarget || textEntry) return
      const k = event.key.toLowerCase()
      const mod = event.metaKey || event.ctrlKey
      if (event.key === ' ') {
        event.preventDefault()
        if (!isSpace) {
          setIsSpace(true)
          setPreSpaceTool(project.activeTool)
          updateProject(project.id, (current) => { current.activeTool = 'hand' }, 'Temp hand')
        }
        return
      }
      if (mod && k === 'n') { event.preventDefault(); setShowStartOverlay(true); return }
      if (mod && k === 's') { event.preventDefault(); updateProject(project.id, () => undefined, 'Save'); return }
      if (mod && k === 'e') { event.preventDefault(); void onExport(); return }
      if (mod && k === 'w') { event.preventDefault(); closeProjectTab(project.id); return }
      if (mod && k === 'o') {
        event.preventDefault()
        const input = document.createElement('input')
        input.type = 'file'
        input.accept = '.ilp,application/json'
        input.onchange = (e) => {
          const file = (e.target as HTMLInputElement).files?.[0]
          if (file) void importIlp(file)
        }
        input.click()
        return
      }
      if (mod && k === 'z' && !event.shiftKey) { event.preventDefault(); undo(project.id); return }
      if ((mod && k === 'y') || (mod && event.shiftKey && k === 'z')) { event.preventDefault(); redo(project.id); return }
      if (event.key === 'Escape' && (areaSelection || canvasSelection)) {
        event.preventDefault()
        deselectAll()
        return
      }
      if (mod && k === 'd') {
        event.preventDefault()
        deselectAll()
        return
      }
      if (mod && k === 'a') {
        event.preventDefault()
        selectAllCanvas()
        return
      }
      if (mod && event.shiftKey && k === 'd') { event.preventDefault(); duplicateLayer(); return }
      if (mod && k === 'c') { event.preventDefault(); if (selectedLayer) setClipboard([structuredClone(selectedLayer)]); return }
      if (mod && k === 'x') { event.preventDefault(); if (selectedLayer) { setClipboard([structuredClone(selectedLayer)]); deleteLayer(); } return }
      if (mod && event.shiftKey && k === 'x') { event.preventDefault(); cropToSelection(); return }
      if (mod && k === 'v') { event.preventDefault(); pasteLayer(); return }
      if (k === 'delete' || k === 'backspace') {
        event.preventDefault()
        if (areaSelection && selectedLayer?.id === areaSelection.layerId && selectedLayer.kind === 'vector-rect') {
          deleteSelectedArea()
          return
        }
        deleteLayer()
        return
      }
      if (mod && k === '0') { event.preventDefault(); fitToScreen(); return }
      if (mod && k === '1') { event.preventDefault(); setZoom(1); return }
      if (mod && (k === '+' || k === '=')) { event.preventDefault(); setZoom(project.view.zoom * 1.15); return }
      if (mod && k === '-') { event.preventDefault(); setZoom(project.view.zoom * 0.85); return }
      if (event.shiftKey && event.key === '?') { event.preventDefault(); setShortcutsOpen(true); return }
      const map: Record<string, ToolId> = { v: 'move', q: 'select', h: 'hand', z: 'zoom', t: 'text', u: 'shape', p: 'pen' }
      const tool = map[k]
      if (tool && tools.includes(tool)) updateProject(project.id, (current) => { current.activeTool = tool }, `Tool ${tool}`)
      if (event.key === 'Enter' && project.activeTool === 'pen' && penDraft.length > 1) {
        event.preventDefault()
        commitPen(false)
      }
    }
    const up = (event: KeyboardEvent) => {
      if (!project) return
      if (event.key === ' ' && isSpace && preSpaceTool) {
        updateProject(project.id, (current) => { current.activeTool = preSpaceTool }, 'Restore tool')
        setIsSpace(false)
        setPreSpaceTool(null)
      }
    }
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    return () => {
      window.removeEventListener('keydown', down)
      window.removeEventListener('keyup', up)
    }
  }, [project, tools, isSpace, preSpaceTool, selectedLayer, penDraft, setShowStartOverlay, textEntry, boxSelectedLayerIds, areaSelection]) // eslint-disable-line react-hooks/exhaustive-deps

  const onStagePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!project) return
    const point = docPoint(event, event.currentTarget, project)
    if (project.activeTool === 'zoom') {
      if (event.button === 2) {
        event.preventDefault()
        setZoom(1)
        return
      }
      const rect = event.currentTarget.getBoundingClientRect()
      setZoomScrub({
        pointerId: event.pointerId,
        startY: event.clientY,
        startZoom: project.view.zoom,
        anchorScreenX: event.clientX - rect.left,
        anchorScreenY: event.clientY - rect.top,
        anchorDocX: point.x,
        anchorDocY: point.y,
      })
      return
    }
    if (project.activeTool === 'hand' || isSpace) {
      setPanDrag({ pointerId: event.pointerId, x: event.clientX, y: event.clientY, px: project.view.panX, py: project.view.panY })
      return
    }
    if (project.activeTool === 'select') {
      setBoxSelectedLayerIds([])
      setAreaMove(null)
      setMarquee({ pointerId: event.pointerId, start: point, current: point })
      return
    }
    if (project.activeTool === 'text') {
      if (textEntry) finishTextEntry(true)
      beginTextEntry(point.x, point.y)
      return
    }
    if (project.activeTool === 'pen' && project.type === 'vector') {
      setPenDraft((draft) => [
        ...draft,
        { id: uid('pt'), anchor: point, inHandle: { x: point.x - 18, y: point.y }, outHandle: { x: point.x + 18, y: point.y }, smooth: true },
      ])
      return
    }
    if (
      project.activeTool === 'move' &&
      canvasSelection &&
      point.x >= canvasSelection.left &&
      point.x <= canvasSelection.right &&
      point.y >= canvasSelection.top &&
      point.y <= canvasSelection.bottom
    ) {
      setCanvasSelectionMove({
        pointerId: event.pointerId,
        startX: point.x,
        startY: point.y,
        origin: canvasSelection,
      })
      return
    }
    if (selectedLayer && !selectedLayer.locked && project.activeTool === 'move') {
      setMoveLayer({ id: selectedLayer.id, pointerId: event.pointerId, x: point.x, y: point.y, lx: selectedLayer.x, ly: selectedLayer.y })
    }
  }

  const onStagePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!project) return
    const point = docPoint(event, event.currentTarget, project)
    setCursor(point)
    if (zoomScrub && zoomScrub.pointerId === event.pointerId && project.activeTool === 'zoom') {
      const dy = event.clientY - zoomScrub.startY
      const nextZoom = clamp(zoomScrub.startZoom * Math.exp(-dy * 0.01), 0.1, 16)
      updateProject(project.id, (current) => {
        current.view.zoom = nextZoom
        current.view.panX = zoomScrub.anchorScreenX - zoomScrub.anchorDocX * nextZoom
        current.view.panY = zoomScrub.anchorScreenY - zoomScrub.anchorDocY * nextZoom
      }, 'Zoom scrub')
      return
    }
    if (panDrag && panDrag.pointerId === event.pointerId) {
      updateProject(project.id, (current) => {
        current.view.panX = panDrag.px + (event.clientX - panDrag.x)
        current.view.panY = panDrag.py + (event.clientY - panDrag.y)
      }, 'Pan')
      return
    }
    if (moveLayer && moveLayer.pointerId === event.pointerId && project.activeTool === 'move') {
      updateProject(project.id, (current) => {
        const layer = current.layers.find((item) => item.id === moveLayer.id)
        if (!layer) return
        layer.x = moveLayer.lx + (point.x - moveLayer.x)
        layer.y = moveLayer.ly + (point.y - moveLayer.y)
      }, 'Move')
    }
    if (canvasSelectionMove && canvasSelectionMove.pointerId === event.pointerId && project.activeTool === 'move') {
      const dx = point.x - canvasSelectionMove.startX
      const dy = point.y - canvasSelectionMove.startY
      const width = canvasSelectionMove.origin.right - canvasSelectionMove.origin.left
      const height = canvasSelectionMove.origin.bottom - canvasSelectionMove.origin.top
      const minLeft = 0
      const minTop = 0
      const maxLeft = Math.max(0, project.document.width - width)
      const maxTop = Math.max(0, project.document.height - height)
      const nextLeft = clamp(canvasSelectionMove.origin.left + dx, minLeft, maxLeft)
      const nextTop = clamp(canvasSelectionMove.origin.top + dy, minTop, maxTop)
      setCanvasSelection({
        left: nextLeft,
        top: nextTop,
        right: nextLeft + width,
        bottom: nextTop + height,
      })
      if (areaMove && areaMove.pointerId === event.pointerId) {
        setAreaMove((current) =>
          current
            ? { ...current, dx: nextLeft - canvasSelectionMove.origin.left, dy: nextTop - canvasSelectionMove.origin.top }
            : current,
        )
      }
      return
    }
    if (areaMove && areaMove.pointerId === event.pointerId && project.activeTool === 'move') {
      setAreaMove((current) =>
        current
          ? { ...current, dx: point.x - current.startX, dy: point.y - current.startY }
          : current,
      )
      return
    }
    if (marquee && marquee.pointerId === event.pointerId) {
      setMarquee((current) => (current ? { ...current, current: point } : current))
    }
    if (project.activeTool === 'pen' && penDraft.length > 0 && (event.buttons & 1) === 1) {
      setPenDraft((draft) => {
        const next = draft.slice()
        const last = next[next.length - 1]
        const dx = point.x - last.anchor.x
        const dy = point.y - last.anchor.y
        last.outHandle = { x: last.anchor.x + dx, y: last.anchor.y + dy }
        last.inHandle = { x: last.anchor.x - dx, y: last.anchor.y - dy }
        return next
      })
    }
  }

  const onStagePointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (zoomScrub?.pointerId === event.pointerId) setZoomScrub(null)
    if (panDrag?.pointerId === event.pointerId) setPanDrag(null)
    if (moveLayer?.pointerId === event.pointerId) setMoveLayer(null)
    if (canvasSelectionMove?.pointerId === event.pointerId) setCanvasSelectionMove(null)
    if (areaMove?.pointerId === event.pointerId && project && areaSelection) {
      const dx = areaMove.dx
      const dy = areaMove.dy
      if (Math.abs(dx) > 0.5 || Math.abs(dy) > 0.5) {
        updateProject(project.id, (current) => {
          const target = current.layers.find((layer) => layer.id === areaSelection.layerId)
          if (!target || target.kind !== 'vector-rect' || target.locked) return
          const sourceRect = {
            left: areaSelection.x,
            top: areaSelection.y,
            right: areaSelection.x + areaSelection.width,
            bottom: areaSelection.y + areaSelection.height,
          }
          const baseRects = (target.segments ?? [{
            x: 0,
            y: 0,
            width: target.width,
            height: target.height,
          }]).map((segment) => ({
            left: segment.x,
            top: segment.y,
            right: segment.x + segment.width,
            bottom: segment.y + segment.height,
          }))

          const selectedPieces = baseRects
            .map((rect) => intersectRect(rect, sourceRect))
            .filter((rect): rect is { left: number; top: number; right: number; bottom: number } => Boolean(rect))
          const remainder = baseRects.flatMap((rect) => subtractRect(rect, sourceRect))
          const bounds = { left: 0, top: 0, right: target.width, bottom: target.height }
          const movedPieces = selectedPieces
            .map((piece) => ({
              left: piece.left + dx,
              top: piece.top + dy,
              right: piece.right + dx,
              bottom: piece.bottom + dy,
            }))
            .map((piece) => clampRectToBounds(piece, bounds))
            .filter((piece): piece is { left: number; top: number; right: number; bottom: number } => Boolean(piece))
          const nextRects = [...remainder, ...movedPieces]
          target.segments = nextRects.map((rect) => ({
            x: rect.left,
            y: rect.top,
            width: rect.right - rect.left,
            height: rect.bottom - rect.top,
          }))
        }, 'Move selected area')

        const selectionBounds = selectedLayer
          ? (getLayerLocalBounds(selectedLayer) ?? { left: 0, top: 0, right: Number.POSITIVE_INFINITY, bottom: Number.POSITIVE_INFINITY })
          : { left: 0, top: 0, right: Number.POSITIVE_INFINITY, bottom: Number.POSITIVE_INFINITY }

        const movedSelection = clampRectToBounds(
          {
            left: areaSelection.x + dx,
            top: areaSelection.y + dy,
            right: areaSelection.x + areaSelection.width + dx,
            bottom: areaSelection.y + areaSelection.height + dy,
          },
          selectionBounds,
        )
        if (movedSelection) {
          setAreaSelection({
            layerId: areaSelection.layerId,
            x: movedSelection.left,
            y: movedSelection.top,
            width: movedSelection.right - movedSelection.left,
            height: movedSelection.bottom - movedSelection.top,
          })
          if (selectedLayer) {
            setCanvasSelection({
              left: selectedLayer.x + movedSelection.left,
              top: selectedLayer.y + movedSelection.top,
              right: selectedLayer.x + movedSelection.right,
              bottom: selectedLayer.y + movedSelection.bottom,
            })
          }
        } else {
          setAreaSelection(null)
          setCanvasSelection(null)
        }
      }
      setAreaMove(null)
      return
    }
    if (marquee?.pointerId === event.pointerId && project) {
      const rect = rectFromPoints(marquee.start, marquee.current)
      if (rect.width > 2 || rect.height > 2) {
        if (project.activeTool === 'select') {
          setCanvasSelection({ left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom })
        }
        setAreaSelection(null)
      } else if (project.activeTool === 'select') {
        setCanvasSelection(null)
        setAreaSelection(null)
      }
      setBoxSelectedLayerIds([])
      setMarquee(null)
    }
  }

  const onWheelStage = (event: WheelEvent<HTMLDivElement>) => {
    if (!project) return
    event.preventDefault()
    if (event.metaKey || event.ctrlKey) {
      const before = docPoint(event, event.currentTarget, project)
      const nextZoom = clamp(project.view.zoom * (event.deltaY < 0 ? 1.1 : 0.9), 0.1, 16)
      updateProject(project.id, (current) => {
        current.view.zoom = nextZoom
        const rect = event.currentTarget.getBoundingClientRect()
        current.view.panX = event.clientX - rect.left - before.x * nextZoom
        current.view.panY = event.clientY - rect.top - before.y * nextZoom
      }, 'Zoom cursor')
      return
    }
    updateProject(project.id, (current) => {
      current.view.panX -= event.deltaX
      current.view.panY -= event.deltaY
    }, 'Pan wheel')
  }

  const onStageDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    if (!project) return
    const id = event.dataTransfer.getData('imagelab/asset')
    const asset = assets[id]
    if (!asset) return
    const p = docPoint(event, event.currentTarget, project)
    void addLayerFromAsset(project, asset, p, workspace.rasterizeScale, updateProject)
  }

  const onDocumentPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!project) return
    if (project.activeTool !== 'text') return
    const stage = event.currentTarget.parentElement as HTMLDivElement | null
    if (!stage) return
    event.preventDefault()
    event.stopPropagation()
    if (textEntry) finishTextEntry(true)
    const point = docPoint(event, stage, project)
    beginTextEntry(point.x, point.y)
  }

  const stageCursor = project
    ? project.activeTool === 'text'
      ? 'text'
      : project.activeTool === 'select'
        ? 'crosshair'
        : project.activeTool === 'zoom'
          ? 'ns-resize'
        : project.activeTool === 'move'
          ? 'move'
      : project.activeTool === 'hand' || isSpace
        ? panDrag ? 'grabbing' : 'grab'
        : 'default'
    : 'default'

  const importAssets = async (files: FileList | File[]) => {
    for (const file of Array.from(files)) {
      await addAssetFromFile(file)
    }
  }

  const pickFiles = (accept: string, multiple: boolean, handler: (files: FileList) => void) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = accept
    input.multiple = multiple
    input.onchange = (event) => {
      const files = (event.target as HTMLInputElement).files
      if (files) handler(files)
    }
    input.click()
  }

  const menuModel = {
    File: [
      { label: 'New Project', shortcut: `${modKey()}+N`, onClick: () => setShowStartOverlay(true) },
      { label: 'Open Project', shortcut: `${modKey()}+O`, onClick: () => pickFiles('.ilp,application/json', false, (files) => { const f = files[0]; if (f) void importIlp(f) }) },
      { label: 'Save Project', shortcut: `${modKey()}+S`, onClick: () => project && updateProject(project.id, () => undefined, 'Save') },
      { label: 'Export .ilp', onClick: async () => { if (!project) return; downloadBlob(await exportIlp(project.id), `${project.name}.ilp`) } },
      { label: 'Place Image', onClick: () => pickFiles('image/png,image/jpeg,image/webp,image/avif', false, (files) => { const f = files[0]; if (f) void addAssetFromFile(f) }) },
      { label: 'Import Assets', onClick: () => pickFiles('image/png,image/jpeg,image/webp,image/avif,image/svg+xml', true, (files) => void importAssets(files)) },
      { label: 'Export...', shortcut: `${modKey()}+E`, onClick: () => void onExport() },
      { label: 'Close Project Tab', shortcut: `${modKey()}+W`, onClick: () => project && closeProjectTab(project.id) },
    ],
    Edit: [
      { label: 'Undo', shortcut: `${modKey()}+Z`, onClick: () => project && undo(project.id) },
      { label: 'Redo', shortcut: isMac() ? 'Cmd+Shift+Z' : 'Ctrl+Y', onClick: () => project && redo(project.id) },
      { label: 'Cut', shortcut: `${modKey()}+X`, onClick: () => { if (selectedLayer) { setClipboard([structuredClone(selectedLayer)]); deleteLayer() } } },
      { label: 'Copy', shortcut: `${modKey()}+C`, onClick: () => selectedLayer && setClipboard([structuredClone(selectedLayer)]) },
      { label: 'Paste', shortcut: `${modKey()}+V`, onClick: pasteLayer },
      { label: 'Duplicate Layer', shortcut: `${modKey()}+Shift+D`, onClick: duplicateLayer },
      { label: 'Delete Layer', shortcut: 'Delete', onClick: deleteLayer },
    ],
    Select: [
      { label: 'Select All', shortcut: `${modKey()}+A`, onClick: selectAllCanvas },
      { label: 'Deselect', shortcut: `${modKey()}+D`, onClick: deselectAll },
    ],
    View: [
      { label: 'Zoom In', shortcut: `${modKey()}+Plus`, onClick: () => project && setZoom(project.view.zoom * 1.15) },
      { label: 'Zoom Out', shortcut: `${modKey()}+-`, onClick: () => project && setZoom(project.view.zoom * 0.85) },
      { label: 'Fit to Screen', shortcut: `${modKey()}+0`, onClick: fitToScreen },
      { label: '100%', shortcut: `${modKey()}+1`, onClick: () => setZoom(1) },
      { label: 'Crop', shortcut: `${modKey()}+Shift+X`, onClick: cropToSelection },
    ],
    Layer: [
      { label: 'New Text Layer', onClick: () => project && beginTextEntry(140, 140) },
      { label: 'New Shape Layer', onClick: () => project && updateProject(project.id, (c) => { if (c.type === 'vector') c.layers.unshift({ id: uid('layer'), kind: 'vector-rect', name: 'Rect', visible: true, locked: false, opacity: 1, x: 120, y: 120, rotation: 0, scaleX: 1, scaleY: 1, width: 220, height: 130, fill: '#22d3ee', stroke: '#0f172a', strokeWidth: 1 }); c.selectedLayerId = c.layers[0]?.id ?? null }, 'New shape') },
    ],
    Window: [
      ...ALL_PANELS.map((p) => ({ label: `${workspace.hiddenPanels.includes(p) ? '' : '✓ '} ${PANEL_TITLES[p]}`, onClick: () => togglePanelVisibility(p) })),
      { label: 'Dock All Panels', onClick: dockAllPanels },
      { label: 'Reset Panel Layout', onClick: resetWorkspace },
      { label: 'Bring All Panels to Front', onClick: bringPanelsToFront },
    ],
    Workspace: [
      { label: 'Reset Layout', onClick: resetWorkspace },
      { label: 'Dock All Panels', onClick: dockAllPanels },
    ],
    Help: [
      { label: 'Keyboard Shortcuts', shortcut: 'Shift+/', onClick: () => setShortcutsOpen(true) },
      { label: 'About', onClick: () => window.alert('imagelab MVP') },
    ],
  } satisfies Record<string, Array<{ label: string; shortcut?: string; onClick: () => void }>>

  const openLayerContextMenu = (layerId: string, event: ReactMouseEvent<HTMLButtonElement>) => {
    event.preventDefault()
    setLayerMenu({ layerId, x: event.clientX, y: event.clientY })
  }
  const moveLayerRelative = (dragLayerId: string, targetLayerId: string, position: 'before' | 'after') => {
    if (!project) return
    if (dragLayerId === targetLayerId) return
    updateProject(project.id, (current) => {
      const from = current.layers.findIndex((layer) => layer.id === dragLayerId)
      const [moved] = current.layers.splice(from, 1)
      const target = current.layers.findIndex((layer) => layer.id === targetLayerId)
      if (from < 0 || target < 0 || !moved) return
      const insertAt = position === 'before' ? target : target + 1
      current.layers.splice(insertAt, 0, moved)
    }, 'Reorder layer')
  }
  const beginLayerDrag = (layerId: string) => setLayerDragState({ activeId: layerId, targetId: null, position: 'before' })
  const hoverLayerDragTarget = (layerId: string, position: 'before' | 'after') => {
    setLayerDragState((current) => {
      if (!current) return current
      if (current.targetId === layerId && current.position === position) return current
      return { ...current, targetId: layerId, position }
    })
  }
  const clearLayerDrag = () => setLayerDragState(null)
  const openTextEditorForLayer = (layer: Layer) => {
    if (!project) return
    if (!isTextLayer(layer)) return
    updateProject(project.id, (current) => {
      current.selectedLayerId = layer.id
    }, 'Select layer')
    setTextEntry({ layerId: layer.id, value: layer.text })
  }
  const editingTextLayer = project && textEntry
    ? project.layers.find((layer): layer is Extract<Layer, { kind: 'vector-text' | 'raster-text' }> => layer.id === textEntry.layerId && isTextLayer(layer))
    : null
  const menuLayer = project && layerMenu ? project.layers.find((layer) => layer.id === layerMenu.layerId) : null
  const renderableLayers = project
    ? (editingTextLayer
      ? project.layers.filter((layer) => layer.visible && layer.id !== editingTextLayer.id)
      : project.layers.filter((layer) => layer.visible))
    : []
  const stackedLayers = [...renderableLayers].reverse()

  if (!project) {
    return (
      <div className="relative flex h-screen flex-col overflow-hidden bg-slate-950 text-slate-100">
        <div ref={menuBarRef} className="flex h-10 items-center border-b border-slate-800 bg-slate-900 px-2 text-sm">
          {defaultMenuOrder.map((menu) => (
            <div key={menu} className="relative">
              <button className={`rounded px-2 py-1 ${openMenu === menu ? 'bg-slate-800' : 'hover:bg-slate-800'}`} onClick={() => setOpenMenu(openMenu === menu ? null : menu)}>
                <span className="inline-flex items-center gap-1.5">
                  {menu === 'File' && <img src={appLogo} alt="" aria-hidden="true" className="h-3.5 w-3.5" />}
                  <span>{menu}</span>
                </span>
              </button>
              {openMenu === menu && (
                <div className="absolute left-0 top-8 z-40 min-w-[220px] rounded border border-slate-700 bg-slate-900 p-1 shadow-xl">
                  {menuModel[menu].map((item) => (
                    <button key={`${menu}_${item.label}`} className="flex w-full items-center justify-between rounded px-2 py-1 text-left text-xs hover:bg-slate-800" onClick={() => { item.onClick(); setOpenMenu(null) }}>
                      <span>{item.label}</span>
                      <span className="text-slate-500">{item.shortcut}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}
          <div className="ml-auto">
            <button
              className="rounded border border-slate-700 px-2 py-1 text-xs hover:bg-slate-800"
              onClick={() => setShowStartOverlay(true)}
              title="Home"
            >
              Home
            </button>
          </div>
        </div>

        <div className="flex h-9 items-center border-b border-slate-800 bg-slate-900/70 px-1">
          <div className="rounded-t border border-slate-800 bg-slate-900 px-2 py-1 text-xs text-slate-500">
            No open projects
          </div>
        </div>

        <div className="flex min-h-0 flex-1">
          <div className="flex w-16 flex-col items-stretch border-r border-slate-800 bg-slate-900 p-1">
            <div className="mb-1 select-none text-center text-[10px] text-slate-500">Tools</div>
            <div className="flex min-h-0 flex-1 flex-col gap-1 overflow-auto">
              {toolList('raster').map((tool) => (
                <button
                  key={tool}
                  title={tool}
                  disabled
                  className="rounded border border-slate-800 px-1 py-2 text-[10px] uppercase tracking-wide text-slate-500"
                >
                  <span className="inline-flex items-center justify-center text-white/70">{toolIcon(tool)}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="relative min-h-0 flex-1 overflow-hidden bg-[radial-gradient(circle_at_1px_1px,_#334155_1px,_transparent_0)] bg-[size:24px_24px]">
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="rounded border border-slate-700 bg-slate-900 px-4 py-2 text-sm text-slate-300">
                Open or create a project to begin.
              </div>
            </div>
          </div>

          <aside className="flex w-[340px] min-h-0 flex-col border-l border-slate-800 bg-slate-900 p-1">
            <div className="mb-1 px-1 text-[10px] text-slate-500">
              Drag tab to top/bottom to place, or center to group.
            </div>
            <div className="min-h-0 flex-1 space-y-1 overflow-auto">
              {visiblePanels.map((panelId) => (
                <div
                  key={panelId}
                  className="flex min-h-[120px] flex-col overflow-hidden rounded border border-slate-800 bg-slate-900"
                >
                  <div className="flex items-center justify-between border-b border-slate-800 px-2 py-1 text-xs text-slate-500">
                    <span>{PANEL_TITLES[panelId]}</span>
                    <button className="rounded border border-slate-800 px-2 py-[2px] text-slate-500" disabled>Pop Out</button>
                  </div>
                  <div className="min-h-0 flex-1 overflow-auto p-3 text-sm text-slate-500">
                    Project panels will appear here once a project is open.
                  </div>
                </div>
              ))}
            </div>
          </aside>
        </div>

        <div className="flex h-7 items-center justify-between border-t border-slate-800 bg-slate-900 px-3 text-xs text-slate-500">
          <span>Zoom -%</span>
          <span>- x -</span>
          <span>X -, Y -</span>
        </div>

        {overlayVisible && (
          <StartOverlay
            canDismiss={hasOpenProjects}
            onRequestClose={() => setShowStartOverlay(false)}
          />
        )}

        {shortcutsOpen && (
          <div className="absolute inset-0 z-[2000] flex items-center justify-center bg-black/60 p-4">
            <div className="w-full max-w-xl rounded border border-slate-600 bg-slate-900 p-4 text-sm">
              <div className="mb-2 flex items-center justify-between"><h2 className="font-semibold">Keyboard Shortcuts</h2><button className="rounded border border-slate-700 px-2 py-1 text-xs" onClick={() => setShortcutsOpen(false)}>Close</button></div>
              <div className="grid grid-cols-2 gap-2">
                <div>{modKey()}+N/O/S/E/W</div><div>File actions</div>
                <div>{modKey()}+Z / {isMac() ? 'Cmd+Shift+Z' : 'Ctrl+Y'}</div><div>Undo/Redo</div>
                <div>V H Z T U P C</div><div>Tools</div>
                <div>{modKey()}+0 / {modKey()}+1 / {modKey()} +/-</div><div>View controls</div>
              </div>
            </div>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="relative flex h-screen flex-col overflow-hidden bg-slate-950 text-slate-100">
      <div ref={menuBarRef} className="flex h-10 items-center border-b border-slate-800 bg-slate-900 px-2 text-sm">
        {defaultMenuOrder.map((menu) => (
          <div key={menu} className="relative">
              <button className={`rounded px-2 py-1 ${openMenu === menu ? 'bg-slate-800' : 'hover:bg-slate-800'}`} onClick={() => setOpenMenu(openMenu === menu ? null : menu)}>
                <span className="inline-flex items-center gap-1.5">
                  {menu === 'File' && <img src={appLogo} alt="" aria-hidden="true" className="h-3.5 w-3.5" />}
                  <span>{menu}</span>
                </span>
              </button>
            {openMenu === menu && (
              <div className="absolute left-0 top-8 z-40 min-w-[220px] rounded border border-slate-700 bg-slate-900 p-1 shadow-xl">
                {menuModel[menu].map((item) => (
                  <button key={`${menu}_${item.label}`} className="flex w-full items-center justify-between rounded px-2 py-1 text-left text-xs hover:bg-slate-800" onClick={() => { item.onClick(); setOpenMenu(null) }}>
                    <span>{item.label}</span>
                    <span className="text-slate-500">{item.shortcut}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}
        <div className="ml-auto">
          <button
            className="rounded border border-slate-700 px-2 py-1 text-xs hover:bg-slate-800"
            onClick={() => setShowStartOverlay(true)}
            title="Home"
          >
            Home
          </button>
        </div>
      </div>

      <div className="flex h-9 items-center border-b border-slate-800 bg-slate-900/70 px-1">
        {openProjectIds.map((id) => (
          <div key={id} className={`mr-1 flex items-center rounded-t border px-2 py-1 text-xs ${id === project.id ? 'border-slate-600 bg-slate-800' : 'border-slate-800 bg-slate-900'}`}>
            <button onClick={() => setActiveProject(id)}>{projects[id].name}</button>
            <button className="ml-2 text-slate-400 hover:text-slate-100" onClick={() => closeProjectTab(id)}>x</button>
          </div>
        ))}
      </div>

      <div className="flex min-h-0 flex-1">
        <div className="flex w-16 flex-col items-stretch border-r border-slate-800 bg-slate-900 p-1">
          <div className="mb-1 select-none text-center text-[10px] text-slate-400">Tools</div>
          <div className="flex min-h-0 flex-1 flex-col gap-1 overflow-auto">
            {tools.map((tool) => (
              <button
                key={tool}
                title={tool}
                className={`rounded border px-1 py-2 text-[10px] uppercase tracking-wide ${
                  project.activeTool === tool ? 'border-cyan-500 bg-cyan-950/50 text-cyan-200' : 'border-slate-700 text-slate-200 hover:bg-slate-800'
                }`}
                onClick={() => updateProject(project.id, (c) => { c.activeTool = tool }, `Tool ${tool}`)}
              >
                <span className="inline-flex items-center justify-center text-white">{toolIcon(tool)}</span>
              </button>
            ))}
          </div>
        </div>
        <div id="editor-stage" className="relative min-h-0 flex-1 overflow-hidden bg-[radial-gradient(circle_at_1px_1px,_#334155_1px,_transparent_0)] bg-[size:24px_24px]" style={{ cursor: stageCursor }} onPointerDown={onStagePointerDown} onPointerMove={onStagePointerMove} onPointerUp={onStagePointerUp} onWheel={onWheelStage} onContextMenu={(event) => { if (project?.activeTool === 'zoom') event.preventDefault() }} onDragOver={(e) => e.preventDefault()} onDrop={onStageDrop}>
          <div
            className="absolute origin-top-left border border-slate-500/60 shadow-[0_0_0_1px_rgba(0,0,0,0.2)]"
            style={{
              width: project.document.width,
              height: project.document.height,
              transform: `translate(${project.view.panX}px, ${project.view.panY}px) scale(${project.view.zoom})`,
                ...documentBackdropStyle(),
            }}
            onPointerDown={onDocumentPointerDown}
          >
            {project.type === 'vector' ? <svg width={project.document.width} height={project.document.height}>{stackedLayers.map((l) => <LayerVector key={l.id} layer={l} asset={assets[(l as { assetId?: string }).assetId ?? '']} />)}</svg> : <div className="relative h-full w-full">{stackedLayers.map((l) => <LayerRaster key={l.id} layer={l} asset={assets[(l as { assetId?: string }).assetId ?? '']} />)}</div>}
            {editingTextLayer && (
              <div
                className="absolute"
                style={{
                  left: editingTextLayer.x,
                  top: editingTextLayer.y,
                  transform: `rotate(${editingTextLayer.rotation}deg) scale(${editingTextLayer.scaleX}, ${editingTextLayer.scaleY})`,
                  transformOrigin: 'top left',
                  opacity: editingTextLayer.opacity,
                }}
              >
                <div
                  ref={textEntryInputRef}
                  contentEditable
                  suppressContentEditableWarning
                  className="min-w-[8px] whitespace-pre text-slate-900 outline-none"
                  style={{ color: editingTextLayer.fill, fontSize: editingTextLayer.fontSize }}
                  onPointerDown={(event) => event.stopPropagation()}
                  onInput={(event) => {
                    const value = event.currentTarget.textContent ?? ''
                    setTextEntry((current) => (current ? { ...current, value } : current))
                  }}
                  onBlur={() => finishTextEntry(true)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.preventDefault()
                      finishTextEntry(true)
                    }
                    if (event.key === 'Escape') {
                      event.preventDefault()
                      finishTextEntry(true)
                    }
                  }}
                >
                  {textEntry?.value ?? ''}
                </div>
              </div>
            )}
          </div>
          {project.type === 'vector' && penDraft.length > 1 && (
            <div className="absolute bottom-2 left-2 flex gap-1 rounded border border-slate-700 bg-slate-900 p-1 text-xs">
              <button className="rounded border border-slate-700 px-2 py-1 hover:bg-slate-700" onClick={() => commitPen(false)}>Finish Path</button>
              <button className="rounded border border-slate-700 px-2 py-1 hover:bg-slate-700" onClick={() => commitPen(true)}>Close Path</button>
            </div>
          )}
          {marquee && (
            <div
              className="pointer-events-none absolute border border-cyan-400 bg-cyan-400/15"
              style={{
                left: Math.min(marquee.start.x, marquee.current.x) * project.view.zoom + project.view.panX,
                top: Math.min(marquee.start.y, marquee.current.y) * project.view.zoom + project.view.panY,
                width: Math.abs(marquee.current.x - marquee.start.x) * project.view.zoom,
                height: Math.abs(marquee.current.y - marquee.start.y) * project.view.zoom,
              }}
            />
          )}
          {areaSelection && selectedLayer?.id === areaSelection.layerId && (
            <div
              className="pointer-events-none absolute border border-amber-300 bg-amber-300/20 shadow-[0_0_0_1px_rgba(251,191,36,0.45)]"
              style={{
                left: (selectedLayer.x + areaSelection.x + (areaMove?.dx ?? 0)) * project.view.zoom + project.view.panX,
                top: (selectedLayer.y + areaSelection.y + (areaMove?.dy ?? 0)) * project.view.zoom + project.view.panY,
                width: areaSelection.width * project.view.zoom,
                height: areaSelection.height * project.view.zoom,
              }}
            />
          )}
          {canvasSelection && (
            <svg
              className="pointer-events-none absolute"
              style={{
                left: canvasSelection.left * project.view.zoom + project.view.panX,
                top: canvasSelection.top * project.view.zoom + project.view.panY,
                width: (canvasSelection.right - canvasSelection.left) * project.view.zoom,
                height: (canvasSelection.bottom - canvasSelection.top) * project.view.zoom,
              }}
            >
              <rect x="0" y="0" width="100%" height="100%" fill="none" stroke="white" strokeWidth={1} strokeDasharray="5 4">
                <animate attributeName="stroke-dashoffset" from="0" to="-18" dur="0.75s" repeatCount="indefinite" />
              </rect>
              <rect x="0" y="0" width="100%" height="100%" fill="none" stroke="black" strokeWidth={1} strokeDasharray="5 4" strokeDashoffset={4}>
                <animate attributeName="stroke-dashoffset" from="4" to="-14" dur="0.75s" repeatCount="indefinite" />
              </rect>
            </svg>
          )}
        </div>

        <aside className="flex w-[340px] min-h-0 flex-col border-l border-slate-800 bg-slate-900 p-1">
          <div className="mb-1 px-1 text-[10px] text-slate-500">
            Drag tab to top/bottom to place, or center to group.
          </div>
          <div className="min-h-0 flex-1 space-y-1 overflow-auto">
              {visiblePanels.length === 0 && (
                <div className="rounded border border-slate-700 bg-slate-900 p-3 text-xs text-slate-400">
                  All dock panels are hidden.
                </div>
              )}
              {dockGroups.map((group, index) => {
                const leadPanelId = group[0]
                if (!leadPanelId) return null
                const activePanelInGroup = group.includes(workspace.activePanel) ? workspace.activePanel : leadPanelId
                const dropMode = dockDropTarget?.targetLead === leadPanelId ? dockDropTarget.mode : null
                return (
                <div
                  key={leadPanelId}
                  className={`relative flex min-h-[120px] flex-col overflow-hidden rounded border bg-slate-900 ${
                    dropMode === 'merge'
                      ? 'border-cyan-400 ring-2 ring-cyan-500/70'
                      : dropMode
                        ? 'border-cyan-500/70'
                        : 'border-slate-800'
                  }`}
                  style={index === dockGroups.length - 1 ? undefined : { height: getDockPanelHeight(leadPanelId) }}
                  onDragEnter={(event) => {
                    event.preventDefault()
                    const drag = draggingPanelId
                    if (!drag || drag === leadPanelId) return
                    setDockDropTarget({ targetLead: leadPanelId, mode: resolveDockDropMode(event) })
                  }}
                  onDragOver={(event) => {
                    event.preventDefault()
                    const drag = draggingPanelId
                    if (!drag || drag === leadPanelId) {
                      setDockDropTarget(null)
                      return
                    }
                    setDockDropTarget({ targetLead: leadPanelId, mode: resolveDockDropMode(event) })
                  }}
                  onDragLeave={(event) => {
                    const next = event.relatedTarget as Node | null
                    if (next && event.currentTarget.contains(next)) return
                    setDockDropTarget((current) => (current?.targetLead === leadPanelId ? null : current))
                  }}
                  onDrop={(event) => {
                    event.preventDefault()
                    const drag = draggingPanelId ?? (event.dataTransfer.getData('imagelab/panel-tab') as PanelId)
                    setDockDropTarget(null)
                    setDraggingPanelId(null)
                    if (!drag || drag === leadPanelId) return
                    const mode = resolveDockDropMode(event)
                    placePanelInGroup(drag, leadPanelId, mode)
                  }}
                >
                  {dropMode === 'before' && (
                    <div className="pointer-events-none absolute left-0 right-0 top-0 z-10 h-1 rounded-t bg-cyan-300/30 shadow-[0_0_0_1px_rgba(34,211,238,0.2)]" />
                  )}
                  <div
                    className={`flex items-center justify-between border-b px-2 py-1 text-xs ${
                      dropMode === 'merge'
                        ? 'border-cyan-400 bg-cyan-950/50 text-cyan-200'
                        : 'border-slate-800'
                    }`}
                  >
                    <div className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto">
                      {group.map((tabPanelId) => (
                        <button
                          key={tabPanelId}
                          draggable
                          onDragStart={(event) => {
                            event.dataTransfer.setData('imagelab/panel-tab', tabPanelId)
                            setDraggingPanelId(tabPanelId)
                          }}
                          onDragEnd={() => {
                            setDockDropTarget(null)
                            setDraggingPanelId(null)
                          }}
                          onDragOver={(event) => {
                            event.preventDefault()
                            event.stopPropagation()
                            event.dataTransfer.dropEffect = 'move'
                          }}
                          onDrop={(event) => {
                            event.preventDefault()
                            event.stopPropagation()
                            const dragPanelId = draggingPanelId ?? (event.dataTransfer.getData('imagelab/panel-tab') as PanelId)
                            if (!dragPanelId || dragPanelId === tabPanelId) return
                            setDockDropTarget(null)
                            setDraggingPanelId(null)
                            reorderPanelTabs(dragPanelId, tabPanelId)
                          }}
                          onClick={() => focusPanelInGroup(tabPanelId)}
                          className={`shrink-0 rounded border px-2 py-[2px] text-[11px] ${
                            tabPanelId === activePanelInGroup
                              ? 'border-cyan-500 bg-cyan-950/40 text-cyan-200'
                              : 'border-slate-700 text-slate-300 hover:bg-slate-800'
                          }`}
                        >
                          {PANEL_TITLES[tabPanelId]}
                        </button>
                      ))}
                    </div>
                    <button
                      className="rounded border border-slate-700 px-2 py-[2px] hover:bg-slate-800"
                      onClick={() => popoutPanel(activePanelInGroup)}
                    >
                      Pop Out
                    </button>
                  </div>
                  <div className="min-h-0 flex-1 overflow-auto">
                    {renderPanel(project, selectedLayer, activePanelInGroup, assets, history?.labels ?? [], updateProject, setWorkspace, togglePanelVisibility, popoutPanel, jumpToHistory, openLayerContextMenu, openTextEditorForLayer, moveLayerRelative, layerDragState, beginLayerDrag, hoverLayerDragTarget, clearLayerDrag, boxSelectedLayerIds, () => setBoxSelectedLayerIds([]), layerRename, startLayerRename, updateLayerRenameValue, commitLayerRename, canvasSelection, () => setCanvasSelection(null), cropToSelection)}
                  </div>
                  {dropMode === 'after' && (
                    <div className="pointer-events-none absolute bottom-0 left-0 right-0 z-10 h-1 rounded-b bg-cyan-300/30 shadow-[0_0_0_1px_rgba(34,211,238,0.2)]" />
                  )}
                  {index < dockGroups.length - 1 && (
                    <div
                      className="h-1 cursor-row-resize bg-slate-800 transition-colors hover:bg-cyan-500/70"
                      onPointerDown={(event) => startDockResize(leadPanelId, event)}
                    />
                  )}
                </div>
              )})}
            </div>
        </aside>
      </div>

      {workspace.floatingPanels.map((floating) => (
        <FloatingPanel key={floating.id} panelId={floating.panelId} x={floating.x} y={floating.y} width={floating.width} height={floating.height} z={floating.z} onMove={(patch) => moveFloatingPanel(floating.id, patch)} onDock={() => redockPanel(floating.id)}>
          {renderPanel(project, selectedLayer, floating.panelId, assets, history?.labels ?? [], updateProject, setWorkspace, togglePanelVisibility, popoutPanel, jumpToHistory, openLayerContextMenu, openTextEditorForLayer, moveLayerRelative, layerDragState, beginLayerDrag, hoverLayerDragTarget, clearLayerDrag, boxSelectedLayerIds, () => setBoxSelectedLayerIds([]), layerRename, startLayerRename, updateLayerRenameValue, commitLayerRename, canvasSelection, () => setCanvasSelection(null), cropToSelection)}
        </FloatingPanel>
      ))}

      {layerMenu && (
        <div
          ref={layerMenuRef}
          className="absolute z-[1600] w-40 rounded border border-slate-700 bg-slate-900 p-1 shadow-xl"
          style={{ left: layerMenu.x, top: layerMenu.y }}
          onMouseDown={(event) => event.stopPropagation()}
          onContextMenu={(event) => event.preventDefault()}
        >
          <button
            className={`w-full rounded px-2 py-1 text-left text-xs ${
              !menuLayer ? 'cursor-not-allowed text-slate-500' : 'text-slate-200 hover:bg-slate-800'
            }`}
            disabled={!menuLayer}
            onClick={() => {
              if (!menuLayer) return
              startLayerRename(menuLayer)
              setLayerMenu(null)
            }}
          >
            Rename Layer
          </button>
          <button
            className={`w-full rounded px-2 py-1 text-left text-xs ${
              project.layers.length <= 1 || !menuLayer || menuLayer.locked || menuLayer.protected
                ? 'cursor-not-allowed text-slate-500'
                : 'text-red-300 hover:bg-slate-800'
            }`}
            disabled={project.layers.length <= 1 || !menuLayer || menuLayer.locked || menuLayer.protected}
            onClick={() => {
              deleteLayerById(layerMenu.layerId)
              setLayerMenu(null)
            }}
          >
            Delete Layer
          </button>
        </div>
      )}

      {shortcutsOpen && (
        <div className="absolute inset-0 z-[2000] flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-xl rounded border border-slate-600 bg-slate-900 p-4 text-sm">
            <div className="mb-2 flex items-center justify-between"><h2 className="font-semibold">Keyboard Shortcuts</h2><button className="rounded border border-slate-700 px-2 py-1 text-xs" onClick={() => setShortcutsOpen(false)}>Close</button></div>
            <div className="grid grid-cols-2 gap-2">
              <div>{modKey()}+N/O/S/E/W</div><div>File actions</div>
              <div>{modKey()}+Z / {isMac() ? 'Cmd+Shift+Z' : 'Ctrl+Y'}</div><div>Undo/Redo</div>
              <div>V H Z T U P C</div><div>Tools</div>
              <div>{modKey()}+0 / {modKey()}+1 / {modKey()} +/-</div><div>View controls</div>
            </div>
          </div>
        </div>
      )}

      <div className="flex h-7 items-center justify-between border-t border-slate-800 bg-slate-900 px-3 text-xs text-slate-300">
        <span className="inline-flex items-center gap-2">
          <button
            className="inline-flex h-5 w-5 items-center justify-center rounded border border-slate-700 text-slate-200 hover:bg-slate-800"
            onClick={() => setZoom(1)}
            title="Reset zoom to 100%"
            aria-label="Reset zoom to 100%"
          >
            <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M3 12a9 9 0 1 0 3-6.708" />
              <path d="M3 4v4h4" />
            </svg>
          </button>
          <span>Zoom {Math.round(project.view.zoom * 100)}%</span>
        </span>
        <span>{project.document.width} x {project.document.height}</span>
        <span>
          {project.activeTool === 'text' && !textEntry
            ? 'Text tool: click canvas to type'
            : cursor ? `X ${cursor.x.toFixed(0)}, Y ${cursor.y.toFixed(0)}` : 'X -, Y -'}
        </span>
      </div>

      {overlayVisible && (
        <StartOverlay
          canDismiss={hasOpenProjects}
          onRequestClose={() => setShowStartOverlay(false)}
        />
      )}
    </div>
  )
}

const renderPanel = (
  project: Project,
  selectedLayer: Layer | null,
  panelId: PanelId,
  assets: Record<string, AssetBlobRecord>,
  historyLabels: string[],
  updateProject: (projectId: string, recipe: (project: Project) => void, label?: string) => void,
  setWorkspace: (recipe: (workspace: WorkspacePrefs) => void) => void,
  togglePanelVisibility: (panelId: PanelId) => void,
  popoutPanel: (panelId: PanelId) => void,
  jumpToHistory: (projectId: string, index: number) => void,
  openLayerContextMenu: (layerId: string, event: ReactMouseEvent<HTMLButtonElement>) => void,
  openTextEditorForLayer: (layer: Layer) => void,
  moveLayerRelative: (dragLayerId: string, targetLayerId: string, position: 'before' | 'after') => void,
  layerDragState: { activeId: string; targetId: string | null; position: 'before' | 'after' } | null,
  beginLayerDrag: (layerId: string) => void,
  hoverLayerDragTarget: (layerId: string, position: 'before' | 'after') => void,
  clearLayerDrag: () => void,
  boxSelectedLayerIds: string[],
  clearBoxSelection: () => void,
  layerRename: { layerId: string; value: string } | null,
  startLayerRename: (layer: Layer) => void,
  updateLayerRenameValue: (value: string) => void,
  commitLayerRename: (cancel?: boolean) => void,
  canvasSelection: { left: number; top: number; right: number; bottom: number } | null,
  clearCanvasSelection: () => void,
  cropToSelection: () => void,
) => {
  if (panelId === 'layers') {
    return (
      <div className="space-y-1 p-2">
        {project.layers.map((layer) => (
          <div
            key={layer.id}
            className={`relative flex w-full items-center justify-between rounded border px-2 py-1.5 text-left text-xs ${
              layer.id === project.selectedLayerId || boxSelectedLayerIds.includes(layer.id) ? 'border-cyan-500 bg-cyan-950/40' : 'border-slate-700 bg-slate-900'
            } ${
              layerDragState?.targetId === layer.id && layerDragState.activeId !== layer.id ? 'ring-1 ring-cyan-400/80' : ''
            }`}
          >
            {layerDragState?.targetId === layer.id && layerDragState.activeId !== layer.id && layerDragState.position === 'before' && (
              <div className="pointer-events-none absolute -top-[1px] left-0 right-0 border-t-2 border-cyan-300/40" />
            )}
            {layerDragState?.targetId === layer.id && layerDragState.activeId !== layer.id && layerDragState.position === 'after' && (
              <div className="pointer-events-none absolute -bottom-[1px] left-0 right-0 border-b-2 border-cyan-300/40" />
            )}
            <button
              className="flex min-w-0 flex-1 items-center gap-2 text-left"
              draggable
              onDragStart={(event) => {
                event.dataTransfer.setData('imagelab/layer', layer.id)
                event.dataTransfer.effectAllowed = 'move'
                beginLayerDrag(layer.id)
              }}
              onDragEnd={() => clearLayerDrag()}
              onDragEnter={(event) => {
                const rect = event.currentTarget.getBoundingClientRect()
                const position = event.clientY < rect.top + rect.height / 2 ? 'before' : 'after'
                hoverLayerDragTarget(layer.id, position)
              }}
              onDragOver={(event) => {
                event.preventDefault()
                event.dataTransfer.dropEffect = 'move'
                const rect = event.currentTarget.getBoundingClientRect()
                const position = event.clientY < rect.top + rect.height / 2 ? 'before' : 'after'
                hoverLayerDragTarget(layer.id, position)
              }}
              onDrop={(event) => {
                event.preventDefault()
                const dragLayerId = event.dataTransfer.getData('imagelab/layer')
                if (!dragLayerId) return
                const rect = event.currentTarget.getBoundingClientRect()
                const position = event.clientY < rect.top + rect.height / 2 ? 'before' : 'after'
                moveLayerRelative(dragLayerId, layer.id, position)
                clearLayerDrag()
              }}
              onClick={() => {
                clearBoxSelection()
                updateProject(project.id, (c) => { c.selectedLayerId = layer.id }, 'Select layer')
              }}
              onContextMenu={(event) => openLayerContextMenu(layer.id, event)}
              onDoubleClick={() => openTextEditorForLayer(layer)}
            >
              <LayerListThumb layer={layer} asset={assets[(layer as { assetId?: string }).assetId ?? '']} />
              <span className="min-w-0 flex-1">
              {layerRename?.layerId === layer.id ? (
                <input
                  autoFocus
                  className="w-full min-w-0 rounded border border-slate-600 bg-slate-950 px-1 py-0.5 text-xs text-slate-100 outline-none"
                  value={layerRename.value}
                  onClick={(event) => event.stopPropagation()}
                  onChange={(event) => updateLayerRenameValue(event.target.value)}
                  onFocus={(event) => event.currentTarget.select()}
                  onBlur={() => commitLayerRename(false)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.preventDefault()
                      commitLayerRename(false)
                    }
                    if (event.key === 'Escape') {
                      event.preventDefault()
                      commitLayerRename(true)
                    }
                  }}
                />
              ) : (
                <span
                  className="truncate"
                  onDoubleClick={(event) => {
                    event.stopPropagation()
                    startLayerRename(layer)
                  }}
                >
                  {layer.name}
                </span>
              )}
                <span className="block text-[10px] text-slate-400">{layer.kind}</span>
              </span>
            </button>
            <button
              className={`ml-2 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded border ${
                layer.locked ? 'border-amber-500 text-amber-300' : 'border-slate-700 text-slate-400 hover:bg-slate-800'
              }`}
              title={layer.locked ? 'Unlock layer' : 'Lock layer'}
              aria-label={layer.locked ? 'Unlock layer' : 'Lock layer'}
              onClick={(event) => {
                event.stopPropagation()
                updateProject(project.id, (c) => {
                  const target = c.layers.find((x) => x.id === layer.id)
                  if (!target) return
                  target.locked = !target.locked
                }, layer.locked ? 'Unlock layer' : 'Lock layer')
              }}
            >
              {layer.locked ? (
                <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <rect x="5" y="11" width="14" height="10" rx="2" />
                  <path d="M8 11V8a4 4 0 0 1 8 0v3" />
                </svg>
              ) : (
                <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <rect x="5" y="11" width="14" height="10" rx="2" />
                  <path d="M16 11V8a4 4 0 0 0-7.5-2" />
                </svg>
              )}
            </button>
          </div>
        ))}
      </div>
    )
  }
  if (panelId === 'properties') {
    if (!selectedLayer) return <div className="p-3 text-sm text-slate-400">Select a layer.</div>
    return (
      <div className="grid gap-2 p-3 text-xs">
        {canvasSelection && (
          <div className="rounded border border-cyan-500/50 bg-cyan-950/20 p-2">
            <div className="mb-1 text-[11px] font-medium text-cyan-200">Selection</div>
            <div className="grid grid-cols-2 gap-1 text-[11px] text-slate-200">
              <div>X: {Math.round(canvasSelection.left)}</div>
              <div>Y: {Math.round(canvasSelection.top)}</div>
              <div>W: {Math.round(canvasSelection.right - canvasSelection.left)}</div>
              <div>H: {Math.round(canvasSelection.bottom - canvasSelection.top)}</div>
            </div>
            <div className="mt-2 flex gap-1">
              <button className="rounded border border-slate-600 px-2 py-1 text-[11px] hover:bg-slate-800" onClick={clearCanvasSelection}>
                Clear
              </button>
              <button className="rounded border border-cyan-500 px-2 py-1 text-[11px] text-cyan-200 hover:bg-cyan-900/40" onClick={cropToSelection}>
                Crop
              </button>
            </div>
          </div>
        )}
        <label>
          Name
          <input
            className="mt-1 w-full rounded border border-slate-700 bg-slate-950 px-2 py-1"
            value={selectedLayer.name}
            onChange={(e) =>
              updateProject(project.id, (c) => {
                const l = c.layers.find((x) => x.id === selectedLayer.id)
                if (l) l.name = e.target.value
              }, 'Rename')
            }
          />
        </label>
        <div className="grid grid-cols-2 gap-2">
          <label>
            X
            <input
              type="number"
              className="mt-1 w-full rounded border border-slate-700 bg-slate-950 px-2 py-1"
              value={selectedLayer.x}
              onChange={(e) =>
                updateProject(project.id, (c) => {
                  const l = c.layers.find((x) => x.id === selectedLayer.id)
                  if (l) l.x = Number(e.target.value)
                }, 'X')
              }
            />
          </label>
          <label>
            Y
            <input
              type="number"
              className="mt-1 w-full rounded border border-slate-700 bg-slate-950 px-2 py-1"
              value={selectedLayer.y}
              onChange={(e) =>
                updateProject(project.id, (c) => {
                  const l = c.layers.find((x) => x.id === selectedLayer.id)
                  if (l) l.y = Number(e.target.value)
                }, 'Y')
              }
            />
          </label>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <label>
            Scale X
            <input
              type="number"
              step={0.1}
              className="mt-1 w-full rounded border border-slate-700 bg-slate-950 px-2 py-1"
              value={selectedLayer.scaleX}
              onChange={(e) =>
                updateProject(project.id, (c) => {
                  const l = c.layers.find((x) => x.id === selectedLayer.id)
                  if (l) l.scaleX = Number(e.target.value)
                }, 'ScaleX')
              }
            />
          </label>
          <label>
            Scale Y
            <input
              type="number"
              step={0.1}
              className="mt-1 w-full rounded border border-slate-700 bg-slate-950 px-2 py-1"
              value={selectedLayer.scaleY}
              onChange={(e) =>
                updateProject(project.id, (c) => {
                  const l = c.layers.find((x) => x.id === selectedLayer.id)
                  if (l) l.scaleY = Number(e.target.value)
                }, 'ScaleY')
              }
            />
          </label>
        </div>
        <label>
          Rotation
          <input
            type="number"
            className="mt-1 w-full rounded border border-slate-700 bg-slate-950 px-2 py-1"
            value={selectedLayer.rotation}
            onChange={(e) =>
              updateProject(project.id, (c) => {
                const l = c.layers.find((x) => x.id === selectedLayer.id)
                if (l) l.rotation = Number(e.target.value)
              }, 'Rotate')
            }
          />
        </label>
      </div>
    )
  }
  if (panelId === 'assets') {
    return (
      <div className="p-2 text-xs">
        <div className="mb-2 text-slate-400">Drag assets onto canvas to create layers.</div>
        <div className="grid grid-cols-2 gap-2">
          {Object.values(assets).map((asset) => (
            <div
              key={asset.id}
              draggable
              onDragStart={(e) => e.dataTransfer.setData('imagelab/asset', asset.id)}
              className="rounded border border-slate-700 bg-slate-900 p-1"
            >
              <AssetThumb asset={asset} />
              <div className="mt-1 truncate">{asset.name}</div>
            </div>
          ))}
        </div>
      </div>
    )
  }
  if (panelId === 'swatches') {
    return (
      <div className="space-y-2 p-2">
        <button
          className="w-full rounded border border-slate-700 px-2 py-1 text-xs hover:bg-slate-800"
          onClick={() => setWorkspace((w) => { w.swatches.push({ id: uid('sw'), name: 'New', type: 'solid', value: '#22c55e' }) })}
        >
          Add swatch
        </button>
        <button
          className="w-full rounded border border-slate-700 px-2 py-1 text-xs hover:bg-slate-800"
          onClick={() => { togglePanelVisibility('swatches'); popoutPanel('swatches') }}
        >
          Pop out swatches
        </button>
      </div>
    )
  }
  return (
    <div className="space-y-1 p-2">
      {historyLabels.map((label, index) => (
        <button
          key={`${label}_${index}`}
          className="w-full rounded border border-slate-700 bg-slate-900 px-2 py-1 text-left text-xs hover:border-slate-500"
          onClick={() => jumpToHistory(project.id, index)}
        >
          {label}
        </button>
      ))}
    </div>
  )
}

const FloatingPanel = ({
  panelId, x, y, width, height, z, onMove, onDock, children,
}: {
  panelId: PanelId
  x: number
  y: number
  width: number
  height: number
  z: number
  onMove: (patch: { x?: number; y?: number; width?: number; height?: number; z?: number }) => void
  onDock: () => void
  children: ReactNode
}) => {
  const dragRef = useRef<{ mode: 'move' | 'resize'; id: number; x: number; y: number; bx: number; by: number; bw: number; bh: number } | null>(null)

  const startFloatingMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    dragRef.current = { mode: 'move', id: event.pointerId, x: event.clientX, y: event.clientY, bx: x, by: y, bw: width, bh: height }
  }

  const startFloatingResize = (event: ReactPointerEvent<HTMLDivElement>) => {
    dragRef.current = { mode: 'resize', id: event.pointerId, x: event.clientX, y: event.clientY, bx: x, by: y, bw: width, bh: height }
  }

  useEffect(() => {
    const move = (event: PointerEvent) => {
      const drag = dragRef.current
      if (!drag || event.pointerId !== drag.id) return
      const dx = event.clientX - drag.x
      const dy = event.clientY - drag.y
      if (drag.mode === 'move') onMove({ x: Math.max(0, drag.bx + dx), y: Math.max(0, drag.by + dy), z: 999 })
      else onMove({ width: Math.max(240, drag.bw + dx), height: Math.max(160, drag.bh + dy) })
    }
    const up = (event: PointerEvent) => {
      if (dragRef.current?.id === event.pointerId) dragRef.current = null
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    return () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
    }
  }, [onMove])
  return (
    <div className="absolute rounded border border-slate-700 bg-slate-900 shadow-xl" style={{ left: x, top: y, width, height, zIndex: z }}>
      <div className="flex cursor-move items-center justify-between border-b border-slate-700 px-2 py-1 text-xs" onPointerDown={startFloatingMove}>
        <span>{PANEL_TITLES[panelId]}</span>
        <button className="rounded border border-slate-700 px-1 py-[1px]" onClick={onDock}>Dock</button>
      </div>
      <div className="h-[calc(100%-26px)] overflow-auto">{children}</div>
      <div className="absolute bottom-0 right-0 h-3 w-3 cursor-se-resize bg-slate-600" onPointerDown={startFloatingResize} />
    </div>
  )
}

const LayerListThumb = ({ layer, asset }: { layer: Layer; asset: AssetBlobRecord | undefined }) => {
  const src = useMemo(() => {
    if (!('assetId' in layer)) return ''
    if (asset?.kind === 'svg') {
      return `data:image/svg+xml;utf8,${encodeURIComponent(asset.svgText ?? '<svg />')}`
    }
    if (asset?.blob) return URL.createObjectURL(asset.blob)
    return ''
  }, [layer, asset])

  useEffect(() => {
    if ('assetId' in layer && asset?.kind === 'raster' && src) {
      return () => URL.revokeObjectURL(src)
    }
    return undefined
  }, [layer, asset, src])

  return (
    <span
      className="relative h-8 w-12 shrink-0 overflow-hidden rounded border border-slate-600"
      style={{
        backgroundColor: '#ffffff',
        backgroundImage: `
          linear-gradient(45deg, #cbd5e1 25%, transparent 25%),
          linear-gradient(-45deg, #cbd5e1 25%, transparent 25%),
          linear-gradient(45deg, transparent 75%, #cbd5e1 75%),
          linear-gradient(-45deg, transparent 75%, #cbd5e1 75%)
        `,
        backgroundSize: '8px 8px',
        backgroundPosition: '0 0, 0 4px, 4px -4px, -4px 0px',
      }}
    >
      {(layer.kind === 'raster-image' || layer.kind === 'vector-reference') && src && (
        <img src={src} alt="" aria-hidden="true" className="h-full w-full object-cover" />
      )}
      {layer.kind === 'vector-rect' && (
        <span
          className="absolute inset-0"
          style={{
            background: layer.fill,
            border: `${Math.min(2, layer.strokeWidth)}px solid ${layer.stroke}`,
          }}
        />
      )}
      {layer.kind === 'vector-ellipse' && (
        <span
          className="absolute left-[15%] top-[12%] h-[76%] w-[70%] rounded-full"
          style={{
            background: layer.fill,
            border: `${Math.min(2, layer.strokeWidth)}px solid ${layer.stroke}`,
          }}
        />
      )}
      {(layer.kind === 'vector-text' || layer.kind === 'raster-text') && (
        <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold" style={{ color: layer.fill }}>
          T
        </span>
      )}
      {layer.kind === 'vector-path' && (
        <svg viewBox="0 0 48 32" className="absolute inset-0 h-full w-full">
          <path d="M4 24 C 12 8, 28 8, 44 20" fill={layer.fill} stroke={layer.stroke} strokeWidth={Math.min(2, layer.strokeWidth || 1)} />
        </svg>
      )}
    </span>
  )
}

const AssetThumb = ({ asset }: { asset: AssetBlobRecord }) => {
  const src = useMemo(() => {
    if (asset.kind === 'svg') {
      return `data:image/svg+xml;utf8,${encodeURIComponent(asset.svgText ?? '<svg />')}`
    }
    if (asset.blob) {
      return URL.createObjectURL(asset.blob)
    }
    return ''
  }, [asset.kind, asset.svgText, asset.blob])
  useEffect(() => {
    if (asset.kind === 'raster' && src) {
      return () => URL.revokeObjectURL(src)
    }
    return undefined
  }, [asset.kind, src])
  return <img src={src} alt={asset.name} className="h-20 w-full rounded bg-slate-950 object-contain" />
}

const LayerRaster = ({ layer, asset }: { layer: Layer; asset: AssetBlobRecord | undefined }) => {
  const src = useMemo(() => {
    if (!('assetId' in layer)) return ''
    if (asset?.kind === 'svg') {
      return `data:image/svg+xml;utf8,${encodeURIComponent(asset.svgText ?? '<svg />')}`
    }
    if (asset?.blob) {
      return URL.createObjectURL(asset.blob)
    }
    return ''
  }, [layer, asset])
  useEffect(() => {
    if ('assetId' in layer && asset?.kind === 'raster' && src) {
      return () => URL.revokeObjectURL(src)
    }
    return undefined
  }, [layer, asset, src])
  const style: CSSProperties = {
    position: 'absolute',
    left: layer.x,
    top: layer.y,
    opacity: layer.opacity,
    transform: `rotate(${layer.rotation}deg) scale(${layer.scaleX}, ${layer.scaleY})`,
    transformOrigin: 'top left',
    pointerEvents: 'none',
  }

  if (layer.kind === 'raster-text' || layer.kind === 'vector-text') {
    return <div style={{ ...style, color: layer.fill, fontSize: layer.fontSize }}>{layer.text}</div>
  }

  if (layer.kind === 'vector-rect') {
    const segments = layer.segments ?? [{ x: 0, y: 0, width: layer.width, height: layer.height }]
    if (segments.length === 0) return null
    if (segments.length === 1 && segments[0].x === 0 && segments[0].y === 0 && segments[0].width === layer.width && segments[0].height === layer.height) {
      return (
        <div
          style={{
            ...style,
            width: layer.width,
            height: layer.height,
            background: layer.fill,
            border: `${layer.strokeWidth}px solid ${layer.stroke}`,
          }}
        />
      )
    }
    return (
      <div
        style={{
          ...style,
          width: layer.width,
          height: layer.height,
          position: 'absolute',
        }}
      >
        {segments.map((segment, index) => (
          <div
            key={`${layer.id}_segment_${index}`}
            style={{
              position: 'absolute',
              left: segment.x,
              top: segment.y,
              width: segment.width,
              height: segment.height,
              background: layer.fill,
            }}
          />
        ))}
      </div>
    )
  }

  if (layer.kind === 'vector-ellipse') {
    return (
      <div
        style={{
          ...style,
          width: layer.radiusX * 2,
          height: layer.radiusY * 2,
          borderRadius: 9999,
          background: layer.fill,
          border: `${layer.strokeWidth}px solid ${layer.stroke}`,
        }}
      />
    )
  }

  if ((layer.kind === 'raster-image' || layer.kind === 'vector-reference') && src) {
    return <img src={src} alt={layer.name} style={{ ...style, width: layer.width, height: layer.height }} />
  }

  return null
}

const LayerVector = ({ layer, asset }: { layer: Layer; asset: AssetBlobRecord | undefined }) => {
  if (layer.kind === 'vector-rect') {
    const segments = layer.segments ?? [{ x: 0, y: 0, width: layer.width, height: layer.height }]
    if (segments.length === 0) return null
    return (
      <g transform={`translate(${layer.x},${layer.y}) rotate(${layer.rotation}) scale(${layer.scaleX},${layer.scaleY})`} opacity={layer.opacity}>
        {segments.length === 1 && segments[0].x === 0 && segments[0].y === 0 && segments[0].width === layer.width && segments[0].height === layer.height ? (
          <rect width={layer.width} height={layer.height} fill={layer.fill} stroke={layer.stroke} strokeWidth={layer.strokeWidth} />
        ) : (
          segments.map((segment, index) => (
            <rect
              key={`${layer.id}_segment_${index}`}
              x={segment.x}
              y={segment.y}
              width={segment.width}
              height={segment.height}
              fill={layer.fill}
            />
          ))
        )}
      </g>
    )
  }

  if (layer.kind === 'vector-ellipse') {
    return (
      <g transform={`translate(${layer.x},${layer.y}) rotate(${layer.rotation}) scale(${layer.scaleX},${layer.scaleY})`} opacity={layer.opacity}>
        <ellipse cx={layer.radiusX} cy={layer.radiusY} rx={layer.radiusX} ry={layer.radiusY} fill={layer.fill} stroke={layer.stroke} strokeWidth={layer.strokeWidth} />
      </g>
    )
  }

  if (layer.kind === 'vector-text') {
    return (
      <g transform={`translate(${layer.x},${layer.y}) rotate(${layer.rotation}) scale(${layer.scaleX},${layer.scaleY})`} opacity={layer.opacity}>
        <text x={0} y={0} fill={layer.fill} fontSize={layer.fontSize}>
          {layer.text}
        </text>
      </g>
    )
  }

  if (layer.kind === 'vector-path' && layer.points.length > 1) {
    const d = layer.points.map((p, i, list) => i === 0 ? `M ${p.anchor.x} ${p.anchor.y}` : `C ${list[i - 1].outHandle.x} ${list[i - 1].outHandle.y}, ${p.inHandle.x} ${p.inHandle.y}, ${p.anchor.x} ${p.anchor.y}`).join(' ')
    return (
      <g transform={`translate(${layer.x},${layer.y}) rotate(${layer.rotation}) scale(${layer.scaleX},${layer.scaleY})`} opacity={layer.opacity}>
        <path d={`${d}${layer.closed ? ' Z' : ''}`} fill={layer.fill} stroke={layer.stroke} strokeWidth={layer.strokeWidth} />
      </g>
    )
  }

  if (layer.kind === 'vector-reference') {
    if (asset?.kind === 'svg') {
      return (
        <g opacity={layer.opacity} transform={`translate(${layer.x},${layer.y}) rotate(${layer.rotation}) scale(${layer.scaleX},${layer.scaleY})`}>
          <image href={`data:image/svg+xml;utf8,${encodeURIComponent(asset.svgText ?? '<svg />')}`} width={layer.width} height={layer.height} />
        </g>
      )
    }
    return <RasterRef layer={layer} asset={asset} />
  }

  return null
}

const RasterRef = ({ layer, asset }: { layer: Extract<Layer, { kind: 'vector-reference' }>; asset: AssetBlobRecord | undefined }) => {
  const href = asset?.blob ? URL.createObjectURL(asset.blob) : ''
  useEffect(() => {
    if (!href) return undefined
    return () => URL.revokeObjectURL(href)
  }, [href])

  if (!href) return null

  return (
    <g opacity={layer.opacity} transform={`translate(${layer.x},${layer.y}) rotate(${layer.rotation}) scale(${layer.scaleX},${layer.scaleY})`}>
      <image href={href} width={layer.width} height={layer.height} />
    </g>
  )
}
