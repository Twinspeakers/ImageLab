import type { Dispatch, DragEvent, PointerEvent as ReactPointerEvent, ReactNode, SetStateAction } from 'react'
import type { PanelId } from '../../../types'

type DockDropMode = 'before' | 'merge' | 'after'
type DockDropTarget = { targetLead: PanelId; mode: DockDropMode } | null

type DockedPanelsColumnProps = {
  visiblePanels: PanelId[]
  dockGroups: PanelId[][]
  activePanel: PanelId
  panelTitles: Record<PanelId, string>
  dockDropTarget: DockDropTarget
  draggingPanelId: PanelId | null
  getDockPanelHeight: (panelId: PanelId) => number
  resolveDockDropMode: (event: DragEvent<HTMLDivElement>) => DockDropMode
  setDockDropTarget: Dispatch<SetStateAction<DockDropTarget>>
  setDraggingPanelId: Dispatch<SetStateAction<PanelId | null>>
  placePanelInGroup: (dragPanelId: PanelId, targetLead: PanelId, mode: DockDropMode) => void
  reorderPanelTabs: (dragPanelId: PanelId, targetPanelId: PanelId) => void
  focusPanelInGroup: (panelId: PanelId) => void
  popoutPanel: (panelId: PanelId) => void
  startDockResize: (panelId: PanelId, event: ReactPointerEvent<HTMLDivElement>) => void
  renderPanelById: (panelId: PanelId) => ReactNode
}

export const DockedPanelsColumn = ({
  visiblePanels,
  dockGroups,
  activePanel,
  panelTitles,
  dockDropTarget,
  draggingPanelId,
  getDockPanelHeight,
  resolveDockDropMode,
  setDockDropTarget,
  setDraggingPanelId,
  placePanelInGroup,
  reorderPanelTabs,
  focusPanelInGroup,
  popoutPanel,
  startDockResize,
  renderPanelById,
}: DockedPanelsColumnProps) => (
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
        const activePanelInGroup = group.includes(activePanel) ? activePanel : leadPanelId
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
                    {panelTitles[tabPanelId]}
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
              {renderPanelById(activePanelInGroup)}
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
        )
      })}
    </div>
  </aside>
)
