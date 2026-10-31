// Pinch, drag, double-tap and +/- zoom for a fixed-size layer (the venue map).
// Works in the layer's own units, so it sits happily inside <Scaled>.
// The layer can be taller than the frame (ch > h): then it also slides up and down unzoomed.
import { useEffect, useRef, useState, type ReactNode } from 'react'

const MIN = 1
const MAX = 5

interface View {
  z: number
  tx: number
  ty: number
}

/** top: a tall layer starts at its top (Jowke's dance floor) instead of its middle, and stays put when the frame resizes. */
export function ZoomPan({ w, h, ch = h, children, overlay, corner, doubleTap = true, top = false }: { w: number; h: number; ch?: number; children: (z: number) => ReactNode; overlay?: ReactNode; corner?: ReactNode; doubleTap?: boolean; top?: boolean }) {
  const ref = useRef<HTMLDivElement>(null)
  const [view, setView] = useState<View>({ z: 1, tx: 0, ty: top ? 0 : Math.min(0, (h - ch) / 2) })
  const [smooth, setSmooth] = useState(false) // animate button / double-tap zooms, not finger moves
  const v = useRef(view)
  v.current = view

  const clamp = (z: number, tx: number, ty: number): View => {
    z = Math.min(MAX, Math.max(MIN, z))
    return { z, tx: Math.min(0, Math.max(w - w * z, tx)), ty: Math.min(0, Math.max(h - ch * z, ty)) }
  }
  // The frame got shorter or taller (the list below was dragged): keep the same middle in view.
  const frame = useRef({ h, ch })
  useEffect(() => {
    const f = frame.current
    frame.current = { h, ch }
    if (f.h === h && f.ch === ch) return
    setSmooth(false)
    setView(c => clamp(c.z, c.tx, top ? c.ty : c.ty + (h - f.h) / 2 - ((ch - f.ch) * c.z) / 2))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [h, ch])
  /** Screen point → layer units. */
  const local = (cx: number, cy: number) => {
    const r = ref.current!.getBoundingClientRect()
    const k = r.width / w
    return { x: (cx - r.left) / k, y: (cy - r.top) / k, k }
  }
  /** Zoom to z keeping the layer point under (x, y) still. */
  const zoomAt = (z: number, x: number, y: number, animate = false) => {
    const c = v.current
    const px = (x - c.tx) / c.z
    const py = (y - c.ty) / c.z
    setSmooth(animate)
    setView(clamp(z, x - px * z, y - py * z))
  }

  // Gestures. Moves are tracked on window so taps on pins and penguins still work.
  const pts = useRef(new Map<number, { x: number; y: number }>())
  const start = useRef<{ x: number; y: number; tx: number; ty: number; d: number; z: number; mx: number; my: number } | null>(null)
  const moved = useRef(false)
  const lastTap = useRef({ t: 0, x: 0, y: 0 })
  const dbl = useRef(doubleTap)
  dbl.current = doubleTap
  const tall = useRef(ch > h)
  tall.current = ch > h

  useEffect(() => {
    const el = ref.current!
    const begin = () => {
      const p = [...pts.current.values()]
      const a = local(p[0].x, p[0].y)
      if (p.length >= 2) {
        const b = local(p[1].x, p[1].y)
        start.current = { x: a.x, y: a.y, tx: v.current.tx, ty: v.current.ty, z: v.current.z, d: Math.hypot(a.x - b.x, a.y - b.y), mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2 }
      } else {
        start.current = { x: a.x, y: a.y, tx: v.current.tx, ty: v.current.ty, z: v.current.z, d: 0, mx: a.x, my: a.y }
      }
    }
    const down = (e: PointerEvent) => {
      if (pts.current.size === 0) moved.current = false
      pts.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
      begin()
    }
    const move = (e: PointerEvent) => {
      if (!pts.current.has(e.pointerId)) return
      pts.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
      const s = start.current
      if (!s) return
      const p = [...pts.current.values()]
      const a = local(p[0].x, p[0].y)
      if (p.length >= 2) {
        const b = local(p[1].x, p[1].y)
        const d = Math.hypot(a.x - b.x, a.y - b.y)
        const mx = (a.x + b.x) / 2
        const my = (a.y + b.y) / 2
        const z = Math.min(MAX, Math.max(MIN, (s.z * d) / Math.max(1, s.d)))
        const px = (s.mx - s.tx) / s.z
        const py = (s.my - s.ty) / s.z
        moved.current = true
        setSmooth(false)
        setView(clamp(z, mx - px * z, my - py * z))
      } else {
        const dx = a.x - s.x
        const dy = a.y - s.y
        if (Math.hypot(dx, dy) * a.k > 6) moved.current = true
        if (moved.current && (v.current.z > 1 || tall.current)) {
          setSmooth(false)
          setView(clamp(s.z, s.tx + dx, s.ty + dy))
        }
      }
    }
    const up = (e: PointerEvent) => {
      if (!pts.current.has(e.pointerId)) return
      pts.current.delete(e.pointerId)
      if (pts.current.size) return begin()
      start.current = null
      if (moved.current) return
      // double tap: zoom in there, or back out if already close
      const now = Date.now()
      const l = lastTap.current
      if (dbl.current && now - l.t < 320 && Math.hypot(e.clientX - l.x, e.clientY - l.y) < 30) {
        const p = local(e.clientX, e.clientY)
        zoomAt(v.current.z > 2.6 ? 1 : v.current.z * 2.2, p.x, p.y, true)
        lastTap.current = { t: 0, x: 0, y: 0 }
      } else {
        lastTap.current = { t: now, x: e.clientX, y: e.clientY }
      }
    }
    const wheel = (e: WheelEvent) => {
      e.preventDefault()
      const p = local(e.clientX, e.clientY)
      zoomAt(v.current.z * Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.002)), p.x, p.y)
    }
    const stopPageZoom = (e: Event) => e.preventDefault() // iPhone: pinch the map, not the page
    el.addEventListener('pointerdown', down)
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    window.addEventListener('pointercancel', up)
    el.addEventListener('wheel', wheel, { passive: false })
    el.addEventListener('gesturestart', stopPageZoom)
    el.addEventListener('gesturechange', stopPageZoom)
    return () => {
      el.removeEventListener('pointerdown', down)
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      window.removeEventListener('pointercancel', up)
      el.removeEventListener('wheel', wheel)
      el.removeEventListener('gesturestart', stopPageZoom)
      el.removeEventListener('gesturechange', stopPageZoom)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [w, h, ch])

  const button = (label: string, icon: string, onClick: () => void) => (
    <button
      aria-label={label}
      className="round"
      onClick={e => {
        e.stopPropagation()
        onClick()
      }}
      style={{ width: 34, height: 34, fontSize: 15, background: 'rgba(0,0,0,.6)' }}
    >
      <i aria-hidden className={icon} />
    </button>
  )

  return (
    <div
      ref={ref}
      onClickCapture={e => {
        // a drag or pinch shouldn't count as tapping whatever was under the finger
        if (moved.current) {
          e.stopPropagation()
          e.preventDefault()
          moved.current = false
        }
      }}
      style={{ position: 'absolute', inset: 0, overflow: 'hidden', touchAction: 'none', userSelect: 'none', WebkitUserSelect: 'none', WebkitTouchCallout: 'none' }}
    >
      <div
        style={{
          position: 'absolute', left: 0, top: 0, width: w, height: ch,
          transform: `translate(${view.tx}px, ${view.ty}px) scale(${view.z})`, transformOrigin: '0 0',
          transition: smooth ? 'transform .28s ease-out' : 'none',
        }}
      >
        {children(view.z)}
      </div>
      {overlay}
      {corner && <div style={{ position: 'absolute', left: 10, bottom: 22, zIndex: 3 }}>{corner}</div>}
      <div style={{ position: 'absolute', right: 10, bottom: 22, display: 'flex', flexDirection: 'column', gap: 6, zIndex: 3 }}>
        {button('Zoom in', 'ph ph-plus', () => zoomAt(v.current.z * 1.8, w / 2, h / 2, true))}
        {button('Zoom out', 'ph ph-minus', () => zoomAt(v.current.z / 1.8, w / 2, h / 2, true))}
        {view.z > 1.01 && button('Show whole map', 'ph ph-arrows-in', () => zoomAt(1, w / 2, h / 2, true))}
      </div>
    </div>
  )
}
