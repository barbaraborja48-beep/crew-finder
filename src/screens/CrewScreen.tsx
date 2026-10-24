import { useState } from 'react'
import { store, useStore } from '../lib/store'
import { glow, where } from '../lib/venue'
import { rowOpacity } from '../lib/rules'
import { useNow, crewRows, statusOf, ageLabel, isStandalone, isIOS } from '../lib/view'
import { Avatar, Toggle } from '../components/common'

export function CrewScreen() {
  const s = useStore()
  const now = useNow(5000)
  const rows = crewRows(s, now)
  const me = store.me()
  const [editMeet, setEditMeet] = useState(false)
  const meet = store.place(s.crew?.meet_spot_place_id)
  const link = `${location.origin}/?crew=${s.crew?.invite_code ?? ''}`

  const share = async () => {
    const text = `Join our crew on Crew Finder: ${link}`
    try {
      if (navigator.share) return await navigator.share({ title: 'Crew Finder', text, url: link })
      await navigator.clipboard.writeText(link)
      store.toast('Invite link copied')
    } catch {
      /* share sheet dismissed */
    }
  }

  return (
    <div className="screen scroll no-scrollbar" style={{ padding: 'var(--hdr-top) 20px calc(var(--tabbar-h) + 20px)', gap: 14 }}>
      <div className="title">Crew</div>

      {isIOS() && !isStandalone() && (
        <div style={{ borderRadius: 'var(--radius-lg)', boxShadow: '0 0 0 1px #ffc83b88', padding: '12px 14px', fontSize: 12, color: 'var(--queued)', display: 'flex', gap: 10 }}>
          <i aria-hidden className="ph ph-export" style={{ fontSize: 18 }} />
          <span>Add this to your Home Screen: tap Share, then “Add to Home Screen”. Open it from there and join again with the same name.</span>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {rows.map(r => (
          <button
            key={r.member.id}
            onClick={() => !r.member.ghost && store.ui({ findId: r.member.id, screen: 'find' })}
            style={{ border: 0, cursor: 'pointer', borderRadius: 'var(--radius-lg)', background: 'var(--color-surface)', boxShadow: 'var(--shadow-sm)', padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 12, textAlign: 'left', opacity: r.member.ghost ? 0.5 : rowOpacity(r.ageS) }}
          >
            <span style={{ opacity: r.member.ghost ? 0.4 : 1 }}>
              <Avatar name={r.member.name} color={r.member.ghost ? '#5a5a62' : r.member.color} acc={r.member.acc} size={38} />
            </span>
            <span style={{ flex: 1, minWidth: 0 }}>
              <span style={{ display: 'block', fontSize: 15, fontWeight: 500 }}>{r.member.name}</span>
              <span style={{ display: 'block', fontSize: 12, color: 'var(--color-neutral-500)' }}>{r.where}</span>
              {!r.member.ghost && (
                <span style={{ display: 'block', fontSize: 11, color: 'var(--color-neutral-400)', marginTop: 2 }}>{r.member.note ? `“${r.member.note}”` : statusOf(r.member)[1]}</span>
              )}
            </span>
            <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
              <span style={{ fontSize: 12, color: 'var(--color-neutral-300)', fontVariantNumeric: 'tabular-nums' }}>{r.member.ghost ? '' : ageLabel(r.ageS)}</span>
              {r.member.battery != null && !r.member.ghost && (
                <span style={{ fontSize: 10, color: 'var(--color-neutral-500)', display: 'flex', alignItems: 'center', gap: 3 }}>
                  <i aria-hidden className={r.member.battery < 20 ? 'ph ph-battery-low' : 'ph ph-battery-medium'} />
                  {r.member.battery}%
                </span>
              )}
            </span>
          </button>
        ))}
        {rows.length === 0 && <div style={{ fontSize: 13, color: 'var(--color-neutral-500)' }}>Just you so far. Send the invite link below.</div>}
      </div>

      <div style={{ borderRadius: 'var(--radius-lg)', boxShadow: '0 0 0 1px var(--color-accent-700)', background: 'var(--color-accent-900)', padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        <button onClick={() => (editMeet ? setEditMeet(false) : store.openPlace(meet?.id ?? null))} style={{ border: 0, background: 'transparent', padding: 0, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 12, textAlign: 'left' }}>
          <i aria-hidden className="ph-fill ph-flag" style={{ fontSize: 18, color: 'var(--color-accent-200)' }} />
          <span style={{ flex: 1 }}>
            <span style={{ display: 'block', fontSize: 13, fontWeight: 500 }}>Meet spot</span>
            <span style={{ display: 'block', fontSize: 11, color: 'var(--color-accent-300)' }}>
              {meet ? where(meet) : 'Not set'}
              {s.crew?.meet_spot_note ? ` · ${s.crew.meet_spot_note}` : ''}
            </span>
          </span>
          <span
            role="button"
            onClick={e => {
              e.stopPropagation()
              setEditMeet(!editMeet)
            }}
            style={{ fontSize: 12, color: 'var(--color-accent-300)', padding: 6 }}
          >
            {editMeet ? 'Done' : 'Change'}
          </span>
        </button>
        {editMeet && s.crew && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <select className="input" value={s.crew.meet_spot_place_id ?? ''} onChange={e => store.setMeetSpot(e.target.value, s.crew!.meet_spot_note)}>
              {s.places.map(p => (
                <option key={p.id} value={p.id}>
                  {where(p)}
                </option>
              ))}
            </select>
            <input className="input" maxLength={40} defaultValue={s.crew.meet_spot_note} placeholder="When? e.g. on the hour" onBlur={e => store.setMeetSpot(s.crew!.meet_spot_place_id ?? 'picnic', e.target.value)} />
          </div>
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '4px 2px' }}>
        <i aria-hidden className="ph ph-ghost" style={{ fontSize: 18, color: 'var(--color-neutral-300)' }} />
        <span style={{ flex: 1, fontSize: 14 }}>
          Ghost mode
          <span style={{ display: 'block', fontSize: 11, color: 'var(--color-neutral-500)' }}>Your check-ins stay on your phone</span>
        </span>
        <Toggle on={!!me?.ghost} onChange={v => store.setGhost(v)} label="Ghost mode" />
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <button className="btn btn-primary" style={{ height: 44 }} onClick={share}>
          <i aria-hidden className="ph ph-user-plus" />
          Invite friends
        </button>
        <button className="btn btn-secondary" style={{ height: 44 }} onClick={() => store.ui({ screen: 'shortcut' })}>
          <i aria-hidden className="ph ph-lightning" />
          One-tap check-in for iPhone
        </button>
      </div>

      <div style={{ fontSize: 11, color: 'var(--color-neutral-600)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span>
          You’re {me?.name} · code {s.crew?.invite_code}
        </span>
        <button
          className="btn btn-ghost"
          style={{ fontSize: 11, color: 'var(--color-neutral-500)' }}
          onClick={() => confirm('Leave this crew on this phone? Rejoin anytime with the same name.') && store.leave()}
        >
          Leave
        </button>
      </div>
    </div>
  )
}

export function FindScreen() {
  const s = useStore()
  const now = useNow()
  const r = crewRows(s, now).find(x => x.member.id === s.ui.findId)
  const v = s.venue
  if (!r || !v) return null
  const pl = r.dot ? store.place(r.dot.place_id) : undefined
  const isArea = pl && pl.type !== 'stage'
  // Same map framing as the overview, shifted 14 px for the narrower 362 px card.
  const p = pl && r.dot ? { x: pl.x * v.view_scale + v.view_ox - 14 + (r.dot.nx - 0.5) * (isArea ? 15 : 30), y: pl.y * v.view_scale + v.view_oy + (r.dot.ny - 0.5) * (isArea ? 12 : 24) } : null
  const c = r.member.color
  const age = ageLabel(r.ageS)

  return (
    <div className="screen scroll no-scrollbar" style={{ alignItems: 'center' }}>
      <div style={{ alignSelf: 'stretch', padding: 'var(--hdr-top) 20px 8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <button className="round" aria-label="Close" onClick={() => store.ui({ screen: 'crew' })}>
          <i aria-hidden className="ph ph-x" />
        </button>
        <span style={{ fontSize: 15, fontWeight: 500, display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ width: 10, height: 10, borderRadius: '50%', background: c, boxShadow: `0 0 8px ${c}` }} />
          {r.member.name}
        </span>
        <span style={{ width: 36 }} />
      </div>
      <div style={{ fontSize: 11, color: 'var(--color-neutral-400)', display: 'flex', alignItems: 'center', gap: 5 }}>
        <i aria-hidden className="ph ph-clock-counter-clockwise" />
        Last check-in
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'stretch', width: 'min(362px, calc(100% - 28px))' }}>
        <div style={{ marginTop: 22, height: 300, borderRadius: 'var(--radius-lg)', position: 'relative', overflow: 'hidden', boxShadow: 'var(--shadow-sm)', background: `url(${v.map_url}) ${v.view_ox - 14}px ${v.view_oy}px / ${v.map_w * v.view_scale}px auto no-repeat` }}>
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,.55)' }} />
          {p && (
            <>
              <div style={{ position: 'absolute', left: p.x, top: p.y, width: 14, height: 14, transform: 'translate(-50%,-50%)', borderRadius: '50%', background: c, opacity: r.live ? 1 : 0.45, boxShadow: glow(c, 0.5) }} />
              <div style={{ position: 'absolute', left: p.x, top: p.y, width: 14, height: 14, borderRadius: '50%', border: `1.5px solid ${c}`, animation: 'ping 2s ease-out infinite' }} />
            </>
          )}
        </div>
        <div style={{ marginTop: 22, fontSize: 26, fontWeight: 500, letterSpacing: '-.02em' }}>{r.where}</div>
        <div style={{ marginTop: 4, fontSize: 13, color: 'var(--color-neutral-400)' }}>
          {r.dot ? (age === 'now' ? 'Just now' : `${age} ago`) : 'Hasn’t checked in'} · {statusOf(r.member)[1]}
          {r.member.battery != null ? ` · ${r.member.battery}% battery` : ''}
          {r.member.note ? ` · “${r.member.note}”` : ''}
        </div>
      </div>

      <div style={{ marginTop: 'auto', alignSelf: 'stretch', padding: '24px 20px calc(var(--safe-bottom) + 24px)', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <button className="btn btn-secondary" style={{ height: 46 }} disabled={!pl} onClick={() => pl && store.openPlace(pl.id)}>
          <i aria-hidden className="ph ph-map-pin" />
          {isArea ? 'Show on map' : 'Go to stage'}
        </button>
        <button className="btn btn-primary" style={{ height: 46 }} onClick={() => store.ping(r.member)}>
          <i aria-hidden className="ph ph-hand-waving" />
          Ping
        </button>
      </div>
    </div>
  )
}
