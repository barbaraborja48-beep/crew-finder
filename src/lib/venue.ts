export type PlaceType = 'stage' | 'wc' | 'bar' | 'water' | 'medic' | 'food' | 'picnic' | 'open'

/** Real outline on the map image (pixels). Places with a shape get a close-up view. */
export type LineShape = { kind: 'counter' | 'trucks'; cx: number; cy: number; len: number; angle: number; depth: number }
export type BoxShape = { kind: 'kiosk' | 'tables'; cx: number; cy: number; size: number }
export type Shape = LineShape | BoxShape
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
}

export const TYPES: Record<PlaceType, [label: string, icon: string]> = {
  stage: ['Stages', 'ph ph-speaker-hifi'],
  wc: ['WC', 'ph ph-toilet'],
  bar: ['Bars', 'ph ph-martini'],
  water: ['Water', 'ph ph-drop'],
  medic: ['Medical', 'ph ph-first-aid'],
  food: ['Food trucks', 'ph ph-fork-knife'],
  picnic: ['Picnic', 'ph ph-picnic-table'],
  open: ['Open areas', 'ph ph-tree'],
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
export const LASERS = ['#ff3bd4', '#b6ff3b', '#ffc83b', '#ff3b5c', '#ff8a3b', '#a46bff', '#3bffb0', '#3b8bff', '#ff7ad9', '#f3f5fe']

/** The map frame in the design is 390×346 logical px. */
export const MAP_W = 390
export const MAP_H = 346

export const zone = (nx: number, ny: number) =>
  `${ny < 0.333 ? 'front' : ny < 0.666 ? 'mid' : 'back'} ${nx < 0.333 ? 'L' : nx < 0.666 ? 'C' : 'R'}`

/** Stages and shaped places (bars, trucks, picnic) open a tap-where-you-are close-up. */
export const hasCloseUp = (p: Place | undefined) => !!p && (p.type === 'stage' || !!p.shape)

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
  if (p.type === 'stage') return `${p.name} · ${zone(nx, ny)}`
  const base = p.near ? `${p.name} · by ${p.near}` : p.name
  const s = p.shape ? spot(p, nx, ny) : ''
  return s ? `${base} · ${s}` : base
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
  } else {
    const h = sh.size / 2
    pts = [[-h, -h], [h, -h], [h, h], [-h, h]].map(([x, y]) => [sh.cx + x, sh.cy + y])
  }
  return pts.map(([x, y]) => toMap(v, x, y))
}
