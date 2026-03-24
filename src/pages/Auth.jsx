import { useState, useEffect } from 'react'
import { Navigate, useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'

export default function Auth() {
  const { user, profile, loading: authLoading, signInWithGoogle, signInWithPassword, resetPassword } = useAuth()
  const [searchParams] = useSearchParams()
  const invitedBy = searchParams.get('invited_by')
  const invitedEmail = searchParams.get('email') ? decodeURIComponent(searchParams.get('email')) : ''

  const [email, setEmail] = useState(invitedEmail || '')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [phone, setPhone] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [mode, setMode] = useState(invitedBy && invitedEmail ? 'signup' : 'password')
  const [sending, setSending] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState(null)
  const [trainerName, setTrainerName] = useState('')

  // Fetch trainer name if invited
  useEffect(() => {
    if (!invitedBy) return
    supabase
      .from('profiles')
      .select('full_name')
      .eq('id', invitedBy)
      .single()
      .then(({ data }) => {
        if (data?.full_name) setTrainerName(data.full_name)
      })
  }, [invitedBy])

  if (authLoading) {
    return (
      <div className="min-h-screen bg-[#0f0a19] flex items-center justify-center">
        <span className="material-symbols-outlined text-primary animate-spin text-4xl">progress_activity</span>
      </div>
    )
  }

  if (user && profile) {
    if (!profile.is_onboarded && profile.role !== 'super_admin') {
      return <Navigate to="/onboarding" replace />
    }
    if (profile.role === 'super_admin') return <Navigate to="/admin" replace />
    if (profile.role === 'trainer') return <Navigate to="/trainer" replace />
    return <Navigate to="/client" replace />
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)
    setSuccess(false)
    setSending(true)

    try {
      if (mode === 'forgot') {
        await resetPassword(email)
        setSuccess(true)
      } else if (mode === 'signup') {
        if (password !== confirmPassword) {
          setError('Passwords do not match')
          setSending(false)
          return
        }
        if (password.length < 6) {
          setError('Password must be at least 6 characters')
          setSending(false)
          return
        }
        const cleanPhone = phone.replace(/\s/g, '')
        if (cleanPhone.length < 8) {
          setError('Please enter a valid phone number')
          setSending(false)
          return
        }

        // Sign up new user
        const { data, error: signUpErr } = await supabase.auth.signUp({
          email: email.toLowerCase(),
          password,
          options: {
            data: {
              role: 'client',
              invited_by_trainer: invitedBy,
              phone: cleanPhone,
            },
          },
        })

        if (signUpErr) throw signUpErr

        if (data?.user?.identities?.length === 0) {
          setError('An account with this email already exists. Please sign in instead.')
          setMode('password')
          setSending(false)
          return
        }

        if (data?.user?.id) {
          // Wait for profile to be created by AuthContext trigger
          let profileReady = false
          for (let i = 0; i < 10; i++) {
            const { data: p } = await supabase
              .from('profiles')
              .select('id')
              .eq('id', data.user.id)
              .maybeSingle()
            if (p) { profileReady = true; break }
            await new Promise(r => setTimeout(r, 500))
          }

          if (profileReady) {
            // Save phone + mark as onboarded
            await supabase
              .from('profiles')
              .update({ phone: cleanPhone, is_onboarded: true })
              .eq('id', data.user.id)

            // Create trainer_clients relationship
            if (invitedBy) {
              await supabase.from('trainer_clients').insert({
                trainer_id: invitedBy,
                client_id: data.user.id,
                invited_email: email.toLowerCase(),
                invite_accepted: true,
              }).catch(() => {})

              // Clean up pending invite
              await supabase
                .from('pending_invites')
                .delete()
                .eq('email', email.toLowerCase())
                .eq('trainer_id', invitedBy)
                .catch(() => {})
            }
          }
        }
      } else {
        await signInWithPassword(email, password)
      }
    } catch (err) {
      setError(err.message || 'Authentication failed. Please try again.')
    } finally {
      setSending(false)
    }
  }

  const isSignup = mode === 'signup'
  const isForgot = mode === 'forgot'

  const buttonLabel = isSignup ? 'Create Account' : isForgot ? 'Send Reset Link' : 'Sign In'
  const loadingLabel = isSignup ? 'Creating account...' : isForgot ? 'Sending...' : 'Signing in...'
  const successMsg = isForgot ? 'Password reset email sent! Check your inbox.' : null
  const heading = isSignup
    ? (trainerName ? `${trainerName} invited you!` : 'Create Your Account')
    : isForgot ? 'Reset Password' : 'Welcome Back'
  const subheading = isSignup
    ? 'Set up your password and phone to get started'
    : null

  return (
    <div className="min-h-screen bg-[#0f172a] text-slate-100 relative overflow-hidden flex items-center justify-center p-4">
      <div className="fixed top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary/20 blur-[120px] rounded-full pointer-events-none" />
      <div className="fixed bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-primary/20 blur-[120px] rounded-full pointer-events-none" />
      <div className="absolute inset-0 bg-gradient-to-b from-[#0f172a]/80 via-[#0f172a]/95 to-[#0f172a] z-0" />

      <div className="z-10 w-full max-w-md flex flex-col items-center">
        {/* Logo */}
        <div className="mb-10 flex flex-col items-center group">
          <div className="w-20 h-20 bg-primary rounded-2xl flex items-center justify-center mb-4 shadow-[0_0_20px_rgba(124,59,237,0.3)] transition-transform group-hover:scale-105 duration-300">
            <span className="material-symbols-outlined text-white text-5xl">exercise</span>
          </div>
          <h1 className="text-4xl font-bold tracking-tight text-white">
            Box<span className="text-primary">Flow</span>
          </h1>
          <p className="text-slate-400 mt-2 font-light">Train smarter, flow better</p>
        </div>

        {/* Card */}
        <div className="w-full p-8 rounded-xl shadow-2xl" style={{ background: 'rgba(30, 41, 59, 0.7)', backdropFilter: 'blur(12px)', border: '1px solid rgba(124, 59, 237, 0.2)' }}>
          <h2 className="text-2xl font-semibold text-white mb-1 text-center">{heading}</h2>
          {subheading && <p className="text-sm text-slate-400 text-center mb-6">{subheading}</p>}
          {!subheading && <div className="mb-6" />}

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Email - read-only for invited clients, editable otherwise */}
            {isSignup && invitedEmail ? (
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-300 ml-1">Email</label>
                <div className="relative">
                  <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-slate-500">mail</span>
                  <div className="w-full bg-slate-900/30 border border-slate-700/50 rounded-lg py-3.5 pl-12 pr-4 text-slate-400">
                    {invitedEmail}
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-300 ml-1">Email Address</label>
                <div className="relative group">
                  <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-primary transition-colors">mail</span>
                  <input
                    type="email" required value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@example.com" disabled={sending}
                    className="w-full bg-slate-900/50 border border-slate-700 rounded-lg py-3.5 pl-12 pr-4 text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all disabled:opacity-50"
                  />
                </div>
              </div>
            )}

            {/* Phone (signup only) */}
            {isSignup && (
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-300 ml-1">Phone Number</label>
                <div className="relative group">
                  <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-primary transition-colors">phone_iphone</span>
                  <input
                    type="tel" required value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+972 50 123 4567" disabled={sending}
                    className="w-full bg-slate-900/50 border border-slate-700 rounded-lg py-3.5 pl-12 pr-4 text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all disabled:opacity-50"
                  />
                </div>
              </div>
            )}

            {/* Password (login + signup) */}
            {(mode === 'password' || mode === 'signup') && (
              <div className="space-y-2">
                <div className="flex justify-between items-center ml-1">
                  <label className="text-sm font-medium text-slate-300">Password</label>
                  {mode === 'password' && (
                    <button type="button"
                      onClick={() => { setMode('forgot'); setError(null); setSuccess(false) }}
                      className="text-xs text-slate-400 hover:text-primary transition-colors">
                      Forgot Password?
                    </button>
                  )}
                </div>
                <div className="relative group">
                  <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-primary transition-colors">lock</span>
                  <input
                    type={showPassword ? 'text' : 'password'} required value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder={isSignup ? 'At least 6 characters' : '••••••••'} disabled={sending}
                    className="w-full bg-slate-900/50 border border-slate-700 rounded-lg py-3.5 pl-12 pr-12 text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all disabled:opacity-50"
                  />
                  <button type="button" onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white transition-colors">
                    <span className="material-symbols-outlined text-xl">
                      {showPassword ? 'visibility_off' : 'visibility'}
                    </span>
                  </button>
                </div>
              </div>
            )}

            {/* Confirm Password (signup only) */}
            {isSignup && (
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-300 ml-1">Confirm Password</label>
                <div className="relative group">
                  <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-primary transition-colors">lock</span>
                  <input
                    type={showPassword ? 'text' : 'password'} required value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Repeat password" disabled={sending}
                    className="w-full bg-slate-900/50 border border-slate-700 rounded-lg py-3.5 pl-12 pr-4 text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all disabled:opacity-50"
                  />
                </div>
              </div>
            )}

            {/* Success */}
            {success && successMsg && (
              <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/20 p-3 text-center">
                <p className="text-sm text-emerald-400">{successMsg}</p>
              </div>
            )}

            {/* Error */}
            {error && (
              <div className="rounded-lg bg-red-500/10 border border-red-500/20 p-3 text-center">
                <p className="text-sm text-red-400">{error}</p>
              </div>
            )}

            {/* Submit */}
            <button type="submit"
              disabled={sending || !email || ((mode === 'password' || mode === 'signup') && !password) || (mode === 'signup' && (!confirmPassword || !phone))}
              className="w-full bg-gradient-to-r from-primary to-purple-500 text-white font-semibold py-4 rounded-lg shadow-lg shadow-primary/20 hover:shadow-primary/40 hover:scale-[1.01] active:scale-[0.99] transition-all duration-200 mt-2 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100">
              {sending ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="material-symbols-outlined animate-spin text-lg">progress_activity</span>
                  {loadingLabel}
                </span>
              ) : buttonLabel}
            </button>
          </form>

          {/* Divider */}
          <div className="relative my-8">
            <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-slate-700" /></div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-[#1e293b] px-2 text-slate-500">Or continue with</span>
            </div>
          </div>

          {/* Google */}
          <button type="button"
            onClick={async () => {
              try {
                if (invitedBy) localStorage.setItem('boxflow_invited_by', invitedBy)
                await signInWithGoogle()
              } catch (err) { setError(err.message) }
            }}
            className="w-full flex items-center justify-center gap-3 bg-white hover:bg-gray-50 border border-slate-300 py-3 rounded-lg text-sm font-medium text-slate-800 transition-colors">
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09a7.12 7.12 0 0 1 0-4.18V7.07H2.18A11.99 11.99 0 0 0 1 12c0 1.78.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
            Continue with Google
          </button>
        </div>

        {/* Footer */}
        <div className="mt-8 flex flex-col items-center space-y-4">
          {mode === 'forgot' && (
            <button type="button"
              onClick={() => { setMode('password'); setError(null); setSuccess(false) }}
              className="text-primary font-semibold hover:underline decoration-primary/30 underline-offset-4">
              Back to Sign In
            </button>
          )}
          {mode === 'signup' && !invitedBy && (
            <button type="button"
              onClick={() => { setMode('password'); setError(null) }}
              className="text-primary font-semibold hover:underline decoration-primary/30 underline-offset-4">
              Already have an account? Sign In
            </button>
          )}
          {mode === 'password' && (
            <button type="button"
              onClick={() => { setMode('signup'); setError(null) }}
              className="text-primary font-semibold hover:underline decoration-primary/30 underline-offset-4">
              Don't have an account? Sign Up
            </button>
          )}
          <div className="flex gap-4 text-xs text-slate-500">
            <span>Privacy Policy</span>
            <span className="w-1 h-1 rounded-full bg-slate-700 self-center" />
            <span>Terms of Service</span>
          </div>
        </div>
      </div>
    </div>
  )
}
