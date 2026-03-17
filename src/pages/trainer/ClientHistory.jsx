import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { supabase } from '../../lib/supabase'
import { format } from 'date-fns'

const TABS = [
  { id: 'timeline', label: 'Timeline', icon: 'timeline' },
  { id: 'checkins', label: 'Check-ins', icon: 'fact_check' },
  { id: 'prs', label: 'PRs', icon: 'emoji_events' },
  { id: 'completions', label: 'Completions', icon: 'task_alt' },
]

export default function ClientHistory() {
  const { clientId } = useParams()
  const navigate = useNavigate()
  const { profile } = useAuth()
  const [activeTab, setActiveTab] = useState('timeline')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [clientName, setClientName] = useState('')

  const [checkins, setCheckins] = useState([])
  const [completions, setCompletions] = useState([])
  const [prs, setPrs] = useState([])
  const [feedbackMap, setFeedbackMap] = useState({})
  const [savingFeedback, setSavingFeedback] = useState(null)

  const fetchData = useCallback(async () => {
    if (!profile?.id || !clientId) return
    try {
      setLoading(true)
      setError(null)

      const [profileRes, checkinsRes, completionsRes, prsRes] = await Promise.all([
        supabase
          .from('profiles')
          .select('full_name, email')
          .eq('id', clientId)
          .single(),
        supabase
          .from('weekly_checkins')
          .select('*')
          .eq('client_id', clientId)
          .eq('trainer_id', profile.id)
          .order('week_date', { ascending: false }),
        supabase
          .from('workout_completions')
          .select(`
            *,
            workout_days ( id, name, day_of_week,
              workout_plans ( name )
            )
          `)
          .eq('client_id', clientId)
          .order('created_at', { ascending: false }),
        supabase
          .from('client_prs')
          .select(`
            *,
            exercises ( name, category )
          `)
          .eq('client_id', clientId)
          .order('date_achieved', { ascending: false }),
      ])

      if (profileRes.data) {
        setClientName(profileRes.data.full_name || profileRes.data.email || 'Unknown')
      }

      setCheckins(checkinsRes.data || [])
      setCompletions(completionsRes.data || [])
      setPrs(prsRes.data || [])

      // Init feedback map
      const fbMap = {}
      ;(completionsRes.data || []).forEach((c) => {
        fbMap[c.id] = c.trainer_feedback || ''
      })
      setFeedbackMap(fbMap)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [profile?.id, clientId])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  async function saveFeedback(completionId) {
    try {
      setSavingFeedback(completionId)
      const { error: updateErr } = await supabase
        .from('workout_completions')
        .update({ trainer_feedback: feedbackMap[completionId] || null, updated_at: new Date().toISOString() })
        .eq('id', completionId)

      if (updateErr) throw updateErr
      await fetchData()
    } catch (err) {
      setError(err.message)
    } finally {
      setSavingFeedback(null)
    }
  }

  function getTrend(current, previous) {
    if (previous == null || current == null) return null
    if (current > previous) return 'up'
    if (current < previous) return 'down'
    return 'same'
  }

  function TrendArrow({ trend }) {
    if (!trend || trend === 'same') return null
    return (
      <span className={`material-symbols-outlined text-sm ${trend === 'up' ? 'text-green-400' : 'text-red-400'}`}>
        {trend === 'up' ? 'arrow_upward' : 'arrow_downward'}
      </span>
    )
  }

  // Build timeline
  function buildTimeline() {
    const items = []

    checkins.forEach((c) => {
      items.push({
        type: 'checkin',
        date: c.week_date,
        sortDate: new Date(c.week_date),
        title: 'Weekly Check-in',
        detail: `Weight: ${c.weight_kg || '-'} kg | Energy: ${c.energy}/10 | Sleep: ${c.sleep}/10`,
        icon: 'fact_check',
        color: 'text-blue-400 bg-blue-500/10',
      })
    })

    completions.forEach((c) => {
      const dayName = c.workout_days?.name || c.workout_days?.day_of_week || 'Workout'
      const isDone = c.status === 'done'
      items.push({
        type: 'completion',
        date: c.completed_at || c.created_at,
        sortDate: new Date(c.completed_at || c.created_at),
        title: `${dayName} - ${isDone ? 'Completed' : 'Skipped'}`,
        detail: c.client_notes || '',
        icon: isDone ? 'check_circle' : 'cancel',
        color: isDone ? 'text-green-400 bg-green-500/10' : 'text-red-400 bg-red-500/10',
      })
    })

    prs.forEach((pr) => {
      items.push({
        type: 'pr',
        date: pr.date_achieved,
        sortDate: new Date(pr.date_achieved),
        title: `PR: ${pr.exercises?.name || 'Unknown'}`,
        detail: `${pr.weight_kg} kg`,
        icon: 'emoji_events',
        color: 'text-[#7c3bed] bg-[#7c3bed]/10',
      })
    })

    items.sort((a, b) => b.sortDate - a.sortDate)
    return items
  }

  // Group PRs by exercise
  function groupPrsByExercise() {
    const groups = {}
    prs.forEach((pr) => {
      const name = pr.exercises?.name || 'Unknown'
      if (!groups[name]) {
        groups[name] = { name, category: pr.exercises?.category, history: [] }
      }
      groups[name].history.push(pr)
    })
    return Object.values(groups)
  }

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-dark-600 border-t-primary-500" />
      </div>
    )
  }

  const timeline = buildTimeline()
  const prGroups = groupPrsByExercise()

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6" style={{ fontFamily: 'Lexend, sans-serif' }}>
      {/* Header */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => navigate('/trainer/clients')}
          className="flex items-center justify-center rounded-xl bg-[#1a1426] border border-[#7c3bed]/10 p-2 text-gray-400 hover:text-gray-200 transition-colors"
        >
          <span className="material-symbols-outlined">arrow_back</span>
        </button>
        <div>
          <h1 className="text-2xl font-bold text-gray-100">{clientName}</h1>
          <p className="text-sm text-gray-500">Client History</p>
        </div>
      </div>

      {error && (
        <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-400">
          {error}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 rounded-2xl bg-[#1a1426] border border-[#7c3bed]/10 p-1.5">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
              activeTab === tab.id
                ? 'bg-[#7c3bed] text-white shadow-lg shadow-[#7c3bed]/20'
                : 'text-gray-400 hover:text-gray-200 hover:bg-[#251a35]'
            }`}
          >
            <span className="material-symbols-outlined text-lg">{tab.icon}</span>
            <span className="hidden sm:inline">{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Timeline Tab */}
      {activeTab === 'timeline' && (
        <div className="space-y-3">
          {timeline.length === 0 ? (
            <div className="rounded-2xl border border-[#7c3bed]/10 bg-[#1a1426] p-12 text-center">
              <span className="material-symbols-outlined text-4xl text-gray-600 block mb-3">history</span>
              <p className="text-gray-400">No activity recorded yet.</p>
            </div>
          ) : (
            timeline.map((item, i) => (
              <div key={`${item.type}-${i}`} className="flex gap-4 rounded-2xl border border-[#7c3bed]/10 bg-[#1a1426] p-4">
                <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${item.color}`}>
                  <span className="material-symbols-outlined text-xl">{item.icon}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-100">{item.title}</p>
                  {item.detail && <p className="text-sm text-gray-400 mt-0.5">{item.detail}</p>}
                </div>
                <p className="shrink-0 text-xs text-gray-500 mt-1">
                  {format(item.sortDate, 'MMM d, yyyy')}
                </p>
              </div>
            ))
          )}
        </div>
      )}

      {/* Check-ins Tab */}
      {activeTab === 'checkins' && (
        <div className="rounded-2xl border border-[#7c3bed]/10 bg-[#1a1426] overflow-hidden">
          {checkins.length === 0 ? (
            <div className="p-12 text-center">
              <span className="material-symbols-outlined text-4xl text-gray-600 block mb-3">fact_check</span>
              <p className="text-gray-400">No check-ins submitted yet.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead>
                  <tr className="border-b border-[#7c3bed]/10 text-gray-400">
                    <th className="px-5 py-3 font-medium">Week</th>
                    <th className="px-5 py-3 font-medium">Weight</th>
                    <th className="px-5 py-3 font-medium">Energy</th>
                    <th className="px-5 py-3 font-medium">Sleep</th>
                    <th className="px-5 py-3 font-medium">Stress</th>
                    <th className="px-5 py-3 font-medium">Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {checkins.map((ci, idx) => {
                    const prev = checkins[idx + 1]
                    return (
                      <tr key={ci.id} className="border-b border-[#7c3bed]/5 last:border-0">
                        <td className="px-5 py-3 text-gray-200 whitespace-nowrap">
                          {format(new Date(ci.week_date), 'MMM d, yyyy')}
                        </td>
                        <td className="px-5 py-3 text-gray-200">
                          <span className="flex items-center gap-1">
                            {ci.weight_kg || '-'}
                            <TrendArrow trend={getTrend(ci.weight_kg, prev?.weight_kg)} />
                          </span>
                        </td>
                        <td className="px-5 py-3 text-gray-200">
                          <span className="flex items-center gap-1">
                            {ci.energy}/10
                            <TrendArrow trend={getTrend(ci.energy, prev?.energy)} />
                          </span>
                        </td>
                        <td className="px-5 py-3 text-gray-200">
                          <span className="flex items-center gap-1">
                            {ci.sleep}/10
                            <TrendArrow trend={getTrend(ci.sleep, prev?.sleep)} />
                          </span>
                        </td>
                        <td className="px-5 py-3 text-gray-200">
                          <span className="flex items-center gap-1">
                            {ci.stress}/10
                            <TrendArrow trend={getTrend(ci.stress, prev?.stress)} />
                          </span>
                        </td>
                        <td className="px-5 py-3 text-gray-400 max-w-[200px] truncate">
                          {ci.notes || '-'}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* PRs Tab */}
      {activeTab === 'prs' && (
        <div className="space-y-4">
          {prGroups.length === 0 ? (
            <div className="rounded-2xl border border-[#7c3bed]/10 bg-[#1a1426] p-12 text-center">
              <span className="material-symbols-outlined text-4xl text-gray-600 block mb-3">emoji_events</span>
              <p className="text-gray-400">No personal records yet.</p>
            </div>
          ) : (
            prGroups.map((group) => (
              <div key={group.name} className="rounded-2xl border border-[#7c3bed]/10 bg-[#1a1426] p-5">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h3 className="font-semibold text-gray-100">{group.name}</h3>
                    {group.category && (
                      <span className="text-xs text-gray-500">{group.category}</span>
                    )}
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-gray-500">Current PR</p>
                    <p className="text-lg font-bold text-[#7c3bed]">{group.history[0]?.weight_kg} kg</p>
                  </div>
                </div>
                {group.history.length > 1 && (
                  <div className="border-t border-[#7c3bed]/10 pt-3 mt-2">
                    <p className="text-xs text-gray-500 mb-2">History</p>
                    <div className="space-y-1.5">
                      {group.history.map((pr, i) => (
                        <div key={pr.id} className="flex items-center justify-between text-sm">
                          <span className="text-gray-400">
                            {format(new Date(pr.date_achieved), 'MMM d, yyyy')}
                          </span>
                          <span className={`font-medium ${i === 0 ? 'text-[#7c3bed]' : 'text-gray-300'}`}>
                            {pr.weight_kg} kg
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {/* Completions Tab */}
      {activeTab === 'completions' && (
        <div className="space-y-3">
          {completions.length === 0 ? (
            <div className="rounded-2xl border border-[#7c3bed]/10 bg-[#1a1426] p-12 text-center">
              <span className="material-symbols-outlined text-4xl text-gray-600 block mb-3">task_alt</span>
              <p className="text-gray-400">No workout completions yet.</p>
            </div>
          ) : (
            completions.map((comp) => {
              const dayName = comp.workout_days?.name || comp.workout_days?.day_of_week || 'Workout'
              const planName = comp.workout_days?.workout_plans?.name
              const isDone = comp.status === 'done'
              const isSkipped = comp.status === 'skipped'

              return (
                <div key={comp.id} className="rounded-2xl border border-[#7c3bed]/10 bg-[#1a1426] p-5 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-gray-100">{dayName}</p>
                      {planName && <p className="text-xs text-gray-500">{planName}</p>}
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold ${
                        isDone
                          ? 'bg-green-500/10 text-green-400 border border-green-500/20'
                          : isSkipped
                          ? 'bg-red-500/10 text-red-400 border border-red-500/20'
                          : 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/20'
                      }`}>
                        <span className="material-symbols-outlined text-sm">
                          {isDone ? 'check_circle' : isSkipped ? 'cancel' : 'pending'}
                        </span>
                        {comp.status}
                      </span>
                      <span className="text-xs text-gray-500">
                        {format(new Date(comp.completed_at || comp.created_at), 'MMM d, yyyy')}
                      </span>
                    </div>
                  </div>

                  {comp.client_notes && (
                    <div className="rounded-xl bg-[#0f0a19] border border-[#7c3bed]/10 p-3">
                      <p className="text-xs text-gray-500 mb-1">Client Notes</p>
                      <p className="text-sm text-gray-300">{comp.client_notes}</p>
                    </div>
                  )}

                  {/* Trainer Feedback */}
                  <div className="space-y-2">
                    <label className="text-xs text-gray-500">Trainer Feedback</label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={feedbackMap[comp.id] || ''}
                        onChange={(e) => setFeedbackMap((prev) => ({ ...prev, [comp.id]: e.target.value }))}
                        placeholder="Add feedback..."
                        className="flex-1 rounded-xl border border-[#7c3bed]/10 bg-[#0f0a19] px-4 py-2 text-sm text-gray-200 placeholder-gray-600 focus:border-[#7c3bed]/50 focus:outline-none"
                      />
                      <button
                        onClick={() => saveFeedback(comp.id)}
                        disabled={savingFeedback === comp.id}
                        className="flex items-center gap-1 rounded-xl bg-[#7c3bed] px-4 py-2 text-sm font-medium text-white hover:bg-[#6a2fd4] disabled:opacity-50 transition-colors"
                      >
                        {savingFeedback === comp.id ? (
                          <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                        ) : (
                          <span className="material-symbols-outlined text-base">save</span>
                        )}
                        Save
                      </button>
                    </div>
                  </div>
                </div>
              )
            })
          )}
        </div>
      )}
    </div>
  )
}
