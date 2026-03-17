import { useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import {
  UserCircleIcon,
  KeyIcon,
  BookOpenIcon,
  TrophyIcon,
  FireIcon,
  ArrowRightStartOnRectangleIcon,
  ChevronRightIcon,
} from '@heroicons/react/24/outline'

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

  const menuItems = [
    { label: 'Exercise Library', desc: 'Manage your exercises', to: '/trainer/exercises', icon: BookOpenIcon },
    { label: 'WOD', desc: 'Workout of the Day', to: '/trainer/wod', icon: FireIcon },
    { label: 'Leaderboard', desc: 'Client scores & rankings', to: '/trainer/leaderboard', icon: TrophyIcon },
  ]

  return (
    <div>
      {/* Profile Card */}
      <div className="mb-6 flex items-center gap-4 rounded-xl border border-dark-700 bg-dark-800 p-4">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary-500/20 text-xl font-bold text-primary-400">
          {(profile?.full_name || 'T').charAt(0).toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-lg font-semibold text-dark-100 truncate">{profile?.full_name || 'Trainer'}</p>
          <p className="text-sm text-dark-400 truncate">{profile?.email}</p>
        </div>
      </div>

      {/* Change Password */}
      <div className="mb-6">
        <button
          onClick={() => { setShowPassword(!showPassword); setPwError(null); setPwSuccess(false) }}
          className="flex w-full items-center justify-between rounded-xl border border-dark-700 bg-dark-800 p-4 transition-colors hover:bg-dark-700"
        >
          <div className="flex items-center gap-3">
            <KeyIcon className="h-5 w-5 text-dark-300" />
            <span className="text-sm font-medium text-dark-100">Change Password</span>
          </div>
          <ChevronRightIcon className={`h-4 w-4 text-dark-400 transition-transform ${showPassword ? 'rotate-90' : ''}`} />
        </button>

        {showPassword && (
          <form onSubmit={handleChangePassword} className="mt-2 space-y-3 rounded-xl border border-dark-700 bg-dark-800 p-4">
            <input
              type="password"
              required
              minLength={6}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="New password"
              className="block w-full rounded-lg border border-dark-600 bg-dark-700 px-3 py-2.5 text-sm text-dark-100 placeholder-dark-400 focus:border-primary-500 focus:outline-none"
            />
            <input
              type="password"
              required
              minLength={6}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Confirm password"
              className="block w-full rounded-lg border border-dark-600 bg-dark-700 px-3 py-2.5 text-sm text-dark-100 placeholder-dark-400 focus:border-primary-500 focus:outline-none"
            />
            {pwError && <p className="text-sm text-red-400">{pwError}</p>}
            {pwSuccess && <p className="text-sm text-green-400">Password changed!</p>}
            <button
              type="submit"
              disabled={saving}
              className="w-full rounded-lg bg-primary-600 py-2.5 text-sm font-semibold text-white hover:bg-primary-700 transition disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Update Password'}
            </button>
          </form>
        )}
      </div>

      {/* Menu Items */}
      <div className="mb-6 space-y-2">
        {menuItems.map((item) => (
          <Link
            key={item.to}
            to={item.to}
            className="flex items-center justify-between rounded-xl border border-dark-700 bg-dark-800 p-4 transition-colors hover:bg-dark-700"
          >
            <div className="flex items-center gap-3">
              <item.icon className="h-5 w-5 text-dark-300" />
              <div>
                <p className="text-sm font-medium text-dark-100">{item.label}</p>
                <p className="text-[11px] text-dark-400">{item.desc}</p>
              </div>
            </div>
            <ChevronRightIcon className="h-4 w-4 text-dark-400" />
          </Link>
        ))}
      </div>

      {/* Sign Out */}
      <button
        onClick={signOut}
        className="flex w-full items-center justify-center gap-2 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm font-medium text-red-400 transition-colors hover:bg-red-500/20"
      >
        <ArrowRightStartOnRectangleIcon className="h-5 w-5" />
        Sign Out
      </button>
    </div>
  )
}
