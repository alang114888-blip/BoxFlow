import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import {
  PlusIcon,
  TrashIcon,
  ArrowLeftIcon,
  PencilSquareIcon,
  CheckCircleIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline'

const DAYS_OF_WEEK = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
]

export default function WorkoutPlanBuilder() {
  const { profile } = useAuth()
  const [mode, setMode] = useState('list') // list | edit
  const [plans, setPlans] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // Edit state
  const [planId, setPlanId] = useState(null)
  const [planName, setPlanName] = useState('')
  const [planDescription, setPlanDescription] = useState('')
  const [selectedClient, setSelectedClient] = useState('')
  const [clients, setClients] = useState([])
  const [exercises, setExercises] = useState([])
  const [days, setDays] = useState([])
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState(null)

  // Client PRs cache
  const [clientPrs, setClientPrs] = useState({})

  useEffect(() => {
    if (!profile) return
    fetchPlans()
  }, [profile])

  async function fetchPlans() {
    try {
      setLoading(true)
      setError(null)

      const { data, error: fetchErr } = await supabase
        .from('workout_plans')
        .select(`
          id,
          name,
          description,
          is_active,
          client_id,
          profiles!workout_plans_client_id_fkey ( full_name )
        `)
        .eq('trainer_id', profile.id)
        .order('is_active', { ascending: false })

      if (fetchErr) throw fetchErr
      setPlans(data || [])
    } catch (err) {
      console.error('Fetch plans error:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  async function fetchEditData(existingPlanId) {
    try {
      setLoading(true)

      // Fetch clients and exercises in parallel
      const [clientsRes, exercisesRes] = await Promise.all([
        supabase
          .from('trainer_clients')
          .select('client_id, profiles!trainer_clients_client_id_fkey ( id, full_name )')
          .eq('trainer_id', profile.id)
          .eq('invite_accepted', true),
        supabase
          .from('exercises')
          .select('*')
          .eq('trainer_id', profile.id)
          .order('name'),
      ])

      setClients(
        (clientsRes.data || []).map((tc) => ({
          id: tc.client_id,
          full_name: tc.profiles?.full_name || 'Unknown',
        }))
      )
      setExercises(exercisesRes.data || [])

      if (existingPlanId) {
        // Fetch existing plan data
        const { data: planData } = await supabase
          .from('workout_plans')
          .select('*')
          .eq('id', existingPlanId)
          .single()

        if (planData) {
          setPlanName(planData.name)
          setPlanDescription(planData.description || '')
          setSelectedClient(planData.client_id || '')

          // Fetch days with exercises
          const { data: daysData } = await supabase
            .from('workout_days')
            .select(`
              id,
              day_of_week,
              session_number,
              name,
              workout_exercises (
                id,
                exercise_id,
                order_index,
                sets,
                reps,
                percentage_of_pr,
                manual_weight_kg,
                notes
              )
            `)
            .eq('plan_id', existingPlanId)
            .order('day_of_week')

          setDays(
            (daysData || []).map((d) => ({
              ...d,
              _tempId: crypto.randomUUID(),
              workout_exercises: (d.workout_exercises || [])
                .sort((a, b) => a.order_index - b.order_index)
                .map((we) => ({
                  ...we,
                  _tempId: crypto.randomUUID(),
                })),
            }))
          )

          // Load client PRs
          if (planData.client_id) {
            await loadClientPrs(planData.client_id)
          }
        }
      }
    } catch (err) {
      console.error('Fetch edit data error:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  async function loadClientPrs(clientId) {
    if (clientPrs[clientId]) return

    const { data } = await supabase
      .from('client_prs')
      .select('exercise_id, weight_kg')
      .eq('client_id', clientId)

    const prMap = {}
    ;(data || []).forEach((pr) => {
      // Keep only the highest PR per exercise
      if (!prMap[pr.exercise_id] || pr.weight_kg > prMap[pr.exercise_id]) {
        prMap[pr.exercise_id] = pr.weight_kg
      }
    })

    setClientPrs((prev) => ({ ...prev, [clientId]: prMap }))
  }

  function openCreate() {
    setPlanId(null)
    setPlanName('')
    setPlanDescription('')
    setSelectedClient('')
    setDays([])
    setSaveError(null)
    setMode('edit')
    fetchEditData(null)
  }

  function openEdit(plan) {
    setPlanId(plan.id)
    setSaveError(null)
    setMode('edit')
    fetchEditData(plan.id)
  }

  function addDay() {
    setDays((prev) => [
      ...prev,
      {
        _tempId: crypto.randomUUID(),
        day_of_week: null,
        session_number: prev.length + 1,
        name: '',
        workout_exercises: [],
      },
    ])
  }

  function removeDay(tempId) {
    setDays((prev) => prev.filter((d) => d._tempId !== tempId))
  }

  function updateDay(tempId, field, value) {
    setDays((prev) =>
      prev.map((d) => (d._tempId === tempId ? { ...d, [field]: value } : d))
    )
  }

  function addExerciseToDay(dayTempId) {
    setDays((prev) =>
      prev.map((d) => {
        if (d._tempId !== dayTempId) return d
        return {
          ...d,
          workout_exercises: [
            ...d.workout_exercises,
            {
              _tempId: crypto.randomUUID(),
              exercise_id: '',
              order_index: d.workout_exercises.length,
              sets: 3,
              reps: '10',
              percentage_of_pr: null,
              manual_weight_kg: null,
              notes: '',
            },
          ],
        }
      })
    )
  }

  function removeExerciseFromDay(dayTempId, exTempId) {
    setDays((prev) =>
      prev.map((d) => {
        if (d._tempId !== dayTempId) return d
        return {
          ...d,
          workout_exercises: d.workout_exercises.filter(
            (we) => we._tempId !== exTempId
          ),
        }
      })
    )
  }

  function updateExercise(dayTempId, exTempId, field, value) {
    setDays((prev) =>
      prev.map((d) => {
        if (d._tempId !== dayTempId) return d
        return {
          ...d,
          workout_exercises: d.workout_exercises.map((we) =>
            we._tempId === exTempId ? { ...we, [field]: value } : we
          ),
        }
      })
    )
  }

  function getCalculatedWeight(exerciseId, percentagePr) {
    if (!selectedClient || !percentagePr) return null
    const prs = clientPrs[selectedClient]
    if (!prs || !prs[exerciseId]) return null
    return Math.round((prs[exerciseId] * percentagePr) / 100 * 10) / 10
  }

  async function handleSave() {
    try {
      setSaving(true)
      setSaveError(null)

      if (!planName.trim()) {
        setSaveError('Plan name is required.')
        return
      }

      let savedPlanId = planId

      if (savedPlanId) {
        // Update existing plan
        const { error: upErr } = await supabase
          .from('workout_plans')
          .update({
            name: planName.trim(),
            description: planDescription.trim() || null,
            client_id: selectedClient || null,
          })
          .eq('id', savedPlanId)

        if (upErr) throw upErr

        // Delete existing days (cascade should handle exercises)
        await supabase.from('workout_days').delete().eq('plan_id', savedPlanId)
      } else {
        // Create new plan
        const { data: newPlan, error: insErr } = await supabase
          .from('workout_plans')
          .insert({
            trainer_id: profile.id,
            name: planName.trim(),
            description: planDescription.trim() || null,
            client_id: selectedClient || null,
            is_active: true,
          })
          .select()
          .single()

        if (insErr) throw insErr
        savedPlanId = newPlan.id
      }

      // Insert days
      for (let i = 0; i < days.length; i++) {
        const day = days[i]
        const { data: newDay, error: dayErr } = await supabase
          .from('workout_days')
          .insert({
            plan_id: savedPlanId,
            day_of_week: day.day_of_week || null,
            session_number: day.session_number || i + 1,
            name: day.name || `Day ${i + 1}`,
          })
          .select()
          .single()

        if (dayErr) throw dayErr

        // Insert exercises for this day
        const exercisesToInsert = day.workout_exercises
          .filter((we) => we.exercise_id)
          .map((we, idx) => ({
            workout_day_id: newDay.id,
            exercise_id: we.exercise_id,
            order_index: idx,
            sets: parseInt(we.sets) || 0,
            reps: we.reps || null,
            percentage_of_pr: we.percentage_of_pr
              ? parseFloat(we.percentage_of_pr)
              : null,
            manual_weight_kg: we.manual_weight_kg
              ? parseFloat(we.manual_weight_kg)
              : null,
            notes: we.notes || null,
          }))

        if (exercisesToInsert.length > 0) {
          const { error: exErr } = await supabase
            .from('workout_exercises')
            .insert(exercisesToInsert)
          if (exErr) throw exErr
        }
      }

      setMode('list')
      fetchPlans()
    } catch (err) {
      console.error('Save plan error:', err)
      setSaveError(err.message)
    } finally {
      setSaving(false)
    }
  }

  // Handle client change: load PRs
  async function handleClientChange(clientId) {
    setSelectedClient(clientId)
    if (clientId) {
      await loadClientPrs(clientId)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-dark-600 border-t-primary-500" />
      </div>
    )
  }

  // LIST MODE
  if (mode === 'list') {
    return (
      <div className="p-6 lg:p-8">
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <h1 className="text-2xl font-bold text-dark-100">Workout Plans</h1>
          <button
            onClick={openCreate}
            className="flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-500"
          >
            <PlusIcon className="h-4 w-4" />
            Create Plan
          </button>
        </div>

        {error && (
          <div className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-400">
            {error}
          </div>
        )}

        {plans.length === 0 ? (
          <div className="rounded-xl border border-dark-700 bg-dark-800 p-12 text-center">
            <PlusIcon className="mx-auto h-12 w-12 text-dark-500" />
            <p className="mt-3 text-dark-400">
              No workout plans yet. Create your first plan to get started.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {plans.map((plan) => (
              <div
                key={plan.id}
                className="flex items-center justify-between rounded-xl border border-dark-700 bg-dark-800 p-4"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-dark-100">{plan.name}</h3>
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        plan.is_active
                          ? 'bg-green-500/10 text-green-400'
                          : 'bg-dark-600 text-dark-400'
                      }`}
                    >
                      {plan.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-dark-400">
                    Client: {plan.profiles?.full_name || 'Unassigned'}
                  </p>
                  {plan.description && (
                    <p className="mt-1 text-xs text-dark-500">{plan.description}</p>
                  )}
                </div>
                <button
                  onClick={() => openEdit(plan)}
                  className="rounded-lg border border-dark-600 p-2 text-dark-400 transition-colors hover:bg-dark-700 hover:text-dark-200"
                >
                  <PencilSquareIcon className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    )
  }

  // EDIT MODE
  return (
    <div className="p-6 lg:p-8">
      <div className="mb-6 flex items-center gap-4">
        <button
          onClick={() => {
            setMode('list')
            fetchPlans()
          }}
          className="rounded-lg border border-dark-600 p-2 text-dark-400 transition-colors hover:bg-dark-700 hover:text-dark-200"
        >
          <ArrowLeftIcon className="h-4 w-4" />
        </button>
        <h1 className="text-2xl font-bold text-dark-100">
          {planId ? 'Edit Workout Plan' : 'Create Workout Plan'}
        </h1>
      </div>

      {saveError && (
        <div className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-400">
          {saveError}
        </div>
      )}

      {/* Plan Info */}
      <div className="mb-6 rounded-xl border border-dark-700 bg-dark-800 p-4 space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm text-dark-300">Plan Name *</label>
            <input
              type="text"
              value={planName}
              onChange={(e) => setPlanName(e.target.value)}
              className="w-full rounded-lg border border-dark-600 bg-dark-700 px-3 py-2 text-sm text-dark-100 placeholder-dark-500 focus:border-primary-500 focus:outline-none"
              placeholder="e.g. Strength Block A"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm text-dark-300">Client</label>
            <select
              value={selectedClient}
              onChange={(e) => handleClientChange(e.target.value)}
              className="w-full rounded-lg border border-dark-600 bg-dark-700 px-3 py-2 text-sm text-dark-100 focus:border-primary-500 focus:outline-none"
            >
              <option value="">Unassigned</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.full_name}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div>
          <label className="mb-1 block text-sm text-dark-300">Description</label>
          <textarea
            value={planDescription}
            onChange={(e) => setPlanDescription(e.target.value)}
            rows={2}
            className="w-full rounded-lg border border-dark-600 bg-dark-700 px-3 py-2 text-sm text-dark-100 placeholder-dark-500 focus:border-primary-500 focus:outline-none"
            placeholder="Optional description..."
          />
        </div>
      </div>

      {/* Workout Days */}
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-dark-100">Workout Days</h2>
        <button
          onClick={addDay}
          className="flex items-center gap-1 rounded-lg border border-dark-600 px-3 py-1.5 text-sm text-dark-300 transition-colors hover:bg-dark-700"
        >
          <PlusIcon className="h-4 w-4" />
          Add Day
        </button>
      </div>

      {days.length === 0 ? (
        <div className="rounded-xl border border-dark-700 bg-dark-800 p-8 text-center">
          <p className="text-sm text-dark-400">
            No workout days added yet. Click "Add Day" to start building.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {days.map((day, dayIndex) => (
            <div
              key={day._tempId}
              className="rounded-xl border border-dark-700 bg-dark-800 p-4"
            >
              {/* Day Header */}
              <div className="mb-4 flex items-start justify-between gap-4">
                <div className="grid flex-1 gap-3 sm:grid-cols-3">
                  <div>
                    <label className="mb-1 block text-xs text-dark-400">
                      Day Name
                    </label>
                    <input
                      type="text"
                      value={day.name}
                      onChange={(e) =>
                        updateDay(day._tempId, 'name', e.target.value)
                      }
                      className="w-full rounded border border-dark-600 bg-dark-700 px-2 py-1.5 text-sm text-dark-100 focus:border-primary-500 focus:outline-none"
                      placeholder={`Day ${dayIndex + 1}`}
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs text-dark-400">
                      Day of Week
                    </label>
                    <select
                      value={day.day_of_week ?? ''}
                      onChange={(e) =>
                        updateDay(
                          day._tempId,
                          'day_of_week',
                          e.target.value ? parseInt(e.target.value) : null
                        )
                      }
                      className="w-full rounded border border-dark-600 bg-dark-700 px-2 py-1.5 text-sm text-dark-100 focus:border-primary-500 focus:outline-none"
                    >
                      <option value="">No specific day</option>
                      {DAYS_OF_WEEK.map((d, i) => (
                        <option key={d} value={i + 1}>
                          {d}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-xs text-dark-400">
                      Session #
                    </label>
                    <input
                      type="number"
                      min={1}
                      value={day.session_number || ''}
                      onChange={(e) =>
                        updateDay(
                          day._tempId,
                          'session_number',
                          parseInt(e.target.value) || null
                        )
                      }
                      className="w-full rounded border border-dark-600 bg-dark-700 px-2 py-1.5 text-sm text-dark-100 focus:border-primary-500 focus:outline-none"
                    />
                  </div>
                </div>
                <button
                  onClick={() => removeDay(day._tempId)}
                  className="mt-5 rounded p-1 text-dark-400 transition-colors hover:bg-red-500/10 hover:text-red-400"
                >
                  <TrashIcon className="h-4 w-4" />
                </button>
              </div>

              {/* Exercises Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-dark-600 text-left text-xs text-dark-400">
                      <th className="pb-2 pr-2">Exercise</th>
                      <th className="pb-2 pr-2 w-16">Sets</th>
                      <th className="pb-2 pr-2 w-20">Reps</th>
                      <th className="pb-2 pr-2 w-20">% PR</th>
                      <th className="pb-2 pr-2 w-24">Weight (kg)</th>
                      <th className="pb-2 pr-2">Notes</th>
                      <th className="pb-2 w-8"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {day.workout_exercises.map((we) => {
                      const selectedExercise = exercises.find(
                        (ex) => ex.id === we.exercise_id
                      )
                      const isPrEligible = selectedExercise?.is_pr_eligible
                      const calculatedWeight = isPrEligible
                        ? getCalculatedWeight(we.exercise_id, we.percentage_of_pr)
                        : null

                      return (
                        <tr key={we._tempId} className="border-b border-dark-700/50">
                          <td className="py-2 pr-2">
                            <select
                              value={we.exercise_id}
                              onChange={(e) =>
                                updateExercise(
                                  day._tempId,
                                  we._tempId,
                                  'exercise_id',
                                  e.target.value
                                )
                              }
                              className="w-full min-w-[140px] rounded border border-dark-600 bg-dark-700 px-2 py-1 text-sm text-dark-100 focus:border-primary-500 focus:outline-none"
                            >
                              <option value="">Select...</option>
                              {exercises.map((ex) => (
                                <option key={ex.id} value={ex.id}>
                                  {ex.name}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td className="py-2 pr-2">
                            <input
                              type="number"
                              min={1}
                              value={we.sets}
                              onChange={(e) =>
                                updateExercise(
                                  day._tempId,
                                  we._tempId,
                                  'sets',
                                  e.target.value
                                )
                              }
                              className="w-full rounded border border-dark-600 bg-dark-700 px-2 py-1 text-sm text-dark-100 focus:border-primary-500 focus:outline-none"
                            />
                          </td>
                          <td className="py-2 pr-2">
                            <input
                              type="text"
                              value={we.reps}
                              onChange={(e) =>
                                updateExercise(
                                  day._tempId,
                                  we._tempId,
                                  'reps',
                                  e.target.value
                                )
                              }
                              className="w-full rounded border border-dark-600 bg-dark-700 px-2 py-1 text-sm text-dark-100 focus:border-primary-500 focus:outline-none"
                              placeholder="e.g. 8-10"
                            />
                          </td>
                          <td className="py-2 pr-2">
                            {isPrEligible ? (
                              <input
                                type="number"
                                min={0}
                                max={200}
                                value={we.percentage_of_pr || ''}
                                onChange={(e) =>
                                  updateExercise(
                                    day._tempId,
                                    we._tempId,
                                    'percentage_of_pr',
                                    e.target.value
                                  )
                                }
                                className="w-full rounded border border-dark-600 bg-dark-700 px-2 py-1 text-sm text-dark-100 focus:border-primary-500 focus:outline-none"
                                placeholder="%"
                              />
                            ) : (
                              <span className="text-xs text-dark-500">N/A</span>
                            )}
                          </td>
                          <td className="py-2 pr-2">
                            {isPrEligible && calculatedWeight ? (
                              <span className="text-sm font-medium text-primary-400">
                                {calculatedWeight} kg
                              </span>
                            ) : (
                              <input
                                type="number"
                                step="0.5"
                                min={0}
                                value={we.manual_weight_kg || ''}
                                onChange={(e) =>
                                  updateExercise(
                                    day._tempId,
                                    we._tempId,
                                    'manual_weight_kg',
                                    e.target.value
                                  )
                                }
                                className="w-full rounded border border-dark-600 bg-dark-700 px-2 py-1 text-sm text-dark-100 focus:border-primary-500 focus:outline-none"
                                placeholder="kg"
                              />
                            )}
                          </td>
                          <td className="py-2 pr-2">
                            <input
                              type="text"
                              value={we.notes || ''}
                              onChange={(e) =>
                                updateExercise(
                                  day._tempId,
                                  we._tempId,
                                  'notes',
                                  e.target.value
                                )
                              }
                              className="w-full min-w-[100px] rounded border border-dark-600 bg-dark-700 px-2 py-1 text-sm text-dark-100 focus:border-primary-500 focus:outline-none"
                              placeholder="Notes"
                            />
                          </td>
                          <td className="py-2">
                            <button
                              onClick={() =>
                                removeExerciseFromDay(day._tempId, we._tempId)
                              }
                              className="rounded p-1 text-dark-400 hover:text-red-400"
                            >
                              <XMarkIcon className="h-4 w-4" />
                            </button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              <button
                onClick={() => addExerciseToDay(day._tempId)}
                className="mt-3 flex items-center gap-1 text-xs text-primary-400 hover:text-primary-300"
              >
                <PlusIcon className="h-3.5 w-3.5" />
                Add Exercise
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Save Button */}
      <div className="mt-6 flex justify-end gap-3">
        <button
          onClick={() => {
            setMode('list')
            fetchPlans()
          }}
          className="rounded-lg border border-dark-600 px-4 py-2 text-sm text-dark-300 transition-colors hover:bg-dark-700"
        >
          Cancel
        </button>
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 rounded-lg bg-primary-600 px-6 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-500 disabled:opacity-50"
        >
          <CheckCircleIcon className="h-4 w-4" />
          {saving ? 'Saving...' : 'Save Plan'}
        </button>
      </div>
    </div>
  )
}
