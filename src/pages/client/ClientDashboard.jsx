import { useState, useEffect } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { supabase } from '../../lib/supabase'
import {
  FireIcon,
  TrophyIcon,
  ClipboardDocumentListIcon,
  CalendarDaysIcon,
  ChartBarIcon,
} from '@heroicons/react/24/outline'
import { format, startOfWeek, endOfWeek } from 'date-fns'

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

export default function ClientDashboard() {
  const { profile } = useAuth()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [todayWorkout, setTodayWorkout] = useState(null)
  const [activePlan, setActivePlan] = useState(null)
  const [activeNutritionPlan, setActiveNutritionPlan] = useState(null)
  const [weeklyCompleted, setWeeklyCompleted] = useState(0)
  const [prCount, setPrCount] = useState(0)
  const [recentLogs, setRecentLogs] = useState([])

  useEffect(() => {
    if (profile?.id) {
      fetchDashboardData()
    }
  }, [profile?.id])

  async function fetchDashboardData() {
    try {
      setLoading(true)
      setError(null)

      const todayDow = DAY_NAMES[new Date().getDay()]
      const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 })
      const weekEnd = endOfWeek(new Date(), { weekStartsOn: 1 })

      const [
        planRes,
        nutritionRes,
        weeklyRes,
        prRes,
        logsRes,
      ] = await Promise.all([
        // Active workout plan with today's workout days
        supabase
          .from('workout_plans')
          .select(`
            id, name, description,
            workout_days (
              id, day_of_week, session_number, name,
              workout_exercises (
                id, order_index, sets, reps, percentage_of_pr, manual_weight_kg, notes,
                exercises ( id, name, category )
              )
            )
          `)
          .eq('client_id', profile.id)
          .eq('is_active', true)
          .limit(1)
          .single(),

        // Active nutrition plan
        supabase
          .from('nutrition_plans')
          .select('id, name, description')
          .eq('client_id', profile.id)
          .eq('is_active', true)
          .limit(1)
          .single(),

        // Workouts completed this week
        supabase
          .from('workout_logs')
          .select('id', { count: 'exact', head: true })
          .eq('client_id', profile.id)
          .gte('completed_at', weekStart.toISOString())
          .lte('completed_at', weekEnd.toISOString()),

        // PR count
        supabase
          .from('client_prs')
          .select('exercise_id', { count: 'exact', head: true })
          .eq('client_id', profile.id),

        // Recent workout logs
        supabase
          .from('workout_logs')
          .select(`
            id, completed_at, notes, score,
            workout_days ( id, name, day_of_week )
          `)
          .eq('client_id', profile.id)
          .order('completed_at', { ascending: false })
          .limit(5),
      ])

      if (planRes.data) {
        setActivePlan(planRes.data)
        const todayDay = planRes.data.workout_days?.find(
          (d) => d.day_of_week === todayDow
        )
        setTodayWorkout(todayDay || null)
      }

      if (nutritionRes.data) {
        setActiveNutritionPlan(nutritionRes.data)
      }

      setWeeklyCompleted(weeklyRes.count || 0)
      setPrCount(prRes.count || 0)
      setRecentLogs(logsRes.data || [])
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
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
          Failed to load dashboard: {error}
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6">
      {/* Welcome */}
      <div>
        <h1 className="text-2xl font-bold text-dark-100">
          Welcome back, {profile?.full_name || 'Athlete'}
        </h1>
        <p className="mt-1 text-dark-400">
          {format(new Date(), 'EEEE, MMMM d, yyyy')}
        </p>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard
          icon={<FireIcon className="h-6 w-6 text-primary-500" />}
          label="Workouts This Week"
          value={weeklyCompleted}
        />
        <StatCard
          icon={<TrophyIcon className="h-6 w-6 text-primary-500" />}
          label="Personal Records"
          value={prCount}
        />
        <StatCard
          icon={<ChartBarIcon className="h-6 w-6 text-primary-500" />}
          label="Total Logged"
          value={recentLogs.length > 0 ? `${recentLogs.length} recent` : '0'}
        />
      </div>

      {/* Today's Workout */}
      <div className="rounded-lg border border-dark-700 bg-dark-800 p-5">
        <div className="mb-3 flex items-center gap-2">
          <CalendarDaysIcon className="h-5 w-5 text-primary-500" />
          <h2 className="text-lg font-semibold text-dark-100">Today's Workout</h2>
        </div>
        {todayWorkout ? (
          <div>
            <p className="mb-2 font-medium text-primary-400">{todayWorkout.name}</p>
            <div className="space-y-1">
              {todayWorkout.workout_exercises
                ?.sort((a, b) => a.order_index - b.order_index)
                .map((we) => (
                  <p key={we.id} className="text-sm text-dark-300">
                    {we.exercises?.name} &mdash; {we.sets} x {we.reps}
                  </p>
                ))}
            </div>
          </div>
        ) : (
          <p className="text-dark-400">No workout scheduled for today. Rest day!</p>
        )}
      </div>

      {/* Active Plans */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {/* Workout Plan */}
        <div className="rounded-lg border border-dark-700 bg-dark-800 p-5">
          <div className="mb-3 flex items-center gap-2">
            <ClipboardDocumentListIcon className="h-5 w-5 text-primary-500" />
            <h2 className="text-lg font-semibold text-dark-100">Active Workout Plan</h2>
          </div>
          {activePlan ? (
            <div>
              <p className="font-medium text-dark-200">{activePlan.name}</p>
              {activePlan.description && (
                <p className="mt-1 text-sm text-dark-400">{activePlan.description}</p>
              )}
              <p className="mt-2 text-xs text-dark-500">
                {activePlan.workout_days?.length || 0} training day(s)
              </p>
            </div>
          ) : (
            <p className="text-dark-400">No active workout plan assigned.</p>
          )}
        </div>

        {/* Nutrition Plan */}
        <div className="rounded-lg border border-dark-700 bg-dark-800 p-5">
          <div className="mb-3 flex items-center gap-2">
            <FireIcon className="h-5 w-5 text-primary-500" />
            <h2 className="text-lg font-semibold text-dark-100">Active Nutrition Plan</h2>
          </div>
          {activeNutritionPlan ? (
            <div>
              <p className="font-medium text-dark-200">{activeNutritionPlan.name}</p>
              {activeNutritionPlan.description && (
                <p className="mt-1 text-sm text-dark-400">{activeNutritionPlan.description}</p>
              )}
            </div>
          ) : (
            <p className="text-dark-400">No active nutrition plan assigned.</p>
          )}
        </div>
      </div>

      {/* Recent Workout Logs */}
      <div className="rounded-lg border border-dark-700 bg-dark-800 p-5">
        <h2 className="mb-3 text-lg font-semibold text-dark-100">Recent Workouts</h2>
        {recentLogs.length > 0 ? (
          <div className="space-y-3">
            {recentLogs.map((log) => (
              <div
                key={log.id}
                className="flex items-center justify-between rounded-md border border-dark-700 bg-dark-900 px-4 py-3"
              >
                <div>
                  <p className="font-medium text-dark-200">
                    {log.workout_days?.name || 'Workout'}
                  </p>
                  <p className="text-xs text-dark-500">
                    {format(new Date(log.completed_at), 'MMM d, yyyy h:mm a')}
                  </p>
                  {log.notes && (
                    <p className="mt-1 text-sm text-dark-400">{log.notes}</p>
                  )}
                </div>
                {log.score != null && (
                  <div className="text-right">
                    <span className="text-lg font-bold text-primary-500">{log.score}</span>
                    <span className="text-xs text-dark-500">/10</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-dark-400">No workouts logged yet. Get started!</p>
        )}
      </div>
    </div>
  )
}

function StatCard({ icon, label, value }) {
  return (
    <div className="flex items-center gap-4 rounded-lg border border-dark-700 bg-dark-800 p-4">
      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-dark-700">
        {icon}
      </div>
      <div>
        <p className="text-2xl font-bold text-dark-100">{value}</p>
        <p className="text-sm text-dark-400">{label}</p>
      </div>
    </div>
  )
}
