import { exportVectorSvg, renderRasterBlob } from '../../../lib/export'
import { clamp, uid } from '../../../lib/utils'
import type { AssetBlobRecord, Layer, Project } from '../../../types'
import { downloadBlob } from '../utils/editorHelpers'

type UseEditorActionsParams = {
  project: Project | null
  selectedLayer: Layer | null
  boxSelectedLayerIds: string[]
  clipboard: Layer[] | null
  assetMap: Map<string, AssetBlobRecord>
  avifSupported: boolean
  updateProject: (projectId: string, recipe: (project: Project) => void, label?: string) => void
  setBoxSelectedLayerIds: (next: string[]) => void
}

export const useEditorActions = ({
  project,
  selectedLayer,
  boxSelectedLayerIds,
  clipboard,
  assetMap,
  avifSupported,
  updateProject,
  setBoxSelectedLayerIds,
}: UseEditorActionsParams) => {
  const setZoom = (zoom: number) => {
    if (!project) return
    updateProject(project.id, (current) => { current.view.zoom = clamp(zoom, 0.1, 16) }, 'Zoom')
  }

  const fitToScreen = () => {
    if (!project) return
    const stage = document.getElementById('editor-stage') as HTMLDivElement | null
    if (!stage) return
    const rect = stage.getBoundingClientRect()
    const zoom = Math.min((rect.width - 100) / project.document.width, (rect.height - 100) / project.document.height)
    updateProject(project.id, (current) => {
      current.view.zoom = clamp(zoom, 0.1, 8)
      current.view.panX = (rect.width - current.document.width * current.view.zoom) / 2
      current.view.panY = (rect.height - current.document.height * current.view.zoom) / 2
    }, 'Fit')
  }

  const deleteLayer = () => {
    if (!project) return
    const selectedIds = boxSelectedLayerIds.length > 0 ? boxSelectedLayerIds : selectedLayer ? [selectedLayer.id] : []
    if (selectedIds.length === 0) return
    updateProject(project.id, (current) => {
      if (current.layers.length <= 1) return
      const selectedSet = new Set(selectedIds)
      const deletable = current.layers.filter((layer) => selectedSet.has(layer.id) && !layer.locked && !layer.protected)
      if (deletable.length === 0) return
      if (current.layers.length - deletable.length < 1) return
      const deleteSet = new Set(deletable.map((layer) => layer.id))
      current.layers = current.layers.filter((layer) => !deleteSet.has(layer.id))
      current.selectedLayerId = current.layers[0]?.id ?? null
    }, selectedIds.length > 1 ? 'Delete layers' : 'Delete layer')
    setBoxSelectedLayerIds([])
  }

  const deleteLayerById = (layerId: string) => {
    if (!project) return
    if (project.layers.length <= 1) return
    updateProject(project.id, (current) => {
      if (current.layers.length <= 1) return
      const target = current.layers.find((layer) => layer.id === layerId)
      if (!target || target.locked || target.protected) return
      current.layers = current.layers.filter((layer) => layer.id !== layerId)
      if (current.selectedLayerId === layerId) {
        current.selectedLayerId = current.layers[0]?.id ?? null
      }
    }, 'Delete layer')
  }

  const duplicateLayer = () => {
    if (!project || !selectedLayer) return
    updateProject(project.id, (current) => {
      const copy = structuredClone(selectedLayer)
      copy.id = uid('layer')
      copy.x += 20
      copy.y += 20
      copy.name = `${selectedLayer.name} Copy`
      current.layers.unshift(copy)
      current.selectedLayerId = copy.id
    }, 'Duplicate layer')
  }

  const pasteLayer = () => {
    if (!project || !clipboard) return
    updateProject(project.id, (current) => {
      const pasted = clipboard.map((layer) => {
        const clone = structuredClone(layer)
        clone.id = uid('layer')
        clone.x += 24
        clone.y += 24
        clone.name = `${layer.name} Paste`
        return clone
      })
      current.layers = [...pasted, ...current.layers]
      current.selectedLayerId = pasted[0]?.id ?? null
    }, 'Paste')
  }

  const onExport = async () => {
    if (!project) return
    if (project.type === 'vector') {
      const svg = exportVectorSvg(project, assetMap)
      downloadBlob(new Blob([svg], { type: 'image/svg+xml' }), `${project.name}.svg`)
      return
    }
    const requested = (window.prompt('Format: png/jpg/webp/avif', 'png') ?? 'png').toLowerCase()
    const map: Record<string, string> = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp', avif: 'image/avif' }
    const mime = map[requested]
    if (!mime) return
    if (mime === 'image/avif' && !avifSupported) return
    const blob = await renderRasterBlob(project, assetMap, mime)
    if (blob) downloadBlob(blob, `${project.name}.${requested === 'jpeg' ? 'jpg' : requested}`)
  }

  return {
    setZoom,
    fitToScreen,
    deleteLayer,
    deleteLayerById,
    duplicateLayer,
    pasteLayer,
    onExport,
  }
}

