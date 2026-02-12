import { useState } from 'react'
import type { Layer, Project } from '../../../types'

type LayerRenameState = { layerId: string; value: string } | null

type UseLayerRenameParams = {
  project: Project | null
  updateProject: (projectId: string, recipe: (project: Project) => void, label?: string) => void
  onStartRename?: () => void
}

export const useLayerRename = ({ project, updateProject, onStartRename }: UseLayerRenameParams) => {
  const [layerRename, setLayerRename] = useState<LayerRenameState>(null)

  const startLayerRename = (layer: Layer) => {
    if (!project) return
    onStartRename?.()
    setLayerRename({ layerId: layer.id, value: layer.name })
  }

  const updateLayerRenameValue = (value: string) => {
    setLayerRename((current) => (current ? { ...current, value } : current))
  }

  const commitLayerRename = (cancel = false) => {
    if (!project || !layerRename) return
    if (cancel) {
      setLayerRename(null)
      return
    }

    const nextName = layerRename.value.trim()
    if (!nextName) {
      setLayerRename(null)
      return
    }

    updateProject(project.id, (current) => {
      const layer = current.layers.find((item) => item.id === layerRename.layerId)
      if (!layer) return
      layer.name = nextName
    }, 'Rename layer')
    setLayerRename(null)
  }

  return {
    layerRename,
    startLayerRename,
    updateLayerRenameValue,
    commitLayerRename,
  }
}
