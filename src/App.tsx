import { useEffect } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { EditorPage } from './features/editor/EditorPage'
import { useAppStore } from './store/useAppStore'

function App() {
  const initialized = useAppStore((state) => state.initialized)
  const initialize = useAppStore((state) => state.initialize)

  useEffect(() => {
    void initialize()
  }, [initialize])

  if (!initialized) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 text-slate-100">
        <div className="rounded border border-slate-700 px-4 py-2 text-sm">Loading workspace...</div>
      </div>
    )
  }

  return (
    <Routes>
      <Route path="/" element={<EditorPage />} />
      <Route path="/editor" element={<Navigate to="/" replace />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default App
