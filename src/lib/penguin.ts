// PinGü penguin helpers: what someone's penguin is doing, accessories, signal speeds.
import type { PlaceType } from './venue'

export type Activity = 'dance' | 'drink' | 'eat' | 'wait' | 'sit' | 'chill' | 'smoke' | 'lost' | 'walk' | 'sleep'

/** What someone is up to, from where they checked in and their status. */
export function activityFor(type: PlaceType | undefined, status: number, live: boolean): Activity {
  if (!live) return 'sleep' // check-in faded: dozing at the last known spot
  if (status === 1) return 'lost'
  if (status === 3) return 'walk'
  if (status === 2) return 'drink'
  switch (type) {
    case 'stage':
      return 'dance'
    case 'bar':
    case 'water':
      return 'drink'
    case 'food':
      return 'eat'
    case 'wc':
    case 'coat':
      return 'wait'
    case 'outside':
      return 'smoke'
    case 'picnic':
    case 'medic':
      return 'sit'
    default:
      return 'chill'
  }
}

export const ACTIVITY_LABEL: Record<Activity, string> = {
  dance: 'dancing',
  drink: 'having a drink',
  eat: 'eating',
  wait: 'in the queue',
  sit: 'sitting down',
  chill: 'hanging out',
  smoke: 'outside for a smoke',
  lost: 'looking for you',
  walk: 'heading out',
  sleep: 'last seen here',
}

/** Accessories: one per penguin, stored as a single number. */
export const ACCESSORIES = [
  'None', 'Shades', 'Heart shades', 'Neon visor', 'Devil horns', 'Costume mask', 'Crown', 'Pink wig', 'Blue wig', 'Lime wig',
  'Headphones', 'Witch hat', 'Cat ears', 'Party hat', 'Bucket hat', 'Flower crown', 'Halo', 'Bandana', 'Backwards cap', 'Star shades',
] as const

/** Signal 0-3 → animation speed multiplier (smaller = faster). */
export const SPEED = [3, 1.7, 1, 0.68]
export const SIGNAL_LABEL = ['No signal', 'Weak signal', 'OK signal', 'Great signal']

