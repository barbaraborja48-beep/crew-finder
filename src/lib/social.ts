// Buddies, planned moves, guesses and set plans. All pure, so every phone works them
// out the same way from the same rows, with or without signal.
import type { Dot } from './rules'

interface MemberLike {
  id: string
  buddy?: string | null
  ghost: boolean
}

interface MessageLike {
  id: string
  member_id: string
  type: string
  text: string
  place_id: string | null
  nx: number | null
  ny: number | null
  born: number
  to_member?: string | null
  meta?: MsgMeta | null
}

/** Extra details on buddy / move / guess messages. */
export interface MsgMeta {
  in?: number // move: minutes from when it was sent
  with?: string[] // move: who's invited
  cancel?: string // move: the planner called it off
  decline?: string // move: "can't make it"
  letgo?: boolean // guess: also lets them out of the group
}

// ─── buddies ──────────────────────────────────────────────────────────────

/** Everyone in this person's buddy group (themselves included), ghosts left out. Just them if solo. */
export function groupOf(members: MemberLike[], id: string): string[] {
  const m = members.find(x => x.id === id)
  if (!m?.buddy || m.ghost) return [id]
  const ids = members.filter(x => x.buddy === m.buddy && !x.ghost).map(x => x.id)
  return ids.length > 1 ? ids.sort() : [id]
}

export interface Shown<D extends Dot> {
  dot: D
  /** Where this penguin stands in a huddle of buddies on the same pin (0-based, of n). */
  i: number
  n: number
}

/**
 * Where to show each person: a buddy group moves together, so everyone in it is shown
 * at the group's newest pin. Anyone in the group pinning moves them all.
 */
export function shownDots<D extends Dot>(latest: Map<string, D>, members: MemberLike[]): Map<string, Shown<D>> {
  const out = new Map<string, Shown<D>>()
  for (const m of members) {
    const group = groupOf(members, m.id)
    let best: D | undefined
    for (const g of group) {
      const d = latest.get(g)
      if (d && (!best || d.born > best.born)) best = d
    }
    if (best) out.set(m.id, { dot: best, i: group.indexOf(m.id), n: group.length })
  }
  return out
}

/** Huddle offset, -1…1: buddies on one pin stand side by side. */
export const huddleOffset = (i: number, n: number) => (n < 2 ? 0 : (i - (n - 1) / 2) / Math.max(1, (n - 1) / 2))

const INVITE_MS = 2 * 3600_000

/** Buddy requests waiting for you: newest per person, not answered, not already together. */
export function pendingInvites(messages: MessageLike[], members: MemberLike[], meId: string, answered: Record<string, true>, now: number) {
  const mine = new Set(groupOf(members, meId))
  const byFrom = new Map<string, MessageLike>()
  for (const m of messages) {
    if (m.type !== 'buddy' || m.to_member !== meId || answered[m.id] || now - m.born > INVITE_MS) continue
    if (mine.has(m.member_id) && mine.size > 1) continue
    const cur = byFrom.get(m.member_id)
    if (!cur || m.born > cur.born) byFrom.set(m.member_id, m)
  }
  return [...byFrom.values()].sort((a, b) => b.born - a.born)
}

// ─── planned moves ────────────────────────────────────────────────────────

export interface Move {
  id: string
  from: string // who planned it
  with: string[] // who's invited
  declined: string[]
  placeId: string
  nx: number
  ny: number
  due: number
  text: string
}

/** A planned move stays on the map this long after it's due, then it's old news. */
export const MOVE_KEEP_MS = 30 * 60_000

/** Planned moves that aren't cancelled or over. */
export function activeMoves(messages: MessageLike[], now: number): Move[] {
  const cancelled = new Set<string>()
  const declined = new Map<string, string[]>()
  for (const m of messages) {
    if (m.type !== 'move' || !m.meta) continue
    if (m.meta.cancel) cancelled.add(m.meta.cancel)
    if (m.meta.decline) declined.set(m.meta.decline, [...(declined.get(m.meta.decline) ?? []), m.member_id])
  }
  return messages
    .filter(m => m.type === 'move' && m.meta && m.meta.in != null && m.place_id && !cancelled.has(m.id))
    .map(m => ({
      id: m.id,
      from: m.member_id,
      with: m.meta!.with ?? [],
      declined: declined.get(m.id) ?? [],
      placeId: m.place_id!,
      nx: m.nx ?? 0.5,
      ny: m.ny ?? 0.5,
      due: m.born + (m.meta!.in ?? 0) * 60_000,
      text: m.text,
    }))
    .filter(mv => now < mv.due + MOVE_KEEP_MS)
    .sort((a, b) => a.due - b.due)
}

/** Who's still in a move: the planner plus everyone invited who didn't say no. */
export const moveCrew = (mv: Move) => [mv.from, ...mv.with].filter(id => !mv.declined.includes(id))

export interface Suggestion {
  memberId: string
  placeId: string
  nx: number
  ny: number
  kind: 'move' | 'guess'
  ref: string // the move or guess message
  t: number
}

const GUESS_KEEP_MS = 2 * 3600_000

/**
 * Penguins drawn faded where someone is probably heading: everyone in a move that's due
 * (until they pin again), and anyone a friend guessed about after they wandered off.
 */
export function suggestions<D extends Dot>(messages: MessageLike[], shown: Map<string, Shown<D>>, now: number): Suggestion[] {
  const out = new Map<string, Suggestion>()
  const pinnedSince = (id: string, t: number) => (shown.get(id)?.dot.born ?? 0) >= t
  for (const mv of activeMoves(messages, now)) {
    if (now < mv.due) continue
    for (const id of moveCrew(mv)) {
      if (pinnedSince(id, mv.due - 60_000)) continue // confirmed, or went somewhere else
      out.set(id, { memberId: id, placeId: mv.placeId, nx: mv.nx, ny: mv.ny, kind: 'move', ref: mv.id, t: mv.due })
    }
  }
  for (const g of messages) {
    if (g.type !== 'guess' || !g.place_id || !g.to_member || now - g.born > GUESS_KEEP_MS) continue
    if (pinnedSince(g.to_member, g.born)) continue
    const cur = out.get(g.to_member)
    if (cur && cur.t > g.born) continue
    out.set(g.to_member, { memberId: g.to_member, placeId: g.place_id, nx: g.nx ?? 0.5, ny: g.ny ?? 0.5, kind: 'guess', ref: g.id, t: g.born })
  }
  return [...out.values()]
}

// ─── set plans ────────────────────────────────────────────────────────────

export interface DjSet {
  name: string
  start: string // ISO with offset
  end: string
  stage?: string // festival lineups: which stage
}

/** One pick: k = "stage|start", r = reminder minutes before (null = none), f = switch time for a clash. */
export interface PlanItem {
  k: string
  r: number | null
  f?: string
}

export const setKey = (s: DjSet) => `${s.stage ?? ''}|${s.start}`
export const REMINDER_OPTIONS = [null, 0, 5, 10, 15, 30] as const
export const reminderLabel = (r: number | null) => (r == null ? 'Off' : r === 0 ? 'At start' : `${r} min before`)

const ms = (iso: string) => new Date(iso).getTime()

export interface PlanRow {
  item: PlanItem
  set: DjSet
  from: number // when you'll be there
  to: number // when you leave (the next pick's switch time, if they clash)
  clash: DjSet | null // the next pick overlaps this one
}

/** Your night in order, with clashes worked out. Picks whose set no longer exists drop out. */
export function planTimeline(plan: PlanItem[], lineup: DjSet[]): PlanRow[] {
  const sets = new Map(lineup.map(s => [setKey(s), s]))
  const rows = plan
    .flatMap(item => {
      const set = sets.get(item.k)
      return set ? [{ item, set, from: item.f ? ms(item.f) : ms(set.start), to: ms(set.end), clash: null as DjSet | null }] : []
    })
    .sort((a, b) => ms(a.set.start) - ms(b.set.start) || a.from - b.from)
  for (let i = 0; i < rows.length - 1; i++) {
    const [a, b] = [rows[i], rows[i + 1]]
    if (ms(b.set.start) < ms(a.set.end)) {
      a.clash = b.set
      if (!b.item.f) b.from = defaultSwitch(a.set, b.set)
      a.to = Math.min(a.to, b.from)
    }
  }
  return rows
}

const Q = 15 * 60_000
/** When you could switch from one set to a clashing one: every 15 min while both are on (never 0 min of the first). */
export function switchTimes(a: DjSet, b: DjSet): number[] {
  const end = Math.min(ms(a.end), ms(b.end))
  const out: number[] = []
  for (let t = Math.max(ms(b.start), ms(a.start) + Q); t < end; t += Q) out.push(t)
  return out
}

/** No switch picked yet: go when the second set starts, or halfway if they start together. */
export function defaultSwitch(a: DjSet, b: DjSet) {
  if (ms(b.start) > ms(a.start)) return ms(b.start)
  const opts = switchTimes(a, b)
  return opts[Math.floor((opts.length - 1) / 2)] ?? ms(b.start)
}

/**
 * The plan as saved: a pick that follows a clash always carries its switch time (so the
 * server's reminder fires when you actually switch), and one that doesn't clash any more drops it.
 */
export function normalizePlan(plan: PlanItem[], lineup: DjSet[]): PlanItem[] {
  const rows = planTimeline(plan, lineup)
  const after = new Map<string, number>() // pick key → switch time, for picks that follow a clash
  rows.forEach((r, i) => i > 0 && rows[i - 1].clash && after.set(r.item.k, r.from))
  return plan.map(({ k, r }) => (after.has(k) ? { k, r, f: new Date(after.get(k)!).toISOString() } : { k, r }))
}

/** What's next on your plan (or on now). */
export const nextOnPlan = (rows: PlanRow[], now: number) => rows.find(r => r.to > now) ?? null
