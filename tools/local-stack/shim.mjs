// Local stand-in for Supabase: anonymous auth, REST (proxied to PostgREST), a tiny photo
// store, the push function (proxied to Deno), pg_net calls forwarded to it, and a fake
// push service that records what each phone would have been sent.
import http from 'node:http'
import https from 'node:https'
import fs from 'node:fs'
import crypto from 'node:crypto'
import pg from 'pg'
import { WebSocketServer } from 'ws'

const SECRET = 'local-test-secret-local-test-secret-1234'
const PGRST = 'http://127.0.0.1:3001'
const FN = 'http://127.0.0.1:8000'
const db = new pg.Pool({ host: '/opt/pg', port: 54329, user: 'postgres', database: 'pingu' })

const b64u = b => Buffer.from(b).toString('base64url')
export function jwt(claims) {
  const h = b64u(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
  const p = b64u(JSON.stringify(claims))
  return `${h}.${p}.${crypto.createHmac('sha256', SECRET).update(`${h}.${p}`).digest('base64url')}`
}
const refresh = new Map()
const session = id => {
  const exp = Math.floor(Date.now() / 1000) + 3600
  const rt = crypto.randomUUID()
  refresh.set(rt, id)
  const user = { id, aud: 'authenticated', role: 'authenticated', is_anonymous: true, app_metadata: {}, user_metadata: {}, created_at: new Date().toISOString() }
  return { access_token: jwt({ sub: id, role: 'authenticated', aud: 'authenticated', exp, is_anonymous: true }), token_type: 'bearer', expires_in: 3600, expires_at: exp, refresh_token: rt, user }
}

const photos = new Map()
export const pushes = []
const cors = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': '*',
  'access-control-allow-methods': 'GET,POST,PATCH,PUT,DELETE,OPTIONS',
  'access-control-expose-headers': '*',
}
const body = req => new Promise(r => { const c = []; req.on('data', d => c.push(d)); req.on('end', () => r(Buffer.concat(c))) })
const send = (res, status, data, type = 'application/json') => {
  res.writeHead(status, { ...cors, 'content-type': type })
  res.end(typeof data === 'string' || Buffer.isBuffer(data) ? data : JSON.stringify(data))
}
let slow = 0 // ms of extra delay on every API call (to imitate a weak signal)
let down = false
let hangNext = 0
let slowStorage = 0

const server = http.createServer(async (req, res) => {
  if (req.method === 'OPTIONS') return send(res, 204, '')
  const url = new URL(req.url, 'http://x')
  const p = url.pathname
  try {
    if (p === '/_test/slow') {
      slow = +(url.searchParams.get('ms') ?? 0); down = url.searchParams.get('down') === '1'
      hangNext = +(url.searchParams.get('hangNext') ?? 0); slowStorage = +(url.searchParams.get('storage') ?? 0)
      return send(res, 200, { slow, down, hangNext, slowStorage })
    }
    if (p === '/_test/pushes') return send(res, 200, pushes)
    if (p.startsWith('/fakepush/')) { pushes.push({ to: p.slice(10), at: Date.now(), len: (await body(req)).length, headers: { urgency: req.headers.urgency, topic: req.headers.topic } }); return send(res, 201, '') }
    if (down) { req.socket.destroy(); return }
    if (slow) await new Promise(r => setTimeout(r, slow))
    if (hangNext && p.startsWith('/rest/v1/rpc/crew_sync')) { const ms = hangNext; hangNext = 0; await new Promise(r => setTimeout(r, ms)) } // one stuck request
    if (slowStorage && p.startsWith('/storage/v1/object/') && req.method === 'POST') await new Promise(r => setTimeout(r, slowStorage))
    if (p === '/auth/v1/signup') return send(res, 200, session(crypto.randomUUID()))
    if (p === '/auth/v1/token') {
      const b = JSON.parse((await body(req)).toString() || '{}')
      const id = refresh.get(b.refresh_token)
      return id ? send(res, 200, session(id)) : send(res, 400, { error: 'invalid_grant' })
    }
    if (p === '/auth/v1/user') {
      const tok = (req.headers.authorization ?? '').split(' ')[1] ?? ''
      const claims = JSON.parse(Buffer.from(tok.split('.')[1] ?? '', 'base64url').toString() || '{}')
      return send(res, 200, { id: claims.sub, aud: 'authenticated', role: 'authenticated', is_anonymous: true })
    }
    if (p.startsWith('/storage/v1/object/public/')) {
      const ph = photos.get(p.slice('/storage/v1/object/public/'.length))
      return ph ? send(res, 200, ph, 'image/jpeg') : send(res, 404, { error: 'not found' })
    }
    if (p.startsWith('/storage/v1/object/')) {
      const key = p.slice('/storage/v1/object/'.length)
      if (photos.has(key)) return send(res, 409, { statusCode: '409', error: 'Duplicate', message: 'The resource already exists' })
      photos.set(key, await body(req))
      return send(res, 200, { Key: key })
    }
    if (p.startsWith('/functions/v1/')) return proxy(req, res, FN + p.slice('/functions/v1'.length) + url.search)
    if (p.startsWith('/rest/v1/')) return proxy(req, res, PGRST + p.slice('/rest/v1'.length) + url.search)
    send(res, 404, { error: 'nope' })
  } catch (e) {
    console.error(e)
    send(res, 500, { error: String(e) })
  }
})
server.listen(54321, () => console.log('shim on 54321'))

// Realtime stand-in: accepts channel joins (so phones show "Live"); updates come from syncs.
const wss = new WebSocketServer({ noServer: true })
server.on('upgrade', (req, sock, head) => {
  if (!req.url.startsWith('/realtime/')) return sock.destroy()
  wss.handleUpgrade(req, sock, head, ws => {
    ws.on('message', raw => {
      const m = JSON.parse(raw.toString())
      const [joinRef, ref, topic, event, payload] = Array.isArray(m) ? m : [m.join_ref, m.ref, m.topic, m.event, m.payload]
      let response = {}
      if (event === 'phx_join') response = { postgres_changes: (payload?.config?.postgres_changes ?? []).map((b, i) => ({ ...b, id: i + 1 })) }
      const reply = { status: 'ok', response }
      ws.send(JSON.stringify(Array.isArray(m) ? [joinRef, ref, topic, 'phx_reply', reply] : { join_ref: joinRef, ref, topic, event: 'phx_reply', payload: reply }))
    })
  })
})

async function proxy(req, res, target) {
  const b = await body(req)
  const headers = { ...req.headers }
  delete headers.host
  delete headers['content-length']
  const r = await fetch(target, { method: req.method, headers, body: ['GET', 'HEAD'].includes(req.method) ? undefined : b })
  const out = Buffer.from(await r.arrayBuffer())
  const h = { ...cors }
  r.headers.forEach((v, k) => { if (!['content-encoding', 'transfer-encoding', 'content-length', 'connection'].includes(k)) h[k] = v })
  res.writeHead(r.status, h)
  res.end(out)
}

// pg_net stand-in: forward recorded calls to the push function, like Supabase would.
setInterval(async () => {
  const { rows } = await db.query('delete from net.calls returning *').catch(() => ({ rows: [] }))
  for (const c of rows) {
    fetch(c.url.replace(/^https?:\/\/[^/]+\/functions\/v1/, FN), { method: 'POST', headers: c.headers, body: JSON.stringify(c.body) })
      .then(r => r.text()).then(t => console.log('push fn:', t.slice(0, 200))).catch(e => console.log('push fn down', e.message))
  }
}, 400)
// pg_cron stand-in: the reminders job, every 5 s instead of every minute.
setInterval(() => db.query('select public.fire_reminders()').catch(() => {}), 5000)

// Fake push service (HTTPS, like the real ones): records who'd get what.
https.createServer({ key: fs.readFileSync('/opt/shim/key.pem'), cert: fs.readFileSync('/opt/shim/cert.pem') }, async (req, res) => {
  const b = await body(req)
  pushes.push({ to: req.url.split('/').pop(), at: Date.now(), len: b.length, urgency: req.headers.urgency, topic: req.headers.topic })
  res.writeHead(201)
  res.end()
}).listen(54322)
