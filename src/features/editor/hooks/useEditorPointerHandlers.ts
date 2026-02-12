import type { Dispatch, DragEvent, PointerEvent as ReactPointerEvent, SetStateAction } from 'react'
import { clampRectToBounds, docPoint, getLayerLocalBounds, intersectRect, rectFromPoints, subtractRect } from '../utils/editorHelpers'
import { clamp, uid } from '../../../lib/utils'
import type { Layer, PathPoint, Project } from '../../../types'

type ZoomScrubState = {
  pointerId: number
  startY: number
  startZoom: number
  anchorScreenX: number
  anchorScreenY: number
  anchorDocX: number
  anchorDocY: number
} | null

type PanDragState = { pointerId: number; x: number; y: number; px: number; py: number } | null
type MoveLayerState = { id: string; pointerId: number; x: number; y: number; lx: number; ly: number } | null
type MarqueeState = { pointerId: number; start: { x: number; y: number }; current: { x: number; y: number } } | null
type CanvasSelection = { left: number; top: number; right: number; bottom: number } | null
type CanvasSelectionMove = { pointerId: number; startX: number; startY: number; origin: { left: number; top: number; right: number; bottom: number } } | null
type AreaSelection = { layerId: string; x: number; y: number; width: number; height: number } | null
type AreaMove = { pointerId: number; startX: number; startY: number; dx: number; dy: number } | null

type Params = {
  project: Project | null
  selectedLayer: Layer | null
  isSpace: boolean
  textEntry: { layerId: string; value: string } | null
  penDraft: PathPoint[]
  zoomScrub: ZoomScrubState
  panDrag: PanDragState
  moveLayer: MoveLayerState
  marquee: MarqueeState
  canvasSelection: CanvasSelection
  canvasSelectionMove: CanvasSelectionMove
  areaSelection: AreaSelection
  areaMove: AreaMove
  updateProject: (projectId: string, recipe: (project: Project) => void, label?: string) => void
  setZoom: (next: number) => void
  beginTextEntry: (x: number, y: number) => void
  finishTextEntry: (removeWhenEmpty: boolean) => void
  setCursor: Dispatch<SetStateAction<{ x: number; y: number } | null>>
  setZoomScrub: Dispatch<SetStateAction<ZoomScrubState>>
  setPanDrag: Dispatch<SetStateAction<PanDragState>>
  setMoveLayer: Dispatch<SetStateAction<MoveLayerState>>
  setMarquee: Dispatch<SetStateAction<MarqueeState>>
  setCanvasSelection: Dispatch<SetStateAction<CanvasSelection>>
  setCanvasSelectionMove: Dispatch<SetStateAction<CanvasSelectionMove>>
  setAreaSelection: Dispatch<SetStateAction<AreaSelection>>
  setAreaMove: Dispatch<SetStateAction<AreaMove>>
  setBoxSelectedLayerIds: Dispatch<SetStateAction<string[]>>
  setPenDraft: Dispatch<SetStateAction<PathPoint[]>>
}

export const useEditorPointerHandlers = (p: Params) => {
  const onStagePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!p.project) return
    const point = docPoint(event, event.currentTarget, p.project)
    if (p.project.activeTool === 'zoom') {
      if (event.button === 2) {
        event.preventDefault()
        p.setZoom(1)
        return
      }
      const rect = event.currentTarget.getBoundingClientRect()
      p.setZoomScrub({
        pointerId: event.pointerId,
        startY: event.clientY,
        startZoom: p.project.view.zoom,
        anchorScreenX: event.clientX - rect.left,
        anchorScreenY: event.clientY - rect.top,
        anchorDocX: point.x,
        anchorDocY: point.y,
      })
      return
    }
    if (p.project.activeTool === 'hand' || p.isSpace) {
      p.setPanDrag({ pointerId: event.pointerId, x: event.clientX, y: event.clientY, px: p.project.view.panX, py: p.project.view.panY })
      return
    }
    if (p.project.activeTool === 'select') {
      p.setBoxSelectedLayerIds([])
      p.setAreaMove(null)
      p.setMarquee({ pointerId: event.pointerId, start: point, current: point })
      return
    }
    if (p.project.activeTool === 'text') {
      if (p.textEntry) p.finishTextEntry(true)
      p.beginTextEntry(point.x, point.y)
      return
    }
    if (p.project.activeTool === 'pen' && p.project.type === 'vector') {
      p.setPenDraft((draft) => [
        ...draft,
        { id: uid('pt'), anchor: point, inHandle: { x: point.x - 18, y: point.y }, outHandle: { x: point.x + 18, y: point.y }, smooth: true },
      ])
      return
    }
    if (
      p.project.activeTool === 'move' &&
      p.canvasSelection &&
      point.x >= p.canvasSelection.left &&
      point.x <= p.canvasSelection.right &&
      point.y >= p.canvasSelection.top &&
      point.y <= p.canvasSelection.bottom
    ) {
      p.setCanvasSelectionMove({
        pointerId: event.pointerId,
        startX: point.x,
        startY: point.y,
        origin: p.canvasSelection,
      })
      return
    }
    if (p.selectedLayer && !p.selectedLayer.locked && p.project.activeTool === 'move') {
      p.setMoveLayer({ id: p.selectedLayer.id, pointerId: event.pointerId, x: point.x, y: point.y, lx: p.selectedLayer.x, ly: p.selectedLayer.y })
    }
  }

  const onStagePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!p.project) return
    const point = docPoint(event, event.currentTarget, p.project)
    p.setCursor(point)
    if (p.zoomScrub && p.zoomScrub.pointerId === event.pointerId && p.project.activeTool === 'zoom') {
      const dy = event.clientY - p.zoomScrub.startY
      const nextZoom = clamp(p.zoomScrub.startZoom * Math.exp(-dy * 0.01), 0.1, 16)
      p.updateProject(p.project.id, (current) => {
        current.view.zoom = nextZoom
        current.view.panX = p.zoomScrub!.anchorScreenX - p.zoomScrub!.anchorDocX * nextZoom
        current.view.panY = p.zoomScrub!.anchorScreenY - p.zoomScrub!.anchorDocY * nextZoom
      }, 'Zoom scrub')
      return
    }
    if (p.panDrag && p.panDrag.pointerId === event.pointerId) {
      p.updateProject(p.project.id, (current) => {
        current.view.panX = p.panDrag!.px + (event.clientX - p.panDrag!.x)
        current.view.panY = p.panDrag!.py + (event.clientY - p.panDrag!.y)
      }, 'Pan')
      return
    }
    if (p.moveLayer && p.moveLayer.pointerId === event.pointerId && p.project.activeTool === 'move') {
      p.updateProject(p.project.id, (current) => {
        const layer = current.layers.find((item) => item.id === p.moveLayer!.id)
        if (!layer) return
        layer.x = p.moveLayer!.lx + (point.x - p.moveLayer!.x)
        layer.y = p.moveLayer!.ly + (point.y - p.moveLayer!.y)
      }, 'Move')
    }
    if (p.canvasSelectionMove && p.canvasSelectionMove.pointerId === event.pointerId && p.project.activeTool === 'move') {
      const dx = point.x - p.canvasSelectionMove.startX
      const dy = point.y - p.canvasSelectionMove.startY
      const width = p.canvasSelectionMove.origin.right - p.canvasSelectionMove.origin.left
      const height = p.canvasSelectionMove.origin.bottom - p.canvasSelectionMove.origin.top
      const minLeft = 0
      const minTop = 0
      const maxLeft = Math.max(0, p.project.document.width - width)
      const maxTop = Math.max(0, p.project.document.height - height)
      const nextLeft = clamp(p.canvasSelectionMove.origin.left + dx, minLeft, maxLeft)
      const nextTop = clamp(p.canvasSelectionMove.origin.top + dy, minTop, maxTop)
      p.setCanvasSelection({
        left: nextLeft,
        top: nextTop,
        right: nextLeft + width,
        bottom: nextTop + height,
      })
      if (p.areaMove && p.areaMove.pointerId === event.pointerId) {
        p.setAreaMove((current) =>
          current
            ? { ...current, dx: nextLeft - p.canvasSelectionMove!.origin.left, dy: nextTop - p.canvasSelectionMove!.origin.top }
            : current,
        )
      }
      return
    }
    if (p.areaMove && p.areaMove.pointerId === event.pointerId && p.project.activeTool === 'move') {
      p.setAreaMove((current) =>
        current
          ? { ...current, dx: point.x - current.startX, dy: point.y - current.startY }
          : current,
      )
      return
    }
    if (p.marquee && p.marquee.pointerId === event.pointerId) {
      p.setMarquee((current) => (current ? { ...current, current: point } : current))
    }
    if (p.project.activeTool === 'pen' && p.penDraft.length > 0 && (event.buttons & 1) === 1) {
      p.setPenDraft((draft) => {
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
    if (p.zoomScrub?.pointerId === event.pointerId) p.setZoomScrub(null)
    if (p.panDrag?.pointerId === event.pointerId) p.setPanDrag(null)
    if (p.moveLayer?.pointerId === event.pointerId) p.setMoveLayer(null)
    if (p.canvasSelectionMove?.pointerId === event.pointerId) p.setCanvasSelectionMove(null)
    if (p.areaMove?.pointerId === event.pointerId && p.project && p.areaSelection) {
      const dx = p.areaMove.dx
      const dy = p.areaMove.dy
      if (Math.abs(dx) > 0.5 || Math.abs(dy) > 0.5) {
        p.updateProject(p.project.id, (current) => {
          const target = current.layers.find((layer) => layer.id === p.areaSelection!.layerId)
          if (!target || target.kind !== 'vector-rect' || target.locked) return
          const sourceRect = {
            left: p.areaSelection!.x,
            top: p.areaSelection!.y,
            right: p.areaSelection!.x + p.areaSelection!.width,
            bottom: p.areaSelection!.y + p.areaSelection!.height,
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

        const selectionBounds = p.selectedLayer
          ? (getLayerLocalBounds(p.selectedLayer) ?? { left: 0, top: 0, right: Number.POSITIVE_INFINITY, bottom: Number.POSITIVE_INFINITY })
          : { left: 0, top: 0, right: Number.POSITIVE_INFINITY, bottom: Number.POSITIVE_INFINITY }

        const movedSelection = clampRectToBounds(
          {
            left: p.areaSelection.x + dx,
            top: p.areaSelection.y + dy,
            right: p.areaSelection.x + p.areaSelection.width + dx,
            bottom: p.areaSelection.y + p.areaSelection.height + dy,
          },
          selectionBounds,
        )
        if (movedSelection) {
          p.setAreaSelection({
            layerId: p.areaSelection.layerId,
            x: movedSelection.left,
            y: movedSelection.top,
            width: movedSelection.right - movedSelection.left,
            height: movedSelection.bottom - movedSelection.top,
          })
          if (p.selectedLayer) {
            p.setCanvasSelection({
              left: p.selectedLayer.x + movedSelection.left,
              top: p.selectedLayer.y + movedSelection.top,
              right: p.selectedLayer.x + movedSelection.right,
              bottom: p.selectedLayer.y + movedSelection.bottom,
            })
          }
        } else {
          p.setAreaSelection(null)
          p.setCanvasSelection(null)
        }
      }
      p.setAreaMove(null)
      return
    }
    if (p.marquee?.pointerId === event.pointerId && p.project) {
      const rect = rectFromPoints(p.marquee.start, p.marquee.current)
      if (rect.width > 2 || rect.height > 2) {
        if (p.project.activeTool === 'select') {
          p.setCanvasSelection({ left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom })
        }
        p.setAreaSelection(null)
      } else if (p.project.activeTool === 'select') {
        p.setCanvasSelection(null)
        p.setAreaSelection(null)
      }
      p.setBoxSelectedLayerIds([])
      p.setMarquee(null)
    }
  }

  const onDocumentPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!p.project) return
    if (p.project.activeTool !== 'text') return
    const stage = event.currentTarget.parentElement as HTMLDivElement | null
    if (!stage) return
    event.preventDefault()
    event.stopPropagation()
    if (p.textEntry) p.finishTextEntry(true)
    const point = docPoint(event, stage, p.project)
    p.beginTextEntry(point.x, point.y)
  }

  return { onStagePointerDown, onStagePointerMove, onStagePointerUp, onDocumentPointerDown }
}
