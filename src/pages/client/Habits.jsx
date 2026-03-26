import { useState, useEffect } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { supabase } from '../../lib/supabase'
import { SkeletonList } from '../../components/SkeletonLoader'

const todayISO = () => new Date().toISOString().split('T')[0]

export default function Habits() {
  const { profile } = useAuth()
  const [habits, setHabits] = useState([])
  const [logs, setLogs] = useState({})
  const [loading, setLoading] = useState(true)
  const [streak, setStreak] = useState(0)

  useEffect(() => {
    if (!profile) return
    fetchData()
  }, [profile])

  async function fetchData() {
    setLoading(true)
    const today = todayISO()
    const dayName = ['sunday','monday','tuesday','wednesday','thursday','friday','saturday'][new Date().getDay()]

    const { data: habitsData } = await supabase
      .from('habits')
      .select('*')
      .eq('client_id', profile.id)
      .eq('is_active', true)
      .order('created_at')

    // Filter by frequency/day
    const todayHabits = (habitsData || []).filter(h => {
      if (h.frequency === 'daily') return true
      if (h.days_of_week?.includes(dayName)) return true
      return false
    })

    // Fetch today's logs
    const habitIds = todayHabits.map(h => h.id)
    const { data: logsData } = habitIds.length > 0
      ? await supabase.from('habit_logs').select('*').in('habit_id', habitIds).eq('logged_date', today)
      : { data: [] }

    const logMap = {}
    ;(logsData || []).forEach(l => { logMap[l.habit_id] = l })

    // Calculate streak with single query
    let s = 0
    if (habitsData?.length > 0) {
      const thirtyDaysAgo = new Date()
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
      const { data: streakLogs } = await supabase
        .from('habit_logs')
        .select('logged_date')
        .in('habit_id', habitsData.map(h => h.id))
        .eq('completed', true)
        .gte('logged_date', thirtyDaysAgo.toISOString().split('T')[0])
        .order('logged_date', { ascending: false })

      const uniqueDates = [...new Set((streakLogs || []).map(l => l.logged_date))].sort().reverse()
      for (let i = 0; i < uniqueDates.length; i++) {
        const expected = new Date()
        expected.setDate(expected.getDate() - (i + 1))
        if (uniqueDates[i] === expected.toISOString().split('T')[0]) s++
        else break
      }
    }

    setHabits(todayHabits)
    setLogs(logMap)
    setStreak(s)
    setLoading(false)
  }

  async function toggleHabit(habitId) {
    const today = todayISO()
    const current = logs[habitId]
    const newCompleted = !current?.completed

    if (current) {
      await supabase.from('habit_logs').update({ completed: newCompleted }).eq('id', current.id)
    } else {
      await supabase.from('habit_logs').insert({ habit_id: habitId, client_id: profile.id, logged_date: today, completed: true })
    }

    setLogs(prev => ({
      ...prev,
      [habitId]: { ...prev[habitId], completed: newCompleted, habit_id: habitId },
    }))
  }

  if (loading) {
    return <SkeletonList count={3} lines={1} />
  }

  const completedCount = Object.values(logs).filter(l => l.completed).length

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold text-white">Today's Habits</h3>
          <p className="text-[10px] text-slate-500">{completedCount}/{habits.length} completed</p>
        </div>
        {streak > 0 && (
          <div className="flex items-center gap-1 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20">
            <span className="text-sm">🔥</span>
            <span className="text-xs font-bold text-amber-400">{streak} day streak</span>
          </div>
        )}
      </div>

      {/* Progress bar */}
      {habits.length > 0 && (
        <div className="h-2 rounded-full bg-slate-800 overflow-hidden">
          <div className="h-full bg-gradient-to-r from-primary to-emerald-500 rounded-full transition-all duration-500"
            style={{ width: `${(completedCount / habits.length) * 100}%` }} />
        </div>
      )}

      {/* Habit list */}
      {habits.length === 0 ? (
        <div className="text-center py-8 rounded-2xl border border-primary/10 bg-[#1a1225]">
          <span className="material-symbols-outlined text-slate-600 text-3xl mb-2">checklist</span>
          <p className="text-slate-400 text-sm">No habits set up yet</p>
          <p className="text-slate-500 text-xs">Ask your trainer to set habits for you</p>
        </div>
      ) : (
        <div className="space-y-2">
          {habits.map(h => {
            const done = logs[h.id]?.completed
            return (
              <button key={h.id} onClick={() => toggleHabit(h.id)}
                className={`w-full flex items-center gap-3 rounded-2xl border p-3.5 transition-all active:scale-[0.98] ${
                  done ? 'border-emerald-500/30 bg-emerald-500/5' : 'border-primary/10 bg-[#1a1225]'
                }`}>
                <div className={`flex h-8 w-8 items-center justify-center rounded-xl transition ${
                  done ? 'bg-emerald-500/20' : 'bg-slate-800'
                }`}>
                  <span className={`material-symbols-outlined text-[20px] transition ${done ? 'text-emerald-400' : 'text-slate-500'}`}
                    style={done ? { fontVariationSettings: "'FILL' 1" } : undefined}>
                    {done ? 'check_circle' : 'circle'}
                  </span>
                </div>
                <div className="flex-1 text-left">
                  <p className={`text-sm font-medium transition ${done ? 'text-emerald-300 line-through' : 'text-white'}`}>
                    {h.emoji} {h.title}
                  </p>
                </div>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
