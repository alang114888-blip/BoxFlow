import { useState } from 'react'
import { Navigate } from 'react-router-dom'
import { EnvelopeIcon, LockClosedIcon, ArrowPathIcon } from '@heroicons/react/24/outline'
import { useAuth } from '../hooks/useAuth'

export default function Auth() {
  const { user, profile, loading: authLoading, signIn, signInWithPassword } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [mode, setMode] = useState('password') // 'password' or 'magic'
  const [sending, setSending] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState(null)

  if (authLoading) {
    return (
      <div className="min-h-screen bg-dark-900 flex items-center justify-center">
        <ArrowPathIcon className="h-8 w-8 text-primary-500 animate-spin" />
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
      if (mode === 'magic') {
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

  return (
    <div className="min-h-screen bg-dark-900 flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="bg-dark-800 rounded-2xl shadow-xl border border-dark-700 p-8">
          {/* Logo / Title */}
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-dark-100 tracking-tight">
              Box<span className="text-primary-500">Flow</span>
            </h1>
            <p className="mt-2 text-dark-400 text-sm">
              {mode === 'password' ? 'Sign in with your password' : 'Sign in with magic link'}
            </p>
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
                  className="block w-full rounded-lg border border-dark-600 bg-dark-700 py-2.5 pl-10 pr-3 text-dark-100 placeholder-dark-400 focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 focus:outline-none transition disabled:opacity-50"
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
                    className="block w-full rounded-lg border border-dark-600 bg-dark-700 py-2.5 pl-10 pr-3 text-dark-100 placeholder-dark-400 focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 focus:outline-none transition disabled:opacity-50"
                  />
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={sending || !email || (mode === 'password' && !password)}
              className="w-full flex items-center justify-center gap-2 rounded-lg bg-primary-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500/50 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {sending ? (
                <>
                  <ArrowPathIcon className="h-4 w-4 animate-spin" />
                  {mode === 'password' ? 'Signing in...' : 'Sending...'}
                </>
              ) : (
                mode === 'password' ? 'Sign In' : 'Send Magic Link'
              )}
            </button>
          </form>

          {/* Toggle mode */}
          <div className="mt-5 text-center">
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
          </div>

          {/* Success message */}
          {success && (
            <div className="mt-4 rounded-lg bg-green-900/30 border border-green-700/50 p-3 text-center">
              <p className="text-sm text-green-400">
                Check your email for the login link!
              </p>
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
