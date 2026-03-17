import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import PasswordInput, { validatePassword, validatePasswordMatch } from '../components/PasswordInput'

export default function ResetPassword() {
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(false)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    // Supabase processes the recovery token from the URL hash automatically
    // and fires PASSWORD_RECOVERY event
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setReady(true)
      }
    })

    // Also check if we already have a session (token already processed)
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) setReady(true)
    })

    return () => subscription.unsubscribe()
  }, [])

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)

    const { allPassed } = validatePassword(password)
    if (!allPassed) { setError('Password does not meet all requirements'); return }
    if (!validatePasswordMatch(password, confirmPassword)) { setError('Passwords do not match'); return }

    setSaving(true)
    try {
      const { error: updateErr } = await supabase.auth.updateUser({ password })
      if (updateErr) throw updateErr

      // Save to password history if user is available
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        await supabase.rpc('save_password_history', {
          target_user_id: user.id,
          new_password: password,
        }).catch(() => {}) // non-critical
      }

      setSuccess(true)
      // Sign out and redirect to login after 2 seconds
      setTimeout(async () => {
        await supabase.auth.signOut()
        navigate('/login', { replace: true })
      }, 2000)
    } catch (err) {
      setError(err.message || 'Failed to reset password')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#0f172a] text-slate-100 relative overflow-hidden flex items-center justify-center p-4">
      {/* Decorative Glows */}
      <div className="fixed top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary/20 blur-[120px] rounded-full pointer-events-none" />
      <div className="fixed bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-primary/20 blur-[120px] rounded-full pointer-events-none" />
      <div className="absolute inset-0 bg-gradient-to-b from-[#0f172a]/80 via-[#0f172a]/95 to-[#0f172a] z-0" />

      <div className="z-10 w-full max-w-md flex flex-col items-center">
        {/* Logo */}
        <div className="mb-8 flex flex-col items-center">
          <div className="w-16 h-16 bg-primary rounded-2xl flex items-center justify-center mb-4 shadow-[0_0_20px_rgba(124,59,237,0.3)]">
            <span className="material-symbols-outlined text-white text-4xl">lock_reset</span>
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-white">
            Reset <span className="text-primary">Password</span>
          </h1>
          <p className="text-slate-400 mt-2 font-light text-center">Set your new password</p>
        </div>

        {/* Card */}
        <div
          className="w-full p-8 rounded-xl shadow-2xl"
          style={{ background: 'rgba(30, 41, 59, 0.7)', backdropFilter: 'blur(12px)', border: '1px solid rgba(124, 59, 237, 0.2)' }}
        >
          {!ready && !success ? (
            <div className="text-center py-8">
              <span className="material-symbols-outlined text-primary animate-spin text-4xl mb-4">progress_activity</span>
              <p className="text-slate-400 text-sm">Verifying reset link...</p>
            </div>
          ) : success ? (
            <div className="text-center py-8">
              <span className="material-symbols-outlined text-emerald-400 text-5xl mb-3">check_circle</span>
              <h3 className="text-xl font-bold text-white mb-2">Password Reset!</h3>
              <p className="text-slate-400 text-sm">Redirecting to login...</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              <PasswordInput
                password={password}
                setPassword={setPassword}
                confirmPassword={confirmPassword}
                setConfirmPassword={setConfirmPassword}
                disabled={saving}
              />

              {error && (
                <div className="rounded-lg bg-red-500/10 border border-red-500/20 p-3 text-center">
                  <p className="text-sm text-red-400">{error}</p>
                </div>
              )}

              <button
                type="submit"
                disabled={saving}
                className="w-full bg-gradient-to-r from-primary to-purple-500 text-white font-semibold py-4 rounded-lg shadow-lg shadow-primary/20 hover:shadow-primary/40 hover:scale-[1.01] active:scale-[0.99] transition-all duration-200 disabled:opacity-50 disabled:hover:scale-100 flex items-center justify-center gap-2"
              >
                {saving ? (
                  <>
                    <span className="material-symbols-outlined animate-spin text-lg">progress_activity</span>
                    Resetting...
                  </>
                ) : (
                  <>
                    <span className="material-symbols-outlined">lock</span>
                    Set New Password
                  </>
                )}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
