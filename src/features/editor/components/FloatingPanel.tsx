import { type PointerEvent as ReactPointerEvent, useEffect, useRef, type ReactNode } from 'react'
import { PANEL_TITLES } from '../constants'
import type { PanelId } from '../../../types'

type FloatingPanelProps = {
  panelId: PanelId
  x: number
  y: number
  width: number
  height: number
  z: number
  onMove: (patch: { x?: number; y?: number; width?: number; height?: number; z?: number }) => void
  onDock: () => void
  children: ReactNode
}

export const FloatingPanel = ({
  panelId, x, y, width, height, z, onMove, onDock, children,
}: FloatingPanelProps) => {
  const dragRef = useRef<{ mode: 'move' | 'resize'; id: number; x: number; y: number; bx: number; by: number; bw: number; bh: number } | null>(null)

  const startFloatingMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    dragRef.current = { mode: 'move', id: event.pointerId, x: event.clientX, y: event.clientY, bx: x, by: y, bw: width, bh: height }
  }

  const startFloatingResize = (event: ReactPointerEvent<HTMLDivElement>) => {
    dragRef.current = { mode: 'resize', id: event.pointerId, x: event.clientX, y: event.clientY, bx: x, by: y, bw: width, bh: height }
  }

  useEffect(() => {
    const move = (event: PointerEvent) => {
      const drag = dragRef.current
      if (!drag || event.pointerId !== drag.id) return
      const dx = event.clientX - drag.x
      const dy = event.clientY - drag.y
      if (drag.mode === 'move') onMove({ x: Math.max(0, drag.bx + dx), y: Math.max(0, drag.by + dy), z: 999 })
      else onMove({ width: Math.max(240, drag.bw + dx), height: Math.max(160, drag.bh + dy) })
    }
    const up = (event: PointerEvent) => {
      if (dragRef.current?.id === event.pointerId) dragRef.current = null
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    return () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
    }
  }, [onMove])

  return (
    <div className="absolute rounded border border-slate-700 bg-slate-900 shadow-xl" style={{ left: x, top: y, width, height, zIndex: z }}>
      <div className="flex cursor-move items-center justify-between border-b border-slate-700 px-2 py-1 text-xs" onPointerDown={startFloatingMove}>
        <span>{PANEL_TITLES[panelId]}</span>
        <button className="rounded border border-slate-700 px-1 py-[1px]" onClick={onDock}>Dock</button>
      </div>
      <div className="h-[calc(100%-26px)] overflow-auto">{children}</div>
      <div className="absolute bottom-0 right-0 h-3 w-3 cursor-se-resize bg-slate-600" onPointerDown={startFloatingResize} />
    </div>
  )
}
