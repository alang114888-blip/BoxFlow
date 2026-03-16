import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import {
  TrophyIcon,
  FunnelIcon,
  CalendarDaysIcon,
} from '@heroicons/react/24/outline'

export default function Leaderboard() {
  const { profile } = useAuth()
  const [leaderboard, setLeaderboard] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // Filters
  const [workoutPlans, setWorkoutPlans] = useState([])
  const [selectedPlan, setSelectedPlan] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

  useEffect(() => {
    if (!profile) return
    fetchWorkoutPlans()
    fetchLeaderboard()
  }, [profile])

  useEffect(() => {
    if (!profile) return
    fetchLeaderboard()
  }, [selectedPlan, dateFrom, dateTo])

  async function fetchWorkoutPlans() {
    const { data } = await supabase
      .from('workout_plans')
      .select('id, name')
      .eq('trainer_id', profile.id)
      .order('name')

    setWorkoutPlans(data || [])
  }

  async function fetchLeaderboard() {
    try {
      setLoading(true)
      setError(null)

      // Get trainer's client IDs
      const { data: clientLinks } = await supabase
        .from('trainer_clients')
        .select('client_id')
        .eq('trainer_id', profile.id)
        .eq('invite_accepted', true)

      const clientIds = (clientLinks || []).map((c) => c.client_id).filter(Boolean)

      if (clientIds.length === 0) {
        setLeaderboard([])
        setLoading(false)
        return
      }

      // Build query for workout_logs
      let query = supabase
        .from('workout_logs')
        .select(`
          id,
          client_id,
          score,
          completed_at,
          workout_days!inner (
            id,
            plan_id,
            workout_plans!inner ( id, name, trainer_id )
          )
        `)
        .in('client_id', clientIds)
        .eq('workout_days.workout_plans.trainer_id', profile.id)

      if (selectedPlan) {
        query = query.eq('workout_days.workout_plans.id', selectedPlan)
      }

      if (dateFrom) {
        query = query.gte('completed_at', dateFrom)
      }
      if (dateTo) {
        // Add one day to include the full end date
        const endDate = new Date(dateTo)
        endDate.setDate(endDate.getDate() + 1)
        query = query.lt('completed_at', endDate.toISOString().split('T')[0])
      }

      const { data: logs, error: logsErr } = await query

      if (logsErr) throw logsErr

      // Get client profiles
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name')
        .in('id', clientIds)

      const profileMap = {}
      ;(profiles || []).forEach((p) => {
        profileMap[p.id] = p.full_name
      })

      // Aggregate by client
      const clientStats = {}
      ;(logs || []).forEach((log) => {
        if (!clientStats[log.client_id]) {
          clientStats[log.client_id] = {
            client_id: log.client_id,
            client_name: profileMap[log.client_id] || 'Unknown',
            workouts_completed: 0,
            total_score: 0,
            scores: [],
          }
        }
        const stat = clientStats[log.client_id]
        stat.workouts_completed += 1
        const score = log.score || 0
        stat.total_score += score
        stat.scores.push(score)
      })

      // Calculate averages and sort
      const ranked = Object.values(clientStats)
        .map((stat) => ({
          ...stat,
          average_score:
            stat.scores.length > 0
              ? Math.round(
                  (stat.total_score / stat.scores.length) * 10
                ) / 10
              : 0,
        }))
        .sort((a, b) => b.total_score - a.total_score)

      setLeaderboard(ranked)
    } catch (err) {
      console.error('Fetch leaderboard error:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  function getRankStyle(rank) {
    if (rank === 1) return 'text-yellow-400'
    if (rank === 2) return 'text-dark-300'
    if (rank === 3) return 'text-amber-600'
    return 'text-dark-400'
  }

  if (loading && leaderboard.length === 0) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-dark-600 border-t-primary-500" />
      </div>
    )
  }

  return (
    <div className="p-6 lg:p-8">
      <div className="mb-6 flex items-center gap-3">
        <TrophyIcon className="h-7 w-7 text-yellow-400" />
        <h1 className="text-2xl font-bold text-dark-100">Leaderboard</h1>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-400">
          {error}
        </div>
      )}

      {/* Filters */}
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end">
        <div>
          <label className="mb-1 flex items-center gap-1 text-xs text-dark-400">
            <FunnelIcon className="h-3.5 w-3.5" />
            Workout Plan
          </label>
          <select
            value={selectedPlan}
            onChange={(e) => setSelectedPlan(e.target.value)}
            className="rounded-lg border border-dark-600 bg-dark-800 px-3 py-2 text-sm text-dark-100 focus:border-primary-500 focus:outline-none"
          >
            <option value="">All Plans</option>
            {workoutPlans.map((wp) => (
              <option key={wp.id} value={wp.id}>
                {wp.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 flex items-center gap-1 text-xs text-dark-400">
            <CalendarDaysIcon className="h-3.5 w-3.5" />
            From
          </label>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="rounded-lg border border-dark-600 bg-dark-800 px-3 py-2 text-sm text-dark-100 focus:border-primary-500 focus:outline-none"
          />
        </div>
        <div>
          <label className="mb-1 flex items-center gap-1 text-xs text-dark-400">
            <CalendarDaysIcon className="h-3.5 w-3.5" />
            To
          </label>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="rounded-lg border border-dark-600 bg-dark-800 px-3 py-2 text-sm text-dark-100 focus:border-primary-500 focus:outline-none"
          />
        </div>
        {(selectedPlan || dateFrom || dateTo) && (
          <button
            onClick={() => {
              setSelectedPlan('')
              setDateFrom('')
              setDateTo('')
            }}
            className="rounded-lg border border-dark-600 px-3 py-2 text-sm text-dark-400 transition-colors hover:bg-dark-700 hover:text-dark-200"
          >
            Clear Filters
          </button>
        )}
      </div>

      {/* Leaderboard Table */}
      {leaderboard.length === 0 ? (
        <div className="rounded-xl border border-dark-700 bg-dark-800 p-12 text-center">
          <TrophyIcon className="mx-auto h-12 w-12 text-dark-500" />
          <p className="mt-3 text-dark-400">
            No workout data available yet. Leaderboard will populate as clients
            complete workouts.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-dark-700 bg-dark-800">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-dark-600 text-left text-xs uppercase tracking-wide text-dark-400">
                <th className="px-4 py-3 w-16">Rank</th>
                <th className="px-4 py-3">Client Name</th>
                <th className="px-4 py-3 text-center">Workouts Completed</th>
                <th className="px-4 py-3 text-center">Average Score</th>
                <th className="px-4 py-3 text-center">Total Score</th>
              </tr>
            </thead>
            <tbody>
              {leaderboard.map((entry, index) => {
                const rank = index + 1

                return (
                  <tr
                    key={entry.client_id}
                    className={`border-b border-dark-700/50 transition-colors hover:bg-dark-700/30 ${
                      rank <= 3 ? 'bg-dark-700/20' : ''
                    }`}
                  >
                    <td className="px-4 py-3">
                      <span
                        className={`text-lg font-bold ${getRankStyle(rank)}`}
                      >
                        {rank === 1 && (
                          <TrophyIcon className="mr-1 inline h-4 w-4 text-yellow-400" />
                        )}
                        {rank}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary-500/20 text-xs font-semibold text-primary-400">
                          {entry.client_name.charAt(0).toUpperCase()}
                        </div>
                        <span className="font-medium text-dark-100">
                          {entry.client_name}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center text-dark-200">
                      {entry.workouts_completed}
                    </td>
                    <td className="px-4 py-3 text-center text-dark-200">
                      {entry.average_score}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="font-semibold text-primary-400">
                        {Math.round(entry.total_score)}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {loading && leaderboard.length > 0 && (
        <div className="mt-4 flex justify-center">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-dark-600 border-t-primary-500" />
        </div>
      )}
    </div>
  )
}
