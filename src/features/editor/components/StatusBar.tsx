import type { ToolId } from '../../../types'

type StatusBarProps = {
  zoom: number
  documentWidth: number
  documentHeight: number
  cursor: { x: number; y: number } | null
  activeTool: ToolId
  isTextEntryActive: boolean
  onResetZoom: () => void
}

export const StatusBar = ({
  zoom,
  documentWidth,
  documentHeight,
  cursor,
  activeTool,
  isTextEntryActive,
  onResetZoom,
}: StatusBarProps) => (
  <div className="flex h-7 items-center justify-between border-t border-slate-800 bg-slate-900 px-3 text-xs text-slate-300">
    <span className="inline-flex items-center gap-2">
      <button
        className="inline-flex h-5 w-5 items-center justify-center rounded border border-slate-700 text-slate-200 hover:bg-slate-800"
        onClick={onResetZoom}
        title="Reset zoom to 100%"
        aria-label="Reset zoom to 100%"
      >
        <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M3 12a9 9 0 1 0 3-6.708" />
          <path d="M3 4v4h4" />
        </svg>
      </button>
      <span>Zoom {Math.round(zoom * 100)}%</span>
    </span>
    <span>{documentWidth} x {documentHeight}</span>
    <span>
      {activeTool === 'text' && !isTextEntryActive
        ? 'Text tool: click canvas to type'
        : cursor ? `X ${cursor.x.toFixed(0)}, Y ${cursor.y.toFixed(0)}` : 'X -, Y -'}
    </span>
  </div>
)
