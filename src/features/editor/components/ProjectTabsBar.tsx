import type { Project } from '../../../types'

type ProjectTabsBarProps = {
  openProjectIds: string[]
  activeProjectId: string
  projects: Record<string, Project>
  onSetActiveProject: (projectId: string) => void
  onCloseProjectTab: (projectId: string) => void
}

export const ProjectTabsBar = ({
  openProjectIds,
  activeProjectId,
  projects,
  onSetActiveProject,
  onCloseProjectTab,
}: ProjectTabsBarProps) => (
  <div className="flex h-9 items-center border-b border-slate-800 bg-slate-900/70 px-1">
    {openProjectIds.map((id) => (
      <div key={id} className={`mr-1 flex items-center rounded-t border px-2 py-1 text-xs ${id === activeProjectId ? 'border-slate-600 bg-slate-800' : 'border-slate-800 bg-slate-900'}`}>
        <button onClick={() => onSetActiveProject(id)}>{projects[id].name}</button>
        <button className="ml-2 text-slate-400 hover:text-slate-100" onClick={() => onCloseProjectTab(id)}>x</button>
      </div>
    ))}
  </div>
)
