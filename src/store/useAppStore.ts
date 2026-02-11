import { create } from 'zustand'
import { bulkPutAssets, deleteProject as deleteProjectRecord, getAllAssets, getAllProjects, getProject, getRecentProjects, putAsset, putProject, renameProject as renameProjectRecord } from '../lib/idb'
import { deepClone, debounce, uid } from '../lib/utils'
import type {
  AssetBlobRecord,
  AssetRecord,
  FloatingPanel,
  Layer,
  PanelId,
  Project,
  ProjectType,
  RecentProject,
  Swatch,
  ToolId,
  WorkspacePrefs,
} from '../types'

const PREFS_KEY = 'imagelab-workspace-prefs'

const defaultSwatches: Swatch[] = [
  { id: uid('sw'), name: 'Ink', type: 'solid', value: '#111827ff' },
  { id: uid('sw'), name: 'Paper', type: 'solid', value: '#f9fafbff' },
  { id: uid('sw'), name: 'Sunset', type: 'linear-gradient', value: 'linear-gradient(90deg,#f97316,#fb7185)' },
]

const defaultPrefs: WorkspacePrefs = {
  panelOrder: ['layers', 'properties', 'assets', 'swatches', 'history'],
  hiddenPanels: [],
  activePanel: 'layers',
  floatingPanels: [],
  swatches: defaultSwatches,
  rasterizeScale: 2,
}

const readPrefs = (): WorkspacePrefs => {
  const raw = localStorage.getItem(PREFS_KEY)
  if (!raw) return defaultPrefs
  try {
    return { ...defaultPrefs, ...JSON.parse(raw) as WorkspacePrefs }
  } catch {
    return defaultPrefs
  }
}

const writePrefs = debounce((prefs: WorkspacePrefs) => {
  localStorage.setItem(PREFS_KEY, JSON.stringify(prefs))
}, 200)

type HistoryRecord = {
  past: Project[]
  future: Project[]
  labels: string[]
}

interface AppState {
  initialized: boolean
  projects: Record<string, Project>
  openProjectIds: string[]
  activeProjectId: string | null
  recents: RecentProject[]
  assets: Record<string, AssetBlobRecord>
  workspace: WorkspacePrefs
  historyByProject: Record<string, HistoryRecord>
  clipboard: Layer[] | null
  shortcutsOpen: boolean
  showStartOverlay: boolean
  avifSupported: boolean | null
  initialize: () => Promise<void>
  createProject: (input: {
    name: string
    type: ProjectType
    width: number
    height: number
    backgroundMode: Project['document']['backgroundMode']
    backgroundColor: string
  }) => Promise<Project>
  openProject: (projectId: string) => Promise<void>
  renameProject: (projectId: string, name: string) => Promise<void>
  deleteProject: (projectId: string) => Promise<void>
  closeProjectTab: (projectId: string) => void
  setActiveProject: (projectId: string) => void
  updateProject: (projectId: string, recipe: (project: Project) => void, label?: string) => void
  undo: (projectId: string) => void
  redo: (projectId: string) => void
  jumpToHistory: (projectId: string, index: number) => void
  addAssetFromFile: (file: File) => Promise<AssetBlobRecord | null>
  importIlp: (file: File) => Promise<void>
  exportIlp: (projectId: string) => Promise<Blob>
  setWorkspace: (recipe: (ws: WorkspacePrefs) => void) => void
  resetWorkspace: () => void
  dockAllPanels: () => void
  bringPanelsToFront: () => void
  togglePanelVisibility: (panelId: PanelId) => void
  popoutPanel: (panelId: PanelId) => void
  redockPanel: (floatingId: string) => void
  moveFloatingPanel: (floatingId: string, patch: Partial<FloatingPanel>) => void
  setToolForActive: (tool: ToolId) => void
  setShortcutsOpen: (open: boolean) => void
  setShowStartOverlay: (open: boolean) => void
  setAvifSupport: (supported: boolean) => void
}

const saveTimers = new Map<string, number>()

const persistProjectSoon = (project: Project) => {
  const existing = saveTimers.get(project.id)
  if (existing !== undefined) window.clearTimeout(existing)
  const timeout = window.setTimeout(() => {
    void putProject(project)
  }, 400)
  saveTimers.set(project.id, timeout)
}

const pushHistory = (record: HistoryRecord | undefined, snapshot: Project, label: string): HistoryRecord => {
  if (!record) {
    return { past: [snapshot], future: [], labels: [label] }
  }
  return {
    past: [...record.past, snapshot].slice(-100),
    future: [],
    labels: [...record.labels, label].slice(-100),
  }
}

const detectAvifSupport = async () => {
  const c = document.createElement('canvas')
  c.width = 1
  c.height = 1
  return new Promise<boolean>((resolve) => {
    c.toBlob((blob) => resolve(Boolean(blob)), 'image/avif')
  })
}

export const useAppStore = create<AppState>((set, get) => ({
  initialized: false,
  projects: {},
  openProjectIds: [],
  activeProjectId: null,
  recents: [],
  assets: {},
  workspace: readPrefs(),
  historyByProject: {},
  clipboard: null,
  shortcutsOpen: false,
  showStartOverlay: false,
  avifSupported: null,

  initialize: async () => {
    const [projects, recents, assets, avifSupported] = await Promise.all([
      getAllProjects(),
      getRecentProjects(),
      getAllAssets(),
      detectAvifSupport(),
    ])
    set({
      initialized: true,
      projects: Object.fromEntries(projects.map((project) => [project.id, project])),
      recents,
      assets: Object.fromEntries(assets.map((asset) => [asset.id, asset])),
      avifSupported,
    })
  },

  createProject: async ({ name, type, width, height, backgroundMode, backgroundColor }) => {
    const backgroundFill =
      backgroundMode === 'transparent'
        ? 'transparent'
        : backgroundMode === 'custom'
          ? backgroundColor
          : backgroundMode
    const backgroundLayerId = uid('layer')
    const project: Project = {
      id: uid('project'),
      name,
      type,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      document: {
        width,
        height,
        backgroundMode,
        backgroundColor,
      },
      layers: [
        {
          id: backgroundLayerId,
          kind: 'vector-rect',
          name: 'Background',
          protected: true,
          visible: true,
          locked: false,
          opacity: 1,
          x: 0,
          y: 0,
          rotation: 0,
          scaleX: 1,
          scaleY: 1,
          width,
          height,
          segments: [{ x: 0, y: 0, width, height }],
          fill: backgroundFill,
          stroke: 'transparent',
          strokeWidth: 0,
        },
      ],
      selectedLayerId: backgroundLayerId,
      activeTool: 'move',
      view: {
        panX: 40,
        panY: 40,
        zoom: 1,
      },
    }
    await putProject(project)
    set((state) => ({
      projects: { ...state.projects, [project.id]: project },
      recents: [
        { id: project.id, name: project.name, updatedAt: project.updatedAt, type: project.type },
        ...state.recents.filter((item) => item.id !== project.id),
      ],
      openProjectIds: [...state.openProjectIds.filter((id) => id !== project.id), project.id],
      activeProjectId: project.id,
      historyByProject: {
        ...state.historyByProject,
        [project.id]: { past: [], future: [], labels: [] },
      },
    }))
    return project
  },

  openProject: async (projectId) => {
    const existing = get().projects[projectId]
    const loaded = existing ?? (await getProject(projectId))
    if (!loaded) return
    set((state) => ({
      projects: { ...state.projects, [loaded.id]: loaded },
      openProjectIds: state.openProjectIds.includes(loaded.id) ? state.openProjectIds : [...state.openProjectIds, loaded.id],
      activeProjectId: loaded.id,
      historyByProject: state.historyByProject[loaded.id]
        ? state.historyByProject
        : { ...state.historyByProject, [loaded.id]: { past: [], future: [], labels: [] } },
    }))
  },

  renameProject: async (projectId, name) => {
    const trimmed = name.trim()
    if (!trimmed) return
    const state = get()
    const existing = state.projects[projectId]
    let next: Project | null = null
    if (existing) {
      if (existing.name === trimmed) return
      next = { ...existing, name: trimmed, updatedAt: new Date().toISOString() }
      await putProject(next)
    } else {
      next = await renameProjectRecord(projectId, trimmed)
      if (!next) return
    }

    set((s) => ({
      projects: { ...s.projects, [projectId]: next },
      recents: [{ id: next.id, name: next.name, updatedAt: next.updatedAt, type: next.type }, ...s.recents.filter((r) => r.id !== projectId)].slice(0, 20),
    }))
  },

  deleteProject: async (projectId) => {
    const timer = saveTimers.get(projectId)
    if (timer !== undefined) {
      window.clearTimeout(timer)
      saveTimers.delete(projectId)
    }
    await deleteProjectRecord(projectId)
    set((state) => {
      const nextRecents = state.recents.filter((r) => r.id !== projectId)
      const nextProjects = { ...state.projects }
      const nextHistory = { ...state.historyByProject }
      delete nextProjects[projectId]
      delete nextHistory[projectId]
      const nextOpen = state.openProjectIds.filter((id) => id !== projectId)
      return {
        recents: nextRecents,
        projects: nextProjects,
        historyByProject: nextHistory,
        openProjectIds: nextOpen,
        activeProjectId: state.activeProjectId === projectId ? nextOpen[nextOpen.length - 1] ?? null : state.activeProjectId,
      }
    })
  },


  closeProjectTab: (projectId) => {
    set((state) => {
      const openProjectIds = state.openProjectIds.filter((id) => id !== projectId)
      return {
        openProjectIds,
        activeProjectId: state.activeProjectId === projectId ? openProjectIds[openProjectIds.length - 1] ?? null : state.activeProjectId,
      }
    })
  },

  setActiveProject: (projectId) => {
    set({ activeProjectId: projectId })
  },

  updateProject: (projectId, recipe, label = 'Update') => {
    const current = get().projects[projectId]
    if (!current) return
    const before = deepClone(current)
    const next = deepClone(current)
    recipe(next)
    next.updatedAt = new Date().toISOString()

    set((state) => ({
      projects: { ...state.projects, [projectId]: next },
      recents: [
        { id: next.id, name: next.name, updatedAt: next.updatedAt, type: next.type },
        ...state.recents.filter((item) => item.id !== next.id),
      ].slice(0, 20),
      historyByProject: {
        ...state.historyByProject,
        [projectId]: pushHistory(state.historyByProject[projectId], before, label),
      },
    }))
    persistProjectSoon(next)
  },

  undo: (projectId) => {
    const state = get()
    const project = state.projects[projectId]
    const history = state.historyByProject[projectId]
    if (!project || !history || history.past.length === 0) return
    const previous = history.past[history.past.length - 1]
    set({
      projects: { ...state.projects, [projectId]: previous },
      historyByProject: {
        ...state.historyByProject,
        [projectId]: {
          past: history.past.slice(0, -1),
          future: [deepClone(project), ...history.future],
          labels: history.labels.slice(0, -1),
        },
      },
    })
    persistProjectSoon(previous)
  },

  redo: (projectId) => {
    const state = get()
    const project = state.projects[projectId]
    const history = state.historyByProject[projectId]
    if (!project || !history || history.future.length === 0) return
    const [next, ...rest] = history.future
    set({
      projects: { ...state.projects, [projectId]: next },
      historyByProject: {
        ...state.historyByProject,
        [projectId]: {
          past: [...history.past, deepClone(project)],
          future: rest,
          labels: [...history.labels, 'Redo'],
        },
      },
    })
    persistProjectSoon(next)
  },

  jumpToHistory: (projectId, index) => {
    const state = get()
    const project = state.projects[projectId]
    const history = state.historyByProject[projectId]
    if (!project || !history || index < 0 || index >= history.past.length) return
    const target = history.past[index]
    const past = history.past.slice(0, index)
    const future = [...history.past.slice(index + 1), deepClone(project), ...history.future]
    set({
      projects: { ...state.projects, [projectId]: target },
      historyByProject: {
        ...state.historyByProject,
        [projectId]: {
          past,
          future,
          labels: history.labels.slice(0, index),
        },
      },
    })
    persistProjectSoon(target)
  },

  addAssetFromFile: async (file) => {
    const supported = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/avif', 'image/svg+xml'])
    if (!supported.has(file.type)) return null
    const kind = file.type === 'image/svg+xml' ? 'svg' : 'raster'
    const asset: AssetBlobRecord = {
      id: uid('asset'),
      name: file.name,
      kind,
      mimeType: file.type,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      tags: [],
      favorite: false,
      blob: kind === 'raster' ? file : undefined,
      svgText: kind === 'svg' ? await file.text() : undefined,
    }
    await putAsset(asset)
    set((state) => ({ assets: { ...state.assets, [asset.id]: asset } }))
    return asset
  },

  importIlp: async (file) => {
    const text = await file.text()
    const parsed = JSON.parse(text) as { project: Project; assets: Array<AssetRecord & { data?: string; svgText?: string }> }
    const decoded: AssetBlobRecord[] = await Promise.all(
      parsed.assets.map(async (asset) => {
        if (asset.kind === 'svg') {
          return { ...asset, svgText: asset.svgText }
        }
        const data = asset.data ?? ''
        const response = await fetch(data)
        const blob = await response.blob()
        return { ...asset, blob }
      }),
    )
    await putProject(parsed.project)
    await bulkPutAssets(decoded)
    set((state) => ({
      projects: { ...state.projects, [parsed.project.id]: parsed.project },
      assets: { ...state.assets, ...Object.fromEntries(decoded.map((asset) => [asset.id, asset])) },
      openProjectIds: [...state.openProjectIds.filter((id) => id !== parsed.project.id), parsed.project.id],
      activeProjectId: parsed.project.id,
      recents: [
        { id: parsed.project.id, name: parsed.project.name, updatedAt: parsed.project.updatedAt, type: parsed.project.type },
        ...state.recents.filter((item) => item.id !== parsed.project.id),
      ],
    }))
  },

  exportIlp: async (projectId) => {
    const state = get()
    const project = state.projects[projectId]
    const assets = Object.values(state.assets)
    const serialized = await Promise.all(
      assets.map(async (asset) => {
        if (asset.kind === 'svg') {
          return { ...asset, data: undefined, blob: undefined }
        }
        if (!asset.blob) {
          return { ...asset, data: undefined, blob: undefined }
        }
        const data = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader()
          reader.onload = () => resolve(String(reader.result))
          reader.onerror = reject
          reader.readAsDataURL(asset.blob as Blob)
        })
        return { ...asset, data, blob: undefined }
      }),
    )
    return new Blob([JSON.stringify({ project, assets: serialized }, null, 2)], { type: 'application/json' })
  },

  setWorkspace: (recipe) => {
    set((state) => {
      const next = deepClone(state.workspace)
      recipe(next)
      writePrefs(next)
      return { workspace: next }
    })
  },

  resetWorkspace: () => {
    set({ workspace: defaultPrefs })
    writePrefs(defaultPrefs)
  },

  dockAllPanels: () => {
    get().setWorkspace((workspace) => {
      workspace.floatingPanels = []
    })
  },

  bringPanelsToFront: () => {
    get().setWorkspace((workspace) => {
      workspace.floatingPanels = workspace.floatingPanels
        .map((panel, index) => ({ ...panel, z: 100 + index }))
        .sort((a, b) => a.z - b.z)
    })
  },

  togglePanelVisibility: (panelId) => {
    get().setWorkspace((workspace) => {
      const hidden = new Set(workspace.hiddenPanels)
      if (hidden.has(panelId)) hidden.delete(panelId)
      else hidden.add(panelId)
      workspace.hiddenPanels = [...hidden]
      if (workspace.hiddenPanels.includes(workspace.activePanel)) {
        workspace.activePanel = workspace.panelOrder.find((panel) => !workspace.hiddenPanels.includes(panel)) ?? 'layers'
      }
    })
  },

  popoutPanel: (panelId) => {
    get().setWorkspace((workspace) => {
      workspace.hiddenPanels = workspace.hiddenPanels.filter((id) => id !== panelId)
      if (workspace.floatingPanels.some((panel) => panel.panelId === panelId)) return
      workspace.floatingPanels.push({
        id: uid('float'),
        panelId,
        x: 50 + workspace.floatingPanels.length * 20,
        y: 80 + workspace.floatingPanels.length * 20,
        width: 320,
        height: 340,
        z: 100 + workspace.floatingPanels.length,
      })
    })
  },

  redockPanel: (floatingId) => {
    get().setWorkspace((workspace) => {
      workspace.floatingPanels = workspace.floatingPanels.filter((panel) => panel.id !== floatingId)
    })
  },

  moveFloatingPanel: (floatingId, patch) => {
    get().setWorkspace((workspace) => {
      workspace.floatingPanels = workspace.floatingPanels.map((panel) =>
        panel.id === floatingId ? { ...panel, ...patch } : panel,
      )
    })
  },

  setToolForActive: (tool) => {
    const active = get().activeProjectId
    if (!active) return
    get().updateProject(
      active,
      (project) => {
        project.activeTool = tool
      },
      `Tool: ${tool}`,
    )
  },

  setShortcutsOpen: (open) => set({ shortcutsOpen: open }),
  setShowStartOverlay: (open) => set({ showStartOverlay: open }),
  setAvifSupport: (supported) => set({ avifSupported: supported }),
}))
