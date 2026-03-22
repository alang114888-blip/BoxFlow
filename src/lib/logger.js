import { supabase } from './supabase'

export async function logError(action, error, details = {}) {
  const msg = error?.message || String(error)
  console.error(`[BoxFlow Error] ${action}:`, msg, details)
  try {
    const { data: { user } } = await supabase.auth.getUser()
    await supabase.from('error_logs').insert({
      user_id: user?.id || null,
      action,
      error_message: msg,
      error_details: { ...details, timestamp: new Date().toISOString() },
    })
  } catch (e) {
    console.error('Failed to log error:', e)
  }
}

export function logAction(action, details = {}) {
  console.log(`[BoxFlow] ${action}:`, details)
}
