import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'

const DEFAULT_HABITS = [
  { title: 'Drink 2L water', emoji: '💧' },
  { title: 'Sleep 8 hours', emoji: '😴' },
  { title: 'Eat breakfast', emoji: '🍳' },
]

const EMOJIS = ['💧', '😴', '🍳', '🚶', '💊', '🏋️', '🧘', '📖', '🥗', '✅']

export default function HabitManager({ clientId, clientName }) {
  const { profile } = useAuth()
  const [habits, setHabits] = useState([])
  const [compliance, setCompliance] = useState({})
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [newEmoji, setNewEmoji] = useState('✅')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!clientId || !profile) return
    fetchData()
  }, [clientId, profile])

  async function fetchData() {
    setLoading(true)
    const { data: habitsData } = await supabase
      .from('habits')
      .select('*')
      .eq('trainer_id', profile.id)
      .eq('client_id', clientId)
      .order('created_at')

    // Get last 7 days compliance
    const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0]
    const habitIds = (habitsData || []).map(h => h.id)
    const { data: logs } = habitIds.length > 0
      ? await supabase.from('habit_logs').select('*').in('habit_id', habitIds).gte('logged_date', weekAgo).eq('completed', true)
      : { data: [] }

    const comp = {}
    ;(habitsData || []).forEach(h => {
      const count = (logs || []).filter(l => l.habit_id === h.id).length
      comp[h.id] = Math.round((count / 7) * 100)
    })

    setHabits(habitsData || [])
    setCompliance(comp)
    setLoading(false)
  }

  async function addDefaultHabits() {
    setSaving(true)
    for (const dh of DEFAULT_HABITS) {
      await supabase.from('habits').insert({
        trainer_id: profile.id,
        client_id: clientId,
        title: dh.title,
        emoji: dh.emoji,
        frequency: 'daily',
      }).catch(() => {})
    }
    setSaving(false)
    fetchData()
  }

  async function addCustomHabit() {
    if (!newTitle.trim()) return
    setSaving(true)
    await supabase.from('habits').insert({
      trainer_id: profile.id,
      client_id: clientId,
      title: newTitle.trim(),
      emoji: newEmoji,
      frequency: 'daily',
    })
    setNewTitle('')
    setNewEmoji('✅')
    setShowAdd(false)
    setSaving(false)
    fetchData()
  }

  async function toggleActive(habitId, current) {
    await supabase.from('habits').update({ is_active: !current }).eq('id', habitId)
    fetchData()
  }

  async function deleteHabit(habitId) {
    await supabase.from('habits').delete().eq('id', habitId)
    fetchData()
  }

  if (loading) {
    return <div className="flex items-center justify-center py-6"><span className="material-symbols-outlined text-primary animate-spin text-xl">progress_activity</span></div>
  }

  return (
    <div className="rounded-2xl border border-primary/10 bg-[#1a1225] p-4">
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Habits</p>
        <div className="flex gap-1">
          {habits.length === 0 && (
            <button onClick={addDefaultHabits} disabled={saving}
              className="text-[10px] font-medium text-primary px-2 py-0.5 rounded bg-primary/10 hover:bg-primary/20 transition">
              + Add Defaults
            </button>
          )}
          <button onClick={() => setShowAdd(!showAdd)}
            className="text-[10px] font-medium text-slate-400 px-2 py-0.5 rounded hover:bg-white/5 transition">
            + Custom
          </button>
        </div>
      </div>

      {/* Add form */}
      {showAdd && (
        <div className="mb-3 p-3 rounded-xl bg-slate-900/50 border border-slate-700 space-y-2">
          <div className="flex gap-2">
            <div className="flex gap-1 flex-wrap">
              {EMOJIS.map(e => (
                <button key={e} onClick={() => setNewEmoji(e)}
                  className={`w-7 h-7 rounded-lg text-sm flex items-center justify-center transition ${newEmoji === e ? 'bg-primary/20 ring-1 ring-primary' : 'bg-slate-800 hover:bg-slate-700'}`}>
                  {e}
                </button>
              ))}
            </div>
          </div>
          <div className="flex gap-2">
            <input type="text" value={newTitle} onChange={e => setNewTitle(e.target.value)}
              placeholder="Habit name..." onKeyDown={e => e.key === 'Enter' && addCustomHabit()}
              className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-primary/50" />
            <button onClick={addCustomHabit} disabled={saving || !newTitle.trim()}
              className="px-3 rounded-lg bg-primary text-white text-xs font-medium hover:bg-[#6d28d9] transition disabled:opacity-50">Add</button>
          </div>
        </div>
      )}

      {/* Habits list */}
      {habits.length === 0 ? (
        <p className="text-xs text-slate-500 text-center py-4">No habits defined</p>
      ) : (
        <div className="space-y-1.5">
          {habits.map(h => (
            <div key={h.id} className="flex items-center gap-2 rounded-xl bg-slate-900/30 px-3 py-2 group">
              <span className="text-sm">{h.emoji}</span>
              <span className={`flex-1 text-xs font-medium ${h.is_active ? 'text-slate-200' : 'text-slate-500 line-through'}`}>{h.title}</span>
              <div className="flex items-center gap-2">
                {/* Compliance % */}
                <span className={`text-[10px] font-bold ${(compliance[h.id] || 0) >= 70 ? 'text-emerald-400' : (compliance[h.id] || 0) >= 40 ? 'text-amber-400' : 'text-red-400'}`}>
                  {compliance[h.id] || 0}%
                </span>
                {/* Toggle */}
                <button onClick={() => toggleActive(h.id, h.is_active)}
                  className="opacity-0 group-hover:opacity-100 p-0.5 text-slate-500 hover:text-primary transition">
                  <span className="material-symbols-outlined text-[14px]">{h.is_active ? 'toggle_on' : 'toggle_off'}</span>
                </button>
                {/* Delete */}
                <button onClick={() => deleteHabit(h.id)}
                  className="opacity-0 group-hover:opacity-100 p-0.5 text-slate-500 hover:text-red-400 transition">
                  <span className="material-symbols-outlined text-[14px]">close</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
