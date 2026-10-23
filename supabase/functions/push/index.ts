// Crew Finder push notifications (Supabase Edge Function, Deno).
//
// GET  → { publicKey } for phones subscribing. Creates the VAPID keys on first use.
// POST ← called by the database trigger on every new check-in spot and message,
//        signed with x-hook-secret. Sends Web Push to the rest of the crew.
//
// Deploy with "Verify JWT" turned OFF: the trigger can't send a user token,
// so this function checks its own secret instead.
import webpush from 'npm:web-push@3.6.7'
import { createClient } from 'npm:@supabase/supabase-js@2'

const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
  auth: { persistSession: false },
})

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
}
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

interface Config {
  hook_secret: string
  vapid_public: string | null
  vapid_private: string | null
  vapid_subject: string | null
}

async function getConfig(origin?: string | null): Promise<Config> {
  const { data, error } = await db.from('push_config').select('*').eq('id', 1).single()
  if (error) throw error
  let c = data as Config
  const patch: Partial<Config> = {}
  if (!c.vapid_public) {
    const k = webpush.generateVAPIDKeys()
    Object.assign(patch, { vapid_public: k.publicKey, vapid_private: k.privateKey })
  }
  if (!c.vapid_subject && origin?.startsWith('https://')) patch.vapid_subject = origin
  if (Object.keys(patch).length) {
    // Only fill blanks, so two first requests at once can't end up with different keys.
    let q = db.from('push_config').update(patch).eq('id', 1)
    if (patch.vapid_public) q = q.is('vapid_public', null)
    await q
    c = ((await db.from('push_config').select('*').eq('id', 1).single()).data ?? c) as Config
  }
  return c
}

// ─── labels (same wording as the app) ───────────────────────────────────

interface Place {
  id: string
  type: string
  name: string
  near: string
  shape: { kind: string } | null
}

const zone = (nx: number, ny: number) =>
  `${ny < 0.333 ? 'front' : ny < 0.666 ? 'mid' : 'back'} ${nx < 0.333 ? 'L' : nx < 0.666 ? 'C' : 'R'}`

function spot(p: Place, nx: number, ny: number) {
  const k = p.shape?.kind
  if (k === 'trucks') return `truck ${Math.min(8, 1 + Math.floor(nx * 8))}`
  if (k === 'counter') return nx < 0.333 ? 'left end' : nx < 0.666 ? 'middle' : 'right end'
  if (k === 'kiosk' || k === 'tables') {
    const dx = nx - 0.5, dy = ny - 0.5
    return Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? 'left side' : 'right side') : dy < 0 ? 'front' : 'back'
  }
  return ''
}

function where(p: Place | undefined, nx = 0.5, ny = 0.5) {
  if (!p) return 'somewhere'
  if (p.type === 'stage') return `${p.name} · ${zone(nx, ny)}`
  const base = p.near ? `${p.name} · by ${p.near}` : p.name
  const s = spot(p, nx, ny)
  return s ? `${base} · ${s}` : base
}

const agoText = (iso: string) => {
  const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000)
  return m >= 2 ? ` · ${m}m ago` : ''
}

// ─── sending ────────────────────────────────────────────────────────────

interface Sub {
  endpoint: string
  member_id: string
  p256dh: string
  auth: string
  updates: boolean
  chat: boolean
}

interface Note {
  title: string
  body: string
  tag: string
  open: 'map' | 'chat' | 'find'
  member?: string
  urgent?: boolean
  pref: 'updates' | 'chat' | 'always'
  only?: string // a single recipient member id
}

async function build(table: string, r: Record<string, unknown>): Promise<Note | null> {
  const memberId = r.member_id as string
  const { data: sender } = await db.from('members').select('id,name,crew_id,ghost').eq('id', memberId).single()
  if (!sender) return null
  const { data: crew } = await db.from('crews').select('venue_id').eq('id', sender.crew_id).single()
  const { data: places } = await db.from('places').select('id,type,name,near,shape').eq('venue_id', crew?.venue_id)
  const place = (id: unknown) => (places as Place[] | null)?.find(p => p.id === id)
  const name = sender.name as string

  if (table === 'checkins') {
    if (sender.ghost) return null
    // A check-in that sat in someone's outbox for ages isn't news any more.
    if (Date.now() - new Date(r.born as string).getTime() > 30 * 60_000) return null
    return {
      title: name,
      body: `Checked in · ${where(place(r.place_id), r.nx as number, r.ny as number)}${agoText(r.born as string)}`,
      tag: `spot-${memberId}`,
      open: 'find',
      member: memberId,
      pref: 'updates',
    }
  }

  const text = (r.text as string) ?? ''
  const label = r.place_id ? where(place(r.place_id), (r.nx as number) ?? 0.5, (r.ny as number) ?? 0.5) : ''
  switch (r.type) {
    case 'sos':
      return { title: `SOS · ${name}`, body: text.replace(/^SOS · /, ''), tag: `sos-${r.id}`, open: 'chat', urgent: true, pref: 'always' }
    case 'sys':
      if (!r.to_member) return null
      return { title: name, body: `${name} is looking for you`, tag: `ping-${memberId}`, open: 'find', member: memberId, urgent: true, pref: 'always', only: r.to_member as string }
    case 'status':
      return { title: name, body: text, tag: `status-${memberId}`, open: 'find', member: memberId, pref: 'updates' }
    case 'text':
      return { title: name, body: text, tag: `chat-${r.crew_id}`, open: 'chat', pref: 'chat' }
    case 'loc':
      return { title: name, body: `Shared location · ${label}`, tag: `chat-${r.crew_id}`, open: 'chat', pref: 'chat' }
    case 'photo':
      return { title: name, body: label ? `Sent a photo · ${label}` : 'Sent a photo', tag: `chat-${r.crew_id}`, open: 'chat', pref: 'chat' }
  }
  return null
}

async function send(note: Note, crewId: string, senderId: string, c: Config) {
  const { data } = await db.from('push_subscriptions').select('*').eq('crew_id', crewId).neq('member_id', senderId)
  const subs = ((data ?? []) as Sub[]).filter(s =>
    note.only ? s.member_id === note.only : note.pref === 'always' || s[note.pref],
  )
  const payload = JSON.stringify({ title: note.title, body: note.body, tag: note.tag, open: note.open, member: note.member, urgent: !!note.urgent })
  const results = await Promise.allSettled(
    subs.map(s =>
      webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload, {
        TTL: note.urgent ? 6 * 3600 : 1800,
        urgency: note.urgent ? 'high' : 'normal',
        topic: note.tag.replace(/[^A-Za-z0-9_-]/g, '').slice(0, 32),
        vapidDetails: { subject: c.vapid_subject ?? 'mailto:crew-finder@users.noreply.github.com', publicKey: c.vapid_public!, privateKey: c.vapid_private! },
      }),
    ),
  )
  // Phones that unsubscribed or reinstalled: forget them.
  const gone = subs.filter((_, i) => {
    const r = results[i]
    return r.status === 'rejected' && [404, 410].includes((r.reason as { statusCode?: number })?.statusCode ?? 0)
  })
  if (gone.length) await db.from('push_subscriptions').delete().in('endpoint', gone.map(s => s.endpoint))
  const failed = results
    .filter((r, i) => r.status === 'rejected' && !gone.includes(subs[i]))
    .map(r => String((r as PromiseRejectedResult).reason?.body ?? (r as PromiseRejectedResult).reason))
  return { sent: results.length - failed.length, failed, removed: gone.length }
}

Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  try {
    if (req.method === 'GET') {
      const c = await getConfig(req.headers.get('origin'))
      return json({ publicKey: c.vapid_public })
    }
    const c = await getConfig()
    if (req.headers.get('x-hook-secret') !== c.hook_secret) return json({ error: 'forbidden' }, 401)
    const { table, record } = await req.json()
    const note = await build(table, record)
    if (!note) return json({ skipped: true })
    return json(await send(note, record.crew_id, record.member_id, c))
  } catch (e) {
    console.error(e)
    return json({ error: String(e) }, 500)
  }
})
