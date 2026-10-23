import { useRef, useState } from 'react'
import { store, useStore, type Message, type State } from '../lib/store'
import { alive } from '../lib/rules'
import { ago, ME, STATUS, where } from '../lib/venue'
import { useNow } from '../lib/view'

type Item =
  | { kind: 'msg'; m: Message; t: number }
  | { kind: 'move'; id: string; memberId: string; placeId: string; nx: number; ny: number; t: number }
  | { kind: 'join'; memberId: string; t: number }

/** The crew's whole night in one feed: messages, every check-in (yours too), joins, status changes. */
function timeline(s: State): Item[] {
  const items: Item[] = Object.values(s.messages).map(m => ({ kind: 'msg', m, t: m.born }))
  for (const c of Object.values(s.checkins)) {
    // A check-in row keeps its id when you extend it, so date it by the first tap.
    items.push({ kind: 'move', id: c.id, memberId: c.member_id, placeId: c.place_id, nx: c.nx, ny: c.ny, t: c.created_at ?? c.born })
  }
  for (const m of s.members) if (m.created_at) items.push({ kind: 'join', memberId: m.id, t: new Date(m.created_at).getTime() })
  return items.sort((a, b) => a.t - b.t).slice(-300)
}

/** "now", "4m", then clock time for anything older than an hour. */
const stamp = (t: number, now: number) =>
  now - t < 3600_000 ? ago((now - t) / 1000) : new Date(t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })

const sysLine: React.CSSProperties = { alignSelf: 'center', display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--color-neutral-500)', padding: '2px 0', textAlign: 'center', fontFamily: 'var(--font-body)' }

const QUICK = ['Where are you?', 'On my way', 'At meet spot', 'Need water']

export function ChatScreen() {
  const s = useStore()
  const now = useNow(5000)
  const [text, setText] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)
  const meId = s.session?.memberId
  const member = (id: string) => s.members.find(m => m.id === id)
  const colorOf = (id: string) => (id === meId ? ME : (member(id)?.color ?? 'var(--color-neutral-500)'))
  const nameOf = (id: string) => (id === meId ? 'You' : (member(id)?.name ?? '?'))
  const friends = s.members.filter(m => m.id !== meId)
  const active = friends.filter(m => !m.ghost).filter(m => {
    const d = Object.values(s.checkins).filter(c => c.member_id === m.id).sort((a, b) => b.born - a.born)[0]
    return alive(d, now)
  }).length + (alive(store.myDot(), now) ? 1 : 0)
  const items = timeline(s)

  const send = (t = text) => {
    store.sendText(t)
    setText('')
  }

  return (
    <div className="screen" style={{ paddingBottom: 'var(--tabbar-h)' }}>
      <div style={{ padding: 'var(--hdr-top) 20px 10px', display: 'flex', alignItems: 'center', gap: 12, boxShadow: '0 1px 0 var(--color-neutral-900)' }}>
        <div style={{ display: 'flex' }}>
          {friends.slice(0, 4).map((m, i) => (
            <span key={m.id} style={{ width: 26, height: 26, borderRadius: '50%', background: 'var(--color-surface)', boxShadow: `0 0 0 2px var(--color-bg), inset 0 0 0 1.5px ${m.color}`, marginLeft: i ? -8 : 0 }} />
          ))}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 17, fontWeight: 500 }}>{s.crew?.name ?? 'Crew'}</div>
          <div className="kicker">{s.signal === 'none' ? 'No signal · messages queue' : `${active} active`}</div>
        </div>
      </div>

      <div className="scroll no-scrollbar" style={{ flex: 1, display: 'flex', flexDirection: 'column-reverse', gap: 10, padding: '14px 16px' }}>
        {[...items].reverse().map((it, idx, arr) => {
          if (it.kind === 'join') {
            return (
              <div key={'join' + it.memberId} style={{ ...sysLine }}>
                <i aria-hidden className="ph ph-user-plus" style={{ color: colorOf(it.memberId) }} />
                {nameOf(it.memberId)} {it.memberId === meId ? 'joined' : 'joined the crew'} · {stamp(it.t, now)}
              </div>
            )
          }
          if (it.kind === 'move') {
            const c = colorOf(it.memberId)
            return (
              <button key={'mv' + it.id} onClick={() => store.openPlace(it.placeId)} style={{ ...sysLine, border: 0, background: 'transparent', cursor: 'pointer' }}>
                <span style={{ width: 7, height: 7, borderRadius: '50%', background: c, boxShadow: `0 0 5px ${c}`, flex: 'none' }} />
                {nameOf(it.memberId)} → {where(store.place(it.placeId), it.nx, it.ny)} · {stamp(it.t, now)}
              </button>
            )
          }
          const m = it.m
          const isMe = m.member_id === meId
          const color = colorOf(m.member_id)
          if (m.type === 'sys') {
            return (
              <div key={m.id} style={sysLine}>
                <i aria-hidden className="ph ph-hand-waving" style={{ color }} />
                {m.text} · {stamp(m.born, now)}
              </div>
            )
          }
          if (m.type === 'status') {
            const ghost = /ghost/.test(m.text)
            const icon = ghost ? 'ph ph-ghost' : STATUS.find(([, l]) => m.text.startsWith(l))?.[0] ?? 'ph-fill ph-smiley'
            return (
              <div key={m.id} style={sysLine}>
                <i aria-hidden className={icon} style={{ color }} />
                {nameOf(m.member_id)}
                {ghost ? ' ' : ' · '}
                {m.text} · {stamp(m.born, now)}
              </div>
            )
          }
          if (m.type === 'sos') {
            return (
              <button key={m.id} onClick={() => store.openPlace(m.place_id)} style={{ alignSelf: 'stretch', border: 0, cursor: 'pointer', borderRadius: 18, padding: '12px 14px', textAlign: 'left', background: 'color-mix(in srgb, #ff3b5c 12%, var(--color-surface))', boxShadow: 'inset 0 0 0 1px var(--sos-line)', color: 'var(--color-text)', display: 'flex', gap: 10, alignItems: 'center' }}>
                <i aria-hidden className="ph-bold ph-siren" style={{ fontSize: 22, color: 'var(--sos-text)' }} />
                <span style={{ flex: 1 }}>
                  <span style={{ display: 'block', fontSize: 14, fontWeight: 500 }}>{nameOf(m.member_id)} sent an SOS</span>
                  <span style={{ display: 'block', fontSize: 12, color: 'var(--sos-text)' }}>{m.text.replace(/^SOS · /, '')}</span>
                </span>
                <span className="kicker">{stamp(m.born, now)}</span>
              </button>
            )
          }
          // Show the sender's name on the first message of a run (arr is newest-first).
          const prev = arr[idx + 1]
          const showName = !isMe && !(prev && prev.kind === 'msg' && prev.m.member_id === m.member_id && prev.m.type !== 'sys')
          const placeLabel = m.place_id ? where(store.place(m.place_id), m.nx ?? 0.5, m.ny ?? 0.5) : 'No check-in'
          const pend = s.pending[m.id]
          const photoWait = m.type === 'photo' && (s.photoFailed[m.id] || s.signal === 'none')
          const syncLabel = !pend ? 'Sent' : pend === 'sending' ? (m.type === 'photo' ? 'Uploading…' : 'Sending…') : photoWait ? 'Photo queued · needs better signal' : 'Queued'
          return (
            <div key={m.id} style={{ display: 'flex', flexDirection: 'column', alignItems: isMe ? 'flex-end' : 'flex-start', gap: 4, maxWidth: '100%' }}>
              {showName && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: 'var(--color-neutral-400)', padding: '0 4px' }}>
                  <span style={{ width: 7, height: 7, borderRadius: '50%', background: color, boxShadow: `0 0 5px ${color}` }} />
                  {nameOf(m.member_id)}
                </div>
              )}
              {m.type === 'text' && (
                <div style={{ maxWidth: 250, padding: '9px 13px', borderRadius: 18, background: isMe ? 'var(--color-accent-800)' : 'var(--color-surface)', color: isMe ? 'var(--color-accent-100)' : 'var(--color-text)', fontSize: 14, lineHeight: 1.35, boxShadow: 'var(--shadow-sm)', overflowWrap: 'anywhere' }}>
                  {m.text}
                </div>
              )}
              {m.type === 'photo' && (
                <button onClick={() => store.openPlace(m.place_id)} style={{ width: 210, border: 0, padding: 0, cursor: 'pointer', borderRadius: 18, overflow: 'hidden', background: 'var(--color-surface)', boxShadow: 'var(--shadow-sm)', textAlign: 'left' }}>
                  {m.localPhoto || m.photo_url ? (
                    <img src={m.localPhoto || m.photo_url!} alt="" style={{ display: 'block', width: 210, height: 250, objectFit: 'cover' }} />
                  ) : (
                    <div style={{ height: 250, display: 'grid', placeItems: 'center', color: 'var(--color-neutral-600)', fontSize: 28 }}><i aria-hidden className="ph ph-image" /></div>
                  )}
                  <div style={{ padding: '8px 11px', display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--color-neutral-300)' }}>
                    <i aria-hidden className="ph-fill ph-map-pin" style={{ color }} />
                    {placeLabel}
                  </div>
                </button>
              )}
              {m.type === 'loc' && (
                <button onClick={() => store.openPlace(m.place_id)} style={{ width: 220, border: 0, cursor: 'pointer', borderRadius: 18, background: 'var(--color-surface)', boxShadow: `0 0 0 1px ${color}66`, padding: '11px 12px', display: 'flex', alignItems: 'center', gap: 10, textAlign: 'left' }}>
                  <span style={{ width: 34, height: 34, flex: 'none', borderRadius: '50%', display: 'grid', placeItems: 'center', background: `color-mix(in srgb, ${color} 14%, transparent)` }}>
                    <span style={{ width: 10, height: 10, borderRadius: '50%', background: color, boxShadow: `0 0 6px ${color}, 0 0 14px ${color}` }} />
                  </span>
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ display: 'block', fontSize: 13, fontWeight: 500 }}>{placeLabel}</span>
                    <span style={{ display: 'block', fontSize: 10, color: 'var(--color-neutral-500)' }}>Location · tap to view</span>
                  </span>
                </button>
              )}
              {isMe && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, padding: '0 4px', color: !pend ? 'var(--color-neutral-500)' : pend === 'sending' ? '#bff9ff' : 'var(--queued)' }}>
                  <i aria-hidden className={!pend ? 'ph-bold ph-check' : pend === 'sending' ? 'ph ph-arrow-up' : 'ph ph-clock'} />
                  {syncLabel}
                </div>
              )}
            </div>
          )
        })}
        {items.length === 0 && <div style={{ margin: 'auto', fontSize: 13, color: 'var(--color-neutral-500)' }}>No messages yet.</div>}
      </div>

      <div className="no-scrollbar" style={{ padding: '6px 12px 0', display: 'flex', gap: 6, overflowX: 'auto', flex: 'none' }}>
        {QUICK.map(q => (
          <button key={q} onClick={() => send(q)} style={{ flex: 'none', height: 28, border: 0, cursor: 'pointer', padding: '0 11px', borderRadius: 999, font: '500 11px var(--font-body)', background: 'transparent', color: 'var(--color-neutral-300)', boxShadow: 'var(--shadow-sm)' }}>
            {q}
          </button>
        ))}
      </div>
      <div style={{ padding: '8px 12px 10px', display: 'flex', alignItems: 'center', gap: 8, flex: 'none' }}>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          style={{ display: 'none' }}
          onChange={e => {
            const f = e.target.files?.[0]
            if (f) store.sendPhoto(f)
            e.target.value = ''
          }}
        />
        <button aria-label="Send photo" onClick={() => fileRef.current?.click()} style={{ width: 38, height: 38, flex: 'none', border: 0, cursor: 'pointer', borderRadius: '50%', background: 'var(--color-surface)', boxShadow: 'var(--shadow-sm)', color: 'var(--color-neutral-200)', fontSize: 18, display: 'grid', placeItems: 'center' }}>
          <i aria-hidden className="ph ph-camera" />
        </button>
        <button aria-label="Share my location" onClick={() => store.sendLocation()} style={{ width: 38, height: 38, flex: 'none', border: 0, cursor: 'pointer', borderRadius: '50%', background: 'var(--color-surface)', boxShadow: 'var(--shadow-sm)', color: ME, fontSize: 18, display: 'grid', placeItems: 'center' }}>
          <i aria-hidden className="ph ph-map-pin" />
        </button>
        <form
          onSubmit={e => {
            e.preventDefault()
            send()
          }}
          style={{ flex: 1, height: 38, borderRadius: 19, background: 'var(--color-surface)', boxShadow: 'var(--shadow-sm)', display: 'flex', alignItems: 'center', padding: '0 4px 0 14px' }}
        >
          <input value={text} maxLength={500} onChange={e => setText(e.target.value)} placeholder="Message" enterKeyHint="send" style={{ flex: 1, minWidth: 0, border: 0, outline: 0, background: 'transparent', color: 'var(--color-text)', font: '400 14px var(--font-body)' }} />
          <button type="submit" aria-label="Send" style={{ width: 30, height: 30, border: 0, cursor: 'pointer', borderRadius: '50%', background: 'var(--color-accent-800)', color: 'var(--color-accent-100)', display: 'grid', placeItems: 'center', fontSize: 14 }}>
            <i aria-hidden className="ph-bold ph-arrow-up" />
          </button>
        </form>
      </div>
    </div>
  )
}
