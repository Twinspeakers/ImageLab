import type { ToolId } from '../../../types'

export const toolIcon = (tool: ToolId) => {
  const base = 'h-5 w-5'
  if (tool === 'move') {
    return (
      <svg viewBox="0 0 24 24" className={base} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="m5 3 13 8-6 1 2 7-3 1-2-7-4 4Z" />
      </svg>
    )
  }
  if (tool === 'select') {
    return (
      <svg viewBox="0 0 24 24" className={base} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M4 4h6" />
        <path d="M4 4v6" />
        <path d="M20 4h-6" />
        <path d="M20 4v6" />
        <path d="M4 20h6" />
        <path d="M4 20v-6" />
        <path d="M20 20h-6" />
        <path d="M20 20v-6" />
      </svg>
    )
  }
  if (tool === 'hand') {
    return (
      <svg viewBox="0 0 24 24" className={base} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M7 11V7a1 1 0 1 1 2 0v4" />
        <path d="M10 11V6a1 1 0 1 1 2 0v5" />
        <path d="M13 11V7a1 1 0 1 1 2 0v4" />
        <path d="M16 11V9a1 1 0 1 1 2 0v6a5 5 0 0 1-5 5h-1a6 6 0 0 1-6-6v-3a1 1 0 1 1 2 0" />
      </svg>
    )
  }
  if (tool === 'zoom') {
    return (
      <svg viewBox="0 0 24 24" className={base} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <circle cx="11" cy="11" r="6" />
        <path d="m20 20-4-4" />
      </svg>
    )
  }
  if (tool === 'text') {
    return (
      <svg viewBox="0 0 24 24" className={base} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M5 6h14" />
        <path d="M12 6v12" />
        <path d="M9 18h6" />
      </svg>
    )
  }
  if (tool === 'shape') {
    return (
      <svg viewBox="0 0 24 24" className={base} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <rect x="4" y="5" width="7" height="7" rx="1" />
        <circle cx="16.5" cy="15.5" r="3.5" />
      </svg>
    )
  }
  if (tool === 'pen') {
    return (
      <svg viewBox="0 0 24 24" className={base} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="m3 21 3-1 11-11-2-2L4 18l-1 3Z" />
        <path d="m13 5 2 2" />
      </svg>
    )
  }
  return (
    <svg viewBox="0 0 24 24" className={base} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 6h16" />
      <path d="M4 18h16" />
      <path d="M8 6v12" />
      <path d="M16 6v12" />
    </svg>
  )
}
