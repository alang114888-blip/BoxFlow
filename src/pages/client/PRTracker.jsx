import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { supabase } from '../../lib/supabase'
import {
  TrophyIcon,
  ArrowTrendingUpIcon,
  InformationCircleIcon,
} from '@heroicons/react/24/outline'
import { format } from 'date-fns'
import ProgressCharts from '../../components/ProgressCharts'

export default function PRTracker() {
  const { profile } = useAuth()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [prExercises, setPrExercises] = useState([])
  const [prs, setPrs] = useState({})
  const [prHistory, setPrHistory] = useState([])
  const [editingId, setEditingId] = useState(null)
  const [editWeight, setEditWeight] = useState('')
  const [saving, setSaving] = useState(false)

  const fetchData = useCallback(async () => {
    if (!profile?.id) return
    try {
      setLoading(true)
      setError(null)

      // Get exercises marked as PR-eligible that belong to the client's trainer(s)
      // We find the trainer via trainer_clients (works even without workout plans)
      const [plansRes, prsRes] = await Promise.all([
        supabase
          .from('trainer_clients')
          .select('trainer_id')
          .eq('client_id', profile.id)
          .eq('invite_accepted', true)
          .limit(1)
          .maybeSingle(),

        supabase
          .from('client_prs')
          .select('exercise_id, weight_kg, date_achieved')
          .eq('client_id', profile.id)
          .order('date_achieved', { ascending: false }),
      ])

      const trainerId = plansRes.data?.trainer_id

      // Fetch trainer exercises + system defaults
      const [trainerExRes, sysExRes] = await Promise.all([
        trainerId
          ? supabase.from('exercises').select('id, name, category').eq('trainer_id', trainerId).eq('is_pr_eligible', true).order('name')
          : { data: [] },
        supabase.from('exercises').select('id, name, category').is('trainer_id', null).eq('is_default', true).order('name'),
      ])
      const exercises = [...(sysExRes.data || []), ...(trainerExRes.data || [])]

      // Build PR map (latest per exercise)
      const prMap = {}
      if (prsRes.data) {
        prsRes.data.forEach((pr) => {
          if (!prMap[pr.exercise_id]) prMap[pr.exercise_id] = pr
        })
      }

      // Fetch full PR history from pr_history table
      const { data: histData } = await supabase
        .from('pr_history')
        .select('id, exercise_id, weight_kg, recorded_at, exercises ( name )')
        .eq('client_id', profile.id)
        .order('recorded_at', { ascending: false })
        .limit(50)

      setPrExercises(exercises)
      setPrs(prMap)
      setPrHistory(histData || [])
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [profile?.id])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  async function handleUpdatePR(exerciseId) {
    const weight = parseFloat(editWeight)
    if (!weight || weight <= 0) return

    try {
      setSaving(true)

      // Update current PR
      const { error: upsertErr } = await supabase
        .from('client_prs')
        .upsert(
          {
            client_id: profile.id,
            exercise_id: exerciseId,
            weight_kg: weight,
            date_achieved: new Date().toISOString().split('T')[0],
          },
          { onConflict: 'client_id,exercise_id' }
        )

      if (upsertErr) throw upsertErr

      // Also save to PR history (full log, never overwritten)
      await supabase.from('pr_history').insert({
        client_id: profile.id,
        exercise_id: exerciseId,
        weight_kg: weight,
      }).catch(() => {}) // non-critical

      setEditingId(null)
      setEditWeight('')
      await fetchData()
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-dark-600 border-t-primary-500" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="mx-auto max-w-4xl p-6">
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-red-400">
          Failed to load PRs: {error}
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-dark-100">PR Tracker</h1>
        <p className="mt-1 text-dark-400">Track your personal records</p>
      </div>

      {/* Progress Charts */}
      {profile?.id && <ProgressCharts clientId={profile.id} />}

      {/* Info Banner */}
      <div className="flex items-start gap-3 rounded-lg border border-primary-500/20 bg-primary-500/5 p-4">
        <InformationCircleIcon className="mt-0.5 h-5 w-5 shrink-0 text-primary-400" />
        <p className="text-sm text-dark-300">
          When you update a PR, your workout weights will automatically recalculate based on the
          new value. Only exercises marked by your trainer as PR-eligible appear here.
        </p>
      </div>

      {/* PR Exercises */}
      {prExercises.length > 0 ? (
        <div className="space-y-3">
          {prExercises.map((exercise) => {
            const currentPR = prs[exercise.id]
            const isEditing = editingId === exercise.id

            return (
              <div
                key={exercise.id}
                className="rounded-lg border border-dark-700 bg-dark-800 px-5 py-4"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <TrophyIcon className="h-5 w-5 text-primary-500" />
                    <div>
                      <p className="font-medium text-dark-200">{exercise.name}</p>
                      <p className="text-xs text-dark-500">{exercise.category}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    {currentPR ? (
                      <div className="text-right">
                        <p className="text-lg font-bold text-primary-400">
                          {currentPR.weight_kg} kg
                        </p>
                        <p className="text-xs text-dark-500">
                          {format(new Date(currentPR.date_achieved), 'MMM d, yyyy')}
                        </p>
                      </div>
                    ) : (
                      <span className="text-sm text-dark-500">No PR set</span>
                    )}

                    {!isEditing && (
                      <button
                        onClick={() => {
                          setEditingId(exercise.id)
                          setEditWeight(currentPR ? String(currentPR.weight_kg) : '')
                        }}
                        className="rounded-lg bg-dark-700 px-3 py-1.5 text-sm text-dark-300 transition-colors hover:bg-dark-600 hover:text-dark-200"
                      >
                        Update
                      </button>
                    )}
                  </div>
                </div>

                {isEditing && (
                  <div className="mt-3 flex items-end gap-3 border-t border-dark-700 pt-3">
                    <div className="flex-1">
                      <label className="mb-1 block text-xs font-medium text-dark-400">
                        New PR Weight (kg)
                      </label>
                      <input
                        type="number"
                        step="0.5"
                        min="0"
                        value={editWeight}
                        onChange={(e) => setEditWeight(e.target.value)}
                        placeholder="e.g. 100"
                        className="w-full rounded-lg border border-dark-600 bg-dark-900 px-3 py-2 text-sm text-dark-200 placeholder-dark-500 focus:border-primary-500 focus:outline-none"
                        autoFocus
                      />
                    </div>
                    <button
                      onClick={() => handleUpdatePR(exercise.id)}
                      disabled={saving || !editWeight}
                      className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-500 disabled:opacity-50"
                    >
                      {saving ? 'Saving...' : 'Save'}
                    </button>
                    <button
                      onClick={() => {
                        setEditingId(null)
                        setEditWeight('')
                      }}
                      className="rounded-lg bg-dark-700 px-4 py-2 text-sm text-dark-300 hover:bg-dark-600"
                    >
                      Cancel
                    </button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      ) : (
        <div className="rounded-lg border border-dark-700 bg-dark-800 p-8 text-center">
          <TrophyIcon className="mx-auto mb-3 h-12 w-12 text-dark-500" />
          <p className="text-dark-400">No PR exercises defined yet.</p>
          <p className="mt-1 text-sm text-dark-500">
            Your trainer will set up PR-eligible exercises for you.
          </p>
        </div>
      )}

      {/* PR History */}
      {prHistory.length > 0 && (
        <div className="rounded-lg border border-dark-700 bg-dark-800">
          <div className="border-b border-dark-700 px-5 py-3">
            <div className="flex items-center gap-2">
              <ArrowTrendingUpIcon className="h-5 w-5 text-primary-500" />
              <h2 className="text-lg font-semibold text-dark-100">PR History</h2>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-dark-700 text-dark-400">
                  <th className="px-5 py-3 font-medium">Exercise</th>
                  <th className="px-5 py-3 font-medium">Weight (kg)</th>
                  <th className="px-5 py-3 font-medium">Date</th>
                </tr>
              </thead>
              <tbody>
                {prHistory.map((pr, i) => {
                  const exercise = prExercises.find((e) => e.id === pr.exercise_id)
                  return (
                    <tr
                      key={`${pr.exercise_id}-${pr.date_achieved}-${i}`}
                      className="border-b border-dark-700/50 last:border-0"
                    >
                      <td className="px-5 py-3 font-medium text-dark-200">
                        {exercise?.name || 'Unknown Exercise'}
                      </td>
                      <td className="px-5 py-3 text-primary-400">{pr.weight_kg} kg</td>
                      <td className="px-5 py-3 text-dark-400">
                        {format(new Date(pr.date_achieved), 'MMM d, yyyy')}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
