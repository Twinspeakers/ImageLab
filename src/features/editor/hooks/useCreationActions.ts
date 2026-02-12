import { uid } from '../../../lib/utils'
import type { PathPoint, Project } from '../../../types'

type UseCreationActionsParams = {
  project: Project | null
  penDraft: PathPoint[]
  foregroundColor: string
  updateProject: (projectId: string, recipe: (project: Project) => void, label?: string) => void
  beginTextLayerSession: (layerId: string, value?: string) => void
  setPenDraft: (next: PathPoint[]) => void
}

export const useCreationActions = ({
  project,
  penDraft,
  foregroundColor,
  updateProject,
  beginTextLayerSession,
  setPenDraft,
}: UseCreationActionsParams) => {
  const beginTextEntry = (x: number, y: number) => {
    if (!project) return
    const layerId = uid('layer')
    updateProject(project.id, (current) => {
      current.layers.push({
        id: layerId,
        kind: current.type === 'vector' ? 'vector-text' : 'raster-text',
        name: 'Text',
        visible: true,
        locked: false,
        opacity: 1,
        x,
        y,
        rotation: 0,
        scaleX: 1,
        scaleY: 1,
        text: '',
        fontSize: 42,
        fill: foregroundColor,
      })
      current.selectedLayerId = layerId
    }, 'New text')
    beginTextLayerSession(layerId, '')
  }

  const commitPen = (closed: boolean) => {
    if (!project || project.type !== 'vector' || penDraft.length < 2) return
    updateProject(project.id, (current) => {
      current.layers.unshift({
        id: uid('layer'),
        kind: 'vector-path',
        name: 'Pen Path',
        visible: true,
        locked: false,
        opacity: 1,
        x: 0,
        y: 0,
        rotation: 0,
        scaleX: 1,
        scaleY: 1,
        points: penDraft,
        closed,
        fill: 'transparent',
        stroke: '#0f172a',
        strokeWidth: 2,
      })
      current.selectedLayerId = current.layers[0].id
    }, 'Pen path')
    setPenDraft([])
  }

  return {
    beginTextEntry,
    commitPen,
  }
}
