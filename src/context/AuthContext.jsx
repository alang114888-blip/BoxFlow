import { createContext, useEffect, useState } from 'react'
import { supabase, SITE_URL } from '../lib/supabase'

export const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  async function loadUser(session) {
    if (!session?.user) {
      setUser(null)
      setProfile(null)
      setLoading(false)
      return
    }

    setUser(session.user)

    const { data: existingProfile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', session.user.id)
      .maybeSingle()

    if (existingProfile) {
      // Clear failed attempts on successful login
      if (existingProfile.failed_attempts > 0) {
        await supabase.rpc('clear_failed_login', { user_email: existingProfile.email })
      }
      setProfile(existingProfile)
      setLoading(false)
      return
    }

    const meta = session.user.user_metadata || {}
    const { data: newProfile } = await supabase
      .from('profiles')
      .insert({
        id: session.user.id,
        email: session.user.email,
        full_name: meta.full_name || session.user.email.split('@')[0],
        role: meta.role || 'client',
      })
      .select()
      .single()

    setProfile(newProfile)
    setLoading(false)
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      loadUser(session)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (event === 'SIGNED_IN' || event === 'SIGNED_OUT' || event === 'TOKEN_REFRESHED') {
          loadUser(session)
        }
      }
    )

    return () => subscription.unsubscribe()
  }, [])

  async function signIn(email) {
    // Check if locked before sending magic link
    const { data: lockCheck } = await supabase.rpc('check_account_locked', { user_email: email })
    if (lockCheck?.locked) {
      throw new Error('Account locked — contact your trainer or admin to unlock.')
    }
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: SITE_URL },
    })
    if (error) throw error
  }

  async function signInWithPassword(email, password) {
    // Check if locked
    const { data: lockCheck } = await supabase.rpc('check_account_locked', { user_email: email })
    if (lockCheck?.locked) {
      throw new Error('Account locked — contact your trainer or admin to unlock.')
    }

    setLoading(true)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      setLoading(false)
      // Record failed attempt
      const { data: result } = await supabase.rpc('record_failed_login', { user_email: email })
      if (result?.status === 'locked') {
        throw new Error('Account locked after too many failed attempts. Contact your trainer or admin.')
      }
      const remaining = result?.remaining
      if (remaining != null && remaining <= 2) {
        throw new Error(`Invalid credentials. ${remaining} attempt${remaining !== 1 ? 's' : ''} remaining before lockout.`)
      }
      throw error
    }
  }

  async function changePassword(newPassword) {
    if (!user) throw new Error('Not authenticated')
    // Check password history
    const { data: wasUsed } = await supabase.rpc('check_password_history', {
      target_user_id: user.id,
      new_password: newPassword,
    })
    if (wasUsed) {
      throw new Error('You cannot reuse a recent password. Please choose a new one.')
    }
    // Update password
    const { error } = await supabase.auth.updateUser({ password: newPassword })
    if (error) throw error
    // Save to history
    await supabase.rpc('save_password_history', {
      target_user_id: user.id,
      new_password: newPassword,
    })
  }

  async function resetPassword(email) {
    const { data: lockCheck } = await supabase.rpc('check_account_locked', { user_email: email })
    if (lockCheck?.locked) {
      throw new Error('Account locked — contact your trainer or admin to unlock.')
    }
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: SITE_URL,
    })
    if (error) throw error
  }

  async function signOut() {
    const { error } = await supabase.auth.signOut()
    if (error) throw error
    setUser(null)
    setProfile(null)
  }

  return (
    <AuthContext.Provider value={{ user, profile, loading, signIn, signInWithPassword, changePassword, resetPassword, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}
