import { useEffect } from 'react'
import type { Layer, PathPoint, Project, ToolId } from '../../../types'

type UseEditorShortcutsParams = {
  project: Project | null
  tools: ToolId[]
  selectedLayer: Layer | null
  penDraft: PathPoint[]
  isSpace: boolean
  preSpaceTool: ToolId | null
  areaSelection: { layerId: string; x: number; y: number; width: number; height: number } | null
  canvasSelection: { left: number; top: number; right: number; bottom: number } | null
  shouldDeleteArea: boolean
  hasTextEntry: boolean
  updateProject: (projectId: string, recipe: (project: Project) => void, label?: string) => void
  setIsSpace: (next: boolean) => void
  setPreSpaceTool: (next: ToolId | null) => void
  setShowStartOverlay: (next: boolean) => void
  setShortcutsOpen: (next: boolean) => void
  setClipboard: (next: Layer[] | null) => void
  closeProjectTab: (projectId: string) => void
  importIlp: (file: File) => Promise<void>
  undo: (projectId: string) => void
  redo: (projectId: string) => void
  clearSelection: () => void
  selectAllCanvas: () => void
  duplicateLayer: () => void
  deleteLayer: () => void
  cropToSelection: () => void
  pasteLayer: () => void
  deleteSelectedArea: () => void
  fitToScreen: () => void
  setZoom: (zoom: number) => void
  onExport: () => Promise<void>
  commitPen: (closed: boolean) => void
}

export const useEditorShortcuts = ({
  project,
  tools,
  selectedLayer,
  penDraft,
  isSpace,
  preSpaceTool,
  areaSelection,
  canvasSelection,
  shouldDeleteArea,
  hasTextEntry,
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
}: UseEditorShortcutsParams) => {
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
      if (isTypingTarget || hasTextEntry) return
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
        clearSelection()
        return
      }
      if (mod && k === 'd') {
        event.preventDefault()
        clearSelection()
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
        if (shouldDeleteArea) {
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
  }, [
    areaSelection,
    canvasSelection,
    clearSelection,
    closeProjectTab,
    commitPen,
    cropToSelection,
    deleteLayer,
    deleteSelectedArea,
    duplicateLayer,
    fitToScreen,
    hasTextEntry,
    importIlp,
    isSpace,
    onExport,
    pasteLayer,
    penDraft,
    preSpaceTool,
    project,
    redo,
    selectAllCanvas,
    selectedLayer,
    setClipboard,
    setIsSpace,
    setPreSpaceTool,
    setShortcutsOpen,
    setShowStartOverlay,
    setZoom,
    shouldDeleteArea,
    tools,
    undo,
    updateProject,
  ])
}

