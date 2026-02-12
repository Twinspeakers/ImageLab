import { AssetThumb } from './PanelThumbs'
import type { AssetBlobRecord } from '../../../types'

type AssetsPanelProps = {
  assets: Record<string, AssetBlobRecord>
}

export const AssetsPanel = ({ assets }: AssetsPanelProps) => (
  <div className="p-2 text-xs">
    <div className="mb-2 text-slate-400">Drag assets onto canvas to create layers.</div>
    <div className="grid grid-cols-2 gap-2">
      {Object.values(assets).map((asset) => (
        <div
          key={asset.id}
          draggable
          onDragStart={(e) => e.dataTransfer.setData('imagelab/asset', asset.id)}
          className="rounded border border-slate-700 bg-slate-900 p-1"
        >
          <AssetThumb asset={asset} />
          <div className="mt-1 truncate">{asset.name}</div>
        </div>
      ))}
    </div>
  </div>
)
