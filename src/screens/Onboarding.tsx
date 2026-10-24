import { useState } from 'react'
import { store, useStore } from '../lib/store'
import { LASERS } from '../lib/venue'
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
  return (
    <Shell>
      <div>
        <div style={{ fontSize: 15, fontWeight: 600, letterSpacing: '-.02em', marginBottom: 10 }}>PinGü</div>
        <div className="title" style={{ fontSize: 38 }}>
          Find your people,<br />
          <span className="dim">even with one bar.</span>
        </div>
      </div>
      <div style={{ fontSize: 14, color: 'var(--color-neutral-400)', lineHeight: 1.5 }}>
        Tap where you are and your penguin shows up on your crew’s map, glowing for 2:30. No signal? It waits and sends when it can.
      </div>

      <div style={{ display: 'flex', gap: 2, padding: 3, borderRadius: 999, boxShadow: 'var(--shadow-sm)', background: 'var(--color-glass)', alignSelf: 'flex-start' }}>
        {([['start', 'Start a crew'], ['code', 'I have a code']] as const).map(([k, l]) => (
          <button key={k} onClick={() => setMode(k)} style={{ border: 0, cursor: 'pointer', font: '500 12px var(--font-body)', padding: '7px 14px', borderRadius: 999, background: mode === k ? 'rgba(255,255,255,.12)' : 'transparent', color: mode === k ? '#fff' : 'var(--color-neutral-400)' }}>
            {l}
          </button>
        ))}
      </div>

      {mode === 'start' ? (
        <form onSubmit={e => { e.preventDefault(); if (name.trim()) store.createCrew(name.trim()) }} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <input className="input" value={name} maxLength={40} onChange={e => setName(e.target.value)} placeholder="Crew name, e.g. Halloween squad" />
          <button className="btn btn-primary" style={{ height: 46 }} disabled={!name.trim() || s.busy}>
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
