// Web Push on this phone: ask permission, subscribe, tell Supabase who to notify.
import { supabase } from './supabase'
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

/** The notification key, via the database. First time, the database asks the server to make it. */
async function publicKey() {
  for (let i = 0; i < 6; i++) {
    const { data, error } = await supabase.rpc('push_public_key', { p_origin: location.origin })
    if (error) throw new Error(/push_public_key/.test(error.message) ? 'Run the latest database fix first (SETUP.md, step 10).' : error.message)
    if (data) return data as string
    await new Promise(r => setTimeout(r, 1500))
  }
  throw new Error('The notification server didn’t answer. Check the push function is deployed (SETUP.md, step 10).')
}

/** Low data mode pauses pin and chat notifications at the server; SOS, pings and meet spot still come through. */
const effective = (prefs: PushPrefs, lowData: boolean): PushPrefs => (lowData ? { updates: false, chat: false } : prefs)

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
export async function enablePush(memberId: string, prefs: PushPrefs, lowData = false) {
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
  await save(memberId, sub, effective(prefs, lowData))
  localStorage.setItem(PREFS_KEY, JSON.stringify(prefs))
}

/** Your switches are remembered as you set them; the server gets what applies in your mode. */
export async function updatePrefs(memberId: string, prefs: PushPrefs, lowData = false) {
  localStorage.setItem(PREFS_KEY, JSON.stringify(prefs))
  const sub = await (await navigator.serviceWorker.getRegistration())?.pushManager.getSubscription()
  if (sub) await save(memberId, sub, effective(prefs, lowData))
}

/** After switching modes: tell the server which notifications this phone wants now. */
export async function syncPushPrefs(memberId: string, lowData: boolean) {
  const sub = await (await navigator.serviceWorker?.getRegistration())?.pushManager.getSubscription()
  if (sub) await save(memberId, sub, effective(loadPrefs(), lowData))
}

export async function disablePush() {
  const sub = await (await navigator.serviceWorker.getRegistration())?.pushManager.getSubscription()
  if (!sub) return
  await supabase.rpc('remove_push_subscription', { p_endpoint: sub.endpoint })
  await sub.unsubscribe()
}
