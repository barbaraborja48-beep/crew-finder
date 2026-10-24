// The DJ screen on the dance floor: who's playing right now, on a slow lava-lamp aura.
// Runs off the phone's clock (corrected by the server's), so it needs no data at all.
import { useState } from 'react'

export interface DjSet {
  name: string
  start: string // ISO with offset, e.g. 2026-10-25T02:00:00+02:00
  end: string
}

const TZ = 'Europe/Madrid'
const hhmm = (iso: string) =>
  new Intl.DateTimeFormat('es-ES', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: TZ }).format(new Date(iso)).replace(':', '.') + 'H'
const dayTag = (iso: string) => {
  // Club nights are named after the evening they start: a 00.00H set on Sunday is "SÁB".
  const d = new Date(new Date(iso).getTime() - 6 * 3600_000)
  const p = new Intl.DateTimeFormat('es-ES', { weekday: 'short', day: 'numeric', timeZone: TZ }).formatToParts(d)
  const wd = (p.find(x => x.type === 'weekday')?.value ?? '').replace('.', '').toUpperCase()
  return { wd, day: p.find(x => x.type === 'day')?.value ?? '' }
}
const ms = (iso: string) => new Date(iso).getTime()

export function lineupState(sets: DjSet[], now: number) {
  const sorted = [...sets].sort((a, b) => ms(a.start) - ms(b.start))
  const current = sorted.find(s => ms(s.start) <= now && now < ms(s.end)) ?? null
  const next = sorted.find(s => ms(s.start) > now) ?? null
  return { sorted, current, next, over: !!sorted.length && now >= ms(sorted[sorted.length - 1].end) }
}

const countdown = (s: number) => {
  s = Math.max(0, Math.floor(s))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  return h ? `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}` : `${m}:${String(sec).padStart(2, '0')}`
}

/** 1140 s → "19 MIN", 4800 s → "1 H 20 MIN" */
const inWords = (s: number) => {
  const m = Math.max(1, Math.ceil(s / 60))
  return m < 60 ? `${m} MIN` : `${Math.floor(m / 60)} H${m % 60 ? ` ${m % 60} MIN` : ''}`
}

/** Slow blurred colour blobs, like a lava lamp lit by aura colours. */
function Aura({ calm = false }: { calm?: boolean }) {
  return (
    <div className={`lava ${calm ? 'calm' : ''}`} aria-hidden>
      <i className="b1" />
      <i className="b2" />
      <i className="b3" />
      <i className="b4" />
      <i className="b5" />
    </div>
  )
}

export function DjDisplay({ sets, now, onOpen }: { sets: DjSet[]; now: number; onOpen: () => void }) {
  const { current, next, over } = lineupState(sets, now)
  const shown = current ?? next
  const f = current ? (now - ms(current.start)) / (ms(current.end) - ms(current.start)) : 0
  const tag = shown ? dayTag(shown.start) : null
  return (
    <button className="dj" onClick={onOpen} aria-label={current ? `Now playing: ${current.name}. Show set times` : 'Show set times'}>
      <Aura calm={!current} />
      <div className="dj-body">
        <div className="dj-kicker">
          {current ? (
            <>
              <span className="dj-live" /> NOW PLAYING
            </>
          ) : over ? (
            'THAT’S A WRAP'
          ) : (
            `UP NEXT · IN ${inWords((ms(next!.start) - now) / 1000)}`
          )}
          {tag && (
            <span style={{ marginLeft: 'auto', letterSpacing: '.02em' }}>
              <b>{tag.wd}</b>
              {tag.day}
            </span>
          )}
        </div>
        <div className="dj-name">{over ? 'See you next time' : shown?.name}</div>
        {shown && !over && (
          <div className="dj-time">
            {hhmm(shown.start)} <i aria-hidden className="ph ph-arrow-right" /> {hhmm(shown.end)}
          </div>
        )}
        {current && (
          <div className="dj-bar">
            <span style={{ width: `${f * 100}%` }} />
          </div>
        )}
      </div>
      <i aria-hidden className="ph ph-speaker-hifi dj-spk l" />
      <i aria-hidden className="ph ph-speaker-hifi dj-spk r" />
    </button>
  )
}

/** Tapped DJ screen: tonight's set times, then a second page with the next set, Shazam and steps. */
export function DjSheet({ sets, now, onClose }: { sets: DjSet[]; now: number; onClose: () => void }) {
  const { sorted, current, next } = lineupState(sets, now)
  const [page, setPage] = useState(0)
  const tag = sorted[0] ? dayTag(sorted[0].start) : null
  return (
    <div className="dj-sheet-bg" onClick={onClose}>
      <div className="dj-sheet" onClick={e => e.stopPropagation()}>
        <Aura calm />
        <div className="dj-sheet-top">
          <span className="dj-kicker" style={{ margin: 0 }}>
            {tag && (
              <>
                <b>{tag.wd}</b>
                {tag.day} · LINEUP
              </>
            )}
          </span>
          <button className="round" aria-label="Close" onClick={onClose} style={{ width: 32, height: 32, background: 'rgba(0,0,0,.35)' }}>
            <i aria-hidden className="ph ph-x" />
          </button>
        </div>
        <div className="dj-pages no-scrollbar" onScroll={e => setPage(Math.round(e.currentTarget.scrollLeft / e.currentTarget.clientWidth))}>
          <section className="dj-page" aria-label="Set times">
            {sorted.map(s => {
              const live = s === current
              const done = ms(s.end) <= now
              const f = live ? (now - ms(s.start)) / (ms(s.end) - ms(s.start)) : 0
              return (
                <div key={s.start} className={`dj-row ${live ? 'live' : ''} ${done ? 'done' : ''}`}>
                  <div className="dj-row-time">
                    {hhmm(s.start)}
                    <span>{hhmm(s.end)}</span>
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="dj-row-name">{s.name}</div>
                    {live && (
                      <div className="dj-bar" style={{ marginTop: 6 }}>
                        <span style={{ width: `${f * 100}%` }} />
                      </div>
                    )}
                  </div>
                  {live && (
                    <span className="dj-now">
                      <span className="dj-live" /> NOW
                    </span>
                  )}
                </div>
              )
            })}
          </section>
          <section className="dj-page" aria-label="Up next">
            <div className="dj-label">{next ? `${next.name} starts in` : 'No more sets tonight'}</div>
            <div className="dj-count">{next ? countdown((ms(next.start) - now) / 1000) : '—'}</div>
            {next && <div className="dj-label" style={{ marginTop: 2 }}>at {hhmm(next.start)}</div>}
            <div className="dj-tiles">
              <a className="dj-tile" href="shazam://" onClick={shazam}>
                <i aria-hidden className="ph-bold ph-waveform" />
                <span>
                  <b>Shazam this</b>
                  What's playing?
                </span>
              </a>
              <div className="dj-tile" aria-label="Steps tonight (preview)">
                <i aria-hidden className="ph-bold ph-sneaker-move" />
                <span>
                  <b>8,412 steps</b>
                  tonight · preview
                </span>
              </div>
            </div>
          </section>
        </div>
        <div className="dj-dots" aria-hidden>
          <i className={page === 0 ? 'on' : ''} />
          <i className={page === 1 ? 'on' : ''} />
        </div>
      </div>
    </div>
  )
}

/** Open the Shazam app; if it isn't installed, send people to get it. */
function shazam(e: React.MouseEvent) {
  e.preventDefault()
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent)
  const store = ios ? 'https://apps.apple.com/app/shazam/id284993459' : 'https://play.google.com/store/apps/details?id=com.shazam.android'
  const t = setTimeout(() => (window.location.href = store), 1500)
  window.addEventListener('pagehide', () => clearTimeout(t), { once: true })
  window.location.href = 'shazam://'
}
