import { useState } from 'react'
import type { Project } from '../../../types'

export type LayerDragState = { activeId: string; targetId: string | null; position: 'before' | 'after' } | null

type UseLayerDragParams = {
  project: Project | null
  updateProject: (projectId: string, recipe: (project: Project) => void, label?: string) => void
}

export const useLayerDrag = ({ project, updateProject }: UseLayerDragParams) => {
  const [layerDragState, setLayerDragState] = useState<LayerDragState>(null)

  const moveLayerRelative = (dragLayerId: string, targetLayerId: string, position: 'before' | 'after') => {
    if (!project) return
    if (dragLayerId === targetLayerId) return

    updateProject(project.id, (current) => {
      const from = current.layers.findIndex((layer) => layer.id === dragLayerId)
      const target = current.layers.findIndex((layer) => layer.id === targetLayerId)
      if (from < 0 || target < 0) return

      const [moved] = current.layers.splice(from, 1)
      if (!moved) return

      // If removing an item before the target, the target index shifts left by one.
      const normalizedTarget = from < target ? target - 1 : target
      const insertAt = position === 'before' ? normalizedTarget : normalizedTarget + 1
      current.layers.splice(insertAt, 0, moved)
    }, 'Reorder layer')
  }

  const beginLayerDrag = (layerId: string) => setLayerDragState({ activeId: layerId, targetId: null, position: 'before' })

  const hoverLayerDragTarget = (layerId: string, position: 'before' | 'after') => {
    setLayerDragState((current) => {
      if (!current) return current
      if (current.targetId === layerId && current.position === position) return current
      return { ...current, targetId: layerId, position }
    })
  }

  const clearLayerDrag = () => setLayerDragState(null)

  return {
    layerDragState,
    moveLayerRelative,
    beginLayerDrag,
    hoverLayerDragTarget,
    clearLayerDrag,
  }
}
