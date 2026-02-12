import { useEffect, useRef, useState } from 'react'
import type { Layer, Project } from '../../../types'

type TextLayer = Extract<Layer, { kind: 'vector-text' | 'raster-text' }>
type TextEntryState = { layerId: string; value: string } | null

type UseTextEntryParams = {
  project: Project | null
  updateProject: (projectId: string, recipe: (project: Project) => void, label?: string) => void
}

export const useTextEntry = ({ project, updateProject }: UseTextEntryParams) => {
  const [textEntry, setTextEntry] = useState<TextEntryState>(null)
  const textEntryInputRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!textEntry) return
    const input = textEntryInputRef.current
    if (!input) return
    window.setTimeout(() => {
      input.focus()
      const selection = window.getSelection()
      if (!selection) return
      const range = document.createRange()
      range.selectNodeContents(input)
      range.collapse(false)
      selection.removeAllRanges()
      selection.addRange(range)
    }, 0)
  }, [textEntry])

  const beginTextEntry = (layerId: string, value = '') => {
    setTextEntry({ layerId, value })
  }

  const updateTextEntryValue = (value: string) => {
    setTextEntry((current) => (current ? { ...current, value } : current))
  }

  const finishTextEntry = (removeWhenEmpty: boolean) => {
    if (!project || !textEntry) return
    const { layerId, value } = textEntry
    const hasText = value.length > 0

    updateProject(project.id, (current) => {
      const index = current.layers.findIndex((layer) => layer.id === layerId)
      if (index < 0) return
      const layer = current.layers[index]
      if (layer.kind !== 'vector-text' && layer.kind !== 'raster-text') return
      if (!hasText && removeWhenEmpty && current.layers.length > 1) {
        current.layers.splice(index, 1)
        if (current.selectedLayerId === layerId) {
          current.selectedLayerId = current.layers[0]?.id ?? null
        }
        return
      }
      layer.text = value
    }, hasText ? 'Set text' : 'Cancel text')

    setTextEntry(null)
  }

  const openTextEditorForLayer = (layer: Layer) => {
    if (!project) return
    if (layer.kind !== 'vector-text' && layer.kind !== 'raster-text') return

    updateProject(project.id, (current) => {
      current.selectedLayerId = layer.id
    }, 'Select layer')
    setTextEntry({ layerId: layer.id, value: layer.text })
  }

  const findEditingTextLayer = (layers: Layer[]): TextLayer | null => {
    if (!textEntry) return null
    return layers.find(
      (layer): layer is TextLayer =>
        layer.id === textEntry.layerId &&
        (layer.kind === 'vector-text' || layer.kind === 'raster-text'),
    ) ?? null
  }

  return {
    textEntry,
    textEntryInputRef,
    beginTextEntry,
    updateTextEntryValue,
    finishTextEntry,
    openTextEditorForLayer,
    findEditingTextLayer,
  }
}
