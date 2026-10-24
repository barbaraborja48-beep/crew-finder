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
    default:
      return null
  }
}

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
  saver: _saver = false,
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
  saver?: boolean // unused since low-signal mode became the only mode
}) {
  const id = useId().replace(/:/g, '')
  const dark = `color-mix(in srgb, ${color} 60%, #07070b)`
  const delay = `-${(phase(seed) * 2).toFixed(2)}s`
  const k = signal == null ? 1 : SPEED[Math.max(0, Math.min(3, signal))]
  const idle = activity === 'sleep'
  const eyesHidden = acc === 1 || acc === 2 || acc === 3
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
    </svg>
  )
}
