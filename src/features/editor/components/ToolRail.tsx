import type { ToolId } from '../../../types'
import { toolIcon } from './icons'

type ToolRailProps = {
  tools: ToolId[]
  activeTool: ToolId | null
  disabled?: boolean
  onSelect?: (tool: ToolId) => void
  foregroundColor?: string
  backgroundColor?: string
  onPickForeground?: () => void
  onPickBackground?: () => void
}

export const ToolRail = ({
  tools,
  activeTool,
  disabled = false,
  onSelect,
  foregroundColor = '#000000',
  backgroundColor = '#ffffff',
  onPickForeground,
  onPickBackground,
}: ToolRailProps) => {
  const colorSection = (
    <div className={`mt-1 border-t pt-2 ${disabled ? 'border-slate-800' : 'border-slate-700'}`}>
      <div className={`mb-1 text-center text-[9px] uppercase tracking-wide ${disabled ? 'text-slate-500' : 'text-slate-400'}`}>
        Colors
      </div>
      <div className="relative mx-auto h-11 w-11">
        <button
          type="button"
          aria-label="Set background color"
          title="Background color"
          disabled={disabled || !onPickBackground}
          onClick={onPickBackground}
          className={`absolute ml-4 mt-4 h-6 w-6 rounded-sm border ${
            disabled ? 'border-slate-700' : 'border-slate-500 hover:border-slate-300'
          }`}
          style={{ backgroundColor }}
        />
        <button
          type="button"
          aria-label="Set foreground color"
          title="Foreground color"
          disabled={disabled || !onPickForeground}
          onClick={onPickForeground}
          className={`absolute h-6 w-6 rounded-sm border ${
            disabled ? 'border-slate-700' : 'border-slate-300 hover:border-cyan-300'
          }`}
          style={{ backgroundColor: foregroundColor }}
        />
      </div>
    </div>
  )

  return (
    <div className="flex w-16 flex-col items-stretch border-r border-slate-800 bg-slate-900 p-1">
      <div className={`mb-1 select-none text-center text-[10px] ${disabled ? 'text-slate-500' : 'text-slate-400'}`}>Tools</div>
      <div className="flex min-h-0 flex-1 flex-col gap-1 overflow-auto">
        {tools.map((tool) => (
          <div key={tool}>
            <button
              title={tool}
              disabled={disabled}
              className={`w-full rounded border px-1 py-2 text-[10px] uppercase tracking-wide ${
                disabled
                  ? 'border-slate-800 text-slate-500'
                  : activeTool === tool
                    ? 'border-cyan-500 bg-cyan-950/50 text-cyan-200'
                    : 'border-slate-700 text-slate-200 hover:bg-slate-800'
              }`}
              onClick={() => onSelect?.(tool)}
            >
              <span className={`inline-flex items-center justify-center ${disabled ? 'text-white/70' : 'text-white'}`}>{toolIcon(tool)}</span>
            </button>
            {tool === 'zoom' && colorSection}
          </div>
        ))}
        {!tools.includes('zoom') && colorSection}
      </div>
    </div>
  )
}
