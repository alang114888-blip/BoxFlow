import { useState } from 'react'
import { Navigate } from 'react-router-dom'
import { EnvelopeIcon, ArrowPathIcon } from '@heroicons/react/24/outline'
import { useAuth } from '../hooks/useAuth'

export default function Auth() {
  const { user, profile, loading: authLoading, signIn } = useAuth()
  const [email, setEmail] = useState('')
  const [sending, setSending] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState(null)

  // Redirect authenticated users based on role
  if (authLoading) {
    return (
      <div className="min-h-screen bg-dark-900 flex items-center justify-center">
        <ArrowPathIcon className="h-8 w-8 text-primary-500 animate-spin" />
      </div>
    )
  }

  if (user && profile) {
    if (profile.role === 'admin') return <Navigate to="/admin" replace />
    if (profile.role === 'trainer') return <Navigate to="/trainer" replace />
    return <Navigate to="/client" replace />
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)
    setSuccess(false)
    setSending(true)

    try {
      await signIn(email)
      setSuccess(true)
      setEmail('')
    } catch (err) {
      setError(err.message || 'Failed to send magic link. Please try again.')
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
              Sign in with magic link
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label
                htmlFor="email"
                className="block text-sm font-medium text-dark-200 mb-1.5"
              >
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

            <button
              type="submit"
              disabled={sending || !email}
              className="w-full flex items-center justify-center gap-2 rounded-lg bg-primary-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500/50 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {sending ? (
                <>
                  <ArrowPathIcon className="h-4 w-4 animate-spin" />
                  Sending...
                </>
              ) : (
                'Send Magic Link'
              )}
            </button>
          </form>

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
