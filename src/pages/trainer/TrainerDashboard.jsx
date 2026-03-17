import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'

export default function TrainerDashboard() {
  const { profile } = useAuth()
  const [stats, setStats] = useState({ clients: 0, workouts: 0, activity: 0 })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!profile) return
    fetchStats()
  }, [profile])

  async function fetchStats() {
    try {
      const [clientsRes, workoutsRes] = await Promise.all([
        supabase
          .from('trainer_clients')
          .select('id', { count: 'exact', head: true })
          .eq('trainer_id', profile.id)
          .eq('invite_accepted', true),
        supabase
          .from('workout_plans')
          .select('id', { count: 'exact', head: true })
          .eq('trainer_id', profile.id),
      ])
      const clientCount = clientsRes.count || 0
      const workoutCount = workoutsRes.count || 0
      // Activity % is a derived metric - based on active plans ratio
      const activity = clientCount > 0 ? Math.min(Math.round((workoutCount / clientCount) * 100), 100) : 0
      setStats({ clients: clientCount, workouts: workoutCount, activity })
    } catch (err) {
      console.error('Stats error:', err)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-dark-600 border-t-primary" />
      </div>
    )
  }

  const firstName = profile?.full_name?.split(' ')[0] || 'Coach'

  const statCards = [
    { label: 'Clients', value: stats.clients },
    { label: 'Workouts', value: stats.workouts },
    { label: 'Activity', value: `${stats.activity}%` },
  ]

  const quickActions = [
    { label: 'New Client', to: '/trainer/clients', icon: 'person_add', color: 'text-blue-400', bg: 'bg-blue-500/10' },
    { label: 'Create Workout', to: '/trainer/workouts', icon: 'fitness_center', color: 'text-primary', bg: 'bg-primary/10' },
    { label: 'Meal Planner', to: '/trainer/nutrition', icon: 'restaurant', color: 'text-orange-400', bg: 'bg-orange-500/10' },
    { label: 'Review Stats', to: '/trainer/leaderboard', icon: 'analytics', color: 'text-green-400', bg: 'bg-green-500/10' },
  ]

  return (
    <div>
      {/* Welcome Hero */}
      <div className="relative mb-5 overflow-hidden rounded-2xl bg-gradient-to-br from-primary to-primary-dark p-5">
        {/* Decorative circles */}
        <div className="absolute -top-6 -right-6 h-24 w-24 rounded-full bg-white/10" />
        <div className="absolute -bottom-4 -left-4 h-16 w-16 rounded-full bg-white/5" />
        <div className="relative">
          <p className="text-sm text-white/70">Welcome back,</p>
          <h2 className="text-xl font-bold text-white">Coach {firstName},</h2>
          <p className="mt-1 text-sm text-white/60">
            {stats.clients} active client{stats.clients !== 1 ? 's' : ''} &middot; {stats.workouts} workout{stats.workouts !== 1 ? 's' : ''}
          </p>
        </div>
      </div>

      {/* Stats Grid - 3 columns */}
      <div className="mb-5 grid grid-cols-3 gap-3">
        {statCards.map((s) => (
          <div key={s.label} className="rounded-2xl bg-[#1a1426] border border-primary/10 p-3 text-center">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-dark-400">{s.label}</p>
            <p className="mt-1 text-2xl font-bold text-primary">{s.value}</p>
          </div>
        ))}
      </div>

      {/* Quick Hub - 2x2 grid */}
      <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-dark-400">Quick Hub</h3>
      <div className="grid grid-cols-2 gap-3">
        {quickActions.map((a) => (
          <Link
            key={a.label}
            to={a.to}
            className="flex aspect-square flex-col items-center justify-center gap-2 rounded-2xl border border-primary/10 bg-[#1a1426] transition-colors hover:border-primary/30 active:scale-[0.97]"
          >
            <div className={`rounded-xl p-3 ${a.bg}`}>
              <span className={`material-symbols-outlined text-[28px] ${a.color}`}>{a.icon}</span>
            </div>
            <span className="text-xs font-medium text-dark-200">{a.label}</span>
          </Link>
        ))}
      </div>
    </div>
  )
}
