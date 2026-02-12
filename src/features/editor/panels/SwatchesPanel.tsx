import { uid } from '../../../lib/utils'
import type { PanelId, WorkspacePrefs } from '../../../types'

type SwatchesPanelProps = {
  setWorkspace: (recipe: (workspace: WorkspacePrefs) => void) => void
  togglePanelVisibility: (panelId: PanelId) => void
  popoutPanel: (panelId: PanelId) => void
}

export const SwatchesPanel = ({ setWorkspace, togglePanelVisibility, popoutPanel }: SwatchesPanelProps) => (
  <div className="space-y-2 p-2">
    <button
      className="w-full rounded border border-slate-700 px-2 py-1 text-xs hover:bg-slate-800"
      onClick={() => setWorkspace((w) => { w.swatches.push({ id: uid('sw'), name: 'New', type: 'solid', value: '#22c55e' }) })}
    >
      Add swatch
    </button>
    <button
      className="w-full rounded border border-slate-700 px-2 py-1 text-xs hover:bg-slate-800"
      onClick={() => { togglePanelVisibility('swatches'); popoutPanel('swatches') }}
    >
      Pop out swatches
    </button>
  </div>
)
