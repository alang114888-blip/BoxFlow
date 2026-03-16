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

const MEAL_TYPES = ['breakfast', 'lunch', 'dinner', 'snack']

function mealTypeLabel(type) {
  return type.charAt(0).toUpperCase() + type.slice(1)
}

function sumMacros(items) {
  return items.reduce(
    (acc, item) => ({
      calories: acc.calories + (parseFloat(item.calories) || 0),
      protein_g: acc.protein_g + (parseFloat(item.protein_g) || 0),
      carbs_g: acc.carbs_g + (parseFloat(item.carbs_g) || 0),
      fat_g: acc.fat_g + (parseFloat(item.fat_g) || 0),
    }),
    { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0 }
  )
}

export default function NutritionPlanBuilder() {
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
  const [days, setDays] = useState([])
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState(null)

  useEffect(() => {
    if (!profile) return
    fetchPlans()
  }, [profile])

  async function fetchPlans() {
    try {
      setLoading(true)
      setError(null)

      const { data, error: fetchErr } = await supabase
        .from('nutrition_plans')
        .select(`
          id,
          name,
          description,
          is_active,
          client_id,
          profiles!nutrition_plans_client_id_fkey ( full_name )
        `)
        .eq('trainer_id', profile.id)
        .order('is_active', { ascending: false })

      if (fetchErr) throw fetchErr
      setPlans(data || [])
    } catch (err) {
      console.error('Fetch nutrition plans error:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  async function fetchEditData(existingPlanId) {
    try {
      setLoading(true)

      const { data: clientsData } = await supabase
        .from('trainer_clients')
        .select('client_id, profiles!trainer_clients_client_id_fkey ( id, full_name )')
        .eq('trainer_id', profile.id)
        .eq('invite_accepted', true)

      setClients(
        (clientsData || []).map((tc) => ({
          id: tc.client_id,
          full_name: tc.profiles?.full_name || 'Unknown',
        }))
      )

      if (existingPlanId) {
        const { data: planData } = await supabase
          .from('nutrition_plans')
          .select('*')
          .eq('id', existingPlanId)
          .single()

        if (planData) {
          setPlanName(planData.name)
          setPlanDescription(planData.description || '')
          setSelectedClient(planData.client_id || '')

          const { data: daysData } = await supabase
            .from('nutrition_days')
            .select(`
              id,
              day_of_week,
              day_number,
              name,
              meals (
                id,
                meal_type,
                name,
                order_index,
                meal_items (
                  id,
                  food_name,
                  quantity,
                  calories,
                  protein_g,
                  carbs_g,
                  fat_g,
                  notes
                )
              )
            `)
            .eq('plan_id', existingPlanId)
            .order('day_number')

          setDays(
            (daysData || []).map((d) => ({
              ...d,
              _tempId: crypto.randomUUID(),
              meals: (d.meals || [])
                .sort((a, b) => a.order_index - b.order_index)
                .map((m) => ({
                  ...m,
                  _tempId: crypto.randomUUID(),
                  meal_items: (m.meal_items || []).map((mi) => ({
                    ...mi,
                    _tempId: crypto.randomUUID(),
                  })),
                })),
            }))
          )
        }
      }
    } catch (err) {
      console.error('Fetch edit data error:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
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

  // Day operations
  function addDay() {
    setDays((prev) => [
      ...prev,
      {
        _tempId: crypto.randomUUID(),
        day_of_week: null,
        day_number: prev.length + 1,
        name: '',
        meals: [],
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

  // Meal operations
  function addMeal(dayTempId, mealType) {
    setDays((prev) =>
      prev.map((d) => {
        if (d._tempId !== dayTempId) return d
        return {
          ...d,
          meals: [
            ...d.meals,
            {
              _tempId: crypto.randomUUID(),
              meal_type: mealType,
              name: mealTypeLabel(mealType),
              order_index: d.meals.length,
              meal_items: [],
            },
          ],
        }
      })
    )
  }

  function removeMeal(dayTempId, mealTempId) {
    setDays((prev) =>
      prev.map((d) => {
        if (d._tempId !== dayTempId) return d
        return {
          ...d,
          meals: d.meals.filter((m) => m._tempId !== mealTempId),
        }
      })
    )
  }

  function updateMeal(dayTempId, mealTempId, field, value) {
    setDays((prev) =>
      prev.map((d) => {
        if (d._tempId !== dayTempId) return d
        return {
          ...d,
          meals: d.meals.map((m) =>
            m._tempId === mealTempId ? { ...m, [field]: value } : m
          ),
        }
      })
    )
  }

  // Meal item operations
  function addMealItem(dayTempId, mealTempId) {
    setDays((prev) =>
      prev.map((d) => {
        if (d._tempId !== dayTempId) return d
        return {
          ...d,
          meals: d.meals.map((m) => {
            if (m._tempId !== mealTempId) return m
            return {
              ...m,
              meal_items: [
                ...m.meal_items,
                {
                  _tempId: crypto.randomUUID(),
                  food_name: '',
                  quantity: '',
                  calories: 0,
                  protein_g: 0,
                  carbs_g: 0,
                  fat_g: 0,
                  notes: '',
                },
              ],
            }
          }),
        }
      })
    )
  }

  function removeMealItem(dayTempId, mealTempId, itemTempId) {
    setDays((prev) =>
      prev.map((d) => {
        if (d._tempId !== dayTempId) return d
        return {
          ...d,
          meals: d.meals.map((m) => {
            if (m._tempId !== mealTempId) return m
            return {
              ...m,
              meal_items: m.meal_items.filter((mi) => mi._tempId !== itemTempId),
            }
          }),
        }
      })
    )
  }

  function updateMealItem(dayTempId, mealTempId, itemTempId, field, value) {
    setDays((prev) =>
      prev.map((d) => {
        if (d._tempId !== dayTempId) return d
        return {
          ...d,
          meals: d.meals.map((m) => {
            if (m._tempId !== mealTempId) return m
            return {
              ...m,
              meal_items: m.meal_items.map((mi) =>
                mi._tempId === itemTempId ? { ...mi, [field]: value } : mi
              ),
            }
          }),
        }
      })
    )
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
        const { error: upErr } = await supabase
          .from('nutrition_plans')
          .update({
            name: planName.trim(),
            description: planDescription.trim() || null,
            client_id: selectedClient || null,
          })
          .eq('id', savedPlanId)

        if (upErr) throw upErr

        // Delete existing days (cascade should handle meals and meal_items)
        await supabase.from('nutrition_days').delete().eq('plan_id', savedPlanId)
      } else {
        const { data: newPlan, error: insErr } = await supabase
          .from('nutrition_plans')
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

      // Insert days, meals, meal_items
      for (let i = 0; i < days.length; i++) {
        const day = days[i]
        const { data: newDay, error: dayErr } = await supabase
          .from('nutrition_days')
          .insert({
            plan_id: savedPlanId,
            day_of_week: day.day_of_week || null,
            day_number: day.day_number || i + 1,
            name: day.name || `Day ${i + 1}`,
          })
          .select()
          .single()

        if (dayErr) throw dayErr

        for (let j = 0; j < day.meals.length; j++) {
          const meal = day.meals[j]
          const { data: newMeal, error: mealErr } = await supabase
            .from('meals')
            .insert({
              nutrition_day_id: newDay.id,
              meal_type: meal.meal_type,
              name: meal.name || mealTypeLabel(meal.meal_type),
              order_index: j,
            })
            .select()
            .single()

          if (mealErr) throw mealErr

          const itemsToInsert = meal.meal_items
            .filter((mi) => mi.food_name?.trim())
            .map((mi) => ({
              meal_id: newMeal.id,
              food_name: mi.food_name.trim(),
              quantity: mi.quantity?.trim() || null,
              calories: parseFloat(mi.calories) || 0,
              protein_g: parseFloat(mi.protein_g) || 0,
              carbs_g: parseFloat(mi.carbs_g) || 0,
              fat_g: parseFloat(mi.fat_g) || 0,
              notes: mi.notes?.trim() || null,
            }))

          if (itemsToInsert.length > 0) {
            const { error: itemErr } = await supabase
              .from('meal_items')
              .insert(itemsToInsert)
            if (itemErr) throw itemErr
          }
        }
      }

      setMode('list')
      fetchPlans()
    } catch (err) {
      console.error('Save nutrition plan error:', err)
      setSaveError(err.message)
    } finally {
      setSaving(false)
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
          <h1 className="text-2xl font-bold text-dark-100">Nutrition Plans</h1>
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
              No nutrition plans yet. Create your first plan to get started.
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
          {planId ? 'Edit Nutrition Plan' : 'Create Nutrition Plan'}
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
              placeholder="e.g. Cutting Phase Meal Plan"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm text-dark-300">Client</label>
            <select
              value={selectedClient}
              onChange={(e) => setSelectedClient(e.target.value)}
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

      {/* Days */}
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-dark-100">Meal Days</h2>
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
            No days added yet. Click "Add Day" to start building.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {days.map((day, dayIndex) => {
            // Calculate day totals
            const allDayItems = day.meals.flatMap((m) => m.meal_items)
            const dayTotals = sumMacros(allDayItems)

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
                        Day #
                      </label>
                      <input
                        type="number"
                        min={1}
                        value={day.day_number || ''}
                        onChange={(e) =>
                          updateDay(
                            day._tempId,
                            'day_number',
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

                {/* Day Totals */}
                <div className="mb-4 flex flex-wrap gap-4 rounded-lg bg-dark-700/50 px-3 py-2">
                  <span className="text-xs text-dark-400">
                    Day Totals:
                  </span>
                  <span className="text-xs font-medium text-dark-200">
                    {Math.round(dayTotals.calories)} cal
                  </span>
                  <span className="text-xs text-blue-400">
                    P: {Math.round(dayTotals.protein_g)}g
                  </span>
                  <span className="text-xs text-yellow-400">
                    C: {Math.round(dayTotals.carbs_g)}g
                  </span>
                  <span className="text-xs text-red-400">
                    F: {Math.round(dayTotals.fat_g)}g
                  </span>
                </div>

                {/* Meals */}
                <div className="space-y-4">
                  {day.meals.map((meal) => {
                    const mealTotals = sumMacros(meal.meal_items)

                    return (
                      <div
                        key={meal._tempId}
                        className="rounded-lg border border-dark-600 bg-dark-700/30 p-3"
                      >
                        <div className="mb-2 flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <input
                              type="text"
                              value={meal.name}
                              onChange={(e) =>
                                updateMeal(
                                  day._tempId,
                                  meal._tempId,
                                  'name',
                                  e.target.value
                                )
                              }
                              className="rounded border border-dark-600 bg-dark-700 px-2 py-1 text-sm font-medium text-dark-100 focus:border-primary-500 focus:outline-none"
                            />
                            <span className="rounded-full bg-dark-600 px-2 py-0.5 text-xs text-dark-300">
                              {mealTypeLabel(meal.meal_type)}
                            </span>
                            {/* Meal Totals */}
                            <span className="text-xs text-dark-400">
                              {Math.round(mealTotals.calories)} cal | P:{' '}
                              {Math.round(mealTotals.protein_g)}g | C:{' '}
                              {Math.round(mealTotals.carbs_g)}g | F:{' '}
                              {Math.round(mealTotals.fat_g)}g
                            </span>
                          </div>
                          <button
                            onClick={() =>
                              removeMeal(day._tempId, meal._tempId)
                            }
                            className="rounded p-1 text-dark-400 hover:text-red-400"
                          >
                            <XMarkIcon className="h-4 w-4" />
                          </button>
                        </div>

                        {/* Food Items */}
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="border-b border-dark-600 text-left text-xs text-dark-400">
                                <th className="pb-1.5 pr-2">Food</th>
                                <th className="pb-1.5 pr-2 w-20">Qty</th>
                                <th className="pb-1.5 pr-2 w-16">Cal</th>
                                <th className="pb-1.5 pr-2 w-16">Protein</th>
                                <th className="pb-1.5 pr-2 w-16">Carbs</th>
                                <th className="pb-1.5 pr-2 w-16">Fat</th>
                                <th className="pb-1.5 pr-2">Notes</th>
                                <th className="pb-1.5 w-8"></th>
                              </tr>
                            </thead>
                            <tbody>
                              {meal.meal_items.map((item) => (
                                <tr
                                  key={item._tempId}
                                  className="border-b border-dark-700/30"
                                >
                                  <td className="py-1.5 pr-2">
                                    <input
                                      type="text"
                                      value={item.food_name}
                                      onChange={(e) =>
                                        updateMealItem(
                                          day._tempId,
                                          meal._tempId,
                                          item._tempId,
                                          'food_name',
                                          e.target.value
                                        )
                                      }
                                      className="w-full min-w-[120px] rounded border border-dark-600 bg-dark-700 px-2 py-1 text-sm text-dark-100 focus:border-primary-500 focus:outline-none"
                                      placeholder="Food name"
                                    />
                                  </td>
                                  <td className="py-1.5 pr-2">
                                    <input
                                      type="text"
                                      value={item.quantity}
                                      onChange={(e) =>
                                        updateMealItem(
                                          day._tempId,
                                          meal._tempId,
                                          item._tempId,
                                          'quantity',
                                          e.target.value
                                        )
                                      }
                                      className="w-full rounded border border-dark-600 bg-dark-700 px-2 py-1 text-sm text-dark-100 focus:border-primary-500 focus:outline-none"
                                      placeholder="200g"
                                    />
                                  </td>
                                  <td className="py-1.5 pr-2">
                                    <input
                                      type="number"
                                      min={0}
                                      value={item.calories}
                                      onChange={(e) =>
                                        updateMealItem(
                                          day._tempId,
                                          meal._tempId,
                                          item._tempId,
                                          'calories',
                                          e.target.value
                                        )
                                      }
                                      className="w-full rounded border border-dark-600 bg-dark-700 px-2 py-1 text-sm text-dark-100 focus:border-primary-500 focus:outline-none"
                                    />
                                  </td>
                                  <td className="py-1.5 pr-2">
                                    <input
                                      type="number"
                                      min={0}
                                      step="0.1"
                                      value={item.protein_g}
                                      onChange={(e) =>
                                        updateMealItem(
                                          day._tempId,
                                          meal._tempId,
                                          item._tempId,
                                          'protein_g',
                                          e.target.value
                                        )
                                      }
                                      className="w-full rounded border border-dark-600 bg-dark-700 px-2 py-1 text-sm text-dark-100 focus:border-primary-500 focus:outline-none"
                                    />
                                  </td>
                                  <td className="py-1.5 pr-2">
                                    <input
                                      type="number"
                                      min={0}
                                      step="0.1"
                                      value={item.carbs_g}
                                      onChange={(e) =>
                                        updateMealItem(
                                          day._tempId,
                                          meal._tempId,
                                          item._tempId,
                                          'carbs_g',
                                          e.target.value
                                        )
                                      }
                                      className="w-full rounded border border-dark-600 bg-dark-700 px-2 py-1 text-sm text-dark-100 focus:border-primary-500 focus:outline-none"
                                    />
                                  </td>
                                  <td className="py-1.5 pr-2">
                                    <input
                                      type="number"
                                      min={0}
                                      step="0.1"
                                      value={item.fat_g}
                                      onChange={(e) =>
                                        updateMealItem(
                                          day._tempId,
                                          meal._tempId,
                                          item._tempId,
                                          'fat_g',
                                          e.target.value
                                        )
                                      }
                                      className="w-full rounded border border-dark-600 bg-dark-700 px-2 py-1 text-sm text-dark-100 focus:border-primary-500 focus:outline-none"
                                    />
                                  </td>
                                  <td className="py-1.5 pr-2">
                                    <input
                                      type="text"
                                      value={item.notes || ''}
                                      onChange={(e) =>
                                        updateMealItem(
                                          day._tempId,
                                          meal._tempId,
                                          item._tempId,
                                          'notes',
                                          e.target.value
                                        )
                                      }
                                      className="w-full min-w-[80px] rounded border border-dark-600 bg-dark-700 px-2 py-1 text-sm text-dark-100 focus:border-primary-500 focus:outline-none"
                                      placeholder="Notes"
                                    />
                                  </td>
                                  <td className="py-1.5">
                                    <button
                                      onClick={() =>
                                        removeMealItem(
                                          day._tempId,
                                          meal._tempId,
                                          item._tempId
                                        )
                                      }
                                      className="rounded p-1 text-dark-400 hover:text-red-400"
                                    >
                                      <XMarkIcon className="h-4 w-4" />
                                    </button>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>

                        <button
                          onClick={() =>
                            addMealItem(day._tempId, meal._tempId)
                          }
                          className="mt-2 flex items-center gap-1 text-xs text-primary-400 hover:text-primary-300"
                        >
                          <PlusIcon className="h-3 w-3" />
                          Add Food Item
                        </button>
                      </div>
                    )
                  })}
                </div>

                {/* Add Meal Buttons */}
                <div className="mt-3 flex flex-wrap gap-2">
                  {MEAL_TYPES.map((type) => (
                    <button
                      key={type}
                      onClick={() => addMeal(day._tempId, type)}
                      className="flex items-center gap-1 rounded border border-dark-600 px-2 py-1 text-xs text-dark-300 transition-colors hover:bg-dark-700"
                    >
                      <PlusIcon className="h-3 w-3" />
                      {mealTypeLabel(type)}
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
