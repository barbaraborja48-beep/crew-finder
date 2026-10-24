// Throwaway preview of the crew characters. Not part of the app.
import { createRoot } from 'react-dom/client'
import '@fontsource/inter/latin-400.css'
import '@fontsource/inter/latin-500.css'
import '@phosphor-icons/web/regular/style.css'
import './styles.css'
import { Character, ACTIVITY_LABEL, type Activity } from './components/Character'

const view = { s: 0.315, ox: 0, oy: -74 }
const at = (x: number, y: number) => ({ x: x * view.s + view.ox, y: y * view.s + view.oy })
const CREW: { name: string; color: string; x: number; y: number; a: Activity }[] = [
  { name: 'You', color: '#3bf0ff', x: 222, y: 860, a: 'dance' },
  { name: 'Ana', color: '#ff3bd4', x: 252, y: 875, a: 'dance' },
  { name: 'Leo', color: '#b6ff3b', x: 205, y: 900, a: 'dance' },
  { name: 'Mia', color: '#ffc83b', x: 92, y: 935, a: 'drink' },
  { name: 'Iker', color: '#ff8a3b', x: 520, y: 775, a: 'eat' },
  { name: 'Lu', color: '#a46bff', x: 205, y: 735, a: 'sit' },
  { name: 'Zed', color: '#ff3b5c', x: 1045, y: 470, a: 'lost' },
  { name: 'Sol', color: '#3bffb0', x: 880, y: 712, a: 'wait' },
  { name: 'Dani', color: '#3b8bff', x: 640, y: 560, a: 'sleep' },
]
const GALLERY: [Activity, string, string][] = [
  ['dance', '#ff3bd4', 'At a stage'],
  ['drink', '#b6ff3b', 'At a bar or water'],
  ['eat', '#ff8a3b', 'At the food trucks'],
  ['wait', '#3bffb0', 'At the WC'],
  ['sit', '#a46bff', 'Picnic or medical'],
  ['chill', '#3b8bff', 'Somewhere else'],
  ['lost', '#ff3b5c', 'Status: Lost'],
  ['walk', '#ffc83b', 'Status: Leaving'],
  ['sleep', '#f3f5fe', 'Check-in faded'],
]

function MapView({ zoom, cx, cy, animate, h = 346 }: { zoom: number; cx: number; cy: number; animate: boolean; h?: number }) {
  // zoom around an image point (cx, cy)
  const c = at(cx, cy)
  const tx = 195 - c.x * zoom
  const ty = h / 2 - c.y * zoom
  const chr = Math.pow(zoom, 0.75)
  return (
    <div style={{ position: 'relative', width: 390, height: h, overflow: 'hidden', borderRadius: 14, boxShadow: 'var(--shadow-sm)' }}>
      <div style={{ position: 'absolute', left: 0, top: 0, width: 390, height: 346, transform: `translate(${tx}px, ${ty}px) scale(${zoom})`, transformOrigin: '0 0' }}>
        <div style={{ position: 'absolute', inset: 0, width: 390, height: 346, background: `url(/assets/elrow-map.webp) ${view.ox}px ${view.oy}px / ${1214 * view.s}px auto no-repeat`, filter: 'saturate(.3) brightness(.5)' }} />
        {CREW.map(m => {
          const p = at(m.x, m.y)
          return (
            <div key={m.name} style={{ position: 'absolute', left: p.x, top: p.y, transform: `translate(-50%, -88%) scale(${chr / zoom})`, transformOrigin: '50% 88%' }}>
              <Character color={m.color} activity={m.a} seed={m.name} size={18} animate={animate} glow={m.a === 'sleep' ? 0 : 0.8} />
              {zoom > 1.5 && (
                <div style={{ position: 'absolute', left: '50%', top: '100%', transform: 'translateX(-50%)', marginTop: 1, fontSize: 7, fontWeight: 500, whiteSpace: 'nowrap', padding: '1px 5px', borderRadius: 999, background: 'rgba(22,24,38,.85)', color: 'var(--color-neutral-200)' }}>
                  {m.name}
                </div>
              )}
            </div>
          )
        })}
      </div>
      {zoom > 1 && (
        <div style={{ position: 'absolute', right: 10, bottom: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
          {['ph-plus', 'ph-minus', 'ph-arrows-in'].map(i => (
            <span key={i} className="round" style={{ width: 32, height: 32, fontSize: 14 }}><i aria-hidden className={`ph ${i}`} /></span>
          ))}
        </div>
      )}
    </div>
  )
}

const H = ({ children, sub }: { children: string; sub: string }) => (
  <div style={{ margin: '28px 0 10px' }}>
    <div style={{ fontSize: 18, fontWeight: 500 }}>{children}</div>
    <div style={{ fontSize: 12, color: 'var(--color-neutral-500)' }}>{sub}</div>
  </div>
)

function Preview() {
  return (
    <div style={{ width: 390, margin: '0 auto', padding: '24px 0 60px', color: 'var(--color-text)' }}>
      <div className="kicker">Preview · not in the app yet</div>
      <div className="title">Crew characters</div>

      <section id="gallery">
        <H sub="What each friend's character does, from where they checked in and their status">What they do</H>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
          {GALLERY.map(([a, c, where]) => (
            <div key={a} style={{ borderRadius: 14, background: 'var(--color-surface)', boxShadow: 'var(--shadow-sm)', padding: '14px 6px 10px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
              <Character color={c} activity={a} seed={a} size={52} />
              <div style={{ fontSize: 11, fontWeight: 500, textTransform: 'capitalize' }}>{ACTIVITY_LABEL[a]}</div>
              <div style={{ fontSize: 10, color: 'var(--color-neutral-500)', textAlign: 'center' }}>{where}</div>
            </div>
          ))}
        </div>
      </section>

      <section id="map-out">
        <H sub="Small characters instead of dots. Pinch or double-tap to zoom">Map, zoomed out</H>
        <MapView zoom={1} cx={600} cy={760} animate={false} />
      </section>

      <section id="map-in">
        <H sub="Zoomed in on elrow: your crew dancing, Mia at the bar, Lu at the picnic tables">Map, zoomed in</H>
        <MapView zoom={3.2} cx={190} cy={850} animate h={420} />
      </section>

      <section id="stage">
        <H sub="Tap a stage and everyone there dances at their spot">Stage close-up</H>
        <div style={{ position: 'relative', width: 362, height: 300, margin: '0 14px', borderRadius: 14, boxShadow: 'var(--shadow-sm)', overflow: 'hidden', background: 'radial-gradient(120% 55% at 50% 0%, color-mix(in srgb, var(--color-accent) 14%, transparent), transparent 70%)' }}>
          <div style={{ height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, fontSize: 10, letterSpacing: '.16em', color: 'var(--color-accent-200)', background: 'linear-gradient(180deg, var(--color-accent-800), transparent)', borderBottom: '1.5px solid var(--color-accent-300)' }}>
            <i aria-hidden className="ph ph-speaker-hifi" /> STAGE
          </div>
          {[
            ['You', '#3bf0ff', 0.3, 0.3, '2:12'],
            ['Ana', '#ff3bd4', 0.45, 0.25, '1:48'],
            ['Leo', '#b6ff3b', 0.7, 0.55, '2:30'],
          ].map(([n, c, x, y, t]) => (
            <div key={n as string} style={{ position: 'absolute', left: (x as number) * 362, top: (y as number) * 300 + 28, transform: 'translate(-50%, -50%)', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <Character color={c as string} activity="dance" seed={n as string} size={46} />
              <div style={{ fontSize: 10, fontWeight: 500, color: 'var(--color-neutral-200)' }}>{n} {t}</div>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}

createRoot(document.getElementById('root')!).render(<Preview />)
