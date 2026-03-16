import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import {
  UserGroupIcon,
  ClipboardDocumentListIcon,
  BookOpenIcon,
  PlusCircleIcon,
  ArrowTrendingUpIcon,
  ClockIcon,
} from '@heroicons/react/24/outline'

export default function TrainerDashboard() {
  const { profile } = useAuth()
  const [stats, setStats] = useState({ clients: 0, activePlans: 0, exercises: 0 })
  const [recentLogs, setRecentLogs] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!profile) return
    fetchDashboardData()
  }, [profile])

  async function fetchDashboardData() {
    try {
      setLoading(true)
      setError(null)

      const [clientsRes, workoutPlansRes, nutritionPlansRes, exercisesRes, logsRes] =
        await Promise.all([
          supabase
            .from('trainer_clients')
            .select('id', { count: 'exact', head: true })
            .eq('trainer_id', profile.id)
            .eq('invite_accepted', true),
          supabase
            .from('workout_plans')
            .select('id', { count: 'exact', head: true })
            .eq('trainer_id', profile.id)
            .eq('is_active', true),
          supabase
            .from('nutrition_plans')
            .select('id', { count: 'exact', head: true })
            .eq('trainer_id', profile.id)
            .eq('is_active', true),
          supabase
            .from('exercises')
            .select('id', { count: 'exact', head: true })
            .eq('trainer_id', profile.id),
          supabase
            .from('workout_logs')
            .select(`
              id,
              completed_at,
              notes,
              score,
              client_id,
              profiles!workout_logs_client_id_fkey ( full_name ),
              workout_days (
                name,
                workout_plans ( name )
              )
            `)
            .in(
              'client_id',
              (
                await supabase
                  .from('trainer_clients')
                  .select('client_id')
                  .eq('trainer_id', profile.id)
                  .eq('invite_accepted', true)
              ).data?.map((c) => c.client_id) || []
            )
            .order('completed_at', { ascending: false })
            .limit(10),
        ])

      if (clientsRes.error) throw clientsRes.error
      if (exercisesRes.error) throw exercisesRes.error

      const activePlans =
        (workoutPlansRes.count || 0) + (nutritionPlansRes.count || 0)

      setStats({
        clients: clientsRes.count || 0,
        activePlans,
        exercises: exercisesRes.count || 0,
      })

      setRecentLogs(logsRes.data || [])
    } catch (err) {
      console.error('Dashboard fetch error:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-dark-900">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-dark-600 border-t-primary-500" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-dark-900 p-8">
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-red-400">
          Failed to load dashboard: {error}
        </div>
      </div>
    )
  }

  const statCards = [
    {
      label: 'Total Clients',
      value: stats.clients,
      icon: UserGroupIcon,
      color: 'text-blue-400',
      bg: 'bg-blue-500/10',
    },
    {
      label: 'Active Plans',
      value: stats.activePlans,
      icon: ClipboardDocumentListIcon,
      color: 'text-green-400',
      bg: 'bg-green-500/10',
    },
    {
      label: 'Exercises in Library',
      value: stats.exercises,
      icon: BookOpenIcon,
      color: 'text-purple-400',
      bg: 'bg-purple-500/10',
    },
  ]

  return (
    <div className="min-h-screen bg-dark-900 p-6 lg:p-8">
      {/* Welcome */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-dark-100">
          Welcome back, {profile?.full_name || 'Coach'}
        </h1>
        <p className="mt-1 text-dark-400">
          Here is an overview of your coaching activity.
        </p>
      </div>

      {/* Stat Cards */}
      <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {statCards.map((card) => (
          <div
            key={card.label}
            className="flex items-center gap-4 rounded-xl border border-dark-700 bg-dark-800 p-5"
          >
            <div className={`rounded-lg p-3 ${card.bg}`}>
              <card.icon className={`h-6 w-6 ${card.color}`} />
            </div>
            <div>
              <p className="text-sm text-dark-400">{card.label}</p>
              <p className="text-2xl font-semibold text-dark-100">{card.value}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Recent Activity */}
        <div className="rounded-xl border border-dark-700 bg-dark-800 p-6">
          <div className="mb-4 flex items-center gap-2">
            <ClockIcon className="h-5 w-5 text-primary-500" />
            <h2 className="text-lg font-semibold text-dark-100">Recent Activity</h2>
          </div>

          {recentLogs.length === 0 ? (
            <p className="text-sm text-dark-400">
              No recent workout logs from your clients yet.
            </p>
          ) : (
            <div className="space-y-3">
              {recentLogs.map((log) => (
                <div
                  key={log.id}
                  className="flex items-start justify-between rounded-lg bg-dark-700/50 p-3"
                >
                  <div>
                    <p className="font-medium text-dark-100">
                      {log.profiles?.full_name || 'Unknown Client'}
                    </p>
                    <p className="text-sm text-dark-400">
                      {log.workout_days?.workout_plans?.name} &mdash;{' '}
                      {log.workout_days?.name}
                    </p>
                    {log.notes && (
                      <p className="mt-1 text-xs text-dark-500">{log.notes}</p>
                    )}
                  </div>
                  <div className="text-right">
                    {log.score != null && (
                      <span className="flex items-center gap-1 text-sm font-semibold text-primary-400">
                        <ArrowTrendingUpIcon className="h-4 w-4" />
                        {log.score}
                      </span>
                    )}
                    <p className="text-xs text-dark-500">
                      {new Date(log.completed_at).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Quick Actions */}
        <div className="rounded-xl border border-dark-700 bg-dark-800 p-6">
          <div className="mb-4 flex items-center gap-2">
            <PlusCircleIcon className="h-5 w-5 text-primary-500" />
            <h2 className="text-lg font-semibold text-dark-100">Quick Actions</h2>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {[
              {
                label: 'Add Client',
                href: '/trainer/clients',
                icon: UserGroupIcon,
                desc: 'Invite a new client',
              },
              {
                label: 'Create Workout',
                href: '/trainer/workouts',
                icon: ClipboardDocumentListIcon,
                desc: 'Build a workout plan',
              },
              {
                label: 'Create Meal Plan',
                href: '/trainer/nutrition',
                icon: BookOpenIcon,
                desc: 'Design a nutrition plan',
              },
              {
                label: 'Exercise Library',
                href: '/trainer/exercises',
                icon: ArrowTrendingUpIcon,
                desc: 'Manage your exercises',
              },
            ].map((action) => (
              <a
                key={action.label}
                href={action.href}
                className="flex items-center gap-3 rounded-lg border border-dark-600 bg-dark-700/50 p-4 transition-colors hover:border-primary-500/50 hover:bg-dark-700"
              >
                <action.icon className="h-5 w-5 text-primary-500" />
                <div>
                  <p className="text-sm font-medium text-dark-100">{action.label}</p>
                  <p className="text-xs text-dark-400">{action.desc}</p>
                </div>
              </a>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
