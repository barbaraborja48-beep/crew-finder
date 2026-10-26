// PinGü: a little neon penguin in your color, doing whatever fits where you are.
// How fast it moves shows that person's signal. Drawn in SVG, animated with CSS:
// no images, no data.
import { useId } from 'react'
import { SPEED, type Activity } from '../lib/penguin'

// Each penguin moves slightly off the others' beat.
const phase = (seed: string) => {
  let h = 0
  for (const c of seed) h = (h * 31 + c.charCodeAt(0)) | 0
  return (Math.abs(h) % 1000) / 1000
}

// Six signature dance moves (see styles.css); each penguin keeps the same one.
const MOVES = 6

const WIG: Record<number, string> = { 7: '#ff4fd8', 8: '#3b8bff', 9: '#b6ff3b' }

function Accessory({ acc }: { acc: number }) {
  switch (acc) {
    case 1: // shades
      return (
        <g>
          <rect x="10.8" y="17.2" width="8" height="5.4" rx="2" fill="#07070b" />
          <rect x="21.2" y="17.2" width="8" height="5.4" rx="2" fill="#07070b" />
          <line x1="18.8" y1="19" x2="21.2" y2="19" stroke="#07070b" strokeWidth="1.2" />
          <line x1="12.2" y1="18.4" x2="14.4" y2="18.4" stroke="#fff" strokeWidth=".8" opacity=".7" />
        </g>
      )
    case 2: // heart shades
      return (
        <g fill="#ff3b8a" stroke="#5a0b2e" strokeWidth=".6">
          <path d="M15 23.4 l-4.4 -4.2 a2.3 2.3 0 0 1 4.4 -2.2 a2.3 2.3 0 0 1 4.4 2.2 z" />
          <path d="M25 23.4 l-4.4 -4.2 a2.3 2.3 0 0 1 4.4 -2.2 a2.3 2.3 0 0 1 4.4 2.2 z" />
        </g>
      )
    case 3: // neon visor
      return <rect x="9.6" y="16.8" width="20.8" height="5.6" rx="2.8" fill="#3bf0ff" opacity=".9" style={{ filter: 'drop-shadow(0 0 2px #3bf0ff)' }} />
    case 4: // devil horns
      return (
        <g fill="#ff3b5c">
          <path d="M12.4 15 Q8.6 9 10.6 3.6 Q12.6 9.6 16.6 12.4 z" />
          <path d="M27.6 15 Q31.4 9 29.4 3.6 Q27.4 9.6 23.4 12.4 z" />
        </g>
      )
    case 5: // costume mask
      return (
        <g>
          <path d="M8.6 18.6 Q14 13.6 20 17.2 Q26 13.6 31.4 18.6 Q30 24 25 23.4 Q21.6 23 20 21.2 Q18.4 23 15 23.4 Q10 24 8.6 18.6 z" fill="#a46bff" stroke="#ffc83b" strokeWidth=".9" />
          <ellipse cx="15.2" cy="19.6" rx="2.4" ry="1.8" fill="#07070b" />
          <ellipse cx="24.8" cy="19.6" rx="2.4" ry="1.8" fill="#07070b" />
          <path d="M31 17.6 q4 -3 3 -7" stroke="#ffc83b" strokeWidth="1" fill="none" />
        </g>
      )
    case 6: // crown
      return (
        <g>
          <path d="M12 13.2 L12.8 5.4 L16.4 9.4 L20 3.6 L23.6 9.4 L27.2 5.4 L28 13.2 z" fill="#ffc83b" stroke="#c78a00" strokeWidth=".6" />
          <circle cx="20" cy="9.6" r="1.2" fill="#ff3b5c" />
          <circle cx="15" cy="11" r=".8" fill="#3bf0ff" />
          <circle cx="25" cy="11" r=".8" fill="#3bf0ff" />
        </g>
      )
    case 7:
    case 8:
    case 9: {
      const c = WIG[acc]
      return (
        <g fill={c}>
          {[[11.5, 16, 4], [13.5, 10.8, 4.4], [18.4, 8, 4.6], [23.6, 8.4, 4.6], [27, 11.6, 4.2], [28.6, 16.4, 3.8], [16.5, 12.6, 3.6], [22.8, 12.6, 3.6]].map(([x, y, r], i) => (
            <circle key={i} cx={x} cy={y} r={r} />
          ))}
        </g>
      )
    }
    case 10: // headphones
      return (
        <g>
          <path d="M7 21 Q7 3.5 20 3.5 Q33 3.5 33 21" fill="none" stroke="#1b1b24" strokeWidth="2.6" />
          <path d="M7 21 Q7 3.5 20 3.5 Q33 3.5 33 21" fill="none" stroke="#ff3bd4" strokeWidth=".8" opacity=".8" />
          <rect x="3.6" y="15.5" width="6" height="10" rx="2.4" fill="#1b1b24" stroke="#ff3bd4" strokeWidth=".8" />
          <rect x="30.4" y="15.5" width="6" height="10" rx="2.4" fill="#1b1b24" stroke="#ff3bd4" strokeWidth=".8" />
        </g>
      )
    case 11: // witch hat
      return (
        <g>
          <path d="M12.5 12.5 L22 -9 Q24 -11 25 -8 L27.5 12.5 Z" fill="#3b1d6e" />
          <rect x="12.6" y="8.4" width="14.8" height="3.2" fill="#ff8a3b" />
          <rect x="18.4" y="8" width="3.4" height="4" rx=".6" fill="none" stroke="#ffc83b" strokeWidth=".8" />
          <ellipse cx="20" cy="12.8" rx="14" ry="3" fill="#2a1450" />
        </g>
      )
    case 12: // cat ears
      return (
        <g>
          <path d="M8.6 17.5 L10.2 4.5 L17.4 11.6 Z" fill="#26262c" />
          <path d="M10.6 14.6 L11.4 8 L15.2 11.8 Z" fill="#ff7ad9" />
          <path d="M31.4 17.5 L29.8 4.5 L22.6 11.6 Z" fill="#26262c" />
          <path d="M29.4 14.6 L28.6 8 L24.8 11.8 Z" fill="#ff7ad9" />
        </g>
      )
    case 13: // party hat
      return (
        <g>
          <path d="M14 13.4 L20.6 -4 L26.6 13.4 Z" fill="#ffc83b" />
          <path d="M15.6 9 L25.2 9 M17.4 4 L23.6 4" stroke="#ff3bd4" strokeWidth="1.6" />
          <circle cx="20.6" cy="-5.2" r="2.6" fill="#ff3bd4" />
        </g>
      )
    case 14: // bucket hat
      return (
        <g>
          <path d="M9.6 13 Q10 2.6 20 2.6 Q30 2.6 30.4 13 Z" fill="#d9c9a0" />
          <path d="M9.8 10.6 Q20 8.6 30.2 10.6" fill="none" stroke="#9c8a5c" strokeWidth="1.2" />
          <ellipse cx="20" cy="13.4" rx="15.4" ry="3.2" fill="#c4b282" />
        </g>
      )
    case 15: // flower crown
      return (
        <g>
          <path d="M8.6 15.6 Q20 8.4 31.4 15.6" fill="none" stroke="#3bff5f" strokeWidth="1.2" />
          {[[9.6, 14.4, '#ff7ad9'], [14, 11.6, '#ffe53b'], [20, 10.4, '#c4b0ff'], [26, 11.6, '#ff7ad9'], [30.4, 14.4, '#ffe53b']].map(([x, y, c], i) => (
            <g key={i}>
              <circle cx={x as number} cy={y as number} r="2.6" fill={c as string} />
              <circle cx={x as number} cy={y as number} r=".9" fill="#fff" />
            </g>
          ))}
        </g>
      )
    case 16: // halo
      return <ellipse cx="20" cy="2.4" rx="10" ry="2.8" fill="none" stroke="#ffd94d" strokeWidth="2" style={{ filter: 'drop-shadow(0 0 2px #ffd94d)' }} />
    case 17: // bandana
      return (
        <g>
          <path d="M7.8 17.4 Q20 8.6 32.2 17.4 L31.6 12.6 Q20 4 8.4 12.6 Z" fill="#ff3b5c" />
          <path d="M31.6 13 L37.6 10.6 L35.6 15 Z M31.8 15 L37 18.6 L33.2 18.8 Z" fill="#d42a48" />
          {[[13, 12.6], [20, 9.8], [27, 12.6]].map(([x, y], i) => (
            <circle key={i} cx={x} cy={y} r=".9" fill="#fff" />
          ))}
        </g>
      )
    case 18: // backwards cap
      return (
        <g>
          <path d="M9 11.2 L0.6 13.4 Q1.4 16 9.2 14.8 Z" fill="#2a63c9" />
          <path d="M9 14 Q9.4 3.2 20 3.2 Q30.6 3.2 31 14 Z" fill="#3b8bff" />
          <circle cx="20" cy="3.4" r="1.4" fill="#2a63c9" />
        </g>
      )
    case 19: // star shades
      return (
        <g fill="#ffc83b" stroke="#07070b" strokeWidth=".7">
          <path d={star(15, 20, 5.2)} />
          <path d={star(25, 20, 5.2)} />
          <line x1="19.4" y1="19.4" x2="20.6" y2="19.4" stroke="#07070b" strokeWidth="1.2" />
        </g>
      )
    default:
      return null
  }
}

/** A five-point star centred on (cx, cy). */
const star = (cx: number, cy: number, r: number) =>
  Array.from({ length: 10 }, (_, i) => {
    const a = (Math.PI / 5) * i - Math.PI / 2
    const d = i % 2 ? r * 0.45 : r
    return `${i ? 'L' : 'M'}${(cx + d * Math.cos(a)).toFixed(2)} ${(cy + d * Math.sin(a)).toFixed(2)}`
  }).join(' ') + 'Z'

export function Penguin({
  color,
  activity,
  seed,
  size = 28,
  glow = 1,
  animate = true,
  queued = false,
  acc = 0,
  signal = null,
  saver = false,
}: {
  color: string
  activity: Activity
  seed: string
  size?: number
  glow?: number // 0–1, how fresh the pin is
  animate?: boolean
  queued?: boolean // yours, not sent yet: drawn as a dashed outline
  acc?: number
  signal?: number | null // 0–3: how fast they move
  saver?: boolean // low data mode: small badge so friends know updates may lag
}) {
  const id = useId().replace(/:/g, '')
  const dark = `color-mix(in srgb, ${color} 60%, #07070b)`
  const delay = `-${(phase(seed) * 2).toFixed(2)}s`
  const k = signal == null ? 1 : SPEED[Math.max(0, Math.min(3, signal))]
  const idle = activity === 'sleep'
  const eyesHidden = acc === 1 || acc === 2 || acc === 3 || acc === 19
  return (
    <svg
      className={`chr ${animate ? 'anim' : ''} ${activity} m${Math.floor(phase(seed + 'move') * MOVES)}`}
      viewBox="-8 -16 56 70"
      width={size}
      height={size * 1.25}
      style={{ ['--d' as string]: delay, ['--k' as string]: k, overflow: 'visible', display: 'block' }}
      aria-hidden
    >
      <defs>
        <radialGradient id={`a${id}`}>
          <stop offset="0" stopColor={color} stopOpacity={idle ? 0.12 : 0.55 * (0.35 + 0.65 * glow)} />
          <stop offset="1" stopColor={color} stopOpacity="0" />
        </radialGradient>
      </defs>
      {/* neon aura and the laser glow on the floor */}
      <circle cx="20" cy="27" r="27" fill={`url(#a${id})`} />
      <ellipse className="floor" cx="20" cy="47" rx="14" ry="3.6" fill={color} opacity={idle ? 0.1 : 0.2 + 0.5 * glow} />
      <g className="feet">
        <ellipse className="fl" cx="14.5" cy="46" rx="4.5" ry="2.4" fill="#ffb02e" />
        <ellipse className="fr" cx="25.5" cy="46" rx="4.5" ry="2.4" fill="#ffb02e" />
      </g>
      <g className="b">
        <g className="al">
          <ellipse cx="6.5" cy="31" rx="3.6" ry="8.5" fill={dark} transform="rotate(14 6.5 31)" />
        </g>
        <g className="ar">
          <ellipse cx="33.5" cy="31" rx="3.6" ry="8.5" fill={dark} transform="rotate(-14 33.5 31)" />
          {activity === 'dance' && <rect x="33" y="33" width="2.4" height="12" rx="1.2" fill="#fff" transform="rotate(-25 34 39)" style={{ filter: `drop-shadow(0 0 2px ${color})` }} />}
          {activity === 'drink' && (
            <g>
              <path d="M32 37 h7 l-1.2 7 h-4.6 z" fill="#f3f5fe" opacity=".9" />
              <path d="M32.6 39 h5.8 l-.8 4.4 h-4.2 z" fill={color} opacity=".7" />
              <line x1="37" y1="37" x2="39.5" y2="33" stroke="#f3f5fe" strokeWidth="1" />
            </g>
          )}
          {activity === 'smoke' && (
            <g>
              <rect x="33" y="40.4" width="8" height="1.8" rx=".9" fill="#f3f5fe" />
              <rect x="40" y="40.4" width="1.6" height="1.8" rx=".8" fill="#ff8a3b" style={{ filter: 'drop-shadow(0 0 1.5px #ff8a3b)' }} />
            </g>
          )}
          {activity === 'eat' && <path d="M31 40 a5 5 0 0 1 10 0 z" fill="#ffc83b" stroke="#ff8a3b" strokeWidth="1" />}
        </g>
        <ellipse cx="20" cy="29" rx="13.5" ry="16.5" fill={queued ? 'transparent' : color} stroke={queued ? color : 'none'} strokeWidth={queued ? 2 : 0} strokeDasharray={queued ? '3 2' : undefined} />
        <ellipse cx="20" cy="33" rx="8.6" ry="10.6" fill="#f6f6fa" opacity={queued ? 0.35 : 0.95} />
        <g className="face">
          {!eyesHidden &&
            (idle ? (
              <>
                <path d="M13 21 q2.2 1.6 4.4 0" stroke="#07070b" strokeWidth="1.4" fill="none" strokeLinecap="round" />
                <path d="M22.6 21 q2.2 1.6 4.4 0" stroke="#07070b" strokeWidth="1.4" fill="none" strokeLinecap="round" />
              </>
            ) : (
              <>
                <circle cx="15.2" cy="20" r="2.6" fill="#07070b" />
                <circle cx="24.8" cy="20" r="2.6" fill="#07070b" />
                <circle cx="16" cy="19.2" r=".9" fill="#fff" />
                <circle cx="25.6" cy="19.2" r=".9" fill="#fff" />
              </>
            ))}
          <path d="M17.6 24 h4.8 l-2.4 3 z" fill="#ffb02e" />
          <Accessory acc={acc} />
        </g>
      </g>
      {activity === 'dance' && animate && (
        <g fill={color} fontFamily="Inter, sans-serif" fontWeight="700" style={{ filter: `drop-shadow(0 0 2px ${color})` }}>
          <text className="note" x="30" y="2" fontSize="12">♪</text>
          <text className="note n2" x="0" y="0" fontSize="11">♫</text>
        </g>
      )}
      {activity === 'smoke' && animate && (
        <g fill="#c9c9d1">
          <circle className="puff" cx="34" cy="20" r="2.4" />
          <circle className="puff p2" cx="35" cy="20" r="2" />
          <circle className="puff p3" cx="33" cy="20" r="1.8" />
        </g>
      )}
      {activity === 'lost' && (
        <text className="bubble" x="31" y="4" fontSize="13" fontWeight="700" fill="#fff" fontFamily="Inter, sans-serif">
          ?
        </text>
      )}
      {idle && (
        <text className="zz" x="30" y="6" fontSize="10" fontWeight="600" fill="#c9c9d1" fontFamily="Inter, sans-serif">
          z
        </text>
      )}
      {saver && !idle && (
        // low data mode: a small signal badge
        <g transform="translate(34 41)">
          <circle r="5.2" fill="#07070b" stroke="#ffc83b" strokeWidth="1" />
          <rect x="-3" y="0.6" width="1.6" height="1.8" rx=".4" fill="#ffc83b" />
          <rect x="-0.8" y="-0.9" width="1.6" height="3.3" rx=".4" fill="#ffc83b" />
          <rect x="1.4" y="-2.4" width="1.6" height="4.8" rx=".4" fill="#ffc83b" opacity=".35" />
        </g>
      )}
    </svg>
  )
}
