import { useState, useEffect } from 'react'
import { useOutletContext, useNavigate } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { supabase } from '../../lib/supabase'
import { format, startOfWeek, endOfWeek } from 'date-fns'
import NutritionHome from './NutritionHome'
import { SkeletonDashboard } from '../../components/SkeletonLoader'
import MiniChart from '../../components/MiniChart'
import Habits from './Habits'

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

export default function ClientDashboard() {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const outletContext = useOutletContext() || {}
  const trainerType = outletContext.trainerType
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [todayWorkout, setTodayWorkout] = useState(null)
  const [activePlan, setActivePlan] = useState(null)
  const [activeNutritionPlan, setActiveNutritionPlan] = useState(null)
  const [weeklyCompleted, setWeeklyCompleted] = useState(0)
  const [prCount, setPrCount] = useState(0)
  const [recentLogs, setRecentLogs] = useState([])
  const [weightData, setWeightData] = useState([])

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
        weightLogsRes,
      ] = await Promise.all([
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
          .maybeSingle(),

        supabase
          .from('nutrition_plans')
          .select('id, name, description')
          .eq('client_id', profile.id)
          .eq('is_active', true)
          .limit(1)
          .maybeSingle(),

        supabase
          .from('workout_logs')
          .select('id', { count: 'exact', head: true })
          .eq('client_id', profile.id)
          .gte('completed_at', weekStart.toISOString())
          .lte('completed_at', weekEnd.toISOString()),

        supabase
          .from('client_prs')
          .select('exercise_id', { count: 'exact', head: true })
          .eq('client_id', profile.id),

        supabase
          .from('workout_logs')
          .select(`
            id, completed_at, notes, score,
            workout_days ( id, name, day_of_week )
          `)
          .eq('client_id', profile.id)
          .order('completed_at', { ascending: false })
          .limit(5),

        supabase
          .from('weight_logs')
          .select('weight_kg, logged_at')
          .eq('client_id', profile.id)
          .order('logged_at', { ascending: true })
          .limit(14),
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
      setWeightData(weightLogsRes?.data || [])
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return <SkeletonDashboard />
  }

  if (error) {
    return (
      <div className="px-5 py-6">
        <div className="rounded-2xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-400">
          Failed to load dashboard: {error}
        </div>
      </div>
    )
  }

  const exerciseCount = todayWorkout?.workout_exercises?.length || 0
  const estimatedDuration = exerciseCount * 5 // rough estimate: 5 min per exercise

  return (
    <div className="space-y-6 px-5 py-4">
      {/* Hero Card - Coach Insight */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-primary-dark via-primary to-purple-500 p-5 shadow-[0_8px_32px_-8px_rgba(124,59,237,0.5)]">
        <div className="relative z-10">
          <div className="mb-2 flex items-center gap-1.5">
            <span className="material-symbols-outlined text-[16px] text-amber-300">auto_awesome</span>
            <span className="text-[10px] font-bold uppercase tracking-widest text-white/70">
              Coach Insight
            </span>
          </div>
          <p className="text-lg font-bold leading-snug text-white">
            "Consistency beats intensity. You showed up {weeklyCompleted} time{weeklyCompleted !== 1 ? 's' : ''} this week — keep the momentum!"
          </p>
          <p className="mt-2 text-sm text-white/60">
            Ready to crush your session?
          </p>
        </div>
        {/* Decorative circles */}
        <div className="absolute -top-6 -right-6 h-24 w-24 rounded-full bg-white/10" />
        <div className="absolute -bottom-4 -left-4 h-16 w-16 rounded-full bg-white/5" />
      </div>

      {/* Today's Workout */}
      {todayWorkout ? (
        <section>
          <div className="rounded-2xl overflow-hidden border border-primary/20 bg-gradient-to-br from-[#1a1225] to-[#251b3a]">
            <div className="p-5 pb-3">
              <div className="flex items-center gap-2 mb-1">
                <span className="material-symbols-outlined text-primary text-[18px]" style={{ fontVariationSettings: "'FILL' 1" }}>fitness_center</span>
                <span className="text-[10px] font-bold uppercase tracking-widest text-primary/70">Today's workout</span>
              </div>
              <h3 className="text-xl font-bold text-white">{todayWorkout.name || "Today's Session"}</h3>
              <div className="flex items-center gap-4 mt-1.5 text-xs text-slate-400">
                <span className="flex items-center gap-1"><span className="material-symbols-outlined text-[14px]">timer</span>~{exerciseCount * 5} min</span>
                <span className="flex items-center gap-1"><span className="material-symbols-outlined text-[14px]">exercise</span>{exerciseCount} exercises</span>
              </div>
            </div>
            <div className="px-5 pb-3">
              <div className="space-y-2">
                {(todayWorkout.workout_exercises || []).slice(0, 4).map((ex, i) => (
                  <div key={ex.id || i} className="flex items-center gap-3 py-1.5">
                    <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center text-[11px] font-bold text-primary">{i + 1}</div>
                    <div className="flex-1 min-w-0"><p className="text-sm text-white truncate">{ex.exercises?.name || 'Exercise'}</p></div>
                    <span className="text-[11px] text-slate-500 font-medium">{ex.sets}×{ex.reps}</span>
                  </div>
                ))}
                {(todayWorkout.workout_exercises || []).length > 4 && (
                  <p className="text-[11px] text-slate-500 pl-10">+{(todayWorkout.workout_exercises || []).length - 4} more exercises</p>
                )}
              </div>
            </div>
            <div className="p-4 pt-2">
              <button onClick={() => navigate('/client/workouts')}
                className="w-full py-3.5 rounded-xl bg-gradient-to-r from-primary to-purple-500 text-white font-bold text-sm uppercase tracking-wider shadow-lg shadow-primary/25 hover:shadow-primary/40 active:scale-[0.98] transition-all flex items-center justify-center gap-2 btn-press">
                <span className="material-symbols-outlined text-[20px]">play_arrow</span>Start Workout
              </button>
            </div>
          </div>
        </section>
      ) : (
        <section>
          <div className="rounded-2xl bg-[#1a1225] border border-white/5 p-6 text-center">
            <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 flex items-center justify-center mx-auto mb-3">
              <span className="material-symbols-outlined text-emerald-400 text-3xl">self_improvement</span>
            </div>
            <p className="text-white font-semibold text-sm">Rest Day</p>
            <p className="text-slate-500 text-xs mt-1">No workout scheduled. Recovery is part of the process!</p>
          </div>
        </section>
      )}

      {/* Nutrition Summary */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-bold text-white">Nutrition Summary</h2>
          <button className="text-xs font-semibold text-primary">Details</button>
        </div>

        <div className="rounded-2xl bg-[#1a1225] border border-white/5 p-5">
          {activeNutritionPlan ? (
            <div>
              <p className="text-sm font-medium text-white mb-1">{activeNutritionPlan.name}</p>
              {activeNutritionPlan.description && (
                <p className="text-xs text-slate-400">{activeNutritionPlan.description}</p>
              )}
            </div>
          ) : (
            <div className="text-center py-4">
              <span className="material-symbols-outlined text-slate-600 text-3xl mb-2">restaurant</span>
              <p className="text-sm text-slate-500">No nutrition plan assigned yet.</p>
            </div>
          )}
        </div>
      </section>

      {/* Weight Trend */}
      {weightData.length >= 2 && (
        <section>
          <h2 className="mb-3 text-base font-bold text-white">Weight trend</h2>
          <div className="rounded-2xl bg-[#1a1225] border border-white/5 p-4">
            <MiniChart data={weightData.map(w => ({ value: Number(w.weight_kg) }))} color="#7c3bed" height={80} />
            <div className="flex justify-between mt-2 text-[10px] text-slate-500">
              <span>{new Date(weightData[0].logged_at).toLocaleDateString('en', { month: 'short', day: 'numeric' })}</span>
              <span>{new Date(weightData[weightData.length-1].logged_at).toLocaleDateString('en', { month: 'short', day: 'numeric' })}</span>
            </div>
          </div>
        </section>
      )}

      {/* Recent Activity */}
      {recentLogs.length > 0 && (
        <section>
          <h2 className="mb-3 text-base font-bold text-white">Recent Activity</h2>
          <div className="space-y-2 stagger-list">
            {recentLogs.map((log) => (
              <div
                key={log.id}
                className="flex items-center justify-between rounded-xl bg-[#1a1225] border border-white/5 px-4 py-3"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#251b3a]">
                    <span className="material-symbols-outlined text-[18px] text-primary">fitness_center</span>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-white">
                      {log.workout_days?.name || 'Workout'}
                    </p>
                    <p className="text-[11px] text-slate-500">
                      {format(new Date(log.completed_at), 'MMM d, h:mm a')}
                    </p>
                  </div>
                </div>
                {log.score != null && (
                  <span className="text-sm font-bold text-primary">{log.score}/10</span>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Habits */}
      <section>
        <Habits />
      </section>

      {/* Nutrition Features */}
      {(trainerType === 'nutrition' || trainerType === 'both') && (
        <section>
          <NutritionHome />
        </section>
      )}
    </div>
  )
}

// MacroBar and MealItem removed — nutrition section now shows plan name only
