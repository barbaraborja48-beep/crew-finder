// Check-in rules from the design handoff. All pure, all in seconds/ms, so they
// run the same on every phone with or without signal.

export const FLOOR_W = 362
export const FLOOR_H = 420
export const BASE_LIFE = 150 // 2:30
export const MAX_REMAINING = 600
export const NEAR_PX = 70
export const MERGE_PX = 34

export interface Dot {
  id: string
  member_id: string
  place_id: string
  nx: number
  ny: number
  born: number // ms
  life_s: number
  taps: number
}

export const remaining = (d: Dot, now: number) => (d.born + d.life_s * 1000 - now) / 1000
export const alive = (d: Dot | null | undefined, now: number): d is Dot => !!d && remaining(d, now) > 0
export const fraction = (d: Dot, now: number) => Math.max(0, Math.min(1, remaining(d, now) / BASE_LIFE))

const dist = (a: { nx: number; ny: number }, nx: number, ny: number) => Math.hypot((a.nx - nx) * FLOOR_W, (a.ny - ny) * FLOOR_H)

/** A friend's live dot within 70 px on the same place, if any. */
export function nearFriend<T extends Dot>(friends: T[], placeId: string, nx: number, ny: number, now: number): T | undefined {
  return friends.find(f => f.place_id === placeId && alive(f, now) && dist(f, nx, ny) < NEAR_PX)
}

/**
 * Work out your next dot after a tap.
 * - New spot: 2:30, +0:30 if a friend is near.
 * - Tap within 34 px of your live dot (or any widget/area/Shortcut tap at the same place):
 *   merge to the midpoint, +1:00 (+0:30 friend near), taps+1, at most 10:00 left.
 */
export function nextCheckin(
  mine: Dot | null,
  placeId: string,
  nx: number,
  ny: number,
  now: number,
  friendNear: boolean,
  extendAnywhere: boolean,
  newId: () => string,
): { dot: Omit<Dot, 'member_id'>; merged: boolean } {
  const mineAlive = alive(mine, now) && mine!.place_id === placeId
  const close = mineAlive && (extendAnywhere || dist(mine!, nx, ny) < MERGE_PX)
  if (close && mine) {
    const add = 60 + (friendNear ? 30 : 0)
    return {
      merged: true,
      dot: {
        id: mine.id,
        place_id: placeId,
        nx: extendAnywhere ? mine.nx : (mine.nx + nx) / 2,
        ny: extendAnywhere ? mine.ny : (mine.ny + ny) / 2,
        born: now,
        life_s: Math.round(Math.min(MAX_REMAINING, remaining(mine, now) + add)),
        taps: mine.taps + 1,
      },
    }
  }
  return {
    merged: false,
    dot: { id: newId(), place_id: placeId, nx, ny, born: now, life_s: BASE_LIFE + (friendNear ? 30 : 0), taps: 1 },
  }
}

/** Dot size in px: 10 + 3 per extra tap (max +12); yours is 2 px bigger. */
export const dotSize = (taps: number, mine = false) => 10 + Math.min(4, Math.max(0, taps - 1)) * 3 + (mine ? 2 : 0)

/** Opacity for a live dot. */
export const dotOpacity = (f: number) => 0.15 + 0.85 * f

/** Crew list row fade by age of last check-in. */
export const rowOpacity = (ageS: number) => (ageS < 180 ? 1 : ageS < 900 ? 0.65 : 0.4)
