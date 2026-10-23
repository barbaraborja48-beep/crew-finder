import { store, useStore } from '../lib/store'
import { alive } from '../lib/rules'
import { glow, hasCloseUp, mapPos, outline, toMap, TYPES, MAP_W, MAP_H, ME, type PlaceType } from '../lib/venue'
import { useNow, mySync, crewRows, statusOf, ageLabel } from '../lib/view'
import { rowOpacity } from '../lib/rules'
import { Freshness, ProfileButton, Scaled, SmsFallback, SyncPill } from '../components/common'

export function MapScreen() {
  const s = useStore()
  const now = useNow()
  const v = s.venue
  const sync = mySync(s, now)
  const rows = crewRows(s, now)
  const mine = store.myDot()
  const meLive = alive(mine, now)
  const { ui } = s
  const stages = s.places.filter(p => p.type === 'stage')
  const areas = s.places.filter(p => p.type !== 'stage' && ui.types[p.type])
  const liveFriends = rows.filter(r => r.live && r.dot)
  const seg = (on: boolean) => ({ background: on ? 'var(--color-accent-800)' : 'transparent', color: on ? 'var(--color-accent-100)' : 'var(--color-neutral-400)' })

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
          <div className="title">{v?.event_name || s.crew?.name}</div>
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
        {v && (
          <div
            style={{
              position: 'absolute', inset: 0,
              background: `url(${v.map_url}) ${v.view_ox}px ${v.view_oy}px / ${v.map_w * v.view_scale}px auto no-repeat`,
              filter: 'saturate(.3) brightness(.5)',
            }}
          />
        )}
        {ui.heat === 'crowd' && (
          <div style={{ position: 'absolute', inset: 0, mixBlendMode: 'screen', pointerEvents: 'none' }}>
            {blobs.map(b => (
              <div key={b.id} style={{ position: 'absolute', left: b.x, top: b.y, width: b.s, height: b.s, transform: 'translate(-50%,-50%)', borderRadius: '50%', background: `radial-gradient(${b.c}, transparent 68%)` }} />
            ))}
          </div>
        )}
        {v && (
          // Bars, the food truck row and picnic areas at their real size and angle. Tap for a close-up.
          <svg width={MAP_W} height={MAP_H} style={{ position: 'absolute', inset: 0, overflow: 'visible' }}>
            {areas.filter(a => a.shape).map(a => {
              const here = (meLive && mine!.place_id === a.id) || liveFriends.some(r => r.dot!.place_id === a.id)
              return (
                <polygon
                  key={a.id}
                  points={outline(v, a.shape!).map(p => `${p.x},${p.y}`).join(' ')}
                  onClick={() => store.ui({ stage: a.id, screen: 'stage', areaSel: null })}
                  style={{ cursor: 'pointer', fill: here ? 'color-mix(in srgb, var(--color-accent) 30%, transparent)' : 'color-mix(in srgb, var(--color-accent) 14%, transparent)', stroke: 'color-mix(in srgb, var(--color-accent-300) 70%, transparent)', strokeWidth: 1, strokeDasharray: a.type === 'bar' ? undefined : '3 2' }}
                />
              )
            })}
          </svg>
        )}
        {v && ui.types.stage &&
          stages.map(st => {
            const p = toMap(v, st.x, st.y)
            return (
              <div key={st.id}>
                <button
                  aria-label={st.name}
                  onClick={() => store.ui({ stage: st.id, screen: 'stage' })}
                  style={{ position: 'absolute', left: p.x, top: p.y, transform: 'translate(-50%,-50%)', width: 46, height: 46, border: 0, cursor: 'pointer', borderRadius: '50%', padding: 0, background: 'transparent', boxShadow: 'inset 0 0 0 1px color-mix(in srgb, var(--color-accent-300) 50%, transparent)' }}
                />
                <div style={{ position: 'absolute', left: p.x, top: p.y + 24, transform: 'translateX(-50%)', pointerEvents: 'none', fontSize: 10, fontWeight: 500, whiteSpace: 'nowrap', padding: '2px 7px', borderRadius: 999, background: 'rgba(22,24,38,.85)', color: 'var(--color-neutral-200)', boxShadow: 'var(--shadow-sm)' }}>
                  {st.name}
                </div>
              </div>
            )
          })}
        {v &&
          areas.map(a => {
            const p = toMap(v, a.x, a.y)
            const on = ui.areaSel === a.id
            const mineHere = meLive && mine!.place_id === a.id
            const friendHere = liveFriends.find(r => r.dot!.place_id === a.id)
            const dot = mineHere ? ME : friendHere?.member.color
            return (
              <button
                key={a.id}
                aria-label={a.name}
                onClick={() => (hasCloseUp(a) ? store.ui({ stage: a.id, screen: 'stage', areaSel: null }) : store.ui({ areaSel: on ? null : a.id }))}
                style={{
                  position: 'absolute', left: p.x, top: p.y, transform: 'translate(-50%,-50%)', width: 24, height: 24, border: 0, cursor: 'pointer', borderRadius: '50%', padding: 0, zIndex: 2,
                  background: on ? 'var(--color-accent-800)' : 'var(--color-surface)', color: on ? 'var(--color-accent-100)' : 'var(--color-neutral-200)',
                  boxShadow: dot ? `0 0 0 1.5px ${dot}, 0 0 10px ${dot}` : on ? '0 0 0 1.5px var(--color-accent)' : 'var(--shadow-sm)',
                  display: 'grid', placeItems: 'center', fontSize: 13,
                }}
              >
                <i aria-hidden className={TYPES[a.type][1]} />
              </button>
            )
          })}
        <div className="no-scrollbar" style={{ position: 'absolute', left: 0, right: 0, top: 8, padding: '0 12px', display: 'flex', gap: 5, overflowX: 'auto', zIndex: 3 }}>
          {(Object.entries(TYPES) as [PlaceType, [string, string]][]).map(([k, [label, icon]]) => {
            const on = ui.types[k]
            return (
              <button
                key={k}
                onClick={() => store.ui({ types: { ...ui.types, [k]: !on }, areaSel: null })}
                style={{
                  flex: 'none', height: 26, border: 0, cursor: 'pointer', padding: '0 9px', borderRadius: 999, font: '500 10px var(--font-body)',
                  background: on ? 'var(--color-accent-900)' : 'rgba(22,24,38,.85)', color: on ? 'var(--color-accent-200)' : 'var(--color-neutral-400)',
                  boxShadow: on ? '0 0 0 1px var(--color-accent-600)' : 'var(--shadow-sm)', display: 'flex', alignItems: 'center', gap: 4, backdropFilter: 'blur(8px)',
                }}
              >
                <i aria-hidden className={icon} style={{ fontSize: 12 }} />
                {label}
              </button>
            )
          })}
        </div>
        {ui.heat === 'crew' && v && (
          <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
            {rows.filter(r => r.dot).map(r => {
              const pl = store.place(r.dot!.place_id)
              if (!pl) return null
              const p = mapPos(v, pl, r.dot!.nx, r.dot!.ny)
              return (
                <div key={r.member.id} style={{ position: 'absolute', left: p.x, top: p.y, width: 0, height: 0, opacity: r.live ? 1 : 0.3 }}>
                  <div style={{ position: 'absolute', width: 10, height: 10, borderRadius: '50%', transform: 'translate(-50%,-50%)', background: r.member.color, boxShadow: r.live ? glow(r.member.color, 0.5) : 'none' }} />
                  {!r.live && <div style={{ position: 'absolute', left: 8, top: -7, fontSize: 9, fontWeight: 500, color: 'var(--color-neutral-200)', whiteSpace: 'nowrap' }}>{ageLabel(r.ageS)}</div>}
                </div>
              )
            })}
            {meLive && store.place(mine!.place_id) && (() => {
              const p = mapPos(v, store.place(mine!.place_id)!, mine!.nx, mine!.ny)
              return <div style={{ position: 'absolute', left: p.x, top: p.y, width: 10, height: 10, borderRadius: '50%', transform: 'translate(-50%,-50%)', background: ME, boxShadow: glow(ME, 0.6) }} />
            })()}
          </div>
        )}
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
            <span style={{ width: 11, height: 11, borderRadius: '50%', flex: 'none', background: r.member.ghost ? 'transparent' : r.member.color, boxShadow: r.member.ghost ? 'inset 0 0 0 1.5px var(--color-neutral-600)' : r.live ? glow(r.member.color, 0.3) : 'none' }} />
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
              store.checkIn(sel.id, 0.5, 0.5, true)
              store.ui({ areaSel: null })
            }}
          >
            <i aria-hidden className="ph-bold ph-crosshair" />
            {meHere ? 'I’m still here +1:00' : 'I’m here'}
          </button>
        </div>
      )}
    </div>
  )
}
