import type { AssetBlobRecord, Layer, PanelId, Project } from '../../../types'

export const normalizeDockGroups = (panelOrder: PanelId[], hiddenPanels: PanelId[], groups?: PanelId[][]) => {
  const hidden = new Set(hiddenPanels)
  const visibleOrdered = panelOrder.filter((panelId) => !hidden.has(panelId))
  const used = new Set<PanelId>()
  const nextGroups: PanelId[][] = []

  for (const group of groups ?? []) {
    const normalized = group.filter((panelId) => !hidden.has(panelId) && !used.has(panelId))
    if (normalized.length === 0) continue
    normalized.forEach((panelId) => used.add(panelId))
    nextGroups.push(normalized)
  }

  for (const panelId of visibleOrdered) {
    if (used.has(panelId)) continue
    nextGroups.push([panelId])
  }
  return nextGroups
}

export const isTextLayer = (layer: Layer): layer is Extract<Layer, { kind: 'vector-text' | 'raster-text' }> =>
  layer.kind === 'vector-text' || layer.kind === 'raster-text'

export const documentBackdropStyle = () => ({
  backgroundColor: '#ffffff',
  backgroundImage: `
    linear-gradient(45deg, #e2e8f0 25%, transparent 25%),
    linear-gradient(-45deg, #e2e8f0 25%, transparent 25%),
    linear-gradient(45deg, transparent 75%, #e2e8f0 75%),
    linear-gradient(-45deg, transparent 75%, #e2e8f0 75%)
  `,
  backgroundSize: '20px 20px',
  backgroundPosition: '0 0, 0 10px, 10px -10px, -10px 0px',
})

export const downloadBlob = (blob: Blob, fileName: string) => {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = fileName
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 3000)
}

type PointEvent = { clientX: number; clientY: number }

export const docPoint = (event: PointEvent, stage: HTMLDivElement, project: Project) => {
  const rect = stage.getBoundingClientRect()
  return {
    x: (event.clientX - rect.left - project.view.panX) / project.view.zoom,
    y: (event.clientY - rect.top - project.view.panY) / project.view.zoom,
  }
}

export const rectFromPoints = (a: { x: number; y: number }, b: { x: number; y: number }) => {
  const left = Math.min(a.x, b.x)
  const top = Math.min(a.y, b.y)
  const right = Math.max(a.x, b.x)
  const bottom = Math.max(a.y, b.y)
  return { left, top, right, bottom, width: right - left, height: bottom - top }
}

export const getLayerLocalBounds = (layer: Layer): { left: number; top: number; right: number; bottom: number } | null => {
  if ('width' in layer && 'height' in layer) {
    return { left: 0, top: 0, right: layer.width, bottom: layer.height }
  }
  if (isTextLayer(layer)) {
    const fontSize = Math.max(8, layer.fontSize || 16)
    const text = layer.text ?? ''
    const width = Math.max(fontSize * 0.8, text.length * fontSize * 0.58)
    const height = Math.max(18, fontSize * 1.35)
    return { left: 0, top: 0, right: width, bottom: height }
  }
  if (layer.kind === 'vector-path' && layer.points.length > 0) {
    const xs = layer.points.map((p) => p.anchor.x)
    const ys = layer.points.map((p) => p.anchor.y)
    return {
      left: Math.min(...xs),
      top: Math.min(...ys),
      right: Math.max(...xs),
      bottom: Math.max(...ys),
    }
  }
  return null
}

export const subtractRect = (
  base: { left: number; top: number; right: number; bottom: number },
  cut: { left: number; top: number; right: number; bottom: number },
) => {
  const overlapLeft = Math.max(base.left, cut.left)
  const overlapTop = Math.max(base.top, cut.top)
  const overlapRight = Math.min(base.right, cut.right)
  const overlapBottom = Math.min(base.bottom, cut.bottom)
  if (overlapLeft >= overlapRight || overlapTop >= overlapBottom) return [base]

  const next: Array<{ left: number; top: number; right: number; bottom: number }> = []
  if (overlapTop > base.top) next.push({ left: base.left, top: base.top, right: base.right, bottom: overlapTop })
  if (overlapBottom < base.bottom) next.push({ left: base.left, top: overlapBottom, right: base.right, bottom: base.bottom })
  if (overlapLeft > base.left) next.push({ left: base.left, top: overlapTop, right: overlapLeft, bottom: overlapBottom })
  if (overlapRight < base.right) next.push({ left: overlapRight, top: overlapTop, right: base.right, bottom: overlapBottom })
  return next.filter((rect) => rect.right - rect.left > 0 && rect.bottom - rect.top > 0)
}

export const intersectRect = (
  a: { left: number; top: number; right: number; bottom: number },
  b: { left: number; top: number; right: number; bottom: number },
) => {
  const left = Math.max(a.left, b.left)
  const top = Math.max(a.top, b.top)
  const right = Math.min(a.right, b.right)
  const bottom = Math.min(a.bottom, b.bottom)
  if (left >= right || top >= bottom) return null
  return { left, top, right, bottom }
}

export const clampRectToBounds = (
  rect: { left: number; top: number; right: number; bottom: number },
  bounds: { left: number; top: number; right: number; bottom: number },
) => intersectRect(rect, bounds)

export const addLayerFromAsset = async (
  project: Project,
  asset: AssetBlobRecord,
  point: { x: number; y: number },
  rasterizeScale: number,
  updateProject: (projectId: string, recipe: (project: Project) => void, label?: string) => void,
  deps: { loadImage: (src: string) => Promise<HTMLImageElement>; toDataUrl: (blob: Blob) => Promise<string>; uid: (prefix: string) => string },
) => {
  const { loadImage, toDataUrl, uid } = deps
  if (project.type === 'raster') {
    if (asset.kind === 'raster' && asset.blob) {
      const img = await loadImage(await toDataUrl(asset.blob))
      updateProject(project.id, (current) => {
        current.layers.unshift({
          id: uid('layer'),
          kind: 'raster-image',
          name: asset.name,
          visible: true,
          locked: false,
          opacity: 1,
          x: point.x,
          y: point.y,
          rotation: 0,
          scaleX: 1,
          scaleY: 1,
          assetId: asset.id,
          width: img.naturalWidth,
          height: img.naturalHeight,
        })
      }, 'Drop raster asset')
    }
    if (asset.kind === 'svg' && asset.svgText) {
      const img = await loadImage(await toDataUrl(new Blob([asset.svgText], { type: 'image/svg+xml' })))
      updateProject(project.id, (current) => {
        current.layers.unshift({
          id: uid('layer'),
          kind: 'raster-image',
          name: `${asset.name} (${rasterizeScale}x)`,
          visible: true,
          locked: false,
          opacity: 1,
          x: point.x,
          y: point.y,
          rotation: 0,
          scaleX: 1,
          scaleY: 1,
          assetId: asset.id,
          width: img.naturalWidth * rasterizeScale,
          height: img.naturalHeight * rasterizeScale,
        })
      }, 'Drop SVG rasterized')
    }
  } else {
    if (asset.kind === 'svg' && asset.svgText) {
      updateProject(project.id, (current) => {
        current.layers.unshift({
          id: uid('layer'),
          kind: 'vector-rect',
          name: `${asset.name} Vector`,
          visible: true,
          locked: false,
          opacity: 1,
          x: point.x,
          y: point.y,
          rotation: 0,
          scaleX: 1,
          scaleY: 1,
          width: 220,
          height: 140,
          fill: '#14b8a6',
          stroke: '#0f172a',
          strokeWidth: 1,
        })
      }, 'Drop SVG into vector')
    }
    if (asset.kind === 'raster' && asset.blob) {
      const img = await loadImage(await toDataUrl(asset.blob))
      updateProject(project.id, (current) => {
        current.layers.unshift({
          id: uid('layer'),
          kind: 'vector-reference',
          name: `${asset.name} (reference)`,
          visible: true,
          locked: true,
          opacity: 0.8,
          x: point.x,
          y: point.y,
          rotation: 0,
          scaleX: 1,
          scaleY: 1,
          assetId: asset.id,
          width: img.naturalWidth,
          height: img.naturalHeight,
        })
      }, 'Drop raster reference')
    }
  }
}
