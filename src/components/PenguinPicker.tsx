// Pick your penguin: any laser color (repeats are fine) and one accessory.
import { Penguin } from './Penguin'
import { ACCESSORIES } from '../lib/penguin'
import { LASERS, glow } from '../lib/venue'

export function PenguinPicker({ color, acc, onColor, onAcc, crewColors = [] }: { color: string; acc: number; onColor: (c: string) => void; onAcc: (a: number) => void; crewColors?: string[] }) {
  const lower = crewColors.map(c => c.toLowerCase())
  const label = { fontSize: 11, color: 'var(--color-neutral-500)' } as const
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={label}>Color · repeats are fine, accessories tell you apart</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
          {LASERS.map(c => {
            const on = color.toLowerCase() === c
            const used = lower.filter(x => x === c).length
            return (
              <button
                type="button"
                key={c}
                aria-label={`Color ${c}`}
                onClick={() => onColor(c)}
                style={{ position: 'relative', width: 34, height: 34, borderRadius: '50%', border: 0, cursor: 'pointer', background: 'transparent', boxShadow: on ? `0 0 0 2px ${c}, 0 0 16px -2px ${c}` : 'var(--shadow-sm)', display: 'grid', placeItems: 'center' }}
              >
                <span style={{ width: 16, height: 16, borderRadius: '50%', background: c, boxShadow: on ? glow(c, 0.5) : 'none' }} />
                {used > 0 && <span style={{ position: 'absolute', right: -3, top: -3, minWidth: 14, height: 14, borderRadius: 7, background: '#000', boxShadow: 'var(--shadow-sm)', fontSize: 9, lineHeight: '14px', color: 'var(--color-neutral-300)' }}>{used}</span>}
              </button>
            )
          })}
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
