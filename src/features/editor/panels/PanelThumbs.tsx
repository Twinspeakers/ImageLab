import { useEffect, useMemo } from 'react'
import type { AssetBlobRecord, Layer } from '../../../types'

export const LayerListThumb = ({ layer, asset }: { layer: Layer; asset: AssetBlobRecord | undefined }) => {
  const src = useMemo(() => {
    if (!('assetId' in layer)) return ''
    if (asset?.kind === 'svg') {
      return `data:image/svg+xml;utf8,${encodeURIComponent(asset.svgText ?? '<svg />')}`
    }
    if (asset?.blob) return URL.createObjectURL(asset.blob)
    return ''
  }, [layer, asset])

  useEffect(() => {
    if ('assetId' in layer && asset?.kind === 'raster' && src) {
      return () => URL.revokeObjectURL(src)
    }
    return undefined
  }, [layer, asset, src])

  return (
    <span
      className="relative h-8 w-12 shrink-0 overflow-hidden rounded border border-slate-600"
      style={{
        backgroundColor: '#ffffff',
        backgroundImage: `
          linear-gradient(45deg, #cbd5e1 25%, transparent 25%),
          linear-gradient(-45deg, #cbd5e1 25%, transparent 25%),
          linear-gradient(45deg, transparent 75%, #cbd5e1 75%),
          linear-gradient(-45deg, transparent 75%, #cbd5e1 75%)
        `,
        backgroundSize: '8px 8px',
        backgroundPosition: '0 0, 0 4px, 4px -4px, -4px 0px',
      }}
    >
      {(layer.kind === 'raster-image' || layer.kind === 'vector-reference') && src && (
        <img src={src} alt="" aria-hidden="true" className="h-full w-full object-cover" />
      )}
      {layer.kind === 'vector-rect' && (
        <span
          className="absolute inset-0"
          style={{
            background: layer.fill,
            border: `${Math.min(2, layer.strokeWidth)}px solid ${layer.stroke}`,
          }}
        />
      )}
      {layer.kind === 'vector-ellipse' && (
        <span
          className="absolute left-[15%] top-[12%] h-[76%] w-[70%] rounded-full"
          style={{
            background: layer.fill,
            border: `${Math.min(2, layer.strokeWidth)}px solid ${layer.stroke}`,
          }}
        />
      )}
      {(layer.kind === 'vector-text' || layer.kind === 'raster-text') && (
        <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold" style={{ color: layer.fill }}>
          T
        </span>
      )}
      {layer.kind === 'vector-path' && (
        <svg viewBox="0 0 48 32" className="absolute inset-0 h-full w-full">
          <path d="M4 24 C 12 8, 28 8, 44 20" fill={layer.fill} stroke={layer.stroke} strokeWidth={Math.min(2, layer.strokeWidth || 1)} />
        </svg>
      )}
    </span>
  )
}

export const AssetThumb = ({ asset }: { asset: AssetBlobRecord }) => {
  const src = useMemo(() => {
    if (asset.kind === 'svg') {
      return `data:image/svg+xml;utf8,${encodeURIComponent(asset.svgText ?? '<svg />')}`
    }
    if (asset.blob) {
      return URL.createObjectURL(asset.blob)
    }
    return ''
  }, [asset.kind, asset.svgText, asset.blob])
  useEffect(() => {
    if (asset.kind === 'raster' && src) {
      return () => URL.revokeObjectURL(src)
    }
    return undefined
  }, [asset.kind, src])
  return <img src={src} alt={asset.name} className="h-20 w-full rounded bg-slate-950 object-contain" />
}
