import { createContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

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

    // Try to fetch profile
    const { data: existingProfile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', session.user.id)
      .maybeSingle()

    if (existingProfile) {
      setProfile(existingProfile)
      setLoading(false)
      return
    }

    // Profile doesn't exist — create it
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
    // 1. Load current session on mount
    supabase.auth.getSession().then(({ data: { session } }) => {
      loadUser(session)
    })

    // 2. React to login/logout
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
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: window.location.origin },
    })
    if (error) throw error
  }

  async function signInWithPassword(email, password) {
    setLoading(true)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      setLoading(false)
      throw error
    }
    // onAuthStateChange SIGNED_IN will call loadUser
  }

  async function signOut() {
    const { error } = await supabase.auth.signOut()
    if (error) throw error
    setUser(null)
    setProfile(null)
  }

  return (
    <AuthContext.Provider value={{ user, profile, loading, signIn, signInWithPassword, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}
