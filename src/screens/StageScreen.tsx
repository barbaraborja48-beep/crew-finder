import { useLayoutEffect, useRef, useState } from 'react'
import { store, useStore } from '../lib/store'
import { ageOf, dotOpacity, fraction, fresh, pinned } from '../lib/rules'
import { agoLong, CORNER, hasCloseUp, isLine, placeTitle, rowDip, TYPES, where, type Place, type PlaceType, type SquareShape } from '../lib/venue'
import { DjDisplay, DjSheet } from '../components/DjDisplay'
import { useNow, mySync, crewRows, statusOf, myHuddle, suggested, badgeFor } from '../lib/view'
import { Avatar, Scaled, SmsFallback, SyncPill } from '../components/common'
import { Penguin } from '../components/Penguin'
import { activityFor } from '../lib/penguin'
import { SuggestMark } from '../components/Social'

const W = 362
/** Buddies on one pin huddle on the close-up: each penguin overlaps its neighbour by about a third. */
const STEP = 19

/** Where one penguin stands in its huddle; the first one carries the group's names. */
interface Stand {
  dx: number
  dy: number
  z: number
  label?: string
  labelDx?: number
  hideLabel?: boolean
}
const SOLO: Stand = { dx: 0, dy: 0, z: 5 }

interface Spot {
  id: string
  group?: string // the pin a buddy group shares
  i: number // place in the group
  name: string
  x: number
  y: number
}

/**
 * Buddies sharing a pin stand as one huddle: the middle one in front, the outer ones a step
 * back (a bit higher), and a single line of names under them, left to right.
 */
function huddleLayout(spots: Spot[]) {
  const pos = new Map<string, Stand>()
  const glows: { key: string; x: number; y: number; w: number }[] = []
  const by = new Map<string, Spot[]>()
  for (const sp of spots) if (sp.group) by.set(sp.group, [...(by.get(sp.group) ?? []), sp])
  for (const [key, g] of by) {
    if (g.length < 2) continue
    g.sort((a, b) => a.i - b.i)
    const mid = (g.length - 1) / 2
    const names = g.map(sp => sp.name)
    const label = names.length > 3 ? `${names.slice(0, 2).join(', ')} +${names.length - 2}` : names.join(', ')
    g.forEach((sp, k) => {
      const dx = (k - mid) * STEP
      // the first penguin carries the names, moved back under the middle of the huddle
      pos.set(sp.id, { dx, dy: -Math.abs(k - mid) * 4, z: 10 - Math.round(Math.abs(k - mid) * 2), ...(k === 0 ? { label, labelDx: -dx } : { hideLabel: true }) })
    })
    glows.push({ key, x: g[0].x, y: g[0].y, w: (g.length - 1) * STEP })
  }
  return { pos, glows }
}
const GROUPS: PlaceType[] = ['stage', 'bar', 'food', 'picnic']

/** Close-up floor size: stages are tall, bars and trucks are wide and shallow. */
function floorHeight(p: Place) {
  const k = p.shape?.kind
  return k === 'counter' ? 260 : k === 'trucks' ? 240 : k === 'kiosk' ? 320 : k === 'tables' ? 300 : k === 'square' ? 362 : 420
}

const dashed = 'var(--color-neutral-800)'
const VLine = ({ at }: { at: string }) => <div style={{ position: 'absolute', left: at, top: 0, bottom: 0, borderLeft: `1px dashed ${dashed}`, pointerEvents: 'none' }} />
const HLine = ({ at }: { at: string }) => <div style={{ position: 'absolute', top: at, left: 0, right: 0, borderTop: `1px dashed ${dashed}`, pointerEvents: 'none' }} />
const Tag = ({ style, children }: { style: React.CSSProperties; children: React.ReactNode }) => (
  <div style={{ position: 'absolute', fontSize: 9, color: 'var(--color-neutral-700)', pointerEvents: 'none', letterSpacing: '.06em', ...style }}>{children}</div>
)
const solid = { background: 'linear-gradient(180deg, var(--color-accent-800), color-mix(in srgb, var(--color-accent-800) 40%, transparent))', boxShadow: '0 0 0 1.5px var(--color-accent-300), 0 6px 24px -8px var(--color-accent)', color: 'var(--color-accent-200)' }

/** Quick pins around a club dance floor (Mondo Disko): place id, label, where it sits. */
const CLUB_SPOTS: { id: string; label: string; icon: string; style: React.CSSProperties }[] = [
  { id: 'm-bar1', label: 'Bar', icon: 'ph ph-martini', style: { left: 8, top: '70%' } },
  { id: 'm-bar2', label: 'Bar', icon: 'ph ph-martini', style: { left: '17%', bottom: 8 } },
  { id: 'm-fuera', label: 'Outside / smoking', icon: 'ph ph-cigarette', style: { right: 8, bottom: 8 } },
]

/** Pin yourself somewhere in a spot (not all on the same pixel), with Undo. */
const pinSpot = (id: string) => {
  const j = () => 0.5 + (Math.random() - 0.5) * 0.4
  store.checkIn(id, j(), j(), true, true)
}

/** The tiles either side of the DJ screen. */
function SideTile({ id, icon, label, places }: { id: string; icon: string; label: string; places: Place[] }) {
  if (!places.some(p => p.id === id)) return <span style={{ width: 62, flex: 'none' }} />
  return (
    <button
      onClick={() => pinSpot(id)}
      aria-label={label}
      style={{ width: 62, flex: 'none', border: 0, cursor: 'pointer', borderRadius: '14px 14px 0 0', background: 'rgba(16,16,24,.95)', color: '#fff', boxShadow: 'inset 0 0 0 1px var(--color-accent-700), 0 0 14px -6px var(--color-accent)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6, font: '500 11px/1.15 var(--font-body)', textAlign: 'center', padding: '0 4px' }}
    >
      <i aria-hidden className={icon} style={{ fontSize: 20 }} />
      {label}
    </button>
  )
}

/** A club dance floor seen from the crowd: DJ at the top, rows curving around it, 3 columns. */
function ClubFloor({ sh, h, places }: { sh: SquareShape; h: number; places: Place[] }) {
  const [r1, r2] = sh.rows ?? [1 / 3, 2 / 3]
  const [c1, c2] = sh.cols ?? [1 / 3, 2 / 3]
  const cyan = 'color-mix(in srgb, #3bf0ff 60%, transparent)'
  const arc = (r: number) => {
    const pts = Array.from({ length: 21 }, (_, i) => i / 20).map(x => `${x * W},${(r + rowDip(sh, x)) * h}`)
    return `M${pts.join(' L')}`
  }
  const tag = (text: string, x: number, y: number) => (
    <div key={text + x + y} style={{ position: 'absolute', left: `${x * 100}%`, top: y * h, transform: 'translate(-50%, -50%)', font: '500 9px var(--font-body)', color: 'rgba(59,240,255,.5)', pointerEvents: 'none', whiteSpace: 'nowrap' }}>{text}</div>
  )
  const mid = (a: number, b: number, x: number) => (a + rowDip(sh, x) + b + rowDip(sh, x)) / 2
  return (
    <>
      <svg width={W} height={h} style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
        <path d={arc(r1)} fill="none" stroke={cyan} strokeWidth={1.5} />
        <path d={arc(r2)} fill="none" stroke={cyan} strokeWidth={1.5} />
        <line x1={c1 * W} y1={0} x2={c1 * W} y2={h} stroke={cyan} strokeWidth={1.5} />
        <line x1={c2 * W} y1={0} x2={c2 * W} y2={h} stroke={cyan} strokeWidth={1.5} />
        {/* the two spots either side of the DJ booth */}
        <rect x={2} y={2} width={CORNER * W} height={CORNER * h} rx={8} fill="rgba(59,240,255,.05)" stroke={cyan} strokeDasharray="3 3" />
        <rect x={W - CORNER * W - 2} y={2} width={CORNER * W} height={CORNER * h} rx={8} fill="rgba(59,240,255,.05)" stroke={cyan} strokeDasharray="3 3" />
      </svg>
      {[[c1 / 2, 'left'], [(c1 + c2) / 2, 'middle'], [(c2 + 1) / 2, 'right']].flatMap(([x, col]) => [
        tag(`front ${col}`, x as number, mid(0, r1, x as number) + (col === 'middle' ? 0 : 0.03)),
        tag(`middle ${col}`, x as number, mid(r1, r2, x as number)),
        tag(`back ${col}`, x as number, mid(r2, 1, x as number)),
      ])}
      {tag('front left corner', CORNER / 2 + 0.09, CORNER / 2)}
      {tag('front right corner', 1 - CORNER / 2 - 0.09, CORNER / 2)}
      {CLUB_SPOTS.filter(sp => places.some(p => p.id === sp.id)).map(sp => (
        <button
          key={sp.id + sp.label}
          onClick={e => {
            e.stopPropagation() // a spot button, not a tap on the floor
            pinSpot(sp.id)
          }}
          style={{ position: 'absolute', zIndex: 3, ...sp.style, border: 0, cursor: 'pointer', height: 28, padding: '0 10px', borderRadius: 999, background: 'rgba(10,10,16,.88)', color: '#fff', boxShadow: '0 0 0 1px var(--color-accent-600), 0 0 12px -4px var(--color-accent)', font: '500 11px var(--font-body)', display: 'flex', alignItems: 'center', gap: 5 }}
        >
          <i aria-hidden className={sp.icon} />
          {sp.label}
        </button>
      ))}
    </>
  )
}

/** What's drawn on the floor: the real thing at its relative size, plus zone guides. */
function FloorArt({ p, h, maxLen }: { p: Place; h: number; maxLen: number }) {
  const sh = p.shape
  if (!sh || sh.kind === 'square' || sh.kind === 'zone')
    return (
      <>
        <VLine at="33.3%" /><VLine at="66.6%" /><HLine at="33.3%" /><HLine at="66.6%" />
        <Tag style={{ left: 8, top: 6 }}>FRONT</Tag>
        <Tag style={{ left: 8, top: 'calc(66.6% + 6px)' }}>BACK</Tag>
        {!sh && <div style={{ position: 'absolute', right: 10, bottom: 10, fontSize: 16, color: 'var(--color-neutral-600)', pointerEvents: 'none' }}><i aria-hidden className="ph ph-martini" /></div>}
      </>
    )
  if (sh.kind === 'trucks')
    return (
      <>
        {Array.from({ length: 8 }, (_, i) => (
          <div key={i} style={{ position: 'absolute', left: (i * W) / 8 + 4, top: 10, width: W / 8 - 8, height: 34, borderRadius: 6, ...solid, display: 'grid', placeItems: 'center', font: '500 11px var(--font-body)', pointerEvents: 'none' }}>
            {i + 1}
          </div>
        ))}
        {Array.from({ length: 7 }, (_, i) => <VLine key={i} at={`${((i + 1) * 100) / 8}%`} />)}
        <Tag style={{ left: 8, bottom: 8 }}>QUEUE</Tag>
      </>
    )
  if (isLine(sh)) {
    // Bar counters drawn to scale against the longest one on the map.
    const cw = Math.max(90, Math.round(((W - 24) * sh.len) / maxLen))
    return (
      <>
        <div style={{ position: 'absolute', left: (W - cw) / 2, top: 12, width: cw, height: 28, borderRadius: 6, ...solid, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, fontSize: 10, letterSpacing: '.16em', pointerEvents: 'none' }}>
          <i aria-hidden className="ph ph-martini" />BAR
        </div>
        <VLine at="33.3%" /><VLine at="66.6%" />
        <Tag style={{ left: 8, bottom: 8 }}>LEFT END</Tag>
        <Tag style={{ left: '50%', bottom: 8, transform: 'translateX(-50%)' }}>MIDDLE</Tag>
        <Tag style={{ right: 8, bottom: 8 }}>RIGHT END</Tag>
        <Tag style={{ right: 8, top: 48 }}>{sh.len >= maxLen * 0.6 ? 'LONG BAR' : sh.len >= maxLen * 0.3 ? 'MEDIUM BAR' : 'SMALL BAR'}</Tag>
      </>
    )
  }
  // Kiosk bar or picnic area in the middle; you tap which side you're on.
  const size = Math.min(h - 120, Math.round(70 + sh.size * 1.2))
  const diag = Math.atan2(h, W) * (180 / Math.PI)
  return (
    <>
      {[diag, -diag].map(a => (
        <div key={a} style={{ position: 'absolute', left: '50%', top: '50%', width: Math.hypot(W, h), borderTop: `1px dashed ${dashed}`, transform: `translate(-50%, -50%) rotate(${a}deg)`, pointerEvents: 'none' }} />
      ))}
      <div style={{ position: 'absolute', left: (W - size) / 2, top: (h - size) / 2, width: size, height: size, borderRadius: sh.kind === 'kiosk' ? 10 : 18, ...(sh.kind === 'kiosk' ? solid : { boxShadow: '0 0 0 1px var(--color-neutral-700)', color: 'var(--color-neutral-400)' }), display: 'grid', placeItems: 'center', pointerEvents: 'none' }}>
        {sh.kind === 'kiosk' ? (
          <span style={{ fontSize: 10, letterSpacing: '.16em', display: 'flex', gap: 5, alignItems: 'center' }}><i aria-hidden className="ph ph-martini" />BAR</span>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6, fontSize: 22 }}>
            {Array.from({ length: 6 }, (_, i) => <i key={i} className="ph ph-picnic-table" />)}
          </div>
        )}
      </div>
      <Tag style={{ left: '50%', top: 8, transform: 'translateX(-50%)' }}>FRONT</Tag>
      <Tag style={{ left: '50%', bottom: 8, transform: 'translateX(-50%)' }}>BACK</Tag>
      <Tag style={{ left: 8, top: '50%' }}>LEFT</Tag>
      <Tag style={{ right: 8, top: '50%' }}>RIGHT</Tag>
    </>
  )
}

export function StageScreen() {
  const s = useStore()
  const now = useNow(250)
  const floorRef = useRef<HTMLDivElement>(null)
  const screenRef = useRef<HTMLDivElement>(null)
  const footRef = useRef<HTMLDivElement>(null)
  // Club floors stretch to fill the screen down to the footer, whatever the phone.
  const [fitH, setFitH] = useState<number | null>(null)
  useLayoutEffect(() => {
    const fit = () => {
      const scr = screenRef.current
      const floor = floorRef.current
      const foot = footRef.current
      if (!scr || !floor || !foot) return
      const tab = document.querySelector<HTMLElement>('nav.tabbar')
      const sr = scr.getBoundingClientRect()
      const fr = floor.getBoundingClientRect()
      const free = sr.height - (fr.top - sr.top + scr.scrollTop) - foot.offsetHeight - (tab?.offsetHeight ?? 0) - 16
      const h = Math.round(free / (fr.width / W))
      setFitH(prev => (prev === h ? prev : h))
    }
    fit()
    window.addEventListener('resize', fit)
    return () => window.removeEventListener('resize', fit)
  })
  const [ripple, setRipple] = useState<{ x: number; y: number; k: number } | null>(null)
  const [djOpen, setDjOpen] = useState(false)
  const closeUps = s.places.filter(hasCloseUp)
  const place = closeUps.find(p => p.id === s.ui.stage) ?? closeUps.find(p => p.type === 'stage')
  const rows = crewRows(s, now)
  const mine = store.myShownDot() // with your buddies, if you're in a group
  const meLive = pinned(mine, now)
  const me = store.me()
  const sync = mySync(s, now)

  if (!place) return <div className="screen" />
  // Club dance floors (Mondo) get the crowd's-eye layout with the DJ screen on top.
  const sq = place.shape?.kind === 'square' ? place.shape : null
  // Stage floors (the club's and every festival stage) fill the screen down to the footer, whatever
  // the phone, so they're all the same height and nothing hides under the tab bar.
  const H = place.type === 'stage' && fitH ? Math.min(760, Math.max(sq ? 330 : 300, fitH)) : floorHeight(place)
  // Festival lineups name each set's stage; a club's single lineup belongs to its dance floor.
  const lineup = (s.venue?.lineup ?? []).filter(x => (x.stage ? x.stage === place.id : !!sq))
  const festivalDj = !sq && place.type === 'stage' && lineup.length > 0
  const toX = (nx: number) => nx * W
  const toY = (ny: number) => ny * H
  const maxLen = Math.max(1, ...s.places.map(p => (p.shape && isLine(p.shape) && p.shape.kind === 'counter' ? p.shape.len : 0)))
  const siblings = closeUps.filter(p => p.type === place.type)
  const groups = GROUPS.filter(g => closeUps.some(p => p.type === g))
  const liveAt = (id: string) => rows.filter(r => r.fresh && r.dot!.place_id === id).length + (fresh(mine, now) && mine!.place_id === id ? 1 : 0)

  const onTap = (e: React.MouseEvent) => {
    const r = floorRef.current!.getBoundingClientRect()
    const [x, y] = [((e.clientX - r.left) / r.width) * W, ((e.clientY - r.top) / r.height) * H]
    const nx = Math.min(1, Math.max(0, x / W))
    const ny = Math.min(1, Math.max(0, y / H))
    store.checkIn(place.id, nx, ny)
    setRipple({ x: toX(nx), y: toY(ny), k: Date.now() })
    navigator.vibrate?.(15)
  }

  const here = rows.filter(r => r.live && r.dot!.place_id === place.id)
  const meHere = meLive && mine!.place_id === place.id
  const meH = me && !me.ghost ? myHuddle(s) : { i: 0, n: 1 }
  const huddles = huddleLayout([
    ...here.map(r => ({ id: r.member.id, group: r.huddle.n > 1 ? r.dot!.id : undefined, i: r.huddle.i, name: r.member.name, x: toX(r.dot!.nx), y: toY(r.dot!.ny) })),
    ...(meHere && me ? [{ id: me.id, group: meH.n > 1 ? mine!.id : undefined, i: meH.i, name: 'You', x: toX(mine!.nx), y: toY(mine!.ny) }] : []),
  ])
  const at = (id: string) => huddles.pos.get(id) ?? SOLO
  // The name under a penguin; in a huddle, one line of names under the middle (kept in place on the others so they line up).
  const nameLine = (id: string, name: string) => {
    const h = at(id)
    return (
      <span style={{ whiteSpace: 'nowrap', font: '500 10px var(--font-body)', color: '#fff', textShadow: '0 0 6px #000', visibility: h.hideLabel ? 'hidden' : undefined, transform: h.labelDx ? `translateX(${h.labelDx}px)` : undefined }}>
        {h.label ?? name}
      </span>
    )
  }
  const sent = !!mine && !s.pending[mine.id] && !me?.ghost
  const myLine = meLive ? where(store.place(mine!.place_id), mine!.nx, mine!.ny) : 'Not pinned'
  const mySub = meLive ? `Pinned ${agoLong(ageOf(mine!, now))} · pin again to update` : 'Pin where you are'
  const chipLabel = (p: Place) => (p.type === 'stage' || !p.near ? p.name : p.near)

  return (
    <div ref={screenRef} className="screen scroll no-scrollbar" style={{ paddingBottom: 'calc(var(--tabbar-h) + 12px)' }}>
      <div style={{ padding: 'var(--hdr-top) 20px 8px', display: 'flex', alignItems: 'center', gap: 10 }}>
        <button className="round" aria-label="Back to map" onClick={() => store.ui({ screen: 'map' })}>
          <i aria-hidden className="ph ph-caret-left" />
        </button>
        <div style={{ flex: 1, minWidth: 0 }}>
          {sq ? (
            // Club: just the night's name, like the layout guide
            <div className="title" style={{ fontSize: 24 }}>
              {(s.venue?.event_name ?? '').split(' ')[0]} <span className="dim">{(s.venue?.event_name ?? '').split(' ').slice(1).join(' ')}</span>
            </div>
          ) : (
            <>
              <div className="kicker">{place.floor ? `Planta ${place.floor} · ${TYPES[place.type][0]}` : place.type === 'stage' ? `Stage ${place.n}` : TYPES[place.type][0]}</div>
              <div style={{ fontSize: 20, fontWeight: 500, letterSpacing: '-.02em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{placeTitle(place)}</div>
            </>
          )}
        </div>
        <SyncPill sync={sync} />
      </div>

      {groups.length > 1 && (
        <div style={{ padding: '2px 20px 8px', display: 'flex' }}>
          <div style={{ display: 'flex', gap: 2, padding: 3, borderRadius: 'var(--radius-md)', boxShadow: 'var(--shadow-sm)', background: 'var(--color-surface)' }}>
            {groups.map(g => {
              const on = g === place.type
              return (
                <button
                  key={g}
                  onClick={() => {
                    const mineThere = meLive && store.place(mine!.place_id)?.type === g ? mine!.place_id : null
                    store.ui({ stage: mineThere ?? closeUps.find(p => p.type === g)!.id })
                  }}
                  style={{ border: 0, cursor: 'pointer', font: '500 12px var(--font-body)', padding: '6px 12px', borderRadius: 6, background: on ? 'var(--color-accent-800)' : 'transparent', color: on ? 'var(--color-accent-100)' : 'var(--color-neutral-400)', display: 'flex', alignItems: 'center', gap: 5 }}
                >
                  <i aria-hidden className={TYPES[g][1]} />
                  {g === 'stage' ? 'Stages' : g === 'bar' ? 'Bars' : g === 'food' ? 'Food' : 'Picnic'}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {siblings.length > 1 && (
        <div className="no-scrollbar" style={{ padding: '4px 20px 12px', display: 'flex', gap: 6, overflowX: 'auto', flex: 'none' }}>
          {siblings.map(p => {
            const on = p.id === place.id
            const c = liveAt(p.id)
            return (
              <button
                key={p.id}
                onClick={() => store.ui({ stage: p.id })}
                style={{ flex: 'none', border: 0, cursor: 'pointer', height: 30, padding: '0 11px', borderRadius: 999, font: '500 11px var(--font-body)', background: on ? 'var(--color-accent-900)' : 'transparent', color: on ? 'var(--color-accent-200)' : 'var(--color-neutral-300)', boxShadow: on ? '0 0 0 1px var(--color-accent)' : 'var(--shadow-sm)', display: 'flex', alignItems: 'center', gap: 5 }}
              >
                {chipLabel(p)}
                {c > 0 && <span style={{ fontSize: 10, color: 'var(--color-neutral-500)' }}>{c}</span>}
              </button>
            )
          })}
        </div>
      )}

      <div style={{ margin: '0 14px' }}>
        {sq && lineup.length > 0 && (
          <div style={{ display: 'flex', gap: 6, alignItems: 'stretch' }}>
            <SideTile id="m-wc1" icon="ph ph-toilet" label="WC" places={s.places} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <DjDisplay sets={lineup} now={now} onOpen={() => setDjOpen(true)} />
            </div>
            <SideTile id="m-balcon" icon="ph ph-stairs" label="I’m upstairs" places={s.places} />
          </div>
        )}
        {festivalDj && (
          <div style={{ marginBottom: 6 }}>
            <DjDisplay sets={lineup} now={now} onOpen={() => setDjOpen(true)} round />
          </div>
        )}
        {place.type === 'stage' && !(sq && lineup.length > 0) && (
          <div style={{ height: 28, borderRadius: 'var(--radius-md) var(--radius-md) 0 0', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, fontSize: 10, letterSpacing: '.16em', color: 'var(--color-accent-200)', background: 'linear-gradient(180deg, var(--color-accent-800), transparent)', borderBottom: '1.5px solid var(--color-accent-300)', boxShadow: '0 6px 24px -10px var(--color-accent)' }}>
            <i aria-hidden className="ph ph-speaker-hifi" />
            {place.floor ? 'DJ BOOTH' : 'STAGE'}
          </div>
        )}
        <Scaled w={W} h={H}>
          <div
            ref={floorRef}
            onClick={onTap}
            style={{ position: 'absolute', inset: 0, cursor: 'crosshair', overflow: 'hidden', background: 'radial-gradient(120% 55% at 50% 0%, color-mix(in srgb, var(--color-accent) 10%, transparent), transparent 70%)', borderRadius: place.type === 'stage' ? '0 0 var(--radius-lg) var(--radius-lg)' : 'var(--radius-lg)', boxShadow: 'var(--shadow-sm)' }}
          >
            <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', backgroundImage: 'linear-gradient(var(--color-neutral-900) 1px, transparent 1px), linear-gradient(90deg, var(--color-neutral-900) 1px, transparent 1px)', backgroundSize: '22px 22px', opacity: 0.55 }} />
            {sq ? <ClubFloor sh={sq} h={H} places={s.places} /> : <FloorArt p={place} h={H} maxLen={maxLen} />}

            {suggested(s, now).filter(sg => sg.placeId === place.id).map((sg, i) => {
              // Faded: where someone's probably heading (a planned move, or a friend's guess).
              const m = s.members.find(x => x.id === sg.memberId)
              if (!m || m.ghost) return null
              return (
                <div key={'s' + m.id} style={{ position: 'absolute', left: toX(sg.nx) + (i - 0.5) * 46, top: toY(sg.ny), transform: 'translate(-50%, -80%)', pointerEvents: 'none', opacity: 0.88, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  <span style={{ position: 'relative', display: 'block' }}>
                    <SuggestMark color={m.color} size={40} />
                    <Penguin color={m.color} acc={m.acc ?? 0} activity="walk" seed={m.id} size={30} glow={0.3} />
                  </span>
                  <span style={{ whiteSpace: 'nowrap', font: '600 10px var(--font-body)', color: m.color, textShadow: '0 0 6px #000' }}>{m.id === me?.id ? 'You' : m.name}?</span>
                </div>
              )
            })}

            {huddles.glows.map(g => (
              // Buddies standing together: a soft glow under the huddle, as on the map.
              <div key={'g' + g.key} style={{ position: 'absolute', left: g.x, top: g.y + 4, width: g.w + 44, height: 14, transform: 'translate(-50%, -50%)', borderRadius: '50%', background: 'radial-gradient(closest-side, color-mix(in srgb, var(--color-accent) 45%, transparent), transparent)', pointerEvents: 'none' }} />
            ))}

            {here.map(r => {
              const d = r.dot!
              const f = fraction(d, now)
              const size = 30 + Math.min(4, d.taps - 1) * 4
              const h = at(r.member.id)
              return (
                <button
                  key={r.member.id}
                  aria-label={r.member.name}
                  onClick={e => {
                    e.stopPropagation()
                    store.ui({ findId: r.member.id, screen: 'find' })
                  }}
                  style={{ position: 'absolute', left: toX(d.nx) + h.dx, top: toY(d.ny) + h.dy, zIndex: h.z, transform: 'translate(-50%, -80%)', border: 0, padding: 0, background: 'transparent', cursor: 'pointer', opacity: dotOpacity(f) * 0.4 + 0.6, display: 'flex', flexDirection: 'column', alignItems: 'center' }}
                >
                  <Penguin color={r.member.color} acc={r.member.acc ?? 0} activity={activityFor(place.type, r.member.status, r.fresh)} seed={r.member.id} size={size} glow={f} signal={r.member.net ?? null} saver={!!r.member.saver} />
                  {nameLine(r.member.id, r.member.name)}
                </button>
              )
            })}

            {meHere && me && (() => {
              const f = fraction(mine!, now)
              const size = 32 + Math.min(4, mine!.taps - 1) * 4
              const h = at(me.id)
              return (
                <div style={{ position: 'absolute', left: toX(mine!.nx) + h.dx, top: toY(mine!.ny) + h.dy, zIndex: h.z, transform: 'translate(-50%, -80%)', pointerEvents: 'none', opacity: 0.6 + 0.4 * f, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  <Penguin color={me.color} acc={me.acc ?? 0} activity={activityFor(place.type, me.status, fresh(mine, now))} seed={me.id} size={size} glow={f} signal={s.myNet} saver={s.dataSaver} queued={!sent} />
                  {nameLine(me.id, 'You')}
                </div>
              )
            })()}

            {ripple && (
              <div
                key={ripple.k}
                onAnimationEnd={() => setRipple(null)}
                style={{ position: 'absolute', left: ripple.x, top: ripple.y, width: 16, height: 16, borderRadius: '50%', border: '1.5px solid #3bf0ff', animation: 'ping .9s ease-out forwards', pointerEvents: 'none' }}
              />
            )}
          </div>
        </Scaled>
      </div>

      <div ref={footRef}>
        <div style={{ padding: '12px 20px 0', display: 'flex', alignItems: 'center', gap: 10 }}>
          {me && (
            <span style={{ opacity: meLive ? 1 : 0.45 }}>
              <Avatar name={me.name} color={me.color} acc={me.acc} size={34} badge={badgeFor(s, me, mine)} />
            </span>
          )}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 500 }}>{myLine}</div>
            <div style={{ fontSize: 11, color: 'var(--color-neutral-500)' }}>{mySub}</div>
          </div>
          <button className="btn btn-secondary" style={{ height: 34 }} onClick={() => store.ui({ sheet: true })}>
            <i aria-hidden className={me ? statusOf(me)[0] : 'ph-fill ph-smiley'} />
            Status
          </button>
        </div>
        <div style={{ padding: '10px 20px 0' }}>
          <SmsFallback />
        </div>
      </div>
      {djOpen && <DjSheet sets={lineup} now={now} onClose={() => setDjOpen(false)} stage={festivalDj ? place.id : undefined} />}
    </div>
  )
}
