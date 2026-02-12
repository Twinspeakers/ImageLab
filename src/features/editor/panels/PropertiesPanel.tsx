import type { Layer, Project } from '../../../types'

type PropertiesPanelProps = {
  project: Project
  selectedLayer: Layer | null
  canvasSelection: { left: number; top: number; right: number; bottom: number } | null
  clearCanvasSelection: () => void
  cropToSelection: () => void
  updateProject: (projectId: string, recipe: (project: Project) => void, label?: string) => void
}

export const PropertiesPanel = ({
  project,
  selectedLayer,
  canvasSelection,
  clearCanvasSelection,
  cropToSelection,
  updateProject,
}: PropertiesPanelProps) => {
  if (!selectedLayer) return <div className="p-3 text-sm text-slate-400">Select a layer.</div>

  return (
    <div className="grid gap-2 p-3 text-xs">
      {canvasSelection && (
        <div className="rounded border border-cyan-500/50 bg-cyan-950/20 p-2">
          <div className="mb-1 text-[11px] font-medium text-cyan-200">Selection</div>
          <div className="grid grid-cols-2 gap-1 text-[11px] text-slate-200">
            <div>X: {Math.round(canvasSelection.left)}</div>
            <div>Y: {Math.round(canvasSelection.top)}</div>
            <div>W: {Math.round(canvasSelection.right - canvasSelection.left)}</div>
            <div>H: {Math.round(canvasSelection.bottom - canvasSelection.top)}</div>
          </div>
          <div className="mt-2 flex gap-1">
            <button className="rounded border border-slate-600 px-2 py-1 text-[11px] hover:bg-slate-800" onClick={clearCanvasSelection}>
              Clear
            </button>
            <button className="rounded border border-cyan-500 px-2 py-1 text-[11px] text-cyan-200 hover:bg-cyan-900/40" onClick={cropToSelection}>
              Crop
            </button>
          </div>
        </div>
      )}
      <label>
        Name
        <input
          className="mt-1 w-full rounded border border-slate-700 bg-slate-950 px-2 py-1"
          value={selectedLayer.name}
          onChange={(e) =>
            updateProject(project.id, (c) => {
              const l = c.layers.find((x) => x.id === selectedLayer.id)
              if (l) l.name = e.target.value
            }, 'Rename')
          }
        />
      </label>
      <div className="grid grid-cols-2 gap-2">
        <label>
          X
          <input
            type="number"
            className="mt-1 w-full rounded border border-slate-700 bg-slate-950 px-2 py-1"
            value={selectedLayer.x}
            onChange={(e) =>
              updateProject(project.id, (c) => {
                const l = c.layers.find((x) => x.id === selectedLayer.id)
                if (l) l.x = Number(e.target.value)
              }, 'X')
            }
          />
        </label>
        <label>
          Y
          <input
            type="number"
            className="mt-1 w-full rounded border border-slate-700 bg-slate-950 px-2 py-1"
            value={selectedLayer.y}
            onChange={(e) =>
              updateProject(project.id, (c) => {
                const l = c.layers.find((x) => x.id === selectedLayer.id)
                if (l) l.y = Number(e.target.value)
              }, 'Y')
            }
          />
        </label>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <label>
          Scale X
          <input
            type="number"
            step={0.1}
            className="mt-1 w-full rounded border border-slate-700 bg-slate-950 px-2 py-1"
            value={selectedLayer.scaleX}
            onChange={(e) =>
              updateProject(project.id, (c) => {
                const l = c.layers.find((x) => x.id === selectedLayer.id)
                if (l) l.scaleX = Number(e.target.value)
              }, 'ScaleX')
            }
          />
        </label>
        <label>
          Scale Y
          <input
            type="number"
            step={0.1}
            className="mt-1 w-full rounded border border-slate-700 bg-slate-950 px-2 py-1"
            value={selectedLayer.scaleY}
            onChange={(e) =>
              updateProject(project.id, (c) => {
                const l = c.layers.find((x) => x.id === selectedLayer.id)
                if (l) l.scaleY = Number(e.target.value)
              }, 'ScaleY')
            }
          />
        </label>
      </div>
      <label>
        Rotation
        <input
          type="number"
          className="mt-1 w-full rounded border border-slate-700 bg-slate-950 px-2 py-1"
          value={selectedLayer.rotation}
          onChange={(e) =>
            updateProject(project.id, (c) => {
              const l = c.layers.find((x) => x.id === selectedLayer.id)
              if (l) l.rotation = Number(e.target.value)
            }, 'Rotate')
          }
        />
      </label>
    </div>
  )
}
