import { useEffect, useState } from 'react'
import { store, useStore } from '../lib/store'
import { supabase, SUPABASE_ANON_KEY, SUPABASE_URL } from '../lib/supabase'
import { kv } from '../lib/db'

function Copy({ label, value, mono = true }: { label: string; value: string; mono?: boolean }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <div className="kicker">{label}</div>
      <button
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(value)
            store.toast(`${label} copied`)
          } catch {
            store.toast('Long-press to copy', 'ph ph-copy', 'var(--color-neutral-400)')
          }
        }}
        style={{ border: 0, cursor: 'pointer', textAlign: 'left', borderRadius: 'var(--radius-md)', background: 'var(--color-surface)', boxShadow: 'var(--shadow-sm)', padding: '10px 12px', display: 'flex', gap: 10, alignItems: 'center' }}
      >
        <span style={{ flex: 1, minWidth: 0, fontSize: 12, fontFamily: mono ? 'ui-monospace, Menlo, monospace' : undefined, color: 'var(--color-neutral-200)', overflowWrap: 'anywhere', userSelect: 'all', WebkitUserSelect: 'all' }}>{value}</span>
        <i aria-hidden className="ph ph-copy" style={{ color: 'var(--color-accent-300)' }} />
      </button>
    </div>
  )
}

const Step = ({ n, children }: { n: number; children: React.ReactNode }) => (
  <div style={{ display: 'flex', gap: 10, fontSize: 13, color: 'var(--color-neutral-300)', lineHeight: 1.45 }}>
    <span style={{ width: 20, height: 20, flex: 'none', borderRadius: '50%', boxShadow: '0 0 0 1px var(--color-accent-600)', color: 'var(--color-accent-200)', display: 'grid', placeItems: 'center', fontSize: 11 }}>{n}</span>
    <span>{children}</span>
  </div>
)

export function ShortcutScreen() {
  const s = useStore()
  const memberId = s.session?.memberId ?? ''
  const [secret, setSecret] = useState<string | null>(null)
  const [test, setTest] = useState<string | null>(null)

  useEffect(() => {
    ;(async () => {
      const cached = await kv.get<string>(`secret:${memberId}`)
      if (cached) return setSecret(cached)
      const { data } = await supabase.rpc('my_shortcut_secret', { p_member: memberId })
      if (data) {
        setSecret(data as string)
        kv.set(`secret:${memberId}`, data)
      }
    })()
  }, [memberId])

  const url = `${SUPABASE_URL}/rest/v1/rpc/quick_checkin`
  // Legacy anon keys are JWTs and also go in Authorization; new publishable keys only need apikey.
  const jwtKey = SUPABASE_ANON_KEY.startsWith('eyJ')
  const headers: Record<string, string> = { apikey: SUPABASE_ANON_KEY, 'Content-Type': 'application/json', ...(jwtKey ? { Authorization: `Bearer ${SUPABASE_ANON_KEY}` } : {}) }
  const body = JSON.stringify({ member_id: memberId, secret: secret ?? '…' })

  const runTest = async () => {
    setTest('Sending…')
    try {
      const r = await fetch(url, { method: 'POST', headers, body })
      const j = await r.json()
      setTest(j.message ?? JSON.stringify(j))
      store.refresh()
    } catch {
      setTest('No signal. The Shortcut needs a connection to work.')
    }
  }

  return (
    <div className="screen scroll no-scrollbar" style={{ padding: 'var(--hdr-top) 20px calc(var(--tabbar-h) + 24px)', gap: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <button className="round" aria-label="Back" onClick={() => store.ui({ screen: 'crew' })}>
          <i aria-hidden className="ph ph-caret-left" />
        </button>
        <div>
          <div className="kicker">iPhone Shortcut</div>
          <div style={{ fontSize: 20, fontWeight: 500, letterSpacing: '-.02em' }}>One-tap “I’m here”</div>
        </div>
      </div>
      <div style={{ fontSize: 13, color: 'var(--color-neutral-400)', lineHeight: 1.5 }}>
        Re-lights your dot without opening the app: from a Home Screen widget, the lock screen, the Action button or Back Tap. If your dot is still glowing it adds 1:00, otherwise it lights you up again at your last spot. It needs signal, there’s no queue.
      </div>

      <Step n={1}>Open the <b>Shortcuts</b> app, tap <b>+</b>, name it “I’m here”.</Step>
      <Step n={2}>Add the action <b>Get Contents of URL</b> and paste the URL below.</Step>
      <Copy label="URL" value={url} />
      <Step n={3}>Tap <b>Show More</b>. Method: <b>POST</b>. Add {jwtKey ? 'three' : 'two'} headers:</Step>
      <Copy label="Header: apikey" value={SUPABASE_ANON_KEY} />
      {jwtKey && <Copy label="Header: Authorization" value={`Bearer ${SUPABASE_ANON_KEY}`} />}
      <Copy label="Header: Content-Type" value="application/json" />
      <Step n={4}>
        Request Body: <b>JSON</b>. Add two <b>Text</b> fields, <code>member_id</code> and <code>secret</code>:
      </Step>
      <Copy label="member_id" value={memberId} />
      <Copy label="secret (keep private)" value={secret ?? 'Loading… needs signal once'} />
      <Step n={5}>
        Add <b>Get Dictionary Value</b> → key <code>message</code>, then <b>Show Notification</b> with that value. You’ll see something like “Checked in · Brunch! · front L · 2:30”.
      </Step>
      <Step n={6}>
        Optional: duplicate it and add a third Text field <code>p_type</code> = <code>wc</code>, <code>bar</code> or <code>water</code> for “I’m at the nearest WC/Bar/Water”.
      </Step>
      <Step n={7}>Long-press your Home Screen → <b>+</b> → Shortcuts widget, or Settings → Accessibility → Touch → Back Tap.</Step>

      <button className="btn btn-primary" style={{ height: 44 }} disabled={!secret} onClick={runTest}>
        <i aria-hidden className="ph ph-lightning" />
        Test it from here
      </button>
      {test && <div style={{ fontSize: 13, color: 'var(--color-neutral-300)', textAlign: 'center' }}>{test}</div>}
    </div>
  )
}
