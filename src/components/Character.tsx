// A little crew mascot in your laser color, doing whatever fits where you are.
// Drawn in SVG and animated with CSS: no images, no data.
import type { PlaceType } from '../lib/venue'

export type Activity = 'dance' | 'drink' | 'eat' | 'wait' | 'sit' | 'chill' | 'lost' | 'walk' | 'sleep'

/** What someone is up to, from where they checked in and their status. */
export function activityFor(type: PlaceType | undefined, status: number, live: boolean): Activity {
  if (!live) return 'sleep' // last check-in faded: dozing where we last saw them
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
      return 'wait'
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
  lost: 'looking for you',
  walk: 'heading out',
  sleep: 'last seen here',
}

// Each person dances slightly off the others' beat.
const phase = (seed: string) => {
  let h = 0
  for (const c of seed) h = (h * 31 + c.charCodeAt(0)) | 0
  return (Math.abs(h) % 1000) / 1000
}

export function Character({
  color,
  activity,
  seed,
  size = 28,
  glow = 1,
  animate = true,
  queued = false,
}: {
  color: string
  activity: Activity
  seed: string
  size?: number
  glow?: number // 0–1, how fresh the check-in is
  animate?: boolean
  queued?: boolean // yours, not sent yet: drawn as an outline
}) {
  const dark = `color-mix(in srgb, ${color} 62%, #161826)`
  const delay = `-${(phase(seed) * 2).toFixed(2)}s`
  return (
    <svg
      className={`chr ${animate ? 'anim' : ''} ${activity}`}
      viewBox="-8 -16 56 70"
      width={size}
      height={size * 1.25}
      style={{ ['--d' as string]: delay, overflow: 'visible', display: 'block' }}
      aria-hidden
    >
      {/* laser glow on the floor, fades with the check-in */}
      <ellipse cx="20" cy="47" rx="14" ry="4" fill={color} opacity={0.15 + 0.5 * glow} style={{ filter: `blur(${1 + 2 * glow}px)` }} />
      <g className="feet">
        <ellipse className="fl" cx="14.5" cy="46" rx="4.5" ry="2.4" fill="#ffc83b" />
        <ellipse className="fr" cx="25.5" cy="46" rx="4.5" ry="2.4" fill="#ffc83b" />
      </g>
      <g className="b">
        <g className="al">
          <ellipse cx="6.5" cy="31" rx="3.6" ry="8.5" fill={dark} transform="rotate(14 6.5 31)" />
        </g>
        <g className="ar">
          <ellipse cx="33.5" cy="31" rx="3.6" ry="8.5" fill={dark} transform="rotate(-14 33.5 31)" />
          {activity === 'dance' && <rect x="33" y="33" width="2.4" height="12" rx="1.2" fill="#f3f5fe" transform="rotate(-25 34 39)" style={{ filter: `drop-shadow(0 0 2px ${color})` }} />}
          {activity === 'drink' && (
            <g>
              <path d="M32 37 h7 l-1.2 7 h-4.6 z" fill="#f3f5fe" opacity=".9" />
              <path d="M32.6 39 h5.8 l-.8 4.4 h-4.2 z" fill={color} opacity=".7" />
              <line x1="37" y1="37" x2="39.5" y2="33" stroke="#f3f5fe" strokeWidth="1" />
            </g>
          )}
          {activity === 'eat' && <path d="M31 40 a5 5 0 0 1 10 0 z" fill="#ffc83b" stroke="#ff8a3b" strokeWidth="1" />}
        </g>
        <ellipse cx="20" cy="29" rx="13.5" ry="16.5" fill={queued ? 'transparent' : color} stroke={queued ? color : 'none'} strokeWidth={queued ? 2 : 0} strokeDasharray={queued ? '3 2' : undefined} />
        <ellipse cx="20" cy="33" rx="8.6" ry="10.6" fill="#f3f5fe" opacity={queued ? 0.35 : 0.95} />
        <g className="face">
          {activity === 'sleep' ? (
            <>
              <path d="M13 21 q2.2 1.6 4.4 0" stroke="#161826" strokeWidth="1.4" fill="none" strokeLinecap="round" />
              <path d="M22.6 21 q2.2 1.6 4.4 0" stroke="#161826" strokeWidth="1.4" fill="none" strokeLinecap="round" />
            </>
          ) : (
            <>
              <circle cx="15.2" cy="20" r="2.6" fill="#161826" />
              <circle cx="24.8" cy="20" r="2.6" fill="#161826" />
              <circle cx="16" cy="19.2" r=".9" fill="#fff" />
              <circle cx="25.6" cy="19.2" r=".9" fill="#fff" />
            </>
          )}
          <path d="M17.6 24 h4.8 l-2.4 3 z" fill="#ffc83b" />
        </g>
      </g>
      {activity === 'lost' && (
        <text className="bubble" x="31" y="6" fontSize="13" fontWeight="700" fill="#f3f5fe" fontFamily="Inter, sans-serif">
          ?
        </text>
      )}
      {activity === 'sleep' && (
        <text className="zz" x="30" y="8" fontSize="10" fontWeight="600" fill="var(--color-neutral-300)" fontFamily="Inter, sans-serif">
          z
        </text>
      )}
    </svg>
  )
}
