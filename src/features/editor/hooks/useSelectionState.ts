import { useState } from 'react'
import { subtractRect } from '../utils/editorHelpers'
import type { Layer, Project } from '../../../types'

export type AreaSelection = { layerId: string; x: number; y: number; width: number; height: number } | null
export type CanvasSelection = { left: number; top: number; right: number; bottom: number } | null
export type CanvasSelectionMove = {
  pointerId: number
  startX: number
  startY: number
  origin: { left: number; top: number; right: number; bottom: number }
} | null
export type AreaMove = { pointerId: number; startX: number; startY: number; dx: number; dy: number } | null

type UseSelectionStateParams = {
  project: Project | null
  selectedLayer: Layer | null
  updateProject: (projectId: string, recipe: (project: Project) => void, label?: string) => void
}

export const useSelectionState = ({ project, selectedLayer, updateProject }: UseSelectionStateParams) => {
  const [areaSelection, setAreaSelection] = useState<AreaSelection>(null)
  const [canvasSelection, setCanvasSelection] = useState<CanvasSelection>(null)
  const [canvasSelectionMove, setCanvasSelectionMove] = useState<CanvasSelectionMove>(null)
  const [areaMove, setAreaMove] = useState<AreaMove>(null)

  const clearSelection = () => {
    setAreaSelection(null)
    setCanvasSelection(null)
    setCanvasSelectionMove(null)
    setAreaMove(null)
  }

  const selectAllCanvas = () => {
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

  const deleteSelectedArea = () => {
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

  const cropToSelection = () => {
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

  const shouldDeleteArea = Boolean(areaSelection && selectedLayer?.id === areaSelection.layerId && selectedLayer.kind === 'vector-rect')

  return {
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
  }
}
