import { describe, expect, it } from 'vitest'
import { dotSize, fraction, fresh, nextCheckin, pinned, type Dot } from './rules'
import { agoLong, zone } from './venue'

const T = 1_000_000_000
let n = 0
const id = () => `new-${++n}`
const dot = (o: Partial<Dot>): Dot => ({ id: 'd', member_id: 'me', place_id: 'brunch', nx: 0.5, ny: 0.5, born: T, life_s: 150, taps: 1, ...o })

describe('pin rules', () => {
  it('a new pin starts fresh', () => {
    const { dot: d, merged } = nextCheckin(null, 'brunch', 0.2, 0.2, T, false, id)
    expect(merged).toBe(false)
    expect([d.born, d.taps]).toEqual([T, 1])
  })

  it('pinning again within 34px is "still here": midpoint, time reset, taps + 1', () => {
    const mine = dot({ born: T - 600_000 }) // 10 min old, still fresh
    const { dot: d, merged } = nextCheckin(mine, 'brunch', 0.55, 0.5, T, false, id) // 18 px away
    expect(merged).toBe(true)
    expect(d.id).toBe('d')
    expect(d.nx).toBeCloseTo(0.525)
    expect([d.born, d.taps]).toEqual([T, 2])
  })

  it('far away, another place, or an idle pin makes a new pin', () => {
    expect(nextCheckin(dot({}), 'brunch', 0.7, 0.5, T, false, id).merged).toBe(false) // 72 px away
    expect(nextCheckin(dot({}), 'jail', 0.5, 0.5, T, true, id).merged).toBe(false)
    expect(nextCheckin(dot({ born: T - 901_000 }), 'brunch', 0.5, 0.5, T, false, id).merged).toBe(false)
  })

  it('the Shortcut re-pins anywhere at the same place, keeping the spot', () => {
    const { dot: d, merged } = nextCheckin(dot({ nx: 0.1 }), 'brunch', 0.9, 0.9, T, true, id)
    expect(merged).toBe(true)
    expect(d.nx).toBe(0.1)
  })

  it('pins age instead of expiring', () => {
    expect(fraction(dot({}), T + 120_000)).toBe(1) // full glow for 3 min
    expect(fraction(dot({}), T + 540_000)).toBeCloseTo(0.5) // halfway to idle
    expect(fresh(dot({}), T + 899_000)).toBe(true)
    expect(fresh(dot({}), T + 900_000)).toBe(false) // idle at 15 min...
    expect(pinned(dot({}), T + 3 * 3600_000)).toBe(true) // ...but still on the map
    expect(pinned(dot({}), T + 12 * 3600_000)).toBe(false)
  })

  it('sizes and labels', () => {
    expect([dotSize(1), dotSize(3), dotSize(9), dotSize(1, true)]).toEqual([10, 16, 22, 12])
    expect(zone(0.2, 0.1)).toBe('front L')
    expect(zone(0.5, 0.5)).toBe('mid C')
    expect(zone(0.9, 0.9)).toBe('back R')
    expect([agoLong(20), agoLong(300), agoLong(7300)]).toEqual(['just now', '5m ago', '2h ago'])
  })
})
