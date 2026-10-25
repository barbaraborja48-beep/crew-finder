// Buddies, planned moves and "what's next on my plan": the cards that pop up on the map
// and crew tabs, and the two sheets (plan a move, let someone go).
import { useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { placeTitleShort, store, useStore, type Member } from '../lib/store'
import { pinned } from '../lib/rules'
import { moveCrew, nextOnPlan, planTimeline, type DjSet } from '../lib/social'
import { onFloor, type Place, type PlaceType } from '../lib/venue'
import { buddyInvites, myMoves, useNow } from '../lib/view'
import { Avatar } from './common'

const card = { display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', margin: '4px 0 6px', borderRadius: 14, background: 'color-mix(in srgb, var(--color-accent) 10%, var(--color-surface))', boxShadow: '0 0 0 1px var(--color-accent-700)' } as const
const small = { border: 0, borderRadius: 999, font: '600 12px var(--font-body)', cursor: 'pointer', padding: '6px 12px', flex: 'none' } as const
const yes = { ...small, background: 'var(--color-accent-600)', color: '#fff' }
const no = { ...small, background: 'transparent', color: 'var(--color-neutral-400)', padding: '6px 4px' }

const mmss = (ms: number) => {
  const s = Math.max(0, Math.ceil(ms / 1000))
  return s >= 60 ? `${Math.ceil(s / 60)} min` : `${s} s`
}
const names = (ids: string[], members: Member[], meId: string) =>
  ids.filter(id => id !== meId).map(id => members.find(m => m.id === id)?.name ?? '?').join(', ')

/** Buddy requests, planned moves you're in, and the next set on your plan. */
export function SocialBanners({ plan = true }: { plan?: boolean }) {
  const s = useStore()
  const now = useNow(1000)
  const me = s.session?.memberId ?? ''
  const member = (id: string) => s.members.find(m => m.id === id)
  const invites = buddyInvites(s, now)
  const moves = myMoves(s, now)
  const lineup = (s.venue?.lineup ?? []) as DjSet[]
  const next = plan ? nextOnPlan(planTimeline(s.prefs.plan, lineup), now) : null
  return (
    <>
      {invites.map(inv => {
        const from = member(inv.member_id)
        if (!from) return null
        return (
          <div key={inv.id} style={card}>
            <Avatar name={from.name} color={from.color} acc={from.acc} size={30} />
            <span style={{ flex: 1, fontSize: 12, lineHeight: 1.35 }}>
              <b style={{ fontWeight: 500 }}>{from.name} wants to buddy up</b>
              <span style={{ display: 'block', color: 'var(--color-neutral-400)' }}>You’ll move together on the map</span>
            </span>
            <button style={no} onClick={() => store.declineBuddy(inv)}>Not now</button>
            <button style={yes} onClick={() => store.acceptBuddy(inv)}>Buddy up</button>
          </div>
        )
      })}
      {moves.map(mv => {
        const due = now >= mv.due
        const mine = mv.from === me
        const out = mv.declined.includes(me)
        if (out) return null
        const spot = placeTitleShort(store.place(mv.placeId))
        const others = names(moveCrew(mv), s.members, me) || 'nobody now'
        const rest = names(moveCrew(mv).filter(id => id !== mv.from), s.members, me) // invited, besides you
        const here = pinned(store.myShownDot(), now) && store.myShownDot()!.place_id === mv.placeId && store.myShownDot()!.born >= mv.due - 60_000
        if (due && here) return null
        return (
          <div key={mv.id} style={{ ...card, background: due ? 'color-mix(in srgb, #3bf0ff 12%, var(--color-surface))' : card.background, boxShadow: due ? '0 0 0 1px #3bf0ff88' : card.boxShadow }}>
            <i aria-hidden className={due ? 'ph-bold ph-map-pin-area' : 'ph-bold ph-path'} style={{ fontSize: 20, color: due ? '#3bf0ff' : 'var(--color-accent-200)' }} />
            <span style={{ flex: 1, fontSize: 12, lineHeight: 1.35, minWidth: 0 }}>
              <b style={{ fontWeight: 500 }}>{due ? `Meet ${others} at ${spot}` : `${spot} in ${mmss(mv.due - now)}`}</b>
              <span style={{ display: 'block', color: 'var(--color-neutral-400)' }}>
                {due ? 'Your penguins are waiting there. Confirm when you arrive.' : mine ? `With ${others}` : `${member(mv.from)?.name} planned it${rest ? ` · with you and ${rest}` : ''}`}
              </span>
            </span>
            {due ? (
              <>
                <button style={no} onClick={() => (mine ? store.cancelMove(mv) : store.declineMove(mv))}>Not going</button>
                <button style={yes} onClick={() => store.confirmMove(mv)}>I’m here</button>
              </>
            ) : (
              <button style={no} onClick={() => (mine ? store.cancelMove(mv) : store.declineMove(mv))}>{mine ? 'Cancel' : 'Can’t make it'}</button>
            )}
          </div>
        )
      })}
      {next && (
        <button onClick={() => store.ui({ screen: 'stage', stage: next.set.stage ?? s.ui.stage })} style={{ ...card, width: '100%', border: 0, cursor: 'pointer', textAlign: 'left', color: 'var(--color-text)', background: 'transparent', boxShadow: 'var(--shadow-sm)' }}>
          <i aria-hidden className="ph-fill ph-star" style={{ fontSize: 18, color: '#ffc83b' }} />
          <span style={{ flex: 1, fontSize: 12, lineHeight: 1.35 }}>
            <b style={{ fontWeight: 500 }}>
              {next.from <= now ? 'On now' : 'Next'}: {next.set.name}
            </b>
            <span style={{ display: 'block', color: 'var(--color-neutral-400)' }}>
              {store.place(next.set.stage)?.name ?? ''} · {next.from <= now ? `until ${clock(next.to)}` : `in ${mmss(next.from - now)} · ${clock(next.from)}`}
            </span>
          </span>
          <i aria-hidden className="ph ph-caret-right" style={{ color: 'var(--color-neutral-500)' }} />
        </button>
      )}
    </>
  )
}

const clock = (t: number) => new Intl.DateTimeFormat('es-ES', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Madrid' }).format(new Date(t))

/** A bottom sheet over everything (tab bar included). */
export function Sheet({ onClose, children }: { onClose: () => void; children: ReactNode }) {
  return createPortal(
    <>
      <div onClick={onClose} style={{ position: 'absolute', inset: 0, zIndex: 12, background: 'rgba(0,0,0,.66)' }} />
      <div className="scroll no-scrollbar" style={{ position: 'absolute', left: 0, right: 0, bottom: 0, maxHeight: '88%', zIndex: 13, background: 'var(--color-surface)', borderRadius: '26px 26px 0 0', boxShadow: 'var(--shadow-lg)', padding: '10px 20px calc(var(--safe-bottom) + 20px)', display: 'flex', flexDirection: 'column', gap: 14, animation: 'sheet .22s ease-out' }}>
        <div style={{ width: 36, height: 4, borderRadius: 2, background: 'var(--color-neutral-700)', margin: '0 auto', flex: 'none' }} />
        {children}
      </div>
    </>,
    document.querySelector('.app') ?? document.body,
  )
}

const chip = (on: boolean) =>
  ({
    flex: 'none', height: 32, border: 0, cursor: 'pointer', padding: '0 12px', borderRadius: 999, font: '500 12px var(--font-body)',
    background: on ? 'var(--color-accent-900)' : 'transparent', color: on ? 'var(--color-accent-100)' : 'var(--color-neutral-300)',
    boxShadow: on ? '0 0 0 1px var(--color-accent)' : 'var(--shadow-sm)', display: 'flex', alignItems: 'center', gap: 6,
  }) as const
const label = { fontSize: 11, color: 'var(--color-neutral-500)', letterSpacing: '.04em' } as const

// Quick picks: the nearest one of each to where you are.
const QUICK: [PlaceType, string, string][] = [
  ['wc', 'WC', 'ph ph-toilet'],
  ['bar', 'Bar', 'ph ph-martini'],
  ['outside', 'Smoking', 'ph ph-cigarette'],
  ['food', 'Food', 'ph ph-fork-knife'],
]

function nearest(places: Place[], type: PlaceType, from: Place | undefined) {
  const fx = from?.x ?? 600
  const fy = from?.y ?? 600
  const floor = from?.floor ?? 1
  return places
    .filter(p => p.type === type && !(p.shape?.kind === 'zone' && p.shape.bg))
    .sort((a, b) => Number(!onFloor(a, floor)) - Number(!onFloor(b, floor)) || (a.x - fx) ** 2 + (a.y - fy) ** 2 - ((b.x - fx) ** 2 + (b.y - fy) ** 2))[0]
}

/** Pick a spot: quick chips for the nearest WC / bar / smoking area, the meet spot, or any place. */
function SpotPicker({ value, onChange }: { value: string | null; onChange: (id: string) => void }) {
  const s = useStore()
  const mine = store.myShownDot()
  const from = store.place(mine?.place_id)
  const meet = store.place(s.crew?.meet_spot_place_id)
  const quick = QUICK.flatMap(([t, l, icon]) => {
    const p = nearest(s.places, t, from)
    return p ? [{ p, l, icon }] : []
  })
  return (
    <>
      <div className="no-scrollbar" style={{ display: 'flex', gap: 6, overflowX: 'auto', flex: 'none' }}>
        {meet && (
          <button style={chip(value === meet.id)} onClick={() => onChange(meet.id)}>
            <i aria-hidden className="ph-fill ph-flag" /> Meet spot
          </button>
        )}
        {quick.map(q => (
          <button key={q.p.id} style={chip(value === q.p.id)} onClick={() => onChange(q.p.id)}>
            <i aria-hidden className={q.icon} /> {q.l}
          </button>
        ))}
      </div>
      <select className="input" value={value ?? ''} onChange={e => onChange(e.target.value)}>
        <option value="" disabled>
          Or pick any spot…
        </option>
        {s.places
          .filter(p => !(p.shape?.kind === 'zone' && p.shape.bg))
          .map(p => (
            <option key={p.id} value={p.id}>
              {placeTitleShort(p)}
              {p.floor ? ` · Planta ${p.floor}` : ''}
            </option>
          ))}
      </select>
    </>
  )
}

const WHEN = [0, 5, 10, 15, 20, 30]

/** "Going to the WC in 10 min": pick who, where and when. */
export function PlanMoveSheet({ preset, onClose }: { preset?: string; onClose: () => void }) {
  const s = useStore()
  const me = s.session?.memberId
  const friends = s.members.filter(m => m.id !== me && !m.ghost)
  const [withIds, setWith] = useState<string[]>(preset ? [preset] : [])
  const [spot, setSpot] = useState<string | null>(null)
  const [mins, setMins] = useState(10)
  const p = store.place(spot)
  const ok = !!p && withIds.length > 0
  return (
    <Sheet onClose={onClose}>
      <div style={{ fontSize: 20, fontWeight: 500, letterSpacing: '-.02em' }}>Plan a move</div>
      <div style={label}>WITH</div>
      <div className="no-scrollbar" style={{ display: 'flex', gap: 6, overflowX: 'auto', flex: 'none' }}>
        {friends.map(f => {
          const on = withIds.includes(f.id)
          return (
            <button key={f.id} style={chip(on)} onClick={() => setWith(on ? withIds.filter(x => x !== f.id) : [...withIds, f.id])}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: f.color, boxShadow: `0 0 5px ${f.color}` }} />
              {f.name}
            </button>
          )
        })}
      </div>
      <div style={label}>WHERE</div>
      <SpotPicker value={spot} onChange={setSpot} />
      <div style={label}>WHEN</div>
      <div className="no-scrollbar" style={{ display: 'flex', gap: 6, overflowX: 'auto', flex: 'none' }}>
        {WHEN.map(m => (
          <button key={m} style={chip(mins === m)} onClick={() => setMins(m)}>
            {m ? `${m} min` : 'Now'}
          </button>
        ))}
      </div>
      <div style={{ fontSize: 12, color: 'var(--color-neutral-400)', lineHeight: 1.4 }}>
        {ok
          ? `${names(withIds, s.members, me ?? '')} get${withIds.length > 1 ? '' : 's'} “${mins ? `${placeTitleShort(p)} in ${mins} min` : `Meet at ${placeTitleShort(p)} now`}”. ${mins ? 'When it’s time, everyone gets a reminder and your' : 'Your'} penguins wait there until each of you confirms.`
          : 'Pick who and where.'}
      </div>
      <button
        className="btn btn-primary btn-block"
        style={{ height: 46, flex: 'none' }}
        disabled={!ok}
        onClick={() => {
          store.planMove(spot!, withIds, mins)
          onClose()
        }}
      >
        <i aria-hidden className="ph-bold ph-paper-plane-tilt" />
        Send
      </button>
    </Sheet>
  )
}

/** A buddy wandered off: let them go, and say where you think they went (or not). */
export function LetGoSheet({ member, onClose }: { member: Member; onClose: () => void }) {
  const [spot, setSpot] = useState<string | null>(null)
  return (
    <Sheet onClose={onClose}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <Avatar name={member.name} color={member.color} acc={member.acc} size={40} />
        <div style={{ fontSize: 20, fontWeight: 500, letterSpacing: '-.02em' }}>Let {member.name} go?</div>
      </div>
      <div style={{ fontSize: 12, color: 'var(--color-neutral-400)', lineHeight: 1.4 }}>
        {member.name} stops moving with your group. If you have a guess where {member.name} went, the crew sees a faded penguin there until {member.name} pins again.
      </div>
      <div style={label}>PROBABLY WENT TO</div>
      <SpotPicker value={spot} onChange={setSpot} />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, flex: 'none' }}>
        <button
          className="btn btn-secondary"
          style={{ height: 46 }}
          onClick={() => {
            store.letGo(member, null)
            onClose()
          }}
        >
          No idea
        </button>
        <button
          className="btn btn-primary"
          style={{ height: 46 }}
          disabled={!spot}
          onClick={() => {
            store.letGo(member, spot)
            onClose()
          }}
        >
          Let go
        </button>
      </div>
    </Sheet>
  )
}
