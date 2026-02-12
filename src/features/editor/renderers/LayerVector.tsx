import { useEffect } from 'react'
import type { AssetBlobRecord, Layer } from '../../../types'

type LayerVectorProps = {
  layer: Layer
  asset: AssetBlobRecord | undefined
}

export const LayerVector = ({ layer, asset }: LayerVectorProps) => {
  if (layer.kind === 'vector-rect') {
    const segments = layer.segments ?? [{ x: 0, y: 0, width: layer.width, height: layer.height }]
    if (segments.length === 0) return null
    return (
      <g transform={`translate(${layer.x},${layer.y}) rotate(${layer.rotation}) scale(${layer.scaleX},${layer.scaleY})`} opacity={layer.opacity}>
        {segments.length === 1 && segments[0].x === 0 && segments[0].y === 0 && segments[0].width === layer.width && segments[0].height === layer.height ? (
          <rect width={layer.width} height={layer.height} fill={layer.fill} stroke={layer.stroke} strokeWidth={layer.strokeWidth} />
        ) : (
          segments.map((segment, index) => (
            <rect
              key={`${layer.id}_segment_${index}`}
              x={segment.x}
              y={segment.y}
              width={segment.width}
              height={segment.height}
              fill={layer.fill}
            />
          ))
        )}
      </g>
    )
  }

  if (layer.kind === 'vector-ellipse') {
    return (
      <g transform={`translate(${layer.x},${layer.y}) rotate(${layer.rotation}) scale(${layer.scaleX},${layer.scaleY})`} opacity={layer.opacity}>
        <ellipse cx={layer.radiusX} cy={layer.radiusY} rx={layer.radiusX} ry={layer.radiusY} fill={layer.fill} stroke={layer.stroke} strokeWidth={layer.strokeWidth} />
      </g>
    )
  }

  if (layer.kind === 'vector-text') {
    return (
      <g transform={`translate(${layer.x},${layer.y}) rotate(${layer.rotation}) scale(${layer.scaleX},${layer.scaleY})`} opacity={layer.opacity}>
        <text x={0} y={0} fill={layer.fill} fontSize={layer.fontSize}>
          {layer.text}
        </text>
      </g>
    )
  }

  if (layer.kind === 'vector-path' && layer.points.length > 1) {
    const d = layer.points.map((p, i, list) => i === 0 ? `M ${p.anchor.x} ${p.anchor.y}` : `C ${list[i - 1].outHandle.x} ${list[i - 1].outHandle.y}, ${p.inHandle.x} ${p.inHandle.y}, ${p.anchor.x} ${p.anchor.y}`).join(' ')
    return (
      <g transform={`translate(${layer.x},${layer.y}) rotate(${layer.rotation}) scale(${layer.scaleX},${layer.scaleY})`} opacity={layer.opacity}>
        <path d={`${d}${layer.closed ? ' Z' : ''}`} fill={layer.fill} stroke={layer.stroke} strokeWidth={layer.strokeWidth} />
      </g>
    )
  }

  if (layer.kind === 'vector-reference') {
    if (asset?.kind === 'svg') {
      return (
        <g opacity={layer.opacity} transform={`translate(${layer.x},${layer.y}) rotate(${layer.rotation}) scale(${layer.scaleX},${layer.scaleY})`}>
          <image href={`data:image/svg+xml;utf8,${encodeURIComponent(asset.svgText ?? '<svg />')}`} width={layer.width} height={layer.height} />
        </g>
      )
    }
    return <RasterRef layer={layer} asset={asset} />
  }

  return null
}

const RasterRef = ({ layer, asset }: { layer: Extract<Layer, { kind: 'vector-reference' }>; asset: AssetBlobRecord | undefined }) => {
  const href = asset?.blob ? URL.createObjectURL(asset.blob) : ''
  useEffect(() => {
    if (!href) return undefined
    return () => URL.revokeObjectURL(href)
  }, [href])

  if (!href) return null

  return (
    <g opacity={layer.opacity} transform={`translate(${layer.x},${layer.y}) rotate(${layer.rotation}) scale(${layer.scaleX},${layer.scaleY})`}>
      <image href={href} width={layer.width} height={layer.height} />
    </g>
  )
}
