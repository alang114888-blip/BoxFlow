import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import {
  UserGroupIcon,
  ClipboardDocumentListIcon,
  BookOpenIcon,
  FireIcon,
  CakeIcon,
  TrophyIcon,
} from '@heroicons/react/24/outline'

export default function TrainerDashboard() {
  const { profile } = useAuth()
  const [stats, setStats] = useState({ clients: 0, activePlans: 0, exercises: 0, wods: 0 })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!profile) return
    fetchStats()
  }, [profile])

  async function fetchStats() {
    try {
      const [clientsRes, wpRes, npRes, exRes, wodRes] = await Promise.all([
        supabase.from('trainer_clients').select('id', { count: 'exact', head: true })
          .eq('trainer_id', profile.id).eq('invite_accepted', true),
        supabase.from('workout_plans').select('id', { count: 'exact', head: true })
          .eq('trainer_id', profile.id).eq('is_active', true),
        supabase.from('nutrition_plans').select('id', { count: 'exact', head: true })
          .eq('trainer_id', profile.id).eq('is_active', true),
        supabase.from('exercises').select('id', { count: 'exact', head: true })
          .eq('trainer_id', profile.id),
        supabase.from('wods').select('id', { count: 'exact', head: true })
          .eq('trainer_id', profile.id),
      ])
      setStats({
        clients: clientsRes.count || 0,
        activePlans: (wpRes.count || 0) + (npRes.count || 0),
        exercises: exRes.count || 0,
        wods: wodRes.count || 0,
      })
    } catch (err) {
      console.error('Stats error:', err)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-dark-600 border-t-primary-500" />
      </div>
    )
  }

  const statCards = [
    { label: 'Clients', value: stats.clients, icon: UserGroupIcon, color: 'text-blue-400', bg: 'bg-blue-500/10' },
    { label: 'Active Plans', value: stats.activePlans, icon: ClipboardDocumentListIcon, color: 'text-green-400', bg: 'bg-green-500/10' },
    { label: 'Exercises', value: stats.exercises, icon: BookOpenIcon, color: 'text-purple-400', bg: 'bg-purple-500/10' },
    { label: 'WODs', value: stats.wods, icon: FireIcon, color: 'text-orange-400', bg: 'bg-orange-500/10' },
  ]

  const quickActions = [
    { label: 'Add Client', to: '/trainer/clients', icon: UserGroupIcon, desc: 'Invite a new client' },
    { label: 'Create Workout', to: '/trainer/workouts', icon: ClipboardDocumentListIcon, desc: 'Build a workout plan' },
    { label: 'Publish WOD', to: '/trainer/wod', icon: FireIcon, desc: 'Post workout of the day' },
    { label: 'Meal Plan', to: '/trainer/nutrition', icon: CakeIcon, desc: 'Design a nutrition plan' },
    { label: 'Exercises', to: '/trainer/settings', icon: BookOpenIcon, desc: 'Manage exercise library' },
    { label: 'Leaderboard', to: '/trainer/leaderboard', icon: TrophyIcon, desc: 'View client scores' },
  ]

  return (
    <div>
      {/* Greeting */}
      <div className="mb-5">
        <h2 className="text-xl font-bold text-dark-100">
          Hey, {profile?.full_name?.split(' ')[0] || 'Coach'}
        </h2>
        <p className="text-sm text-dark-400">Here's your overview</p>
      </div>

      {/* Stats Grid */}
      <div className="mb-6 grid grid-cols-2 gap-3">
        {statCards.map((s) => (
          <div key={s.label} className="flex items-center gap-3 rounded-xl border border-dark-700 bg-dark-800 p-4">
            <div className={`rounded-lg p-2 ${s.bg}`}>
              <s.icon className={`h-5 w-5 ${s.color}`} />
            </div>
            <div>
              <p className="text-2xl font-bold text-dark-100">{s.value}</p>
              <p className="text-xs text-dark-400">{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Quick Actions */}
      <h3 className="mb-3 text-sm font-semibold text-dark-300 uppercase tracking-wider">Quick Actions</h3>
      <div className="grid grid-cols-2 gap-3">
        {quickActions.map((a) => (
          <Link
            key={a.label}
            to={a.to}
            className="flex items-center gap-3 rounded-xl border border-dark-700 bg-dark-800 p-4 transition-colors hover:border-primary-500/40 hover:bg-dark-700 active:scale-[0.98]"
          >
            <a.icon className="h-5 w-5 text-primary-400 flex-shrink-0" />
            <div className="min-w-0">
              <p className="text-sm font-medium text-dark-100 truncate">{a.label}</p>
              <p className="text-[11px] text-dark-400 truncate">{a.desc}</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
