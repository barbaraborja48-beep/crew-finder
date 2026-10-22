export type PlaceType = 'stage' | 'wc' | 'bar' | 'water' | 'medic' | 'food' | 'open'

export interface Place {
  id: string
  type: PlaceType
  name: string
  near: string
  n: number | null
  x: number // map image pixels
  y: number
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
  food: ['Food', 'ph ph-fork-knife'],
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

export const where = (p: Place | undefined, nx = 0.5, ny = 0.5) =>
  !p ? 'Somewhere' : p.type === 'stage' ? `${p.name} · ${zone(nx, ny)}` : p.near ? `${p.name} · by ${p.near}` : p.name

/** 150 → "2:30" */
export const fmt = (s: number) => {
  s = Math.max(0, Math.ceil(s))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

/** seconds → "now" / "9m" / "2h" */
export const ago = (s: number) => (s < 60 ? 'now' : s < 3600 ? `${Math.floor(s / 60)}m` : `${Math.floor(s / 3600)}h`)

/** Laser glow; f is the remaining fraction 0–1. */
export const glow = (c: string, f: number) => {
  const g = 5 + 14 * f
  return `0 0 ${g / 2}px ${c}, 0 0 ${g}px ${c}, 0 0 ${g * 2.2}px ${c}`
}

/** Image pixel → map frame px. */
export const toMap = (v: Venue, x: number, y: number) => ({ x: x * v.view_scale + v.view_ox, y: y * v.view_scale + v.view_oy })

/** Where a check-in sits on the overview map: spread a little around the place. */
export const mapPos = (v: Venue, p: Place, nx: number, ny: number) => {
  const c = toMap(v, p.x, p.y)
  const k = p.type === 'stage' ? 1 : 0.5
  return { x: c.x + (nx - 0.5) * 30 * k, y: c.y + (ny - 0.5) * 24 * k }
}
