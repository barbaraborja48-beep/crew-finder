import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

export const configured = !!url && !!key
export const SUPABASE_URL = url ?? ''
export const SUPABASE_ANON_KEY = key ?? ''

// With one bar of signal a request can hang for minutes. Give up after 20 s
// and let the outbox retry instead.
const timedFetch: typeof fetch = (input, init) => fetch(input, { ...init, signal: init?.signal ?? AbortSignal.timeout(20_000) })

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
