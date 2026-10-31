// Small view-model helpers shared by the screens.
import { useEffect, useState } from 'react'
import { fresh, pinned } from './rules'
import { latestDots, placeTitleShort, store, type Checkin, type Member, type Message, type State } from './store'
import { ago, FABRIK_ID, FABRIK_LOGOS, HALLOWEEN_ID, STAGE_LOGOS, STATUS, TYPES, where } from './venue'
import type { Badge } from '../components/common'
import { activeMoves, groupOf, moveCrew, pendingInvites, shownDots, suggestions, type Move, type Suggestion } from './social'

export function useNow(ms = 500) {
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), ms)
    return () => clearInterval(t)
  }, [ms])
  return now
}

export interface SyncDef {
  label: string
  icon: string
  fg: string
  ring: string
}

/** Status of your own check-in, for the sync pill. */
export function mySync(s: State, now: number): SyncDef {
  const me = store.me()
  const dot = store.myDot()
  if (me?.ghost) return { label: 'Ghost', icon: 'ph ph-ghost', fg: 'var(--color-neutral-400)', ring: 'var(--shadow-sm)' }
  if (!dot || !pinned(dot, now)) {
    // Not pinned yourself, but your buddies are: you're shown with them.
    const buddies = store.buddies()
    if (buddies.length && pinned(store.myShownDot(), now)) return { label: `With ${buddies.map(b => b.name).join(', ')}`, icon: 'ph ph-users-three', fg: 'var(--color-neutral-400)', ring: 'var(--shadow-sm)' }
    return { label: 'Not pinned', icon: 'ph ph-map-pin', fg: 'var(--color-neutral-500)', ring: 'var(--shadow-sm)' }
  }
  const p = s.pending[dot.id]
  if (p === 'sending') return { label: 'Sending…', icon: 'ph ph-arrow-up', fg: '#bff9ff', ring: '0 0 0 1px #3bf0ff' }
  if (p === 'queued')
    return { label: s.signal === 'none' ? 'Queued · no signal' : 'Queued', icon: 'ph ph-clock', fg: 'var(--queued)', ring: '0 0 0 1px #ffc83b88' }
  return { label: 'Sent', icon: 'ph-bold ph-check', fg: 'var(--color-neutral-400)', ring: 'var(--shadow-sm)' }
}

export interface CrewRow {
  member: Member
  dot: Checkin | null
  live: boolean // has a pin to show (last 12 h)
  fresh: boolean // pinned in the last 15 min: active, not idle
  ageS: number
  where: string
  huddle: { i: number; n: number } // buddies on one pin stand side by side
  hint: string | null // "Heading to WC" (a planned move that's due) or "Probably at WC" (a friend's guess)
  buddies: string[] // their buddy group (them included), if they're in one
  muted: boolean
}

/** Everyone except you, freshest first, ghosts last. */
export function crewRows(s: State, now: number): CrewRow[] {
  const shown = shownDots(latestDots(s.checkins), s.members)
  const hints = new Map(suggested(s, now).map(sg => [sg.memberId, `${sg.kind === 'move' ? 'Heading to' : 'Probably at'} ${placeTitleShort(store.place(sg.placeId))}`]))
  return s.members
    .filter(m => m.id !== s.session?.memberId)
    .map(m => {
      const sh = m.ghost ? undefined : shown.get(m.id)
      const dot = sh?.dot ?? null
      const group = groupOf(s.members, m.id)
      return {
        member: m,
        dot,
        huddle: { i: sh?.i ?? 0, n: sh?.n ?? 1 },
        buddies: group.length > 1 ? group : [],
        muted: s.prefs.mutes.includes(m.id),
        hint: m.ghost ? null : (hints.get(m.id) ?? null),
        live: pinned(dot, now),
        fresh: fresh(dot, now),
        ageS: dot ? (now - dot.born) / 1000 : Infinity,
        where: m.ghost ? 'Ghost' : dot ? where(store.place(dot.place_id), dot.nx, dot.ny) : 'Not pinned yet',
      }
    })
    .sort((a, b) => Number(a.member.ghost) - Number(b.member.ghost) || a.ageS - b.ageS)
}

/** Your own spot in your buddy huddle. */
export function myHuddle(s: State) {
  const sh = shownDots(latestDots(s.checkins), s.members).get(s.session?.memberId ?? '')
  return { i: sh?.i ?? 0, n: sh?.n ?? 1 }
}

/** Faded penguins: planned moves that are due, and guesses about where someone went. */
export function suggested(s: State, now: number): Suggestion[] {
  return suggestions(Object.values(s.messages), shownDots(latestDots(s.checkins), s.members), now)
}

/** Planned moves you're part of. */
export function myMoves(s: State, now: number): Move[] {
  const me = s.session?.memberId ?? ''
  return activeMoves(Object.values(s.messages), now).filter(mv => moveCrew(mv).includes(me) || mv.from === me)
}

export function buddyInvites(s: State, now: number) {
  return pendingInvites(Object.values(s.messages), s.members, s.session?.memberId ?? '', s.answered, now) as Message[]
}

export const statusOf = (m: Member) => STATUS[m.status] ?? STATUS[0]

/** The symbol on someone's profile circle: their spot (a stage's logo at Halloween and Hallowfest) or their status. */
export function badgeFor(s: State, m: Member, dot: Checkin | null): Badge | null {
  if (m.ghost) return { label: 'Ghost', icon: 'ph-fill ph-ghost' }
  if (s.badgeMode === 'status') {
    const [icon, label] = statusOf(m)
    return { icon, label }
  }
  const p = dot && pinned(dot, Date.now()) ? store.place(dot.place_id) : undefined
  if (!p) return null
  const logo = s.venue?.id === HALLOWEEN_ID ? STAGE_LOGOS[p.id] : s.venue?.id === FABRIK_ID ? FABRIK_LOGOS[p.id] : undefined
  return logo ? { logo, label: p.name } : { icon: TYPES[p.type][1], label: p.name }
}
export const ageLabel = (s: number) => (Number.isFinite(s) ? ago(s) : '')
export const isStandalone = () =>
  window.matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true
export const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent)
