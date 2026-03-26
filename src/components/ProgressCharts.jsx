import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  Legend,
} from 'recharts'

const TABS = [
  { key: 'weight', label: 'Weight', icon: 'monitor_weight' },
  { key: 'prs', label: 'PRs', icon: 'trophy' },
  { key: 'completion', label: 'Completion', icon: 'task_alt' },
  { key: 'wellness', label: 'Wellness', icon: 'favorite' },
]

const PR_COLORS = ['#7c3bed', '#3b82f6', '#10b981', '#f59e0b', '#ef4444']

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-lg bg-[#1a1225] border border-primary/20 p-3 shadow-xl">
      <p className="text-[10px] text-slate-400 mb-1">{label}</p>
      {payload.map((p, i) => (
        <p key={i} className="text-sm font-bold" style={{ color: p.color }}>
          {p.name}: {p.value}
        </p>
      ))}
    </div>
  )
}

function formatWeekDate(dateStr) {
  const d = new Date(dateStr)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export default function ProgressCharts({ clientId, isTrainerView = false }) {
  const { profile } = useAuth()
  const [activeTab, setActiveTab] = useState('weight')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const [weightData, setWeightData] = useState([])
  const [prData, setPrData] = useState([])
  const [prExerciseNames, setPrExerciseNames] = useState([])
  const [completionData, setCompletionData] = useState([])
  const [wellnessData, setWellnessData] = useState([])

  const resolvedClientId = clientId || profile?.id

  const fetchData = useCallback(async () => {
    if (!resolvedClientId) return

    try {
      setLoading(true)
      setError(null)

      const [checkinsRes, prsRes, completionsRes] = await Promise.all([
        // Weekly check-ins for weight + wellness
        supabase
          .from('weekly_checkins')
          .select('week_date, weight_kg, energy, sleep, stress')
          .eq('client_id', resolvedClientId)
          .order('week_date', { ascending: true }),

        // PR data joined with exercise names
        supabase
          .from('client_prs')
          .select('exercise_id, weight_kg, date_achieved, exercises(id, name, is_pr_eligible)')
          .eq('client_id', resolvedClientId)
          .order('date_achieved', { ascending: true }),

        // Workout completions
        supabase
          .from('workout_completions')
          .select('status, completed_at, workout_day_id')
          .eq('client_id', resolvedClientId)
          .order('completed_at', { ascending: true }),
      ])

      if (checkinsRes.error) throw checkinsRes.error
      if (prsRes.error) throw prsRes.error
      if (completionsRes.error) throw completionsRes.error

      // --- Weight Data ---
      const checkins = checkinsRes.data || []
      setWeightData(
        checkins
          .filter((c) => c.weight_kg != null)
          .map((c) => ({
            date: formatWeekDate(c.week_date),
            weight: Number(c.weight_kg),
          }))
      )

      // --- Wellness Data ---
      setWellnessData(
        checkins
          .filter((c) => c.energy != null || c.sleep != null)
          .map((c) => ({
            date: formatWeekDate(c.week_date),
            Energy: c.energy,
            Sleep: c.sleep,
          }))
      )

      // --- PR Data ---
      const prRecords = prsRes.data || []
      const exerciseMap = {}
      const exerciseNameSet = new Set()

      prRecords.forEach((pr) => {
        const name = pr.exercises?.name
        if (!name) return
        exerciseNameSet.add(name)
        const dateKey = formatWeekDate(pr.date_achieved)

        if (!exerciseMap[dateKey]) {
          exerciseMap[dateKey] = { date: dateKey, _sortDate: pr.date_achieved }
        }
        exerciseMap[dateKey][name] = Number(pr.weight_kg)
      })

      const exerciseNames = [...exerciseNameSet]
      setPrExerciseNames(exerciseNames)

      const sortedPrData = Object.values(exerciseMap).sort((a, b) =>
        a._sortDate.localeCompare(b._sortDate)
      )
      setPrData(sortedPrData)

      // --- Completion Data (last 8 weeks) ---
      const completions = completionsRes.data || []
      const weekBuckets = {}

      completions.forEach((c) => {
        if (!c.completed_at) return
        const d = new Date(c.completed_at)
        // Get ISO week start (Monday)
        const day = d.getDay()
        const diff = d.getDate() - day + (day === 0 ? -6 : 1)
        const weekStart = new Date(d.setDate(diff))
        const weekKey = weekStart.toISOString().split('T')[0]

        if (!weekBuckets[weekKey]) {
          weekBuckets[weekKey] = { done: 0, total: 0 }
        }
        weekBuckets[weekKey].total += 1
        if (c.status === 'done') {
          weekBuckets[weekKey].done += 1
        }
      })

      const sortedWeeks = Object.entries(weekBuckets)
        .sort(([a], [b]) => a.localeCompare(b))
        .slice(-8)

      setCompletionData(
        sortedWeeks.map(([weekKey, counts]) => ({
          week: formatWeekDate(weekKey),
          rate: counts.total > 0 ? Math.round((counts.done / counts.total) * 100) : 0,
        }))
      )
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [resolvedClientId])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-dark-600 border-t-primary-500" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-red-400">
        Failed to load progress data: {error}
      </div>
    )
  }

  function renderNoData() {
    return (
      <div className="flex min-h-[300px] items-center justify-center rounded-lg border border-dark-700 bg-dark-800">
        <div className="text-center">
          <span className="material-symbols-outlined text-4xl text-dark-500">bar_chart</span>
          <p className="mt-2 text-dark-400">No data yet</p>
          <p className="mt-1 text-xs text-dark-500">
            Data will appear here as it gets recorded.
          </p>
        </div>
      </div>
    )
  }

  function renderWeightChart() {
    if (weightData.length === 0) return renderNoData()
    return (
      <div className="rounded-lg border border-dark-700 bg-dark-800 p-4">
        <h3 className="mb-4 text-sm font-semibold text-dark-200">Weight Progress (kg)</h3>
        <ResponsiveContainer width="100%" height={320}>
          <LineChart data={weightData}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
            <XAxis dataKey="date" tick={{ fill: '#94a3b8', fontSize: 10 }} />
            <YAxis
              tick={{ fill: '#94a3b8', fontSize: 10 }}
              domain={['dataMin - 2', 'dataMax + 2']}
            />
            <Tooltip content={<CustomTooltip />} />
            <Line
              type="monotone"
              dataKey="weight"
              name="Weight (kg)"
              stroke="#7c3bed"
              strokeWidth={2}
              dot={{ fill: '#7c3bed', r: 4 }}
              activeDot={{ r: 6, fill: '#8b5cf6' }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    )
  }

  function renderPRChart() {
    if (prData.length === 0 || prExerciseNames.length === 0) return renderNoData()
    return (
      <div className="rounded-lg border border-dark-700 bg-dark-800 p-4">
        <h3 className="mb-4 text-sm font-semibold text-dark-200">PR Progress (kg)</h3>
        <ResponsiveContainer width="100%" height={320}>
          <LineChart data={prData}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
            <XAxis dataKey="date" tick={{ fill: '#94a3b8', fontSize: 10 }} />
            <YAxis tick={{ fill: '#94a3b8', fontSize: 10 }} />
            <Tooltip content={<CustomTooltip />} />
            <Legend
              wrapperStyle={{ fontSize: 11, color: '#94a3b8' }}
              iconType="circle"
            />
            {prExerciseNames.map((name, i) => (
              <Line
                key={name}
                type="monotone"
                dataKey={name}
                name={name}
                stroke={PR_COLORS[i % PR_COLORS.length]}
                strokeWidth={2}
                dot={{ fill: PR_COLORS[i % PR_COLORS.length], r: 3 }}
                connectNulls
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    )
  }

  function renderCompletionChart() {
    if (completionData.length === 0) return renderNoData()
    return (
      <div className="rounded-lg border border-dark-700 bg-dark-800 p-4">
        <h3 className="mb-4 text-sm font-semibold text-dark-200">
          Workout Completion Rate (Last 8 Weeks)
        </h3>
        <ResponsiveContainer width="100%" height={320}>
          <BarChart data={completionData}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
            <XAxis dataKey="week" tick={{ fill: '#94a3b8', fontSize: 10 }} />
            <YAxis
              tick={{ fill: '#94a3b8', fontSize: 10 }}
              domain={[0, 100]}
              tickFormatter={(v) => `${v}%`}
            />
            <Tooltip content={<CustomTooltip />} />
            <Bar
              dataKey="rate"
              name="Completion %"
              fill="#10b981"
              radius={[4, 4, 0, 0]}
              maxBarSize={48}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    )
  }

  function renderWellnessChart() {
    if (wellnessData.length === 0) return renderNoData()
    return (
      <div className="rounded-lg border border-dark-700 bg-dark-800 p-4">
        <h3 className="mb-4 text-sm font-semibold text-dark-200">Energy & Sleep Trends</h3>
        <ResponsiveContainer width="100%" height={320}>
          <AreaChart data={wellnessData}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
            <XAxis dataKey="date" tick={{ fill: '#94a3b8', fontSize: 10 }} />
            <YAxis tick={{ fill: '#94a3b8', fontSize: 10 }} domain={[1, 10]} />
            <Tooltip content={<CustomTooltip />} />
            <Legend
              wrapperStyle={{ fontSize: 11, color: '#94a3b8' }}
              iconType="circle"
            />
            <Area
              type="monotone"
              dataKey="Energy"
              name="Energy"
              stroke="#8b5cf6"
              fill="#8b5cf6"
              fillOpacity={0.15}
              strokeWidth={2}
            />
            <Area
              type="monotone"
              dataKey="Sleep"
              name="Sleep"
              stroke="#3b82f6"
              fill="#3b82f6"
              fillOpacity={0.15}
              strokeWidth={2}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    )
  }

  const chartRenderers = {
    weight: renderWeightChart,
    prs: renderPRChart,
    completion: renderCompletionChart,
    wellness: renderWellnessChart,
  }

  return (
    <div className="space-y-4">
      {/* Tab Navigation */}
      <div className="flex gap-1 rounded-lg border border-dark-700 bg-dark-800 p-1">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-2 text-xs font-medium transition-colors ${
              activeTab === tab.key
                ? 'bg-primary-600 text-white'
                : 'text-dark-400 hover:bg-dark-700 hover:text-dark-200'
            }`}
          >
            <span className="material-symbols-outlined text-[16px]">{tab.icon}</span>
            <span className="hidden sm:inline">{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Active Chart */}
      {chartRenderers[activeTab]()}
    </div>
  )
}
