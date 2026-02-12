import type { PanelId, ToolId } from '../../../types'
import { ToolRail } from './ToolRail'

type EmptyWorkspaceProps = {
  tools: ToolId[]
  visiblePanels: PanelId[]
  panelTitles: Record<PanelId, string>
  foregroundColor?: string
  backgroundColor?: string
}

export const EmptyWorkspace = ({ tools, visiblePanels, panelTitles, foregroundColor, backgroundColor }: EmptyWorkspaceProps) => (
  <div className="flex min-h-0 flex-1">
    <ToolRail tools={tools} activeTool={null} disabled foregroundColor={foregroundColor} backgroundColor={backgroundColor} />

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
              <span>{panelTitles[panelId]}</span>
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
)
