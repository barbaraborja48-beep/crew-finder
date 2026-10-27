import { useState } from 'react'
import { store, useStore } from '../lib/store'
import { LASERS, VENUES } from '../lib/venue'
import { isIOS, isStandalone } from '../lib/view'
import { Penguin } from '../components/Penguin'
import { PenguinPicker } from '../components/PenguinPicker'

const CROWD: [string, number][] = [['#ff3bd4', 7], ['#3bf0ff', 1], ['#b6ff3b', 4], ['#a46bff', 6], ['#ffc83b', 2]]

function Shell({ children, crowd = true }: { children: React.ReactNode; crowd?: boolean }) {
  return (
    <div className="screen scroll no-scrollbar" style={{ padding: 'calc(var(--safe-top) + 36px) 24px calc(var(--safe-bottom) + 24px)', gap: 22 }}>
      {crowd && (
        // a little crowd dancing on the welcome screens
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 64 }}>
          {CROWD.map(([c, a], i) => (
            <Penguin key={c} color={c} acc={a} activity="dance" seed={c} size={i === 1 ? 46 : 38} signal={3} />
          ))}
        </div>
      )}
      {children}
    </div>
  )
}

/** "Halloween squad!" → "halloween-squad" */
const slug = (s: string) =>
  s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 24).replace(/-+$/, '')
const CODE_OK = /^[a-z0-9][a-z0-9-]{2,23}$/

const Err = ({ msg }: { msg: string | null }) => (msg ? <div style={{ fontSize: 13, color: 'var(--sos-text)' }}>{msg}</div> : null)

export function Unconfigured() {
  return (
    <Shell>
      <div className="title" style={{ fontSize: 26 }}>Almost there</div>
      <div style={{ fontSize: 14, color: 'var(--color-neutral-400)', lineHeight: 1.5 }}>
        This build doesn’t know which Supabase project to use yet. Add <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_ANON_KEY</code> (see SETUP.md, step 4), then rebuild.
      </div>
    </Shell>
  )
}

export function Welcome() {
  const s = useStore()
  const [mode, setMode] = useState<'start' | 'code'>('start')
  const [name, setName] = useState('')
  const [code, setCode] = useState('')
  const [venue, setVenue] = useState(VENUES[0].id)
  // Your invite code: made from the crew name until you edit it yourself.
  const [invite, setInvite] = useState<string | null>(null)
  const suggested = slug(name)
  const inviteCode = invite ?? (CODE_OK.test(suggested) ? suggested : '')
  const inviteOk = !inviteCode || CODE_OK.test(inviteCode)
  return (
    <Shell>
      <div>
        <div className="title" style={{ fontSize: 30 }}>
          <span className="dim">Find your crew with</span>
        </div>
        <div style={{ font: '600 72px/1 var(--font-body)', letterSpacing: '-.055em', marginTop: 6, textShadow: '0 0 28px color-mix(in srgb, var(--color-accent) 55%, transparent)' }}>PinGü!</div>
      </div>
      <div style={{ fontSize: 15, color: 'var(--color-neutral-300)', lineHeight: 1.45 }}>Create a new crew or join an existing one with a crew code.</div>

      <div style={{ display: 'flex', gap: 2, padding: 3, borderRadius: 999, boxShadow: 'var(--shadow-sm)', background: 'var(--color-glass)', alignSelf: 'flex-start' }}>
        {([['start', 'Start a crew'], ['code', 'I have a code']] as const).map(([k, l]) => (
          <button key={k} onClick={() => setMode(k)} style={{ border: 0, cursor: 'pointer', font: '500 12px var(--font-body)', padding: '7px 14px', borderRadius: 999, background: mode === k ? 'rgba(255,255,255,.12)' : 'transparent', color: mode === k ? '#fff' : 'var(--color-neutral-400)' }}>
            {l}
          </button>
        ))}
      </div>

      {mode === 'start' ? (
        <form onSubmit={e => { e.preventDefault(); if (name.trim() && inviteOk) store.createCrew(name.trim(), venue, inviteCode || undefined) }} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div role="radiogroup" aria-label="Where" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            {VENUES.map(o => {
              const on = venue === o.id
              return (
                <button
                  key={o.id}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  onClick={() => setVenue(o.id)}
                  style={{
                    border: 0, cursor: 'pointer', textAlign: 'left', padding: '11px 12px', borderRadius: 'var(--radius-md)', color: '#fff',
                    background: on ? 'color-mix(in srgb, var(--color-accent-600) 22%, var(--color-surface))' : 'var(--color-surface)',
                    boxShadow: on ? '0 0 0 1.5px var(--color-accent-400), 0 0 18px -6px var(--color-accent)' : 'var(--shadow-sm)',
                  }}
                >
                  <span style={{ display: 'block', font: '500 13px var(--font-body)' }}>{o.name}</span>
                  <span style={{ display: 'block', marginTop: 2, font: '400 11px var(--font-body)', color: 'var(--color-neutral-400)' }}>{o.where}</span>
                </button>
              )
            })}
          </div>
          <input className="input" value={name} maxLength={40} onChange={e => setName(e.target.value)} placeholder="Crew name, e.g. Saturday squad" />
          <label style={{ display: 'flex', alignItems: 'center', height: 46, borderRadius: 'var(--radius-md)', background: 'var(--color-glass)', boxShadow: inviteOk ? 'var(--shadow-sm)' : '0 0 0 1px var(--sos-line)', padding: '0 14px', gap: 2 }}>
            <span style={{ font: '400 13px var(--font-body)', color: 'var(--color-neutral-500)', whiteSpace: 'nowrap' }}>Invite code</span>
            <i aria-hidden className="ph ph-pencil-simple" style={{ fontSize: 12, color: 'var(--color-neutral-600)', margin: '0 8px 0 4px' }} />
            <input
              aria-label="Invite code"
              value={inviteCode}
              maxLength={24}
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              onChange={e => setInvite(e.target.value.toLowerCase().replace(/\s+/g, '-'))}
              placeholder="made for you"
              style={{ flex: 1, minWidth: 0, border: 0, outline: 0, background: 'transparent', color: 'var(--color-text)', font: '500 15px var(--font-body)' }}
            />
          </label>
          <div style={{ fontSize: 11, color: inviteOk ? 'var(--color-neutral-500)' : 'var(--sos-text)', marginTop: -4 }}>
            {inviteOk ? (inviteCode ? `Friends join at …/?crew=${inviteCode}` : 'Leave it empty and we’ll make one up.') : '3 to 24 letters, numbers or dashes.'}
          </div>
          <button className="btn btn-primary" style={{ height: 46 }} disabled={!name.trim() || !inviteOk || s.busy}>
            {s.busy ? 'Creating…' : 'Create crew'}
          </button>
        </form>
      ) : (
        <form onSubmit={e => { e.preventDefault(); const c = code.trim().split('crew=').pop()!.trim(); if (c) store.openInvite(c) }} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <input className="input" value={code} onChange={e => setCode(e.target.value)} placeholder="Invite code or link" autoCapitalize="none" autoCorrect="off" />
          <button className="btn btn-primary" style={{ height: 46 }} disabled={!code.trim() || s.busy}>
            Continue
          </button>
        </form>
      )}
      <Err msg={s.error} />
    </Shell>
  )
}

export function Join() {
  const s = useStore()
  const [name, setName] = useState('')
  const crewColors = s.preview?.taken_colors ?? []
  const taken = new Set(crewColors.map(c => c.toLowerCase()))
  const [color, setColor] = useState<string | null>(null)
  const [acc, setAcc] = useState(0)
  // Suggest a color nobody has yet, but any color is allowed.
  const pick = color ?? LASERS.find(c => !taken.has(c)) ?? LASERS[0]
  const link = `${location.origin}/?crew=${s.invite}`

  return (
    <Shell>
      {!s.preview ? (
        <>
          <div className="title">{s.busy ? 'Opening invite…' : 'Hmm'}</div>
          <Err msg={s.error} />
          {!s.busy && (
            <button className="btn btn-secondary" style={{ height: 44 }} onClick={() => store.leave()}>
              Back
            </button>
          )}
        </>
      ) : (
        <>
          <div>
            <div className="kicker">{s.preview.venue_name} · {s.preview.event_name}</div>
            <div className="title" style={{ fontSize: 32 }}>{s.preview.crew_name}</div>
            <div style={{ fontSize: 12, color: 'var(--color-neutral-500)', marginTop: 4 }}>
              {s.preview.members ? `${s.preview.members} in the crew` : 'You’re the first one here'} · code {s.invite}
            </div>
          </div>

          {isIOS() && !isStandalone() && (
            <div style={{ borderRadius: 'var(--radius-lg)', boxShadow: '0 0 0 1px #ffc83b88', padding: '12px 14px', fontSize: 12, color: 'var(--queued)', lineHeight: 1.5 }}>
              Tip: join here, then tap Share → “Add to Home Screen”. When you open it from the Home Screen, enter code <b>{s.invite}</b> and the same name to pick up where you left off.
            </div>
          )}

          <form onSubmit={e => { e.preventDefault(); if (name.trim()) store.joinCrew(name.trim(), pick, acc) }} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label className="kicker" htmlFor="nm">Your name</label>
              <input id="nm" className="input" value={name} maxLength={20} onChange={e => setName(e.target.value)} placeholder="What your crew calls you" autoComplete="given-name" />
              <div style={{ fontSize: 11, color: 'var(--color-neutral-600)' }}>Already joined on another phone or browser? Use the same name.</div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div className="kicker">Your laser color and penguin</div>
              <div style={{ display: 'flex', justifyContent: 'center', padding: '4px 0' }}>
                <Penguin color={pick} acc={acc} activity="dance" seed="me" size={64} signal={3} />
              </div>
              <PenguinPicker color={pick} acc={acc} onColor={setColor} onAcc={setAcc} crewColors={crewColors} />
            </div>
            <button className="btn btn-primary" style={{ height: 46 }} disabled={!name.trim() || s.busy}>
              {s.busy ? 'Joining…' : 'Join crew'}
            </button>
          </form>
          <Err msg={s.error} />
          <button
            className="btn btn-ghost"
            style={{ alignSelf: 'flex-start', fontSize: 12 }}
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(link)
                store.toast('Invite link copied')
              } catch {
                /* ignore */
              }
            }}
          >
            <i aria-hidden className="ph ph-link" />
            Copy invite link
          </button>
        </>
      )}
    </Shell>
  )
}
