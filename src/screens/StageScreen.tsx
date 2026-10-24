import { useRef, useState } from 'react'
import { store, useStore } from '../lib/store'
import { ageOf, dotOpacity, fraction, fresh, pinned } from '../lib/rules'
import { agoLong, hasCloseUp, isLine, placeTitle, TYPES, where, type Place, type PlaceType } from '../lib/venue'
import { useNow, mySync, crewRows, statusOf } from '../lib/view'
import { Avatar, Scaled, SmsFallback, SyncPill } from '../components/common'
import { Penguin } from '../components/Penguin'
import { activityFor } from '../lib/penguin'

const W = 362
const GROUPS: PlaceType[] = ['stage', 'bar', 'food', 'picnic']

/** Close-up floor size: stages are tall, bars and trucks are wide and shallow. */
function floorHeight(p: Place) {
  const k = p.shape?.kind
  return k === 'counter' ? 260 : k === 'trucks' ? 240 : k === 'kiosk' ? 320 : k === 'tables' ? 300 : k === 'square' ? 362 : 420
}

const dashed = 'var(--color-neutral-800)'
const VLine = ({ at }: { at: string }) => <div style={{ position: 'absolute', left: at, top: 0, bottom: 0, borderLeft: `1px dashed ${dashed}`, pointerEvents: 'none' }} />
const HLine = ({ at }: { at: string }) => <div style={{ position: 'absolute', top: at, left: 0, right: 0, borderTop: `1px dashed ${dashed}`, pointerEvents: 'none' }} />
const Tag = ({ style, children }: { style: React.CSSProperties; children: React.ReactNode }) => (
  <div style={{ position: 'absolute', fontSize: 9, color: 'var(--color-neutral-700)', pointerEvents: 'none', letterSpacing: '.06em', ...style }}>{children}</div>
)
const solid = { background: 'linear-gradient(180deg, var(--color-accent-800), color-mix(in srgb, var(--color-accent-800) 40%, transparent))', boxShadow: '0 0 0 1.5px var(--color-accent-300), 0 6px 24px -8px var(--color-accent)', color: 'var(--color-accent-200)' }

/** What's drawn on the floor: the real thing at its relative size, plus zone guides. */
function FloorArt({ p, h, maxLen }: { p: Place; h: number; maxLen: number }) {
  const sh = p.shape
  if (!sh || sh.kind === 'square' || sh.kind === 'zone')
    return (
      <>
        <VLine at="33.3%" /><VLine at="66.6%" /><HLine at="33.3%" /><HLine at="66.6%" />
        <Tag style={{ left: 8, top: 6 }}>FRONT</Tag>
        <Tag style={{ left: 8, top: 'calc(66.6% + 6px)' }}>BACK</Tag>
        {!sh && <div style={{ position: 'absolute', right: 10, bottom: 10, fontSize: 16, color: 'var(--color-neutral-600)', pointerEvents: 'none' }}><i aria-hidden className="ph ph-martini" /></div>}
      </>
    )
  if (sh.kind === 'trucks')
    return (
      <>
        {Array.from({ length: 8 }, (_, i) => (
          <div key={i} style={{ position: 'absolute', left: (i * W) / 8 + 4, top: 10, width: W / 8 - 8, height: 34, borderRadius: 6, ...solid, display: 'grid', placeItems: 'center', font: '500 11px var(--font-body)', pointerEvents: 'none' }}>
            {i + 1}
          </div>
        ))}
        {Array.from({ length: 7 }, (_, i) => <VLine key={i} at={`${((i + 1) * 100) / 8}%`} />)}
        <Tag style={{ left: 8, bottom: 8 }}>QUEUE</Tag>
      </>
    )
  if (isLine(sh)) {
    // Bar counters drawn to scale against the longest one on the map.
    const cw = Math.max(90, Math.round(((W - 24) * sh.len) / maxLen))
    return (
      <>
        <div style={{ position: 'absolute', left: (W - cw) / 2, top: 12, width: cw, height: 28, borderRadius: 6, ...solid, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, fontSize: 10, letterSpacing: '.16em', pointerEvents: 'none' }}>
          <i aria-hidden className="ph ph-martini" />BAR
        </div>
        <VLine at="33.3%" /><VLine at="66.6%" />
        <Tag style={{ left: 8, bottom: 8 }}>LEFT END</Tag>
        <Tag style={{ left: '50%', bottom: 8, transform: 'translateX(-50%)' }}>MIDDLE</Tag>
        <Tag style={{ right: 8, bottom: 8 }}>RIGHT END</Tag>
        <Tag style={{ right: 8, top: 48 }}>{sh.len >= maxLen * 0.6 ? 'LONG BAR' : sh.len >= maxLen * 0.3 ? 'MEDIUM BAR' : 'SMALL BAR'}</Tag>
      </>
    )
  }
  // Kiosk bar or picnic area in the middle; you tap which side you're on.
  const size = Math.min(h - 120, Math.round(70 + sh.size * 1.2))
  const diag = Math.atan2(h, W) * (180 / Math.PI)
  return (
    <>
      {[diag, -diag].map(a => (
        <div key={a} style={{ position: 'absolute', left: '50%', top: '50%', width: Math.hypot(W, h), borderTop: `1px dashed ${dashed}`, transform: `translate(-50%, -50%) rotate(${a}deg)`, pointerEvents: 'none' }} />
      ))}
      <div style={{ position: 'absolute', left: (W - size) / 2, top: (h - size) / 2, width: size, height: size, borderRadius: sh.kind === 'kiosk' ? 10 : 18, ...(sh.kind === 'kiosk' ? solid : { boxShadow: '0 0 0 1px var(--color-neutral-700)', color: 'var(--color-neutral-400)' }), display: 'grid', placeItems: 'center', pointerEvents: 'none' }}>
        {sh.kind === 'kiosk' ? (
          <span style={{ fontSize: 10, letterSpacing: '.16em', display: 'flex', gap: 5, alignItems: 'center' }}><i aria-hidden className="ph ph-martini" />BAR</span>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6, fontSize: 22 }}>
            {Array.from({ length: 6 }, (_, i) => <i key={i} className="ph ph-picnic-table" />)}
          </div>
        )}
      </div>
      <Tag style={{ left: '50%', top: 8, transform: 'translateX(-50%)' }}>FRONT</Tag>
      <Tag style={{ left: '50%', bottom: 8, transform: 'translateX(-50%)' }}>BACK</Tag>
      <Tag style={{ left: 8, top: '50%' }}>LEFT</Tag>
      <Tag style={{ right: 8, top: '50%' }}>RIGHT</Tag>
    </>
  )
}

export function StageScreen() {
  const s = useStore()
  const now = useNow(250)
  const floorRef = useRef<HTMLDivElement>(null)
  const [ripple, setRipple] = useState<{ x: number; y: number; k: number } | null>(null)
  const closeUps = s.places.filter(hasCloseUp)
  const place = closeUps.find(p => p.id === s.ui.stage) ?? closeUps.find(p => p.type === 'stage')
  const rows = crewRows(s, now)
  const mine = store.myDot()
  const meLive = pinned(mine, now)
  const me = store.me()
  const sync = mySync(s, now)

  if (!place) return <div className="screen" />
  const H = floorHeight(place)
  const maxLen = Math.max(1, ...s.places.map(p => (p.shape && isLine(p.shape) && p.shape.kind === 'counter' ? p.shape.len : 0)))
  const siblings = closeUps.filter(p => p.type === place.type)
  const groups = GROUPS.filter(g => closeUps.some(p => p.type === g))
  const liveAt = (id: string) => rows.filter(r => r.fresh && r.dot!.place_id === id).length + (fresh(mine, now) && mine!.place_id === id ? 1 : 0)

  const onTap = (e: React.MouseEvent) => {
    const r = floorRef.current!.getBoundingClientRect()
    const nx = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width))
    const ny = Math.min(1, Math.max(0, (e.clientY - r.top) / r.height))
    store.checkIn(place.id, nx, ny)
    setRipple({ x: nx * W, y: ny * H, k: Date.now() })
    navigator.vibrate?.(15)
  }

  const here = rows.filter(r => r.live && r.dot!.place_id === place.id)
  const meHere = meLive && mine!.place_id === place.id
  const sent = !!mine && !s.pending[mine.id] && !me?.ghost
  const myLine = meLive ? where(store.place(mine!.place_id), mine!.nx, mine!.ny) : 'Not pinned'
  const mySub = meLive ? `Pinned ${agoLong(ageOf(mine!, now))} · pin again to update` : 'Pin where you are'
  const chipLabel = (p: Place) => (p.type === 'stage' || !p.near ? p.name : p.near)

  return (
    <div className="screen scroll no-scrollbar" style={{ paddingBottom: 'calc(var(--tabbar-h) + 12px)' }}>
      <div style={{ padding: 'var(--hdr-top) 20px 8px', display: 'flex', alignItems: 'center', gap: 10 }}>
        <button className="round" aria-label="Back to map" onClick={() => store.ui({ screen: 'map' })}>
          <i aria-hidden className="ph ph-caret-left" />
        </button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="kicker">{place.floor ? `Planta ${place.floor} · ${TYPES[place.type][0]}` : place.type === 'stage' ? `Stage ${place.n}` : TYPES[place.type][0]}</div>
          <div style={{ fontSize: 20, fontWeight: 500, letterSpacing: '-.02em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{placeTitle(place)}</div>
        </div>
        <SyncPill sync={sync} />
      </div>

      {groups.length > 1 && (
        <div style={{ padding: '2px 20px 8px', display: 'flex' }}>
          <div style={{ display: 'flex', gap: 2, padding: 3, borderRadius: 'var(--radius-md)', boxShadow: 'var(--shadow-sm)', background: 'var(--color-surface)' }}>
            {groups.map(g => {
              const on = g === place.type
              return (
                <button
                  key={g}
                  onClick={() => {
                    const mineThere = meLive && store.place(mine!.place_id)?.type === g ? mine!.place_id : null
                    store.ui({ stage: mineThere ?? closeUps.find(p => p.type === g)!.id })
                  }}
                  style={{ border: 0, cursor: 'pointer', font: '500 12px var(--font-body)', padding: '6px 12px', borderRadius: 6, background: on ? 'var(--color-accent-800)' : 'transparent', color: on ? 'var(--color-accent-100)' : 'var(--color-neutral-400)', display: 'flex', alignItems: 'center', gap: 5 }}
                >
                  <i aria-hidden className={TYPES[g][1]} />
                  {g === 'stage' ? 'Stages' : g === 'bar' ? 'Bars' : g === 'food' ? 'Food' : 'Picnic'}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {siblings.length > 1 && (
        <div className="no-scrollbar" style={{ padding: '4px 20px 12px', display: 'flex', gap: 6, overflowX: 'auto', flex: 'none' }}>
          {siblings.map(p => {
            const on = p.id === place.id
            const c = liveAt(p.id)
            return (
              <button
                key={p.id}
                onClick={() => store.ui({ stage: p.id })}
                style={{ flex: 'none', border: 0, cursor: 'pointer', height: 30, padding: '0 11px', borderRadius: 999, font: '500 11px var(--font-body)', background: on ? 'var(--color-accent-900)' : 'transparent', color: on ? 'var(--color-accent-200)' : 'var(--color-neutral-300)', boxShadow: on ? '0 0 0 1px var(--color-accent)' : 'var(--shadow-sm)', display: 'flex', alignItems: 'center', gap: 5 }}
              >
                {chipLabel(p)}
                {c > 0 && <span style={{ fontSize: 10, color: 'var(--color-neutral-500)' }}>{c}</span>}
              </button>
            )
          })}
        </div>
      )}

      <div style={{ margin: '0 14px' }}>
        {place.type === 'stage' && (
          <div style={{ height: 28, borderRadius: 'var(--radius-md) var(--radius-md) 0 0', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, fontSize: 10, letterSpacing: '.16em', color: 'var(--color-accent-200)', background: 'linear-gradient(180deg, var(--color-accent-800), transparent)', borderBottom: '1.5px solid var(--color-accent-300)', boxShadow: '0 6px 24px -10px var(--color-accent)' }}>
            <i aria-hidden className="ph ph-speaker-hifi" />
            {place.floor ? 'DJ BOOTH' : 'STAGE'}
          </div>
        )}
        <Scaled w={W} h={H}>
          <div
            ref={floorRef}
            onClick={onTap}
            style={{ position: 'absolute', inset: 0, cursor: 'crosshair', overflow: 'hidden', background: 'radial-gradient(120% 55% at 50% 0%, color-mix(in srgb, var(--color-accent) 10%, transparent), transparent 70%)', borderRadius: place.type === 'stage' ? '0 0 var(--radius-lg) var(--radius-lg)' : 'var(--radius-lg)', boxShadow: 'var(--shadow-sm)' }}
          >
            <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', backgroundImage: 'linear-gradient(var(--color-neutral-900) 1px, transparent 1px), linear-gradient(90deg, var(--color-neutral-900) 1px, transparent 1px)', backgroundSize: '22px 22px', opacity: 0.55 }} />
            <FloorArt p={place} h={H} maxLen={maxLen} />

            {here.map(r => {
              const d = r.dot!
              const f = fraction(d, now)
              const size = 30 + Math.min(4, d.taps - 1) * 4
              return (
                <button
                  key={r.member.id}
                  aria-label={r.member.name}
                  onClick={e => {
                    e.stopPropagation()
                    store.ui({ findId: r.member.id, screen: 'find' })
                  }}
                  style={{ position: 'absolute', left: d.nx * W, top: d.ny * H, transform: 'translate(-50%, -80%)', border: 0, padding: 0, background: 'transparent', cursor: 'pointer', opacity: dotOpacity(f) * 0.4 + 0.6, display: 'flex', flexDirection: 'column', alignItems: 'center' }}
                >
                  <Penguin color={r.member.color} acc={r.member.acc ?? 0} activity={activityFor(place.type, r.member.status, r.fresh)} seed={r.member.id} size={size} glow={f} signal={r.member.net ?? null} saver={!!r.member.saver} />
                  <span style={{ whiteSpace: 'nowrap', font: '500 10px var(--font-body)', color: '#fff', textShadow: '0 0 6px #000' }}>
                    {r.member.name}
                  </span>
                </button>
              )
            })}

            {meHere && me && (() => {
              const f = fraction(mine!, now)
              const size = 32 + Math.min(4, mine!.taps - 1) * 4
              return (
                <div style={{ position: 'absolute', left: mine!.nx * W, top: mine!.ny * H, transform: 'translate(-50%, -80%)', pointerEvents: 'none', opacity: 0.6 + 0.4 * f, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  <Penguin color={me.color} acc={me.acc ?? 0} activity={activityFor(place.type, me.status, fresh(mine, now))} seed={me.id} size={size} glow={f} signal={s.myNet} saver={s.dataSaver} queued={!sent} />
                  <span style={{ whiteSpace: 'nowrap', font: '500 10px var(--font-body)', color: '#fff', textShadow: '0 0 6px #000' }}>
                    You
                  </span>
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
        {me && (
          <span style={{ opacity: meLive ? 1 : 0.45 }}>
            <Avatar name={me.name} color={me.color} acc={me.acc} size={34} />
          </span>
        )}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 500 }}>{myLine}</div>
          <div style={{ fontSize: 11, color: 'var(--color-neutral-500)' }}>{mySub}</div>
        </div>
        <button className="btn btn-secondary" style={{ height: 34 }} onClick={() => store.ui({ sheet: true })}>
          <i aria-hidden className={me ? statusOf(me)[0] : 'ph-fill ph-smiley'} />
          Status
        </button>
      </div>
      <div style={{ padding: '10px 20px 0' }}>
        <SmsFallback />
      </div>
    </div>
  )
}
