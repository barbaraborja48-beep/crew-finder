import { describe, expect, it } from 'vitest'
import { fanZone, inPoly, isClosed, mapPos, placeAt, where, type FanShape, type Place, type Venue } from './venue'

// Jowke, as in supabase/migrations/20261103120000_mondo_krystal_jowke.sql (map image px).
const fan: FanShape = {
  kind: 'fan', x: 60, y: 0, w: 654, h: 745, djx: 258, djy: 240, radii: [165, 252, 339, 448],
  rows: ['front front', 'front', 'center', 'back', 'back back'], cols: [67, 92],
  poly: [[253, 40], [713, 545], [713, 740], [73, 740], [73, 330], [113, 150]],
}
const zone = (id: string, type: Place['type'], cx: number, cy: number, w: number, h: number, extra = {}): Place =>
  ({ id, type, name: id, near: '', n: null, x: cx, y: cy, shape: { kind: 'zone', cx, cy, w, h, ...extra } })
const jowke: Place[] = [
  { id: 'j-pista', type: 'stage', name: 'Dance floor', near: '', n: 1, x: 380, y: 450, shape: fan },
  zone('j-bar1', 'bar', 548, 370, 440, 70, { angle: 49.8 }),
  zone('j-bar2', 'bar', 183, 459, 110, 170),
  zone('j-entrada', 'open', 45, 975, 90, 100, { door: true }),
  zone('j-terraza', 'open', 265, 1370, 530, 1260, { bg: true }),
  zone('j-camino', 'open', 57, 390, 115, 700, { bg: true }),
]
/** Image px → the floor's own 0–1 spot. */
const n = (x: number, y: number): [number, number] => [(x - fan.x) / fan.w, (y - fan.y) / fan.h]
const at = (r: number, deg: number) => n(fan.djx + r * Math.cos((deg * Math.PI) / 180), fan.djy + r * Math.sin((deg * Math.PI) / 180))

describe('open-air floor (Jowke)', () => {
  it('names rows by rings around the DJ and columns by the two lines', () => {
    expect(fanZone(fan, ...at(130, 80))).toBe('front front, middle')
    expect(fanZone(fan, ...at(200, 80))).toBe('front, middle')
    expect(fanZone(fan, ...at(300, 100))).toBe('center, left')
    expect(fanZone(fan, ...at(400, 45))).toBe('back, right')
    expect(fanZone(fan, ...at(480, 80))).toBe('back back, middle')
  })
  it('where() reads like the drawing', () => {
    expect(where(jowke[0], ...at(130, 80))).toBe('Dance floor · front front, middle')
  })
  it('a tap lands on the floor, the slanted bar, or nothing off the venue', () => {
    expect(placeAt(jowke, 1, 380, 450)?.place.id).toBe('j-pista')
    expect(placeAt(jowke, 1, 548, 370)?.place.id).toBe('j-bar1')
    expect(placeAt(jowke, 1, 520, 340)?.place.id).toBe('j-bar1') // along the bar, off its middle
    expect(placeAt(jowke, 1, 183, 459)?.place.id).toBe('j-bar2')
    expect(placeAt(jowke, 1, 650, 120)).toBeNull() // empty space beside the building
    expect(placeAt(jowke, 1, 45, 975)?.place.shape).toMatchObject({ door: true })
    expect(placeAt(jowke, 1, 300, 1400)?.place.id).toBe('j-terraza')
  })
  it('the floor spot from a tap goes back to the same map point', () => {
    const v = { view_scale: 1, view_ox: 0, view_oy: 0 } as Venue
    const hit = placeAt(jowke, 1, 400, 600)!
    const f = mapPos(v, hit.place, hit.nx, hit.ny)
    expect(f.x).toBeCloseTo(400)
    expect(f.y).toBeCloseTo(600)
    const bar = placeAt(jowke, 1, 520, 340)!
    const p = mapPos(v, bar.place, bar.nx, bar.ny)
    expect(p.x).toBeCloseTo(520)
    expect(p.y).toBeCloseTo(340)
  })
  it('knows the closed rooms', () => {
    const v = { closed: [{ x: 223, y: 1251, w: 303, h: 664 }] } as Venue
    expect(isClosed(v, 300, 1500)).toBe(true)
    expect(isClosed(v, 100, 1500)).toBe(false)
    expect(isClosed({} as Venue, 300, 1500)).toBe(false)
  })
  it('polygon test', () => {
    expect(inPoly(fan.poly, 400, 600)).toBe(true)
    expect(inPoly(fan.poly, 650, 120)).toBe(false)
  })
})

describe('Sala But zones are unchanged (no angle)', () => {
  const mondo = [zone('m-bar1', 'bar', 539, 410, 170, 150), zone('m-main', 'open', 770, 540, 860, 860, { bg: true })]
  it('smallest zone wins, spots as before', () => {
    const hit = placeAt(mondo, 1, 539 + 85 / 2, 410)!
    expect(hit.place.id).toBe('m-bar1')
    expect(hit.nx).toBeCloseTo(0.75)
    expect(hit.ny).toBeCloseTo(0.5)
    expect(placeAt(mondo, 1, 400, 300)?.place.id).toBe('m-main')
    expect(placeAt(mondo, 1, 300, 300)).toBeNull()
  })
})
