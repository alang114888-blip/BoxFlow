import { useState } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'

export default function Auth() {
  const { user, profile, loading: authLoading, signIn, signInWithPassword, resetPassword } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [mode, setMode] = useState('password') // 'password' | 'magic' | 'forgot'
  const [sending, setSending] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState(null)

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
      } else if (mode === 'magic') {
        await signIn(email)
        setSuccess(true)
        setEmail('')
      } else {
        await signInWithPassword(email, password)
      }
    } catch (err) {
      setError(err.message || 'Authentication failed. Please try again.')
    } finally {
      setSending(false)
    }
  }

  const buttonLabel = { password: 'Sign In', magic: 'Send Magic Link', forgot: 'Send Reset Link' }[mode]
  const loadingLabel = { password: 'Signing in...', magic: 'Sending...', forgot: 'Sending...' }[mode]
  const successMsg = { magic: 'Check your email for the login link!', forgot: 'Password reset email sent! Check your inbox.' }[mode]
  const heading = { password: 'Welcome Back', magic: 'Magic Link', forgot: 'Reset Password' }[mode]

  return (
    <div className="min-h-screen bg-[#0f172a] text-slate-100 relative overflow-hidden flex items-center justify-center p-4">
      {/* Decorative Glows */}
      <div className="fixed top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary/20 blur-[120px] rounded-full pointer-events-none" />
      <div className="fixed bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-primary/20 blur-[120px] rounded-full pointer-events-none" />

      {/* Background Gradient Overlay */}
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

        {/* Login Card */}
        <div className="w-full p-8 rounded-xl shadow-2xl" style={{ background: 'rgba(30, 41, 59, 0.7)', backdropFilter: 'blur(12px)', border: '1px solid rgba(124, 59, 237, 0.2)' }}>
          <h2 className="text-2xl font-semibold text-white mb-6 text-center">{heading}</h2>

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Email Field */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-300 ml-1">Email Address</label>
              <div className="relative group">
                <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-primary transition-colors">mail</span>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@example.com"
                  disabled={sending}
                  className="w-full bg-slate-900/50 border border-slate-700 rounded-lg py-3.5 pl-12 pr-4 text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all disabled:opacity-50"
                />
              </div>
            </div>

            {/* Password Field */}
            {mode === 'password' && (
              <div className="space-y-2">
                <div className="flex justify-between items-center ml-1">
                  <label className="text-sm font-medium text-slate-300">Password</label>
                  <button
                    type="button"
                    onClick={() => { setMode('forgot'); setError(null); setSuccess(false) }}
                    className="text-xs text-slate-400 hover:text-primary transition-colors"
                  >
                    Forgot Password?
                  </button>
                </div>
                <div className="relative group">
                  <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-primary transition-colors">lock</span>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    disabled={sending}
                    className="w-full bg-slate-900/50 border border-slate-700 rounded-lg py-3.5 pl-12 pr-12 text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all disabled:opacity-50"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white transition-colors"
                  >
                    <span className="material-symbols-outlined text-xl">
                      {showPassword ? 'visibility_off' : 'visibility'}
                    </span>
                  </button>
                </div>
              </div>
            )}

            {/* Success message */}
            {success && successMsg && (
              <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/20 p-3 text-center">
                <p className="text-sm text-emerald-400">{successMsg}</p>
              </div>
            )}

            {/* Error message */}
            {error && (
              <div className="rounded-lg bg-red-500/10 border border-red-500/20 p-3 text-center">
                <p className="text-sm text-red-400">{error}</p>
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={sending || !email || (mode === 'password' && !password)}
              className="w-full bg-gradient-to-r from-primary to-purple-500 text-white font-semibold py-4 rounded-lg shadow-lg shadow-primary/20 hover:shadow-primary/40 hover:scale-[1.01] active:scale-[0.99] transition-all duration-200 mt-2 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
            >
              {sending ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="material-symbols-outlined animate-spin text-lg">progress_activity</span>
                  {loadingLabel}
                </span>
              ) : (
                buttonLabel
              )}
            </button>
          </form>

          {/* Divider */}
          <div className="relative my-8">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-700" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-[#1e293b] px-2 text-slate-500">Or continue with</span>
            </div>
          </div>

          {/* Magic Link Button */}
          <button
            type="button"
            onClick={() => {
              setMode(mode === 'password' ? 'magic' : 'password')
              setError(null)
              setSuccess(false)
            }}
            className="w-full flex items-center justify-center gap-2 bg-slate-800/50 hover:bg-slate-800 border border-slate-700 py-3 rounded-lg text-sm font-medium transition-colors"
          >
            <span className="material-symbols-outlined text-xl">
              {mode === 'password' ? 'link' : 'password'}
            </span>
            {mode === 'password' ? 'Magic Link via Email' : 'Sign in with Password'}
          </button>
        </div>

        {/* Footer */}
        <div className="mt-8 flex flex-col items-center space-y-4">
          {mode === 'forgot' && (
            <button
              type="button"
              onClick={() => { setMode('password'); setError(null); setSuccess(false) }}
              className="text-primary font-semibold hover:underline decoration-primary/30 underline-offset-4"
            >
              Back to Sign In
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
