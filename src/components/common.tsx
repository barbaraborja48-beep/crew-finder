import { useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { store, useStore, type Screen } from '../lib/store'
import { alive } from '../lib/rules'
import type { SyncDef } from '../lib/view'

/** Lays out children at a fixed design size (e.g. 390×346) and scales to the phone's width. */
export function Scaled({ w, h, children, style, innerRef }: { w: number; h: number; children: ReactNode; style?: CSSProperties; innerRef?: React.Ref<HTMLDivElement> }) {
  const ref = useRef<HTMLDivElement>(null)
  const [k, setK] = useState(1)
  useLayoutEffect(() => {
    const el = ref.current!
    const ro = new ResizeObserver(() => setK(el.clientWidth / w))
    ro.observe(el)
    return () => ro.disconnect()
  }, [w])
  return (
    <div ref={ref} style={{ position: 'relative', width: '100%', height: h * k, flex: 'none', ...style }}>
      <div ref={innerRef} style={{ position: 'absolute', left: 0, top: 0, width: w, height: h, transform: `scale(${k})`, transformOrigin: '0 0' }}>
        {children}
      </div>
    </div>
  )
}

export function SyncPill({ sync }: { sync: SyncDef }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 10px', borderRadius: 999, fontSize: 11, boxShadow: sync.ring, color: sync.fg, whiteSpace: 'nowrap' }}>
      <i className={sync.icon} />
      {sync.label}
    </div>
  )
}

export function Toggle({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      className="toggle"
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={() => onChange(!on)}
      style={{ background: on ? 'var(--color-accent-600)' : 'var(--color-neutral-800)' }}
    >
      <span style={{ left: on ? 21 : 3 }} />
    </button>
  )
}

export function Dot({ color, size = 11, glow = true, style }: { color: string; size?: number; glow?: boolean; style?: CSSProperties }) {
  return <span style={{ width: size, height: size, borderRadius: '50%', background: color, boxShadow: glow ? `0 0 6px ${color}` : 'none', flex: 'none', display: 'inline-block', ...style }} />
}

const TABS: [Screen, string, string][] = [
  ['map', 'Map', 'ph ph-map-trifold'],
  ['stage', 'Check in', 'ph-bold ph-crosshair'],
  ['chat', 'Chat', 'ph ph-chats-circle'],
  ['crew', 'Crew', 'ph ph-users-three'],
]

export function TabBar() {
  const s = useStore()
  const screen = s.ui.screen === 'shortcut' ? 'crew' : s.ui.screen
  return (
    <nav className="tabbar">
      {TABS.map(([k, label, icon]) => (
        <button
          key={k}
          style={{ color: screen === k ? 'var(--color-accent-200)' : 'var(--color-neutral-500)' }}
          onClick={() => {
            const mine = store.myDot()
            const onStage = mine && alive(mine, Date.now()) && store.place(mine.place_id)?.type === 'stage'
            store.ui({ screen: k, areaSel: null, stage: k === 'stage' && onStage ? mine.place_id : s.ui.stage })
          }}
        >
          <i className={icon} style={{ fontSize: 22 }} />
          {label}
        </button>
      ))}
    </nav>
  )
}

export function Toast() {
  const { toast } = useStore()
  if (!toast) return null
  return (
    <div key={toast.key} className="toast" role="status">
      <i className={toast.icon} style={{ color: toast.fg }} />
      {toast.text}
    </div>
  )
}

export function SosButton() {
  return (
    <button
      aria-label="SOS"
      onClick={() => store.ui({ sos: true, sheet: false })}
      style={{
        width: 40, height: 40, border: 0, cursor: 'pointer', borderRadius: '50%', flex: 'none',
        background: 'color-mix(in srgb, #ff3b5c 12%, transparent)', boxShadow: 'inset 0 0 0 1px var(--sos-line)',
        color: 'var(--sos-text)', display: 'grid', placeItems: 'center', fontSize: 18,
      }}
    >
      <i className="ph-bold ph-siren" />
    </button>
  )
}
