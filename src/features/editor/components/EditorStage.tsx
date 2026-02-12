import type { CSSProperties, DragEvent, PointerEvent as ReactPointerEvent, ReactNode, RefObject, WheelEvent } from 'react'
import type { Layer, Project } from '../../../types'

type Point = { x: number; y: number }
type MarqueeState = { pointerId: number; start: Point; current: Point } | null
type AreaSelectionState = { layerId: string; x: number; y: number; width: number; height: number } | null
type AreaMoveState = { pointerId: number; startX: number; startY: number; dx: number; dy: number } | null
type TextLayer = Extract<Layer, { kind: 'vector-text' | 'raster-text' }>

type EditorStageProps = {
  project: Project
  stageCursor: string
  documentBackdrop: CSSProperties
  layersNode: ReactNode
  editingTextLayer: TextLayer | null
  textEntryValue: string
  textEntryInputRef: RefObject<HTMLDivElement | null>
  onTextEntryValueChange: (value: string) => void
  onFinishTextEntry: () => void
  penDraftLength: number
  onCommitPenOpen: () => void
  onCommitPenClosed: () => void
  marquee: MarqueeState
  areaSelection: AreaSelectionState
  areaMove: AreaMoveState
  selectedLayer: Layer | null
  canvasSelection: { left: number; top: number; right: number; bottom: number } | null
  onStagePointerDown: (event: ReactPointerEvent<HTMLDivElement>) => void
  onStagePointerMove: (event: ReactPointerEvent<HTMLDivElement>) => void
  onStagePointerUp: (event: ReactPointerEvent<HTMLDivElement>) => void
  onWheelStage: (event: WheelEvent<HTMLDivElement>) => void
  onStageDrop: (event: DragEvent<HTMLDivElement>) => void
  onDocumentPointerDown: (event: ReactPointerEvent<HTMLDivElement>) => void
}

export const EditorStage = ({
  project,
  stageCursor,
  documentBackdrop,
  layersNode,
  editingTextLayer,
  textEntryValue,
  textEntryInputRef,
  onTextEntryValueChange,
  onFinishTextEntry,
  penDraftLength,
  onCommitPenOpen,
  onCommitPenClosed,
  marquee,
  areaSelection,
  areaMove,
  selectedLayer,
  canvasSelection,
  onStagePointerDown,
  onStagePointerMove,
  onStagePointerUp,
  onWheelStage,
  onStageDrop,
  onDocumentPointerDown,
}: EditorStageProps) => (
  <div
    id="editor-stage"
    className="relative min-h-0 flex-1 overflow-hidden bg-[radial-gradient(circle_at_1px_1px,_#334155_1px,_transparent_0)] bg-[size:24px_24px]"
    style={{ cursor: stageCursor }}
    onPointerDown={onStagePointerDown}
    onPointerMove={onStagePointerMove}
    onPointerUp={onStagePointerUp}
    onWheel={onWheelStage}
    onContextMenu={(event) => { if (project.activeTool === 'zoom') event.preventDefault() }}
    onDragOver={(event) => event.preventDefault()}
    onDrop={onStageDrop}
  >
    <div
      className="absolute origin-top-left border border-slate-500/60 shadow-[0_0_0_1px_rgba(0,0,0,0.2)]"
      style={{
        width: project.document.width,
        height: project.document.height,
        transform: `translate(${project.view.panX}px, ${project.view.panY}px) scale(${project.view.zoom})`,
        ...documentBackdrop,
      }}
      onPointerDown={onDocumentPointerDown}
    >
      {layersNode}
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
            onInput={(event) => onTextEntryValueChange(event.currentTarget.textContent ?? '')}
            onBlur={onFinishTextEntry}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === 'Escape') {
                event.preventDefault()
                onFinishTextEntry()
              }
            }}
          >
            {textEntryValue}
          </div>
        </div>
      )}
    </div>

    {project.type === 'vector' && penDraftLength > 1 && (
      <div className="absolute bottom-2 left-2 flex gap-1 rounded border border-slate-700 bg-slate-900 p-1 text-xs">
        <button className="rounded border border-slate-700 px-2 py-1 hover:bg-slate-700" onClick={onCommitPenOpen}>Finish Path</button>
        <button className="rounded border border-slate-700 px-2 py-1 hover:bg-slate-700" onClick={onCommitPenClosed}>Close Path</button>
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
)
