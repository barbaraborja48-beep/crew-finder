// Pick your penguin: any laser color (repeats are fine) and one accessory.
import { Penguin } from './Penguin'
import { ACCESSORIES } from '../lib/penguin'
import { LASERS, glow } from '../lib/venue'

export function PenguinPicker({ color, acc, onColor, onAcc, crewColors = [] }: { color: string; acc: number; onColor: (c: string) => void; onAcc: (a: number) => void; crewColors?: string[] }) {
  const lower = crewColors.map(c => c.toLowerCase())
  const custom = !LASERS.includes(color.toLowerCase())
  const label = { fontSize: 11, color: 'var(--color-neutral-500)' } as const
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={label}>Select your PinGü color</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(9, minmax(28px, 34px))', justifyContent: 'space-between', rowGap: 10 }}>
          {LASERS.map(c => {
            const on = color.toLowerCase() === c
            const used = lower.filter(x => x === c).length
            return (
              <button
                type="button"
                key={c}
                aria-label={`Color ${c}`}
                onClick={() => onColor(c)}
                style={{ position: 'relative', width: '100%', aspectRatio: '1', borderRadius: '50%', border: 0, cursor: 'pointer', background: 'transparent', boxShadow: on ? `0 0 0 2px ${c}, 0 0 16px -2px ${c}` : 'var(--shadow-sm)', display: 'grid', placeItems: 'center' }}
              >
                <span style={{ width: 16, height: 16, borderRadius: '50%', background: c, boxShadow: on ? glow(c, 0.5) : 'none' }} />
                {used > 0 && <span style={{ position: 'absolute', right: -3, top: -3, minWidth: 14, height: 14, borderRadius: 7, background: '#000', boxShadow: 'var(--shadow-sm)', fontSize: 9, lineHeight: '14px', color: 'var(--color-neutral-300)' }}>{used}</span>}
              </button>
            )
          })}
          {/* Any color you like. Very dark picks are lifted so your penguin still shows on the map. */}
          <label
            aria-label="Pick your own color"
            title="Pick your own color"
            style={{ position: 'relative', width: '100%', aspectRatio: '1', borderRadius: '50%', cursor: 'pointer', background: 'conic-gradient(#ff3b5c, #ffc83b, #b6ff3b, #3bffb0, #4cc3ff, #5b4bff, #ff3bd4, #ff3b5c)', boxShadow: custom ? `0 0 0 2px ${color}, 0 0 16px -2px ${color}` : 'var(--shadow-sm)', display: 'grid', placeItems: 'center' }}
          >
            <span style={{ width: '46%', height: '46%', borderRadius: '50%', background: custom ? color : '#0d0d13', boxShadow: '0 0 0 2px #0d0d13', display: 'grid', placeItems: 'center', color: '#fff', fontSize: 11 }}>
              {!custom && <i aria-hidden className="ph-bold ph-plus" />}
            </span>
            <input type="color" value={color} onChange={e => onColor(visible(e.target.value))} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0, cursor: 'pointer', border: 0, padding: 0 }} />
          </label>
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={label}>Accessory</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 6 }}>
          {ACCESSORIES.map((a, i) => {
            const on = acc === i
            return (
              <button
                type="button"
                key={a}
                aria-label={`Accessory ${a}`}
                aria-pressed={on}
                onClick={() => onAcc(i)}
                style={{ border: 0, cursor: 'pointer', borderRadius: 14, padding: '6px 0 4px', background: on ? 'color-mix(in srgb, var(--color-accent-600) 18%, transparent)' : 'var(--color-glass)', boxShadow: on ? '0 0 0 1px var(--color-accent-400), 0 0 18px -8px var(--color-accent)' : 'var(--shadow-sm)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}
              >
                <Penguin color={color} activity="chill" seed={a} size={30} acc={i} animate={false} />
                <span style={{ fontSize: 8.5, color: on ? '#fff' : 'var(--color-neutral-400)', whiteSpace: 'nowrap' }}>{a}</span>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}

/** A color friends can see on a black map: same hue, but never darker than mid-bright. */
function visible(hex: string) {
  const n = parseInt(hex.slice(1), 16)
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map(v => v / 255)
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const l = (max + min) / 2
  if (l >= 0.55) return hex.toLowerCase()
  // lift the lightness to 55% (HSL), keeping hue and saturation
  const d = max - min
  const sat = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1))
  const h = d === 0 ? 0 : max === r ? ((g - b) / d + 6) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4
  const c = (1 - Math.abs(2 * 0.55 - 1)) * sat
  const x = c * (1 - Math.abs((h % 2) - 1))
  const [r1, g1, b1] = h < 1 ? [c, x, 0] : h < 2 ? [x, c, 0] : h < 3 ? [0, c, x] : h < 4 ? [0, x, c] : h < 5 ? [x, 0, c] : [c, 0, x]
  const m = 0.55 - c / 2
  return '#' + [r1, g1, b1].map(v => Math.round((v + m) * 255).toString(16).padStart(2, '0')).join('')
}
