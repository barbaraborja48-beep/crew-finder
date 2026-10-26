// A short intro to what PinGü does, shown once after you join (and from your profile any time).
// Four or five cards, swipe or tap Next, Skip whenever.
import { useRef, useState, type ReactNode } from 'react'
import { store, useStore } from '../lib/store'
import { Penguin } from './Penguin'

interface Card {
  title: string
  text: string
  art: ReactNode
}

const row = (children: ReactNode) => <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'center', gap: 6, height: 120 }}>{children}</div>

export function Tour() {
  const s = useStore()
  const scroller = useRef<HTMLDivElement>(null)
  const [page, setPage] = useState(0)
  if (!s.tour || s.phase !== 'ready') return null
  const me = s.members.find(m => m.id === s.session?.memberId)
  const c = me?.color ?? '#a98bff'
  const acc = me?.acc ?? 0
  const festival = (s.venue?.lineup ?? []).some(x => x.stage)

  const cards: Card[] = [
    {
      title: 'Tap where you are',
      text: 'Pin your spot on the map or a stage. Your penguin appears on your crew’s map, and waits for signal if it has to.',
      art: row(
        <div style={{ position: 'relative' }}>
          <Penguin color={c} acc={acc} activity="dance" seed="tour-1" size={78} signal={3} />
          <i aria-hidden className="ph-fill ph-map-pin" style={{ position: 'absolute', right: -18, top: -6, fontSize: 30, color: c, filter: `drop-shadow(0 0 8px ${c})` }} />
        </div>,
      ),
    },
    {
      title: 'Your crew, as penguins',
      text: 'They dance at stages, drink at bars and doze when a pin gets old. The faster they dance, the better their signal.',
      art: row(
        <>
          <Penguin color="#ff3bd4" acc={6} activity="dance" seed="tour-2a" size={54} signal={3} />
          <Penguin color="#b6ff3b" acc={1} activity="drink" seed="tour-2b" size={54} signal={2} />
          <Penguin color="#ffc83b" acc={4} activity="sleep" seed="tour-2c" size={54} />
        </>,
      ),
    },
    {
      title: 'Move together',
      text: 'Buddy up and your group moves as one. Plan a move like “WC in 10 min” and you’ll both be reminded to meet there.',
      art: row(
        <div style={{ position: 'relative', display: 'flex', alignItems: 'flex-end', gap: 2 }}>
          <div style={{ position: 'absolute', left: '50%', bottom: 2, width: 170, height: 18, transform: 'translateX(-50%)', borderRadius: '50%', background: `radial-gradient(closest-side, color-mix(in srgb, ${c} 45%, transparent), transparent)` }} />
          <Penguin color={c} acc={acc} activity="dance" seed="tour-3a" size={56} signal={3} />
          <Penguin color="#a46bff" acc={12} activity="dance" seed="tour-3b" size={56} signal={3} />
          <Penguin color="#3bffb0" acc={10} activity="dance" seed="tour-3c" size={56} signal={3} />
        </div>,
      ),
    },
    ...(festival
      ? [
          {
            title: 'Never miss a set',
            text: 'Every stage shows who’s on now. Star the sets you want, pick a reminder, and see your night in order.',
            art: row(
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <Penguin color={c} acc={acc} activity="dance" seed="tour-4" size={64} signal={3} />
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {[['20.00H', 'Kölsch', true], ['22.00H', 'Maceo Plex', true], ['00.00H', 'Colyn', false]].map(([t, n, on]) => (
                    <div key={n as string} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', borderRadius: 10, background: 'rgba(255,255,255,.06)', boxShadow: 'inset 0 0 0 1px rgba(255,255,255,.1)', font: '500 12px var(--font-body)' }}>
                      <span style={{ color: 'var(--color-neutral-400)', fontVariantNumeric: 'tabular-nums' }}>{t}</span>
                      <span style={{ flex: 1 }}>{n}</span>
                      <i aria-hidden className={on ? 'ph-fill ph-star' : 'ph ph-star'} style={{ color: on ? '#ffc83b' : 'var(--color-neutral-500)' }} />
                    </div>
                  ))}
                </div>
              </div>,
            ),
          },
        ]
      : []),
    {
      title: 'Bad signal? Still works',
      text: 'Switch on low data mode when it’s packed. No data at all? Text your spot instead. Hold SOS if you need help.',
      art: row(
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 18 }}>
          <Penguin color={c} acc={acc} activity="dance" seed="tour-5" size={68} signal={1} saver />
          <div style={{ width: 54, height: 54, borderRadius: '50%', display: 'grid', placeItems: 'center', marginBottom: 14, boxShadow: '0 0 0 1px #ff5c7a88, 0 0 24px -6px #ff3b5c', color: 'var(--sos-text)', fontSize: 26 }}>
            <i aria-hidden className="ph-bold ph-siren" />
          </div>
        </div>,
      ),
    },
  ]
  const last = page >= cards.length - 1
  const go = (i: number) => scroller.current?.scrollTo({ left: i * scroller.current.clientWidth, behavior: 'smooth' })

  return (
    <div role="dialog" aria-label="Welcome to PinGü" className="screen" style={{ zIndex: 30, background: `radial-gradient(80% 50% at 50% 38%, color-mix(in srgb, ${c} 22%, #000), #000 72%)` }}>
      <div style={{ padding: 'var(--hdr-top) 20px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 15, fontWeight: 600, letterSpacing: '-.02em' }}>PinGü</span>
        <button className="btn btn-ghost" style={{ height: 34, color: 'var(--color-neutral-300)' }} onClick={() => store.closeTour()}>
          Skip
        </button>
      </div>
      <div
        ref={scroller}
        className="no-scrollbar"
        onScroll={e => setPage(Math.round(e.currentTarget.scrollLeft / e.currentTarget.clientWidth))}
        style={{ flex: 1, display: 'flex', overflowX: 'auto', scrollSnapType: 'x mandatory', overscrollBehaviorX: 'contain' }}
      >
        {cards.map(card => (
          <section key={card.title} style={{ flex: '0 0 100%', scrollSnapAlign: 'start', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 28, padding: '0 32px' }}>
            {card.art}
            <div style={{ textAlign: 'center' }}>
              <div className="title" style={{ fontSize: 28 }}>{card.title}</div>
              <div style={{ marginTop: 10, fontSize: 15, lineHeight: 1.45, color: 'var(--color-neutral-300)' }}>{card.text}</div>
            </div>
          </section>
        ))}
      </div>
      <div style={{ padding: '0 24px calc(var(--safe-bottom) + 24px)', display: 'flex', flexDirection: 'column', gap: 16, alignItems: 'center' }}>
        <div className="dj-dots" aria-hidden style={{ padding: 0 }}>
          {cards.map((card, i) => (
            <i key={card.title} className={i === page ? 'on' : ''} />
          ))}
        </div>
        <button className="btn btn-primary btn-block" style={{ height: 50, alignSelf: 'stretch' }} onClick={() => (last ? store.closeTour() : go(page + 1))}>
          {last ? 'Let’s go' : 'Next'}
        </button>
      </div>
    </div>
  )
}
