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

const SECTIONS = [
  { value: 'warmup', label: 'Warmup', color: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30' },
  { value: 'strength', label: 'Strength', color: 'bg-red-500/15 text-red-400 border-red-500/30' },
  { value: 'cardio', label: 'Cardio', color: 'bg-blue-500/15 text-blue-400 border-blue-500/30' },
  { value: 'metcon', label: 'Metcon', color: 'bg-green-500/15 text-green-400 border-green-500/30' },
  { value: 'other', label: 'Other', color: 'bg-gray-500/15 text-gray-400 border-gray-500/30' },
]

const SECTION_ORDER = ['warmup', 'strength', 'cardio', 'metcon', 'other']

function sectionIndex(s) {
  const idx = SECTION_ORDER.indexOf(s)
  return idx === -1 ? SECTION_ORDER.length : idx
}

function getSectionMeta(value) {
  return SECTIONS.find((s) => s.value === value) || SECTIONS[4]
}

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
  const [publishMetcon, setPublishMetcon] = useState(false)

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
                notes,
                section,
                section_order
              )
            `)
            .eq('plan_id', existingPlanId)
            .order('day_of_week')

          setDays(
            (daysData || []).map((d) => ({
              ...d,
              _tempId: crypto.randomUUID(),
              workout_exercises: (d.workout_exercises || [])
                .sort((a, b) => {
                  const sa = sectionIndex(a.section || 'other')
                  const sb = sectionIndex(b.section || 'other')
                  if (sa !== sb) return sa - sb
                  return (a.section_order ?? a.order_index) - (b.section_order ?? b.order_index)
                })
                .map((we) => ({
                  ...we,
                  section: we.section || 'other',
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

  function addExerciseToDay(dayTempId, section = 'other') {
    setDays((prev) =>
      prev.map((d) => {
        if (d._tempId !== dayTempId) return d
        const sectionExercises = d.workout_exercises.filter((we) => we.section === section)
        return {
          ...d,
          workout_exercises: [
            ...d.workout_exercises,
            {
              _tempId: crypto.randomUUID(),
              exercise_id: '',
              custom_name: '',
              order_index: d.workout_exercises.length,
              sets: 3,
              reps: '10',
              percentage_of_pr: null,
              manual_weight_kg: null,
              notes: '',
              section,
              section_order: sectionExercises.length,
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

  /** Group a day's exercises by section in fixed order */
  function groupBySection(workoutExercises) {
    const groups = []
    for (const sec of SECTION_ORDER) {
      const items = workoutExercises.filter((we) => (we.section || 'other') === sec)
      if (items.length > 0) {
        groups.push({ section: sec, meta: getSectionMeta(sec), items })
      }
    }
    return groups
  }

  async function handleSave() {
    try {
      setSaving(true)
      setSaveError(null)

      if (!selectedClient) {
        setSaveError('Please select a client.')
        return
      }

      // Auto-generate plan name if empty
      if (!planName.trim()) {
        const client = clients.find(c => c.id === selectedClient)
        const weekStart = new Date()
        weekStart.setDate(weekStart.getDate() - weekStart.getDay() + 1)
        setPlanName(`${client?.full_name || 'Client'} - Week of ${weekStart.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}`)
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

        // Build exercises with section_order computed per section
        const sectionCounters = {}
        const exercisesToInsert = day.workout_exercises
          .filter((we) => we.exercise_id || we.custom_name)
          .filter((we) => we.exercise_id !== '__other__' || we.custom_name)
          .map((we, idx) => {
            const sec = we.section || 'other'
            if (sectionCounters[sec] == null) sectionCounters[sec] = 0
            const secOrder = sectionCounters[sec]++
            const isOtherFreeText = we.exercise_id === '__other__'
            return {
              workout_day_id: newDay.id,
              exercise_id: isOtherFreeText ? null : we.exercise_id,
              order_index: idx,
              sets: parseInt(we.sets) || 0,
              reps: we.reps || null,
              percentage_of_pr: we.percentage_of_pr
                ? parseFloat(we.percentage_of_pr)
                : null,
              manual_weight_kg: we.manual_weight_kg
                ? parseFloat(we.manual_weight_kg)
                : null,
              notes: isOtherFreeText
                ? `[${we.custom_name}] ${we.notes || ''}`.trim()
                : (we.notes || null),
              section: sec,
              section_order: secOrder,
            }
          })

        if (exercisesToInsert.length > 0) {
          const { error: exErr } = await supabase
            .from('workout_exercises')
            .insert(exercisesToInsert)
          if (exErr) throw exErr
        }
      }

      // Publish metcon to leaderboard as WOD
      if (publishMetcon) {
        const metconExercises = days.flatMap(d =>
          d.workout_exercises.filter(we => (we.section || 'other') === 'metcon' && (we.exercise_id || we.custom_name))
        )
        if (metconExercises.length > 0) {
          const details = metconExercises.map(we => {
            const ex = we.exercise_id && we.exercise_id !== '__other__' ? exercises.find(e => e.id === we.exercise_id) : null
            return `${we.sets || ''}x${we.reps || ''} ${ex?.name || we.custom_name || 'Exercise'}${we.notes ? ' (' + we.notes + ')' : ''}`
          }).join('\n')

          await supabase.from('wods').insert({
            trainer_id: profile.id,
            title: planName.trim() + ' - Metcon',
            description: details,
            section: 'metcon',
            workout_details: { exercises: metconExercises.map(we => ({ name: exercises.find(e => e.id === we.exercise_id)?.name || we.custom_name, sets: we.sets, reps: we.reps, notes: we.notes })) },
          })
        }
      }

      setMode('list')
      setPublishMetcon(false)
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

      {/* Plan Info — no plan name field, auto-generated */}
      <div className="mb-6 rounded-xl border border-dark-700 bg-dark-800 p-4 space-y-3">
        <div>
          <label className="mb-1 block text-sm text-dark-300">Client *</label>
          <select
            value={selectedClient}
            onChange={(e) => {
              handleClientChange(e.target.value)
              // Auto-generate plan name
              const client = clients.find(c => c.id === e.target.value)
              if (client) {
                const weekStart = new Date()
                weekStart.setDate(weekStart.getDate() - weekStart.getDay() + 1)
                setPlanName(`${client.full_name} - Week of ${weekStart.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}`)
              }
            }}
            className="w-full rounded-lg border border-dark-600 bg-dark-700 px-3 py-2 text-sm text-dark-100 focus:border-primary-500 focus:outline-none"
          >
            <option value="">Select client...</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>{c.full_name}</option>
            ))}
          </select>
        </div>
        {planName && (
          <p className="text-xs text-dark-400">
            <span className="material-symbols-outlined text-[14px] align-middle mr-1">label</span>
            {planName}
          </p>
        )}
        <div>
          <label className="mb-1 block text-sm text-dark-300">Description (optional)</label>
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
          {days.map((day, dayIndex) => {
            const grouped = groupBySection(day.workout_exercises)

            return (
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

                {/* Exercises grouped by section */}
                <div className="space-y-4">
                  {grouped.map(({ section, meta, items }) => (
                    <div key={section}>
                      {/* Section Header */}
                      <div className="mb-2 flex items-center justify-between">
                        <span
                          className={`inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs font-semibold ${meta.color}`}
                        >
                          {meta.label}
                        </span>
                        {section === 'metcon' && (
                          <label className="flex items-center gap-2 cursor-pointer">
                            <span className="text-[10px] text-dark-400 uppercase tracking-wider font-medium">Publish to Leaderboard</span>
                            <button
                              type="button"
                              onClick={() => setPublishMetcon(!publishMetcon)}
                              className={`relative w-9 h-5 rounded-full transition-colors ${publishMetcon ? 'bg-primary' : 'bg-dark-600'}`}
                            >
                              <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${publishMetcon ? 'translate-x-4' : ''}`} />
                            </button>
                          </label>
                        )}
                      </div>

                      {/* Exercise Cards (mobile-friendly, no horizontal scroll) */}
                      <div className="space-y-2">
                        {items.map((we) => {
                          const isOther = we.exercise_id === '__other__'
                          const selectedExercise = !isOther ? exercises.find((ex) => ex.id === we.exercise_id) : null
                          const isPrEligible = selectedExercise?.is_pr_eligible
                          const calculatedWeight = isPrEligible ? getCalculatedWeight(we.exercise_id, we.percentage_of_pr) : null
                          const prValue = selectedClient && clientPrs[selectedClient]?.[we.exercise_id]

                          return (
                            <div key={we._tempId} className="rounded-xl border border-dark-600 bg-dark-700/50 p-3 space-y-2">
                              {/* Row 1: Exercise select + delete */}
                              <div className="flex items-start gap-2">
                                <div className="flex-1">
                                  <select
                                    value={we.exercise_id}
                                    onChange={(e) => {
                                      updateExercise(day._tempId, we._tempId, 'exercise_id', e.target.value)
                                      if (e.target.value !== '__other__') updateExercise(day._tempId, we._tempId, 'custom_name', '')
                                    }}
                                    className="w-full rounded-lg border border-dark-600 bg-dark-700 px-3 py-2 text-sm text-dark-100 focus:border-primary-500 focus:outline-none"
                                  >
                                    <option value="">Select exercise...</option>
                                    {exercises.filter(ex => ex.is_pr_eligible).length > 0 && (
                                      <optgroup label="PR Exercises">
                                        {exercises.filter(ex => ex.is_pr_eligible).map((ex) => (
                                          <option key={ex.id} value={ex.id}>{ex.name}</option>
                                        ))}
                                      </optgroup>
                                    )}
                                    {exercises.filter(ex => !ex.is_pr_eligible).length > 0 && (
                                      <optgroup label="Other Exercises">
                                        {exercises.filter(ex => !ex.is_pr_eligible).map((ex) => (
                                          <option key={ex.id} value={ex.id}>{ex.name}</option>
                                        ))}
                                      </optgroup>
                                    )}
                                    <option value="__other__">✏️ Other (free text)</option>
                                  </select>
                                  {isOther && (
                                    <input
                                      type="text" value={we.custom_name || ''}
                                      onChange={(e) => updateExercise(day._tempId, we._tempId, 'custom_name', e.target.value)}
                                      className="mt-1 w-full rounded-lg border border-dark-600 bg-dark-700 px-3 py-2 text-sm text-dark-100 focus:border-primary-500 focus:outline-none"
                                      placeholder="Exercise name..."
                                    />
                                  )}
                                  {isPrEligible && prValue > 0 && (
                                    <p className="mt-0.5 text-[10px] text-primary-400 font-medium px-1">PR: {prValue}kg</p>
                                  )}
                                </div>
                                <button onClick={() => removeExerciseFromDay(day._tempId, we._tempId)} className="mt-1 rounded-lg p-1.5 text-dark-400 hover:text-red-400 hover:bg-red-500/10 transition">
                                  <XMarkIcon className="h-4 w-4" />
                                </button>
                              </div>

                              {/* Row 2: Sets | Reps | %PR | =Weight (compact, same row) */}
                              <div className="grid grid-cols-4 gap-2">
                                <div>
                                  <label className="block text-[9px] text-dark-400 uppercase font-bold mb-0.5 px-1">Sets</label>
                                  <input
                                    type="number" min={1} value={we.sets}
                                    onChange={(e) => updateExercise(day._tempId, we._tempId, 'sets', e.target.value)}
                                    className="w-full rounded-lg border border-dark-600 bg-dark-700 px-2 py-1.5 text-sm text-center text-dark-100 focus:border-primary-500 focus:outline-none"
                                  />
                                </div>
                                <div>
                                  <label className="block text-[9px] text-dark-400 uppercase font-bold mb-0.5 px-1">Reps</label>
                                  <input
                                    type="text" value={we.reps}
                                    onChange={(e) => updateExercise(day._tempId, we._tempId, 'reps', e.target.value)}
                                    className="w-full rounded-lg border border-dark-600 bg-dark-700 px-2 py-1.5 text-sm text-center text-dark-100 focus:border-primary-500 focus:outline-none"
                                    placeholder="8-10"
                                  />
                                </div>
                                <div>
                                  <label className="block text-[9px] text-dark-400 uppercase font-bold mb-0.5 px-1">% PR</label>
                                  {isPrEligible ? (
                                    <input
                                      type="number" min={1} max={100}
                                      value={we.percentage_of_pr || ''}
                                      onChange={(e) => updateExercise(day._tempId, we._tempId, 'percentage_of_pr', e.target.value)}
                                      className="w-full rounded-lg border border-primary/30 bg-primary/5 px-2 py-1.5 text-sm text-center text-primary font-bold focus:border-primary focus:outline-none"
                                      placeholder="%"
                                    />
                                  ) : (
                                    <div className="w-full rounded-lg bg-dark-700/30 px-2 py-1.5 text-sm text-center text-dark-500">—</div>
                                  )}
                                </div>
                                <div>
                                  <label className="block text-[9px] text-dark-400 uppercase font-bold mb-0.5 px-1">= kg</label>
                                  <div className="w-full rounded-lg border border-dark-600 bg-dark-700/30 px-2 py-1.5 text-sm text-center">
                                    {isPrEligible ? (
                                      calculatedWeight != null ? (
                                        <span className="font-bold text-primary">{calculatedWeight}</span>
                                      ) : we.percentage_of_pr && selectedClient && prValue == null ? (
                                        <span className="text-[9px] text-amber-400 font-medium">Set PR</span>
                                      ) : (
                                        <span className="text-dark-500">—</span>
                                      )
                                    ) : (
                                      <span className="text-dark-500">—</span>
                                    )}
                                  </div>
                                </div>
                              </div>

                              {/* Row 3: Notes (only if Other or has notes) */}
                              {(isOther || !isPrEligible) && (
                                <input
                                  type="text" value={we.notes || ''}
                                  onChange={(e) => updateExercise(day._tempId, we._tempId, 'notes', e.target.value)}
                                  className="w-full rounded-lg border border-dark-600 bg-dark-700 px-3 py-1.5 text-sm text-dark-100 focus:border-primary-500 focus:outline-none"
                                  placeholder={isOther ? 'Description / weight / details...' : 'Notes (optional)'}
                                />
                              )}
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Add Exercise with Section Picker */}
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <span className="text-xs text-dark-400">Add exercise to:</span>
                  {SECTIONS.map((sec) => (
                    <button
                      key={sec.value}
                      onClick={() => addExerciseToDay(day._tempId, sec.value)}
                      className={`flex items-center gap-1 rounded-md border px-2 py-1 text-xs font-medium transition-colors hover:opacity-80 ${sec.color}`}
                    >
                      <PlusIcon className="h-3 w-3" />
                      {sec.label}
                    </button>
                  ))}
                </div>
              </div>
            )
          })}
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
