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
  { label: 'Monday', value: 'monday' },
  { label: 'Tuesday', value: 'tuesday' },
  { label: 'Wednesday', value: 'wednesday' },
  { label: 'Thursday', value: 'thursday' },
  { label: 'Friday', value: 'friday' },
  { label: 'Saturday', value: 'saturday' },
  { label: 'Sunday', value: 'sunday' },
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
      const [clientsRes, trainerExRes, sysExRes] = await Promise.all([
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
        supabase
          .from('exercises')
          .select('*')
          .is('trainer_id', null)
          .eq('is_default', true)
          .order('name'),
      ])

      setClients(
        (clientsRes.data || []).map((tc) => ({
          id: tc.client_id,
          full_name: tc.profiles?.full_name || 'Unknown',
        }))
      )
      setExercises([...(sysExRes.data || []), ...(trainerExRes.data || [])])

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

  function removeSectionFromDay(dayTempId, section) {
    setDays((prev) =>
      prev.map((d) => {
        if (d._tempId !== dayTempId) return d
        return { ...d, workout_exercises: d.workout_exercises.filter((we) => we.section !== section) }
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
    if (!percentagePr) return null
    if (!selectedClient) return null // no client yet, can't calc
    const prs = clientPrs[selectedClient]
    if (!prs || !prs[exerciseId]) return null // no PR set
    return Math.round((prs[exerciseId] * percentagePr) / 100 * 10) / 10
  }

  function getPrValue(exerciseId) {
    if (!selectedClient) return undefined
    return clientPrs[selectedClient]?.[exerciseId]
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

  // Shared exercise select options renderer
  function ExerciseOptions() {
    return (
      <>
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
        <option value="__other__">Other (free text)</option>
      </>
    )
  }

  // Shared section color helpers
  function secBorderColor(meta) { return meta.color.split(' ').find(c => c.startsWith('border-')) || 'border-dark-600' }
  function secBgColor(meta) { return meta.color.split(' ').find(c => c.startsWith('bg-')) || 'bg-dark-700' }
  function secTextColor(meta) { return meta.color.split(' ').find(c => c.startsWith('text-')) || 'text-dark-300' }

  // Get exercise info for a workout exercise
  function getExInfo(we) {
    const isOther = we.exercise_id === '__other__'
    const selectedExercise = !isOther && we.exercise_id ? exercises.find((ex) => ex.id === we.exercise_id) : null
    const isPrEligible = selectedExercise?.is_pr_eligible || false
    const calculatedWeight = isPrEligible ? getCalculatedWeight(we.exercise_id, we.percentage_of_pr) : null
    const prValue = getPrValue(we.exercise_id)
    return { isOther, selectedExercise, isPrEligible, calculatedWeight, prValue }
  }

  // Keyboard handler for spreadsheet mode
  function handleSpreadsheetKeyDown(e, dayTempId, section, exIndex, items) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      addExerciseToDay(dayTempId, section)
    }
    if (e.key === 'Backspace' && e.target.value === '' && items.length > 1) {
      const we = items[exIndex]
      if (we && !we.exercise_id) {
        e.preventDefault()
        removeExerciseFromDay(dayTempId, we._tempId)
      }
    }
  }

  const clientName = clients.find(c => c.id === selectedClient)?.full_name || ''
  const weekLabel = (() => {
    const d = new Date(); d.setDate(d.getDate() - d.getDay() + 1)
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  })()

  // Cell classes for spreadsheet
  const cellCls = 'px-2 py-1 text-sm text-dark-100 bg-transparent border-r border-dark-600/50 focus:outline-none focus:ring-1 focus:ring-inset focus:ring-primary/50 focus:bg-dark-700/50'

  // EDIT MODE
  return (
    <div className="p-4 md:p-6 lg:p-8">
      {saveError && (
        <div className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-400">{saveError}</div>
      )}

      {/* ============ STICKY HEADER (desktop) ============ */}
      <div className="hidden md:flex sticky top-0 z-20 bg-dark-900/95 backdrop-blur-sm -mx-6 lg:-mx-8 px-6 lg:px-8 py-3 mb-4 border-b border-dark-700 items-center justify-between gap-4">
        <div className="flex items-center gap-4 flex-1 min-w-0">
          <button onClick={() => { setMode('list'); fetchPlans() }} className="p-1.5 rounded-lg text-dark-400 hover:text-white hover:bg-dark-700 transition">
            <ArrowLeftIcon className="h-4 w-4" />
          </button>
          <select value={selectedClient} onChange={(e) => {
            handleClientChange(e.target.value)
            const c = clients.find(cl => cl.id === e.target.value)
            if (c) { const ws = new Date(); ws.setDate(ws.getDate() - ws.getDay() + 1); setPlanName(`${c.full_name} - Week of ${ws.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}`) }
          }} className="rounded-lg border border-dark-600 bg-dark-700 px-3 py-1.5 text-sm text-dark-100 focus:border-primary-500 focus:outline-none max-w-[200px]">
            <option value="">Select client...</option>
            {clients.map(c => <option key={c.id} value={c.id}>{c.full_name}</option>)}
          </select>
          {planName && <span className="text-xs text-dark-400 truncate">{planName}</span>}
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handleSave} disabled={saving}
            className="flex items-center gap-1.5 rounded-lg bg-primary px-4 py-1.5 text-sm font-semibold text-white hover:bg-primary-dark transition disabled:opacity-50">
            <span className="material-symbols-outlined text-[16px]">save</span>
            {saving ? 'Saving...' : 'Save'}
          </button>
          {publishMetcon && (
            <span className="text-[10px] font-bold text-primary bg-primary/10 px-2 py-1 rounded-full">📡 Publishing</span>
          )}
        </div>
      </div>

      {/* ============ MOBILE HEADER ============ */}
      <div className="md:hidden mb-4">
        <div className="flex items-center gap-3 mb-3">
          <button onClick={() => { setMode('list'); fetchPlans() }} className="p-2 rounded-lg text-dark-400 hover:text-white hover:bg-dark-700 transition">
            <ArrowLeftIcon className="h-4 w-4" />
          </button>
          <h1 className="text-lg font-bold text-dark-100">{planId ? 'Edit Plan' : 'New Plan'}</h1>
        </div>
        <select value={selectedClient} onChange={(e) => {
          handleClientChange(e.target.value)
          const c = clients.find(cl => cl.id === e.target.value)
          if (c) { const ws = new Date(); ws.setDate(ws.getDate() - ws.getDay() + 1); setPlanName(`${c.full_name} - Week of ${ws.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}`) }
        }} className="w-full rounded-lg border border-dark-600 bg-dark-700 px-3 py-2 text-sm text-dark-100 focus:border-primary-500 focus:outline-none mb-2">
          <option value="">Select client...</option>
          {clients.map(c => <option key={c.id} value={c.id}>{c.full_name}</option>)}
        </select>
        {planName && <p className="text-xs text-dark-400 mb-2"><span className="material-symbols-outlined text-[14px] align-middle mr-1">label</span>{planName}</p>}
        <textarea value={planDescription} onChange={(e) => setPlanDescription(e.target.value)} rows={1}
          className="w-full rounded-lg border border-dark-600 bg-dark-700 px-3 py-2 text-sm text-dark-100 placeholder-dark-500 focus:border-primary-500 focus:outline-none" placeholder="Description (optional)" />
      </div>

      {/* Description (desktop only - inline) */}
      <div className="hidden md:block mb-4">
        <input type="text" value={planDescription} onChange={(e) => setPlanDescription(e.target.value)}
          className="w-full rounded-lg border border-dark-600 bg-dark-800 px-3 py-1.5 text-sm text-dark-100 placeholder-dark-500 focus:border-primary-500 focus:outline-none" placeholder="Description (optional)" />
      </div>

      {/* Day tabs + Add Day */}
      <div className="flex items-center gap-2 mb-4 overflow-x-auto pb-1">
        {days.map((day, i) => (
          <button key={day._tempId}
            className="flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium border border-dark-600 bg-dark-800 text-dark-200 hover:border-primary/40 transition">
            {day.name || day.day_of_week || `Day ${i + 1}`}
          </button>
        ))}
        <button onClick={addDay} className="flex-shrink-0 flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium border border-dashed border-dark-500 text-dark-400 hover:border-primary/40 hover:text-primary transition">
          <PlusIcon className="h-3 w-3" /> Add Day
        </button>
      </div>

      {days.length === 0 ? (
        <div className="rounded-xl border border-dark-700 bg-dark-800 p-8 text-center">
          <p className="text-sm text-dark-400">No workout days yet. Click "+ Add Day" to start.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {days.map((day, dayIndex) => {
            const grouped = groupBySection(day.workout_exercises)
            const usedSections = new Set(day.workout_exercises.map(we => we.section))
            const availableSections = SECTIONS.filter(s => !usedSections.has(s.value))

            return (
              <div key={day._tempId} className="rounded-xl border border-dark-700 bg-dark-800 overflow-hidden">
                {/* Day Header */}
                <div className="flex items-center gap-3 px-4 py-3 border-b border-dark-700 bg-dark-800/80">
                  <div className="flex-1 flex items-center gap-3">
                    <input type="text" value={day.name} onChange={(e) => updateDay(day._tempId, 'name', e.target.value)}
                      className="bg-transparent border-none text-sm font-semibold text-dark-100 focus:outline-none focus:ring-0 w-28 placeholder-dark-500" placeholder={`Day ${dayIndex + 1}`} />
                    <select value={day.day_of_week ?? ''} onChange={(e) => updateDay(day._tempId, 'day_of_week', e.target.value || null)}
                      className="bg-transparent border border-dark-600 rounded px-2 py-1 text-xs text-dark-300 focus:border-primary-500 focus:outline-none">
                      <option value="">Day</option>
                      {DAYS_OF_WEEK.map(d => <option key={d.value} value={d.value}>{d.label.slice(0,3)}</option>)}
                    </select>
                  </div>
                  <button onClick={() => removeDay(day._tempId)} className="p-1 rounded text-dark-500 hover:text-red-400 hover:bg-red-500/10 transition" title="Delete day">
                    <TrashIcon className="h-4 w-4" />
                  </button>
                </div>

                {/* ============ DESKTOP SPREADSHEET (md+) ============ */}
                <div className="hidden md:block">
                  {grouped.map(({ section, meta, items }) => (
                    <div key={section}>
                      {/* Section header row */}
                      <div className={`flex items-center justify-between px-4 py-1.5 ${secBgColor(meta)} border-b border-dark-600/30`}>
                        <div className="flex items-center gap-2">
                          <div className={`w-1 h-4 rounded-full ${secTextColor(meta).replace('text-', 'bg-')}`} />
                          <span className={`text-[10px] font-black uppercase tracking-widest ${secTextColor(meta)}`}>{meta.label}</span>
                          <span className="text-[10px] text-dark-500">({items.length})</span>
                        </div>
                        <div className="flex items-center gap-1">
                          {section === 'metcon' && (
                            <button type="button" onClick={() => setPublishMetcon(!publishMetcon)}
                              className={`text-[9px] font-bold uppercase px-2 py-0.5 rounded-full transition ${publishMetcon ? 'bg-primary text-white' : 'bg-dark-600 text-dark-400'}`}>
                              {publishMetcon ? '📡 Live' : 'Publish'}
                            </button>
                          )}
                          <button onClick={() => removeSectionFromDay(day._tempId, section)}
                            className="p-0.5 text-dark-500 hover:text-red-400 transition"><XMarkIcon className="h-3 w-3" /></button>
                        </div>
                      </div>

                      {/* Spreadsheet table */}
                      <table className="w-full border-collapse">
                        <thead>
                          <tr className="border-b border-dark-600/30 bg-dark-800/50">
                            <th className="w-8 px-1 py-1"></th>
                            <th className="text-left px-2 py-1 text-[9px] font-bold text-dark-500 uppercase tracking-wider">Exercise</th>
                            <th className="w-16 px-2 py-1 text-[9px] font-bold text-dark-500 uppercase tracking-wider text-center">Sets</th>
                            <th className="w-20 px-2 py-1 text-[9px] font-bold text-dark-500 uppercase tracking-wider text-center">Reps</th>
                            <th className="w-16 px-2 py-1 text-[9px] font-bold text-dark-500 uppercase tracking-wider text-center">% PR</th>
                            <th className="w-20 px-2 py-1 text-[9px] font-bold text-dark-500 uppercase tracking-wider text-center">= kg</th>
                            <th className="px-2 py-1 text-[9px] font-bold text-dark-500 uppercase tracking-wider">Notes</th>
                          </tr>
                        </thead>
                        <tbody>
                          {items.map((we, exIdx) => {
                            const { isOther, isPrEligible, calculatedWeight, prValue } = getExInfo(we)
                            return (
                              <tr key={we._tempId} className={`border-b border-dark-700/30 hover:bg-dark-700/20 transition-colors group border-l-2 ${secBorderColor(meta)}`}>
                                <td className="px-1 py-0.5 text-center">
                                  <button onClick={() => removeExerciseFromDay(day._tempId, we._tempId)}
                                    className="opacity-0 group-hover:opacity-100 p-0.5 text-dark-500 hover:text-red-400 transition">
                                    <XMarkIcon className="h-3.5 w-3.5" />
                                  </button>
                                </td>
                                <td className="border-r border-dark-600/30 py-0.5">
                                  <select value={we.exercise_id} onChange={(e) => {
                                    updateExercise(day._tempId, we._tempId, 'exercise_id', e.target.value)
                                    if (e.target.value !== '__other__') updateExercise(day._tempId, we._tempId, 'custom_name', '')
                                  }} onKeyDown={(e) => handleSpreadsheetKeyDown(e, day._tempId, section, exIdx, items)}
                                    className={`${cellCls} w-full border-r-0`}>
                                    <ExerciseOptions />
                                  </select>
                                  {isOther && <input type="text" value={we.custom_name || ''} onChange={(e) => updateExercise(day._tempId, we._tempId, 'custom_name', e.target.value)}
                                    className="w-full px-2 py-0.5 text-xs text-dark-300 bg-transparent border-t border-dark-600/30 focus:outline-none" placeholder="Name..." />}
                                  {isPrEligible && prValue > 0 && <span className="px-2 text-[9px] text-primary-400">PR:{prValue}kg</span>}
                                </td>
                                <td className="border-r border-dark-600/30">
                                  <input type="number" min={1} value={we.sets} onChange={(e) => updateExercise(day._tempId, we._tempId, 'sets', e.target.value)}
                                    onKeyDown={(e) => handleSpreadsheetKeyDown(e, day._tempId, section, exIdx, items)}
                                    className={`${cellCls} w-full text-center border-r-0`} />
                                </td>
                                <td className="border-r border-dark-600/30">
                                  <input type="text" value={we.reps} onChange={(e) => updateExercise(day._tempId, we._tempId, 'reps', e.target.value)}
                                    onKeyDown={(e) => handleSpreadsheetKeyDown(e, day._tempId, section, exIdx, items)}
                                    className={`${cellCls} w-full text-center border-r-0`} placeholder="reps" />
                                </td>
                                <td className="border-r border-dark-600/30">
                                  {isOther ? (
                                    <div className="px-2 py-1 text-center text-dark-500 text-xs">—</div>
                                  ) : (
                                    <input type="number" min={1} max={100} value={we.percentage_of_pr || ''}
                                      onChange={(e) => updateExercise(day._tempId, we._tempId, 'percentage_of_pr', e.target.value)}
                                      onKeyDown={(e) => handleSpreadsheetKeyDown(e, day._tempId, section, exIdx, items)}
                                      className={`${cellCls} w-full text-center border-r-0 ${isPrEligible ? 'text-primary font-bold bg-primary/5' : ''}`} placeholder="%" />
                                  )}
                                </td>
                                <td className="border-r border-dark-600/30 px-2 py-1 text-center text-sm">
                                  {isPrEligible && calculatedWeight != null ? (
                                    <span className="font-bold text-primary">{calculatedWeight}</span>
                                  ) : (isPrEligible || (!isOther && we.percentage_of_pr)) && we.percentage_of_pr ? (
                                    <span className="text-[9px] text-amber-400 font-bold">No PR</span>
                                  ) : (
                                    <span className="text-dark-500">—</span>
                                  )}
                                </td>
                                <td>
                                  <input type="text" value={we.notes || ''} onChange={(e) => updateExercise(day._tempId, we._tempId, 'notes', e.target.value)}
                                    onKeyDown={(e) => handleSpreadsheetKeyDown(e, day._tempId, section, exIdx, items)}
                                    className={`${cellCls} w-full border-r-0`} placeholder={isOther ? 'Details...' : 'Notes'} />
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                        <tfoot>
                          <tr>
                            <td colSpan={7}>
                              <button onClick={() => addExerciseToDay(day._tempId, section)}
                                className="w-full py-2 text-xs font-medium text-dark-400 hover:text-primary border-t border-dashed border-dark-600/50 hover:border-primary/30 transition flex items-center justify-center gap-1">
                                <PlusIcon className="h-3 w-3" /> Add exercise
                              </button>
                            </td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  ))}

                  {/* Add Section footer (desktop) */}
                  {availableSections.length > 0 && (
                    <div className="px-4 py-2 border-t border-dark-700/50">
                      <select defaultValue="" onChange={(e) => { if (e.target.value) { addExerciseToDay(day._tempId, e.target.value); e.target.value = '' } }}
                        className="bg-transparent border border-dashed border-dark-500 rounded-lg px-3 py-1.5 text-xs text-dark-400 focus:border-primary/40 focus:outline-none cursor-pointer">
                        <option value="" disabled>+ Add section...</option>
                        {availableSections.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                      </select>
                    </div>
                  )}
                </div>

                {/* ============ MOBILE CARDS (<md) ============ */}
                <div className="md:hidden p-3 space-y-3">
                  {grouped.map(({ section, meta, items }) => (
                    <div key={section} className={`rounded-xl border ${secBorderColor(meta)} overflow-hidden`}>
                      <div className={`flex items-center justify-between px-3 py-2 ${secBgColor(meta)}`}>
                        <div className="flex items-center gap-2">
                          <span className={`text-xs font-bold uppercase tracking-wider ${secTextColor(meta)}`}>{meta.label}</span>
                          <span className="text-[10px] text-dark-400">({items.length})</span>
                        </div>
                        <div className="flex items-center gap-1">
                          {section === 'metcon' && (
                            <button type="button" onClick={() => setPublishMetcon(!publishMetcon)}
                              className={`text-[9px] font-bold uppercase px-2 py-0.5 rounded-full transition ${publishMetcon ? 'bg-primary text-white' : 'bg-dark-600 text-dark-400'}`}>
                              {publishMetcon ? '📡 Live' : 'Publish'}
                            </button>
                          )}
                          <button onClick={() => removeSectionFromDay(day._tempId, section)}
                            className="rounded p-1 text-dark-400 hover:text-red-400 hover:bg-red-500/10 transition">
                            <XMarkIcon className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                      <div className="p-2 space-y-2">
                        {items.map((we) => {
                          const { isOther, isPrEligible, calculatedWeight, prValue } = getExInfo(we)
                          return (
                            <div key={we._tempId} className="rounded-lg border border-dark-600/50 bg-dark-700/30 p-2.5 space-y-2">
                              <div className="flex items-start gap-2">
                                <div className="flex-1">
                                  <select value={we.exercise_id} onChange={(e) => {
                                    updateExercise(day._tempId, we._tempId, 'exercise_id', e.target.value)
                                    if (e.target.value !== '__other__') updateExercise(day._tempId, we._tempId, 'custom_name', '')
                                  }} className="w-full rounded-lg border border-dark-600 bg-dark-700 px-3 py-2 text-sm text-dark-100 focus:border-primary-500 focus:outline-none">
                                    <ExerciseOptions />
                                  </select>
                                  {isOther && <input type="text" value={we.custom_name || ''} onChange={(e) => updateExercise(day._tempId, we._tempId, 'custom_name', e.target.value)}
                                    className="mt-1 w-full rounded-lg border border-dark-600 bg-dark-700 px-3 py-1.5 text-sm text-dark-100 focus:border-primary-500 focus:outline-none" placeholder="Exercise name..." />}
                                  {isPrEligible && prValue > 0 && <p className="mt-0.5 text-[10px] text-primary-400 font-medium px-1">PR: {prValue}kg</p>}
                                </div>
                                <button onClick={() => removeExerciseFromDay(day._tempId, we._tempId)} className="mt-1 rounded-lg p-1 text-dark-400 hover:text-red-400 transition">
                                  <XMarkIcon className="h-4 w-4" />
                                </button>
                              </div>
                              <div className="grid grid-cols-4 gap-1.5">
                                <div>
                                  <label className="block text-[9px] text-dark-500 uppercase font-bold mb-0.5 px-0.5">Sets</label>
                                  <input type="number" min={1} value={we.sets} onChange={(e) => updateExercise(day._tempId, we._tempId, 'sets', e.target.value)}
                                    className="w-full rounded-lg border border-dark-600 bg-dark-700 px-1.5 py-1.5 text-sm text-center text-dark-100 focus:border-primary-500 focus:outline-none" />
                                </div>
                                <div>
                                  <label className="block text-[9px] text-dark-500 uppercase font-bold mb-0.5 px-0.5">Reps</label>
                                  <input type="text" value={we.reps} onChange={(e) => updateExercise(day._tempId, we._tempId, 'reps', e.target.value)}
                                    className="w-full rounded-lg border border-dark-600 bg-dark-700 px-1.5 py-1.5 text-sm text-center text-dark-100 focus:border-primary-500 focus:outline-none" placeholder="reps" />
                                </div>
                                <div>
                                  <label className="block text-[9px] text-dark-500 uppercase font-bold mb-0.5 px-0.5">% PR</label>
                                  {isOther ? (
                                    <div className="w-full rounded-lg bg-dark-700/30 px-1.5 py-1.5 text-sm text-center text-dark-500">—</div>
                                  ) : (
                                    <input type="number" min={1} max={100} value={we.percentage_of_pr || ''} onChange={(e) => updateExercise(day._tempId, we._tempId, 'percentage_of_pr', e.target.value)}
                                      className={`w-full rounded-lg border px-1.5 py-1.5 text-sm text-center font-bold focus:outline-none ${isPrEligible ? 'border-primary/40 bg-primary/10 text-primary focus:border-primary' : 'border-dark-600 bg-dark-700 text-dark-100 focus:border-primary-500'}`} placeholder="%" />
                                  )}
                                </div>
                                <div>
                                  <label className="block text-[9px] text-dark-500 uppercase font-bold mb-0.5 px-0.5">= kg</label>
                                  <div className="w-full rounded-lg bg-dark-700/30 border border-dark-600/50 px-1.5 py-1.5 text-sm text-center">
                                    {isPrEligible && calculatedWeight != null ? <span className="font-bold text-primary">{calculatedWeight}</span>
                                      : (isPrEligible || we.percentage_of_pr) && we.percentage_of_pr ? <span className="text-[8px] text-amber-400 font-bold">No PR</span>
                                      : <span className="text-dark-500">—</span>}
                                  </div>
                                </div>
                              </div>
                              {(isOther || !isPrEligible) && (
                                <input type="text" value={we.notes || ''} onChange={(e) => updateExercise(day._tempId, we._tempId, 'notes', e.target.value)}
                                  className="w-full rounded-lg border border-dark-600 bg-dark-700 px-2.5 py-1.5 text-sm text-dark-100 focus:border-primary-500 focus:outline-none"
                                  placeholder={isOther ? 'Description / weight / details...' : 'Notes'} />
                              )}
                            </div>
                          )
                        })}
                        <button onClick={() => addExerciseToDay(day._tempId, section)}
                          className="w-full py-2 rounded-lg border border-dashed border-dark-500 text-dark-400 text-xs font-medium hover:border-primary/40 hover:text-primary transition flex items-center justify-center gap-1">
                          <PlusIcon className="h-3 w-3" /> Add exercise
                        </button>
                      </div>
                    </div>
                  ))}
                  {availableSections.length > 0 && (
                    <select defaultValue="" onChange={(e) => { if (e.target.value) { addExerciseToDay(day._tempId, e.target.value); e.target.value = '' } }}
                      className="w-full rounded-xl border-2 border-dashed border-dark-500 bg-transparent px-3 py-2.5 text-sm text-dark-400 focus:border-primary/40 focus:outline-none cursor-pointer">
                      <option value="" disabled>+ Add section...</option>
                      {availableSections.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                    </select>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Mobile Save Button */}
      <div className="md:hidden mt-6 flex gap-3">
        <button onClick={() => { setMode('list'); fetchPlans() }} className="flex-1 rounded-lg border border-dark-600 px-4 py-3 text-sm text-dark-300 transition-colors hover:bg-dark-700">Cancel</button>
        <button onClick={handleSave} disabled={saving} className="flex-1 flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-3 text-sm font-semibold text-white transition hover:bg-primary-dark disabled:opacity-50">
          <CheckCircleIcon className="h-4 w-4" />{saving ? 'Saving...' : 'Save Plan'}
        </button>
      </div>
    </div>
  )
}
