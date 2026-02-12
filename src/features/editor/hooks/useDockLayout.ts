import { useEffect, useRef, useState } from 'react'
import type { DragEvent, PointerEvent as ReactPointerEvent } from 'react'
import { clamp } from '../../../lib/utils'
import type { PanelId, WorkspacePrefs } from '../../../types'
import { DEFAULT_DOCK_PANEL_HEIGHTS } from '../constants'
import { normalizeDockGroups } from '../utils/editorHelpers'

type DockDropMode = 'before' | 'merge' | 'after'

type UseDockLayoutParams = {
  workspace: WorkspacePrefs
  dockGroups: PanelId[][]
  setWorkspace: (recipe: (workspace: WorkspacePrefs) => void) => void
}

export const useDockLayout = ({ workspace, dockGroups, setWorkspace }: UseDockLayoutParams) => {
  const dockResizeRef = useRef<{ panelId: PanelId; pointerId: number; startY: number; startHeight: number } | null>(null)
  const [dockDropTarget, setDockDropTarget] = useState<{ targetLead: PanelId; mode: DockDropMode } | null>(null)
  const [draggingPanelId, setDraggingPanelId] = useState<PanelId | null>(null)

  const getDockPanelHeight = (panelId: PanelId) =>
    clamp(workspace.dockPanelHeights?.[panelId] ?? DEFAULT_DOCK_PANEL_HEIGHTS[panelId], 120, 560)

  const commitDockGroups = (nextGroups: PanelId[][]) => {
    setWorkspace((current) => {
      current.dockPanelGroups = nextGroups
      const flatVisible = nextGroups.flat()
      const hidden = current.panelOrder.filter((panelId) => current.hiddenPanels.includes(panelId))
      current.panelOrder = [...flatVisible, ...hidden.filter((panelId) => !flatVisible.includes(panelId))]
      if (!flatVisible.includes(current.activePanel)) {
        current.activePanel = flatVisible[0] ?? current.activePanel
      }
    })
  }

  const placePanelInGroup = (panelId: PanelId, targetLead: PanelId, mode: DockDropMode) => {
    const stripped = dockGroups
      .map((group) => group.filter((id) => id !== panelId))
      .filter((group) => group.length > 0)

    const targetIndex = stripped.findIndex((group) => group[0] === targetLead)
    if (targetIndex < 0) {
      commitDockGroups([...stripped, [panelId]])
      return
    }

    if (mode === 'merge') {
      const merged = stripped.map((group, index) =>
        index === targetIndex
          ? group.includes(panelId) ? group : [...group, panelId]
          : group,
      )
      commitDockGroups(merged)
      return
    }

    const insertAt = mode === 'before' ? targetIndex : targetIndex + 1
    const next = stripped.slice()
    next.splice(insertAt, 0, [panelId])
    commitDockGroups(next)
  }

  const resolveDockDropMode = (event: DragEvent<HTMLDivElement>): DockDropMode => {
    const rect = event.currentTarget.getBoundingClientRect()
    const ratio = (event.clientY - rect.top) / Math.max(1, rect.height)
    return ratio < 0.25 ? 'before' : ratio > 0.75 ? 'after' : 'merge'
  }

  const focusPanelInGroup = (panelId: PanelId) => {
    setWorkspace((current) => { current.activePanel = panelId })
  }

  const reorderPanelTabs = (dragPanelId: PanelId, targetPanelId: PanelId) => {
    if (dragPanelId === targetPanelId) return
    setWorkspace((current) => {
      const groups = normalizeDockGroups(current.panelOrder, current.hiddenPanels, current.dockPanelGroups)
      const stripped = groups
        .map((group) => group.filter((panelId) => panelId !== dragPanelId))
        .filter((group) => group.length > 0)
      const targetGroupIndex = stripped.findIndex((group) => group.includes(targetPanelId))
      if (targetGroupIndex < 0) return
      const targetGroup = stripped[targetGroupIndex].slice()
      const insertAt = Math.max(0, targetGroup.indexOf(targetPanelId))
      targetGroup.splice(insertAt, 0, dragPanelId)
      stripped[targetGroupIndex] = targetGroup
      current.dockPanelGroups = stripped
      const flatVisible = stripped.flat()
      const hidden = current.panelOrder.filter((panelId) => current.hiddenPanels.includes(panelId))
      current.panelOrder = [...flatVisible, ...hidden.filter((panelId) => !flatVisible.includes(panelId))]
      current.activePanel = dragPanelId
    })
  }

  const startDockResize = (panelId: PanelId, event: ReactPointerEvent<HTMLDivElement>) => {
    event.preventDefault()
    event.stopPropagation()
    dockResizeRef.current = {
      panelId,
      pointerId: event.pointerId,
      startY: event.clientY,
      startHeight: getDockPanelHeight(panelId),
    }
  }

  useEffect(() => {
    const onPointerMove = (event: PointerEvent) => {
      const resize = dockResizeRef.current
      if (!resize || event.pointerId !== resize.pointerId) return
      const nextHeight = clamp(resize.startHeight + (event.clientY - resize.startY), 120, 560)
      setWorkspace((current) => {
        current.dockPanelHeights = {
          ...(current.dockPanelHeights ?? DEFAULT_DOCK_PANEL_HEIGHTS),
          [resize.panelId]: nextHeight,
        }
      })
    }
    const onPointerUp = (event: PointerEvent) => {
      if (dockResizeRef.current?.pointerId === event.pointerId) {
        dockResizeRef.current = null
      }
    }
    window.addEventListener('pointermove', onPointerMove)
    window.addEventListener('pointerup', onPointerUp)
    return () => {
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('pointerup', onPointerUp)
    }
  }, [setWorkspace])

  return {
    dockDropTarget,
    setDockDropTarget,
    draggingPanelId,
    setDraggingPanelId,
    getDockPanelHeight,
    resolveDockDropMode,
    placePanelInGroup,
    reorderPanelTabs,
    focusPanelInGroup,
    startDockResize,
  }
}

