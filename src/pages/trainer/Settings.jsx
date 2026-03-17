import { useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'

export default function Settings() {
  const { profile, signOut } = useAuth()
  const [showPassword, setShowPassword] = useState(false)
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [saving, setSaving] = useState(false)
  const [pwError, setPwError] = useState(null)
  const [pwSuccess, setPwSuccess] = useState(false)

  async function handleChangePassword(e) {
    e.preventDefault()
    setPwError(null)
    setPwSuccess(false)
    if (newPassword !== confirmPassword) {
      setPwError('Passwords do not match')
      return
    }
    if (newPassword.length < 6) {
      setPwError('Password must be at least 6 characters')
      return
    }
    setSaving(true)
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword })
      if (error) throw error
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
          <p className="text-lg font-semibold text-dark-100 truncate">{profile?.full_name || 'Trainer'}</p>
          <p className="text-sm text-dark-400 truncate">{profile?.email}</p>
        </div>
      </div>

      {/* Change Password */}
      <div className="mb-4">
        <button
          onClick={() => { setShowPassword(!showPassword); setPwError(null); setPwSuccess(false) }}
          className="flex w-full items-center justify-between rounded-2xl border border-primary/10 bg-[#1a1426] p-4 transition-colors hover:bg-surface-accent"
        >
          <div className="flex items-center gap-3">
            <span className="material-symbols-outlined text-dark-300 text-[20px]">lock</span>
            <span className="text-sm font-medium text-dark-100">Change Password</span>
          </div>
          <span
            className={`material-symbols-outlined text-dark-400 text-[18px] transition-transform ${showPassword ? 'rotate-90' : ''}`}
          >
            chevron_right
          </span>
        </button>

        {showPassword && (
          <form onSubmit={handleChangePassword} className="mt-2 space-y-3 rounded-2xl border border-primary/10 bg-[#1a1426] p-4">
            <input
              type="password"
              required
              minLength={6}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="New password"
              className="block w-full rounded-xl border border-primary/10 bg-surface-accent px-3 py-2.5 text-sm text-dark-100 placeholder-dark-400 focus:border-primary focus:outline-none"
            />
            <input
              type="password"
              required
              minLength={6}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Confirm password"
              className="block w-full rounded-xl border border-primary/10 bg-surface-accent px-3 py-2.5 text-sm text-dark-100 placeholder-dark-400 focus:border-primary focus:outline-none"
            />
            {pwError && <p className="text-sm text-red-400">{pwError}</p>}
            {pwSuccess && <p className="text-sm text-green-400">Password changed!</p>}
            <button
              type="submit"
              disabled={saving}
              className="w-full rounded-xl bg-primary py-2.5 text-sm font-semibold text-white hover:bg-primary-dark transition disabled:opacity-50"
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
            className="flex items-center justify-between rounded-2xl border border-primary/10 bg-[#1a1426] p-4 transition-colors hover:bg-surface-accent"
          >
            <div className="flex items-center gap-3">
              <span className="material-symbols-outlined text-dark-300 text-[20px]">{item.icon}</span>
              <span className="text-sm font-medium text-dark-100">{item.label}</span>
            </div>
            <span className="material-symbols-outlined text-dark-400 text-[18px]">chevron_right</span>
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
