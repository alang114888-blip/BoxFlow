import { useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import PasswordInput, { validatePassword, validatePasswordMatch } from '../../components/PasswordInput'

export default function Settings() {
  const { profile, signOut, changePassword } = useAuth()
  const [showPasswordForm, setShowPasswordForm] = useState(false)
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [saving, setSaving] = useState(false)
  const [pwError, setPwError] = useState(null)
  const [pwSuccess, setPwSuccess] = useState(false)

  async function handleChangePassword(e) {
    e.preventDefault()
    setPwError(null)
    setPwSuccess(false)

    const { allPassed } = validatePassword(newPassword)
    if (!allPassed) { setPwError('Password does not meet all requirements'); return }
    if (!validatePasswordMatch(newPassword, confirmPassword)) { setPwError('Passwords do not match'); return }

    setSaving(true)
    try {
      await changePassword(newPassword)
      setPwSuccess(true)
      setNewPassword('')
      setConfirmPassword('')
    } catch (err) {
      setPwError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const initial = (profile?.full_name || 'T').charAt(0).toUpperCase()

  const menuItems = [
    { label: 'Exercise Library', to: '/trainer/exercises', icon: 'menu_book' },
    { label: 'WOD', to: '/trainer/wod', icon: 'local_fire_department' },
    { label: 'Leaderboard', to: '/trainer/leaderboard', icon: 'trophy' },
  ]

  return (
    <div>
      {/* Profile Card */}
      <div className="mb-4 flex items-center gap-4 rounded-2xl border border-primary/10 bg-[#1a1426] p-4">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-primary to-purple-400 text-xl font-bold text-white">
          {initial}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-lg font-semibold text-slate-100 truncate">{profile?.full_name || 'Trainer'}</p>
          <p className="text-sm text-slate-400 truncate">{profile?.email}</p>
        </div>
      </div>

      {/* Change Password */}
      <div className="mb-4">
        <button
          onClick={() => { setShowPasswordForm(!showPasswordForm); setPwError(null); setPwSuccess(false); setNewPassword(''); setConfirmPassword('') }}
          className="flex w-full items-center justify-between rounded-2xl border border-primary/10 bg-[#1a1426] p-4 transition-colors hover:bg-[#251b3a]"
        >
          <div className="flex items-center gap-3">
            <span className="material-symbols-outlined text-slate-300 text-[20px]">lock</span>
            <span className="text-sm font-medium text-slate-100">Change Password</span>
          </div>
          <span className={`material-symbols-outlined text-slate-400 text-[18px] transition-transform ${showPasswordForm ? 'rotate-90' : ''}`}>
            chevron_right
          </span>
        </button>

        {showPasswordForm && (
          <form onSubmit={handleChangePassword} className="mt-2 rounded-2xl border border-primary/10 bg-[#1a1426] p-4 space-y-4">
            <PasswordInput
              password={newPassword}
              setPassword={setNewPassword}
              confirmPassword={confirmPassword}
              setConfirmPassword={setConfirmPassword}
              disabled={saving}
            />
            {pwError && <p className="text-sm text-red-400">{pwError}</p>}
            {pwSuccess && <p className="text-sm text-emerald-400">Password changed!</p>}
            <button
              type="submit"
              disabled={saving}
              className="w-full rounded-xl bg-primary py-2.5 text-sm font-semibold text-white hover:bg-[#6d28d9] transition disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Update Password'}
            </button>
          </form>
        )}
      </div>

      {/* Menu Links */}
      <div className="mb-4 space-y-2">
        {menuItems.map((item) => (
          <Link
            key={item.to}
            to={item.to}
            className="flex items-center justify-between rounded-2xl border border-primary/10 bg-[#1a1426] p-4 transition-colors hover:bg-[#251b3a]"
          >
            <div className="flex items-center gap-3">
              <span className="material-symbols-outlined text-slate-300 text-[20px]">{item.icon}</span>
              <span className="text-sm font-medium text-slate-100">{item.label}</span>
            </div>
            <span className="material-symbols-outlined text-slate-400 text-[18px]">chevron_right</span>
          </Link>
        ))}
      </div>

      {/* Sign Out */}
      <button
        onClick={signOut}
        className="flex w-full items-center justify-center gap-2 rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm font-medium text-red-400 transition-colors hover:bg-red-500/20"
      >
        <span className="material-symbols-outlined text-[20px]">logout</span>
        Sign Out
      </button>
    </div>
  )
}
