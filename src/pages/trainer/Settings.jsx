import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import PasswordInput, { validatePassword, validatePasswordMatch } from '../../components/PasswordInput'

export default function Settings() {
  const { profile, signOut, changePassword } = useAuth()
  const navigate = useNavigate()
  const [showPasswordForm, setShowPasswordForm] = useState(false)
  const [isAlsoClient, setIsAlsoClient] = useState(false)
  const [clientTrainerName, setClientTrainerName] = useState('')

  useEffect(() => {
    if (!profile?.id) return
    // Check if this trainer is also a client under another trainer
    supabase
      .from('trainer_clients')
      .select('trainer_id, profiles:trainer_id ( full_name )')
      .eq('client_id', profile.id)
      .eq('invite_accepted', true)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          setIsAlsoClient(true)
          setClientTrainerName(data.profiles?.full_name || 'your trainer')
        }
      })
  }, [profile?.id])
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

  // Default PR exercises management
  const [showDefaults, setShowDefaults] = useState(false)
  const [systemExercises, setSystemExercises] = useState([])
  const [selectedDefaults, setSelectedDefaults] = useState(new Set())
  const [customDefaultName, setCustomDefaultName] = useState('')
  const [savingDefaults, setSavingDefaults] = useState(false)
  const [defaultsSaved, setDefaultsSaved] = useState(false)

  useEffect(() => {
    if (!profile?.id || !showDefaults) return
    loadDefaults()
  }, [profile?.id, showDefaults])

  async function loadDefaults() {
    // Fetch system exercises
    const { data: sysEx } = await supabase
      .from('exercises')
      .select('id, name')
      .is('trainer_id', null)
      .eq('is_default', true)
      .order('name')

    // Fetch trainer's custom PR exercises
    const { data: trainerEx } = await supabase
      .from('exercises')
      .select('id, name')
      .eq('trainer_id', profile.id)
      .eq('is_pr_eligible', true)
      .order('name')

    const allEx = [...(sysEx || []), ...(trainerEx || [])]
    setSystemExercises(allEx)

    // Fetch trainer's saved defaults
    const { data: defaults } = await supabase
      .from('trainer_default_exercises')
      .select('exercise_id')
      .eq('trainer_id', profile.id)

    if (defaults && defaults.length > 0) {
      setSelectedDefaults(new Set(defaults.map(d => d.exercise_id)))
    } else {
      // First time: select all system exercises by default
      setSelectedDefaults(new Set(allEx.map(e => e.id)))
    }
  }

  function toggleDefault(exId) {
    setSelectedDefaults(prev => {
      const next = new Set(prev)
      if (next.has(exId)) next.delete(exId)
      else next.add(exId)
      return next
    })
  }

  async function saveDefaults() {
    setSavingDefaults(true)
    setDefaultsSaved(false)
    try {
      // Delete existing
      await supabase.from('trainer_default_exercises').delete().eq('trainer_id', profile.id)
      // Insert selected
      const rows = [...selectedDefaults].map((exId, i) => ({
        trainer_id: profile.id,
        exercise_id: exId,
        sort_order: i,
      }))
      if (rows.length > 0) {
        await supabase.from('trainer_default_exercises').insert(rows)
      }
      setDefaultsSaved(true)
    } catch (err) {
      console.error('Save defaults error:', err)
    } finally {
      setSavingDefaults(false)
    }
  }

  async function addCustomDefault() {
    if (!customDefaultName.trim()) return
    const { data: newEx } = await supabase
      .from('exercises')
      .insert({ trainer_id: profile.id, name: customDefaultName.trim(), category: 'strength', is_pr_eligible: true })
      .select()
      .single()
    if (newEx) {
      setSystemExercises(prev => [...prev, newEx])
      setSelectedDefaults(prev => new Set([...prev, newEx.id]))
      setCustomDefaultName('')
    }
  }

  const menuItems = [
    { label: 'Calendar', to: '/trainer/calendar', icon: 'calendar_month' },
    { label: 'Exercise Library', to: '/trainer/exercises', icon: 'menu_book' },
    { label: 'Templates', to: '/trainer/templates', icon: 'content_copy' },
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

      {/* Default PR Exercises */}
      <div className="mb-4">
        <button
          onClick={() => setShowDefaults(!showDefaults)}
          className="flex w-full items-center justify-between rounded-2xl border border-primary/10 bg-[#1a1426] p-4 transition-colors hover:bg-[#251b3a]"
        >
          <div className="flex items-center gap-3">
            <span className="material-symbols-outlined text-slate-300 text-[20px]">fitness_center</span>
            <span className="text-sm font-medium text-slate-100">Default PR Exercises</span>
          </div>
          <span className={`material-symbols-outlined text-slate-400 text-[18px] transition-transform ${showDefaults ? 'rotate-90' : ''}`}>chevron_right</span>
        </button>

        {showDefaults && (
          <div className="mt-2 rounded-2xl border border-primary/10 bg-[#1a1426] p-4 space-y-3">
            <p className="text-xs text-slate-400">Select exercises that auto-assign to new clients:</p>

            {/* Exercise checkboxes with reorder */}
            <div className="max-h-64 overflow-y-auto space-y-0.5 pr-1">
              {systemExercises.map((ex, idx) => (
                <div key={ex.id} className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-white/5 group">
                  <input
                    type="checkbox"
                    checked={selectedDefaults.has(ex.id)}
                    onChange={() => toggleDefault(ex.id)}
                    className="rounded border-slate-600 bg-slate-800 text-primary focus:ring-primary/30 focus:ring-offset-0"
                  />
                  <span className="text-sm text-slate-200 flex-1">{ex.name}</span>
                  <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => {
                        if (idx === 0) return
                        setSystemExercises(prev => {
                          const arr = [...prev]
                          ;[arr[idx - 1], arr[idx]] = [arr[idx], arr[idx - 1]]
                          return arr
                        })
                      }}
                      disabled={idx === 0}
                      className="p-0.5 text-slate-500 hover:text-primary disabled:opacity-20 transition"
                    >
                      <span className="material-symbols-outlined text-[14px]">arrow_upward</span>
                    </button>
                    <button
                      onClick={() => {
                        if (idx === systemExercises.length - 1) return
                        setSystemExercises(prev => {
                          const arr = [...prev]
                          ;[arr[idx], arr[idx + 1]] = [arr[idx + 1], arr[idx]]
                          return arr
                        })
                      }}
                      disabled={idx === systemExercises.length - 1}
                      className="p-0.5 text-slate-500 hover:text-primary disabled:opacity-20 transition"
                    >
                      <span className="material-symbols-outlined text-[14px]">arrow_downward</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Add custom exercise */}
            <div className="flex gap-2">
              <input
                type="text"
                value={customDefaultName}
                onChange={(e) => setCustomDefaultName(e.target.value)}
                placeholder="Add custom exercise..."
                className="flex-1 rounded-lg bg-slate-900/50 border border-slate-700 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-primary/50"
                onKeyDown={(e) => e.key === 'Enter' && addCustomDefault()}
              />
              <button onClick={addCustomDefault} className="px-3 rounded-lg bg-primary/10 text-primary text-sm font-medium hover:bg-primary/20 transition">
                Add
              </button>
            </div>

            {/* Save + status */}
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-500">{selectedDefaults.size} exercises selected</span>
              <div className="flex items-center gap-2">
                {defaultsSaved && <span className="text-xs text-emerald-400">Saved!</span>}
                <button
                  onClick={saveDefaults}
                  disabled={savingDefaults}
                  className="px-4 py-1.5 rounded-lg bg-primary text-white text-xs font-semibold hover:bg-[#6d28d9] transition disabled:opacity-50"
                >
                  {savingDefaults ? 'Saving...' : 'Save Defaults'}
                </button>
              </div>
            </div>
          </div>
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

      {/* Role Switcher — if trainer is also a client */}
      {isAlsoClient && (
        <div className="mb-4 rounded-2xl border border-primary/10 bg-[#1a1426] p-4">
          <div className="flex items-center gap-3 mb-3">
            <span className="material-symbols-outlined text-primary text-[20px]">swap_horiz</span>
            <div>
              <p className="text-sm font-medium text-slate-100">My Training Profile</p>
              <p className="text-xs text-slate-400">You are also a client under {clientTrainerName}</p>
            </div>
          </div>
          <button
            onClick={() => navigate('/client')}
            className="w-full flex items-center justify-center gap-2 rounded-xl bg-primary/10 border border-primary/20 py-2.5 text-sm font-semibold text-primary hover:bg-primary/20 transition"
          >
            <span className="material-symbols-outlined text-[18px]">fitness_center</span>
            View My Workout
          </button>
        </div>
      )}

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
