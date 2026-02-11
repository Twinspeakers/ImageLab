import type { AssetBlobRecord, Layer, Project } from '../types'
import { loadImage, toDataUrl } from './utils'

const layerTransform = (layer: Layer) => {
  return `translate(${layer.x} ${layer.y}) rotate(${layer.rotation}) scale(${layer.scaleX} ${layer.scaleY})`
}

const layerOpacity = (layer: Layer) => Math.max(0, Math.min(1, layer.opacity))

export const exportVectorSvg = (project: Project, assetMap: Map<string, AssetBlobRecord>) => {
  const { document } = project
  const defs: string[] = []
  const layers = [...project.layers]
    .reverse()
    .filter((layer) => layer.visible && layer.kind !== 'vector-reference')
    .map((layer) => {
      if (layer.kind === 'vector-rect') {
        return `<g transform="${layerTransform(layer)}" opacity="${layerOpacity(layer)}"><rect width="${layer.width}" height="${layer.height}" fill="${layer.fill}" stroke="${layer.stroke}" stroke-width="${layer.strokeWidth}" /></g>`
      }
      if (layer.kind === 'vector-ellipse') {
        return `<g transform="${layerTransform(layer)}" opacity="${layerOpacity(layer)}"><ellipse cx="${layer.radiusX}" cy="${layer.radiusY}" rx="${layer.radiusX}" ry="${layer.radiusY}" fill="${layer.fill}" stroke="${layer.stroke}" stroke-width="${layer.strokeWidth}" /></g>`
      }
      if (layer.kind === 'vector-text') {
        return `<g transform="${layerTransform(layer)}" opacity="${layerOpacity(layer)}"><text x="0" y="0" fill="${layer.fill}" font-size="${layer.fontSize}">${layer.text}</text></g>`
      }
      if (layer.kind === 'vector-path') {
        const pathData = layer.points
          .map((point, index, list) => {
            if (index === 0) {
              return `M ${point.anchor.x} ${point.anchor.y}`
            }
            const prev = list[index - 1]
            return `C ${prev.outHandle.x} ${prev.outHandle.y}, ${point.inHandle.x} ${point.inHandle.y}, ${point.anchor.x} ${point.anchor.y}`
          })
          .join(' ')
        const closed = layer.closed ? ' Z' : ''
        return `<g transform="${layerTransform(layer)}" opacity="${layerOpacity(layer)}"><path d="${pathData}${closed}" fill="${layer.fill}" stroke="${layer.stroke}" stroke-width="${layer.strokeWidth}" /></g>`
      }
      if (layer.kind === 'raster-image') {
        const asset = assetMap.get(layer.assetId)
        if (!asset?.blob) return ''
        return ''
      }
      return ''
    })
    .join('')

  const backgroundRect =
    document.backgroundMode === 'transparent'
      ? ''
      : `<rect width="${document.width}" height="${document.height}" fill="${document.backgroundMode === 'custom' ? document.backgroundColor : document.backgroundMode}" />`
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${document.width}" height="${document.height}" viewBox="0 0 ${document.width} ${document.height}">
<defs>${defs.join('')}</defs>
${backgroundRect}
${layers}
</svg>`
}

export const renderRasterBlob = async (
  project: Project,
  assetMap: Map<string, AssetBlobRecord>,
  mimeType: string,
  quality = 0.92,
) => {
  const canvas = document.createElement('canvas')
  canvas.width = project.document.width
  canvas.height = project.document.height
  const ctx = canvas.getContext('2d')
  if (!ctx) return null

  if (project.document.backgroundMode !== 'transparent') {
    ctx.fillStyle =
      project.document.backgroundMode === 'custom'
        ? project.document.backgroundColor
        : project.document.backgroundMode
    ctx.fillRect(0, 0, canvas.width, canvas.height)
  }

  for (const layer of [...project.layers].reverse()) {
    if (!layer.visible || layer.opacity <= 0) continue
    ctx.save()
    ctx.globalAlpha = layerOpacity(layer)
    ctx.translate(layer.x, layer.y)
    ctx.rotate((layer.rotation * Math.PI) / 180)
    ctx.scale(layer.scaleX, layer.scaleY)
    if (layer.kind === 'raster-image' || layer.kind === 'vector-reference') {
      const asset = assetMap.get(layer.assetId)
      if (asset?.blob) {
        const src = await toDataUrl(asset.blob)
        const img = await loadImage(src)
        ctx.drawImage(img, 0, 0, layer.width, layer.height)
      }
    }
    if (layer.kind === 'vector-rect') {
      ctx.fillStyle = layer.fill
      ctx.fillRect(0, 0, layer.width, layer.height)
      ctx.strokeStyle = layer.stroke
      ctx.lineWidth = layer.strokeWidth
      ctx.strokeRect(0, 0, layer.width, layer.height)
    }
    if (layer.kind === 'vector-ellipse') {
      ctx.beginPath()
      ctx.ellipse(layer.radiusX, layer.radiusY, layer.radiusX, layer.radiusY, 0, 0, Math.PI * 2)
      ctx.fillStyle = layer.fill
      ctx.fill()
      ctx.strokeStyle = layer.stroke
      ctx.lineWidth = layer.strokeWidth
      ctx.stroke()
    }
    if (layer.kind === 'vector-text' || layer.kind === 'raster-text') {
      ctx.fillStyle = layer.fill
      ctx.font = `${layer.fontSize}px sans-serif`
      ctx.fillText(layer.text, 0, 0)
    }
    if (layer.kind === 'vector-path' && layer.points.length > 1) {
      ctx.beginPath()
      const first = layer.points[0]
      ctx.moveTo(first.anchor.x, first.anchor.y)
      for (let i = 1; i < layer.points.length; i += 1) {
        const prev = layer.points[i - 1]
        const current = layer.points[i]
        ctx.bezierCurveTo(
          prev.outHandle.x,
          prev.outHandle.y,
          current.inHandle.x,
          current.inHandle.y,
          current.anchor.x,
          current.anchor.y,
        )
      }
      if (layer.closed) ctx.closePath()
      ctx.fillStyle = layer.fill
      ctx.strokeStyle = layer.stroke
      ctx.lineWidth = layer.strokeWidth
      ctx.fill()
      ctx.stroke()
    }
    ctx.restore()
  }

  return new Promise<Blob | null>((resolve) => canvas.toBlob((blob) => resolve(blob), mimeType, quality))
}
