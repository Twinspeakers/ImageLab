import type { RefObject } from 'react'

type LayerContextMenuProps = {
  menuRef: RefObject<HTMLDivElement | null>
  x: number
  y: number
  canRename: boolean
  canDelete: boolean
  onRename: () => void
  onDelete: () => void
}

export const LayerContextMenu = ({
  menuRef,
  x,
  y,
  canRename,
  canDelete,
  onRename,
  onDelete,
}: LayerContextMenuProps) => (
  <div
    ref={menuRef}
    className="absolute z-[1600] w-40 rounded border border-slate-700 bg-slate-900 p-1 shadow-xl"
    style={{ left: x, top: y }}
    onMouseDown={(event) => event.stopPropagation()}
    onContextMenu={(event) => event.preventDefault()}
  >
    <button
      className={`w-full rounded px-2 py-1 text-left text-xs ${
        canRename ? 'text-slate-200 hover:bg-slate-800' : 'cursor-not-allowed text-slate-500'
      }`}
      disabled={!canRename}
      onClick={onRename}
    >
      Rename Layer
    </button>
    <button
      className={`w-full rounded px-2 py-1 text-left text-xs ${
        canDelete ? 'text-red-300 hover:bg-slate-800' : 'cursor-not-allowed text-slate-500'
      }`}
      disabled={!canDelete}
      onClick={onDelete}
    >
      Delete Layer
    </button>
  </div>
)
