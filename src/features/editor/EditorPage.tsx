import { DragEvent, MouseEvent as ReactMouseEvent, PointerEvent as ReactPointerEvent, WheelEvent, useEffect, useMemo, useRef, useState } from 'react'
import { clamp, isMac, modKey, uid, loadImage, toDataUrl } from '../../lib/utils'
import { useAppStore } from '../../store/useAppStore'
import { StartOverlay } from '../../components/StartOverlay'
import { DEFAULT_DOCK_PANEL_HEIGHTS, DEFAULT_MENU_ORDER, PANEL_TITLES, toolList } from './constants'
import { DockedPanelsColumn } from './components/DockedPanelsColumn'
import { ColorPickerPanel } from './components/ColorPickerPanel'
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
    if (!project) return
    const id = event.dataTransfer.getData('imagelab/asset')
    const asset = assets[id]
    if (!asset) return
    const p = docPoint(event, event.currentTarget, project)
    void addLayerFromAsset(project, asset, p, workspace.rasterizeScale, updateProject, { loadImage, toDataUrl, uid })
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
            fill: '#22d3ee',
            stroke: '#0f172a',
            strokeWidth: 1,
          })
        }
        c.selectedLayerId = c.layers[0]?.id ?? null
      }, 'New shape')
    },
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

      <ProjectTabsBar
        openProjectIds={openProjectIds}
        activeProjectId={project.id}
        projects={projects}
        onSetActiveProject={setActiveProject}
        onCloseProjectTab={closeProjectTab}
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
