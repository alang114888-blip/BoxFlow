import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { supabase } from '../../lib/supabase'

function getMonday(date) {
  const d = new Date(date)
  const day = d.getDay()
  const diff = d.getDate() - day + (day === 0 ? -6 : 1)
  d.setDate(diff)
  d.setHours(0, 0, 0, 0)
  return d
}

function formatDate(d) {
  return d.toISOString().split('T')[0]
}

function formatDisplayDate(d) {
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export default function WeeklyCheckIn() {
  const { profile } = useAuth()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(false)
  const [existingCheckin, setExistingCheckin] = useState(null)
  const [editing, setEditing] = useState(false)
  const [trainerId, setTrainerId] = useState(null)

  const [weight, setWeight] = useState('')
  const [energy, setEnergy] = useState(5)
  const [sleep, setSleep] = useState(5)
  const [stress, setStress] = useState(5)
  const [notes, setNotes] = useState('')

  const monday = getMonday(new Date())
  const weekDate = formatDate(monday)

  const fetchData = useCallback(async () => {
    if (!profile?.id) return
    try {
      setLoading(true)
      setError(null)

      // Get trainer_id
      const { data: tc } = await supabase
        .from('trainer_clients')
        .select('trainer_id')
        .eq('client_id', profile.id)
        .eq('invite_accepted', true)
        .limit(1)
        .single()

      if (tc) setTrainerId(tc.trainer_id)

      // Check for existing check-in this week
      const { data: existing } = await supabase
        .from('weekly_checkins')
        .select('*')
        .eq('client_id', profile.id)
        .eq('week_date', weekDate)
        .maybeSingle()

      if (existing) {
        setExistingCheckin(existing)
        setWeight(existing.weight_kg?.toString() || '')
        setEnergy(existing.energy || 5)
        setSleep(existing.sleep || 5)
        setStress(existing.stress || 5)
        setNotes(existing.notes || '')
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [profile?.id, weekDate])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  async function handleSubmit(e) {
    e.preventDefault()
    if (!profile?.id || !trainerId) return
    try {
      setSaving(true)
      setError(null)
      setSuccess(false)

      const payload = {
        client_id: profile.id,
        trainer_id: trainerId,
        week_date: weekDate,
        weight_kg: weight ? parseFloat(weight) : null,
        energy,
        sleep,
        stress,
        notes: notes.trim() || null,
      }

      const { error: upsertErr } = await supabase
        .from('weekly_checkins')
        .upsert(payload, { onConflict: 'client_id,week_date' })

      if (upsertErr) throw upsertErr

      setSuccess(true)
      setEditing(false)
      await fetchData()
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  function RatingButtons({ value, onChange, label }) {
    return (
      <div>
        <label className="mb-2 block text-sm font-medium text-gray-300">{label}</label>
        <div className="flex gap-1.5 flex-wrap">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => onChange(n)}
              className={`flex h-9 w-9 items-center justify-center rounded-lg text-sm font-medium transition-colors ${
                value === n
                  ? 'bg-[#7c3bed] text-white shadow-lg shadow-[#7c3bed]/25'
                  : 'bg-[#1a1225] text-gray-400 hover:bg-[#251a35] hover:text-gray-300 border border-[#7c3bed]/10'
              }`}
            >
              {n}
            </button>
          ))}
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-dark-600 border-t-primary-500" />
      </div>
    )
  }

  const showForm = !existingCheckin || editing

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-6" style={{ fontFamily: 'Lexend, sans-serif' }}>
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-100">Weekly Check-In</h1>
        <p className="mt-1 text-gray-400">
          Week of {formatDisplayDate(monday)}
        </p>
      </div>

      {error && (
        <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-400">
          {error}
        </div>
      )}

      {success && (
        <div className="rounded-2xl border border-green-500/30 bg-green-500/10 p-4 text-sm text-green-400 flex items-center gap-2">
          <span className="material-symbols-outlined text-lg">check_circle</span>
          Check-in submitted successfully!
        </div>
      )}

      {!trainerId && !loading && (
        <div className="rounded-2xl border border-[#7c3bed]/10 bg-[#1a1426] p-8 text-center">
          <span className="material-symbols-outlined text-4xl text-gray-500 mb-3 block">person_off</span>
          <p className="text-gray-400">No trainer assigned yet. Check-ins will be available once you are connected to a trainer.</p>
        </div>
      )}

      {trainerId && existingCheckin && !editing && (
        <div className="rounded-2xl border border-[#7c3bed]/10 bg-[#1a1426] p-6 space-y-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-[#7c3bed]">fact_check</span>
              <h2 className="text-lg font-semibold text-gray-100">Already Submitted</h2>
            </div>
            <button
              onClick={() => setEditing(true)}
              className="flex items-center gap-1.5 rounded-lg bg-[#7c3bed]/10 px-3 py-1.5 text-sm font-medium text-[#7c3bed] hover:bg-[#7c3bed]/20 transition-colors"
            >
              <span className="material-symbols-outlined text-base">edit</span>
              Edit
            </button>
          </div>

          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div className="rounded-xl bg-[#0f0a19] p-4 border border-[#7c3bed]/10">
              <p className="text-xs text-gray-500 mb-1">Weight</p>
              <p className="text-lg font-bold text-gray-100">{existingCheckin.weight_kg ? `${existingCheckin.weight_kg} kg` : '-'}</p>
            </div>
            <div className="rounded-xl bg-[#0f0a19] p-4 border border-[#7c3bed]/10">
              <p className="text-xs text-gray-500 mb-1">Energy</p>
              <p className="text-lg font-bold text-[#7c3bed]">{existingCheckin.energy}/10</p>
            </div>
            <div className="rounded-xl bg-[#0f0a19] p-4 border border-[#7c3bed]/10">
              <p className="text-xs text-gray-500 mb-1">Sleep</p>
              <p className="text-lg font-bold text-blue-400">{existingCheckin.sleep}/10</p>
            </div>
            <div className="rounded-xl bg-[#0f0a19] p-4 border border-[#7c3bed]/10">
              <p className="text-xs text-gray-500 mb-1">Stress</p>
              <p className="text-lg font-bold text-orange-400">{existingCheckin.stress}/10</p>
            </div>
          </div>

          {existingCheckin.notes && (
            <div className="rounded-xl bg-[#0f0a19] p-4 border border-[#7c3bed]/10">
              <p className="text-xs text-gray-500 mb-1">Notes</p>
              <p className="text-sm text-gray-300">{existingCheckin.notes}</p>
            </div>
          )}
        </div>
      )}

      {trainerId && showForm && (
        <form onSubmit={handleSubmit} className="rounded-2xl border border-[#7c3bed]/10 bg-[#1a1426] p-6 space-y-6">
          {/* Weight */}
          <div>
            <label className="mb-2 block text-sm font-medium text-gray-300">
              Weight (kg)
            </label>
            <input
              type="number"
              step="0.1"
              min="0"
              value={weight}
              onChange={(e) => setWeight(e.target.value)}
              placeholder="e.g. 75.5"
              className="w-full rounded-xl border border-[#7c3bed]/10 bg-[#0f0a19] px-4 py-3 text-sm text-gray-200 placeholder-gray-600 focus:border-[#7c3bed]/50 focus:outline-none"
            />
          </div>

          {/* Energy */}
          <RatingButtons value={energy} onChange={setEnergy} label="Energy (1-10)" />

          {/* Sleep */}
          <RatingButtons value={sleep} onChange={setSleep} label="Sleep Quality (1-10)" />

          {/* Stress */}
          <RatingButtons value={stress} onChange={setStress} label="Stress Level (1-10)" />

          {/* Notes */}
          <div>
            <label className="mb-2 block text-sm font-medium text-gray-300">
              Notes (optional)
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder="How are you feeling this week? Any observations..."
              className="w-full rounded-xl border border-[#7c3bed]/10 bg-[#0f0a19] px-4 py-3 text-sm text-gray-200 placeholder-gray-600 focus:border-[#7c3bed]/50 focus:outline-none resize-none"
            />
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            <button
              type="submit"
              disabled={saving}
              className="flex items-center gap-2 rounded-xl bg-[#7c3bed] px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#6a2fd4] disabled:opacity-50 shadow-lg shadow-[#7c3bed]/20"
            >
              {saving ? (
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
              ) : (
                <span className="material-symbols-outlined text-lg">send</span>
              )}
              {existingCheckin ? 'Update Check-In' : 'Submit Check-In'}
            </button>
            {editing && (
              <button
                type="button"
                onClick={() => {
                  setEditing(false)
                  // Reset to existing values
                  setWeight(existingCheckin.weight_kg?.toString() || '')
                  setEnergy(existingCheckin.energy || 5)
                  setSleep(existingCheckin.sleep || 5)
                  setStress(existingCheckin.stress || 5)
                  setNotes(existingCheckin.notes || '')
                }}
                className="rounded-xl border border-[#7c3bed]/10 bg-[#0f0a19] px-5 py-3 text-sm text-gray-400 hover:bg-[#1a1225] transition-colors"
              >
                Cancel
              </button>
            )}
          </div>
        </form>
      )}
    </div>
  )
}
