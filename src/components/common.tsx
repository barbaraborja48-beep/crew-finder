import { useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { store, useStore, type Screen } from '../lib/store'
import { alive } from '../lib/rules'
import { hasCloseUp, STATUS, where } from '../lib/venue'
import { spotSms, smsHref } from '../lib/sms'
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
      <i aria-hidden className={sync.icon} />
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
            const onStage = mine && alive(mine, Date.now()) && hasCloseUp(store.place(mine.place_id))
            store.ui({ screen: k, areaSel: null, stage: k === 'stage' && onStage ? mine.place_id : s.ui.stage })
          }}
        >
          <i aria-hidden className={icon} style={{ fontSize: 22 }} />
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
      <i aria-hidden className={toast.icon} style={{ color: toast.fg }} />
      {toast.text}
    </div>
  )
}

export function Avatar({ name, color, size = 40 }: { name: string; color: string; size?: number }) {
  return (
    <span style={{ width: size, height: size, flex: 'none', borderRadius: '50%', background: `color-mix(in srgb, ${color} 12%, var(--color-surface))`, boxShadow: `inset 0 0 0 1.5px ${color}, 0 0 12px -2px ${color}`, color, display: 'grid', placeItems: 'center', font: `500 ${Math.round(size * 0.42)}px var(--font-body)` }}>
      {(name.trim()[0] ?? '?').toUpperCase()}
    </span>
  )
}

/** Top-right: you. Opens your profile (name, color, status, notifications, SOS). */
export function ProfileButton() {
  const s = useStore()
  const me = s.members.find(m => m.id === s.session?.memberId)
  if (!me) return null
  return (
    <button aria-label="Your profile" onClick={() => store.ui({ sheet: true })} style={{ border: 0, padding: 0, background: 'transparent', cursor: 'pointer', borderRadius: '50%' }}>
      <Avatar name={me.name} color={me.color} />
    </button>
  )
}

/** "Updated 40s ago" so you know how fresh the map is. Tap to check now. */
export function Freshness({ style }: { style?: CSSProperties }) {
  const s = useStore()
  const [, tick] = useState(0)
  useLayoutEffect(() => {
    const t = setInterval(() => tick(n => n + 1), 10_000)
    return () => clearInterval(t)
  }, [])
  const age = s.lastSync ? Math.floor((Date.now() - s.lastSync) / 1000) : null
  const label = s.syncing
    ? 'Updating…'
    : age == null
      ? 'Not updated yet'
      : `Updated ${age < 15 ? 'just now' : age < 60 ? `${age}s ago` : age < 3600 ? `${Math.floor(age / 60)}m ago` : 'over an hour ago'}`
  const stale = age == null || age > 180
  return (
    <button
      onClick={() => store.sync()}
      style={{ border: 0, background: 'transparent', cursor: 'pointer', padding: '4px 0', font: '400 11px var(--font-body)', color: stale && s.signal === 'none' ? 'var(--queued)' : 'var(--color-neutral-500)', display: 'flex', alignItems: 'center', gap: 4, ...style }}
    >
      <i aria-hidden className={s.syncing ? 'ph ph-arrows-clockwise' : 'ph ph-arrow-clockwise'} />
      {label}
    </button>
  )
}

/** When your check-in can't get out, offer to text it instead. */
export function SmsFallback() {
  const s = useStore()
  const me = store.me()
  const mine = store.myDot()
  if (!me || !mine || me.ghost || !s.pending[mine.id] || s.signal !== 'none' || !alive(mine, Date.now())) return null
  const body = spotSms({
    name: me.name,
    where: where(store.place(mine.place_id), mine.nx, mine.ny),
    at: mine.born,
    status: STATUS[me.status]?.[1],
    note: me.note,
    battery: me.battery,
  })
  return (
    <a
      href={smsHref(body)}
      style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 'var(--radius-lg)', boxShadow: '0 0 0 1px #ffc83b88', color: 'var(--queued)', textDecoration: 'none', fontSize: 12 }}
    >
      <i aria-hidden className="ph ph-chat-text" style={{ fontSize: 18 }} />
      <span style={{ flex: 1 }}>
        <b style={{ fontWeight: 500 }}>No data. Text your spot instead?</b>
        <span style={{ display: 'block', color: 'var(--color-neutral-400)' }}>Opens Messages with it written for you. It still sends here once you have data.</span>
      </span>
      <i aria-hidden className="ph ph-caret-right" />
    </a>
  )
}
