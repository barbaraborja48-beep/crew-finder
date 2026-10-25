import { describe, expect, it } from 'vitest'
import { activeMoves, groupOf, huddleOffset, normalizePlan, pendingInvites, planTimeline, shownDots, suggestions, switchTimes, type DjSet } from './social'
import type { Dot } from './rules'

const T = 1_800_000_000_000
const dot = (member_id: string, born: number, place_id = 'brunch'): Dot => ({ id: `d-${member_id}-${born}`, member_id, place_id, nx: 0.5, ny: 0.5, born, life_s: 150, taps: 1 })
const members = [
  { id: 'b', buddy: 'g', ghost: false },
  { id: 'l', buddy: 'g', ghost: false },
  { id: 'm', buddy: 'g', ghost: false },
  { id: 'x', buddy: null, ghost: false },
]
const msg = (o: Partial<Parameters<typeof activeMoves>[0][number]>) => ({ id: 'id', member_id: 'b', type: 'text', text: '', place_id: null, nx: null, ny: null, born: T, ...o })

describe('buddies', () => {
  it('a group is everyone with the same buddy id; one person alone is solo', () => {
    expect(groupOf(members, 'l')).toEqual(['b', 'l', 'm'])
    expect(groupOf(members, 'x')).toEqual(['x'])
    expect(groupOf([{ id: 'b', buddy: 'g', ghost: false }], 'b')).toEqual(['b'])
  })

  it('anyone in the group pinning moves them all, side by side', () => {
    const latest = new Map([
      ['b', dot('b', T - 60_000, 'jail')],
      ['m', dot('m', T, 'wc')], // Mar pinned last
      ['x', dot('x', T, 'bar')],
    ])
    const shown = shownDots(latest, members)
    expect(['b', 'l', 'm'].map(id => shown.get(id)!.dot.place_id)).toEqual(['wc', 'wc', 'wc'])
    expect(shown.get('x')!.dot.place_id).toBe('bar')
    expect(['b', 'l', 'm'].map(id => huddleOffset(shown.get(id)!.i, shown.get(id)!.n))).toEqual([-1, 0, 1])
  })

  it('once Mar is let go, the others go back to their own newest pin', () => {
    const latest = new Map([['b', dot('b', T - 60_000, 'jail')], ['m', dot('m', T, 'wc')]])
    const shown = shownDots(latest, members.map(m => (m.id === 'm' ? { ...m, buddy: null } : m)))
    expect([shown.get('b')!.dot.place_id, shown.get('l')!.dot.place_id, shown.get('m')!.dot.place_id]).toEqual(['jail', 'jail', 'wc'])
  })

  it('invites: newest per person, skipped once answered or already together', () => {
    const ms = [msg({ id: 'i1', type: 'buddy', member_id: 'x', to_member: 'b', born: T - 1000 }), msg({ id: 'i2', type: 'buddy', member_id: 'x', to_member: 'b', born: T })]
    expect(pendingInvites(ms, members, 'b', {}, T).map(m => m.id)).toEqual(['i2'])
    expect(pendingInvites(ms, members, 'b', { i2: true, i1: true }, T)).toEqual([])
    const inv = [msg({ id: 'i3', type: 'buddy', member_id: 'l', to_member: 'b' })]
    expect(pendingInvites(inv, members, 'b', {}, T)).toEqual([])
  })
})

describe('planned moves', () => {
  const move = msg({ id: 'mv', type: 'move', place_id: 'wc', text: 'going to WC in 10 min', meta: { in: 10, with: ['x'] } })

  it('is due 10 minutes after it was sent, and drops out half an hour later', () => {
    expect(activeMoves([move], T)[0].due).toBe(T + 600_000)
    expect(activeMoves([move], T + 600_000 + 31 * 60_000)).toEqual([])
  })

  it('suggests both penguins at the WC once due, until each one pins', () => {
    const shown = shownDots(new Map([['b', dot('b', T - 5000)], ['x', dot('x', T - 5000)]]), members)
    expect(suggestions([move], shown, T + 60_000)).toEqual([]) // not yet
    expect(suggestions([move], shown, T + 600_000).map(s => s.memberId).sort()).toEqual(['b', 'x'])
    const after = shownDots(new Map([['b', dot('b', T - 5000)], ['x', dot('x', T + 610_000, 'wc')]]), members)
    expect(suggestions([move], after, T + 620_000).map(s => s.memberId)).toEqual(['b'])
  })

  it('a cancel removes it; a decline removes just that person', () => {
    expect(activeMoves([move, msg({ id: 'c', type: 'move', meta: { cancel: 'mv' } })], T)).toEqual([])
    const d = activeMoves([move, msg({ id: 'd', type: 'move', member_id: 'x', meta: { decline: 'mv' } })], T)
    expect(d[0].declined).toEqual(['x'])
  })

  it('a guess shows until that person pins again', () => {
    const g = msg({ id: 'g', type: 'guess', place_id: 'wc', to_member: 'x', born: T })
    const before = shownDots(new Map([['x', dot('x', T - 60_000)]]), members)
    expect(suggestions([g], before, T + 1000).map(s => s.kind)).toEqual(['guess'])
    const after = shownDots(new Map([['x', dot('x', T + 5000)]]), members)
    expect(suggestions([g], after, T + 6000)).toEqual([])
  })
})

describe('set plans', () => {
  const set = (stage: string, name: string, s: string, e: string): DjSet => ({ stage, name, start: `2026-10-31T${s}:00+01:00`, end: `2026-10-31T${e}:00+01:00` })
  const kolsch = set('brunch', 'Kölsch', '20:00', '22:00')
  const wsn = set('plaza', 'What So Not', '20:00', '21:30')
  const yosef = set('plaza', 'Yosef', '21:30', '23:00')
  const lineup = [kolsch, wsn, yosef]
  const k = (s: DjSet) => `${s.stage}|${s.start}`

  it('puts picks in order and spots clashes', () => {
    const rows = planTimeline([{ k: k(yosef), r: 10 }, { k: k(kolsch), r: 10 }], lineup)
    expect(rows.map(r => r.set.name)).toEqual(['Kölsch', 'Yosef'])
    expect(rows[0].clash?.name).toBe('Yosef')
    expect(new Date(rows[0].to).toISOString()).toBe('2026-10-31T20:30:00.000Z') // leave Kölsch when Yosef starts
  })

  it('a switch time moves when you leave the first set', () => {
    const rows = planTimeline([{ k: k(wsn), r: 5 }, { k: k(kolsch), r: 10, f: '2026-10-31T21:00:00+01:00' }], lineup)
    expect(rows.map(r => r.set.name)).toEqual(['What So Not', 'Kölsch'])
    const first = rows[0]
    expect(first.clash).not.toBeNull()
    expect(new Date(first.to).toISOString()).toBe('2026-10-31T20:00:00.000Z') // 21:00 Madrid
  })

  it('switch options: every 15 min while both play, never 0 min of the first', () => {
    expect(switchTimes(kolsch, wsn).map(t => new Date(t).toISOString().slice(11, 16))).toEqual(['19:15', '19:30', '19:45', '20:00', '20:15'])
  })

  it('two picks starting together: switch halfway by default', () => {
    const rows = planTimeline([{ k: k(kolsch), r: 10 }, { k: k(wsn), r: 10 }], lineup)
    expect(rows.map(r => new Date(r.from).toISOString().slice(11, 16))).toEqual(['19:00', '19:45'])
    expect(new Date(rows[0].to).toISOString().slice(11, 16)).toBe('19:45')
  })

  it('saves the switch time with the pick that follows a clash, and drops it when the clash goes', () => {
    const saved = normalizePlan([{ k: k(kolsch), r: 10 }, { k: k(wsn), r: 5 }], lineup)
    expect(saved[1].f).toBe('2026-10-31T19:45:00.000Z')
    expect(normalizePlan([{ k: k(wsn), r: 5, f: saved[1].f }], lineup)).toEqual([{ k: k(wsn), r: 5 }])
  })

  it('drops picks whose set is gone', () => {
    expect(planTimeline([{ k: 'brunch|nope', r: null }], lineup)).toEqual([])
  })
})
