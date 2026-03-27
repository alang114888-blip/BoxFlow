import { useState, useEffect } from 'react'
import { useNavigate, useOutletContext } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import NutritionistHome from './NutritionistHome'
import { SkeletonDashboard } from '../../components/SkeletonLoader'
import AnimatedNumber from '../../components/AnimatedNumber'

function getMonday(d) {
  const date = new Date(d)
  const day = date.getDay()
  const diff = date.getDate() - day + (day === 0 ? -6 : 1)
  date.setHours(0, 0, 0, 0)
  date.setDate(diff)
  return date
}

export default function TrainerDashboard() {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const outletContext = useOutletContext() || {}
  const activeMode = outletContext.activeMode

  // All hooks must be declared before any early return
  const [stats, setStats] = useState({ clients: 0, workouts: 0, activity: 0 })
  const [loading, setLoading] = useState(true)
  const [clients, setClients] = useState([])
  const [alerts, setAlerts] = useState({
    skippedClients: [],
    noCheckinClients: [],
    checkedInClients: [],
    prClients: [],
  })
  const [expandedAlert, setExpandedAlert] = useState(null)
  const [clientCompletions, setClientCompletions] = useState({})
  const [dismissedAlerts, setDismissedAlerts] = useState(() => {
    try {
      const saved = sessionStorage.getItem('boxflow_dismissed_alerts')
      return saved ? JSON.parse(saved) : {}
    } catch { return {} }
  })

  useEffect(() => {
    if (!profile || activeMode === 'nutrition') return
    fetchDashboardData()
  }, [profile, activeMode])

  // Nutritionist mode → show NutritionistHome instead
  if (activeMode === 'nutrition') {
    return <NutritionistHome />
  }

  async function fetchStats() {
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
    const activity = clientCount > 0 ? Math.min(Math.round((workoutCount / clientCount) * 100), 100) : 0
    setStats({ clients: clientCount, workouts: workoutCount, activity })
  }

  async function fetchDashboardData() {
    try {
      setLoading(true)

      await fetchStats()

      // Fetch all accepted clients
      const { data: trainerClients } = await supabase
        .from('trainer_clients')
        .select('client_id, profiles!trainer_clients_client_id_fkey ( id, full_name, email, updated_at )')
        .eq('trainer_id', profile.id)
        .eq('invite_accepted', true)

      const clientsList = (trainerClients || []).map((tc) => ({
        id: tc.client_id,
        full_name: tc.profiles?.full_name || 'Unknown',
        email: tc.profiles?.email || '',
        updated_at: tc.profiles?.updated_at,
      }))
      setClients(clientsList)

      if (clientsList.length === 0) {
        setLoading(false)
        return
      }

      const clientIds = clientsList.map((c) => c.id)
      const monday = getMonday(new Date())
      const mondayISO = monday.toISOString().split('T')[0]
      const now = new Date()
      const sevenDaysAgo = new Date(now)
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

      // Fetch check-ins, workout completions, and PRs in parallel
      const [checkinsRes, completionsRes, prsRes] = await Promise.all([
        supabase
          .from('weekly_checkins')
          .select('client_id')
          .eq('trainer_id', profile.id)
          .gte('week_date', mondayISO),
        supabase
          .from('workout_completions')
          .select('client_id, status, completed_at')
          .in('client_id', clientIds)
          .gte('completed_at', mondayISO),
        supabase
          .from('client_prs')
          .select('client_id, weight_kg, updated_at, exercises ( name )')
          .in('client_id', clientIds)
          .gte('updated_at', monday.toISOString())
          .order('updated_at', { ascending: false }),
      ])

      // Process check-ins
      const checkedInIds = new Set((checkinsRes.data || []).map((c) => c.client_id))
      const checkedInClients = clientsList.filter((c) => checkedInIds.has(c.id))
      const noCheckinClients = clientsList.filter((c) => !checkedInIds.has(c.id))

      // Process skipped workouts
      const skippedCounts = {}
      ;(completionsRes.data || []).forEach((wc) => {
        if (wc.status === 'skipped') {
          skippedCounts[wc.client_id] = (skippedCounts[wc.client_id] || 0) + 1
        }
      })
      const skippedClients = clientsList.filter((c) => (skippedCounts[c.id] || 0) >= 2)

      // Process PRs
      const prDetails = {}
      ;(prsRes.data || []).forEach(p => {
        if (!prDetails[p.client_id]) prDetails[p.client_id] = []
        prDetails[p.client_id].push({
          exercise: p.exercises?.name || 'Unknown',
          weight: p.weight_kg,
        })
      })
      const prClients = clientsList
        .filter(c => prDetails[c.id])
        .map(c => ({ ...c, prInfo: prDetails[c.id] }))

      setAlerts({ skippedClients, noCheckinClients, checkedInClients, prClients })

      // Fetch last 7 days of completions for client cards
      const { data: recentCompletions } = await supabase
        .from('workout_completions')
        .select('client_id, status, completed_at')
        .in('client_id', clientIds)
        .gte('completed_at', sevenDaysAgo.toISOString().split('T')[0])
        .order('completed_at', { ascending: true })

      const completionsByClient = {}
      ;(recentCompletions || []).forEach((wc) => {
        if (!completionsByClient[wc.client_id]) completionsByClient[wc.client_id] = []
        completionsByClient[wc.client_id].push({ status: wc.status, date: wc.completed_at })
      })
      setClientCompletions(completionsByClient)
    } catch (err) {
      console.error('Dashboard data error:', err)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return <SkeletonDashboard />
  }

  const firstName = profile?.full_name?.split(' ')[0] || 'Coach'

  const statCards = [
    { label: 'Clients', value: stats.clients },
    { label: 'Plans', value: stats.workouts },
    { label: 'Activity', value: `${stats.activity}%` },
  ]

  const alertConfigs = [
    {
      key: 'skipped',
      icon: 'warning',
      label: `${alerts.skippedClients.length} client${alerts.skippedClients.length !== 1 ? 's' : ''} skipped 2+ workouts`,
      clients: alerts.skippedClients,
      color: 'text-red-400',
      bg: 'bg-red-500/10',
      border: 'border-red-500/20',
      show: alerts.skippedClients.length > 0,
    },
    {
      key: 'nocheckin',
      icon: 'event_busy',
      label: `${alerts.noCheckinClients.length} client${alerts.noCheckinClients.length !== 1 ? 's' : ''} haven't checked in`,
      clients: alerts.noCheckinClients,
      color: 'text-orange-400',
      bg: 'bg-orange-500/10',
      border: 'border-orange-500/20',
      show: alerts.noCheckinClients.length > 0,
    },
    {
      key: 'checkedin',
      icon: 'check_circle',
      label: `${alerts.checkedInClients.length} client${alerts.checkedInClients.length !== 1 ? 's' : ''} submitted check-in`,
      clients: alerts.checkedInClients,
      color: 'text-green-400',
      bg: 'bg-green-500/10',
      border: 'border-green-500/20',
      show: alerts.checkedInClients.length > 0,
    },
    {
      key: 'prs',
      icon: 'emoji_events',
      label: `${alerts.prClients.length} client${alerts.prClients.length !== 1 ? 's' : ''} hit new PRs`,
      clients: alerts.prClients,
      color: 'text-amber-400',
      bg: 'bg-purple-500/10',
      border: 'border-purple-500/20',
      show: alerts.prClients.length > 0,
    },
  ]

  function getStatusDots(clientId) {
    const completions = clientCompletions[clientId] || []
    const dots = []
    for (let i = 6; i >= 0; i--) {
      const d = new Date()
      d.setDate(d.getDate() - i)
      const dateStr = d.toISOString().split('T')[0]
      const match = completions.find((c) => c.completed_at?.startsWith(dateStr))
      if (match) {
        dots.push(match.status === 'done' ? 'done' : match.status === 'skipped' ? 'skipped' : 'pending')
      } else {
        dots.push('none')
      }
    }
    return dots
  }

  function dismissAlert(key) {
    const updated = { ...dismissedAlerts, [key]: Date.now() }
    setDismissedAlerts(updated)
    sessionStorage.setItem('boxflow_dismissed_alerts', JSON.stringify(updated))
  }

  const dotColors = {
    done: 'bg-green-400',
    skipped: 'bg-red-400',
    pending: 'bg-yellow-400',
    none: 'bg-slate-800',
  }

  return (
    <div className="font-[Lexend]">
      {/* Welcome Hero */}
      <div className="relative mb-5 overflow-hidden rounded-2xl bg-gradient-to-br from-primary to-primary-dark p-5">
        <div className="absolute -top-6 -right-6 h-24 w-24 rounded-full bg-white/10" />
        <div className="absolute -bottom-4 -left-4 h-16 w-16 rounded-full bg-white/5" />
        <div className="relative">
          <p className="text-sm text-white/70">Welcome back,</p>
          <h2 className="text-xl font-bold text-white">Coach {firstName},</h2>
          <p className="mt-1 text-sm text-white/60">
            {stats.clients} active client{stats.clients !== 1 ? 's' : ''} &middot; {stats.workouts} plan{stats.workouts !== 1 ? 's' : ''}
          </p>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="mb-5 grid grid-cols-3 gap-3">
        {statCards.map((s) => (
          <div key={s.label} className="rounded-2xl bg-[#1a1225] border border-primary/10 p-3 text-center">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">{s.label}</p>
            <p className="mt-1 text-2xl font-bold text-primary">{typeof s.value === 'number' ? <AnimatedNumber value={s.value} /> : s.value}</p>
          </div>
        ))}
      </div>

      {/* Smart Alerts */}
      {clients.length > 0 && (
        <div className="mb-5">
          <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-400">Smart Alerts</h3>
          <div className="space-y-2">
            {alertConfigs.filter((a) => a.show && !dismissedAlerts[a.key]).map((alert) => (
              <div key={alert.key} className={`rounded-2xl border ${alert.border} ${alert.bg} overflow-hidden`}>
                <button
                  onClick={() => setExpandedAlert(expandedAlert === alert.key ? null : alert.key)}
                  className="flex w-full items-center gap-3 p-3 text-left"
                >
                  <span className={`material-symbols-outlined text-xl ${alert.color}`}>{alert.icon}</span>
                  <span className={`flex-1 text-sm font-medium ${alert.color}`}>{alert.label}</span>
                  <span className={`material-symbols-outlined text-lg text-slate-400 transition-transform ${expandedAlert === alert.key ? 'rotate-180' : ''}`}>
                    expand_more
                  </span>
                  <span className="material-symbols-outlined text-lg text-slate-600 hover:text-white ml-1"
                    onClick={(e) => { e.stopPropagation(); dismissAlert(alert.key) }}>close</span>
                </button>
                {expandedAlert === alert.key && (
                  <div className="border-t border-white/5 px-3 pb-3">
                    {alert.clients.map((client) => (
                      <div key={client.id} className="flex items-center gap-2 py-1.5">
                        <div className="flex h-6 w-6 items-center justify-center rounded-full bg-white/10 text-[10px] font-bold text-white">
                          {client.full_name?.charAt(0)?.toUpperCase() || '?'}
                        </div>
                        <span className="text-xs text-slate-300 flex-1">{client.full_name}</span>
                        {alert.key === 'prs' && client.prInfo && (
                          <div className="flex flex-col items-end">
                            {client.prInfo.slice(0, 2).map((pr, i) => (
                              <span key={i} className="text-[10px] text-amber-400">{pr.exercise}: {pr.weight}kg</span>
                            ))}
                            {client.prInfo.length > 2 && (
                              <span className="text-[10px] text-slate-500">+{client.prInfo.length - 2} more</span>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
            {alertConfigs.every((a) => !a.show) && (
              <div className="rounded-2xl border border-primary/10 bg-[#1a1225] p-4 text-center">
                <span className="material-symbols-outlined mb-1 text-2xl text-slate-500">info</span>
                <p className="text-xs text-slate-400">No alerts this week</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Client Cards */}
      <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-400">Your Clients</h3>
      {clients.length === 0 ? (
        <div className="rounded-2xl border border-primary/10 bg-[#1a1225] p-6 text-center">
          <span className="material-symbols-outlined mb-2 text-3xl text-slate-500">group_off</span>
          <p className="text-sm text-slate-400">No clients yet</p>
          <button
            onClick={() => navigate('/trainer/clients')}
            className="mt-3 rounded-xl bg-primary/20 px-4 py-2 text-xs font-semibold text-primary"
          >
            Add Your First Client
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 stagger-list">
          {clients.map((client) => {
            const dots = getStatusDots(client.id)
            const checkedIn = alerts.checkedInClients.some((c) => c.id === client.id)
            const hasPR = alerts.prClients.some((c) => c.id === client.id)

            return (
              <button
                key={client.id}
                onClick={() => navigate(`/trainer/client-history/${client.id}`)}
                className="flex items-center gap-3 rounded-2xl border border-primary/10 bg-[#1a1225] p-3 text-left transition-colors hover:border-primary/30 active:scale-[0.98]"
              >
                {/* Avatar */}
                <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-primary/20 text-sm font-bold text-primary">
                  {client.full_name?.charAt(0)?.toUpperCase() || '?'}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="truncate text-sm font-semibold text-white">{client.full_name}</span>
                    {checkedIn && (
                      <span className="material-symbols-outlined text-sm text-green-400">check_circle</span>
                    )}
                    {hasPR && (
                      <span className="material-symbols-outlined text-sm text-amber-400">emoji_events</span>
                    )}
                  </div>
                  {/* Status dots - last 7 days */}
                  <div className="mt-1.5 flex gap-1">
                    {dots.map((status, i) => (
                      <div
                        key={i}
                        className={`h-1.5 w-1.5 rounded-full ${dotColors[status]}`}
                        title={status}
                      />
                    ))}
                  </div>
                </div>

                <span className="material-symbols-outlined text-lg text-slate-500">chevron_right</span>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
