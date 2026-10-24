// App state, actions and the offline sync loop.
//
// Every write goes to IndexedDB first (outbox), shows up in the UI right away,
// then a loop sends it whenever there is any signal. Rows use client-made
// UUIDs, so a retry just upserts the same row again.
import { useSyncExternalStore } from 'react'
import type { RealtimeChannel } from '@supabase/supabase-js'
import { supabase, ensureAuth, isTransient, configured } from './supabase'
import { kv, outbox, type OutItem, type Table } from './db'
import { compressPhoto } from './photo'
import { pinned, nextCheckin, type Dot } from './rules'
import { hasCloseUp, where, ME, STATUS, type Place, type PlaceType, type Venue } from './venue'

// ─── types ────────────────────────────────────────────────────────────────

export interface Member {
  id: string
  crew_id: string
  user_id?: string
  name: string
  color: string
  status: number
  note: string
  battery: number | null
  ghost: boolean
  last_seen: string
  created_at?: string
  acc?: number // PinGü accessory, 0 = none
  net?: number | null // their signal, 0–3, as last reported
  saver?: boolean // data saver on
}

export interface Crew {
  id: string
  name: string
  venue_id: string
  invite_code: string
  meet_spot_place_id: string | null
  meet_spot_note: string
}

export interface Checkin extends Dot {
  crew_id: string
  created_at?: number // first tap at this spot (born moves forward when you extend)
}

export type MsgType = 'text' | 'photo' | 'loc' | 'sys' | 'sos' | 'status'
export interface Message {
  id: string
  crew_id: string
  member_id: string
  type: MsgType
  text: string
  photo_url: string | null
  place_id: string | null
  nx: number | null
  ny: number | null
  born: number
  to_member?: string | null // pings: who it's for
  localPhoto?: string // object URL while the upload waits
}

export interface Preview {
  crew_name: string
  venue_name: string
  event_name: string
  taken_colors: string[]
  members: number
}

export type Screen = 'map' | 'stage' | 'chat' | 'crew' | 'find' | 'shortcut'
export type Sync = 'queued' | 'sending'

export interface State {
  phase: 'boot' | 'unconfigured' | 'welcome' | 'join' | 'ready'
  invite: string | null
  preview: Preview | null
  busy: boolean
  error: string | null
  session: { memberId: string; crewId: string } | null
  venue: Venue | null
  places: Place[]
  crew: Crew | null
  members: Member[]
  checkins: Record<string, Checkin>
  messages: Record<string, Message>
  ghostDot: Checkin | null // your check-in while in ghost mode; never sent
  pending: Record<string, Sync>
  photoFailed: Record<string, boolean>
  signal: 'ok' | 'none'
  syncing: boolean
  myNet: number | null // this phone's signal right now, 0–3
  lastSync: number | null // when we last heard from the server
  dataSaver: boolean
  photosShown: Record<string, true> // in data saver, friends' photos load on tap
  toast: { text: string; icon: string; fg: string; key: number } | null
  ui: {
    screen: Screen
    stage: string
    heat: 'crew' | 'crowd'
    types: Record<PlaceType, boolean>
    areaSel: string | null
    findId: string | null
    sheet: boolean
    sos: boolean
  }
}

const initial: State = {
  phase: 'boot',
  invite: null,
  preview: null,
  busy: false,
  error: null,
  session: null,
  venue: null,
  places: [],
  crew: null,
  members: [],
  checkins: {},
  messages: {},
  ghostDot: null,
  pending: {},
  photoFailed: {},
  signal: typeof navigator !== 'undefined' && !navigator.onLine ? 'none' : 'ok',
  syncing: false,
  myNet: null,
  lastSync: null,
  dataSaver: loadDataSaver(),
  photosShown: {},
  toast: null,
  ui: {
    screen: 'map',
    stage: 'brunch',
    heat: 'crew',
    types: { stage: true, wc: true, bar: true, water: true, medic: true, food: true, picnic: true, open: false },
    areaSel: null,
    findId: null,
    sheet: false,
    sos: false,
  },
}

// ─── row conversion ───────────────────────────────────────────────────────

const ms = (iso: string) => new Date(iso).getTime()
// Server clock minus this phone's clock, from the last sync. Times from the server are
// shifted by it, so a phone set a minute wrong still shows the right ages.
let skew = 0
const fromServer = (t: number) => t - skew
const iso = (t: number) => new Date(t).toISOString()
const uuid = () => crypto.randomUUID()

type Row = Record<string, unknown>
const toCheckin = (r: Row): Checkin => ({
  id: r.id as string,
  crew_id: r.crew_id as string,
  member_id: r.member_id as string,
  place_id: r.place_id as string,
  nx: r.nx as number,
  ny: r.ny as number,
  born: fromServer(ms(r.born as string)),
  life_s: r.life_s as number,
  taps: r.taps as number,
  created_at: r.created_at ? fromServer(ms(r.created_at as string)) : undefined,
})
// created_at is set by the server; don't spend bytes sending it.
const checkinRow = (c: Checkin): Row => {
  const row: Row = { ...c, born: iso(c.born) }
  delete row.created_at
  return row
}
const toMessage = (r: Row): Message => ({ ...(r as unknown as Message), born: fromServer(ms(r.born as string)) })
const withoutLocal = (m: Message) => {
  const rest: Partial<Message> = { ...m }
  delete rest.localPhoto
  return rest
}
const messageRow = (m: Message): Row => ({ ...withoutLocal(m), born: iso(m.born) })

const byId = <T extends { id: string }>(rows: T[]) => Object.fromEntries(rows.map(r => [r.id, r]))

// Compact upload format for crew_sync (short keys, rounded positions, no empty fields).
// a = how long ago it happened, so the server can stamp it on its own clock even if
// it sat in the outbox for ten minutes. b is the phone's own time, for older databases.
const ageNow = (r: Row) => Math.max(0, Date.now() - ms(r.born as string))
const r3 = (n: unknown) => (n == null ? undefined : Math.round((n as number) * 1000) / 1000)
const packCheckin = (r: Row): Row => ({ i: r.id, p: r.place_id, x: r3(r.nx), y: r3(r.ny), a: ageNow(r), b: ms(r.born as string), l: r.life_s, t: r.taps })
const packMessage = (r: Row): Row => ({
  i: r.id,
  k: r.type,
  tx: r.text || undefined,
  u: r.photo_url || undefined,
  p: r.place_id || undefined,
  x: r3(r.nx),
  y: r3(r.ny),
  a: ageNow(r),
  b: ms(r.born as string),
  to: r.to_member || undefined,
})

interface SyncResponse {
  gone?: boolean
  now: string
  rejected: string[]
  members: Member[]
  checkins: [string, string, string, number, number, number, number, number, number][]
  messages: [string, string, MsgType, string, string | null, string | null, number | null, number | null, number, string | null][]
  crew?: Crew
  venue?: Venue
  places?: Place[]
  places_hash?: string
}

const DATA_SAVER_KEY = 'crew-data-saver'
function loadDataSaver() {
  try {
    return localStorage.getItem(DATA_SAVER_KEY) !== '0' // on unless you turned it off
  } catch {
    return true
  }
}

// ─── store ────────────────────────────────────────────────────────────────

class Store {
  state: State = initial
  private listeners = new Set<() => void>()
  private channel: RealtimeChannel | null = null
  private syncing = false
  private syncAgain = false
  private syncTimer: ReturnType<typeof setTimeout> | undefined
  private lastSyncTry = 0
  private netCandidate: number | null = null // level seen once; reported if seen twice in a row
  private netToReport: number | null = null // rides along with the next sync
  private legacyVenueLoaded = false
  private failStreak = 0
  private saveTimer: ReturnType<typeof setTimeout> | undefined
  private toastTimer: ReturnType<typeof setTimeout> | undefined
  private started = false
  private live = false // realtime socket subscribed

  subscribe = (fn: () => void) => {
    this.listeners.add(fn)
    return () => this.listeners.delete(fn)
  }
  get = () => this.state

  private set(patch: Partial<State> | ((s: State) => Partial<State>)) {
    const p = typeof patch === 'function' ? patch(this.state) : patch
    this.state = { ...this.state, ...p }
    this.listeners.forEach(l => l())
    if ('crew' in p || 'members' in p || 'checkins' in p || 'messages' in p || 'venue' in p || 'places' in p || 'ghostDot' in p) this.save()
  }
  ui(patch: Partial<State['ui']>) {
    this.set(s => ({ ui: { ...s.ui, ...patch } }))
  }

  private save() {
    clearTimeout(this.saveTimer)
    this.saveTimer = setTimeout(() => this.saveNow(), 600)
  }
  /** Write the snapshot now (after joining, and when the app goes to the background). */
  saveNow() {
    clearTimeout(this.saveTimer)
    const s = this.state
    if (!s.session) return Promise.resolve()
    const msgs = Object.values(s.messages).map(withoutLocal)
    return kv.set('snapshot', { session: s.session, venue: s.venue, places: s.places, crew: s.crew, members: s.members, checkins: s.checkins, messages: msgs, ghostDot: s.ghostDot })
  }

  toast(text: string, icon = 'ph-bold ph-check', fg = ME) {
    clearTimeout(this.toastTimer)
    this.set({ toast: { text, icon, fg, key: Date.now() } })
    this.toastTimer = setTimeout(() => this.set({ toast: null }), 2200)
  }

  // ─── boot / join ──────────────────────────────────────────────────────

  async boot() {
    if (this.started) return
    this.started = true
    if (!configured) return this.set({ phase: 'unconfigured' })

    const invite = new URLSearchParams(location.search).get('crew')?.trim().toLowerCase() || null
    type Snap = Pick<State, 'session' | 'venue' | 'places' | 'crew' | 'members' | 'checkins' | 'ghostDot'> & { messages: Message[] }
    const snap = await kv.get<Snap>('snapshot')
    const items = await outbox.all()
    const pending: Record<string, Sync> = {}
    const messages = byId(snap?.messages ?? [])
    for (const it of items) {
      pending[it.id] = 'queued'
      if (it.blob && messages[it.id]) messages[it.id] = { ...messages[it.id], localPhoto: URL.createObjectURL(it.blob) }
    }

    // Opened from a notification: jump to the right screen.
    const q = new URLSearchParams(location.search)
    const open = q.get('open')
    if (open) this.openFromNotification(open, q.get('member'))

    if (snap?.session) {
      this.set({ ...snap, messages, pending })
      if (!invite || invite === snap.crew?.invite_code) {
        this.set({ phase: 'ready' })
        if (invite) history.replaceState(null, '', '/')
        return this.start()
      }
    }
    if (invite) return this.openInvite(invite)
    this.set({ phase: 'welcome' })
  }

  async openInvite(code: string) {
    this.set({ phase: 'join', invite: code, preview: null, error: null, busy: true })
    try {
      await ensureAuth()
      const { data, error } = await supabase.rpc('crew_preview', { p_invite: code })
      if (error) throw error
      if (!data) throw new Error('That invite code doesn’t exist. Check the link?')
      this.set({ preview: data as Preview })
    } catch (e) {
      this.set({ error: friendly(e) })
    } finally {
      this.set({ busy: false })
    }
  }

  async createCrew(name: string) {
    this.set({ busy: true, error: null })
    try {
      await ensureAuth()
      const { data, error } = await supabase.rpc('create_crew', { p_name: name })
      if (error) throw error
      await this.openInvite(data as string)
    } catch (e) {
      this.set({ error: friendly(e), busy: false })
    }
  }

  async joinCrew(name: string, color: string, acc = 0) {
    const code = this.state.invite
    if (!code) return
    this.set({ busy: true, error: null })
    try {
      await ensureAuth()
      const { data, error } = await supabase.rpc('join_crew', { p_invite: code, p_name: name, p_color: color })
      if (error) throw error
      const m = data as Member
      if (this.state.session && this.state.session.crewId !== m.crew_id) await this.resetLocal()
      this.set({ session: { memberId: m.id, crewId: m.crew_id }, members: [m] })
      await this.saveNow() // never lose the membership, even if the app is closed right away
      if (acc && acc !== m.acc) this.updateMe({ acc })
      await this.sync()
      await this.saveNow()
      history.replaceState(null, '', '/')
      this.set({ phase: 'ready', busy: false })
      this.start()
    } catch (e) {
      this.set({ error: friendly(e), busy: false })
    }
  }

  async leave() {
    this.channel?.unsubscribe()
    this.channel = null
    await this.resetLocal()
    this.set({ ...initial, phase: 'welcome', signal: this.state.signal })
  }

  private async resetLocal() {
    await outbox.clear()
    await kv.clear()
    this.set({ checkins: {}, messages: {}, members: [], crew: null, ghostDot: null, pending: {} })
  }

  // ─── sync ─────────────────────────────────────────────────────────────

  private start() {
    window.addEventListener('online', () => this.queueSync())
    window.addEventListener('offline', () => this.set({ signal: 'none' }))
    window.addEventListener('pagehide', () => this.saveNow())
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState !== 'visible') return void this.saveNow()
      if (Date.now() - this.lastSyncTry > 5_000) this.queueSync()
    })
    navigator.serviceWorker?.addEventListener('message', e => {
      if (e.data?.type === 'refresh') this.queueSync() // a notification arrived: fetch just that news
      if (e.data?.type === 'open') {
        this.openFromNotification(e.data.open, e.data.member)
        this.queueSync()
      }
    })
    if (new URLSearchParams(location.search).get('open')) history.replaceState(null, '', '/')
    // Data saver: no live connection, check every 60 s while open (notifications trigger checks too).
    // Otherwise a live connection, plus a check every 20 s whenever it's down.
    setInterval(() => {
      if (document.visibilityState !== 'visible') return
      const every = this.state.dataSaver ? 60_000 : this.live ? Infinity : 20_000
      if (Date.now() - this.lastSyncTry >= every - 500) this.sync()
    }, 5_000)
    this.applyDataSaver()
    const me = this.me()
    if (me && me.saver != null && me.saver !== this.state.dataSaver) this.updateMe({ saver: this.state.dataSaver })
    this.sync()
  }

  setDataSaver(on: boolean) {
    try {
      localStorage.setItem(DATA_SAVER_KEY, on ? '1' : '0')
    } catch {
      /* private mode */
    }
    this.set({ dataSaver: on })
    this.applyDataSaver()
    this.updateMe({ saver: on }) // friends see a little leaf on your penguin
  }

  private applyDataSaver() {
    if (this.state.dataSaver) {
      this.channel?.unsubscribe()
      this.channel = null
      this.live = false
    } else if (!this.channel && this.state.session) {
      this.subscribeRealtime(this.state.session.crewId)
    }
  }

  private subscribeRealtime(crewId: string) {
    const f = `crew_id=eq.${crewId}`
    this.channel = supabase
      .channel(`crew-${crewId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'checkins', filter: f }, p => {
        if (p.new && 'id' in p.new) this.mergeCheckins([toCheckin(p.new)])
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages', filter: f }, p => {
        if (p.new && 'id' in p.new) this.mergeMessages([toMessage(p.new)])
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'members', filter: f }, p => {
        if (p.new && 'id' in p.new) this.mergeMembers([p.new as Member])
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'crews', filter: `id=eq.${crewId}` }, p => {
        this.set({ crew: p.new as Crew })
      })
      .subscribe(status => {
        this.live = status === 'SUBSCRIBED'
        if (this.live) this.queueSync() // catch up on anything missed while it was down
      })
  }

  /** Kept for callers that just want fresh data. */
  refresh() {
    return this.sync()
  }

  /** Batch rapid-fire changes (a check-in also touches your profile) into one request. */
  private queueSync(delay = 150) {
    clearTimeout(this.syncTimer)
    this.syncTimer = setTimeout(() => this.sync(), delay)
  }

  /**
   * One round trip: send everything queued, get back only what changed since
   * the last sync. Typically a few hundred bytes each way.
   */
  async sync(): Promise<void> {
    const session = this.state.session
    if (!session) return
    if (this.syncing) {
      this.syncAgain = true
      return
    }
    this.syncing = true
    this.lastSyncTry = Date.now()
    clearTimeout(this.syncTimer)
    this.set({ syncing: true })
    let ok = false
    try {
      await this.uploadPhotos()
      const items = (await outbox.all()).filter(i => !i.blob)
      items.forEach(i => this.setPending(i.id, 'sending'))
      const checkins: Row[] = []
      const messages: Row[] = []
      let me: Row | null = null
      let crew: Row | null = null
      for (const it of items) {
        if (it.table === 'checkins') checkins.push(packCheckin(it.row))
        else if (it.table === 'messages') messages.push(packMessage(it.row))
        else if (it.table === 'members') me = { ...(me ?? {}), ...it.row }
        else if (it.table === 'crews') crew = { ...(crew ?? {}), ...it.row }
      }
      if (me) delete me.last_seen // the server stamps it
      const netSent = this.netToReport
      if (netSent != null) me = { ...(me ?? {}), net: netSent } // a couple of bytes on a request we're making anyway
      const t0 = performance.now()
      const sentAt = Date.now()
      const { data, error, status } = await supabase.rpc('crew_sync', {
        p_member: session.memberId,
        p_since: (await kv.get<string>('cursor')) ?? null,
        p_places: (await kv.get<string>('placesHash')) ?? null,
        p_checkins: checkins,
        p_messages: messages,
        p_me: me,
        p_crew: crew,
      })
      this.measureSignal(error && isTransient(error, status) ? null : performance.now() - t0)
      if (error && (error.code === 'PGRST202' || status === 404)) {
        // The database update (low_data_sync.sql) isn't in yet: use the older, chattier way for now.
        ok = await this.legacySync(items, session.crewId)
        return
      }
      if (error) {
        items.forEach(i => this.setPending(i.id, 'queued'))
        if (isTransient(error, status)) this.set({ signal: 'none' })
        else console.error('sync refused', error)
        return
      }
      ok = true
      const r = data as SyncResponse
      // the server read its clock about halfway through the round trip
      if (r.now) {
        const est = ms(r.now) - (sentAt + Date.now()) / 2
        if (Math.abs(est - skew) > 2000) skew = est // ignore network jitter, catch real clock gaps
      }
      if (r.gone) {
        // Crew deleted (48 h after the event) or you rejoined on another phone.
        this.toast('You’re no longer in this crew', 'ph ph-warning', '#ffd97a')
        return void this.leave()
      }
      for (const it of items) {
        const cur = await outbox.get(it.key)
        if (cur && cur.v !== it.v) {
          this.setPending(it.id, 'queued') // changed while sending; goes in the next sync
          continue
        }
        await outbox.del(it.key)
        this.setPending(it.id, null)
      }
      if (netSent != null && this.netToReport === netSent) this.netToReport = null
      this.applySync(r, session.crewId)
      if (r.rejected.length) {
        // e.g. someone took that color a second earlier. Pull a full copy to undo our local guess.
        this.toast(r.rejected.includes('me') ? 'Couldn’t save that change, try another color or name' : 'Couldn’t send one item', 'ph ph-warning', '#ff7a92')
        await kv.set('cursor', null)
        this.syncAgain = true
      } else {
        await kv.set('cursor', r.now)
      }
      if (r.places_hash) await kv.set('placesHash', r.places_hash)
      this.set({ signal: 'ok', lastSync: Date.now() })
    } catch (e) {
      console.warn('sync failed', e)
      this.measureSignal(null)
      this.set({ signal: 'none' })
    } finally {
      this.syncing = false
      this.failStreak = ok ? 0 : this.failStreak + 1
      this.set({ syncing: false })
      const left = (await outbox.all()).length
      if (this.syncAgain) {
        this.syncAgain = false
        this.queueSync(0)
      } else if (left) {
        this.queueSync(ok ? 300 : this.failStreak > 1 ? 10_000 : 5_000)
      }
    }
  }

  /**
   * Signal level from how long a sync took: 3 great, 2 ok, 1 weak, 0 none.
   * Your own penguin uses it right away; friends get it with a later sync,
   * once the same new level shows up twice in a row (no twitching).
   */
  private measureSignal(ms: number | null) {
    const level = ms == null ? 0 : ms < 1200 ? 3 : ms < 3500 ? 2 : 1
    this.set({ myNet: level })
    const reported = this.me()?.net ?? null
    if (level === reported || level === 0) {
      this.netCandidate = null // can't report "no signal" without signal anyway
      return
    }
    if (this.netCandidate === level) this.netToReport = level
    this.netCandidate = level
  }

  private applySync(r: SyncResponse, crewId: string) {
    if (r.venue && r.places) this.set({ venue: r.venue, places: r.places })
    if (r.crew) this.set({ crew: r.crew })
    if (r.members.length) this.mergeMembers(r.members)
    if (r.checkins.length)
      this.mergeCheckins(
        r.checkins.map(([id, member_id, place_id, nx, ny, born, life_s, taps, created_at]) => ({
          id, member_id, place_id, nx: +nx, ny: +ny, born: fromServer(born), life_s, taps, created_at: created_at && fromServer(created_at), crew_id: crewId,
        })),
      )
    if (r.messages.length)
      this.mergeMessages(
        r.messages.map(([id, member_id, type, text, photo_url, place_id, nx, ny, born, to_member]) => ({
          id, member_id, type, text, photo_url, place_id, nx: nx == null ? null : +nx, ny: ny == null ? null : +ny, born: fromServer(born), to_member, crew_id: crewId,
        })),
      )
  }

  /** Pre-update fallback: send rows one by one, then pull the whole crew. */
  private async legacySync(items: OutItem[], crewId: string): Promise<boolean> {
    for (const it of items) {
      const r = it.op === 'upsert' ? await supabase.from(it.table).upsert(it.row, { onConflict: 'id' }) : await supabase.from(it.table).update(it.row).eq('id', it.id)
      if (r.error && isTransient(r.error, r.status)) {
        items.forEach(i => this.setPending(i.id, 'queued'))
        this.set({ signal: 'none' })
        return false
      }
      const cur = await outbox.get(it.key)
      if (cur && cur.v !== it.v) continue
      await outbox.del(it.key)
      this.setPending(it.id, null)
    }
    const since = iso(Date.now() - 12 * 3600_000)
    const [crew, members, checkins, messages] = await Promise.all([
      supabase.from('crews').select('*').eq('id', crewId).maybeSingle(),
      supabase.from('members').select('*').eq('crew_id', crewId),
      supabase.from('checkins').select('*').eq('crew_id', crewId).gt('born', since).order('born', { ascending: false }).limit(400),
      supabase.from('messages').select('*').eq('crew_id', crewId).order('born', { ascending: false }).limit(300),
    ])
    const failed = [crew, members, checkins, messages].find(r => r.error)
    if (failed || !crew.data) {
      if (failed && isTransient(failed.error, failed.status)) this.set({ signal: 'none' })
      return false
    }
    if (!this.state.venue || !this.state.places.length || !this.legacyVenueLoaded) {
      const venueId = (crew.data as Crew).venue_id
      const [v, p] = await Promise.all([supabase.from('venues').select('*').eq('id', venueId).single(), supabase.from('places').select('*').eq('venue_id', venueId)])
      if (v.data && p.data) this.set({ venue: v.data as Venue, places: p.data as Place[] })
      this.legacyVenueLoaded = true
    }
    this.set({ crew: crew.data as Crew, signal: 'ok', lastSync: Date.now() })
    this.mergeMembers(members.data as Member[])
    this.mergeCheckins((checkins.data as Row[]).map(toCheckin))
    this.mergeMessages((messages.data as Row[]).map(toMessage))
    return true
  }

  /** Photos go up on their own; once uploaded they become a normal message row in the next sync. */
  private async uploadPhotos() {
    for (const it of (await outbox.all()).filter(i => i.blob)) {
      this.setPending(it.id, 'sending')
      const path = `${this.state.session!.crewId}/${it.id}.jpg`
      const up = await supabase.storage.from('photos').upload(path, it.blob!, { contentType: 'image/jpeg', upsert: false })
      if (up.error) {
        const e = up.error as { message: string; status?: number; code?: string }
        const exists = e.status === 409 || e.code === 'ResourceAlreadyExists' || /exists|duplicate/i.test(e.message)
        if (!exists) {
          this.setPending(it.id, 'queued')
          if (isTransient(e, e.status)) {
            this.set(s => ({ photoFailed: { ...s.photoFailed, [it.id]: true } }))
            return // weak signal: try photos again next round, text keeps flowing
          }
          await outbox.del(it.key)
          this.toast('Couldn’t send that photo', 'ph ph-warning', '#ff7a92')
          continue
        }
      }
      const url = supabase.storage.from('photos').getPublicUrl(path).data.publicUrl
      const cur = (await outbox.get(it.key)) ?? it
      await outbox.put({ ...cur, blob: undefined, row: { ...cur.row, photo_url: url }, v: Math.random() })
      this.set(s => ({ messages: { ...s.messages, [it.id]: { ...s.messages[it.id], photo_url: url } } }))
    }
  }

  // Server rows win, except rows we still have queued locally (ours are newer).
  private mergeCheckins(rows: Checkin[]) {
    this.set(s => {
      const next = { ...s.checkins }
      for (const r of rows) if (!s.pending[r.id]) next[r.id] = r
      return { checkins: next }
    })
  }
  private mergeMessages(rows: Message[]) {
    this.set(s => {
      const next = { ...s.messages }
      for (const r of rows) if (!s.pending[r.id]) next[r.id] = { ...r, localPhoto: next[r.id]?.localPhoto }
      return { messages: next }
    })
  }
  private mergeMembers(rows: Member[]) {
    this.set(s => {
      const map = byId(s.members)
      for (const r of rows) if (!s.pending[r.id]) map[r.id] = { ...map[r.id], ...r }
      return { members: Object.values(map) }
    })
  }

  private setPending(id: string, v: Sync | null) {
    this.set(s => {
      const p = { ...s.pending }
      if (v) p[id] = v
      else delete p[id]
      return { pending: p }
    })
  }

  private async enqueue(table: Table, op: OutItem['op'], id: string, row: Row, blob?: Blob) {
    const key = `${table}:${id}`
    const prev = await outbox.get(key)
    await outbox.put({
      key,
      table,
      op,
      id,
      row: op === 'update' && prev ? { ...prev.row, ...row } : row,
      blob: blob ?? prev?.blob,
      createdAt: prev?.createdAt ?? Date.now(),
      v: Math.random(),
    })
    this.setPending(id, 'queued')
    this.queueSync()
  }

  // ─── selectors used by actions ────────────────────────────────────────

  me() {
    const s = this.state
    return s.members.find(m => m.id === s.session?.memberId) ?? null
  }
  ghost() {
    return !!this.me()?.ghost
  }
  /** Your latest dot (the ghost one while ghosting). */
  myDot(): Checkin | null {
    const s = this.state
    if (this.ghost() && s.ghostDot) return s.ghostDot
    return latestDots(s.checkins).get(s.session?.memberId ?? '') ?? null
  }
  /** Live-or-not latest dot per visible friend, with their member row. */
  friendDots() {
    const s = this.state
    const latest = latestDots(s.checkins)
    return s.members
      .filter(m => m.id !== s.session?.memberId && !m.ghost)
      .flatMap(m => {
        const d = latest.get(m.id)
        return d ? [{ ...d, name: m.name, color: m.color }] : []
      })
  }
  place(id: string | null | undefined) {
    return this.state.places.find(p => p.id === id)
  }

  // ─── actions ──────────────────────────────────────────────────────────

  /** Pin on a stage floor (nx/ny 0–1), an area card, or a quick zone. */
  checkIn(placeId: string, nx: number, ny: number, extendAnywhere = false) {
    const s = this.state
    const me = this.me()
    if (!me || !s.session) return
    const now = Date.now()
    const mine = this.myDot()
    const { dot, merged } = nextCheckin(mine, placeId, nx, ny, now, extendAnywhere, uuid)
    const row: Checkin = { ...dot, member_id: me.id, crew_id: s.session.crewId, created_at: merged ? (mine?.created_at ?? now) : now }
    const msg = `${merged ? 'Still here · ' : 'Pinned · '}${where(this.place(placeId), dot.nx, dot.ny)}`

    if (me.ghost) {
      this.set({ ghostDot: row })
      return this.toast(`${msg} · ghost, not shared`, 'ph ph-ghost', 'var(--color-neutral-400)')
    }
    this.set({ checkins: { ...s.checkins, [row.id]: row } })
    this.enqueue('checkins', 'upsert', row.id, checkinRow(row))
    this.updateMe({ last_seen: iso(now) }, true)
    if (s.signal === 'none') this.toast(`${msg} · queued, sends with signal`, 'ph ph-clock', '#ffd97a')
    else this.toast(msg)
  }

  /** Change your own member row (status, note, ghost…). */
  async updateMe(patch: Partial<Member>, withBattery = false) {
    const me = this.me()
    if (!me) return
    if (withBattery) {
      const level = await batteryLevel()
      if (level != null) patch = { ...patch, battery: level }
    }
    this.set(s => ({ members: s.members.map(m => (m.id === me.id ? { ...m, ...patch } : m)) }))
    this.enqueue('members', 'update', me.id, patch as Row)
  }

  setGhost(on: boolean) {
    const s = this.state
    const mine = this.myDot()
    this.updateMe({ ghost: on })
    this.addMessage({ type: 'status', text: on ? 'went ghost' : 'is back from ghost mode' })
    if (on) {
      if (mine && pinned(mine, Date.now())) this.set({ ghostDot: mine })
      this.toast('Ghost on · nothing is shared', 'ph ph-ghost', 'var(--color-neutral-400)')
    } else {
      // Coming back: share the spot you pinned while hidden, if there is one.
      const g = s.ghostDot
      this.set({ ghostDot: null })
      if (g && pinned(g, Date.now())) {
        this.set(st => ({ checkins: { ...st.checkins, [g.id]: g } }))
        this.enqueue('checkins', 'upsert', g.id, checkinRow(g))
      }
    }
  }

  private addMessage(m: Omit<Message, 'id' | 'crew_id' | 'member_id' | 'born' | 'photo_url' | 'place_id' | 'nx' | 'ny' | 'text'> & Partial<Message>, blob?: Blob) {
    const s = this.state
    if (!s.session) return
    const msg: Message = {
      id: uuid(),
      crew_id: s.session.crewId,
      member_id: s.session.memberId,
      born: Date.now(),
      text: '',
      photo_url: null,
      place_id: null,
      nx: null,
      ny: null,
      ...m,
    }
    this.set({ messages: { ...s.messages, [msg.id]: msg } })
    this.enqueue('messages', 'upsert', msg.id, messageRow(msg), blob)
  }

  sendText(text: string) {
    const t = text.trim().slice(0, 500)
    if (t) this.addMessage({ type: 'text', text: t })
  }

  sendLocation() {
    const mine = this.myDot()
    if (!mine || !pinned(mine, Date.now())) return this.toast('Pin where you are first', 'ph ph-map-pin', 'var(--color-neutral-400)')
    this.addMessage({ type: 'loc', place_id: mine.place_id, nx: mine.nx, ny: mine.ny })
  }

  async sendPhoto(file: File) {
    try {
      const blob = await compressPhoto(file)
      const mine = this.myDot()
      const live = mine && pinned(mine, Date.now())
      this.addMessage(
        { type: 'photo', localPhoto: URL.createObjectURL(blob), place_id: live ? mine.place_id : null, nx: live ? mine.nx : null, ny: live ? mine.ny : null },
        blob,
      )
    } catch {
      this.toast('Couldn’t read that photo', 'ph ph-warning', '#ff7a92')
    }
  }

  ping(member: Member) {
    const me = this.me()
    if (!me) return
    this.addMessage({ type: 'sys', text: `${me.name} pinged ${member.name}`, to_member: member.id })
    if (this.state.signal === 'none') this.toast(`Ping queued for ${member.name}`, 'ph ph-clock', member.color)
    else this.toast(`Pinged ${member.name}`, 'ph ph-hand-waving', member.color)
  }

  async sos() {
    const me = this.me()
    const mine = this.myDot()
    const live = mine && pinned(mine, Date.now())
    const battery = (await batteryLevel()) ?? me?.battery
    const spot = live ? where(this.place(mine.place_id), mine.nx, mine.ny) : 'location unknown'
    this.addMessage({
      type: 'sos',
      text: `SOS · ${spot}${battery != null ? ` · ${battery}% battery` : ''}`,
      place_id: live ? mine.place_id : null,
      nx: live ? mine.nx : null,
      ny: live ? mine.ny : null,
    })
  }

  setMeetSpot(placeId: string, note: string) {
    const s = this.state
    if (!s.crew) return
    const patch = { meet_spot_place_id: placeId, meet_spot_note: note.slice(0, 40) }
    this.set({ crew: { ...s.crew, ...patch } })
    this.enqueue('crews', 'update', s.crew.id, patch)
  }

  openFromNotification(open: string, member?: string | null) {
    if (open === 'chat') this.ui({ screen: 'chat', sheet: false, sos: false })
    else if (open === 'find' && member) this.ui({ screen: 'find', findId: member, sheet: false, sos: false })
    else this.ui({ screen: 'map', sheet: false, sos: false })
  }

  showPhoto(id: string) {
    this.set(s => ({ photosShown: { ...s.photosShown, [id]: true } }))
  }

  /** Tell the crew about a status or note change (shows in chat, notifies). */
  postStatus() {
    const me = this.me()
    if (!me) return
    this.addMessage({ type: 'status', text: `${STATUS[me.status]?.[1] ?? 'Vibing'}${me.note ? ` · “${me.note}”` : ''}` })
  }

  /** Jump to wherever a place lives: stages open the floor, areas open their card. */
  openPlace(id: string | null) {
    const p = this.place(id)
    if (!p) return
    if (hasCloseUp(p)) this.ui({ screen: 'stage', stage: p.id, areaSel: null })
    else this.ui({ screen: 'map', areaSel: p.id, types: { ...this.state.ui.types, [p.type]: true } })
  }
}

export function latestDots(checkins: Record<string, Checkin>) {
  const out = new Map<string, Checkin>()
  for (const c of Object.values(checkins)) {
    const cur = out.get(c.member_id)
    if (!cur || c.born > cur.born) out.set(c.member_id, c)
  }
  return out
}

async function batteryLevel(): Promise<number | null> {
  try {
    const nav = navigator as Navigator & { getBattery?: () => Promise<{ level: number }> }
    if (!nav.getBattery) return null // iPhone Safari doesn't expose battery
    return Math.round((await nav.getBattery()).level * 100)
  } catch {
    return null
  }
}

function friendly(e: unknown) {
  const msg = e instanceof Error ? e.message : typeof e === 'object' && e && 'message' in e ? String((e as { message: string }).message) : String(e)
  if (/color taken/.test(msg)) return 'Someone just took that color. Pick another.'
  if (/invite not found/.test(msg)) return 'That invite code doesn’t exist. Check the link?'
  if (/crew is full/.test(msg)) return 'This crew is full (12 people max).'
  if (/anonymous/i.test(msg)) return 'Anonymous sign-ins are off in Supabase. See SETUP.md, step 3.'
  if (/fetch|network|load failed|timeout/i.test(msg)) return 'No connection. Joining needs signal once; try again with wifi or data.'
  return msg
}

export const store = new Store()

export function useStore(): State {
  return useSyncExternalStore(store.subscribe, store.get)
}
