import { useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { store, useStore, type Screen } from '../lib/store'
import { pinned } from '../lib/rules'
import { hasCloseUp, STATUS, where } from '../lib/venue'
import { spotSms, smsHref } from '../lib/sms'
import { Penguin } from './Penguin'
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

export function Toggle({ on, onChange, label, disabled = false }: { on: boolean; onChange: (v: boolean) => void; label: string; disabled?: boolean }) {
  return (
    <button
      className="toggle"
      role="switch"
      aria-checked={on}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!on)}
      style={{ background: on ? 'var(--color-accent-600)' : 'var(--color-neutral-800)', boxShadow: on && !disabled ? '0 0 16px -2px var(--color-accent-500)' : 'none', opacity: disabled ? 0.35 : 1, cursor: disabled ? 'default' : 'pointer' }}
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
  ['stage', 'Pin', 'ph-bold ph-map-pin'],
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
          className={screen === k ? 'on' : ''}
          style={{ color: screen === k ? '#fff' : 'var(--color-neutral-500)' }}
          onClick={() => {
            const mine = store.myDot()
            const onStage = mine && pinned(mine, Date.now()) && hasCloseUp(store.place(mine.place_id))
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
      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{toast.text}</span>
      {toast.undo && (
        <button onClick={() => store.undoPin()} style={{ border: 0, background: 'transparent', color: 'var(--color-accent-300)', font: '600 12px var(--font-body)', padding: '0 0 0 6px', cursor: 'pointer', flex: 'none' }}>
          Undo
        </button>
      )}
    </div>
  )
}

/** Your penguin's face in a glowing circle: used for profile, crew lists and chat. */
export function Avatar({ name, color, acc = 0, size = 40 }: { name: string; color: string; acc?: number; size?: number }) {
  return (
    <span
      title={name}
      style={{ width: size, height: size, flex: 'none', borderRadius: '50%', overflow: 'hidden', position: 'relative', background: `radial-gradient(circle at 50% 70%, color-mix(in srgb, ${color} 34%, #000), #050508 72%)`, boxShadow: `inset 0 0 0 1.5px ${color}, 0 0 14px -3px ${color}`, display: 'block' }}
    >
      <span style={{ position: 'absolute', left: '50%', top: '14%', transform: 'translateX(-50%)' }}>
        <Penguin color={color} activity="chill" seed={name} size={size * 0.92} acc={acc} animate={false} />
      </span>
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
      <Avatar name={me.name} color={me.color} acc={me.acc} />
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
  const waiting = Object.keys(s.pending).length > 0
  const clock = s.lastSync ? new Date(s.lastSync).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }) : ''
  // Good connection: updates arrive by themselves, so just show that the line is live.
  if (!s.dataSaver)
    return (
      <span style={{ padding: '4px 0', font: '400 11px var(--font-body)', color: 'var(--color-neutral-500)', display: 'flex', alignItems: 'center', gap: 5, ...style }}>
        <span style={{ width: 6, height: 6, borderRadius: '50%', background: s.live ? '#3bffb0' : '#ffc83b', boxShadow: s.live ? '0 0 6px #3bffb0' : 'none' }} />
        {s.live ? 'Live' : 'Connecting…'}
      </span>
    )
  // Low data: no background updates, so say plainly how current the map is; tap to check now.
  const label = s.syncing
    ? 'Checking…'
    : waiting && s.signal === 'none'
      ? 'Not sent yet · retrying'
      : age == null
        ? 'Tap to update'
        : `Up to date · ${clock}`
  const stale = waiting || age == null || age > 180
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

/** Good connection mode, but the signal keeps failing: suggest low data mode (never switch by itself). */
export function WeakSignalHint() {
  const s = useStore()
  if (!s.weakSignal || s.dataSaver) return null
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', margin: '4px 0 6px', borderRadius: 14, background: 'color-mix(in srgb, #ffc83b 12%, var(--color-surface))', boxShadow: '0 0 0 1px #ffc83b55' }}>
      <i aria-hidden className="ph-bold ph-warning-circle" style={{ fontSize: 18, color: '#ffd97a' }} />
      <span style={{ flex: 1, fontSize: 12, lineHeight: 1.35 }}>Signal’s weak here. Switch to low data mode?</span>
      <button onClick={() => store.dismissWeakHint()} style={{ border: 0, background: 'transparent', color: 'var(--color-neutral-400)', font: '500 12px var(--font-body)', cursor: 'pointer', padding: '6px 4px' }}>
        Not now
      </button>
      <button onClick={() => store.setLowData(true)} style={{ border: 0, borderRadius: 999, background: '#ffc83b', color: '#000', font: '600 12px var(--font-body)', cursor: 'pointer', padding: '6px 12px' }}>
        Switch
      </button>
    </div>
  )
}

/** When your pin can't get out, offer to text it instead. */
export function SmsFallback() {
  const s = useStore()
  const me = store.me()
  const mine = store.myDot()
  // Offer a text once your pin has been stuck for 30 s (a message tells it to re-check then).
  const [, tick] = useState(0)
  useLayoutEffect(() => {
    const t = setInterval(() => tick(n => n + 1), 5_000)
    return () => clearInterval(t)
  }, [])
  if (!me || !mine || me.ghost || !s.pending[mine.id] || !pinned(mine, Date.now()) || Date.now() - mine.born < 30_000) return null
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
