type ShortcutsModalProps = {
  modKeyLabel: string
  redoShortcut: string
  onClose: () => void
}

export const ShortcutsModal = ({ modKeyLabel, redoShortcut, onClose }: ShortcutsModalProps) => (
  <div className="absolute inset-0 z-[2000] flex items-center justify-center bg-black/60 p-4">
    <div className="w-full max-w-xl rounded border border-slate-600 bg-slate-900 p-4 text-sm">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="font-semibold">Keyboard Shortcuts</h2>
        <button className="rounded border border-slate-700 px-2 py-1 text-xs" onClick={onClose}>Close</button>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>{modKeyLabel}+N/O/S/E/W</div><div>File actions</div>
        <div>{modKeyLabel}+Z / {redoShortcut}</div><div>Undo/Redo</div>
        <div>V H Z T U P C</div><div>Tools</div>
        <div>{modKeyLabel}+0 / {modKeyLabel}+1 / {modKeyLabel} +/-</div><div>View controls</div>
      </div>
    </div>
  </div>
)
