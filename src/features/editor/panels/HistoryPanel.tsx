type HistoryPanelProps = {
  historyLabels: string[]
  onJumpToHistory: (index: number) => void
}

export const HistoryPanel = ({ historyLabels, onJumpToHistory }: HistoryPanelProps) => (
  <div className="space-y-1 p-2">
    {historyLabels.map((label, index) => (
      <button
        key={`${label}_${index}`}
        className="w-full rounded border border-slate-700 bg-slate-900 px-2 py-1 text-left text-xs hover:border-slate-500"
        onClick={() => onJumpToHistory(index)}
      >
        {label}
      </button>
    ))}
  </div>
)
