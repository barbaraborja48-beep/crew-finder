import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

export const configured = !!url && !!key
export const SUPABASE_URL = url ?? ''
export const SUPABASE_ANON_KEY = key ?? ''

// With one bar of signal a request can hang for minutes. A sync is a few hundred bytes, so
// if it hasn't come back in 10 s it's stuck: give up and let the outbox retry right away
// (a fresh try often gets through where the stuck one never would). Photos get longer.
const timedFetch: typeof fetch = (input, init) => {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
  const limit = url.includes('/storage/v1/') ? 30_000 : 10_000
  return fetch(input, { ...init, signal: init?.signal ?? AbortSignal.timeout(limit) })
}

export const supabase = createClient(url || 'http://localhost:54321', key || 'missing', {
  global: { fetch: timedFetch },
  auth: { persistSession: true, autoRefreshToken: true },
})

/** Make sure this device has an (anonymous) Supabase session. */
export async function ensureAuth() {
  const { data } = await supabase.auth.getSession()
  if (data.session) return data.session.user.id
  const { data: d, error } = await supabase.auth.signInAnonymously()
  if (error) throw error
  return d.user!.id
}

/** True if this looks like "no signal" rather than a real rejection. */
export function isTransient(error: { message?: string; code?: string } | null, status?: number) {
  if (!error) return false
  if (!status || status === 401 || status === 408 || status === 429 || status >= 500) return true
  return /fetch|network|load failed|abort|timeout|jwt/i.test(error.message ?? '')
}
