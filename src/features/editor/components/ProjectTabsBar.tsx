import type { RefObject } from 'react'
import type { Project } from '../../../types'

type ProjectTabsBarProps = {
  barRef?: RefObject<HTMLDivElement | null>
  openProjectIds: string[]
  activeProjectId: string
  projects: Record<string, Project>
  dockTargetActive?: boolean
  hiddenProjectIds?: string[]
  onSetActiveProject: (projectId: string) => void
  onCloseProjectTab: (projectId: string) => void
  onStartProjectDrag?: (projectId: string) => void
}

export const ProjectTabsBar = ({
  barRef,
  openProjectIds,
  activeProjectId,
  projects,
  dockTargetActive = false,
  hiddenProjectIds = [],
  onSetActiveProject,
  onCloseProjectTab,
  onStartProjectDrag,
}: ProjectTabsBarProps) => (
  <div ref={barRef} className="flex h-[29px] items-end border-b border-slate-800 bg-slate-900/70 px-1">
    {openProjectIds.filter((id) => !hiddenProjectIds.includes(id)).map((id) => (
      <div
        key={id}
        draggable
        onDragStart={(event) => {
          event.dataTransfer.setData('imagelab/project-tab', id)
          event.dataTransfer.effectAllowed = 'move'
          onStartProjectDrag?.(id)
        }}
        className={`mr-1 flex items-center rounded-t border px-2 py-1 text-xs ${
          id === activeProjectId
            ? 'border-cyan-500 bg-cyan-950/50 text-cyan-200'
            : 'border-slate-800 bg-slate-900'
        }`}
      >
        <button onClick={() => onSetActiveProject(id)}>{projects[id].name}</button>
        <button className="ml-2 text-slate-400 hover:text-slate-100" onClick={() => onCloseProjectTab(id)}>x</button>
      </div>
    ))}
  </div>
)
