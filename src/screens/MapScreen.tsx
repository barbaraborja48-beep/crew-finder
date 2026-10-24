import { store, useStore } from '../lib/store'
import { fresh, pinned } from '../lib/rules'
import { floorView, hasCloseUp, mapPos, onFloor, outline, placeAt, toMap, TYPES, MAP_W, MAP_H, type Place, type PlaceType, type Venue } from '../lib/venue'
import { useNow, mySync, crewRows, statusOf, ageLabel, type CrewRow } from '../lib/view'
import { rowOpacity } from '../lib/rules'
import { Avatar, Freshness, ProfileButton, Scaled, SmsFallback, SyncPill } from '../components/common'
import { ZoomPan } from '../components/ZoomPan'
import { Penguin } from '../components/Penguin'
import { activityFor, type Activity } from '../lib/penguin'
import { fraction } from '../lib/rules'
import type { State } from '../lib/store'

export function MapScreen() {
  const s = useStore()
  const now = useNow()
  const { ui } = s
  // Multi-floor venues show one floor at a time; everything else is unchanged.
  const floors = s.venue?.floors ?? []
  const v = s.venue && floorView(s.venue, ui.floor)
  const sync = mySync(s, now)
  const rows = crewRows(s, now)
  const mine = store.myDot()
  const meLive = pinned(mine, now)
  // Every type shows unless switched off. Open areas start hidden on the big festival map
  // (too many), but on a club map the balcony and entrances are the landmarks.
  const isOn = (k: PlaceType) => ui.types[k] ?? (k !== 'open' || floors.length > 0)
  const stages = s.places.filter(p => p.type === 'stage' && onFloor(p, ui.floor))
  const areas = s.places.filter(p => p.type !== 'stage' && isOn(p.type) && onFloor(p, ui.floor))
  const typesHere = (Object.entries(TYPES) as [PlaceType, [string, string]][]).filter(([k]) => s.places.some(p => p.type === k))
  const onFloorCount = (n: number) =>
    liveFriends.filter(r => store.place(r.dot!.place_id)?.floor === n).length + (meLive && store.place(mine!.place_id)?.floor === n ? 1 : 0)
  const liveFriends = rows.filter(r => r.live && r.dot)
  const seg = (on: boolean) => ({ background: on ? 'var(--color-accent-800)' : 'transparent', color: on ? 'var(--color-accent-100)' : 'var(--color-neutral-400)' })

  // Club venues: tap anywhere on the plan and you're pinned there, named after the nearest
  // spot. The message that pops up has an Undo for mis-taps.
  const onPlanTap = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!v || !floors.length) return
    const r = e.currentTarget.getBoundingClientRect()
    const x = ((e.clientX - r.left) / r.width) * MAP_W
    const y = ((e.clientY - r.top) / r.height) * MAP_H
    const hit = placeAt(s.places, ui.floor, (x - v.view_ox) / v.view_scale, (y - v.view_oy) / v.view_scale)
    store.ui({ areaSel: null })
    if (hit) {
      store.checkIn(hit.place.id, hit.nx, hit.ny, false, true)
      navigator.vibrate?.(15)
    } else store.toast('Tap inside the venue or the smoking area', 'ph ph-map-pin', 'var(--color-neutral-400)')
  }

  const sel = store.place(ui.areaSel)
  const here = sel ? liveFriends.filter(r => r.dot!.place_id === sel.id) : []
  const meHere = !!sel && meLive && mine!.place_id === sel.id

  // Crowd = how many of your crew are lit up at each stage.
  const total = Math.max(1, liveFriends.length + (meLive ? 1 : 0))
  const blobs = stages.flatMap(st => {
    const c = liveFriends.filter(r => r.dot!.place_id === st.id).length + (meLive && mine!.place_id === st.id ? 1 : 0)
    if (!c || !v) return []
    const d = Math.min(1, c / total)
    const p = toMap(v, st.x, st.y)
    return [{ ...p, id: st.id, s: 70 + d * 90, c: d > 0.75 ? '#ff3b5ccc' : d > 0.55 ? '#ff3bd4bb' : d > 0.4 ? '#ffc83b99' : '#3bf0ff77' }]
  })

  return (
    <div className="screen">
      <div style={{ padding: 'var(--hdr-top) 20px 10px', display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
        <div>
          <div className="kicker">{v?.name ?? s.crew?.name}</div>
          <div className="title">
            {(() => {
              const [first, ...rest] = (v?.event_name || s.crew?.name || '').split(' ')
              return (
                <>
                  {first} <span className="dim">{rest.join(' ')}</span>
                </>
              )
            })()}
          </div>
        </div>
        <ProfileButton />
      </div>
      <div style={{ padding: '0 20px 10px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <div style={{ display: 'flex', gap: 2, padding: 3, borderRadius: 'var(--radius-md)', boxShadow: 'var(--shadow-sm)', background: 'var(--color-surface)' }}>
          {(['crew', 'crowd'] as const).map(k => (
            <button key={k} onClick={() => store.ui({ heat: k })} style={{ border: 0, cursor: 'pointer', font: '500 12px var(--font-body)', padding: '6px 16px', borderRadius: 6, textTransform: 'capitalize', ...seg(ui.heat === k) }}>
              {k}
            </button>
          ))}
        </div>
        <SyncPill sync={sync} />
      </div>

      <Scaled w={MAP_W} h={MAP_H}>
        <ZoomPan
          w={MAP_W}
          h={MAP_H}
          doubleTap={!floors.length} // on club maps a tap pins you, so no double-tap zoom
          overlay={
            <>
            {floors.length > 0 && !sel && (
              <div style={{ position: 'absolute', left: '50%', top: 8, transform: 'translateX(-50%)', zIndex: 3, pointerEvents: 'none', whiteSpace: 'nowrap', font: '500 10px var(--font-body)', color: 'rgba(255,255,255,.55)', padding: '4px 10px', borderRadius: 999, background: 'rgba(0,0,0,.6)' }}>
                Tap the map to pin your spot
              </div>
            )}
            {/* Filters for the big festival map; a club plan is small enough to show everything. */}
            {!floors.length && <div className="no-scrollbar" style={{ position: 'absolute', left: 0, right: 0, top: 8, padding: '0 12px', display: 'flex', gap: 5, overflowX: 'auto', zIndex: 3 }}>
              {typesHere.map(([k, [label, icon]]) => {
                const on = isOn(k)
                return (
                  <button
                    key={k}
                    onClick={() => store.ui({ types: { ...ui.types, [k]: !on }, areaSel: null })}
                    style={{
                      flex: 'none', height: 26, border: 0, cursor: 'pointer', padding: '0 10px', borderRadius: 999, font: '500 10px var(--font-body)',
                      background: on ? 'color-mix(in srgb, var(--color-accent-600) 22%, rgba(0,0,0,.7))' : 'rgba(0,0,0,.72)', color: on ? '#fff' : 'var(--color-neutral-400)',
                      boxShadow: on ? '0 0 0 1px var(--color-accent-500), 0 0 14px -6px var(--color-accent)' : 'var(--shadow-sm)', display: 'flex', alignItems: 'center', gap: 4, backdropFilter: 'blur(8px)',
                    }}
                  >
                    <i aria-hidden className={icon} style={{ fontSize: 12 }} />
                    {label}
                  </button>
                )
              })}
            </div>}
            </>
          }
          corner={
            floors.length > 1 && (
              // Floor switch, like lift buttons: top floor on top. The dot counts who's there.
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'center' }}>
                {[...floors].reverse().map(f => {
                  const on = ui.floor === f.n
                  const c = onFloorCount(f.n)
                  return (
                    <button
                      key={f.n}
                      aria-label={f.name}
                      aria-pressed={on}
                      onClick={() => store.ui({ floor: f.n, areaSel: null })}
                      className="round"
                      style={{
                        position: 'relative', width: 34, height: 34, font: '600 13px var(--font-body)',
                        background: on ? 'var(--color-accent-700)' : 'rgba(0,0,0,.6)', color: on ? '#fff' : 'var(--color-neutral-300)',
                        boxShadow: on ? '0 0 0 1.5px var(--color-accent-300), 0 0 14px var(--color-accent)' : undefined,
                      }}
                    >
                      P{f.n}
                      {c > 0 && (
                        <span style={{ position: 'absolute', top: -3, right: -3, minWidth: 14, height: 14, borderRadius: 7, padding: '0 3px', background: '#ff3bd4', color: '#fff', font: '600 9px/14px var(--font-body)' }}>{c}</span>
                      )}
                    </button>
                  )
                })}
              </div>
            )
          }
        >
          {z => {
            const inv = 1 / z
            // Penguins grow a bit as you zoom (pins and labels stay the same size).
            const grow = Math.pow(z, 0.75) * inv
            const penguins = v && ui.heat === 'crew' ? mapPenguins(s, v, rows, now, ui.floor) : []
            // Names: faint text under the penguin, or above its head if another penguin is right there.
            // Times live in the list below, so the map stays calm.
            const labelAbove = new Set<string>()
            penguins.forEach((a, i) =>
              penguins.slice(0, i).forEach(b => {
                if (Math.abs(a.x - b.x) * z < 34 && Math.abs(a.y - b.y) * z < 26 && !labelAbove.has(b.key)) labelAbove.add(a.key)
              }),
            )
            return (
              <>
                {v && (
                  <div
                    style={{
                      position: 'absolute', inset: 0,
                      background: `url(${v.map_url}) ${v.view_ox}px ${v.view_oy}px / ${v.map_w * v.view_scale}px auto no-repeat`,
                      // Photo-like festival maps get dimmed so penguins pop; line-drawn club plans don't need it.
                      filter: floors.length ? 'brightness(.85)' : 'saturate(.55) brightness(.42) contrast(1.15)',
                    }}
                  />
                )}
                {floors.length > 0 && <div onClick={onPlanTap} style={{ position: 'absolute', inset: 0, cursor: 'crosshair' }} />}
                {ui.heat === 'crowd' && (
                  <div style={{ position: 'absolute', inset: 0, mixBlendMode: 'screen', pointerEvents: 'none' }}>
                    {blobs.map(b => (
                      <div key={b.id} style={{ position: 'absolute', left: b.x, top: b.y, width: b.s, height: b.s, transform: 'translate(-50%,-50%)', borderRadius: '50%', background: `radial-gradient(${b.c}, transparent 68%)` }} />
                    ))}
                  </div>
                )}
                {v && (
                  // Bars, the food truck row and picnic areas at their real size and angle. Tap for a close-up.
                  <svg width={MAP_W} height={MAP_H} style={{ position: 'absolute', inset: 0, overflow: 'visible', pointerEvents: 'none' }}>
                    {areas.filter(a => a.shape && a.shape.kind !== 'zone').map(a => {
                      const here = (meLive && mine!.place_id === a.id) || liveFriends.some(r => r.dot!.place_id === a.id)
                      return (
                        <polygon
                          key={a.id}
                          points={outline(v, a.shape!).map(p => `${p.x},${p.y}`).join(' ')}
                          onClick={() => store.ui({ stage: a.id, screen: 'stage', areaSel: null })}
                          style={{ pointerEvents: 'auto', cursor: 'pointer', fill: here ? 'color-mix(in srgb, var(--color-accent) 32%, transparent)' : 'color-mix(in srgb, var(--color-accent) 14%, transparent)', stroke: 'color-mix(in srgb, var(--color-accent-300) 75%, transparent)', strokeWidth: inv, strokeDasharray: a.type === 'bar' ? undefined : `${3 * inv} ${2 * inv}` }}
                        />
                      )
                    })}
                    {areas.filter(a => a.type === 'outside' && a.shape?.kind === 'zone').map(a => (
                      <Lounge key={a.id} v={v} p={a} inv={inv} />
                    ))}
                  </svg>
                )}
                {v && isOn('stage') &&
                  stages.map(st => {
                    const p = toMap(v, st.x, st.y)
                    // Club dance floor: nothing drawn, the plan already shows it; tap anywhere to pin.
                    if (st.shape?.kind === 'square') return null
                    return (
                      <div key={st.id}>
                        <button
                          aria-label={st.name}
                          onClick={() => store.ui({ stage: st.id, screen: 'stage' })}
                          style={{ position: 'absolute', left: p.x, top: p.y, transform: 'translate(-50%,-50%)', width: 46, height: 46, border: 0, cursor: 'pointer', borderRadius: '50%', padding: 0, background: 'transparent', boxShadow: `inset 0 0 0 ${inv}px color-mix(in srgb, var(--color-accent-300) 55%, transparent)` }}
                        />
                        <div style={{ position: 'absolute', left: p.x, top: p.y + 23, transform: `translateX(-50%) scale(${inv})`, transformOrigin: '50% 0', pointerEvents: 'none', fontSize: 10, fontWeight: 500, whiteSpace: 'nowrap', padding: '2px 8px', borderRadius: 999, background: 'rgba(0,0,0,.72)', color: '#fff', boxShadow: 'var(--shadow-sm)' }}>
                          {st.name}
                        </div>
                      </div>
                    )
                  })}
                {v &&
                  areas.filter(a => !(a.shape?.kind === 'zone' && a.shape.bg)).map(a => {
                    const p = toMap(v, a.x, a.y)
                    const on = ui.areaSel === a.id
                    return (
                      <button
                        key={a.id}
                        aria-label={a.name}
                        onClick={() => (hasCloseUp(a) ? store.ui({ stage: a.id, screen: 'stage', areaSel: null }) : store.ui({ areaSel: on ? null : a.id }))}
                        style={{
                          position: 'absolute', left: p.x, top: p.y, transform: `translate(-50%,-50%) scale(${Math.max(inv, 0.45)})`, width: 24, height: 24, border: 0, cursor: 'pointer', borderRadius: '50%', padding: 0, zIndex: 2,
                          background: on ? 'var(--color-accent-700)' : 'rgba(10,10,16,.9)', color: on ? '#fff' : 'var(--color-neutral-200)',
                          boxShadow: on ? '0 0 0 1.5px var(--color-accent-300), 0 0 12px var(--color-accent)' : 'var(--shadow-sm)',
                          display: 'grid', placeItems: 'center', fontSize: 13,
                        }}
                      >
                        <i aria-hidden className={TYPES[a.type][1]} />
                      </button>
                    )
                  })}
                {penguins.map(pg => (
                  <button
                    key={pg.key}
                    aria-label={pg.mine ? 'You' : pg.name}
                    onClick={() => (pg.mine ? store.ui({ sheet: true }) : store.ui({ findId: pg.key, screen: 'find' }))}
                    style={{ position: 'absolute', left: pg.x, top: pg.y, zIndex: 4, border: 0, padding: 0, background: 'transparent', cursor: 'pointer', transform: `translate(-50%, -88%) scale(${grow})`, transformOrigin: '50% 88%' }}
                  >
                    <Penguin color={pg.color} acc={pg.acc} activity={pg.activity} seed={pg.key} size={18} glow={pg.glow} signal={pg.signal} saver={pg.saver} queued={pg.queued} />
                    <span
                      style={{
                        position: 'absolute', left: '50%', ...(labelAbove.has(pg.key) ? { bottom: '100%' } : { top: '92%' }),
                        transform: `translateX(-50%) scale(${Math.min(1, 1.15 / Math.pow(z, 0.75))})`, transformOrigin: labelAbove.has(pg.key) ? '50% 100%' : '50% 0',
                        fontSize: 8, fontWeight: 500, whiteSpace: 'nowrap', pointerEvents: 'none',
                        color: pg.live ? 'rgba(255,255,255,.6)' : 'rgba(255,255,255,.32)', textShadow: '0 0 3px #000, 0 0 6px #000',
                      }}
                    >
                      {pg.mine ? 'You' : pg.name}
                    </span>
                  </button>
                ))}
              </>
            )
          }}
        </ZoomPan>
      </Scaled>

      <div className="scroll no-scrollbar" style={{ flex: 1, marginTop: -12, position: 'relative', background: 'var(--color-surface)', borderRadius: '24px 24px 0 0', boxShadow: 'var(--shadow-sm)', padding: '8px 20px calc(var(--tabbar-h) + 12px)' }}>
        <div style={{ width: 36, height: 4, borderRadius: 2, background: 'var(--color-neutral-700)', margin: '0 auto 2px' }} />
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <Freshness />
        </div>
        <SmsFallback />
        {rows.length === 0 && (
          <div style={{ padding: '18px 0', fontSize: 13, color: 'var(--color-neutral-500)', textAlign: 'center' }}>
            Nobody else here yet. Invite your crew from the Crew tab.
          </div>
        )}
        {rows.map(r => (
          <button
            key={r.member.id}
            onClick={() => !r.member.ghost && store.ui({ findId: r.member.id, screen: 'find' })}
            style={{ width: '100%', border: 0, background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 12, padding: '9px 0', borderBottom: '1px solid var(--color-neutral-900)', textAlign: 'left', opacity: r.member.ghost ? 0.5 : rowOpacity(r.ageS) }}
          >
            <span style={{ opacity: r.member.ghost ? 0.4 : 1 }}>
              <Avatar name={r.member.name} color={r.member.ghost ? '#5a5a62' : r.member.color} acc={r.member.acc} size={30} />
            </span>
            <span style={{ flex: 1, minWidth: 0 }}>
              <span style={{ display: 'block', fontSize: 14, fontWeight: 500 }}>{r.member.name}</span>
              <span style={{ display: 'block', fontSize: 11, color: 'var(--color-neutral-500)' }}>{r.where}</span>
            </span>
            <i aria-hidden className={r.member.ghost ? 'ph ph-ghost' : statusOf(r.member)[0]} style={{ color: 'var(--color-neutral-400)', fontSize: 15 }} />
            <span style={{ width: 34, textAlign: 'right', fontSize: 11, color: 'var(--color-neutral-400)', fontVariantNumeric: 'tabular-nums' }}>{ageLabel(r.ageS)}</span>
          </button>
        ))}
      </div>

      {sel && (
        <div style={{ position: 'absolute', left: 12, right: 12, bottom: 'calc(var(--tabbar-h) + 12px)', zIndex: 4, borderRadius: 20, background: 'var(--color-surface)', boxShadow: 'var(--shadow-lg)', padding: 14, display: 'flex', flexDirection: 'column', gap: 12, animation: 'rise .2s ease-out' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 40, height: 40, borderRadius: 12, background: 'var(--color-accent-900)', boxShadow: '0 0 0 1px var(--color-accent-700)', display: 'grid', placeItems: 'center', fontSize: 20, color: 'var(--color-accent-200)' }}>
              <i aria-hidden className={TYPES[sel.type][1]} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 16, fontWeight: 500 }}>{sel.name}</div>
              <div style={{ fontSize: 11, color: 'var(--color-neutral-500)' }}>{sel.near ? `by ${sel.near}` : TYPES[sel.type][0]}</div>
            </div>
            <button aria-label="Close" onClick={() => store.ui({ areaSel: null })} style={{ width: 30, height: 30, border: 0, cursor: 'pointer', borderRadius: '50%', background: 'transparent', color: 'var(--color-neutral-400)', fontSize: 16 }}>
              <i aria-hidden className="ph ph-x" />
            </button>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--color-neutral-400)' }}>
            {here.map(r => <span key={r.member.id} style={{ width: 9, height: 9, borderRadius: '50%', background: r.member.color, boxShadow: `0 0 6px ${r.member.color}` }} />)}
            <span>{here.length ? `${here.map(r => r.member.name).join(', ')} here` : 'No crew here'}</span>
          </div>
          <button
            className="btn btn-primary btn-block"
            style={{ height: 44 }}
            onClick={() => {
              // Club zones: stand somewhere in it, not all on the same pixel.
              const j = () => 0.5 + (Math.random() - 0.5) * (sel.shape?.kind === 'zone' && !sel.shape.bg ? 0.5 : 0)
              store.checkIn(sel.id, j(), j(), true)
              store.ui({ areaSel: null })
            }}
          >
            <i aria-hidden className="ph-bold ph-map-pin" />
            {meHere ? 'Still here' : 'Pin me here'}
          </button>
        </div>
      )}
    </div>
  )
}

interface MapPenguin {
  key: string
  name: string
  mine: boolean
  x: number
  y: number
  color: string
  acc: number
  activity: Activity
  live: boolean
  glow: number
  signal: number | null
  saver: boolean
  queued: boolean
}

/** Everyone's penguin on the overview map (yours too), sorted back to front. */
function mapPenguins(s: State, v: Venue, rows: CrewRow[], now: number, floor: number): MapPenguin[] {
  const out: MapPenguin[] = []
  for (const r of rows) {
    const pl = r.dot && store.place(r.dot.place_id)
    if (!r.dot || !pl || !r.live || !onFloor(pl, floor)) continue
    const p = mapPos(v, pl, r.dot.nx, r.dot.ny)
    out.push({
      key: r.member.id, name: r.member.name, mine: false, ...p, color: r.member.color, acc: r.member.acc ?? 0,
      activity: activityFor(pl.type, r.member.status, r.fresh), live: r.fresh, glow: fraction(r.dot, now),
      signal: r.member.net ?? null, saver: !!r.member.saver, queued: false,
    })
  }
  const me = store.me()
  const mine = store.myDot()
  const pl = mine && store.place(mine.place_id)
  if (me && mine && pl && pinned(mine, now) && onFloor(pl, floor)) {
    out.push({
      key: me.id, name: me.name, mine: true, ...mapPos(v, pl, mine.nx, mine.ny), color: me.color, acc: me.acc ?? 0,
      activity: activityFor(pl.type, me.status, fresh(mine, now)), live: fresh(mine, now), glow: fraction(mine, now),
      signal: s.myNet, saver: s.dataSaver, queued: !!s.pending[mine.id] || me.ghost,
    })
  }
  return out.sort((a, b) => a.y - b.y)
}

/** The smoking area: the strip outside the building's front, shown from both floors. */
function Lounge({ v, p, inv }: { v: Venue; p: Place; inv: number }) {
  const sh = p.shape as { cx: number; cy: number; w: number; h: number }
  const a = toMap(v, sh.cx - sh.w / 2, sh.cy - sh.h / 2)
  const b = toMap(v, sh.cx + sh.w / 2, sh.cy + sh.h / 2)
  const [w, h] = [b.x - a.x, b.y - a.y]
  const teal = '#3bf0ff'
  return (
    <g style={{ pointerEvents: 'none' }}>
      <rect x={a.x} y={a.y} width={w} height={h} fill="rgba(0,120,120,.28)" stroke={teal} strokeOpacity={0.75} strokeWidth={inv} strokeDasharray={`${4 * inv} ${3 * inv}`} />
      <text x={a.x + w / 2} y={a.y + h / 2 + 3} textAnchor="middle" fontSize={8} fontWeight={500} fill={teal} fillOpacity={0.9} fontFamily="Inter, sans-serif">
        smoking area (outside)
      </text>
    </g>
  )
}
