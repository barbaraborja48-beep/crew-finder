// Small view-model helpers shared by the screens.
import { useEffect, useState } from 'react'
import { alive, remaining } from './rules'
import { latestDots, store, type Checkin, type Member, type State } from './store'
import { ago, STATUS, where } from './venue'

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
  if (!dot || !alive(dot, now)) return { label: 'Not checked in', icon: 'ph ph-crosshair', fg: 'var(--color-neutral-500)', ring: 'var(--shadow-sm)' }
  const p = s.pending[dot.id]
  if (p === 'sending') return { label: 'Sending…', icon: 'ph ph-arrow-up', fg: '#bff9ff', ring: '0 0 0 1px #3bf0ff' }
  if (p === 'queued')
    return { label: s.signal === 'none' ? 'Queued · no signal' : 'Queued', icon: 'ph ph-clock', fg: 'var(--queued)', ring: '0 0 0 1px #ffc83b88' }
  return { label: 'Sent', icon: 'ph-bold ph-check', fg: 'var(--color-neutral-400)', ring: 'var(--shadow-sm)' }
}

export interface CrewRow {
  member: Member
  dot: Checkin | null
  live: boolean
  rem: number
  ageS: number
  where: string
}

/** Everyone except you, freshest first, ghosts last. */
export function crewRows(s: State, now: number): CrewRow[] {
  const latest = latestDots(s.checkins)
  return s.members
    .filter(m => m.id !== s.session?.memberId)
    .map(m => {
      const dot = m.ghost ? null : (latest.get(m.id) ?? null)
      return {
        member: m,
        dot,
        live: alive(dot, now),
        rem: dot ? remaining(dot, now) : 0,
        ageS: dot ? (now - dot.born) / 1000 : Infinity,
        where: m.ghost ? 'Ghost' : dot ? where(store.place(dot.place_id), dot.nx, dot.ny) : 'No check-in yet',
      }
    })
    .sort((a, b) => Number(a.member.ghost) - Number(b.member.ghost) || a.ageS - b.ageS)
}

export const statusOf = (m: Member) => STATUS[m.status] ?? STATUS[0]
export const ageLabel = (s: number) => (Number.isFinite(s) ? ago(s) : '')
export const isStandalone = () =>
  window.matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true
export const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent)
