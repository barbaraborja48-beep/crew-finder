// Web Push on this phone: ask permission, subscribe, tell Supabase who to notify.
import { supabase, SUPABASE_ANON_KEY, SUPABASE_URL } from './supabase'
import { isIOS, isStandalone } from './view'

export interface PushPrefs {
  updates: boolean // friends checking in somewhere new, status changes
  chat: boolean // chat messages (SOS and pings always come through)
}

const PREFS_KEY = 'crew-push-prefs'

export function loadPrefs(): PushPrefs {
  try {
    return { updates: true, chat: true, ...JSON.parse(localStorage.getItem(PREFS_KEY) ?? '{}') }
  } catch {
    return { updates: true, chat: true }
  }
}

export type PushState = 'unsupported' | 'install-first' | 'blocked' | 'off' | 'on'

export async function pushState(): Promise<PushState> {
  if (isIOS() && !isStandalone()) return 'install-first' // iPhone only allows it for Home Screen apps
  if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) return 'unsupported'
  if (Notification.permission === 'denied') return 'blocked'
  const reg = await navigator.serviceWorker.getRegistration()
  const sub = await reg?.pushManager.getSubscription()
  return sub && Notification.permission === 'granted' ? 'on' : 'off'
}

const b64ToBytes = (b64: string) => {
  const s = atob((b64 + '='.repeat((4 - (b64.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/'))
  return Uint8Array.from(s, c => c.charCodeAt(0))
}

async function publicKey() {
  const r = await fetch(`${SUPABASE_URL}/functions/v1/push`, { headers: { apikey: SUPABASE_ANON_KEY } })
  if (!r.ok) throw new Error('Notifications aren’t set up on the server yet (SETUP.md, step 11).')
  const { publicKey } = await r.json()
  if (!publicKey) throw new Error('Notifications aren’t set up on the server yet (SETUP.md, step 11).')
  return publicKey as string
}

async function save(memberId: string, sub: PushSubscription, prefs: PushPrefs) {
  const j = sub.toJSON()
  const { error } = await supabase.rpc('save_push_subscription', {
    p_member: memberId,
    p_endpoint: j.endpoint,
    p_p256dh: j.keys!.p256dh,
    p_auth: j.keys!.auth,
    p_updates: prefs.updates,
    p_chat: prefs.chat,
  })
  if (error) throw error
}

/** Must run from a tap: iPhones only show the permission prompt after a user gesture. */
export async function enablePush(memberId: string, prefs: PushPrefs) {
  const permission = await Notification.requestPermission()
  if (permission !== 'granted') throw new Error('Notifications are blocked. Turn them on in Settings → Notifications → Crew.')
  const reg = await navigator.serviceWorker.ready
  let sub = await reg.pushManager.getSubscription()
  if (!sub) {
    const key = b64ToBytes(await publicKey())
    try {
      sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key })
    } catch {
      throw new Error('Couldn’t turn on notifications in this browser. On iPhone, open Crew from your Home Screen and try again.')
    }
  }
  await save(memberId, sub, prefs)
  localStorage.setItem(PREFS_KEY, JSON.stringify(prefs))
}

export async function updatePrefs(memberId: string, prefs: PushPrefs) {
  localStorage.setItem(PREFS_KEY, JSON.stringify(prefs))
  const sub = await (await navigator.serviceWorker.getRegistration())?.pushManager.getSubscription()
  if (sub) await save(memberId, sub, prefs)
}

export async function disablePush() {
  const sub = await (await navigator.serviceWorker.getRegistration())?.pushManager.getSubscription()
  if (!sub) return
  await supabase.rpc('remove_push_subscription', { p_endpoint: sub.endpoint })
  await sub.unsubscribe()
}
