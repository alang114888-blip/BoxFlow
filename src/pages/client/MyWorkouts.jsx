import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { supabase } from '../../lib/supabase'
import {
  CheckCircleIcon,
  ClockIcon,
  StarIcon,
  ChevronDownIcon,
} from '@heroicons/react/24/outline'
import { format } from 'date-fns'

const DAY_ORDER = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

const SECTION_ORDER = ['warmup', 'strength', 'cardio', 'metcon', 'other']

const SECTION_META = {
  warmup:   { label: 'Warmup',   color: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30' },
  strength: { label: 'Strength', color: 'bg-red-500/15 text-red-400 border-red-500/30' },
  cardio:   { label: 'Cardio',   color: 'bg-blue-500/15 text-blue-400 border-blue-500/30' },
  metcon:   { label: 'Metcon',   color: 'bg-green-500/15 text-green-400 border-green-500/30' },
  other:    { label: 'Other',    color: 'bg-gray-500/15 text-gray-400 border-gray-500/30' },
}

function groupBySection(exercises) {
  const groups = []
  for (const sec of SECTION_ORDER) {
    const items = exercises.filter((we) => (we.section || 'other') === sec)
    if (items.length > 0) {
      items.sort((a, b) => (a.section_order ?? a.order_index) - (b.section_order ?? b.order_index))
      groups.push({ section: sec, meta: SECTION_META[sec], items })
    }
  }
  return groups
}

export default function MyWorkouts() {
  const { profile } = useAuth()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [plan, setPlan] = useState(null)
  const [workoutDays, setWorkoutDays] = useState([])
  const [selectedDayId, setSelectedDayId] = useState(null)
  const [prs, setPrs] = useState({})
  const [logs, setLogs] = useState([])
  const [completing, setCompleting] = useState(false)
  const [completeNotes, setCompleteNotes] = useState('')
  const [completeScore, setCompleteScore] = useState(7)
  const [showCompleteForm, setShowCompleteForm] = useState(false)
  const [showHistory, setShowHistory] = useState(false)

  const fetchData = useCallback(async () => {
    if (!profile?.id) return
    try {
      setLoading(true)
      setError(null)

      const [planRes, prRes, logsRes] = await Promise.all([
        supabase
          .from('workout_plans')
          .select(`
            id, name, description,
            workout_days (
              id, day_of_week, session_number, name,
              workout_exercises (
                id, order_index, sets, reps, percentage_of_pr, manual_weight_kg, notes,
                section, section_order,
                exercises ( id, name, category, is_pr_eligible )
              )
            )
          `)
          .eq('client_id', profile.id)
          .eq('is_active', true)
          .limit(1)
          .single(),

        supabase
          .from('client_prs')
          .select('exercise_id, weight_kg')
          .eq('client_id', profile.id),

        supabase
          .from('workout_logs')
          .select(`
            id, completed_at, notes, score,
            workout_days ( id, name, day_of_week )
          `)
          .eq('client_id', profile.id)
          .order('completed_at', { ascending: false })
          .limit(20),
      ])

      if (planRes.error && planRes.error.code !== 'PGRST116') throw planRes.error

      const prMap = {}
      if (prRes.data) {
        prRes.data.forEach((pr) => {
          prMap[pr.exercise_id] = pr.weight_kg
        })
      }
      setPrs(prMap)
      setLogs(logsRes.data || [])

      if (planRes.data) {
        setPlan(planRes.data)
        const sorted = [...(planRes.data.workout_days || [])].sort(
          (a, b) => DAY_ORDER.indexOf(a.day_of_week) - DAY_ORDER.indexOf(b.day_of_week)
        )
        setWorkoutDays(sorted)

        // Auto-select today's day or first day
        const todayName = DAY_ORDER[(new Date().getDay() + 6) % 7]
        const todayDay = sorted.find((d) => d.day_of_week === todayName)
        setSelectedDayId(todayDay?.id || sorted[0]?.id || null)
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [profile?.id])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  function calculateWeight(exercise) {
    const ex = exercise.exercises
    if (!ex) return exercise.manual_weight_kg || '-'

    if (ex.is_pr_eligible && exercise.percentage_of_pr && prs[ex.id]) {
      return Math.round((prs[ex.id] * exercise.percentage_of_pr) / 100 * 10) / 10
    }

    return exercise.manual_weight_kg || '-'
  }

  async function handleMarkAsDone() {
    if (!selectedDayId || completing) return
    try {
      setCompleting(true)
      const { error: insertError } = await supabase
        .from('workout_logs')
        .insert({
          client_id: profile.id,
          workout_day_id: selectedDayId,
          completed_at: new Date().toISOString(),
          notes: completeNotes || null,
          score: completeScore,
        })

      if (insertError) throw insertError

      setCompleteNotes('')
      setCompleteScore(7)
      setShowCompleteForm(false)
      await fetchData()
    } catch (err) {
      setError(err.message)
    } finally {
      setCompleting(false)
    }
  }

  const selectedDay = workoutDays.find((d) => d.id === selectedDayId)
  const allExercises = selectedDay?.workout_exercises
    ? [...selectedDay.workout_exercises]
    : []
  const sectionGroups = groupBySection(allExercises)

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
          Failed to load workouts: {error}
        </div>
      </div>
    )
  }

  if (!plan) {
    return (
      <div className="mx-auto max-w-4xl p-6">
        <h1 className="mb-4 text-2xl font-bold text-dark-100">My Workouts</h1>
        <div className="rounded-lg border border-dark-700 bg-dark-800 p-8 text-center">
          <ClockIcon className="mx-auto mb-3 h-12 w-12 text-dark-500" />
          <p className="text-dark-400">No active workout plan assigned yet.</p>
          <p className="mt-1 text-sm text-dark-500">Your trainer will assign one soon.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-dark-100">My Workouts</h1>
        <p className="mt-1 text-dark-400">{plan.name}</p>
        {plan.description && <p className="text-sm text-dark-500">{plan.description}</p>}
      </div>

      {/* Day Tabs */}
      <div className="flex flex-wrap gap-2">
        {workoutDays.map((day) => (
          <button
            key={day.id}
            onClick={() => {
              setSelectedDayId(day.id)
              setShowCompleteForm(false)
            }}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
              selectedDayId === day.id
                ? 'bg-primary-600 text-white'
                : 'bg-dark-700 text-dark-300 hover:bg-dark-600 hover:text-dark-200'
            }`}
          >
            {day.name || day.day_of_week}
          </button>
        ))}
      </div>

      {/* Exercise Table grouped by section */}
      {selectedDay && (
        <div className="rounded-lg border border-dark-700 bg-dark-800">
          <div className="border-b border-dark-700 px-5 py-3">
            <h2 className="font-semibold text-dark-100">
              {selectedDay.name || selectedDay.day_of_week}
            </h2>
            {selectedDay.session_number && (
              <p className="text-xs text-dark-500">Session {selectedDay.session_number}</p>
            )}
          </div>

          {sectionGroups.length > 0 ? (
            <div className="divide-y divide-dark-700">
              {sectionGroups.map(({ section, meta, items }) => (
                <div key={section}>
                  {/* Section Badge */}
                  <div className="px-5 pt-4 pb-2">
                    <span
                      className={`inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs font-semibold ${meta.color}`}
                    >
                      {meta.label}
                    </span>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                      <thead>
                        <tr className="border-b border-dark-700 text-dark-400">
                          <th className="px-5 py-2 font-medium">Exercise</th>
                          <th className="px-5 py-2 font-medium">Sets</th>
                          <th className="px-5 py-2 font-medium">Reps</th>
                          <th className="px-5 py-2 font-medium">Weight (kg)</th>
                          <th className="px-5 py-2 font-medium">Notes</th>
                        </tr>
                      </thead>
                      <tbody>
                        {items.map((we) => (
                          <tr key={we.id} className="border-b border-dark-700/50 last:border-0">
                            <td className="px-5 py-3 font-medium text-dark-200">
                              {we.exercises?.name || 'Unknown'}
                              <span className="ml-2 text-xs text-dark-500">
                                {we.exercises?.category}
                              </span>
                            </td>
                            <td className="px-5 py-3 text-dark-300">{we.sets}</td>
                            <td className="px-5 py-3 text-dark-300">{we.reps}</td>
                            <td className="px-5 py-3 font-medium text-primary-400">
                              {calculateWeight(we)}
                            </td>
                            <td className="px-5 py-3 text-dark-500">{we.notes || '-'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-5 text-center text-dark-400">
              No exercises assigned for this day.
            </div>
          )}

          {/* Mark as Done */}
          <div className="border-t border-dark-700 px-5 py-4">
            {!showCompleteForm ? (
              <button
                onClick={() => setShowCompleteForm(true)}
                className="flex items-center gap-2 rounded-lg bg-primary-600 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-primary-500"
              >
                <CheckCircleIcon className="h-5 w-5" />
                Mark as Done
              </button>
            ) : (
              <div className="space-y-4">
                <div>
                  <label className="mb-1 block text-sm font-medium text-dark-300">
                    How did it go? Score (1-10)
                  </label>
                  <div className="flex gap-1">
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
                      <button
                        key={n}
                        onClick={() => setCompleteScore(n)}
                        className={`flex h-9 w-9 items-center justify-center rounded-md text-sm font-medium transition-colors ${
                          completeScore === n
                            ? 'bg-primary-600 text-white'
                            : 'bg-dark-700 text-dark-400 hover:bg-dark-600'
                        }`}
                      >
                        {n}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-dark-300">
                    Notes (optional)
                  </label>
                  <textarea
                    value={completeNotes}
                    onChange={(e) => setCompleteNotes(e.target.value)}
                    rows={2}
                    placeholder="How was the session? Any observations..."
                    className="w-full rounded-lg border border-dark-600 bg-dark-700 px-3 py-2 text-sm text-dark-200 placeholder-dark-500 focus:border-primary-500 focus:outline-none"
                  />
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={handleMarkAsDone}
                    disabled={completing}
                    className="flex items-center gap-2 rounded-lg bg-primary-600 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-primary-500 disabled:opacity-50"
                  >
                    {completing ? (
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                    ) : (
                      <CheckCircleIcon className="h-5 w-5" />
                    )}
                    Complete Workout
                  </button>
                  <button
                    onClick={() => setShowCompleteForm(false)}
                    className="rounded-lg bg-dark-700 px-4 py-2.5 text-sm text-dark-300 hover:bg-dark-600"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Workout History */}
      <div className="rounded-lg border border-dark-700 bg-dark-800">
        <button
          onClick={() => setShowHistory(!showHistory)}
          className="flex w-full items-center justify-between px-5 py-4 text-left"
        >
          <h2 className="text-lg font-semibold text-dark-100">Workout History</h2>
          <ChevronDownIcon
            className={`h-5 w-5 text-dark-400 transition-transform ${
              showHistory ? 'rotate-180' : ''
            }`}
          />
        </button>
        {showHistory && (
          <div className="border-t border-dark-700 px-5 py-4">
            {logs.length > 0 ? (
              <div className="space-y-3">
                {logs.map((log) => (
                  <div
                    key={log.id}
                    className="flex items-center justify-between rounded-md border border-dark-700 bg-dark-700 px-4 py-3"
                  >
                    <div>
                      <p className="font-medium text-dark-200">
                        {log.workout_days?.name || log.workout_days?.day_of_week || 'Workout'}
                      </p>
                      <p className="text-xs text-dark-500">
                        {format(new Date(log.completed_at), 'MMM d, yyyy h:mm a')}
                      </p>
                      {log.notes && (
                        <p className="mt-1 text-sm text-dark-400">{log.notes}</p>
                      )}
                    </div>
                    {log.score != null && (
                      <div className="flex items-center gap-1">
                        <StarIcon className="h-4 w-4 text-primary-500" />
                        <span className="font-bold text-primary-400">{log.score}</span>
                        <span className="text-xs text-dark-500">/10</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-center text-dark-400">No workouts completed yet.</p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
