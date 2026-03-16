import { useState, useEffect } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { supabase } from '../../lib/supabase'
import {
  FireIcon,
  BeakerIcon,
} from '@heroicons/react/24/outline'

const MEAL_TYPE_ORDER = ['Breakfast', 'Morning Snack', 'Lunch', 'Afternoon Snack', 'Dinner', 'Evening Snack', 'Snack']

function sortMeals(meals) {
  return [...meals].sort((a, b) => {
    const ai = MEAL_TYPE_ORDER.indexOf(a.meal_type)
    const bi = MEAL_TYPE_ORDER.indexOf(b.meal_type)
    const aOrder = ai >= 0 ? ai : 99
    const bOrder = bi >= 0 ? bi : 99
    if (aOrder !== bOrder) return aOrder - bOrder
    return (a.order_index || 0) - (b.order_index || 0)
  })
}

export default function MyNutrition() {
  const { profile } = useAuth()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [plan, setPlan] = useState(null)
  const [days, setDays] = useState([])
  const [selectedDayId, setSelectedDayId] = useState(null)

  useEffect(() => {
    if (profile?.id) {
      fetchNutrition()
    }
  }, [profile?.id])

  async function fetchNutrition() {
    try {
      setLoading(true)
      setError(null)

      const { data, error: fetchErr } = await supabase
        .from('nutrition_plans')
        .select(`
          id, name, description,
          nutrition_days (
            id, day_of_week, day_number, name,
            meals (
              id, meal_type, name, order_index,
              meal_items (
                id, food_name, quantity, calories, protein_g, carbs_g, fat_g
              )
            )
          )
        `)
        .eq('client_id', profile.id)
        .eq('is_active', true)
        .limit(1)
        .single()

      if (fetchErr && fetchErr.code !== 'PGRST116') throw fetchErr

      if (data) {
        setPlan(data)
        const sorted = [...(data.nutrition_days || [])].sort(
          (a, b) => (a.day_number || 0) - (b.day_number || 0)
        )
        setDays(sorted)
        if (sorted.length > 0) {
          setSelectedDayId(sorted[0].id)
        }
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const selectedDay = days.find((d) => d.id === selectedDayId)
  const meals = selectedDay?.meals ? sortMeals(selectedDay.meals) : []

  // Daily totals
  const dailyTotals = meals.reduce(
    (acc, meal) => {
      (meal.meal_items || []).forEach((item) => {
        acc.calories += item.calories || 0
        acc.protein += item.protein_g || 0
        acc.carbs += item.carbs_g || 0
        acc.fat += item.fat_g || 0
      })
      return acc
    },
    { calories: 0, protein: 0, carbs: 0, fat: 0 }
  )

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
          Failed to load nutrition plan: {error}
        </div>
      </div>
    )
  }

  if (!plan) {
    return (
      <div className="mx-auto max-w-4xl p-6">
        <h1 className="mb-4 text-2xl font-bold text-dark-100">My Nutrition</h1>
        <div className="rounded-lg border border-dark-700 bg-dark-800 p-8 text-center">
          <BeakerIcon className="mx-auto mb-3 h-12 w-12 text-dark-500" />
          <p className="text-dark-400">No active nutrition plan assigned yet.</p>
          <p className="mt-1 text-sm text-dark-500">Your trainer will assign one soon.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-dark-100">My Nutrition</h1>
        <p className="mt-1 text-dark-400">{plan.name}</p>
        {plan.description && <p className="text-sm text-dark-500">{plan.description}</p>}
      </div>

      {/* Day Tabs */}
      {days.length > 1 && (
        <div className="flex flex-wrap gap-2">
          {days.map((day) => (
            <button
              key={day.id}
              onClick={() => setSelectedDayId(day.id)}
              className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                selectedDayId === day.id
                  ? 'bg-primary-600 text-white'
                  : 'bg-dark-700 text-dark-300 hover:bg-dark-600 hover:text-dark-200'
              }`}
            >
              {day.name || day.day_of_week || `Day ${day.day_number}`}
            </button>
          ))}
        </div>
      )}

      {/* Daily Totals */}
      {selectedDay && meals.length > 0 && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <MacroCard label="Calories" value={Math.round(dailyTotals.calories)} unit="kcal" />
          <MacroCard label="Protein" value={Math.round(dailyTotals.protein)} unit="g" />
          <MacroCard label="Carbs" value={Math.round(dailyTotals.carbs)} unit="g" />
          <MacroCard label="Fat" value={Math.round(dailyTotals.fat)} unit="g" />
        </div>
      )}

      {/* Meals */}
      {selectedDay && (
        <div className="space-y-4">
          {meals.length > 0 ? (
            meals.map((meal) => {
              const mealTotals = (meal.meal_items || []).reduce(
                (acc, item) => ({
                  calories: acc.calories + (item.calories || 0),
                  protein: acc.protein + (item.protein_g || 0),
                  carbs: acc.carbs + (item.carbs_g || 0),
                  fat: acc.fat + (item.fat_g || 0),
                }),
                { calories: 0, protein: 0, carbs: 0, fat: 0 }
              )

              return (
                <div
                  key={meal.id}
                  className="rounded-lg border border-dark-700 bg-dark-800"
                >
                  <div className="flex items-center justify-between border-b border-dark-700 px-5 py-3">
                    <div className="flex items-center gap-2">
                      <FireIcon className="h-5 w-5 text-primary-500" />
                      <h3 className="font-semibold text-dark-100">
                        {meal.name || meal.meal_type}
                      </h3>
                      {meal.name && meal.meal_type && meal.name !== meal.meal_type && (
                        <span className="text-xs text-dark-500">({meal.meal_type})</span>
                      )}
                    </div>
                    <span className="text-sm text-dark-400">
                      {Math.round(mealTotals.calories)} kcal
                    </span>
                  </div>

                  {(meal.meal_items || []).length > 0 ? (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-sm">
                        <thead>
                          <tr className="border-b border-dark-700 text-dark-400">
                            <th className="px-5 py-2 font-medium">Food</th>
                            <th className="px-5 py-2 font-medium">Qty</th>
                            <th className="px-5 py-2 font-medium">Calories</th>
                            <th className="px-5 py-2 font-medium">Protein</th>
                            <th className="px-5 py-2 font-medium">Carbs</th>
                            <th className="px-5 py-2 font-medium">Fat</th>
                          </tr>
                        </thead>
                        <tbody>
                          {meal.meal_items.map((item) => (
                            <tr
                              key={item.id}
                              className="border-b border-dark-700/50 last:border-0"
                            >
                              <td className="px-5 py-2.5 font-medium text-dark-200">
                                {item.food_name}
                              </td>
                              <td className="px-5 py-2.5 text-dark-300">{item.quantity}</td>
                              <td className="px-5 py-2.5 text-dark-300">
                                {item.calories != null ? Math.round(item.calories) : '-'}
                              </td>
                              <td className="px-5 py-2.5 text-dark-300">
                                {item.protein_g != null ? `${Math.round(item.protein_g)}g` : '-'}
                              </td>
                              <td className="px-5 py-2.5 text-dark-300">
                                {item.carbs_g != null ? `${Math.round(item.carbs_g)}g` : '-'}
                              </td>
                              <td className="px-5 py-2.5 text-dark-300">
                                {item.fat_g != null ? `${Math.round(item.fat_g)}g` : '-'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot>
                          <tr className="border-t border-dark-600 font-medium text-dark-200">
                            <td className="px-5 py-2.5" colSpan={2}>
                              Meal Total
                            </td>
                            <td className="px-5 py-2.5">{Math.round(mealTotals.calories)}</td>
                            <td className="px-5 py-2.5">{Math.round(mealTotals.protein)}g</td>
                            <td className="px-5 py-2.5">{Math.round(mealTotals.carbs)}g</td>
                            <td className="px-5 py-2.5">{Math.round(mealTotals.fat)}g</td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  ) : (
                    <div className="p-5 text-center text-dark-400">
                      No food items listed for this meal.
                    </div>
                  )}
                </div>
              )
            })
          ) : (
            <div className="rounded-lg border border-dark-700 bg-dark-800 p-8 text-center text-dark-400">
              No meals listed for this day.
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function MacroCard({ label, value, unit }) {
  return (
    <div className="rounded-lg border border-dark-700 bg-dark-800 p-4 text-center">
      <p className="text-2xl font-bold text-dark-100">
        {value}
        <span className="ml-1 text-sm font-normal text-dark-500">{unit}</span>
      </p>
      <p className="mt-1 text-sm text-dark-400">{label}</p>
    </div>
  )
}
