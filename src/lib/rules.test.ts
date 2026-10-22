import { describe, expect, it } from 'vitest'
import { alive, dotSize, nearFriend, nextCheckin, remaining, type Dot } from './rules'
import { fmt, zone } from './venue'

const T = 1_000_000
let n = 0
const id = () => `new-${++n}`
const dot = (o: Partial<Dot>): Dot => ({ id: 'd', member_id: 'me', place_id: 'brunch', nx: 0.5, ny: 0.5, born: T, life_s: 150, taps: 1, ...o })

describe('check-in rules', () => {
  it('new check-in lasts 2:30', () => {
    const { dot: d, merged } = nextCheckin(null, 'brunch', 0.2, 0.2, T, false, false, id)
    expect(merged).toBe(false)
    expect(d.life_s).toBe(150)
    expect(d.taps).toBe(1)
  })

  it('friend near adds 0:30 to a new check-in', () => {
    expect(nextCheckin(null, 'brunch', 0.2, 0.2, T, true, false, id).dot.life_s).toBe(180)
  })

  it('repeat tap within 34px merges: midpoint, remaining + 60, taps + 1', () => {
    const mine = dot({ nx: 0.5, ny: 0.5, born: T - 50_000 }) // 100 s left
    const { dot: d, merged } = nextCheckin(mine, 'brunch', 0.55, 0.5, T, false, false, id) // 18 px away
    expect(merged).toBe(true)
    expect(d.id).toBe('d')
    expect(d.nx).toBeCloseTo(0.525)
    expect(d.life_s).toBe(160)
    expect(d.taps).toBe(2)
    expect(d.born).toBe(T)
  })

  it('tap further than 34px starts a new dot', () => {
    const mine = dot({})
    const { merged } = nextCheckin(mine, 'brunch', 0.7, 0.5, T, false, false, id) // 72 px away
    expect(merged).toBe(false)
  })

  it('repeat with friend near adds 1:30, capped at 10:00 remaining', () => {
    expect(nextCheckin(dot({ born: T }), 'brunch', 0.5, 0.5, T, true, false, id).dot.life_s).toBe(240)
    expect(nextCheckin(dot({ born: T, life_s: 580 }), 'brunch', 0.5, 0.5, T, false, false, id).dot.life_s).toBe(600)
  })

  it('widget / area tap extends anywhere on the same place, keeps position', () => {
    const mine = dot({ nx: 0.1, ny: 0.1 })
    const { dot: d, merged } = nextCheckin(mine, 'brunch', 0.5, 0.5, T, false, true, id)
    expect(merged).toBe(true)
    expect([d.nx, d.ny]).toEqual([0.1, 0.1])
  })

  it('a different place replaces your dot', () => {
    expect(nextCheckin(dot({}), 'jail', 0.5, 0.5, T, false, true, id).merged).toBe(false)
  })

  it('expired dot does not merge', () => {
    expect(nextCheckin(dot({ born: T - 200_000 }), 'brunch', 0.5, 0.5, T, false, false, id).merged).toBe(false)
  })

  it('near = live friend within 70px at the same place', () => {
    const f = [dot({ id: 'ana', member_id: 'ana', nx: 0.14, ny: 0.14 })]
    expect(nearFriend(f, 'brunch', 0.24, 0.2, T)).toBeTruthy() // ~44 px
    expect(nearFriend(f, 'brunch', 0.6, 0.6, T)).toBeUndefined()
    expect(nearFriend(f, 'jail', 0.14, 0.14, T)).toBeUndefined()
    expect(nearFriend(f, 'brunch', 0.14, 0.14, T + 151_000)).toBeUndefined()
  })

  it('remaining, alive, sizes and labels', () => {
    expect(remaining(dot({}), T + 30_000)).toBe(120)
    expect(alive(dot({}), T + 150_000)).toBe(false)
    expect([dotSize(1), dotSize(3), dotSize(9), dotSize(1, true)]).toEqual([10, 16, 22, 12])
    expect(zone(0.2, 0.1)).toBe('front L')
    expect(zone(0.5, 0.5)).toBe('mid C')
    expect(zone(0.9, 0.9)).toBe('back R')
    expect(fmt(150)).toBe('2:30')
    expect(fmt(59.2)).toBe('1:00')
  })
})
