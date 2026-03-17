import { useState, useEffect } from 'react'
import { useOutletContext } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { supabase } from '../../lib/supabase'
import { format, startOfWeek, endOfWeek } from 'date-fns'
import NutritionHome from './NutritionHome'
import Habits from './Habits'

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

export default function ClientDashboard() {
  const { profile } = useAuth()
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

        supabase
          .from('nutrition_plans')
          .select('id, name, description')
          .eq('client_id', profile.id)
          .eq('is_active', true)
          .limit(1)
          .single(),

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
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-[#251b3a] border-t-primary" />
      </div>
    )
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

      {/* Today's Plan */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-bold text-white">Today's Plan</h2>
          <button className="text-xs font-semibold text-primary">View all</button>
        </div>

        {todayWorkout ? (
          <div className="overflow-hidden rounded-2xl bg-[#1a1225] border border-white/5">
            {/* Image placeholder with gradient */}
            <div className="relative h-40 bg-gradient-to-br from-[#251b3a] via-[#1a1225] to-primary/20">
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="material-symbols-outlined text-[48px] text-primary/30">fitness_center</span>
              </div>
              {/* Badge */}
              <div className="absolute top-3 left-3">
                <span className="rounded-full bg-primary/20 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-primary-light backdrop-blur-sm">
                  Main Session
                </span>
              </div>
            </div>
            <div className="p-4">
              <h3 className="text-base font-bold text-white">
                {todayWorkout.name || 'Today\'s Workout'}
              </h3>
              <div className="mt-1 flex items-center gap-3 text-xs text-slate-400">
                <span className="flex items-center gap-1">
                  <span className="material-symbols-outlined text-[14px]">timer</span>
                  {estimatedDuration > 0 ? `${estimatedDuration} min` : '—'}
                </span>
                <span className="flex items-center gap-1">
                  <span className="material-symbols-outlined text-[14px]">exercise</span>
                  {exerciseCount} exercise{exerciseCount !== 1 ? 's' : ''}
                </span>
              </div>
              <div className="mt-4 flex items-center gap-2">
                <button className="flex-1 rounded-xl bg-primary py-3 text-center text-sm font-bold uppercase tracking-wider text-white transition hover:bg-primary-dark">
                  Start Workout
                </button>
                <button className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#251b3a] text-slate-400 transition hover:text-white">
                  <span className="material-symbols-outlined text-[20px]">bookmark</span>
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="rounded-2xl bg-[#1a1225] border border-white/5 p-6 text-center">
            <span className="material-symbols-outlined mb-2 text-[36px] text-slate-600">self_improvement</span>
            <p className="text-sm text-slate-400">No workout scheduled for today. Rest day!</p>
          </div>
        )}
      </section>

      {/* Nutrition Summary */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-bold text-white">Nutrition Summary</h2>
          <button className="text-xs font-semibold text-primary">Details</button>
        </div>

        <div className="rounded-2xl bg-[#1a1225] border border-white/5 p-5">
          {/* Calorie ring + total */}
          <div className="flex items-center gap-5">
            {/* Circular progress ring */}
            <div className="relative flex-shrink-0">
              <svg width="80" height="80" viewBox="0 0 80 80">
                <circle
                  cx="40" cy="40" r="34"
                  fill="none"
                  stroke="#251b3a"
                  strokeWidth="6"
                />
                <circle
                  cx="40" cy="40" r="34"
                  fill="none"
                  stroke="#7c3bed"
                  strokeWidth="6"
                  strokeLinecap="round"
                  strokeDasharray={`${2 * Math.PI * 34}`}
                  strokeDashoffset={`${2 * Math.PI * 34 * (1 - 0.77)}`}
                  transform="rotate(-90 40 40)"
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-lg font-bold text-white">77%</span>
              </div>
            </div>
            <div>
              <p className="text-sm text-slate-400">Daily intake</p>
              <p className="text-xl font-bold text-white">
                1,840 <span className="text-sm font-normal text-slate-500">/ 2,400 kcal</span>
              </p>
            </div>
          </div>

          {/* Macro bars */}
          <div className="mt-5 space-y-3">
            <MacroBar label="Protein" current={120} target={160} color="bg-blue-500" />
            <MacroBar label="Carbs" current={200} target={280} color="bg-emerald-500" />
            <MacroBar label="Fats" current={55} target={70} color="bg-yellow-500" />
          </div>

          {/* Meal items */}
          {activeNutritionPlan ? (
            <div className="mt-5 space-y-2 border-t border-white/5 pt-4">
              <MealItem icon="egg_alt" name="Breakfast" detail="Oats & protein shake" kcal={420} />
              <MealItem icon="lunch_dining" name="Lunch" detail="Grilled chicken bowl" kcal={650} />
              <MealItem icon="dinner_dining" name="Snack" detail="Greek yogurt & berries" kcal={220} />
              <MealItem icon="local_cafe" name="Post-workout" detail="Protein bar" kcal={280} />
            </div>
          ) : (
            <div className="mt-5 border-t border-white/5 pt-4 text-center">
              <p className="text-sm text-slate-500">No nutrition plan assigned yet.</p>
            </div>
          )}
        </div>
      </section>

      {/* Recent Activity */}
      {recentLogs.length > 0 && (
        <section>
          <h2 className="mb-3 text-base font-bold text-white">Recent Activity</h2>
          <div className="space-y-2">
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
    </div>
  )
}

function MacroBar({ label, current, target, color }) {
  const pct = Math.min((current / target) * 100, 100)
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-xs">
        <span className="text-slate-400">{label}</span>
        <span className="text-slate-500">{current}g / {target}g</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-[#251b3a]">
        <div
          className={`h-full rounded-full ${color} transition-all`}
          style={{ width: `${pct}%` }}
        />
      </div>
      {/* Habits - shown for all clients */}
      <Habits />

      {/* Nutrition Features - shown for nutrition/both trainer types */}
      {(trainerType === 'nutrition' || trainerType === 'both') && (
        <NutritionHome />
      )}
    </div>
  )
}

function MealItem({ icon, name, detail, kcal }) {
  return (
    <div className="flex items-center justify-between py-1.5">
      <div className="flex items-center gap-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#251b3a]">
          <span className="material-symbols-outlined text-[16px] text-primary">{icon}</span>
        </div>
        <div>
          <p className="text-sm font-medium text-white">{name}</p>
          <p className="text-[11px] text-slate-500">{detail}</p>
        </div>
      </div>
      <span className="text-xs font-semibold text-slate-400">{kcal} kcal</span>
    </div>
  )
}
