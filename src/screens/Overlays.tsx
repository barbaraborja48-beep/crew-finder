import { useEffect, useRef, useState } from 'react'
import { store, useStore } from '../lib/store'
import { ageOf, pinned } from '../lib/rules'
import { agoLong, STATUS, where } from '../lib/venue'
import { useNow } from '../lib/view'
import { smsHref, sosSms } from '../lib/sms'
import { Avatar, Toggle } from '../components/common'
import { PenguinPicker } from '../components/PenguinPicker'
import { disablePush, enablePush, loadPrefs, pushState, updatePrefs, type PushPrefs, type PushState } from '../lib/push'

/** Your profile: name, color, status, note, ghost, notifications, SOS. */
export function ProfileSheet() {
  const s = useStore()
  const now = useNow()
  const me = store.me()
  const mine = store.myDot()
  const live = pinned(mine, now)
  const [name, setName] = useState(me?.name ?? '')
  const [note, setNote] = useState(me?.note ?? '')
  const start = useRef({ status: me?.status, note: me?.note })
  const [push, setPush] = useState<PushState | null>(null)
  const [prefs, setPrefs] = useState<PushPrefs>(loadPrefs)
  const [pushBusy, setPushBusy] = useState(false)
  const [pushErr, setPushErr] = useState('')

  useEffect(() => {
    if (s.ui.sheet) pushState().then(setPush)
  }, [s.ui.sheet])
  if (!s.ui.sheet || !me) return null

  const others = s.members.filter(m => m.id !== me.id)
  const trimmed = name.trim()
  const nameClash = others.some(m => m.name.toLowerCase() === trimmed.toLowerCase())

  const close = () => {
    const patch: Partial<typeof me> = {}
    if (trimmed && trimmed !== me.name && !nameClash) patch.name = trimmed.slice(0, 20)
    if (note !== me.note) patch.note = note
    if (Object.keys(patch).length) store.updateMe(patch)
    if (me.status !== start.current.status || note !== start.current.note) store.postStatus()
    store.ui({ sheet: false })
  }

  const runPush = async (fn: () => Promise<void>) => {
    setPushBusy(true)
    setPushErr('')
    try {
      await fn()
    } catch (e) {
      setPushErr(e instanceof Error ? e.message : String(e))
    }
    setPush(await pushState())
    setPushBusy(false)
  }
  const setPref = (k: keyof PushPrefs, v: boolean) => {
    const next = { ...prefs, [k]: v }
    setPrefs(next)
    runPush(() => updatePrefs(me.id, next))
  }

  const label = { fontSize: 11, color: 'var(--color-neutral-500)' } as const
  return (
    <>
      <div onClick={close} style={{ position: 'absolute', inset: 0, zIndex: 10, background: 'rgba(0,0,0,.66)' }} />
      <div className="scroll no-scrollbar" style={{ position: 'absolute', left: 0, right: 0, bottom: 0, maxHeight: '90%', zIndex: 11, background: 'var(--color-surface)', borderRadius: '26px 26px 0 0', boxShadow: 'var(--shadow-lg)', padding: '10px 20px calc(var(--safe-bottom) + 24px)', display: 'flex', flexDirection: 'column', gap: 16, animation: 'sheet .22s ease-out' }}>
        <div style={{ width: 36, height: 4, borderRadius: 2, background: 'var(--color-neutral-700)', margin: '0 auto', flex: 'none' }} />

        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Avatar name={trimmed || me.name} color={me.color} acc={me.acc} size={52} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <input
              aria-label="Your name"
              value={name}
              maxLength={20}
              onChange={e => setName(e.target.value)}
              style={{ width: '100%', border: 0, outline: 0, background: 'transparent', color: 'var(--color-text)', font: '500 20px var(--font-body)', letterSpacing: '-.02em', padding: 0 }}
            />
            <div style={{ ...label, color: nameClash ? 'var(--sos-text)' : label.color }}>
              {nameClash ? 'Someone in the crew already has that name' : live ? `${where(store.place(mine!.place_id), mine!.nx, mine!.ny)} · pinned ${agoLong(ageOf(mine!, now))}` : 'Not pinned yet'}
            </div>
          </div>
        </div>

        <PenguinPicker color={me.color} acc={me.acc ?? 0} onColor={c => store.updateMe({ color: c })} onAcc={a => store.updateMe({ acc: a })} crewColors={others.map(m => m.color)} />

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
          {STATUS.map(([icon, l], i) => {
            const on = me.status === i
            return (
              <button
                key={l}
                onClick={() => store.updateMe({ status: i })}
                style={{ height: 68, border: 0, cursor: 'pointer', borderRadius: 'var(--radius-md)', background: on ? 'var(--color-accent-900)' : 'transparent', boxShadow: on ? '0 0 0 1px var(--color-accent)' : 'var(--shadow-sm)', color: on ? 'var(--color-accent-200)' : 'var(--color-neutral-300)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 5, font: '500 11px var(--font-body)' }}
              >
                <i aria-hidden className={icon} style={{ fontSize: 22 }} />
                {l}
              </button>
            )
          })}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, height: 42, padding: '0 12px', borderRadius: 'var(--radius-md)', boxShadow: 'var(--shadow-sm)', background: 'var(--color-bg)', flex: 'none' }}>
          <i aria-hidden className="ph ph-chat-circle" style={{ color: 'var(--color-neutral-500)' }} />
          <input value={note} maxLength={40} onChange={e => setNote(e.target.value)} placeholder="Note for the crew" style={{ flex: 1, minWidth: 0, border: 0, outline: 0, background: 'transparent', color: 'var(--color-text)', font: '400 13px var(--font-body)' }} />
          <span style={{ fontSize: 10, color: 'var(--color-neutral-600)' }}>{40 - note.length}</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <i aria-hidden className="ph ph-ghost" style={{ fontSize: 18, color: 'var(--color-neutral-300)' }} />
          <span style={{ flex: 1, fontSize: 14 }}>
            Ghost
            <span style={{ display: 'block', ...label }}>Your pins stay on your phone</span>
          </span>
          <Toggle on={me.ghost} onChange={v => store.setGhost(v)} label="Ghost mode" />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <i aria-hidden className="ph ph-gauge" style={{ fontSize: 18, color: 'var(--color-neutral-300)' }} />
          <span style={{ flex: 1, fontSize: 14 }}>
            Data saver
            <span style={{ display: 'block', ...label }}>
              {s.dataSaver ? 'Checks for news every minute and when a notification arrives. Friends’ photos load when you tap.' : 'Live updates. Uses more data and battery.'}
            </span>
          </span>
          <Toggle on={s.dataSaver} onChange={v => store.setDataSaver(v)} label="Data saver" />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: '12px 14px', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-sm)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <i aria-hidden className="ph ph-bell-ringing" style={{ fontSize: 18, color: 'var(--color-neutral-300)' }} />
            <span style={{ flex: 1, fontSize: 14 }}>
              Notifications
              <span style={{ display: 'block', ...label }}>
                {push === 'install-first'
                  ? 'Add Crew to your Home Screen first (Share → Add to Home Screen)'
                  : push === 'unsupported'
                    ? 'This browser can’t show notifications'
                    : push === 'blocked'
                      ? 'Blocked. Turn on in Settings → Notifications → Crew'
                      : 'SOS and pings always come through'}
              </span>
            </span>
            {(push === 'on' || push === 'off') && (
              <Toggle on={push === 'on'} label="Notifications" onChange={v => runPush(() => (v ? enablePush(me.id, prefs) : disablePush()))} />
            )}
          </div>
          {push === 'on' && (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, paddingLeft: 30 }}>
                <span style={{ flex: 1, fontSize: 13, color: 'var(--color-neutral-300)' }}>Friends’ pins and status</span>
                <Toggle on={prefs.updates} label="Pin notifications" onChange={v => setPref('updates', v)} />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, paddingLeft: 30 }}>
                <span style={{ flex: 1, fontSize: 13, color: 'var(--color-neutral-300)' }}>Chat messages</span>
                <Toggle on={prefs.chat} label="Chat notifications" onChange={v => setPref('chat', v)} />
              </div>
            </>
          )}
          {pushBusy && <div style={label}>One moment…</div>}
          {pushErr && <div style={{ fontSize: 12, color: 'var(--sos-text)' }}>{pushErr}</div>}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 10, flex: 'none' }}>
          <button className="btn btn-secondary" style={{ height: 46, color: 'var(--sos-text)', boxShadow: 'inset 0 0 0 1px var(--sos-line)', border: 0 }} onClick={() => { close(); store.ui({ sos: true }) }}>
            <i aria-hidden className="ph-bold ph-siren" />
            SOS
          </button>
          <button className="btn btn-primary" style={{ height: 46 }} onClick={close}>
            Done
          </button>
        </div>
        <div style={{ ...label, textAlign: 'center', color: 'var(--color-neutral-600)' }}>Version {__BUILD__}</div>
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
  const me = store.me()
  const mine = store.myDot()
  const mineLive = pinned(mine, Date.now())
  const pct = (p * 100).toFixed(1)

  return (
    <div className="screen" style={{ zIndex: 15, background: 'radial-gradient(70% 45% at 50% 40%, #5a0f26, #000 75%)', alignItems: 'center', padding: '0 20px' }}>
      <div
        onPointerDown={down}
        onPointerUp={up}
        onPointerLeave={up}
        onPointerCancel={up}
        onContextMenu={e => e.preventDefault()}
        style={{ marginTop: 'calc(var(--safe-top) + 14vh)', width: 200, height: 200, borderRadius: '50%', position: 'relative', display: 'grid', placeItems: 'center', boxShadow: '0 0 0 1px #ff5c7a44', touchAction: 'none', cursor: 'pointer', userSelect: 'none', WebkitUserSelect: 'none' }}
      >
        <div style={{ position: 'absolute', inset: -6, borderRadius: '50%', background: `conic-gradient(#ff3b5c 0 ${pct}%, transparent ${pct}%)`, WebkitMask: 'radial-gradient(farthest-side, transparent calc(100% - 4px), #000 calc(100% - 3px))', mask: 'radial-gradient(farthest-side, transparent calc(100% - 4px), #000 calc(100% - 3px))', filter: 'drop-shadow(0 0 8px #ff3b5c)' }} />
        <i aria-hidden className="ph-bold ph-siren" style={{ fontSize: 64, color: 'var(--sos-text)' }} />
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
        {sent && (
          // SMS gets through on signal too weak for data.
          <a
            className="btn btn-block"
            href={smsHref(sosSms({ name: me?.name ?? 'me', where: mineLive ? where(store.place(mine!.place_id), mine!.nx, mine!.ny) : 'location unknown', at: Date.now(), battery: me?.battery }))}
            style={{ height: 46, color: 'var(--sos-text)', boxShadow: 'inset 0 0 0 1px var(--sos-line)', border: 0 }}
          >
            <i aria-hidden className="ph ph-chat-text" />
            {s.signal === 'none' ? 'No data: send SOS by text message' : 'Also send by text message'}
          </a>
        )}
        {safe && (
          <button className="btn btn-secondary btn-block" style={{ height: 46 }} onClick={() => { store.ui({ sos: false }); store.openPlace('safe') }}>
            <i aria-hidden className="ph ph-first-aid" />
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
