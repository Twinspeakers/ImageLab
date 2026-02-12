import { DragEvent, MouseEvent as ReactMouseEvent, PointerEvent as ReactPointerEvent, WheelEvent, useEffect, useMemo, useRef, useState } from 'react'
import { clamp, isMac, modKey, uid, loadImage, toDataUrl } from '../../lib/utils'
import { useAppStore } from '../../store/useAppStore'
import { StartOverlay } from '../../components/StartOverlay'
import { DEFAULT_DOCK_PANEL_HEIGHTS, DEFAULT_MENU_ORDER, PANEL_TITLES, toolList } from './constants'
import { DockedPanelsColumn } from './components/DockedPanelsColumn'
import { ColorPickerPanel } from './components/ColorPickerPanel'
import { DetachedProjectWindow } from './components/DetachedProjectWindow'
import { EditorStage } from './components/EditorStage'
import { EmptyWorkspace } from './components/EmptyWorkspace'
import { FloatingPanel } from './components/FloatingPanel'
import { LayerContextMenu } from './components/LayerContextMenu'
import { ProjectTabsBar } from './components/ProjectTabsBar'
import { ShortcutsModal } from './components/ShortcutsModal'
import { StatusBar } from './components/StatusBar'
import { TopMenuBar } from './components/TopMenuBar'
import { ToolRail } from './components/ToolRail'
import { AssetsPanel } from './panels/AssetsPanel'
import { HistoryPanel } from './panels/HistoryPanel'
import { LayersPanel } from './panels/LayersPanel'
import { PropertiesPanel } from './panels/PropertiesPanel'
import { SwatchesPanel } from './panels/SwatchesPanel'
import { LayerRaster } from './renderers/LayerRaster'
import { LayerVector } from './renderers/LayerVector'
import { useLayerDrag } from './hooks/useLayerDrag'
import { useEditorActions } from './hooks/useEditorActions'
import { useDockLayout } from './hooks/useDockLayout'
import { useEditorPointerHandlers } from './hooks/useEditorPointerHandlers'
import { useEditorShortcuts } from './hooks/useEditorShortcuts'
import { useCreationActions } from './hooks/useCreationActions'
import { useLayerRename } from './hooks/useLayerRename'
import { useSelectionState } from './hooks/useSelectionState'
import { useTextEntry } from './hooks/useTextEntry'
import { buildMenuModel } from './menu/buildMenuModel'
import {
  addLayerFromAsset,
  docPoint,
  documentBackdropStyle,
  downloadBlob,
  normalizeDockGroups,
} from './utils/editorHelpers'
import type { AssetBlobRecord, Layer, PanelId, PathPoint, Project, ToolId } from '../../types'

export const EditorPage = () => {
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
  const [marquee, setMarquee] = useState<{ pointerId: number; start: { x: number; y: number }; current: { x: number; y: number } } | null>(null)
  const [boxSelectedLayerIds, setBoxSelectedLayerIds] = useState<string[]>([])
  const [foregroundColor, setForegroundColor] = useState('#000000')
  const [backgroundColor, setBackgroundColor] = useState('#ffffff')
  const [activeColorTarget, setActiveColorTarget] = useState<'foreground' | 'background' | null>(null)
  const [colorPanelPos, setColorPanelPos] = useState({ x: 84, y: 96 })
  const [detachedWindows, setDetachedWindows] = useState<Array<{ id: string; projectId: string; x: number; y: number; width: number; height: number; z: number }>>([])
  const [isProjectDockTargetActive, setIsProjectDockTargetActive] = useState(false)
  const tabsBarRef = useRef<HTMLDivElement | null>(null)
  const windowHostRef = useRef<HTMLDivElement | null>(null)
  const detachedDragRef = useRef<{ id: string; projectId: string; mode: 'move' | 'resize'; pointerId: number; startX: number; startY: number; baseX: number; baseY: number; baseW: number; baseH: number } | null>(null)
  const assetMap = useMemo(() => new Map(Object.values(assets).map((asset) => [asset.id, asset])), [assets])
  const { layerDragState, moveLayerRelative, beginLayerDrag, hoverLayerDragTarget, clearLayerDrag } = useLayerDrag({
    project,
    updateProject,
  })
  const { textEntry, textEntryInputRef, beginTextEntry: beginTextLayerSession, updateTextEntryValue, finishTextEntry, openTextEditorForLayer, findEditingTextLayer } = useTextEntry({
    project,
    updateProject,
  })
  const { layerRename, startLayerRename, updateLayerRenameValue, commitLayerRename } = useLayerRename({
    project,
    updateProject,
    onStartRename: () => setLayerMenu(null),
  })
  const {
    areaSelection,
    setAreaSelection,
    canvasSelection,
    setCanvasSelection,
    canvasSelectionMove,
    setCanvasSelectionMove,
    areaMove,
    setAreaMove,
    clearSelection,
    selectAllCanvas,
    deleteSelectedArea,
    cropToSelection,
    shouldDeleteArea,
  } = useSelectionState({
    project,
    selectedLayer,
    updateProject,
  })
  const { setZoom, fitToScreen, deleteLayer, deleteLayerById, duplicateLayer, pasteLayer, onExport } = useEditorActions({
    project,
    selectedLayer,
    boxSelectedLayerIds,
    clipboard,
    assetMap,
    avifSupported,
    updateProject,
    setBoxSelectedLayerIds,
  })
  const { beginTextEntry, commitPen } = useCreationActions({
    project,
    penDraft,
    foregroundColor,
    updateProject,
    beginTextLayerSession,
    setPenDraft: (next) => setPenDraft(next),
  })
  const { onStagePointerDown, onStagePointerMove, onStagePointerUp, onDocumentPointerDown } = useEditorPointerHandlers({
    project,
    selectedLayer,
    isSpace,
    textEntry,
    penDraft,
    zoomScrub,
    panDrag,
    moveLayer,
    marquee,
    canvasSelection,
    canvasSelectionMove,
    areaSelection,
    areaMove,
    updateProject,
    setZoom,
    beginTextEntry,
    finishTextEntry,
    setCursor,
    setZoomScrub,
    setPanDrag,
    setMoveLayer,
    setMarquee,
    setCanvasSelection,
    setCanvasSelectionMove,
    setAreaSelection,
    setAreaMove,
    setBoxSelectedLayerIds,
    setPenDraft,
  })
  const {
    dockDropTarget,
    setDockDropTarget,
    draggingPanelId,
    setDraggingPanelId,
    getDockPanelHeight,
    resolveDockDropMode,
    placePanelInGroup,
    reorderPanelTabs,
    focusPanelInGroup,
    startDockResize,
  } = useDockLayout({
    workspace,
    dockGroups,
    setWorkspace,
  })

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

  const revealProjectIfNeeded = (projectId: string) => {
    const currentProject = projects[projectId]
    if (!currentProject) return
    const stage = document.getElementById('editor-stage') as HTMLDivElement | null
    if (!stage) return
    const rect = stage.getBoundingClientRect()
    const zoom = currentProject.view.zoom
    const docWidth = currentProject.document.width * zoom
    const docHeight = currentProject.document.height * zoom
    const left = currentProject.view.panX
    const top = currentProject.view.panY
    const right = left + docWidth
    const bottom = top + docHeight
    const intersectsStage =
      Number.isFinite(zoom) &&
      zoom > 0 &&
      right > 0 &&
      bottom > 0 &&
      left < rect.width &&
      top < rect.height
    if (intersectsStage) return
    updateProject(projectId, (current) => {
      const fitZoom = Math.min((rect.width - 100) / current.document.width, (rect.height - 100) / current.document.height)
      current.view.zoom = clamp(fitZoom, 0.1, 8)
      current.view.panX = (rect.width - current.document.width * current.view.zoom) / 2
      current.view.panY = (rect.height - current.document.height * current.view.zoom) / 2
    }, 'Pan')
  }

  const dockProjectWindow = (projectId: string) => {
    setDetachedWindows((current) => current.filter((item) => item.projectId !== projectId))
    setActiveProject(projectId)
    window.requestAnimationFrame(() => revealProjectIfNeeded(projectId))
  }

  useEffect(() => {
    const onPointerMove = (event: PointerEvent) => {
      const drag = detachedDragRef.current
      if (!drag || drag.pointerId !== event.pointerId) return
      const dx = event.clientX - drag.startX
      const dy = event.clientY - drag.startY
      if (drag.mode === 'move') {
        const tabsRect = tabsBarRef.current?.getBoundingClientRect()
        const hostRect = windowHostRef.current?.getBoundingClientRect()
        const dockRect = tabsRect ?? (hostRect
          ? { left: hostRect.left, right: hostRect.right, top: hostRect.top, bottom: hostRect.top + 36 }
          : null)
        const isOverDockTarget = Boolean(
          dockRect &&
          event.clientX >= dockRect.left &&
          event.clientX <= dockRect.right &&
          event.clientY >= dockRect.top &&
          event.clientY <= dockRect.bottom,
        )
        setIsProjectDockTargetActive((current) => (current === isOverDockTarget ? current : isOverDockTarget))
      }
      setDetachedWindows((current) => current.map((windowItem) => {
        if (windowItem.id !== drag.id) return windowItem
        if (drag.mode === 'move') {
          return { ...windowItem, x: Math.max(0, drag.baseX + dx), y: Math.max(0, drag.baseY + dy), z: 1000 }
        }
        return { ...windowItem, width: Math.max(260, drag.baseW + dx), height: Math.max(200, drag.baseH + dy), z: 1000 }
      }))
    }
    const onPointerUp = (event: PointerEvent) => {
      const drag = detachedDragRef.current
      if (!drag || drag.pointerId !== event.pointerId) return
      if (drag.mode === 'move') {
        const tabsRect = tabsBarRef.current?.getBoundingClientRect()
        const hostRect = windowHostRef.current?.getBoundingClientRect()
        const dockRect = tabsRect ?? (hostRect
          ? { left: hostRect.left, right: hostRect.right, top: hostRect.top, bottom: hostRect.top + 36 }
          : null)
        const dx = event.clientX - drag.startX
        const dy = event.clientY - drag.startY
        const nextX = Math.max(0, drag.baseX + dx)
        const nextY = Math.max(0, drag.baseY + dy)
        const hostLeft = hostRect?.left ?? 0
        const hostTop = hostRect?.top ?? 0
        const windowRect = {
          left: hostLeft + nextX,
          top: hostTop + nextY,
          right: hostLeft + nextX + drag.baseW,
          bottom: hostTop + nextY + drag.baseH,
        }
        const overlapsTabs = Boolean(
          dockRect &&
          windowRect.left < dockRect.right &&
          windowRect.right > dockRect.left &&
          windowRect.top < dockRect.bottom &&
          windowRect.bottom > dockRect.top,
        )
        if (
          dockRect &&
          event.clientX >= dockRect.left &&
          event.clientX <= dockRect.right &&
          event.clientY >= dockRect.top &&
          event.clientY <= dockRect.bottom
        ) {
          dockProjectWindow(drag.projectId)
        } else if (overlapsTabs) {
          dockProjectWindow(drag.projectId)
        }
      }
      setIsProjectDockTargetActive(false)
      detachedDragRef.current = null
    }
    window.addEventListener('pointermove', onPointerMove)
    window.addEventListener('pointerup', onPointerUp)
    return () => {
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('pointerup', onPointerUp)
    }
  }, [])

  useEffect(() => {
    setDetachedWindows((current) => current.filter((item) => openProjectIds.includes(item.projectId)))
  }, [openProjectIds])

  useEffect(() => {
    if (!project) return
    const frame = window.requestAnimationFrame(() => revealProjectIfNeeded(project.id))
    return () => window.cancelAnimationFrame(frame)
  }, [project?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  useEditorShortcuts({
    project,
    tools,
    selectedLayer,
    penDraft,
    isSpace,
    preSpaceTool,
    areaSelection,
    canvasSelection,
    shouldDeleteArea,
    hasTextEntry: Boolean(textEntry),
    updateProject,
    setIsSpace,
    setPreSpaceTool,
    setShowStartOverlay,
    setShortcutsOpen,
    setClipboard,
    closeProjectTab,
    importIlp,
    undo,
    redo,
    clearSelection,
    selectAllCanvas,
    duplicateLayer,
    deleteLayer,
    cropToSelection,
    pasteLayer,
    deleteSelectedArea,
    onApplyForegroundFill: () => applyFillToSelectedLayer(foregroundColor),
    onApplyBackgroundFill: () => applyFillToSelectedLayer(backgroundColor),
    fitToScreen,
    setZoom,
    onExport,
    commitPen,
  })

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
    const detachedProjectId = event.dataTransfer.getData('imagelab/project-tab')
    if (detachedProjectId) {
      detachProjectWindow(detachedProjectId, event.clientX, event.clientY)
      return
    }
    if (!project) return
    const id = event.dataTransfer.getData('imagelab/asset')
    const asset = assets[id]
    if (!asset) return
    const p = docPoint(event, event.currentTarget, project)
    void addLayerFromAsset(project, asset, p, workspace.rasterizeScale, updateProject, { loadImage, toDataUrl, uid })
  }

  const detachProjectWindow = (projectId: string, clientX: number, clientY: number) => {
    const hostRect = windowHostRef.current?.getBoundingClientRect()
    const localX = hostRect ? clientX - hostRect.left : clientX
    const localY = hostRect ? clientY - hostRect.top : clientY
    const nextX = Math.max(0, localX - 180)
    const nextY = Math.max(0, localY - 60)
    setDetachedWindows((current) => {
      const existing = current.find((item) => item.projectId === projectId)
      if (existing) {
        return current.map((item) => item.projectId === projectId
          ? { ...item, x: nextX, y: nextY, z: 1000 }
          : item)
      }
      return [
        ...current,
        {
          id: uid('dw'),
          projectId,
          x: nextX,
          y: nextY,
          width: 460,
          height: 340,
          z: 1000,
        },
      ]
    })
    if (project?.id === projectId) {
      const nextDetached = new Set(detachedWindows.map((windowItem) => windowItem.projectId))
      nextDetached.add(projectId)
      const nextDocked = openProjectIds.find((id) => id !== projectId && !nextDetached.has(id))
      if (nextDocked) {
        setActiveProject(nextDocked)
      }
    }
  }

  const onWorkspaceDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    const detachedProjectId = event.dataTransfer.getData('imagelab/project-tab')
    if (!detachedProjectId) return
    detachProjectWindow(detachedProjectId, event.clientX, event.clientY)
  }

  const focusDetachedWindow = (id: string, projectId: string) => {
    setDetachedWindows((current) => current.map((item) => (item.id === id ? { ...item, z: 1000 } : item)))
    setActiveProject(projectId)
  }

  const dockDetachedProject = (projectId: string) => dockProjectWindow(projectId)

  const startDetachedWindowMove = (id: string, event: ReactPointerEvent<HTMLDivElement>) => {
    const target = detachedWindows.find((item) => item.id === id)
    if (!target) return
    event.preventDefault()
    event.stopPropagation()
    detachedDragRef.current = {
      id,
      projectId: target.projectId,
      mode: 'move',
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      baseX: target.x,
      baseY: target.y,
      baseW: target.width,
      baseH: target.height,
    }
  }

  const startDetachedWindowResize = (id: string, event: ReactPointerEvent<HTMLDivElement>) => {
    const target = detachedWindows.find((item) => item.id === id)
    if (!target) return
    event.preventDefault()
    event.stopPropagation()
    detachedDragRef.current = {
      id,
      projectId: target.projectId,
      mode: 'resize',
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      baseX: target.x,
      baseY: target.y,
      baseW: target.width,
      baseH: target.height,
    }
  }

  const setBackgroundFromColor = (color: string) => {
    if (!project) return
    updateProject(project.id, (current) => {
      current.document.backgroundMode = 'custom'
      current.document.backgroundColor = color
      const backgroundLayer = current.layers.find(
        (layer): layer is Extract<Layer, { kind: 'vector-rect' }> => layer.kind === 'vector-rect' && layer.protected === true,
      )
      if (!backgroundLayer) return
      backgroundLayer.fill = color
      backgroundLayer.visible = true
    }, 'Set background color')
  }

  function applyFillToSelectedLayer(color: string) {
    if (!project || !selectedLayer) return
    updateProject(project.id, (current) => {
      const layer = current.layers.find((item) => item.id === current.selectedLayerId)
      if (!layer || layer.locked) return

      // 1) If a marquee exists, fill exactly that selected canvas area.
      if (canvasSelection) {
        const width = Math.max(1, Math.round(canvasSelection.right - canvasSelection.left))
        const height = Math.max(1, Math.round(canvasSelection.bottom - canvasSelection.top))
        if (width < 1 || height < 1) return
        const fillLayerId = uid('layer')
        current.layers.unshift({
          id: fillLayerId,
          kind: 'vector-rect',
          name: 'Fill',
          visible: true,
          locked: false,
          opacity: 1,
          x: Math.round(canvasSelection.left),
          y: Math.round(canvasSelection.top),
          rotation: 0,
          scaleX: 1,
          scaleY: 1,
          width,
          height,
          segments: [{ x: 0, y: 0, width, height }],
          fill: color,
          stroke: 'transparent',
          strokeWidth: 0,
        })
        current.selectedLayerId = fillLayerId
        return
      }

      // 2) Text layers: apply fill directly to selected text.
      if (layer.kind === 'vector-text' || layer.kind === 'raster-text') {
        layer.fill = color
        return
      }

      // 3) Non-text with no marquee: fill the whole canvas via background layer.
      const backgroundLayer = current.layers.find(
        (item): item is Extract<Layer, { kind: 'vector-rect' }> =>
          item.kind === 'vector-rect' && item.protected === true,
      )
      if (backgroundLayer && !backgroundLayer.locked) {
        backgroundLayer.fill = color
        backgroundLayer.visible = true
        current.document.backgroundMode = 'custom'
        current.document.backgroundColor = color
        return
      }
      const fillLayerId = uid('layer')
      current.layers.unshift({
        id: fillLayerId,
        kind: 'vector-rect',
        name: 'Canvas Fill',
        visible: true,
        locked: false,
        opacity: 1,
        x: 0,
        y: 0,
        rotation: 0,
        scaleX: 1,
        scaleY: 1,
        width: current.document.width,
        height: current.document.height,
        segments: [{ x: 0, y: 0, width: current.document.width, height: current.document.height }],
        fill: color,
        stroke: 'transparent',
        strokeWidth: 0,
      })
      current.selectedLayerId = fillLayerId
    }, canvasSelection ? 'Fill selection' : 'Apply fill')
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

  const menuModel = buildMenuModel({
    modKeyLabel: modKey(),
    isMacPlatform: isMac(),
    project,
    selectedLayer,
    hiddenPanels: workspace.hiddenPanels,
    onNewProject: () => setShowStartOverlay(true),
    onOpenProject: () => pickFiles('.ilp,application/json', false, (files) => { const f = files[0]; if (f) void importIlp(f) }),
    onSaveProject: () => { if (project) updateProject(project.id, () => undefined, 'Save') },
    onExportIlp: () => { if (!project) return; void exportIlp(project.id).then((blob) => downloadBlob(blob, `${project.name}.ilp`)) },
    onPlaceImage: () => pickFiles('image/png,image/jpeg,image/webp,image/avif', false, (files) => { const f = files[0]; if (f) void addAssetFromFile(f) }),
    onImportAssets: () => pickFiles('image/png,image/jpeg,image/webp,image/avif,image/svg+xml', true, (files) => void importAssets(files)),
    onExport: () => { void onExport() },
    onCloseProjectTab: () => { if (project) closeProjectTab(project.id) },
    onUndo: () => { if (project) undo(project.id) },
    onRedo: () => { if (project) redo(project.id) },
    onCut: () => { if (selectedLayer) { setClipboard([structuredClone(selectedLayer)]); deleteLayer() } },
    onCopy: () => { if (selectedLayer) setClipboard([structuredClone(selectedLayer)]) },
    onPaste: pasteLayer,
    onDuplicateLayer: duplicateLayer,
    onDeleteLayer: deleteLayer,
    onSelectAll: selectAllCanvas,
    onDeselect: clearSelection,
    onZoomIn: () => { if (project) setZoom(project.view.zoom * 1.15) },
    onZoomOut: () => { if (project) setZoom(project.view.zoom * 0.85) },
    onFitToScreen: fitToScreen,
    onZoom100: () => setZoom(1),
    onCrop: cropToSelection,
    onNewTextLayer: () => { if (project) beginTextEntry(140, 140) },
    onNewShapeLayer: () => {
      if (!project) return
      updateProject(project.id, (c) => {
        if (c.type === 'vector') {
          c.layers.unshift({
            id: uid('layer'),
            kind: 'vector-rect',
            name: 'Rect',
            visible: true,
            locked: false,
            opacity: 1,
            x: 120,
            y: 120,
            rotation: 0,
            scaleX: 1,
            scaleY: 1,
            width: 220,
            height: 130,
            fill: foregroundColor,
            stroke: backgroundColor,
            strokeWidth: 1,
          })
        }
        c.selectedLayerId = c.layers[0]?.id ?? null
      }, 'New shape')
    },
    onSetBackgroundFromForeground: () => setBackgroundFromColor(foregroundColor),
    onSetBackgroundFromBackground: () => setBackgroundFromColor(backgroundColor),
    onTogglePanelVisibility: togglePanelVisibility,
    onDockAllPanels: dockAllPanels,
    onResetWorkspace: resetWorkspace,
    onBringPanelsToFront: bringPanelsToFront,
    onOpenShortcuts: () => setShortcutsOpen(true),
    onAbout: () => window.alert('imagelab MVP'),
  })

  const openLayerContextMenu = (layerId: string, event: ReactMouseEvent<HTMLButtonElement>) => {
    event.preventDefault()
    setLayerMenu({ layerId, x: event.clientX, y: event.clientY })
  }
  const editingTextLayer = project ? findEditingTextLayer(project.layers) : null
  const menuLayer = project && layerMenu ? project.layers.find((layer) => layer.id === layerMenu.layerId) : null
  const normalizeHexColor = (value: string, fallback: string) => {
    const input = value.trim().replace(/^#/, '')
    if (/^[0-9a-fA-F]{3}$/.test(input)) {
      return `#${input.split('').map((char) => char + char).join('').toLowerCase()}`
    }
    if (/^[0-9a-fA-F]{6}$/.test(input)) return `#${input.toLowerCase()}`
    return fallback
  }
  const detachedProjectIds = detachedWindows.map((windowItem) => windowItem.projectId)
  const dockedProjectIds = openProjectIds.filter((id) => !detachedProjectIds.includes(id))
  const hasDockedProjects = dockedProjectIds.length > 0
  const isActiveProjectDetached = Boolean(project && detachedProjectIds.includes(project.id))
  const renderableLayers = project
    ? (editingTextLayer
      ? project.layers.filter((layer) => layer.visible && layer.id !== editingTextLayer.id)
      : project.layers.filter((layer) => layer.visible))
    : []
  const stackedLayers = [...renderableLayers].reverse()
  const layersNode = project
    ? (project.type === 'vector'
      ? <svg width={project.document.width} height={project.document.height}>{stackedLayers.map((l) => <LayerVector key={l.id} layer={l} asset={assets[(l as { assetId?: string }).assetId ?? '']} />)}</svg>
      : <div className="relative h-full w-full">{stackedLayers.map((l) => <LayerRaster key={l.id} layer={l} asset={assets[(l as { assetId?: string }).assetId ?? '']} />)}</div>)
    : null
  const renderPanelById = (panelId: PanelId) => {
    switch (panelId) {
      case 'layers':
        return (
          <LayersPanel
            project={project}
            assets={assets}
            updateProject={updateProject}
            openLayerContextMenu={openLayerContextMenu}
            openTextEditorForLayer={openTextEditorForLayer}
            moveLayerRelative={moveLayerRelative}
            layerDragState={layerDragState}
            beginLayerDrag={beginLayerDrag}
            hoverLayerDragTarget={hoverLayerDragTarget}
            clearLayerDrag={clearLayerDrag}
            boxSelectedLayerIds={boxSelectedLayerIds}
            clearBoxSelection={() => setBoxSelectedLayerIds([])}
            layerRename={layerRename}
            startLayerRename={startLayerRename}
            updateLayerRenameValue={updateLayerRenameValue}
            commitLayerRename={commitLayerRename}
          />
        )
      case 'properties':
        return (
          <PropertiesPanel
            project={project}
            selectedLayer={selectedLayer}
            canvasSelection={canvasSelection}
            clearCanvasSelection={() => setCanvasSelection(null)}
            cropToSelection={cropToSelection}
            updateProject={updateProject}
          />
        )
      case 'assets':
        return <AssetsPanel assets={assets} />
      case 'swatches':
        return (
          <SwatchesPanel
            setWorkspace={setWorkspace}
            togglePanelVisibility={togglePanelVisibility}
            popoutPanel={popoutPanel}
          />
        )
      default:
        return (
          <HistoryPanel
            historyLabels={history?.labels ?? []}
            onJumpToHistory={(index) => jumpToHistory(project.id, index)}
          />
        )
    }
  }

  if (!project) {
    return (
      <div className="relative flex h-screen flex-col overflow-hidden bg-slate-950 text-slate-100">
        <TopMenuBar
          menuBarRef={menuBarRef}
          menuOrder={DEFAULT_MENU_ORDER}
          openMenu={openMenu}
          onToggleMenu={(menu) => setOpenMenu(openMenu === menu ? null : menu)}
          onCloseMenu={() => setOpenMenu(null)}
          menuModel={menuModel}
          onHome={() => setShowStartOverlay(true)}
        />

        <div className="flex h-9 items-center border-b border-slate-800 bg-slate-900/70 px-1">
          <div className="rounded-t border border-slate-800 bg-slate-900 px-2 py-1 text-xs text-slate-500">
            No open projects
          </div>
        </div>

        <EmptyWorkspace
          tools={toolList('raster')}
          visiblePanels={visiblePanels}
          panelTitles={PANEL_TITLES}
          foregroundColor={foregroundColor}
          backgroundColor={backgroundColor}
        />

        <div className="flex h-7 items-center justify-between border-t border-slate-800 bg-slate-900 px-3 text-xs text-slate-500">
          <span>Zoom -%</span>
          <span>- x -</span>
          <span>X -, Y -</span>
        </div>

        {activeColorTarget && (
          <ColorPickerPanel
            title={activeColorTarget === 'foreground' ? 'Foreground Color' : 'Background Color'}
            value={activeColorTarget === 'foreground' ? foregroundColor : backgroundColor}
            x={colorPanelPos.x}
            y={colorPanelPos.y}
            onMove={(x, y) => setColorPanelPos({ x, y })}
            onChange={(value) => {
              if (activeColorTarget === 'foreground') {
                setForegroundColor(normalizeHexColor(value, foregroundColor))
                return
              }
              setBackgroundColor(normalizeHexColor(value, backgroundColor))
            }}
            onClose={() => setActiveColorTarget(null)}
          />
        )}

        {overlayVisible && (
          <StartOverlay
            canDismiss={hasOpenProjects}
            onRequestClose={() => setShowStartOverlay(false)}
          />
        )}

        {shortcutsOpen && (
          <ShortcutsModal
            modKeyLabel={modKey()}
            redoShortcut={isMac() ? 'Cmd+Shift+Z' : 'Ctrl+Y'}
            onClose={() => setShortcutsOpen(false)}
          />
        )}
      </div>
    )
  }

  return (
    <div className="relative flex h-screen flex-col overflow-hidden bg-slate-950 text-slate-100">
      <TopMenuBar
        menuBarRef={menuBarRef}
        menuOrder={DEFAULT_MENU_ORDER}
        openMenu={openMenu}
        onToggleMenu={(menu) => setOpenMenu(openMenu === menu ? null : menu)}
        onCloseMenu={() => setOpenMenu(null)}
        menuModel={menuModel}
        onHome={() => setShowStartOverlay(true)}
      />

      <div className="flex min-h-0 flex-1">
        <ToolRail
          tools={tools}
          activeTool={project.activeTool}
          onSelect={(tool) => updateProject(project.id, (c) => { c.activeTool = tool }, `Tool ${tool}`)}
          foregroundColor={foregroundColor}
          backgroundColor={backgroundColor}
          onPickForeground={() => setActiveColorTarget('foreground')}
          onPickBackground={() => setActiveColorTarget('background')}
        />
        <div
          className="relative flex min-h-0 flex-1 flex-col"
          onDragOver={(event) => event.preventDefault()}
          onDrop={onWorkspaceDrop}
        >
          {isProjectDockTargetActive && (
            <div className="pointer-events-none absolute left-1 right-1 top-0 z-30 h-9 rounded-b border border-slate-300/25 bg-slate-200/10" />
          )}
          {hasDockedProjects && (
            <ProjectTabsBar
              barRef={tabsBarRef}
              openProjectIds={dockedProjectIds}
              activeProjectId={project.id}
              projects={projects}
              dockTargetActive={isProjectDockTargetActive}
              onSetActiveProject={setActiveProject}
              onCloseProjectTab={closeProjectTab}
              onStartProjectDrag={(projectId) => setActiveProject(projectId)}
            />
          )}

          <div ref={windowHostRef} className="relative flex min-h-0 flex-1">
            {isActiveProjectDetached ? (
              <div className="min-h-0 flex-1 bg-[radial-gradient(circle_at_1px_1px,_#334155_1px,_transparent_0)] bg-[size:24px_24px]" />
            ) : (
              <EditorStage
                project={project}
                stageCursor={stageCursor}
                documentBackdrop={documentBackdropStyle()}
                layersNode={layersNode}
                editingTextLayer={editingTextLayer}
                textEntryValue={textEntry?.value ?? ''}
                textEntryInputRef={textEntryInputRef}
                onTextEntryValueChange={updateTextEntryValue}
                onFinishTextEntry={() => finishTextEntry(true)}
                penDraftLength={penDraft.length}
                onCommitPenOpen={() => commitPen(false)}
                onCommitPenClosed={() => commitPen(true)}
                marquee={marquee}
                areaSelection={areaSelection}
                areaMove={areaMove}
                selectedLayer={selectedLayer}
                canvasSelection={canvasSelection}
                onStagePointerDown={onStagePointerDown}
                onStagePointerMove={onStagePointerMove}
                onStagePointerUp={onStagePointerUp}
                onWheelStage={onWheelStage}
                onStageDrop={onStageDrop}
                onDocumentPointerDown={onDocumentPointerDown}
              />
            )}
            {detachedWindows.map((windowItem) => {
              const windowProject = projects[windowItem.projectId]
              if (!windowProject) return null
              return (
                <DetachedProjectWindow
                  key={windowItem.id}
                  project={windowProject}
                  assets={assets}
                  isActive={activeProjectId === windowItem.projectId}
                  x={windowItem.x}
                  y={windowItem.y}
                  width={windowItem.width}
                  height={windowItem.height}
                  z={windowItem.z}
                  onPointerDownHeader={(event) => startDetachedWindowMove(windowItem.id, event)}
                  onPointerDownResize={(event) => startDetachedWindowResize(windowItem.id, event)}
                  onClose={() => closeProjectTab(windowItem.projectId)}
                  onFocus={() => focusDetachedWindow(windowItem.id, windowItem.projectId)}
                />
              )
            })}
          </div>
        </div>

        <DockedPanelsColumn
          visiblePanels={visiblePanels}
          dockGroups={dockGroups}
          activePanel={workspace.activePanel}
          panelTitles={PANEL_TITLES}
          dockDropTarget={dockDropTarget}
          draggingPanelId={draggingPanelId}
          getDockPanelHeight={getDockPanelHeight}
          resolveDockDropMode={resolveDockDropMode}
          setDockDropTarget={setDockDropTarget}
          setDraggingPanelId={setDraggingPanelId}
          placePanelInGroup={placePanelInGroup}
          reorderPanelTabs={reorderPanelTabs}
          focusPanelInGroup={focusPanelInGroup}
          popoutPanel={popoutPanel}
          startDockResize={startDockResize}
          renderPanelById={renderPanelById}
        />
      </div>

      {workspace.floatingPanels.map((floating) => (
        <FloatingPanel key={floating.id} panelId={floating.panelId} x={floating.x} y={floating.y} width={floating.width} height={floating.height} z={floating.z} onMove={(patch) => moveFloatingPanel(floating.id, patch)} onDock={() => redockPanel(floating.id)}>
          {renderPanelById(floating.panelId)}
        </FloatingPanel>
      ))}

      {layerMenu && (
        <LayerContextMenu
          menuRef={layerMenuRef}
          x={layerMenu.x}
          y={layerMenu.y}
          canRename={Boolean(menuLayer)}
          canDelete={Boolean(!(project.layers.length <= 1 || !menuLayer || menuLayer.locked || menuLayer.protected))}
          onRename={() => {
            if (!menuLayer) return
            startLayerRename(menuLayer)
            setLayerMenu(null)
          }}
          onDelete={() => {
            deleteLayerById(layerMenu.layerId)
            setLayerMenu(null)
          }}
        />
      )}

      {shortcutsOpen && (
        <ShortcutsModal
          modKeyLabel={modKey()}
          redoShortcut={isMac() ? 'Cmd+Shift+Z' : 'Ctrl+Y'}
          onClose={() => setShortcutsOpen(false)}
        />
      )}

      {activeColorTarget && (
        <ColorPickerPanel
          title={activeColorTarget === 'foreground' ? 'Foreground Color' : 'Background Color'}
          value={activeColorTarget === 'foreground' ? foregroundColor : backgroundColor}
          x={colorPanelPos.x}
          y={colorPanelPos.y}
          onMove={(x, y) => setColorPanelPos({ x, y })}
          onChange={(value) => {
            if (activeColorTarget === 'foreground') {
              setForegroundColor(normalizeHexColor(value, foregroundColor))
              return
            }
            setBackgroundColor(normalizeHexColor(value, backgroundColor))
          }}
          onClose={() => setActiveColorTarget(null)}
        />
      )}

      <StatusBar
        zoom={project.view.zoom}
        documentWidth={project.document.width}
        documentHeight={project.document.height}
        cursor={cursor}
        activeTool={project.activeTool}
        isTextEntryActive={Boolean(textEntry)}
        onResetZoom={() => setZoom(1)}
      />

      {overlayVisible && (
        <StartOverlay
          canDismiss={hasOpenProjects}
          onRequestClose={() => setShowStartOverlay(false)}
        />
      )}
    </div>
  )
}
