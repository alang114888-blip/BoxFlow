import { useState } from 'react'
import { Navigate } from 'react-router-dom'
import { EnvelopeIcon, LockClosedIcon } from '@heroicons/react/24/outline'
import { useAuth } from '../hooks/useAuth'

export default function Auth() {
  const { user, profile, loading: authLoading, signIn, signInWithPassword, resetPassword } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [mode, setMode] = useState('password') // 'password' | 'magic' | 'forgot'
  const [sending, setSending] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState(null)

  if (authLoading) {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center">
        <span className="material-symbols-outlined text-primary animate-spin text-4xl">progress_activity</span>
      </div>
    )
  }

  if (user && profile) {
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

  const subtitle = {
    password: 'Sign in with your password',
    magic: 'Sign in with magic link',
    forgot: 'Reset your password',
  }[mode]

  const buttonLabel = {
    password: 'Sign In',
    magic: 'Send Magic Link',
    forgot: 'Send Reset Link',
  }[mode]

  const loadingLabel = {
    password: 'Signing in...',
    magic: 'Sending...',
    forgot: 'Sending...',
  }[mode]

  const successMsg = {
    magic: 'Check your email for the login link!',
    forgot: 'Password reset email sent! Check your inbox.',
  }[mode]

  return (
    <div className="min-h-screen mesh-bg flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="glass-card rounded-2xl shadow-2xl p-8">
          {/* Logo / Title */}
          <div className="text-center mb-8">
            <div className="mx-auto mb-4 w-14 h-14 bg-gradient-to-br from-primary to-primary-light rounded-2xl flex items-center justify-center shadow-lg shadow-primary/30">
              <span className="material-symbols-outlined text-white text-3xl">package_2</span>
            </div>
            <h1 className="text-3xl font-extrabold text-white tracking-tight">
              Box<span className="text-primary">Flow</span>
            </h1>
            <p className="mt-2 text-slate-400 text-sm font-medium">{subtitle}</p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-dark-200 mb-1.5">
                Email address
              </label>
              <div className="relative">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                  <EnvelopeIcon className="h-5 w-5 text-dark-400" />
                </div>
                <input
                  id="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  disabled={sending}
                  className="block w-full rounded-lg border border-white/10 bg-white/5 py-2.5 pl-10 pr-3 text-white placeholder-slate-500 focus:border-primary focus:ring-2 focus:ring-primary/20 focus:outline-none transition disabled:opacity-50"
                />
              </div>
            </div>

            {mode === 'password' && (
              <div>
                <label htmlFor="password" className="block text-sm font-medium text-dark-200 mb-1.5">
                  Password
                </label>
                <div className="relative">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                    <LockClosedIcon className="h-5 w-5 text-dark-400" />
                  </div>
                  <input
                    id="password"
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter your password"
                    disabled={sending}
                    className="block w-full rounded-lg border border-white/10 bg-white/5 py-2.5 pl-10 pr-3 text-white placeholder-slate-500 focus:border-primary focus:ring-2 focus:ring-primary/20 focus:outline-none transition disabled:opacity-50"
                  />
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={sending || !email || (mode === 'password' && !password)}
              className="w-full flex items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-primary to-primary-light px-4 py-2.5 text-sm font-semibold text-white hover:shadow-lg hover:shadow-primary/30 focus:outline-none focus:ring-2 focus:ring-primary-500/50 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {sending ? (
                <>
                  <span className="material-symbols-outlined animate-spin text-sm">progress_activity</span>
                  {loadingLabel}
                </>
              ) : (
                buttonLabel
              )}
            </button>
          </form>

          {/* Links */}
          <div className="mt-5 flex flex-col items-center gap-2">
            {mode === 'password' && (
              <button
                type="button"
                onClick={() => { setMode('forgot'); setError(null); setSuccess(false) }}
                className="text-sm text-dark-400 hover:text-dark-200 transition"
              >
                Forgot password?
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                setMode(mode === 'password' ? 'magic' : 'password')
                setError(null)
                setSuccess(false)
              }}
              className="text-sm text-primary-400 hover:text-primary-300 transition"
            >
              {mode === 'password' ? 'Use magic link instead' : 'Use password instead'}
            </button>
            {mode === 'forgot' && (
              <button
                type="button"
                onClick={() => { setMode('password'); setError(null); setSuccess(false) }}
                className="text-sm text-primary-400 hover:text-primary-300 transition"
              >
                Back to sign in
              </button>
            )}
          </div>

          {/* Success message */}
          {success && successMsg && (
            <div className="mt-4 rounded-lg bg-green-900/30 border border-green-700/50 p-3 text-center">
              <p className="text-sm text-green-400">{successMsg}</p>
            </div>
          )}

          {/* Error message */}
          {error && (
            <div className="mt-4 rounded-lg bg-red-900/30 border border-red-700/50 p-3 text-center">
              <p className="text-sm text-red-400">{error}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
