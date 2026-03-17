import { useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import PasswordInput, { validatePassword, validatePasswordMatch } from '../components/PasswordInput'

export default function Onboarding() {
  const { user, profile, loading: authLoading, changePassword } = useAuth()
  const navigate = useNavigate()
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  if (authLoading) {
    return (
      <div className="min-h-screen bg-[#0f0a19] flex items-center justify-center">
        <span className="material-symbols-outlined text-primary animate-spin text-4xl">progress_activity</span>
      </div>
    )
  }

  if (!user) return <Navigate to="/login" replace />

  // Skip onboarding for admins or already-onboarded users
  if (profile?.role === 'super_admin' || profile?.is_onboarded) {
    if (profile.role === 'super_admin') return <Navigate to="/admin" replace />
    if (profile.role === 'trainer') return <Navigate to="/trainer" replace />
    return <Navigate to="/client" replace />
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)

    // Validate phone
    const cleanPhone = phone.replace(/\s/g, '')
    if (cleanPhone.length < 8) {
      setError('Please enter a valid phone number')
      return
    }

    // Validate password
    const { allPassed } = validatePassword(password)
    if (!allPassed) {
      setError('Password does not meet all requirements')
      return
    }
    if (!validatePasswordMatch(password, confirmPassword)) {
      setError('Passwords do not match')
      return
    }

    setSaving(true)
    try {
      // Set password (with history check)
      await changePassword(password)

      // Save phone and mark as onboarded
      const { error: profileErr } = await supabase
        .from('profiles')
        .update({ phone: cleanPhone, is_onboarded: true })
        .eq('id', user.id)

      if (profileErr) throw profileErr

      // Resolve pending invites → create trainer_clients
      const { data: pendingInvites } = await supabase
        .from('pending_invites')
        .select('id, trainer_id')
        .eq('email', user.email)

      if (pendingInvites?.length > 0) {
        for (const inv of pendingInvites) {
          await supabase.from('trainer_clients').insert({
            trainer_id: inv.trainer_id,
            client_id: user.id,
            invited_email: user.email,
            invite_accepted: true,
          }).catch(() => {}) // ignore duplicates
          await supabase.from('pending_invites').delete().eq('id', inv.id).catch(() => {})
        }
      }

      // Auto-assign default PR exercises from trainer (if client)
      if (profile?.role === 'client' || pendingInvites?.length > 0) {
        const { data: tc } = await supabase.from('trainer_clients').select('trainer_id').eq('client_id', user.id).eq('invite_accepted', true).maybeSingle()
        if (tc?.trainer_id) {
          // Check for auto-assign template
          const { data: autoTemplate } = await supabase.from('workout_templates').select('id, structure_json').eq('trainer_id', tc.trainer_id).eq('auto_assign', true).maybeSingle()
          if (autoTemplate?.structure_json?.days) {
            // Create workout plan from template
            const { data: newPlan } = await supabase.from('workout_plans').insert({
              trainer_id: tc.trainer_id, client_id: user.id, name: `${profile.full_name || 'Client'} - Initial Plan`, is_active: true,
            }).select().single()
            if (newPlan) {
              for (const day of autoTemplate.structure_json.days) {
                const { data: newDay } = await supabase.from('workout_days').insert({
                  plan_id: newPlan.id, day_of_week: day.day_of_week || null, name: day.name || 'Day',
                }).select().single()
                if (newDay && day.exercises?.length > 0) {
                  await supabase.from('workout_exercises').insert(
                    day.exercises.map((ex, i) => ({ workout_day_id: newDay.id, exercise_id: ex.exercise_id, order_index: i, sets: ex.sets || 3, reps: ex.reps || '10', percentage_of_pr: ex.percentage_of_pr || null, section: ex.section || 'other', section_order: i, notes: ex.notes || null }))
                  )
                }
              }
            }
          }
          // Auto-assign default PR exercises
          const { data: defaults } = await supabase.from('trainer_default_exercises').select('exercise_id').eq('trainer_id', tc.trainer_id).order('sort_order')
          if (defaults?.length > 0) {
            for (const d of defaults) {
              await supabase.from('client_prs').upsert({ client_id: user.id, exercise_id: d.exercise_id, weight_kg: 0, date_achieved: new Date().toISOString().split('T')[0] }, { onConflict: 'client_id,exercise_id', ignoreDuplicates: true }).catch(() => {})
            }
          }
        }
      }

      // Redirect to dashboard
      if (profile?.role === 'trainer') {
        navigate('/trainer', { replace: true })
      } else {
        navigate('/client', { replace: true })
      }
    } catch (err) {
      setError(err.message || 'Something went wrong')
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
            <span className="material-symbols-outlined text-white text-4xl">exercise</span>
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-white">
            Welcome to Box<span className="text-primary">Flow</span>
          </h1>
          <p className="text-slate-400 mt-2 font-light text-center">Complete your profile to get started</p>
        </div>

        {/* Onboarding Card */}
        <div
          className="w-full p-8 rounded-xl shadow-2xl"
          style={{ background: 'rgba(30, 41, 59, 0.7)', backdropFilter: 'blur(12px)', border: '1px solid rgba(124, 59, 237, 0.2)' }}
        >
          {/* Progress steps */}
          <div className="flex items-center gap-3 mb-8">
            <div className="flex items-center gap-2 flex-1">
              <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-white text-sm font-bold">1</div>
              <div className="h-0.5 flex-1 bg-primary/30 rounded-full" />
            </div>
            <div className="flex items-center gap-2 flex-1">
              <div className="w-8 h-8 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center text-primary text-sm font-bold">2</div>
              <div className="h-0.5 flex-1 bg-slate-700 rounded-full" />
            </div>
            <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center text-slate-500 text-sm font-bold">3</div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Phone Number */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-300 ml-1">Phone Number</label>
              <div className="relative group">
                <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-primary transition-colors">phone_iphone</span>
                <input
                  type="tel"
                  required
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+972 50 123 4567"
                  disabled={saving}
                  className="w-full bg-slate-900/50 border border-slate-700 rounded-lg py-3.5 pl-12 pr-4 text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all disabled:opacity-50"
                />
              </div>
              <p className="text-[10px] text-slate-500 ml-1">Include country code (e.g. +972, +1, +44)</p>
            </div>

            {/* Password with validation */}
            <PasswordInput
              password={password}
              setPassword={setPassword}
              confirmPassword={confirmPassword}
              setConfirmPassword={setConfirmPassword}
              disabled={saving}
            />

            {/* Error */}
            {error && (
              <div className="rounded-lg bg-red-500/10 border border-red-500/20 p-3 text-center">
                <p className="text-sm text-red-400">{error}</p>
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={saving}
              className="w-full bg-gradient-to-r from-primary to-purple-500 text-white font-semibold py-4 rounded-lg shadow-lg shadow-primary/20 hover:shadow-primary/40 hover:scale-[1.01] active:scale-[0.99] transition-all duration-200 disabled:opacity-50 disabled:hover:scale-100 flex items-center justify-center gap-2"
            >
              {saving ? (
                <>
                  <span className="material-symbols-outlined animate-spin text-lg">progress_activity</span>
                  Setting up...
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined">arrow_forward</span>
                  Complete Setup
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
