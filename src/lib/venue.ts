export type PlaceType = 'stage' | 'wc' | 'bar' | 'water' | 'medic' | 'food' | 'picnic' | 'open' | 'coat' | 'outside' | 'rest' | 'door' | 'attraction'

/** Real outline on the map image (pixels). Places with a shape get a close-up view. */
export type LineShape = { kind: 'counter' | 'trucks'; cx: number; cy: number; len: number; angle: number; depth: number }
export type BoxShape = { kind: 'kiosk' | 'tables'; cx: number; cy: number; size: number }
/**
 * A dance floor at an angle, w wide (left→right facing the DJ) and h deep (front→back).
 * `angle` is the direction of "right"; front is 90° before it. rows/cols: where the 3×3
 * zones split (0–1), when they aren't even thirds.
 */
export type SquareShape = { kind: 'square'; cx: number; cy: number; w: number; h: number; angle: number; rows?: [number, number]; cols?: [number, number]; bulge?: number }
/**
 * Club venues: the patch of floor a place covers. Tap anywhere in it to pin there. No close-up.
 * bg: whole-floor fallback, no icon. angle: turned (degrees), for a bar along a slanted wall.
 * door: the way in and out; tapping it asks "arriving or leaving, and when?" instead of pinning.
 */
export type ZoneShape = { kind: 'zone'; cx: number; cy: number; w: number; h: number; bg?: boolean; angle?: number; door?: boolean }
/**
 * An open-air dance floor around a DJ booth (Mondo Krystal at Jowke). The close-up is the map
 * itself, cut to the box x, y, w, h (image px); nx/ny are spots in that box. Rows are rings around
 * the DJ (radii, image px), columns split at two angles (degrees, 0 = right, 90 = straight down).
 * poly: the floor's real outline, so a tap on the path outside it isn't "dance floor".
 */
export type FanShape = { kind: 'fan'; x: number; y: number; w: number; h: number; djx: number; djy: number; radii: number[]; rows: string[]; cols: [number, number]; poly: [number, number][] }
export type Shape = LineShape | BoxShape | SquareShape | ZoneShape | FanShape
export const isLine = (sh: Shape): sh is LineShape => sh.kind === 'counter' || sh.kind === 'trucks'

export interface Place {
  id: string
  type: PlaceType
  name: string
  near: string
  n: number | null
  x: number // map image pixels (icon position)
  y: number
  shape?: Shape | null
  floor?: number | null // multi-floor venues; empty = on every floor
}

/** One floor plan of a multi-floor venue. */
export interface Floor {
  n: number
  name: string
  map_url: string
  map_w: number
  map_h: number
  view_scale: number
  view_ox: number
  view_oy: number
}

export interface Venue {
  id: string
  name: string
  event_name: string
  map_url: string
  map_w: number
  map_h: number
  view_scale: number
  view_ox: number
  view_oy: number
  floors?: Floor[]
  closed?: { x: number; y: number; w: number; h: number }[] // parts of the plan that are shut off: no pinning there
  default_meet?: string | null
  lineup?: { name: string; start: string; end: string; stage?: string }[] // the DJ screen's set times (festivals: per stage)
}

/** Halloween Takeover's stages wear their own logos on profile circles (cut from the poster). */
export const HALLOWEEN_ID = 'e1e0a000-0000-4000-8000-000000000001'
export const STAGE_LOGOS: Record<string, string> = {
  elrow: '/assets/logos/elrow.png',
  brunch: '/assets/logos/brunch.png',
  industry: '/assets/logos/industry.png',
  plaza: '/assets/logos/plaza.png',
  jail: '/assets/logos/jail.png',
}

/** Hallowfest at Fabrik: same idea, logos cut from its timetable. */
export const FABRIK_ID = 'e1e0a000-0000-4000-8000-000000000004'
export const FABRIK_LOGOS: Record<string, string> = {
  'f-main': '/assets/logos/fabrik-code.png',
  'f-area19': '/assets/logos/fabrik-nexus.png',
  'f-club': '/assets/logos/fabrik-rave404.png',
  'f-crystal': '/assets/logos/fabrik-resistencia.png',
  'f-hangar': '/assets/logos/fabrik-loop.png',
  'f-satelite': '/assets/logos/fabrik-xtreme.png',
}

/** Venues you can start a crew at. The maps live in /public/assets. */
export const VENUES = [
  { id: 'e1e0a000-0000-4000-8000-000000000001', name: 'Halloween Takeover', where: 'Recinto Iberdrola Music · 31.10.26' },
  { id: 'e1e0a000-0000-4000-8000-000000000002', name: 'Mondo Disko', where: 'Sala But · two floors' },
  { id: 'e1e0a000-0000-4000-8000-000000000003', name: 'Mondo Krystal', where: 'Terraza Jowke · open air' },
  { id: 'e1e0a000-0000-4000-8000-000000000004', name: 'Hallowfest', where: 'Fabrik · 31.10.26' },
]

/** The venue as seen on one floor: same venue, that floor's map. */
export function floorView(v: Venue, n: number | null | undefined): Venue {
  const f = v.floors?.find(x => x.n === n) ?? v.floors?.[0]
  return f ? { ...v, ...f, name: v.name } : v
}

/** Is this place drawn on floor n? (Single-floor venues: always.) */
export const onFloor = (p: Place | undefined, n: number) => !!p && (p.floor == null || p.floor === n)

export const TYPES: Record<PlaceType, [label: string, icon: string]> = {
  stage: ['Stages', 'ph ph-speaker-hifi'],
  wc: ['WC', 'ph ph-toilet'],
  bar: ['Bars', 'ph ph-martini'],
  water: ['Water', 'ph ph-drop'],
  medic: ['Medical', 'ph ph-first-aid'],
  food: ['Food trucks', 'ph ph-fork-knife'],
  picnic: ['Picnic', 'ph ph-picnic-table'],
  open: ['Open areas', 'ph ph-tree'],
  coat: ['Coat check', 'ph ph-coat-hanger'],
  outside: ['Smoking area', 'ph ph-cigarette'],
  rest: ['Rest area', 'ph ph-armchair'],
  door: ['Entrances', 'ph ph-door-open'],
  attraction: ['Attractions', 'ph ph-skull'],
}

export const STATUS: [icon: string, label: string][] = [
  ['ph-fill ph-smiley', 'Vibing'],
  ['ph-fill ph-question', 'Lost'],
  ['ph-fill ph-drop', 'Water'],
  ['ph-fill ph-door-open', 'Leaving'],
]

/** You always glow cyan on your own phone. */
export const ME = '#3bf0ff'

/** Colors friends can pick. Cyan is reserved for "you". */
export const LASERS = [
  '#ff3b5c', '#ff8a3b', '#ffc83b', '#b6ff3b', '#3bff5f', '#22c55e', '#3bffb0', '#14d4c8', '#4cc3ff',
  '#3b8bff', '#5b4bff', '#a46bff', '#c4b0ff', '#d23bff', '#ff3bd4', '#ff7ad9', '#f3f5fe',
]

/** The map frame in the design is 390×346 logical px. */
export const MAP_W = 390
export const MAP_H = 346

export const zone = (nx: number, ny: number) =>
  `${ny < 0.333 ? 'front' : ny < 0.666 ? 'mid' : 'back'} ${nx < 0.333 ? 'L' : nx < 0.666 ? 'C' : 'R'}`

/** Angled dance floors use the venue's own zone names: "front left", "middle middle"… */
export function floorZone(sh: SquareShape, nx: number, ny: number) {
  const [r1, r2] = sh.rows ?? [1 / 3, 2 / 3]
  const [c1, c2] = sh.cols ?? [1 / 3, 2 / 3]
  if (ny < CORNER && (nx < CORNER || nx > 1 - CORNER)) return `front ${nx < 0.5 ? 'left' : 'right'} corner`
  const dip = rowDip(sh, nx)
  return `${ny < r1 + dip ? 'front' : ny < r2 + dip ? 'middle' : 'back'} ${nx < c1 ? 'left' : nx < c2 ? 'middle' : 'right'}`
}
/** The two spots either side of the DJ booth. */
export const CORNER = 0.12
/** Rows curve around the DJ like the crowd does: the row lines dip in the middle. */
export const rowDip = (sh: SquareShape, nx: number) => (sh.bulge ?? 0) * (1 - (2 * nx - 1) ** 2)

/** Open-air floor: which ring around the DJ and which side. "front front, left" */
export function fanZone(sh: FanShape, nx: number, ny: number) {
  const [dx, dy] = [sh.x + nx * sh.w - sh.djx, sh.y + ny * sh.h - sh.djy]
  const d = Math.hypot(dx, dy)
  const i = sh.radii.findIndex(r => d < r)
  const a = (Math.atan2(dy, dx) * 180) / Math.PI
  return `${sh.rows[i < 0 ? sh.rows.length - 1 : i]}, ${a > sh.cols[1] ? 'left' : a > sh.cols[0] ? 'middle' : 'right'}`
}

/** Is this image point inside the polygon? */
export function inPoly(poly: [number, number][], x: number, y: number) {
  let inside = false
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i]
    const [xj, yj] = poly[j]
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside
  }
  return inside
}

/** A zone turned by its angle: image px → its own frame (and back). */
const turn = (x: number, y: number, deg = 0) => {
  const a = (deg * Math.PI) / 180
  return [x * Math.cos(a) - y * Math.sin(a), x * Math.sin(a) + y * Math.cos(a)]
}

/** Stages and shaped places (bars, trucks, picnic) open a tap-where-you-are close-up. */
export const hasCloseUp = (p: Place | undefined) => !!p && (p.type === 'stage' || (!!p.shape && p.shape.kind !== 'zone'))

/** Where you are within a shaped place: "left end", "truck 4", "front"… */
export function spot(p: Place, nx: number, ny: number) {
  const k = p.shape?.kind
  if (k === 'trucks') return `truck ${Math.min(8, 1 + Math.floor(nx * 8))}`
  if (k === 'counter') return nx < 0.333 ? 'left end' : nx < 0.666 ? 'middle' : 'right end'
  if (k === 'kiosk' || k === 'tables') {
    const dx = nx - 0.5
    const dy = ny - 0.5
    return Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? 'left side' : 'right side') : dy < 0 ? 'front' : 'back'
  }
  return ''
}

/** "Brunch! · front L", "Bar · by elrow, left · left end", "WC · by Salida" */
export function where(p: Place | undefined, nx = 0.5, ny = 0.5) {
  if (!p) return 'Somewhere'
  const fl = p.floor ? ` · Planta ${p.floor}` : ''
  if (p.type === 'stage') return `${p.name} · ${p.shape?.kind === 'square' ? floorZone(p.shape, nx, ny) : p.shape?.kind === 'fan' ? fanZone(p.shape, nx, ny) : zone(nx, ny)}${fl}`
  const base = p.near ? `${p.name} · by ${p.near}` : p.name
  const s = p.shape ? spot(p, nx, ny) : ''
  return `${s ? `${base} · ${s}` : base}${fl}`
}

/** Title for a close-up: "Brunch!", "Bar · elrow, left", "Food trucks". */
export const placeTitle = (p: Place) => (p.type === 'stage' || !p.near ? p.name : `${p.name} · ${p.near}`)

/** 150 → "2:30" */
export const fmt = (s: number) => {
  s = Math.max(0, Math.ceil(s))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

/** seconds → "now" / "9m" / "2h" */
export const ago = (s: number) => (s < 60 ? 'now' : s < 3600 ? `${Math.floor(s / 60)}m` : `${Math.floor(s / 3600)}h`)

/** seconds → "just now" / "9m ago" / "2h ago" */
export const agoLong = (s: number) => (s < 60 ? 'just now' : `${ago(s)} ago`)

/** Laser glow; f is the remaining fraction 0–1. */
export const glow = (c: string, f: number) => {
  const g = 5 + 14 * f
  return `0 0 ${g / 2}px ${c}, 0 0 ${g}px ${c}, 0 0 ${g * 2.2}px ${c}`
}

/** Image pixel → map frame px. */
export const toMap = (v: Venue, x: number, y: number) => ({ x: x * v.view_scale + v.view_ox, y: y * v.view_scale + v.view_oy })

/** Where a check-in sits on the overview map: along the bar, by the right truck, around the stage. */
export const mapPos = (v: Venue, p: Place, nx: number, ny: number) => {
  const sh = p.shape
  if (sh && isLine(sh)) {
    const a = (sh.angle * Math.PI) / 180
    const along = (nx - 0.5) * sh.len
    const out = sh.depth / 2 + 6 + ny * 18 // standing in front of it
    return toMap(v, sh.cx + Math.cos(a) * along - Math.sin(a) * out, sh.cy + Math.sin(a) * along + Math.cos(a) * out)
  }
  if (sh?.kind === 'square') {
    const [x, y] = squarePoint(sh, nx, ny)
    return toMap(v, x, y)
  }
  if (sh?.kind === 'zone') {
    const [u, w] = turn((nx - 0.5) * sh.w, (ny - 0.5) * sh.h, sh.angle)
    return toMap(v, sh.cx + u, sh.cy + w)
  }
  if (sh?.kind === 'fan') return toMap(v, sh.x + nx * sh.w, sh.y + ny * sh.h)
  if (sh) return toMap(v, sh.cx + (nx - 0.5) * sh.size * 1.4, sh.cy + (ny - 0.5) * sh.size * 1.4)
  const c = toMap(v, p.x, p.y)
  const k = p.type === 'stage' ? 1 : 0.5
  return { x: c.x + (nx - 0.5) * 30 * k, y: c.y + (ny - 0.5) * 24 * k }
}

/** Corners of a shape's outline in map-frame px, for drawing it as an SVG polygon. */
export function outline(v: Venue, sh: Shape) {
  let pts: [number, number][]
  if (isLine(sh)) {
    const a = (sh.angle * Math.PI) / 180
    const [ux, uy, px, py] = [Math.cos(a), Math.sin(a), -Math.sin(a), Math.cos(a)]
    const [l, d] = [sh.len / 2, sh.depth / 2]
    pts = [[l, d], [-l, d], [-l, -d], [l, -d]].map(([u, w]) => [sh.cx + ux * u + px * w, sh.cy + uy * u + py * w])
  } else if (sh.kind === 'square') {
    pts = [[0, 0], [1, 0], [1, 1], [0, 1]].map(([x, y]) => squarePoint(sh, x, y))
  } else if (sh.kind === 'zone') {
    const [w, h] = [sh.w / 2, sh.h / 2]
    pts = [[-w, -h], [w, -h], [w, h], [-w, h]].map(([x, y]) => {
      const [u, t] = turn(x, y, sh.angle)
      return [sh.cx + u, sh.cy + t]
    })
  } else if (sh.kind === 'fan') {
    pts = sh.poly
  } else {
    const h = sh.size / 2
    pts = [[-h, -h], [h, -h], [h, h], [-h, h]].map(([x, y]) => [sh.cx + x, sh.cy + y])
  }
  return pts.map(([x, y]) => toMap(v, x, y))
}

/** Close-up spot (nx right, ny back, 0–1) → map image px on an angled dance floor. */
export function squarePoint(sh: SquareShape, nx: number, ny: number): [number, number] {
  const a = (sh.angle * Math.PI) / 180
  const [u, w] = [(nx - 0.5) * sh.w, (ny - 0.5) * sh.h] // right, back
  return [sh.cx + Math.cos(a) * u - Math.sin(a) * w, sh.cy + Math.sin(a) * u + Math.cos(a) * w]
}

/** Is this image point in a part of the plan that's shut off tonight? */
export const isClosed = (v: Venue | null | undefined, x: number, y: number) =>
  !!v?.closed?.some(c => x >= c.x && x <= c.x + c.w && y >= c.y && y <= c.y + c.h)

/**
 * Club venues: which place a tap on the floor plan lands in (image px), and where
 * inside it. The smallest matching area wins, so a bar beats "Main room".
 */
export function placeAt(places: Place[], floor: number, x: number, y: number) {
  let best: { place: Place; nx: number; ny: number; area: number } | null = null
  for (const p of places) {
    const sh = p.shape
    if (!sh || !onFloor(p, floor)) continue
    let nx: number, ny: number, area: number
    if (sh.kind === 'square') {
      const a = (sh.angle * Math.PI) / 180
      const [dx, dy] = [x - sh.cx, y - sh.cy]
      nx = (dx * Math.cos(a) + dy * Math.sin(a)) / sh.w + 0.5
      ny = (-dx * Math.sin(a) + dy * Math.cos(a)) / sh.h + 0.5
      area = sh.w * sh.h
    } else if (sh.kind === 'zone') {
      const [u, w] = turn(x - sh.cx, y - sh.cy, -(sh.angle ?? 0))
      nx = u / sh.w + 0.5
      ny = w / sh.h + 0.5
      area = sh.w * sh.h
    } else if (sh.kind === 'fan') {
      if (!inPoly(sh.poly, x, y)) continue
      nx = (x - sh.x) / sh.w
      ny = (y - sh.y) / sh.h
      area = sh.w * sh.h
    } else continue
    if (nx < 0 || nx > 1 || ny < 0 || ny > 1) continue
    if (!best || area < best.area) best = { place: p, nx, ny, area }
  }
  return best && { place: best.place, nx: best.nx, ny: best.ny }
}
