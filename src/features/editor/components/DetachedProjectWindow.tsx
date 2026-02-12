import type { PointerEvent as ReactPointerEvent } from 'react'
import { useMemo } from 'react'
import type { AssetBlobRecord, Project } from '../../../types'
import { LayerRaster } from '../renderers/LayerRaster'
import { LayerVector } from '../renderers/LayerVector'
import { documentBackdropStyle } from '../utils/editorHelpers'

type DetachedProjectWindowProps = {
  project: Project
  assets: Record<string, AssetBlobRecord>
  isActive: boolean
  x: number
  y: number
  width: number
  height: number
  z: number
  onPointerDownHeader: (event: ReactPointerEvent<HTMLDivElement>) => void
  onPointerDownResize: (event: ReactPointerEvent<HTMLDivElement>) => void
  onClose: () => void
  onFocus: () => void
}

export const DetachedProjectWindow = ({
  project,
  assets,
  isActive,
  x,
  y,
  width,
  height,
  z,
  onPointerDownHeader,
  onPointerDownResize,
  onClose,
  onFocus,
}: DetachedProjectWindowProps) => {
  const visibleLayers = useMemo(
    () => project.layers.filter((layer) => layer.visible),
    [project.layers],
  )
  const stackedLayers = useMemo(
    () => [...visibleLayers].reverse(),
    [visibleLayers],
  )
  const docScale = Math.max(
    0.1,
    Math.min(
      1,
      (width - 24) / Math.max(1, project.document.width),
      (height - 52) / Math.max(1, project.document.height),
    ),
  )
  const docLeft = Math.max(8, ((width - 16) - project.document.width * docScale) / 2 + 8)
  const docTop = Math.max(30, ((height - 40) - project.document.height * docScale) / 2 + 30)

  return (
    <div
      className={`absolute rounded border bg-slate-950 shadow-xl ${
        isActive ? 'border-cyan-500' : 'border-slate-700'
      }`}
      style={{ left: x, top: y, width, height, zIndex: z }}
      onMouseDown={onFocus}
    >
      <div
        className="flex cursor-move items-center justify-between border-b border-slate-700 px-2 py-1 text-xs"
        onPointerDown={onPointerDownHeader}
      >
        <span className="text-slate-100">{project.name}</span>
        <button
          className="rounded border border-slate-700 px-2 py-[1px] text-slate-300 hover:bg-slate-800 hover:text-slate-100"
          onClick={onClose}
          aria-label={`Close ${project.name}`}
        >
          x
        </button>
      </div>
      <div className="relative h-[calc(100%-26px)] overflow-hidden bg-[radial-gradient(circle_at_1px_1px,_#334155_1px,_transparent_0)] bg-[size:24px_24px]">
        <div
          className="absolute origin-top-left border border-slate-500/60 shadow-[0_0_0_1px_rgba(0,0,0,0.2)]"
          style={{
            width: project.document.width,
            height: project.document.height,
            transform: `translate(${docLeft}px, ${docTop}px) scale(${docScale})`,
            ...documentBackdropStyle(),
          }}
        >
          {project.type === 'vector' ? (
            <svg width={project.document.width} height={project.document.height}>
              {stackedLayers.map((layer) => (
                <LayerVector key={layer.id} layer={layer} asset={assets[(layer as { assetId?: string }).assetId ?? '']} />
              ))}
            </svg>
          ) : (
            <div className="relative h-full w-full">
              {stackedLayers.map((layer) => (
                <LayerRaster key={layer.id} layer={layer} asset={assets[(layer as { assetId?: string }).assetId ?? '']} />
              ))}
            </div>
          )}
        </div>
      </div>
      <div className="absolute bottom-0 right-0 h-3 w-3 cursor-se-resize bg-slate-600" onPointerDown={onPointerDownResize} />
    </div>
  )
}
