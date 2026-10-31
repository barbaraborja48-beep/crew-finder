import { useLayoutEffect, useRef, useState } from 'react'
import { store, useStore } from '../lib/store'
import { ageOf, dotOpacity, fraction, fresh, pinned } from '../lib/rules'
import { agoLong, CORNER, fanToGrid, gridToFan, gridY, HALLOWEEN_ID, hasCloseUp, isLine, placeTitle, rowDip, TYPES, where, type FanShape, type Place, type PlaceType, type SquareShape } from '../lib/venue'
import { DjDisplay, DjSheet } from '../components/DjDisplay'
import { useNow, mySync, crewRows, statusOf, myHuddle, suggested, badgeFor } from '../lib/view'
import { Avatar, Scaled, SmsFallback, SyncPill } from '../components/common'
import { Penguin } from '../components/Penguin'
import { activityFor } from '../lib/penguin'
import { SuggestMark } from '../components/Social'

const W = 362
/** Buddies on one pin stand side by side on the close-up, a name's width apart. */
const huddleX = (h: { i: number; n: number }) => (h.n > 1 ? (h.i - (h.n - 1) / 2) * 46 : 0)
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

/** The tiles either side of the DJ screen. pin: how to pin (default: somewhere in the spot). */
function SideTile({ id, icon, label, places, pin }: { id: string; icon: string; label: string; places: Place[]; pin?: () => void }) {
  if (!places.some(p => p.id === id)) return <span style={{ width: 62, flex: 'none' }} />
  return (
    <button
      onClick={() => (pin ? pin() : pinSpot(id))}
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

/** Pin by a spot's own icon (the rest area's isn't in the middle of the room), with Undo. */
const pinByIcon = (p: Place) => {
  const sh = p.shape?.kind === 'zone' ? p.shape : null
  if (!sh) return pinSpot(p.id)
  const j = () => (Math.random() - 0.5) * 0.08
  store.checkIn(p.id, (p.x - sh.cx) / sh.w + 0.5 + j(), (p.y - sh.cy) / sh.h + 0.5 + j(), true, true)
}

/** Buttons around the open-air floor (Mondo Krystal at Jowke), like Sala But's. */
const FAN_SPOTS: { id: string; label: string; icon: string; style: React.CSSProperties }[] = [
  { id: 'j-bar1', label: 'Bar', icon: 'ph ph-martini', style: { right: 8, top: '37%' } },
  { id: 'j-fuera', label: 'Outside', icon: 'ph ph-cigarette', style: { right: 8, bottom: 8 } },
]

/**
 * The open-air floor (Mondo Krystal at Jowke) drawn like Sala But's: DJ at the top, Barbara's rows
 * (front front … back back: her rings around the DJ, unrolled) curving across, her three columns,
 * and buttons around the edge. No names in the cells (she asked); you see yours once pinned. The small bar by the DJ is a "Bar" button on the left that pins you
 * on the floor there ("front left · by bar").
 */
function GridFloor({ sh, h, places }: { sh: FanShape; h: number; places: Place[] }) {
  const g = sh.grid!
  const n = sh.rows.length
  const cyan = 'color-mix(in srgb, #3bf0ff 60%, transparent)'
  const line = (d: number) => `M${Array.from({ length: 21 }, (_, i) => i / 20).map(x => `${x * W},${gridY(g, x, d) * h}`).join(' L')}`
  const pill = (key: string, label: string, icon: string, style: React.CSSProperties, onClick: () => void) => (
    <button
      key={key}
      onClick={e => {
        e.stopPropagation() // a spot button, not a tap on the floor
        onClick()
      }}
      style={{ position: 'absolute', zIndex: 3, ...style, border: 0, cursor: 'pointer', height: 28, padding: '0 10px', borderRadius: 999, background: 'rgba(10,10,16,.88)', color: '#fff', boxShadow: '0 0 0 1px var(--color-accent-600), 0 0 12px -4px var(--color-accent)', font: '500 11px var(--font-body)', display: 'flex', alignItems: 'center', gap: 5, transform: style.top != null ? 'translateY(-50%)' : undefined }}
    >
      <i aria-hidden className={icon} />
      {label}
    </button>
  )
  const byBar = (sh.near ?? [])[0]
  return (
    <>
      <svg width={W} height={h} style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
        {Array.from({ length: n - 1 }, (_, i) => <path key={i} d={line((i + 1) / n)} fill="none" stroke={cyan} strokeWidth={1.5} />)}
        <line x1={W / 3} y1={0} x2={W / 3} y2={h} stroke={cyan} strokeWidth={1.5} />
        <line x1={(2 * W) / 3} y1={0} x2={(2 * W) / 3} y2={h} stroke={cyan} strokeWidth={1.5} />
      </svg>
      {byBar &&
        // between the front and center rows, so it doesn't sit on their names
        pill('by-bar', 'Bar', 'ph ph-martini', { left: 8, top: gridY(g, 0.05, 2 / n) * h }, () => {
          const j = () => (Math.random() - 0.5) * 0.3
          const [x, y] = [byBar.x + byBar.w * (0.5 + j()), byBar.y + byBar.h * (0.5 + j())]
          // a new spot on the dance floor, even if you're already pinned on it
          store.checkIn(places.find(p => p.shape === sh)?.id ?? 'j-pista', (x - sh.x) / sh.w, (y - sh.y) / sh.h, false, true)
        })}
      {FAN_SPOTS.filter(sp => places.some(p => p.id === sp.id)).map(sp =>
        pill(sp.id, sp.label, sp.icon, sp.id === 'j-bar1' ? { ...sp.style, top: gridY(g, 0.95, 2 / n) * h } : sp.style, () => pinSpot(sp.id)),
      )}
    </>
  )
}

/** What's drawn on the floor: the real thing at its relative size, plus zone guides. */
function FloorArt({ p, h, maxLen }: { p: Place; h: number; maxLen: number }) {
  const sh = p.shape
  if (!sh || sh.kind === 'square' || sh.kind === 'zone' || sh.kind === 'fan')
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
  // The open-air floor (Jowke) gets the same layout, on Barbara's grid (its spots live on the map's box).
  const fan = place.shape?.kind === 'fan' && place.shape.grid ? place.shape : null
  const club = !!(sq || fan)
  // Stage floors (the club's and every festival stage) fill the screen down to the footer, whatever
  // the phone, so they're all the same height and nothing hides under the tab bar.
  const H = place.type === 'stage' && fitH ? Math.min(760, Math.max(club ? 330 : 300, fitH)) : floorHeight(place)
  // Festival lineups name each set's stage; a club's single lineup belongs to its dance floor.
  const lineup = (s.venue?.lineup ?? []).filter(x => (x.stage ? x.stage === place.id : club))
  const festivalDj = !club && place.type === 'stage' && lineup.length > 0
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
    // Open-air floor: the grid spot → the same spot on the map's floor.
    if (fan) store.checkIn(place.id, ...gridToFan(fan, nx, ny))
    else store.checkIn(place.id, nx, ny)
    setRipple({ x: toX(nx), y: toY(ny), k: Date.now() })
    navigator.vibrate?.(15)
  }

  // Where a pin sits on this close-up (0–1), or null if it isn't on it. Open-air floor: from the
  // map's floor to Barbara's grid.
  const spotOf = (placeId: string, nx: number, ny: number) => {
    if (placeId !== place.id) return null
    if (!fan) return { nx, ny }
    const [gx, gy] = fanToGrid(fan, nx, ny)
    return { nx: gx, ny: gy }
  }
  // Spots with a button under this floor (zone "of" this place), rest area first.
  const ORDER: PlaceType[] = ['rest', 'wc', 'water']
  const tiles = s.places
    .filter(p => !fan && p.shape?.kind === 'zone' && p.shape.of === place.id)
    .sort((a, b) => ORDER.indexOf(a.type) - ORDER.indexOf(b.type) || a.name.localeCompare(b.name))
  const here = rows.filter(r => r.live && spotOf(r.dot!.place_id, r.dot!.nx, r.dot!.ny))
  const meHere = meLive && !!spotOf(mine!.place_id, mine!.nx, mine!.ny)
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
          {club ? (
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
        {fan && lineup.length > 0 && (
          // like Sala But: WC / water and the way inside either side of the DJ screen
          <div style={{ display: 'flex', gap: 6, alignItems: 'stretch' }}>
            <SideTile id="j-wc2" icon="ph ph-toilet" label="WC / water" places={s.places} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <DjDisplay sets={lineup} now={now} onOpen={() => setDjOpen(true)} fit />
            </div>
            <SideTile id="j-dentro" icon={TYPES.rest[1]} label="Inside / rest" places={s.places} pin={() => pinByIcon(store.place('j-dentro')!)} />
          </div>
        )}
        {sq && lineup.length > 0 && (
          <div style={{ display: 'flex', gap: 6, alignItems: 'stretch' }}>
            <SideTile id="m-wc1" icon="ph ph-toilet" label="WC" places={s.places} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <DjDisplay sets={lineup} now={now} onOpen={() => setDjOpen(true)} fit />
            </div>
            <SideTile id="m-balcon" icon="ph ph-stairs" label="I’m upstairs" places={s.places} />
          </div>
        )}
        {festivalDj && (
          <div style={{ marginBottom: 6 }}>
            <DjDisplay sets={lineup} now={now} onOpen={() => setDjOpen(true)} round fit={s.venue?.id !== HALLOWEEN_ID} />
          </div>
        )}
        {place.type === 'stage' && !(club && lineup.length > 0) && (
          <div style={{ height: 28, borderRadius: 'var(--radius-md) var(--radius-md) 0 0', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, fontSize: 10, letterSpacing: '.16em', color: 'var(--color-accent-200)', background: 'linear-gradient(180deg, var(--color-accent-800), transparent)', borderBottom: '1.5px solid var(--color-accent-300)', boxShadow: '0 6px 24px -10px var(--color-accent)' }}>
            <i aria-hidden className="ph ph-speaker-hifi" />
            {place.floor || fan ? 'DJ BOOTH' : 'STAGE'}
          </div>
        )}
        <Scaled w={W} h={H}>
          <div
            ref={floorRef}
            onClick={onTap}
            style={{ position: 'absolute', inset: 0, cursor: 'crosshair', overflow: 'hidden', background: 'radial-gradient(120% 55% at 50% 0%, color-mix(in srgb, var(--color-accent) 10%, transparent), transparent 70%)', borderRadius: place.type === 'stage' ? '0 0 var(--radius-lg) var(--radius-lg)' : 'var(--radius-lg)', boxShadow: 'var(--shadow-sm)' }}
          >
            <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', backgroundImage: 'linear-gradient(var(--color-neutral-900) 1px, transparent 1px), linear-gradient(90deg, var(--color-neutral-900) 1px, transparent 1px)', backgroundSize: '22px 22px', opacity: 0.55 }} />
            {fan ? <GridFloor sh={fan} h={H} places={s.places} /> : sq ? <ClubFloor sh={sq} h={H} places={s.places} /> : <FloorArt p={place} h={H} maxLen={maxLen} />}

            {suggested(s, now).filter(sg => sg.placeId === place.id).map((sg, i) => {
              // Faded: where someone's probably heading (a planned move, or a friend's guess).
              const m = s.members.find(x => x.id === sg.memberId)
              if (!m || m.ghost) return null
              const sp = spotOf(sg.placeId, sg.nx, sg.ny)!
              return (
                <div key={'s' + m.id} style={{ position: 'absolute', left: toX(sp.nx) + (i - 0.5) * 46, top: toY(sp.ny), transform: 'translate(-50%, -80%)', pointerEvents: 'none', opacity: 0.88, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  <span style={{ position: 'relative', display: 'block' }}>
                    <SuggestMark color={m.color} size={40} />
                    <Penguin color={m.color} acc={m.acc ?? 0} activity="walk" seed={m.id} size={30} glow={0.3} />
                  </span>
                  <span style={{ whiteSpace: 'nowrap', font: '600 10px var(--font-body)', color: m.color, textShadow: '0 0 6px #000' }}>{m.id === me?.id ? 'You' : m.name}?</span>
                </div>
              )
            })}

            {here.map(r => {
              const d = r.dot!
              const f = fraction(d, now)
              const size = 30 + Math.min(4, d.taps - 1) * 4
              return (
                <button
                  key={r.member.id}
                  aria-label={r.member.name}
                  onClick={e => {
                    e.stopPropagation()
                    store.ui({ findId: r.member.id, screen: 'find' })
                  }}
                  style={{ position: 'absolute', left: toX(spotOf(d.place_id, d.nx, d.ny)!.nx) + huddleX(r.huddle), top: toY(spotOf(d.place_id, d.nx, d.ny)!.ny), transform: 'translate(-50%, -80%)', border: 0, padding: 0, background: 'transparent', cursor: 'pointer', opacity: dotOpacity(f) * 0.4 + 0.6, display: 'flex', flexDirection: 'column', alignItems: 'center' }}
                >
                  <Penguin color={r.member.color} acc={r.member.acc ?? 0} activity={activityFor(store.place(d.place_id)?.type, r.member.status, r.fresh)} seed={r.member.id} size={size} glow={f} signal={r.member.net ?? null} saver={!!r.member.saver} />
                  <span style={{ whiteSpace: 'nowrap', font: '500 10px var(--font-body)', color: '#fff', textShadow: '0 0 6px #000' }}>
                    {r.member.name}
                  </span>
                </button>
              )
            })}

            {meHere && me && (() => {
              const f = fraction(mine!, now)
              const size = 32 + Math.min(4, mine!.taps - 1) * 4
              return (
                <div style={{ position: 'absolute', left: toX(spotOf(mine!.place_id, mine!.nx, mine!.ny)!.nx) + huddleX(me.ghost ? { i: 0, n: 1 } : myHuddle(s)), top: toY(spotOf(mine!.place_id, mine!.nx, mine!.ny)!.ny), transform: 'translate(-50%, -80%)', pointerEvents: 'none', opacity: 0.6 + 0.4 * f, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  <Penguin color={me.color} acc={me.acc ?? 0} activity={activityFor(store.place(mine!.place_id)?.type, me.status, fresh(mine, now))} seed={me.id} size={size} glow={f} signal={s.myNet} saver={s.dataSaver} queued={!sent} />
                  <span style={{ whiteSpace: 'nowrap', font: '500 10px var(--font-body)', color: '#fff', textShadow: '0 0 6px #000' }}>
                    You
                  </span>
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
        {tiles.length > 0 && (
          // Buttons under the floor for the spots that belong to it: Hallowfest's WC and water by each stage.
          <div style={{ display: 'flex', gap: 6, padding: '6px 14px 0' }}>
            {tiles.map(t => (
              <button
                key={t.id}
                onClick={() => pinByIcon(t)}
                style={{ flex: 1, minWidth: 0, height: 46, border: 0, cursor: 'pointer', borderRadius: 'var(--radius-md)', background: 'rgba(16,16,24,.95)', color: '#fff', boxShadow: 'inset 0 0 0 1px var(--color-accent-700), 0 0 14px -6px var(--color-accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, font: '500 13px var(--font-body)', whiteSpace: 'nowrap' }}
              >
                <i aria-hidden className={TYPES[t.type][1]} style={{ fontSize: 18 }} />
                {t.name}
              </button>
            ))}
          </div>
        )}
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
