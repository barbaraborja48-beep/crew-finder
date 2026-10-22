import { useRef, useState } from 'react'
import { store, useStore } from '../lib/store'
import { alive, dotOpacity, dotSize, fraction, nearFriend, remaining, FLOOR_H, FLOOR_W } from '../lib/rules'
import { fmt, glow, ME, where } from '../lib/venue'
import { useNow, mySync, crewRows, statusOf } from '../lib/view'
import { Scaled, SyncPill } from '../components/common'

export function StageScreen() {
  const s = useStore()
  const now = useNow(250)
  const floorRef = useRef<HTMLDivElement>(null)
  const [ripple, setRipple] = useState<{ x: number; y: number; k: number } | null>(null)
  const stages = s.places.filter(p => p.type === 'stage')
  const stage = store.place(s.ui.stage) ?? stages[0]
  const rows = crewRows(s, now)
  const mine = store.myDot()
  const meLive = alive(mine, now)
  const me = store.me()
  const sync = mySync(s, now)

  if (!stage) return <div className="screen" />

  const onTap = (e: React.MouseEvent) => {
    const r = floorRef.current!.getBoundingClientRect()
    const nx = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width))
    const ny = Math.min(1, Math.max(0, (e.clientY - r.top) / r.height))
    store.checkIn(stage.id, nx, ny)
    setRipple({ x: nx * FLOOR_W, y: ny * FLOOR_H, k: Date.now() })
    navigator.vibrate?.(15)
  }

  const here = rows.filter(r => r.live && r.dot!.place_id === stage.id)
  const meHere = meLive && mine!.place_id === stage.id
  const sent = !!mine && !s.pending[mine.id] && !me?.ghost
  const near = meLive ? nearFriend(store.friendDots(), mine!.place_id, mine!.nx, mine!.ny, now) : undefined
  const myLine = meLive ? where(store.place(mine!.place_id), mine!.nx, mine!.ny) : 'Not checked in'
  const mySub = meLive ? `${fmt(remaining(mine!, now))} left${near ? ` · ${near.name} near, fading slower` : ''}` : 'Tap your spot on the floor'

  return (
    <div className="screen scroll no-scrollbar" style={{ paddingBottom: 'calc(var(--tabbar-h) + 12px)' }}>
      <div style={{ padding: 'var(--hdr-top) 20px 8px', display: 'flex', alignItems: 'center', gap: 10 }}>
        <button className="round" aria-label="Back to map" onClick={() => store.ui({ screen: 'map' })}>
          <i className="ph ph-caret-left" />
        </button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="kicker">Stage {stage.n}</div>
          <div style={{ fontSize: 20, fontWeight: 500, letterSpacing: '-.02em' }}>{stage.name}</div>
        </div>
        <SyncPill sync={sync} />
      </div>

      <div className="no-scrollbar" style={{ padding: '4px 20px 12px', display: 'flex', gap: 6, overflowX: 'auto', flex: 'none' }}>
        {stages.map(st => {
          const on = st.id === stage.id
          const c = rows.filter(r => r.live && r.dot!.place_id === st.id).length + (meLive && mine!.place_id === st.id ? 1 : 0)
          return (
            <button
              key={st.id}
              onClick={() => store.ui({ stage: st.id })}
              style={{
                flex: 'none', border: 0, cursor: 'pointer', height: 30, padding: '0 11px', borderRadius: 999, font: '500 11px var(--font-body)',
                background: on ? 'var(--color-accent-900)' : 'transparent', color: on ? 'var(--color-accent-200)' : 'var(--color-neutral-300)',
                boxShadow: on ? '0 0 0 1px var(--color-accent)' : 'var(--shadow-sm)', display: 'flex', alignItems: 'center', gap: 5,
              }}
            >
              {st.name}
              {c > 0 && <span style={{ fontSize: 10, color: 'var(--color-neutral-500)' }}>{c}</span>}
            </button>
          )
        })}
      </div>

      <div style={{ margin: '0 14px' }}>
        <div style={{ height: 28, borderRadius: 'var(--radius-md) var(--radius-md) 0 0', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, fontSize: 10, letterSpacing: '.16em', color: 'var(--color-accent-200)', background: 'linear-gradient(180deg, var(--color-accent-800), transparent)', borderBottom: '1.5px solid var(--color-accent-300)', boxShadow: '0 6px 24px -10px var(--color-accent)' }}>
          <i className="ph ph-speaker-hifi" />
          STAGE
        </div>
        <Scaled w={FLOOR_W} h={FLOOR_H}>
          <div
            ref={floorRef}
            onClick={onTap}
            style={{ position: 'absolute', inset: 0, cursor: 'crosshair', overflow: 'hidden', background: 'radial-gradient(120% 55% at 50% 0%, color-mix(in srgb, var(--color-accent) 10%, transparent), transparent 70%)', borderRadius: '0 0 var(--radius-lg) var(--radius-lg)', boxShadow: 'var(--shadow-sm)' }}
          >
            <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', backgroundImage: 'linear-gradient(var(--color-neutral-900) 1px, transparent 1px), linear-gradient(90deg, var(--color-neutral-900) 1px, transparent 1px)', backgroundSize: '22px 22px', opacity: 0.55 }} />
            {['33.3%', '66.6%'].map(p => <div key={'v' + p} style={{ position: 'absolute', left: p, top: 0, bottom: 0, borderLeft: '1px dashed var(--color-neutral-800)', pointerEvents: 'none' }} />)}
            {['33.3%', '66.6%'].map(p => <div key={'h' + p} style={{ position: 'absolute', top: p, left: 0, right: 0, borderTop: '1px dashed var(--color-neutral-800)', pointerEvents: 'none' }} />)}
            <div style={{ position: 'absolute', left: 8, top: 6, fontSize: 9, color: 'var(--color-neutral-700)', pointerEvents: 'none' }}>FRONT</div>
            <div style={{ position: 'absolute', left: 8, top: 'calc(66.6% + 6px)', fontSize: 9, color: 'var(--color-neutral-700)', pointerEvents: 'none' }}>BACK</div>
            <div style={{ position: 'absolute', right: 10, bottom: 10, fontSize: 16, color: 'var(--color-neutral-600)', pointerEvents: 'none' }}>
              <i className="ph ph-martini" />
            </div>

            {here.map(r => {
              const d = r.dot!
              const f = fraction(d, now)
              const size = dotSize(d.taps)
              return (
                <div key={r.member.id} style={{ position: 'absolute', left: d.nx * FLOOR_W, top: d.ny * FLOOR_H, width: 0, height: 0, pointerEvents: 'none', opacity: dotOpacity(f) }}>
                  <div style={{ position: 'absolute', width: size, height: size, borderRadius: '50%', transform: 'translate(-50%,-50%)', background: r.member.color, boxShadow: glow(r.member.color, f) }} />
                  <div style={{ position: 'absolute', left: size / 2 + 5, top: -7, whiteSpace: 'nowrap', font: '500 10px var(--font-body)', color: 'var(--color-neutral-200)' }}>
                    {r.member.name} {fmt(r.rem)}
                  </div>
                </div>
              )
            })}

            {meHere && (() => {
              const f = fraction(mine!, now)
              const size = dotSize(mine!.taps, true)
              return (
                <div style={{ position: 'absolute', left: mine!.nx * FLOOR_W, top: mine!.ny * FLOOR_H, width: 0, height: 0, pointerEvents: 'none', opacity: 0.2 + 0.8 * f }}>
                  <div style={{ position: 'absolute', width: size, height: size, borderRadius: '50%', transform: 'translate(-50%,-50%)', background: sent ? ME : 'color-mix(in srgb, #3bf0ff 35%, transparent)', boxShadow: sent ? glow(ME, f) : `0 0 0 2px ${ME}, 0 0 10px #3bf0ff88` }} />
                  <div style={{ position: 'absolute', left: size / 2 + 5, top: -7, whiteSpace: 'nowrap', font: '500 10px var(--font-body)', color: 'var(--color-neutral-200)' }}>
                    You {fmt(remaining(mine!, now))}
                  </div>
                </div>
              )
            })()}

            {ripple && (
              <div
                key={ripple.k}
                onAnimationEnd={() => setRipple(null)}
                style={{ position: 'absolute', left: ripple.x, top: ripple.y, width: 16, height: 16, borderRadius: '50%', border: '1.5px solid #3bf0ff', animation: 'ping .9s ease-out forwards', pointerEvents: 'none' }}
              />
            )}
          </div>
        </Scaled>
      </div>

      <div style={{ padding: '12px 20px 0', display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ width: 11, height: 11, borderRadius: '50%', background: ME, boxShadow: `0 0 6px ${ME}`, flex: 'none', opacity: meLive ? 1 : 0.4 }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 500 }}>{myLine}</div>
          <div style={{ fontSize: 11, color: 'var(--color-neutral-500)' }}>{mySub}</div>
        </div>
        <button className="btn btn-secondary" style={{ height: 34 }} onClick={() => store.ui({ sheet: true })}>
          <i className={me ? statusOf(me)[0] : 'ph-fill ph-smiley'} />
          Status
        </button>
      </div>
    </div>
  )
}
