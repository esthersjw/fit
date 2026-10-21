import { createClient, type Session as AuthSession } from '@supabase/supabase-js'
import type { AppData } from './types'
import type { Summary } from './summary'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

/** null when the build has no Supabase config → the app quietly stays local-only. */
export const sb = url && key ? createClient(url, key, { auth: { persistSession: true, autoRefreshToken: true } }) : null
export const cloudEnabled = !!sb
export const supabaseUrl = url ?? ''
export const supabaseAnonKey = key ?? ''

export type { AuthSession }

export async function signIn(email: string, password: string) {
  const { error } = await sb!.auth.signInWithPassword({ email, password })
  if (error) throw error
}

/** Returns false when the project still requires email confirmation (no session yet). */
export async function signUp(email: string, password: string): Promise<boolean> {
  const { data, error } = await sb!.auth.signUp({ email, password })
  if (error) throw error
  // Supabase hides "already registered" behind an empty identities list.
  if (data.user && data.user.identities?.length === 0) throw new Error('User already registered')
  return !!data.session
}

// local scope: only this device, and works offline or if the account is already gone
export const signOut = () => sb!.auth.signOut({ scope: 'local' })

export async function pull(userId: string): Promise<{ data: AppData; updatedAt: number } | null> {
  const { data, error } = await sb!.from('user_data').select('data, updated_at').eq('user_id', userId).maybeSingle()
  if (error) throw error
  return data ? { data: data.data as AppData, updatedAt: Date.parse(data.updated_at) } : null
}

export async function push(userId: string, data: AppData, summary: Summary, at: number) {
  const { error } = await sb!
    .from('user_data')
    .upsert({ user_id: userId, data, summary, updated_at: new Date(at).toISOString() })
  if (error) throw error
}

// ---- agent keys: random secret shown once, only its sha256 is stored ----

const hex = (buf: ArrayBuffer) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('')
const sha256 = async (s: string) => hex(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)))

export interface AgentKey { id: string; label: string | null; created_at: string; last_used_at: string | null }

export async function listKeys(): Promise<AgentKey[]> {
  const { data, error } = await sb!.from('agent_tokens').select('id, label, created_at, last_used_at').is('revoked_at', null).order('created_at')
  if (error) throw error
  return data ?? []
}

export async function createKey(label: string): Promise<string> {
  const token = `fit_${hex(crypto.getRandomValues(new Uint8Array(24)).buffer)}`
  const { error } = await sb!.from('agent_tokens').insert({ token_hash: await sha256(token), label })
  if (error) throw error
  return token
}

export async function revokeKey(id: string) {
  const { error } = await sb!.from('agent_tokens').update({ revoked_at: new Date().toISOString() }).eq('id', id)
  if (error) throw error
}
