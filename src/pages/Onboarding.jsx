import { useState, useEffect } from 'react'
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import PasswordInput, { validatePassword, validatePasswordMatch } from '../components/PasswordInput'

export default function Onboarding() {
  const { user, profile, loading: authLoading } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [verifying, setVerifying] = useState(true) // start as true
  const [sessionReady, setSessionReady] = useState(false)

  // Handle ALL token types: hash fragment (#access_token) + query param (?token_hash)
  useEffect(() => {
    async function processTokens() {
      // Already have a session
      if (user) {
        console.log('Onboarding: user already authenticated')
        setSessionReady(true)
        setVerifying(false)
        return
      }

      // Method 1: Hash fragment (#access_token=...&type=invite)
      const hash = window.location.hash.substring(1)
      if (hash) {
        const hashParams = new URLSearchParams(hash)
        const accessToken = hashParams.get('access_token')
        const refreshToken = hashParams.get('refresh_token')
        const type = hashParams.get('type')

        if (accessToken) {
          console.log('Onboarding: found access_token in hash, type:', type)
          const { data, error: sessErr } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken || '',
          })
          if (sessErr) {
            console.error('Onboarding: setSession error:', sessErr.message)
            setError('Invalid or expired invite link.')
          } else if (data.session) {
            console.log('Onboarding: session set from hash token')
            setSessionReady(true)
            // Clear the hash from URL
            window.history.replaceState(null, '', window.location.pathname)
          }
          setVerifying(false)
          return
        }
      }

      // Method 2: Query param (?token_hash=...&type=invite)
      const tokenHash = searchParams.get('token_hash')
      const tokenType = searchParams.get('type')

      if (tokenHash) {
        console.log('Onboarding: found token_hash in query, type:', tokenType)

        // Try the specified type first, then fallback to other types
        const typesToTry = tokenType === 'invite'
          ? ['invite', 'magiclink', 'email']
          : ['magiclink', 'invite', 'email']

        let success = false
        for (const t of typesToTry) {
          const { data: otpData, error: verifyErr } = await supabase.auth.verifyOtp({
            token_hash: tokenHash,
            type: t,
          })
          if (!verifyErr && otpData?.session) {
            console.log('Onboarding: token verified with type:', t)
            setSessionReady(true)
            success = true
            break
          }
          console.log('Onboarding: verifyOtp type', t, 'failed:', verifyErr?.message)
        }

        if (!success) {
          setError('Invalid or expired invite link.')
        }
        setVerifying(false)
        return
      }

      // Method 3: PKCE code (?code=...)
      const code = searchParams.get('code')
      if (code) {
        console.log('Onboarding: found PKCE code in query')
        const { error: codeErr } = await supabase.auth.exchangeCodeForSession(code)
        if (codeErr) {
          console.error('Onboarding: exchangeCode error:', codeErr.message)
          setError('Invalid or expired invite link.')
        } else {
          console.log('Onboarding: PKCE code exchanged for session')
          setSessionReady(true)
        }
        setVerifying(false)
        return
      }

      // No tokens at all — wait for AuthContext to catch up
      // (onAuthStateChange might fire SIGNED_IN from another source)
      console.log('Onboarding: no tokens in URL, waiting for auth...')
      // Give AuthContext 2 seconds to establish session
      await new Promise(r => setTimeout(r, 2000))
      const { data: { session } } = await supabase.auth.getSession()
      if (session) {
        console.log('Onboarding: session found after wait')
        setSessionReady(true)
      }
      setVerifying(false)
    }

    processTokens()
  }, [user, searchParams])

  // Show spinner while verifying token or loading auth
  if (authLoading || verifying) {
    return (
      <div className="min-h-screen bg-[#0f0a19] flex items-center justify-center">
        <span className="material-symbols-outlined text-primary animate-spin text-4xl">progress_activity</span>
      </div>
    )
  }

  // No token, no user, no session → go to login
  const hasTokenInUrl = window.location.hash.includes('access_token') || searchParams.get('token_hash')
  if (!user && !hasTokenInUrl && !sessionReady) return <Navigate to="/login" replace />

  // Token failed and no user → show friendly expired page
  if (!user && !sessionReady && error) {
    return (
      <div className="min-h-screen bg-[#0f172a] text-slate-100 relative overflow-hidden flex items-center justify-center p-4">
        <div className="fixed top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary/20 blur-[120px] rounded-full pointer-events-none" />
        <div className="fixed bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-primary/20 blur-[120px] rounded-full pointer-events-none" />
        <div className="absolute inset-0 bg-gradient-to-b from-[#0f172a]/80 via-[#0f172a]/95 to-[#0f172a] z-0" />

        <div className="z-10 w-full max-w-md flex flex-col items-center">
          <div className="w-16 h-16 bg-red-500/20 rounded-2xl flex items-center justify-center mb-4">
            <span className="material-symbols-outlined text-red-400 text-4xl">link_off</span>
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">Invite Link Expired</h2>
          <p className="text-slate-400 text-sm text-center mb-6">
            This invite link is no longer valid. Links can only be used once and expire after 24 hours.
          </p>

          <div className="w-full p-6 rounded-xl space-y-4" style={{ background: 'rgba(30, 41, 59, 0.7)', backdropFilter: 'blur(12px)', border: '1px solid rgba(124, 59, 237, 0.2)' }}>
            <p className="text-sm text-slate-300 text-center">What would you like to do?</p>

            <button
              onClick={() => navigate('/login')}
              className="w-full bg-gradient-to-r from-primary to-purple-500 text-white font-semibold py-3.5 rounded-lg shadow-lg shadow-primary/20 hover:shadow-primary/40 transition-all flex items-center justify-center gap-2"
            >
              <span className="material-symbols-outlined text-[20px]">login</span>
              Sign In (if you already have a password)
            </button>

            <div className="relative">
              <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-slate-700" /></div>
              <div className="relative flex justify-center text-xs uppercase"><span className="bg-[#1e293b] px-2 text-slate-500">or</span></div>
            </div>

            <p className="text-xs text-slate-400 text-center">
              Ask your trainer to send a new invite from their BoxFlow dashboard → Clients → Resend Invite
            </p>
          </div>
        </div>
      </div>
    )
  }

  // Skip onboarding for admins or already-onboarded users
  if (profile?.role === 'super_admin' || profile?.is_onboarded) {
    if (profile.role === 'super_admin') return <Navigate to="/admin" replace />
    if (profile.role === 'trainer') return <Navigate to="/trainer" replace />
    return <Navigate to="/client" replace />
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)

    const cleanPhone = phone.replace(/\s/g, '')
    if (cleanPhone.length < 8) {
      setError('Please enter a valid phone number')
      return
    }

    const { allPassed } = validatePassword(password)
    if (!allPassed) {
      setError('Password does not meet all requirements')
      return
    }
    if (!validatePasswordMatch(password, confirmPassword)) {
      setError('Passwords do not match')
      return
    }

    setSaving(true)
    try {
      // Set password
      const { error: pwErr } = await supabase.auth.updateUser({ password })
      if (pwErr) throw pwErr

      // Save phone and mark as onboarded
      const { error: profileErr } = await supabase
        .from('profiles')
        .update({ phone: cleanPhone, is_onboarded: true })
        .eq('id', user.id)

      if (profileErr) throw profileErr

      // For trainers: create trainer_profiles record
      if (profile?.role === 'trainer') {
        const trainerType = user.user_metadata?.trainer_type || 'fitness'
        await supabase.from('trainer_profiles').upsert(
          { user_id: user.id, trainer_type: trainerType },
          { onConflict: 'user_id' }
        ).catch(() => {})
      }

      // Resolve pending invites → create trainer_clients
      const clientEmail = (user.email || '').toLowerCase()
      console.log('Onboarding: resolving pending invites for', clientEmail)

      const { data: allPending } = await supabase
        .from('pending_invites')
        .select('id, trainer_id, email')

      const myInvites = (allPending || []).filter(
        pi => pi.email.toLowerCase() === clientEmail
      )
      console.log('Onboarding: found', myInvites.length, 'pending invites')

      for (const inv of myInvites) {
        const { error: tcErr } = await supabase.from('trainer_clients').insert({
          trainer_id: inv.trainer_id,
          client_id: user.id,
          invited_email: clientEmail,
          invite_accepted: true,
        })
        if (tcErr) console.error('trainer_clients insert error:', tcErr.message)
        else console.log('trainer_clients created:', inv.trainer_id, '→', user.id)

        await supabase.from('pending_invites').delete().eq('id', inv.id)
      }

      // Fallback: check metadata for invited_by_trainer
      const invitedBy = user.user_metadata?.invited_by_trainer
      if (invitedBy && myInvites.length === 0) {
        await supabase.from('trainer_clients').insert({
          trainer_id: invitedBy,
          client_id: user.id,
          invited_email: clientEmail,
          invite_accepted: true,
        }).catch(() => {})
      }

      // Auto-assign default PR exercises
      const { data: tc } = await supabase
        .from('trainer_clients')
        .select('trainer_id')
        .eq('client_id', user.id)
        .eq('invite_accepted', true)
        .maybeSingle()

      if (tc?.trainer_id) {
        const { data: defaults } = await supabase
          .from('trainer_default_exercises')
          .select('exercise_id')
          .eq('trainer_id', tc.trainer_id)

        if (defaults?.length > 0) {
          for (const d of defaults) {
            await supabase.from('client_prs').upsert({
              client_id: user.id,
              exercise_id: d.exercise_id,
              weight_kg: 0,
              date_achieved: new Date().toISOString().split('T')[0],
            }, { onConflict: 'client_id,exercise_id', ignoreDuplicates: true }).catch(() => {})
          }
        }
      }

      // Redirect
      console.log('Onboarding complete, redirecting...')
      if (profile?.role === 'trainer') {
        navigate('/trainer', { replace: true })
      } else {
        navigate('/client', { replace: true })
      }
    } catch (err) {
      setError(err.message || 'Something went wrong')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#0f172a] text-slate-100 relative overflow-hidden flex items-center justify-center p-4">
      <div className="fixed top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary/20 blur-[120px] rounded-full pointer-events-none" />
      <div className="fixed bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-primary/20 blur-[120px] rounded-full pointer-events-none" />
      <div className="absolute inset-0 bg-gradient-to-b from-[#0f172a]/80 via-[#0f172a]/95 to-[#0f172a] z-0" />

      <div className="z-10 w-full max-w-md flex flex-col items-center">
        <div className="mb-8 flex flex-col items-center">
          <div className="w-16 h-16 bg-primary rounded-2xl flex items-center justify-center mb-4 shadow-[0_0_20px_rgba(124,59,237,0.3)]">
            <span className="material-symbols-outlined text-white text-4xl">exercise</span>
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-white">
            Welcome to Box<span className="text-primary">Flow</span>
          </h1>
          <p className="text-slate-400 mt-2 font-light text-center">Complete your profile to get started</p>
        </div>

        <div className="w-full p-8 rounded-xl shadow-2xl"
          style={{ background: 'rgba(30, 41, 59, 0.7)', backdropFilter: 'blur(12px)', border: '1px solid rgba(124, 59, 237, 0.2)' }}>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-300 ml-1">Phone Number</label>
              <div className="relative group">
                <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-primary transition-colors">phone_iphone</span>
                <input
                  type="tel" required value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+972 50 123 4567" disabled={saving}
                  className="w-full bg-slate-900/50 border border-slate-700 rounded-lg py-3.5 pl-12 pr-4 text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all disabled:opacity-50"
                />
              </div>
              <p className="text-[10px] text-slate-500 ml-1">Include country code</p>
            </div>

            <PasswordInput
              password={password} setPassword={setPassword}
              confirmPassword={confirmPassword} setConfirmPassword={setConfirmPassword}
              disabled={saving}
            />

            {error && (
              <div className="rounded-lg bg-red-500/10 border border-red-500/20 p-3 text-center">
                <p className="text-sm text-red-400">{error}</p>
              </div>
            )}

            <button type="submit" disabled={saving}
              className="w-full bg-gradient-to-r from-primary to-purple-500 text-white font-semibold py-4 rounded-lg shadow-lg shadow-primary/20 hover:shadow-primary/40 hover:scale-[1.01] active:scale-[0.99] transition-all duration-200 disabled:opacity-50 disabled:hover:scale-100 flex items-center justify-center gap-2">
              {saving ? (
                <><span className="material-symbols-outlined animate-spin text-lg">progress_activity</span> Setting up...</>
              ) : (
                <><span className="material-symbols-outlined">arrow_forward</span> Complete Setup</>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
