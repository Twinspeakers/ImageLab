import { ChangeEvent, useEffect, useMemo, useRef, useState } from 'react'
import { formatDate } from '../lib/utils'
import { useAppStore } from '../store/useAppStore'
import appLogo from '../assets/app-logo.svg'
import type { ProjectType } from '../types'

const ARM_WINDOW_MS = 3000

type StartOverlayProps = {
  canDismiss: boolean
  onRequestClose: () => void
}

export const StartOverlay = ({ canDismiss, onRequestClose }: StartOverlayProps) => {
  const recents = useAppStore((state) => state.recents)
  const createProject = useAppStore((state) => state.createProject)
  const openProject = useAppStore((state) => state.openProject)
  const importIlp = useAppStore((state) => state.importIlp)
  const renameProject = useAppStore((state) => state.renameProject)
  const deleteProject = useAppStore((state) => state.deleteProject)
  const setShowStartOverlay = useAppStore((state) => state.setShowStartOverlay)

  const [name, setName] = useState('Untitled')
  const [type, setType] = useState<ProjectType>('raster')
  const [width, setWidth] = useState(1920)
  const [height, setHeight] = useState(1080)
  const [backgroundMode, setBackgroundMode] = useState<'transparent' | 'white' | 'black' | 'custom'>('transparent')
  const [backgroundColor, setBackgroundColor] = useState('#ffffff')
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const [armedDeleteId, setArmedDeleteId] = useState<string | null>(null)

  const renameInputRef = useRef<HTMLInputElement | null>(null)
  const skipBlurSaveRef = useRef(false)
  const deleteArmTimerRef = useRef<number | null>(null)

  const sortedRecents = useMemo(() => recents.slice(0, 12), [recents])

  useEffect(() => {
    if (!renamingId) return
    const input = renameInputRef.current
    if (!input) return
    input.focus()
    input.select()
  }, [renamingId])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      if (!canDismiss) return
      event.preventDefault()
      onRequestClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [canDismiss, onRequestClose])

  useEffect(() => {
    return () => {
      if (deleteArmTimerRef.current !== null) {
        window.clearTimeout(deleteArmTimerRef.current)
      }
    }
  }, [])

  const clearDeleteArm = () => {
    if (deleteArmTimerRef.current !== null) {
      window.clearTimeout(deleteArmTimerRef.current)
      deleteArmTimerRef.current = null
    }
    setArmedDeleteId(null)
  }

  const onCreate = async () => {
    await createProject({ name, type, width, height, backgroundMode, backgroundColor })
    setShowStartOverlay(false)
    onRequestClose()
  }

  const onOpenIlp = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    await importIlp(file)
    setShowStartOverlay(false)
    onRequestClose()
    event.target.value = ''
  }

  const onOpenRecent = async (id: string) => {
    await openProject(id)
    setShowStartOverlay(false)
    onRequestClose()
  }

  const onStartRename = (id: string, currentName: string) => {
    clearDeleteArm()
    skipBlurSaveRef.current = false
    setRenamingId(id)
    setRenameValue(currentName)
  }

  const onCancelRename = () => {
    setRenamingId(null)
    setRenameValue('')
  }

  const onCommitRename = async (id: string) => {
    const trimmed = renameValue.trim()
    if (!trimmed) {
      onCancelRename()
      return
    }
    await renameProject(id, trimmed)
    onCancelRename()
  }

  const onDeleteClick = async (id: string) => {
    if (armedDeleteId === id) {
      clearDeleteArm()
      await deleteProject(id)
      return
    }

    if (deleteArmTimerRef.current !== null) {
      window.clearTimeout(deleteArmTimerRef.current)
    }
    setArmedDeleteId(id)
    deleteArmTimerRef.current = window.setTimeout(() => {
      setArmedDeleteId((current) => (current === id ? null : current))
      deleteArmTimerRef.current = null
    }, ARM_WINDOW_MS)
  }

  return (
    <div
      className="absolute inset-0 z-[1800] flex items-center justify-center bg-slate-950/70 p-6"
      onMouseDown={(event) => {
        if (event.target !== event.currentTarget) return
        if (!canDismiss) return
        onRequestClose()
      }}
    >
      <div className="w-full max-w-[58rem] max-h-[90vh] overflow-auto rounded-xl border border-slate-700 bg-slate-950 text-slate-100 shadow-2xl">
        <div className="mx-auto flex max-w-[58rem] flex-col gap-8 p-8">
          <header className="flex items-center justify-between">
            <div>
              <h1 className="flex items-center gap-3 text-3xl font-semibold">
                <img src={appLogo} alt="" aria-hidden="true" className="h-8 w-8" />
                <span>imagelab</span>
              </h1>
              <p className="text-sm text-slate-400">Local-first raster + vector editor</p>
            </div>
            <div className="flex items-center gap-2">
              <label className="rounded border border-slate-600 bg-slate-800 px-3 py-2 text-sm hover:bg-slate-700">
                Open Project (.ilp)
                <input type="file" accept=".ilp,application/json" className="hidden" onChange={onOpenIlp} />
              </label>
              <button
                className="rounded border border-slate-600 bg-slate-900 px-3 py-2 text-sm hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40"
                onClick={onRequestClose}
                disabled={!canDismiss}
              >
                Close
              </button>
            </div>
          </header>

          <section className="grid gap-6 lg:grid-cols-2">
            <div className="rounded border border-slate-700 bg-slate-900 p-5">
              <h2 className="mb-4 text-lg font-semibold">New Project</h2>
              <div className="grid gap-3">
                <label className="text-sm">
                  Name
                  <input
                    className="mt-1 w-full rounded border border-slate-700 bg-slate-950 px-2 py-1"
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                  />
                </label>
                <label className="text-sm">
                  Type
                  <select
                    className="mt-1 w-full rounded border border-slate-700 bg-slate-950 px-2 py-1"
                    value={type}
                    onChange={(event) => setType(event.target.value as ProjectType)}
                  >
                    <option value="raster">Raster</option>
                    <option value="vector">Vector</option>
                  </select>
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <label className="text-sm">
                    Width
                    <input
                      type="number"
                      min={64}
                      className="mt-1 w-full rounded border border-slate-700 bg-slate-950 px-2 py-1"
                      value={width}
                      onChange={(event) => setWidth(Number(event.target.value))}
                    />
                  </label>
                  <label className="text-sm">
                    Height
                    <input
                      type="number"
                      min={64}
                      className="mt-1 w-full rounded border border-slate-700 bg-slate-950 px-2 py-1"
                      value={height}
                      onChange={(event) => setHeight(Number(event.target.value))}
                    />
                  </label>
                </div>
                <label className="text-sm">
                  Background
                  <select
                    className="mt-1 w-full rounded border border-slate-700 bg-slate-950 px-2 py-1"
                    value={backgroundMode}
                    onChange={(event) => setBackgroundMode(event.target.value as 'transparent' | 'white' | 'black' | 'custom')}
                  >
                    <option value="transparent">Transparent</option>
                    <option value="white">White</option>
                    <option value="black">Black</option>
                    <option value="custom">Custom</option>
                  </select>
                </label>
                {backgroundMode === 'custom' && (
                  <label className="text-sm">
                    Color
                    <input
                      type="color"
                      value={backgroundColor}
                      className="mt-1 h-9 w-full rounded border border-slate-700 bg-slate-950 px-1 py-1"
                      onChange={(event) => setBackgroundColor(event.target.value)}
                    />
                  </label>
                )}
                <button
                  className="mt-2 rounded bg-cyan-600 px-3 py-2 text-sm font-semibold hover:bg-cyan-500"
                  onClick={() => void onCreate()}
                >
                  New Project
                </button>
              </div>
            </div>

            <div className="rounded border border-slate-700 bg-slate-900 p-5">
              <h2 className="mb-4 text-lg font-semibold">Recent Projects</h2>
              <div className="max-h-[460px] space-y-2 overflow-auto">
                {sortedRecents.length === 0 && <p className="text-sm text-slate-400">No recent projects yet.</p>}
                {sortedRecents.map((recent) => {
                  const isRenaming = renamingId === recent.id
                  const isDeleteArmed = armedDeleteId === recent.id
                  return (
                    <div
                      key={recent.id}
                      className="group flex items-center gap-2 rounded border border-slate-700 bg-slate-950 px-3 py-2 text-left text-sm hover:border-slate-500"
                    >
                      {isRenaming ? (
                        <div className="flex min-w-0 flex-1 items-center justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <input
                              ref={renameInputRef}
                              className="w-full rounded border border-slate-600 bg-slate-900 px-2 py-1 font-medium focus:border-cyan-500 focus:outline-none"
                              value={renameValue}
                              onClick={(event) => event.stopPropagation()}
                              onChange={(event) => setRenameValue(event.target.value)}
                              onBlur={() => {
                                if (skipBlurSaveRef.current) {
                                  skipBlurSaveRef.current = false
                                  return
                                }
                                void onCommitRename(recent.id)
                              }}
                              onKeyDown={(event) => {
                                if (event.key === 'Enter') {
                                  event.preventDefault()
                                  void onCommitRename(recent.id)
                                }
                                if (event.key === 'Escape') {
                                  event.preventDefault()
                                  skipBlurSaveRef.current = true
                                  onCancelRename()
                                }
                              }}
                            />
                            <span className="mt-1 block text-xs text-slate-500">{recent.type}</span>
                          </div>
                          <span className="shrink-0 text-xs text-slate-500">{formatDate(recent.updatedAt)}</span>
                        </div>
                      ) : (
                        <button
                          className="flex min-w-0 flex-1 items-center justify-between gap-3 text-left focus:outline-none"
                          onClick={() => void onOpenRecent(recent.id)}
                        >
                          <span className="min-w-0">
                            <span className="block truncate font-medium">{recent.name}</span>
                            <span className="block text-xs text-slate-500">{recent.type}</span>
                          </span>
                          <span className="shrink-0 text-xs text-slate-500">{formatDate(recent.updatedAt)}</span>
                        </button>
                      )}
                      <div className="flex shrink-0 items-center gap-1">
                        <button
                          className="inline-flex h-8 w-8 items-center justify-center rounded border border-slate-700 text-base leading-none text-slate-200 hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                          aria-label={`Rename ${recent.name}`}
                          title="Rename"
                          onClick={(event) => {
                            event.preventDefault()
                            event.stopPropagation()
                            onStartRename(recent.id, recent.name)
                          }}
                        >
                          <span aria-hidden="true">✎</span>
                        </button>
                        <button
                          className={`inline-flex h-8 w-8 items-center justify-center rounded border text-base leading-none focus:outline-none focus:ring-2 ${
                            isDeleteArmed
                              ? 'border-red-500 text-red-300 hover:bg-red-950/60 focus:ring-red-500'
                              : 'border-slate-700 text-slate-300 hover:bg-slate-800 focus:ring-cyan-500'
                          }`}
                          aria-label={isDeleteArmed ? `Confirm delete ${recent.name}` : `Delete ${recent.name}`}
                          title={isDeleteArmed ? 'Click again to delete' : 'Delete'}
                          onClick={(event) => {
                            event.preventDefault()
                            event.stopPropagation()
                            void onDeleteClick(recent.id)
                          }}
                        >
                          <span aria-hidden="true">✕</span>
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}
