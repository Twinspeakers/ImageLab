import type { DragEvent, MouseEvent as ReactMouseEvent } from 'react'
import { LayerListThumb } from './PanelThumbs'
import type { AssetBlobRecord, Layer, Project } from '../../../types'

type LayerDragState = { activeId: string; targetId: string | null; position: 'before' | 'after' } | null

type LayersPanelProps = {
  project: Project
  assets: Record<string, AssetBlobRecord>
  updateProject: (projectId: string, recipe: (project: Project) => void, label?: string) => void
  openLayerContextMenu: (layerId: string, event: ReactMouseEvent<HTMLButtonElement>) => void
  openTextEditorForLayer: (layer: Layer) => void
  moveLayerRelative: (dragLayerId: string, targetLayerId: string, position: 'before' | 'after') => void
  layerDragState: LayerDragState
  beginLayerDrag: (layerId: string) => void
  hoverLayerDragTarget: (layerId: string, position: 'before' | 'after') => void
  clearLayerDrag: () => void
  boxSelectedLayerIds: string[]
  clearBoxSelection: () => void
  layerRename: { layerId: string; value: string } | null
  startLayerRename: (layer: Layer) => void
  updateLayerRenameValue: (value: string) => void
  commitLayerRename: (cancel?: boolean) => void
}

export const LayersPanel = ({
  project,
  assets,
  updateProject,
  openLayerContextMenu,
  openTextEditorForLayer,
  moveLayerRelative,
  layerDragState,
  beginLayerDrag,
  hoverLayerDragTarget,
  clearLayerDrag,
  boxSelectedLayerIds,
  clearBoxSelection,
  layerRename,
  startLayerRename,
  updateLayerRenameValue,
  commitLayerRename,
}: LayersPanelProps) => (
  <div className="space-y-1 p-2">
    {project.layers.map((layer) => (
      <div
        key={layer.id}
        className={`relative flex w-full items-center justify-between rounded border px-2 py-1.5 text-left text-xs ${
          layer.id === project.selectedLayerId || boxSelectedLayerIds.includes(layer.id) ? 'border-cyan-500 bg-cyan-950/40' : 'border-slate-700 bg-slate-900'
        } ${
          layerDragState?.targetId === layer.id && layerDragState.activeId !== layer.id ? 'ring-1 ring-cyan-400/80' : ''
        }`}
      >
        {layerDragState?.targetId === layer.id && layerDragState.activeId !== layer.id && layerDragState.position === 'before' && (
          <div className="pointer-events-none absolute -top-[1px] left-0 right-0 border-t-2 border-cyan-300/40" />
        )}
        {layerDragState?.targetId === layer.id && layerDragState.activeId !== layer.id && layerDragState.position === 'after' && (
          <div className="pointer-events-none absolute -bottom-[1px] left-0 right-0 border-b-2 border-cyan-300/40" />
        )}
        <button
          className="flex min-w-0 flex-1 items-center gap-2 text-left"
          draggable
          onDragStart={(event: DragEvent<HTMLButtonElement>) => {
            event.dataTransfer.setData('imagelab/layer', layer.id)
            event.dataTransfer.effectAllowed = 'move'
            beginLayerDrag(layer.id)
          }}
          onDragEnd={() => clearLayerDrag()}
          onDragEnter={(event) => {
            const rect = event.currentTarget.getBoundingClientRect()
            const position = event.clientY < rect.top + rect.height / 2 ? 'before' : 'after'
            hoverLayerDragTarget(layer.id, position)
          }}
          onDragOver={(event) => {
            event.preventDefault()
            event.dataTransfer.dropEffect = 'move'
            const rect = event.currentTarget.getBoundingClientRect()
            const position = event.clientY < rect.top + rect.height / 2 ? 'before' : 'after'
            hoverLayerDragTarget(layer.id, position)
          }}
          onDrop={(event) => {
            event.preventDefault()
            const dragLayerId = event.dataTransfer.getData('imagelab/layer')
            if (!dragLayerId) return
            const rect = event.currentTarget.getBoundingClientRect()
            const position = event.clientY < rect.top + rect.height / 2 ? 'before' : 'after'
            moveLayerRelative(dragLayerId, layer.id, position)
            clearLayerDrag()
          }}
          onClick={() => {
            clearBoxSelection()
            updateProject(project.id, (c) => { c.selectedLayerId = layer.id }, 'Select layer')
          }}
          onContextMenu={(event) => openLayerContextMenu(layer.id, event)}
          onDoubleClick={() => openTextEditorForLayer(layer)}
        >
          <LayerListThumb layer={layer} asset={assets[(layer as { assetId?: string }).assetId ?? '']} />
          <span className="min-w-0 flex-1">
            {layerRename?.layerId === layer.id ? (
              <input
                autoFocus
                className="w-full min-w-0 rounded border border-slate-600 bg-slate-950 px-1 py-0.5 text-xs text-slate-100 outline-none"
                value={layerRename.value}
                onClick={(event) => event.stopPropagation()}
                onChange={(event) => updateLayerRenameValue(event.target.value)}
                onFocus={(event) => event.currentTarget.select()}
                onBlur={() => commitLayerRename(false)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault()
                    commitLayerRename(false)
                  }
                  if (event.key === 'Escape') {
                    event.preventDefault()
                    commitLayerRename(true)
                  }
                }}
              />
            ) : (
              <span
                className="truncate"
                onDoubleClick={(event) => {
                  event.stopPropagation()
                  startLayerRename(layer)
                }}
              >
                {layer.name}
              </span>
            )}
            <span className="block text-[10px] text-slate-400">{layer.kind}</span>
          </span>
        </button>
        <button
          className={`ml-2 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded border ${
            layer.locked ? 'border-amber-500 text-amber-300' : 'border-slate-700 text-slate-400 hover:bg-slate-800'
          }`}
          title={layer.locked ? 'Unlock layer' : 'Lock layer'}
          aria-label={layer.locked ? 'Unlock layer' : 'Lock layer'}
          onClick={(event) => {
            event.stopPropagation()
            updateProject(project.id, (c) => {
              const target = c.layers.find((x) => x.id === layer.id)
              if (!target) return
              target.locked = !target.locked
            }, layer.locked ? 'Unlock layer' : 'Lock layer')
          }}
        >
          {layer.locked ? (
            <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <rect x="5" y="11" width="14" height="10" rx="2" />
              <path d="M8 11V8a4 4 0 0 1 8 0v3" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <rect x="5" y="11" width="14" height="10" rx="2" />
              <path d="M16 11V8a4 4 0 0 0-7.5-2" />
            </svg>
          )}
        </button>
      </div>
    ))}
  </div>
)
