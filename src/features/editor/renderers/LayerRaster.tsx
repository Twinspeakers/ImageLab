import { useEffect, useMemo, type CSSProperties } from 'react'
import type { AssetBlobRecord, Layer } from '../../../types'

type LayerRasterProps = {
  layer: Layer
  asset: AssetBlobRecord | undefined
}

export const LayerRaster = ({ layer, asset }: LayerRasterProps) => {
  const src = useMemo(() => {
    if (!('assetId' in layer)) return ''
    if (asset?.kind === 'svg') {
      return `data:image/svg+xml;utf8,${encodeURIComponent(asset.svgText ?? '<svg />')}`
    }
    if (asset?.blob) {
      return URL.createObjectURL(asset.blob)
    }
    return ''
  }, [layer, asset])

  useEffect(() => {
    if ('assetId' in layer && asset?.kind === 'raster' && src) {
      return () => URL.revokeObjectURL(src)
    }
    return undefined
  }, [layer, asset, src])

  const style: CSSProperties = {
    position: 'absolute',
    left: layer.x,
    top: layer.y,
    opacity: layer.opacity,
    transform: `rotate(${layer.rotation}deg) scale(${layer.scaleX}, ${layer.scaleY})`,
    transformOrigin: 'top left',
    pointerEvents: 'none',
  }

  if (layer.kind === 'raster-text' || layer.kind === 'vector-text') {
    return (
      <div style={{ ...style, color: layer.fill, fontSize: layer.fontSize, whiteSpace: 'pre' }}>
        {layer.text}
      </div>
    )
  }

  if (layer.kind === 'vector-rect') {
    const segments = layer.segments ?? [{ x: 0, y: 0, width: layer.width, height: layer.height }]
    if (segments.length === 0) return null
    if (segments.length === 1 && segments[0].x === 0 && segments[0].y === 0 && segments[0].width === layer.width && segments[0].height === layer.height) {
      return (
        <div
          style={{
            ...style,
            width: layer.width,
            height: layer.height,
            background: layer.fill,
            border: `${layer.strokeWidth}px solid ${layer.stroke}`,
          }}
        />
      )
    }
    return (
      <div
        style={{
          ...style,
          width: layer.width,
          height: layer.height,
          position: 'absolute',
        }}
      >
        {segments.map((segment, index) => (
          <div
            key={`${layer.id}_segment_${index}`}
            style={{
              position: 'absolute',
              left: segment.x,
              top: segment.y,
              width: segment.width,
              height: segment.height,
              background: layer.fill,
            }}
          />
        ))}
      </div>
    )
  }

  if (layer.kind === 'vector-ellipse') {
    return (
      <div
        style={{
          ...style,
          width: layer.radiusX * 2,
          height: layer.radiusY * 2,
          borderRadius: 9999,
          background: layer.fill,
          border: `${layer.strokeWidth}px solid ${layer.stroke}`,
        }}
      />
    )
  }

  if ((layer.kind === 'raster-image' || layer.kind === 'vector-reference') && src) {
    return <img src={src} alt={layer.name} style={{ ...style, width: layer.width, height: layer.height }} />
  }

  return null
}
