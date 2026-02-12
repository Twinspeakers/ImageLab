import { useEffect, useMemo, useRef, useState } from 'react'

type ColorPickerPanelProps = {
  title: string
  value: string
  onChange: (value: string) => void
  onClose: () => void
  x: number
  y: number
  onMove: (x: number, y: number) => void
}

export const ColorPickerPanel = ({ title, value, onChange, onClose, x, y, onMove }: ColorPickerPanelProps) => {
  const panelDragRef = useRef<{ pointerId: number; offsetX: number; offsetY: number } | null>(null)
  const svDragRef = useRef<number | null>(null)
  const hueDragRef = useRef<number | null>(null)
  const svRef = useRef<HTMLDivElement | null>(null)
  const hueRef = useRef<HTMLDivElement | null>(null)

  const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n))
  const toHex = (n: number) => n.toString(16).padStart(2, '0')
  const rgbToHex = (r: number, g: number, b: number) => `#${toHex(r)}${toHex(g)}${toHex(b)}`

  const hsvToRgb = (h: number, s: number, v: number) => {
    const c = v * s
    const hh = h / 60
    const x2 = c * (1 - Math.abs((hh % 2) - 1))
    let r = 0
    let g = 0
    let b = 0
    if (hh >= 0 && hh < 1) { r = c; g = x2; b = 0 }
    else if (hh < 2) { r = x2; g = c; b = 0 }
    else if (hh < 3) { r = 0; g = c; b = x2 }
    else if (hh < 4) { r = 0; g = x2; b = c }
    else if (hh < 5) { r = x2; g = 0; b = c }
    else { r = c; g = 0; b = x2 }
    const m = v - c
    return {
      r: Math.round((r + m) * 255),
      g: Math.round((g + m) * 255),
      b: Math.round((b + m) * 255),
    }
  }

  const hexToRgb = (hex: string) => {
    const normalized = hex.trim().replace(/^#/, '')
    const full = normalized.length === 3
      ? normalized.split('').map((char) => char + char).join('')
      : normalized
    if (!/^[0-9a-fA-F]{6}$/.test(full)) return null
    const int = Number.parseInt(full, 16)
    return {
      r: (int >> 16) & 255,
      g: (int >> 8) & 255,
      b: int & 255,
    }
  }

  const rgbToHsv = (r: number, g: number, b: number) => {
    const rn = r / 255
    const gn = g / 255
    const bn = b / 255
    const max = Math.max(rn, gn, bn)
    const min = Math.min(rn, gn, bn)
    const delta = max - min
    let h = 0
    if (delta !== 0) {
      if (max === rn) h = ((gn - bn) / delta) % 6
      else if (max === gn) h = (bn - rn) / delta + 2
      else h = (rn - gn) / delta + 4
      h *= 60
      if (h < 0) h += 360
    }
    const s = max === 0 ? 0 : delta / max
    const v = max
    return { h, s, v }
  }

  const rgbToCmyk = (r: number, g: number, b: number) => {
    const rn = r / 255
    const gn = g / 255
    const bn = b / 255
    const k = 1 - Math.max(rn, gn, bn)
    if (k >= 1) return { c: 0, m: 0, y: 0, k: 100 }
    const c = (1 - rn - k) / (1 - k)
    const m = (1 - gn - k) / (1 - k)
    const y = (1 - bn - k) / (1 - k)
    return {
      c: Math.round(c * 100),
      m: Math.round(m * 100),
      y: Math.round(y * 100),
      k: Math.round(k * 100),
    }
  }

  const rgbToOklch = (r: number, g: number, b: number) => {
    const srgbToLinear = (v: number) => {
      const n = v / 255
      return n <= 0.04045 ? n / 12.92 : ((n + 0.055) / 1.055) ** 2.4
    }
    const lr = srgbToLinear(r)
    const lg = srgbToLinear(g)
    const lb = srgbToLinear(b)

    const l = 0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb
    const m = 0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb
    const s = 0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb

    const l_ = Math.cbrt(l)
    const m_ = Math.cbrt(m)
    const s_ = Math.cbrt(s)

    const L = 0.2104542553 * l_ + 0.793617785 * m_ - 0.0040720468 * s_
    const a = 1.9779984951 * l_ - 2.428592205 * m_ + 0.4505937099 * s_
    const b2 = 0.0259040371 * l_ + 0.7827717662 * m_ - 0.808675766 * s_

    const C = Math.sqrt(a * a + b2 * b2)
    let h = (Math.atan2(b2, a) * 180) / Math.PI
    if (h < 0) h += 360
    return {
      l: +(L * 100).toFixed(2),
      c: +C.toFixed(4),
      h: +h.toFixed(2),
    }
  }

  const initialHsv = useMemo(() => {
    const rgb = hexToRgb(value)
    if (!rgb) return { h: 0, s: 1, v: 1 }
    return rgbToHsv(rgb.r, rgb.g, rgb.b)
  }, [value])

  const [hsv, setHsv] = useState(initialHsv)
  const [hexInput, setHexInput] = useState(value.toUpperCase())
  const currentRgb = useMemo(() => {
    const rgb = hexToRgb(value)
    return rgb ?? { r: 0, g: 0, b: 0 }
  }, [value])
  const currentCmyk = useMemo(
    () => rgbToCmyk(currentRgb.r, currentRgb.g, currentRgb.b),
    [currentRgb],
  )
  const currentOklch = useMemo(
    () => rgbToOklch(currentRgb.r, currentRgb.g, currentRgb.b),
    [currentRgb],
  )

  useEffect(() => {
    const rgb = hexToRgb(value)
    if (!rgb) return
    setHsv(rgbToHsv(rgb.r, rgb.g, rgb.b))
    setHexInput(value.toUpperCase())
  }, [value])

  const commitHsv = (next: { h: number; s: number; v: number }) => {
    setHsv(next)
    const rgb = hsvToRgb(next.h, next.s, next.v)
    const hex = rgbToHex(rgb.r, rgb.g, rgb.b)
    setHexInput(hex.toUpperCase())
    onChange(hex)
  }

  const setSVFromPointer = (clientX: number, clientY: number) => {
    const el = svRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const s = clamp((clientX - rect.left) / rect.width, 0, 1)
    const v = clamp(1 - (clientY - rect.top) / rect.height, 0, 1)
    commitHsv({ ...hsv, s, v })
  }

  const setHueFromPointer = (clientX: number) => {
    const el = hueRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const h = clamp(((clientX - rect.left) / rect.width) * 360, 0, 360)
    commitHsv({ ...hsv, h })
  }

  useEffect(() => {
    const onPointerMove = (event: PointerEvent) => {
      const panelDrag = panelDragRef.current
      if (panelDrag && panelDrag.pointerId === event.pointerId) {
        onMove(event.clientX - panelDrag.offsetX, event.clientY - panelDrag.offsetY)
      }
      if (svDragRef.current === event.pointerId) {
        setSVFromPointer(event.clientX, event.clientY)
      }
      if (hueDragRef.current === event.pointerId) {
        setHueFromPointer(event.clientX)
      }
    }
    const onPointerUp = (event: PointerEvent) => {
      if (panelDragRef.current?.pointerId === event.pointerId) {
        panelDragRef.current = null
      }
      if (svDragRef.current === event.pointerId) {
        svDragRef.current = null
      }
      if (hueDragRef.current === event.pointerId) {
        hueDragRef.current = null
      }
    }
    window.addEventListener('pointermove', onPointerMove)
    window.addEventListener('pointerup', onPointerUp)
    return () => {
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('pointerup', onPointerUp)
    }
  }, [onMove])

  return (
    <div className="pointer-events-none fixed inset-0 z-[120]">
      <div
        role="dialog"
        aria-modal="false"
        aria-label={title}
        className="pointer-events-auto absolute w-[340px] rounded-lg border border-slate-700 bg-slate-900 p-4 shadow-xl"
        style={{ left: `${x}px`, top: `${y}px` }}
      >
        <div
          className="mb-3 -mx-2 -mt-2 cursor-move rounded-t-md border-b border-slate-800 px-2 py-1 text-sm font-medium text-slate-200 select-none"
          onPointerDown={(event) => {
            panelDragRef.current = {
              pointerId: event.pointerId,
              offsetX: event.clientX - x,
              offsetY: event.clientY - y,
            }
          }}
        >
          {title}
        </div>
        <div className="mb-3 flex gap-3">
          <div
            ref={svRef}
            className="relative h-40 w-40 cursor-crosshair overflow-hidden rounded border border-slate-700"
            style={{ backgroundColor: `hsl(${hsv.h}, 100%, 50%)` }}
            onPointerDown={(event) => {
              svDragRef.current = event.pointerId
              setSVFromPointer(event.clientX, event.clientY)
            }}
          >
            <div className="absolute inset-0 bg-gradient-to-r from-white to-transparent" />
            <div className="absolute inset-0 bg-gradient-to-t from-black to-transparent" />
            <div
              className="pointer-events-none absolute h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white shadow-[0_0_0_1px_rgba(15,23,42,0.85)]"
              style={{ left: `${hsv.s * 100}%`, top: `${(1 - hsv.v) * 100}%` }}
            />
          </div>
          <div className="flex flex-1 flex-col gap-2">
            <div
              ref={hueRef}
              className="relative h-4 cursor-ew-resize rounded border border-slate-700"
              style={{ background: 'linear-gradient(to right, #ff0000, #ffff00, #00ff00, #00ffff, #0000ff, #ff00ff, #ff0000)' }}
              onPointerDown={(event) => {
                hueDragRef.current = event.pointerId
                setHueFromPointer(event.clientX)
              }}
            >
              <div
                className="pointer-events-none absolute top-0 h-full w-1 -translate-x-1/2 rounded bg-white/85 shadow-[0_0_0_1px_rgba(15,23,42,0.8)]"
                style={{ left: `${(hsv.h / 360) * 100}%` }}
              />
            </div>
            <div className="h-8 w-full rounded border border-slate-700" style={{ backgroundColor: value }} />
            <div className="space-y-1 rounded border border-slate-800 bg-slate-950/60 p-2 text-[10px] text-slate-300">
              <div className="flex justify-between">
                <span className="text-slate-400">RGB</span>
                <span className="text-right">{currentRgb.r}, {currentRgb.g}, {currentRgb.b}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">CMYK</span>
                <span className="text-right">{currentCmyk.c}%, {currentCmyk.m}%, {currentCmyk.y}%, {currentCmyk.k}%</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">OKLCH</span>
                <span className="text-right">{currentOklch.l}% {currentOklch.c} {currentOklch.h}</span>
              </div>
            </div>
          </div>
        </div>
        <div className="mb-3 flex items-center gap-3">
          <input
            aria-label={`${title} hex`}
            type="text"
            value={hexInput}
            onChange={(event) => {
              const next = event.target.value.toUpperCase()
              setHexInput(next)
              const rgb = hexToRgb(next)
              if (!rgb) return
              const nextHsv = rgbToHsv(rgb.r, rgb.g, rgb.b)
              setHsv(nextHsv)
              onChange(rgbToHex(rgb.r, rgb.g, rgb.b))
            }}
            className="w-full rounded border border-slate-700 bg-slate-950 px-2 py-1.5 text-sm text-slate-200 outline-none focus:border-cyan-400"
          />
        </div>
        <div className="flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="rounded border border-slate-700 px-3 py-1.5 text-xs text-slate-200 hover:bg-slate-800"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  )
}
