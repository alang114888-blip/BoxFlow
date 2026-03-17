import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'

const COLORS = ['#7c3bed', '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#06b6d4']
const DAYS_ENUM = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

function getMonday(d) {
  const date = new Date(d)
  const day = date.getDay()
  const diff = date.getDate() - day + (day === 0 ? -6 : 1)
  date.setHours(0, 0, 0, 0)
  date.setDate(diff)
  return date
}

function isSameDay(a, b) {
  return a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
}

function formatDate(date) {
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function getMonthGrid(year, month) {
  const firstDay = new Date(year, month, 1)
  let startOffset = firstDay.getDay() - 1
  if (startOffset < 0) startOffset = 6
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const totalCells = Math.ceil((startOffset + daysInMonth) / 7) * 7
  const cells = []
  for (let i = 0; i < totalCells; i++) {
    const dayNum = i - startOffset + 1
    if (dayNum < 1 || dayNum > daysInMonth) {
      cells.push(null)
    } else {
      cells.push(new Date(year, month, dayNum))
    }
  }
  return cells
}

export default function Calendar() {
  const { profile } = useAuth()
  const navigate = useNavigate()

  const [view, setView] = useState('week')
  const [currentDate, setCurrentDate] = useState(() => {
    const d = new Date()
    d.setHours(0, 0, 0, 0)
    return d
  })
  const [clients, setClients] = useState([])
  const [plans, setPlans] = useState([])
  const [loading, setLoading] = useState(true)
  const [filterClient, setFilterClient] = useState('all')
  const [expandedDay, setExpandedDay] = useState(null)

  const today = useMemo(() => {
    const d = new Date()
    d.setHours(0, 0, 0, 0)
    return d
  }, [])

  useEffect(() => {
    if (!profile) return
    fetchData()
  }, [profile])

  async function fetchData() {
    setLoading(true)
    try {
      const [clientsRes, plansRes] = await Promise.all([
        supabase
          .from('trainer_clients')
          .select('client_id, profiles:client_id(id, full_name)')
          .eq('trainer_id', profile.id)
          .eq('invite_accepted', true),
        supabase
          .from('workout_plans')
          .select('id, name, client_id, start_date, workout_days(id, day_of_week, name)')
          .eq('trainer_id', profile.id)
          .eq('is_active', true),
      ])

      if (clientsRes.data) setClients(clientsRes.data)
      if (plansRes.data) setPlans(plansRes.data)
    } catch (err) {
      console.error('Calendar fetch error:', err)
    } finally {
      setLoading(false)
    }
  }

  const clientColorMap = useMemo(() => {
    const map = {}
    clients.forEach((c, i) => {
      map[c.client_id] = COLORS[i % COLORS.length]
    })
    return map
  }, [clients])

  const clientNameMap = useMemo(() => {
    const map = {}
    clients.forEach(c => {
      map[c.client_id] = c.profiles?.full_name || 'Unknown'
    })
    return map
  }, [clients])

  // Group workout_days by day_of_week
  const workoutsByDay = useMemo(() => {
    const map = {}
    DAYS_ENUM.forEach(d => { map[d] = [] })
    plans.forEach(plan => {
      if (filterClient !== 'all' && plan.client_id !== filterClient) return
      ;(plan.workout_days || []).forEach(wd => {
        if (map[wd.day_of_week]) {
          map[wd.day_of_week].push({
            ...wd,
            planName: plan.name,
            clientId: plan.client_id,
            clientName: clientNameMap[plan.client_id] || 'Unassigned',
            color: clientColorMap[plan.client_id] || COLORS[0],
          })
        }
      })
    })
    return map
  }, [plans, filterClient, clientNameMap, clientColorMap])

  // Week dates
  const weekDates = useMemo(() => {
    const monday = getMonday(currentDate)
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(monday)
      d.setDate(monday.getDate() + i)
      return d
    })
  }, [currentDate])

  // Month grid
  const monthCells = useMemo(() => {
    return getMonthGrid(currentDate.getFullYear(), currentDate.getMonth())
  }, [currentDate])

  function navigatePrev() {
    setCurrentDate(prev => {
      const d = new Date(prev)
      if (view === 'week') d.setDate(d.getDate() - 7)
      else d.setMonth(d.getMonth() - 1)
      return d
    })
    setExpandedDay(null)
  }

  function navigateNext() {
    setCurrentDate(prev => {
      const d = new Date(prev)
      if (view === 'week') d.setDate(d.getDate() + 7)
      else d.setMonth(d.getMonth() + 1)
      return d
    })
    setExpandedDay(null)
  }

  function goToday() {
    const d = new Date()
    d.setHours(0, 0, 0, 0)
    setCurrentDate(d)
    setExpandedDay(null)
  }

  function getWorkoutsForDate(date) {
    if (!date) return []
    const dayEnum = DAYS_ENUM[((date.getDay() + 6) % 7)]
    return workoutsByDay[dayEnum] || []
  }

  const headerLabel = useMemo(() => {
    if (view === 'week') {
      const start = weekDates[0]
      const end = weekDates[6]
      if (start.getMonth() === end.getMonth()) {
        return `${start.toLocaleDateString('en-US', { month: 'long' })} ${start.getDate()}\u2013${end.getDate()}, ${start.getFullYear()}`
      }
      return `${formatDate(start)} \u2013 ${formatDate(end)}, ${end.getFullYear()}`
    }
    return currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
  }, [view, currentDate, weekDates])

  const isThisWeek = isSameDay(getMonday(today), getMonday(currentDate))
  const isThisMonth = today.getMonth() === currentDate.getMonth() && today.getFullYear() === currentDate.getFullYear()
  const showTodayBtn = view === 'week' ? !isThisWeek : !isThisMonth

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#0f0a19', fontFamily: 'Lexend, sans-serif' }}>
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-transparent" style={{ borderTopColor: '#7c3bed' }} />
      </div>
    )
  }

  return (
    <div className="min-h-screen p-4 md:p-6" style={{ background: '#0f0a19', fontFamily: 'Lexend, sans-serif', color: '#e2e8f0' }}>
      {/* Header */}
      <div className="flex flex-col gap-4 mb-6">
        <div className="flex items-center justify-between">
          <h1 className="text-xl md:text-2xl font-bold text-white">Calendar</h1>

          {/* View toggle */}
          <div className="flex rounded-lg overflow-hidden" style={{ background: '#1a1225' }}>
            <button
              onClick={() => { setView('week'); setExpandedDay(null) }}
              className="px-3 py-1.5 text-xs font-semibold transition-colors"
              style={{
                background: view === 'week' ? '#7c3bed' : 'transparent',
                color: view === 'week' ? '#fff' : '#94a3b8',
              }}
            >
              Week
            </button>
            <button
              onClick={() => { setView('month'); setExpandedDay(null) }}
              className="px-3 py-1.5 text-xs font-semibold transition-colors"
              style={{
                background: view === 'month' ? '#7c3bed' : 'transparent',
                color: view === 'month' ? '#fff' : '#94a3b8',
              }}
            >
              Month
            </button>
          </div>
        </div>

        {/* Navigation + Filter row */}
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <button
              onClick={navigatePrev}
              className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/10 transition-colors"
              style={{ background: '#1a1225' }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 18, color: '#94a3b8' }}>chevron_left</span>
            </button>

            {showTodayBtn && (
              <button
                onClick={goToday}
                className="px-3 py-1.5 text-xs font-semibold rounded-lg hover:bg-white/10 transition-colors"
                style={{ background: '#1a1225', color: '#7c3bed' }}
              >
                Today
              </button>
            )}

            <span className="text-sm font-semibold text-white whitespace-nowrap">{headerLabel}</span>

            <button
              onClick={navigateNext}
              className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/10 transition-colors"
              style={{ background: '#1a1225' }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 18, color: '#94a3b8' }}>chevron_right</span>
            </button>
          </div>

          {/* Client filter */}
          <select
            value={filterClient}
            onChange={e => setFilterClient(e.target.value === 'all' ? 'all' : e.target.value)}
            className="text-xs rounded-lg px-3 py-2 border-none outline-none cursor-pointer"
            style={{ background: '#1a1225', color: '#e2e8f0', fontFamily: 'Lexend, sans-serif' }}
          >
            <option value="all">All Clients</option>
            {clients.map(c => (
              <option key={c.client_id} value={c.client_id}>
                {c.profiles?.full_name || 'Unknown'}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Week View */}
      {view === 'week' && (
        <div className="overflow-x-auto -mx-4 px-4 md:mx-0 md:px-0">
          <div className="grid grid-cols-7 gap-2" style={{ minWidth: 700 }}>
            {weekDates.map((date, i) => {
              const isToday = isSameDay(date, today)
              const workouts = getWorkoutsForDate(date)
              return (
                <div
                  key={i}
                  className="rounded-xl p-2 min-h-[200px] flex flex-col"
                  style={{
                    background: '#1a1225',
                    border: isToday ? '1px solid rgba(124, 59, 237, 0.3)' : '1px solid transparent',
                  }}
                >
                  {/* Column header */}
                  <div className="text-center mb-2 pb-2" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                    <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                      {DAY_LABELS[i]}
                    </div>
                    <div
                      className="text-sm font-semibold mt-0.5 inline-flex items-center justify-center w-7 h-7 rounded-full"
                      style={{
                        background: isToday ? '#7c3bed' : 'transparent',
                        color: isToday ? '#fff' : '#cbd5e1',
                      }}
                    >
                      {date.getDate()}
                    </div>
                  </div>

                  {/* Workout cards */}
                  <div className="flex-1 space-y-1">
                    {workouts.length === 0 && (
                      <p className="text-[10px] text-slate-600 text-center mt-4">No workouts</p>
                    )}
                    {workouts.map((w, j) => (
                      <button
                        key={w.id || j}
                        onClick={() => navigate('/trainer/workouts')}
                        className="w-full text-left rounded-lg p-2 text-xs mb-1 transition-opacity hover:opacity-80"
                        style={{
                          background: `${w.color}22`,
                          borderLeft: `3px solid ${w.color}`,
                          boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
                        }}
                      >
                        <div className="font-bold text-white truncate" style={{ fontSize: 11 }}>
                          {w.clientName}
                        </div>
                        <div className="text-slate-400 truncate" style={{ fontSize: 10 }}>
                          {w.planName}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Month View */}
      {view === 'month' && (
        <div>
          {/* Day headers */}
          <div className="grid grid-cols-7 gap-1 mb-1">
            {DAY_LABELS.map(label => (
              <div key={label} className="text-[10px] font-bold text-slate-500 uppercase text-center py-1 tracking-wider">
                {label}
              </div>
            ))}
          </div>

          {/* Month grid */}
          <div className="grid grid-cols-7 gap-1">
            {monthCells.map((date, i) => {
              if (!date) {
                return <div key={i} className="aspect-square p-1 rounded-lg" style={{ background: '#1a1225', opacity: 0.3 }} />
              }
              const isToday = isSameDay(date, today)
              const isPast = date < today && !isToday
              const workouts = getWorkoutsForDate(date)
              const isExpanded = expandedDay && isSameDay(expandedDay, date)
              const uniqueClients = [...new Map(workouts.map(w => [w.clientId, w])).values()]

              return (
                <div
                  key={i}
                  className="aspect-square p-1 rounded-lg cursor-pointer transition-all hover:ring-1 hover:ring-white/10 relative flex flex-col"
                  style={{
                    background: '#1a1225',
                    opacity: isPast ? 0.5 : 1,
                    ring: isToday ? '2px solid #7c3bed' : undefined,
                    boxShadow: isToday ? 'inset 0 0 0 2px rgba(124, 59, 237, 0.4)' : undefined,
                  }}
                  onClick={() => setExpandedDay(isExpanded ? null : date)}
                >
                  <div
                    className="text-xs font-semibold mb-1 w-6 h-6 flex items-center justify-center rounded-full mx-auto"
                    style={{
                      background: isToday ? '#7c3bed' : 'transparent',
                      color: isToday ? '#fff' : '#cbd5e1',
                    }}
                  >
                    {date.getDate()}
                  </div>

                  {/* Dots */}
                  <div className="flex items-center justify-center gap-0.5 flex-wrap">
                    {uniqueClients.slice(0, 3).map((w, j) => (
                      <div
                        key={j}
                        className="w-1.5 h-1.5 rounded-full"
                        style={{ background: w.color }}
                      />
                    ))}
                  </div>
                  {uniqueClients.length > 3 && (
                    <div className="text-[8px] text-slate-500 text-center mt-0.5">
                      +{uniqueClients.length - 3} more
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {/* Expanded day detail */}
          {expandedDay && (
            <div
              className="mt-3 rounded-xl p-4"
              style={{ background: '#1a1225', border: '1px solid rgba(124, 59, 237, 0.2)' }}
            >
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-bold text-white">
                  {expandedDay.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
                </h3>
                <button
                  onClick={() => setExpandedDay(null)}
                  className="w-6 h-6 flex items-center justify-center rounded-full hover:bg-white/10"
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 16, color: '#94a3b8' }}>close</span>
                </button>
              </div>

              {getWorkoutsForDate(expandedDay).length === 0 ? (
                <p className="text-xs text-slate-500">No workouts scheduled</p>
              ) : (
                <div className="space-y-2">
                  {getWorkoutsForDate(expandedDay).map((w, j) => (
                    <button
                      key={w.id || j}
                      onClick={() => navigate('/trainer/workouts')}
                      className="w-full text-left rounded-lg p-3 transition-opacity hover:opacity-80 flex items-center gap-3"
                      style={{ background: `${w.color}15` }}
                    >
                      <div className="w-1 h-8 rounded-full" style={{ background: w.color }} />
                      <div className="min-w-0 flex-1">
                        <div className="font-bold text-white text-xs truncate">{w.clientName}</div>
                        <div className="text-slate-400 text-[10px] truncate">{w.planName} &middot; {w.day_of_week}</div>
                      </div>
                      <span className="material-symbols-outlined" style={{ fontSize: 16, color: '#64748b' }}>chevron_right</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Empty state */}
      {plans.length === 0 && !loading && (
        <div className="text-center py-16">
          <span className="material-symbols-outlined mb-3" style={{ fontSize: 48, color: '#334155' }}>calendar_month</span>
          <p className="text-sm text-slate-500 mb-1">No active workout plans</p>
          <p className="text-xs text-slate-600">Create workout plans to see them here</p>
        </div>
      )}
    </div>
  )
}
