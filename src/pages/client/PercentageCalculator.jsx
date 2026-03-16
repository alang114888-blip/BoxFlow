import { useState, useEffect, useMemo } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { supabase } from '../../lib/supabase'
import { CalculatorIcon } from '@heroicons/react/24/outline'

const QUICK_PERCENTAGES = [50, 60, 70, 75, 80, 85, 90, 95, 100]
const TABLE_PERCENTAGES = [50, 55, 60, 65, 70, 75, 80, 85, 90, 95, 100]

export default function PercentageCalculator() {
  const { profile } = useAuth()
  const [weight, setWeight] = useState('')
  const [percentage, setPercentage] = useState('')
  const [prExercises, setPrExercises] = useState([])
  const [selectedExerciseId, setSelectedExerciseId] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (profile?.id) {
      fetchPRs()
    }
  }, [profile?.id])

  async function fetchPRs() {
    try {
      setLoading(true)

      const { data } = await supabase
        .from('client_prs')
        .select(`
          exercise_id, weight_kg,
          exercises ( id, name, category )
        `)
        .eq('client_id', profile.id)

      setPrExercises(
        (data || [])
          .filter((pr) => pr.exercises)
          .map((pr) => ({
            id: pr.exercise_id,
            name: pr.exercises.name,
            category: pr.exercises.category,
            weight_kg: pr.weight_kg,
          }))
          .sort((a, b) => a.name.localeCompare(b.name))
      )
    } catch {
      // Non-critical — calculator still works without PRs
    } finally {
      setLoading(false)
    }
  }

  function handleSelectExercise(exerciseId) {
    setSelectedExerciseId(exerciseId)
    if (exerciseId) {
      const ex = prExercises.find((e) => e.id === exerciseId)
      if (ex) {
        setWeight(String(ex.weight_kg))
      }
    }
  }

  const weightNum = parseFloat(weight) || 0
  const percentageNum = parseFloat(percentage) || 0
  const calculatedWeight = weightNum && percentageNum
    ? Math.round((weightNum * percentageNum) / 100 * 10) / 10
    : null

  const percentageTable = useMemo(() => {
    if (!weightNum) return []
    return TABLE_PERCENTAGES.map((pct) => ({
      percentage: pct,
      weight: Math.round((weightNum * pct) / 100 * 10) / 10,
    }))
  }, [weightNum])

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-dark-600 border-t-primary-500" />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-dark-100">Percentage Calculator</h1>
        <p className="mt-1 text-dark-400">
          Calculate training weights from your PRs or any weight
        </p>
      </div>

      {/* Calculator Card */}
      <div className="rounded-lg border border-dark-700 bg-dark-800 p-5 space-y-5">
        {/* PR Exercise Selector */}
        {prExercises.length > 0 && (
          <div>
            <label className="mb-1 block text-sm font-medium text-dark-300">
              Select a PR exercise (optional)
            </label>
            <select
              value={selectedExerciseId}
              onChange={(e) => handleSelectExercise(e.target.value)}
              className="w-full rounded-lg border border-dark-600 bg-dark-900 px-3 py-2.5 text-sm text-dark-200 focus:border-primary-500 focus:outline-none"
            >
              <option value="">-- Manual entry --</option>
              {prExercises.map((ex) => (
                <option key={ex.id} value={ex.id}>
                  {ex.name} ({ex.weight_kg} kg)
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Weight Input */}
        <div>
          <label className="mb-1 block text-sm font-medium text-dark-300">
            Weight (kg)
          </label>
          <input
            type="number"
            step="0.5"
            min="0"
            value={weight}
            onChange={(e) => {
              setWeight(e.target.value)
              setSelectedExerciseId('')
            }}
            placeholder="Enter weight in kg"
            className="w-full rounded-lg border border-dark-600 bg-dark-900 px-3 py-2.5 text-sm text-dark-200 placeholder-dark-500 focus:border-primary-500 focus:outline-none"
          />
        </div>

        {/* Percentage Input */}
        <div>
          <label className="mb-1 block text-sm font-medium text-dark-300">
            Percentage (%)
          </label>
          <input
            type="number"
            step="1"
            min="0"
            max="200"
            value={percentage}
            onChange={(e) => setPercentage(e.target.value)}
            placeholder="Enter percentage"
            className="w-full rounded-lg border border-dark-600 bg-dark-900 px-3 py-2.5 text-sm text-dark-200 placeholder-dark-500 focus:border-primary-500 focus:outline-none"
          />
        </div>

        {/* Quick Percentage Buttons */}
        <div>
          <label className="mb-2 block text-xs font-medium text-dark-400">
            Quick percentages
          </label>
          <div className="flex flex-wrap gap-2">
            {QUICK_PERCENTAGES.map((pct) => (
              <button
                key={pct}
                onClick={() => setPercentage(String(pct))}
                className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                  String(pct) === percentage
                    ? 'bg-primary-600 text-white'
                    : 'bg-dark-700 text-dark-300 hover:bg-dark-600 hover:text-dark-200'
                }`}
              >
                {pct}%
              </button>
            ))}
          </div>
        </div>

        {/* Result */}
        <div className="rounded-lg border border-dark-600 bg-dark-900 p-5 text-center">
          <p className="mb-1 text-sm text-dark-400">Calculated Weight</p>
          <div className="flex items-baseline justify-center gap-1">
            <span className="text-4xl font-bold text-primary-400">
              {calculatedWeight != null ? calculatedWeight : '--'}
            </span>
            <span className="text-lg text-dark-500">kg</span>
          </div>
          {weightNum > 0 && percentageNum > 0 && (
            <p className="mt-2 text-xs text-dark-500">
              {percentageNum}% of {weightNum} kg = {calculatedWeight} kg
            </p>
          )}
        </div>
      </div>

      {/* Percentage Table */}
      {weightNum > 0 && (
        <div className="rounded-lg border border-dark-700 bg-dark-800">
          <div className="flex items-center gap-2 border-b border-dark-700 px-5 py-3">
            <CalculatorIcon className="h-5 w-5 text-primary-500" />
            <h2 className="font-semibold text-dark-100">
              Common Percentages for {weightNum} kg
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-dark-700 text-dark-400">
                  <th className="px-5 py-3 font-medium">Percentage</th>
                  <th className="px-5 py-3 font-medium">Weight (kg)</th>
                </tr>
              </thead>
              <tbody>
                {percentageTable.map((row) => (
                  <tr
                    key={row.percentage}
                    className={`border-b border-dark-700/50 last:border-0 ${
                      String(row.percentage) === percentage
                        ? 'bg-primary-500/10'
                        : ''
                    }`}
                  >
                    <td className="px-5 py-2.5 text-dark-300">{row.percentage}%</td>
                    <td className="px-5 py-2.5 font-medium text-primary-400">
                      {row.weight} kg
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
