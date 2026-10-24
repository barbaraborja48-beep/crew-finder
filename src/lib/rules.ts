// Pin rules. All pure, all in seconds/ms, so they run the same on every phone
// with or without signal.
//
// A pin never expires. It just gets older: bright while fresh, dimmer as it ages,
// then an idle penguin at the last known spot. Old news is still news at 3am.

export const FLOOR_W = 362
export const FLOOR_H = 420
export const FRESH_S = 180 // full glow
export const IDLE_S = 900 // 15 min: the penguin goes idle at its last spot
export const SHOW_S = 12 * 3600 // older than this isn't drawn on the map
export const MERGE_PX = 34

export interface Dot {
  id: string
  member_id: string
  place_id: string
  nx: number
  ny: number
  born: number // ms, when you pinned (on this phone's clock)
  life_s: number // unused since pins stopped expiring; kept for older app versions
  taps: number // how many times you re-pinned this spot
}

export const ageOf = (d: Dot, now: number) => Math.max(0, (now - d.born) / 1000)
/** Has a pin recent enough to show (12 h). */
export const pinned = (d: Dot | null | undefined, now: number): d is Dot => !!d && ageOf(d, now) < SHOW_S
/** Pinned in the last 15 minutes: an active penguin, not an idle one. */
export const fresh = (d: Dot | null | undefined, now: number): d is Dot => !!d && ageOf(d, now) < IDLE_S
/** Glow 0–1: full for 3 minutes, then fades out by 15. */
export const fraction = (d: Dot, now: number) => {
  const a = ageOf(d, now)
  return a <= FRESH_S ? 1 : Math.max(0, 1 - (a - FRESH_S) / (IDLE_S - FRESH_S))
}

const dist = (a: { nx: number; ny: number }, nx: number, ny: number) => Math.hypot((a.nx - nx) * FLOOR_W, (a.ny - ny) * FLOOR_H)

/**
 * Work out your next pin.
 * - Pin within 34 px of your fresh pin at the same place (or any widget/Shortcut pin
 *   at the same place): "still here". Same pin, moved to the midpoint, time reset, taps + 1.
 * - Anything else: a new pin.
 */
export function nextCheckin(
  mine: Dot | null,
  placeId: string,
  nx: number,
  ny: number,
  now: number,
  extendAnywhere: boolean,
  newId: () => string,
): { dot: Omit<Dot, 'member_id'>; merged: boolean } {
  const same = fresh(mine, now) && mine.place_id === placeId
  if (same && (extendAnywhere || dist(mine, nx, ny) < MERGE_PX)) {
    return {
      merged: true,
      dot: {
        id: mine.id,
        place_id: placeId,
        nx: extendAnywhere ? mine.nx : (mine.nx + nx) / 2,
        ny: extendAnywhere ? mine.ny : (mine.ny + ny) / 2,
        born: now,
        life_s: mine.life_s,
        taps: mine.taps + 1,
      },
    }
  }
  return { merged: false, dot: { id: newId(), place_id: placeId, nx, ny, born: now, life_s: 150, taps: 1 } }
}

/** Dot size in px: 10 + 3 per extra pin (max +12); yours is 2 px bigger. */
export const dotSize = (taps: number, mine = false) => 10 + Math.min(4, Math.max(0, taps - 1)) * 3 + (mine ? 2 : 0)

/** Opacity for a dot from its glow. */
export const dotOpacity = (f: number) => 0.15 + 0.85 * f

/** Crew list row fade by age of last pin. */
export const rowOpacity = (ageS: number) => (ageS < FRESH_S ? 1 : ageS < IDLE_S ? 0.65 : 0.4)
