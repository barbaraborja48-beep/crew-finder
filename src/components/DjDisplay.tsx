// The DJ screen on the dance floor: who's playing right now, on a slow lava-lamp aura.
// Runs off the phone's clock (corrected by the server's), so it needs no data at all.
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { store, useStore } from '../lib/store'
import { planTimeline, REMINDER_OPTIONS, reminderLabel, setKey, switchTimes, type DjSet, type PlanItem } from '../lib/social'
import { Toggle } from './common'

export type { DjSet }

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
    <div className="dj-clip" aria-hidden>
      <div className={`lava ${calm ? 'calm' : ''}`}>
        <i className="b1" />
        <i className="b2" />
        <i className="b3" />
        <i className="b4" />
        <i className="b5" />
      </div>
    </div>
  )
}

/** fit: a name too long for the screen gets smaller instead of cut off (the Mondo nights; festival stages as before). */
export function DjDisplay({ sets, now, onOpen, round = false, fit = false }: { sets: DjSet[]; now: number; onOpen: () => void; round?: boolean; fit?: boolean }) {
  const { current, next, over } = lineupState(sets, now)
  const shown = current ?? next
  const nameRef = useRef<HTMLDivElement>(null)
  const name = over ? 'See you next time' : shown?.name
  useLayoutEffect(() => {
    const el = nameRef.current
    if (!fit || !el) return
    const shrink = () => {
      el.style.fontSize = ''
      const [room, need] = [el.clientWidth - 20, el.scrollWidth - 20] // 20: the name's right padding
      if (need > room && room > 0) el.style.fontSize = `${Math.max(15, (parseFloat(getComputedStyle(el).fontSize) * room) / need - 0.5)}px`
    }
    shrink()
    window.addEventListener('resize', shrink)
    return () => window.removeEventListener('resize', shrink)
  }, [fit, name])
  const f = current ? (now - ms(current.start)) / (ms(current.end) - ms(current.start)) : 0
  const tag = shown ? dayTag(shown.start) : null
  return (
    <button className={round ? 'dj round' : 'dj'} onClick={onOpen} aria-label={current ? `Now playing: ${current.name}. Show set times` : 'Show set times'}>
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
            <span className="dj-day" style={{ marginLeft: 'auto', letterSpacing: '.02em' }}>
              <b>{tag.wd}</b>
              {tag.day}
            </span>
          )}
        </div>
        <div className="dj-name" ref={nameRef}>{name}</div>
        {shown && !over && (
          <div className="dj-time">
            {hhmm(shown.start)} <i aria-hidden className="ph ph-arrow-right" /> {hhmm(shown.end)}
            {shown.note && <span style={{ opacity: 0.75 }}>· {shown.note}</span>}
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

/**
 * Tapped DJ screen: tonight's set times, then a second page with the next set, Shazam and steps.
 * Festivals (sets with a stage) also get stage tabs, stars to plan your night, and "My night".
 */
export function DjSheet({ sets: stageSets, now, onClose, stage, startTab }: { sets: DjSet[]; now: number; onClose: () => void; stage?: string; startTab?: 'plan' }) {
  const st = useStore()
  const all = (st.venue?.lineup ?? []) as DjSet[]
  const festival = !!stage && all.some(x => x.stage)
  const stages = festival ? st.places.filter(p => p.type === 'stage' && all.some(x => x.stage === p.id)).sort((a, b) => (a.n ?? 0) - (b.n ?? 0)) : []
  const [tab, setTab] = useState<string>(startTab ?? stage ?? '')
  const sets = festival && tab !== 'plan' ? all.filter(x => x.stage === tab) : stageSets
  const { sorted, current, next } = lineupState(sets, now)
  const [page, setPage] = useState(0)
  const [editing, setEditing] = useState<string | null>(null) // set whose reminder options are open
  const plan = st.prefs.plan
  const pick = (x: DjSet) => plan.find(i => i.k === setKey(x))
  // Stats: how often the lineup gets opened.
  useEffect(() => store.track('lineup', undefined, { festival, plan: startTab === 'plan' }), []) // eslint-disable-line react-hooks/exhaustive-deps
  const [premium, setPremium] = useState<null | 'shazam' | 'steps'>(null)
  const open = (f: 'shazam' | 'steps') => {
    store.logFeature(f) // count who wants it
    setPremium(f)
  }
  const tag = sorted[0] ? dayTag(sorted[0].start) : null
  // Rendered on top of the whole app (over the tab bar), not inside the scrolling page.
  return createPortal(
    <div className="dj-sheet-bg" onClick={onClose}>
      <div className={festival ? 'dj-sheet fixed' : 'dj-sheet'} onClick={e => e.stopPropagation()}>
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
        {festival && !premium && (
          <div className="no-scrollbar dj-tabs">
            <button className={tab === 'plan' ? 'on' : ''} onClick={() => setTab('plan')}>
              <i aria-hidden className="ph-fill ph-star" style={{ color: '#ffc83b' }} /> My night{plan.length ? ` · ${plan.length}` : ''}
            </button>
            {stages.map(p => (
              <button key={p.id} className={tab === p.id ? 'on' : ''} onClick={() => setTab(p.id)}>
                {p.name}
              </button>
            ))}
          </div>
        )}
        {festival && tab === 'plan' && !premium ? (
          <MyNight lineup={all} plan={plan} now={now} editing={editing} setEditing={setEditing} />
        ) : premium ? (
          <Premium feature={premium} onBack={() => setPremium(null)} />
        ) : (
        <>
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
                  <div className="dj-row-main">
                    <div className="dj-row-name" style={festival ? { fontSize: 19 } : undefined}>{s.name}</div>
                    {s.note && <div className="dj-label" style={{ fontSize: 11 }}>{s.note}</div>}
                    {live && (
                      <div className="dj-bar" style={{ marginTop: 6 }}>
                        <span style={{ width: `${f * 100}%` }} />
                      </div>
                    )}
                    {festival && pick(s) && !done && <RemindChip item={pick(s)!} open={editing === setKey(s)} onToggle={() => setEditing(editing === setKey(s) ? null : setKey(s))} />}
                  </div>
                  {live && (
                    <span className="dj-now">
                      <span className="dj-live" /> NOW
                    </span>
                  )}
                  {festival && !done && <Star on={!!pick(s)} onClick={() => store.togglePick(s)} name={s.name} />}
                </div>
              )
            })}
          </section>
          <section className="dj-page" aria-label="Up next">
            <div className="dj-label">{next ? `${next.name} starts in` : 'No more sets tonight'}</div>
            <div className="dj-count">{next ? countdown((ms(next.start) - now) / 1000) : '—'}</div>
            {next && <div className="dj-label" style={{ marginTop: 2 }}>at {hhmm(next.start)}</div>}
            <div className="dj-tiles">
              <button className="dj-tile" onClick={() => open('shazam')}>
                <i aria-hidden className="ph-bold ph-waveform" />
                <span>
                  <b>Shazam this</b>
                  What's playing?
                </span>
              </button>
              <button className="dj-tile" onClick={() => open('steps')}>
                <i aria-hidden className="ph-bold ph-sneaker-move" />
                <span>
                  <b>Steps tonight</b>
                  with Apple Health
                </span>
              </button>
            </div>
          </section>
        </div>
        <div className="dj-dots" aria-hidden>
          <i className={page === 0 ? 'on' : ''} />
          <i className={page === 1 ? 'on' : ''} />
        </div>
        </>
        )}
      </div>
    </div>,
    document.querySelector('.app') ?? document.body,
  )
}

function Star({ on, onClick, name }: { on: boolean; onClick: () => void; name: string }) {
  return (
    <button className="dj-star" aria-pressed={on} aria-label={on ? `Remove ${name} from my night` : `Add ${name} to my night`} onClick={onClick}>
      <i aria-hidden className={on ? 'ph-fill ph-star' : 'ph ph-star'} />
    </button>
  )
}

/** "🔔 10 min before", tap for the options. */
function RemindChip({ item, open, onToggle }: { item: PlanItem; open: boolean; onToggle: () => void }) {
  return (
    <>
      <button className="dj-remind" onClick={onToggle}>
        <i aria-hidden className={item.r == null ? 'ph ph-bell-slash' : 'ph-fill ph-bell-ringing'} />
        {item.r == null ? 'No reminder' : reminderLabel(item.r)}
        <i aria-hidden className={open ? 'ph ph-caret-up' : 'ph ph-caret-down'} />
      </button>
      {open && (
        <div className="dj-remind-opts">
          {REMINDER_OPTIONS.map(r => (
            <button key={String(r)} className={item.r === r ? 'on' : ''} onClick={() => store.setReminder(item.k, r)}>
              {r == null ? 'Off' : r === 0 ? 'At start' : `${r} min`}
            </button>
          ))}
        </div>
      )}
    </>
  )
}

/** Your picks in order, clashes with a switch time, reminders, and whether the crew can see it. */
function MyNight({ lineup, plan, now, editing, setEditing }: { lineup: DjSet[]; plan: PlanItem[]; now: number; editing: string | null; setEditing: (k: string | null) => void }) {
  const st = useStore()
  const rows = planTimeline(plan, lineup)
  const stageName = (id?: string) => st.places.find(p => p.id === id)?.name ?? ''
  const hm = (t: number) => hhmm(new Date(t).toISOString())
  return (
    <section className="dj-page" style={{ position: 'relative', zIndex: 2, minHeight: 320 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '4px 2px 12px' }}>
        <span style={{ flex: 1 }}>
          <span className="dj-label" style={{ color: '#fff' }}>Show my plan to the crew</span>
          <span className="dj-label" style={{ display: 'block', fontSize: 11 }}>
            {st.prefs.plan_shared ? 'Friends see it on your profile' : 'Only you can see it'}
          </span>
        </span>
        <Toggle on={st.prefs.plan_shared} onChange={v => store.setPlanShared(v)} label="Share my plan" />
      </div>
      {rows.length === 0 && <div className="dj-label" style={{ padding: '30px 4px', textAlign: 'center' }}>Tap the star next to a set to add it to your night.</div>}
      {rows.map((r, i) => {
        const done = r.to <= now
        const live = r.from <= now && now < r.to
        const nextRow = rows[i + 1]
        return (
          <div key={r.item.k}>
            <div className={`dj-row ${live ? 'live' : ''} ${done ? 'done' : ''}`} style={{ marginBottom: r.clash ? 4 : 8 }}>
              <div className="dj-row-time">
                {hm(r.from)}
                <span>{hm(r.to)}</span>
              </div>
              <div className="dj-row-main">
                <div className="dj-row-name" style={{ fontSize: 18 }}>{r.set.name}</div>
                <div className="dj-label" style={{ fontSize: 11 }}>{stageName(r.set.stage)}</div>
                {!done && <RemindChip item={r.item} open={editing === r.item.k} onToggle={() => setEditing(editing === r.item.k ? null : r.item.k)} />}
              </div>
              <Star on onClick={() => store.togglePick(r.set)} name={r.set.name} />
            </div>
            {r.clash && nextRow && (
              <div className="dj-clash">
                <i aria-hidden className="ph-bold ph-arrows-left-right" />
                <span style={{ flex: 1 }}>Clash · switch to {nextRow.set.name} at</span>
                <select value={nextRow.from} onChange={e => store.setSwitch(nextRow.item.k, +e.target.value)}>
                  {switchTimes(r.set, nextRow.set).map(t => (
                    <option key={t} value={t}>
                      {hm(t)}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
        )
      })}
    </section>
  )
}

const PREMIUM = {
  shazam: { icon: 'ph-bold ph-waveform', title: 'Shazam from the DJ screen', text: 'Name the track that’s playing without leaving PinGü.' },
  steps: { icon: 'ph-bold ph-sneaker-move', title: 'Your steps tonight', text: 'See how far you danced, from Apple Health.' },
}

/** "Coming in Premium" + a quick rating. Taps and ratings land in Barbara's Supabase logs. */
function Premium({ feature, onBack }: { feature: 'shazam' | 'steps'; onBack: () => void }) {
  const f = PREMIUM[feature]
  const [stars, setStars] = useState(0)
  const [comment, setComment] = useState('')
  const [state, setState] = useState<'idle' | 'sending' | 'sent' | 'failed'>('idle')
  const send = async () => {
    setState('sending')
    setState((await store.sendFeedback(feature, stars, comment)) ? 'sent' : 'failed')
  }
  return (
    <section className="dj-page" style={{ position: 'relative', zIndex: 2, minHeight: 360 }}>
      <i aria-hidden className={f.icon} style={{ fontSize: 34 }} />
      <div className="dj-kicker" style={{ marginTop: 14 }}>COMING IN PINGÜ PREMIUM</div>
      <div style={{ font: '500 26px/1.1 var(--font-body)', letterSpacing: '-.03em', marginTop: 4 }}>{f.title}</div>
      <div className="dj-label" style={{ marginTop: 6 }}>{f.text} It’ll be part of a future Premium plan.</div>
      {state === 'sent' ? (
        <div style={{ marginTop: 28, font: '500 16px var(--font-body)' }}>
          Thank you! <span style={{ opacity: 0.7 }}>We read every one.</span>
        </div>
      ) : (
        <>
          <div className="dj-label" style={{ marginTop: 22, color: '#fff' }}>How’s PinGü so far?</div>
          <div role="radiogroup" aria-label="Rating" style={{ display: 'flex', gap: 6, marginTop: 8 }}>
            {[1, 2, 3, 4, 5].map(n => (
              <button key={n} role="radio" aria-checked={stars === n} aria-label={`${n} star${n > 1 ? 's' : ''}`} onClick={() => setStars(n)} style={{ border: 0, background: 'transparent', padding: 2, cursor: 'pointer', fontSize: 30, color: n <= stars ? '#ffc83b' : 'rgba(255,255,255,.35)', filter: n <= stars ? 'drop-shadow(0 0 6px #ffc83b)' : 'none' }}>
                <i aria-hidden className={n <= stars ? 'ph-fill ph-star' : 'ph ph-star'} />
              </button>
            ))}
          </div>
          <textarea
            value={comment}
            onChange={e => setComment(e.target.value)}
            maxLength={1000}
            rows={3}
            placeholder="Comments or ideas to make it better"
            style={{ marginTop: 12, width: '100%', boxSizing: 'border-box', resize: 'none', border: 0, borderRadius: 14, padding: 12, background: 'rgba(0,0,0,.4)', boxShadow: 'inset 0 0 0 1px rgba(255,255,255,.15)', color: '#fff', font: '400 14px var(--font-body)', outline: 'none' }}
          />
          {state === 'failed' && <div className="dj-label" style={{ marginTop: 6, color: '#ffd97a' }}>Couldn’t send, no signal? Try again in a moment.</div>}
          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <button className="btn btn-secondary" style={{ height: 42, flex: 'none' }} onClick={onBack}>
              Back
            </button>
            <button className="btn btn-primary" style={{ height: 42, flex: 1 }} disabled={(!stars && !comment.trim()) || state === 'sending'} onClick={send}>
              {state === 'sending' ? 'Sending…' : 'Send'}
            </button>
          </div>
        </>
      )}
      {state === 'sent' && (
        <button className="btn btn-secondary" style={{ height: 42, marginTop: 'auto' }} onClick={onBack}>
          Back to the lineup
        </button>
      )}
    </section>
  )
}
