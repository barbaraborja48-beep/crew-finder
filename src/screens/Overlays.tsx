import { useEffect, useRef, useState } from 'react'
import { store, useStore } from '../lib/store'
import { alive, remaining } from '../lib/rules'
import { fmt, ME, STATUS, where } from '../lib/venue'
import { useNow } from '../lib/view'
import { Toggle } from '../components/common'

export function StatusSheet() {
  const s = useStore()
  const now = useNow()
  const me = store.me()
  const mine = store.myDot()
  const live = alive(mine, now)
  const [note, setNote] = useState(me?.note ?? '')
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)
  if (!s.ui.sheet || !me) return null

  const close = () => {
    clearTimeout(timer.current)
    if (note !== me.note) store.updateMe({ note })
    store.ui({ sheet: false })
  }
  const onNote = (v: string) => {
    setNote(v)
    clearTimeout(timer.current)
    timer.current = setTimeout(() => store.updateMe({ note: v }), 1200)
  }

  return (
    <>
      <div onClick={close} style={{ position: 'absolute', inset: 0, zIndex: 10, background: 'rgba(10,11,20,.6)' }} />
      <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, zIndex: 11, background: 'var(--color-surface)', borderRadius: '26px 26px 0 0', boxShadow: 'var(--shadow-lg)', padding: '10px 20px calc(var(--safe-bottom) + 24px)', display: 'flex', flexDirection: 'column', gap: 16, animation: 'sheet .22s ease-out' }}>
        <div style={{ width: 36, height: 4, borderRadius: 2, background: 'var(--color-neutral-700)', margin: '0 auto' }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ width: 11, height: 11, borderRadius: '50%', background: ME, boxShadow: `0 0 6px ${ME}`, opacity: live ? 1 : 0.4 }} />
          <span style={{ fontSize: 15, fontWeight: 500, flex: 1 }}>{live ? where(store.place(mine!.place_id), mine!.nx, mine!.ny) : 'Not checked in'}</span>
          <span style={{ fontSize: 12, color: 'var(--color-neutral-500)', fontVariantNumeric: 'tabular-nums' }}>{live ? fmt(remaining(mine!, now)) : ''}</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
          {STATUS.map(([icon, label], i) => {
            const on = me.status === i
            return (
              <button
                key={label}
                onClick={() => store.updateMe({ status: i })}
                style={{ height: 68, border: 0, cursor: 'pointer', borderRadius: 'var(--radius-md)', background: on ? 'var(--color-accent-900)' : 'transparent', boxShadow: on ? '0 0 0 1px var(--color-accent)' : 'var(--shadow-sm)', color: on ? 'var(--color-accent-200)' : 'var(--color-neutral-300)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 5, font: '500 11px var(--font-body)' }}
              >
                <i className={icon} style={{ fontSize: 22 }} />
                {label}
              </button>
            )
          })}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, height: 42, padding: '0 12px', borderRadius: 'var(--radius-md)', boxShadow: 'var(--shadow-sm)', background: 'var(--color-bg)' }}>
          <i className="ph ph-chat-circle" style={{ color: 'var(--color-neutral-500)' }} />
          <input value={note} maxLength={40} onChange={e => onNote(e.target.value)} placeholder="Note for the crew" style={{ flex: 1, minWidth: 0, border: 0, outline: 0, background: 'transparent', color: 'var(--color-text)', font: '400 13px var(--font-body)' }} />
          <span style={{ fontSize: 10, color: 'var(--color-neutral-600)' }}>{40 - note.length}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <i className="ph ph-ghost" style={{ fontSize: 18, color: 'var(--color-neutral-300)' }} />
          <span style={{ flex: 1, fontSize: 14 }}>Ghost</span>
          <Toggle on={me.ghost} onChange={v => store.setGhost(v)} label="Ghost mode" />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 10 }}>
          <button className="btn btn-secondary" style={{ height: 46, color: 'var(--sos-text)', boxShadow: 'inset 0 0 0 1px var(--sos-line)', border: 0 }} onClick={() => store.ui({ sheet: false, sos: true })}>
            <i className="ph-bold ph-siren" />
            SOS
          </button>
          <button className="btn btn-primary" style={{ height: 46 }} onClick={close}>
            Done
          </button>
        </div>
      </div>
    </>
  )
}

const HOLD_MS = 2000

export function SosScreen() {
  const s = useStore()
  const [p, setP] = useState(0)
  const [sent, setSent] = useState(false)
  const raf = useRef(0)
  const start = useRef(0)

  useEffect(() => {
    if (!s.ui.sos) {
      setP(0)
      setSent(false)
    }
  }, [s.ui.sos])
  useEffect(() => () => cancelAnimationFrame(raf.current), [])
  if (!s.ui.sos) return null

  const down = () => {
    if (sent) return
    start.current = performance.now()
    const step = () => {
      const f = Math.min(1, (performance.now() - start.current) / HOLD_MS)
      setP(f)
      if (f >= 1) {
        setSent(true)
        navigator.vibrate?.([80, 60, 80])
        store.sos()
        return
      }
      raf.current = requestAnimationFrame(step)
    }
    raf.current = requestAnimationFrame(step)
  }
  const up = () => {
    cancelAnimationFrame(raf.current)
    if (!sent) setP(0)
  }
  const close = () => {
    if (sent) store.sendText('I’m OK now')
    store.ui({ sos: false })
  }
  const safe = store.place('safe')
  const pct = (p * 100).toFixed(1)

  return (
    <div className="screen" style={{ zIndex: 15, background: 'radial-gradient(90% 50% at 50% 42%, #3a1220, var(--color-bg))', alignItems: 'center', padding: '0 20px' }}>
      <div
        onPointerDown={down}
        onPointerUp={up}
        onPointerLeave={up}
        onPointerCancel={up}
        onContextMenu={e => e.preventDefault()}
        style={{ marginTop: 'calc(var(--safe-top) + 14vh)', width: 200, height: 200, borderRadius: '50%', position: 'relative', display: 'grid', placeItems: 'center', boxShadow: '0 0 0 1px #ff5c7a44', touchAction: 'none', cursor: 'pointer', userSelect: 'none', WebkitUserSelect: 'none' }}
      >
        <div style={{ position: 'absolute', inset: -6, borderRadius: '50%', background: `conic-gradient(#ff3b5c 0 ${pct}%, transparent ${pct}%)`, WebkitMask: 'radial-gradient(farthest-side, transparent calc(100% - 4px), #000 calc(100% - 3px))', mask: 'radial-gradient(farthest-side, transparent calc(100% - 4px), #000 calc(100% - 3px))', filter: 'drop-shadow(0 0 8px #ff3b5c)' }} />
        <i className="ph-bold ph-siren" style={{ fontSize: 64, color: 'var(--sos-text)' }} />
      </div>
      <div style={{ marginTop: 32, fontSize: 24, fontWeight: 500 }}>{sent ? 'SOS sent' : 'Hold for SOS'}</div>
      <div style={{ marginTop: 6, fontSize: 13, color: 'var(--color-neutral-400)', textAlign: 'center', maxWidth: 290 }}>
        {sent
          ? s.signal === 'none'
            ? 'Queued. It goes to your crew the moment you get any signal. If you need help now, find staff or the Safe Space.'
            : 'Your crew has your zone and battery. Staff at the Safe Space can help too.'
          : 'Shares your zone and battery with your crew'}
      </div>
      <div style={{ marginTop: 'auto', paddingBottom: 'calc(var(--safe-bottom) + 24px)', alignSelf: 'stretch', display: 'flex', flexDirection: 'column', gap: 8 }}>
        {safe && (
          <button className="btn btn-secondary btn-block" style={{ height: 46 }} onClick={() => { store.ui({ sos: false }); store.openPlace('safe') }}>
            <i className="ph ph-first-aid" />
            Show Safe Space
          </button>
        )}
        <button className="btn btn-ghost btn-block" style={{ height: 46 }} onClick={close}>
          {sent ? 'I’m OK now' : 'Cancel'}
        </button>
      </div>
    </div>
  )
}
