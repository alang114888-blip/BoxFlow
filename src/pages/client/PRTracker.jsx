import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { supabase } from '../../lib/supabase'
import { SkeletonList } from '../../components/SkeletonLoader'
import { toast } from '../../components/Toast'
import Confetti from '../../components/Confetti'

export default function PRTracker() {
  const { profile } = useAuth()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [exercises, setExercises] = useState([])
  const [prs, setPrs] = useState({})
  const [history, setHistory] = useState({})
  const [editingId, setEditingId] = useState(null)
  const [editWeight, setEditWeight] = useState('')
  const [saving, setSaving] = useState(false)
  const [showConfetti, setShowConfetti] = useState(false)
  const [stats, setStats] = useState({ total: 0, withPR: 0, monthGain: 0 })

  const fetchData = useCallback(async () => {
    if (!profile?.id) return
    try {
      setLoading(true)
      setError(null)

      const [tcRes, prsRes] = await Promise.all([
        supabase
          .from('trainer_clients')
          .select('trainer_id')
          .eq('client_id', profile.id)
          .eq('invite_accepted', true)
          .limit(1)
          .maybeSingle(),
        supabase
          .from('client_prs')
          .select('exercise_id, weight_kg, date_achieved')
          .eq('client_id', profile.id),
      ])

      const trainerId = tcRes.data?.trainer_id

      const [trainerExRes, sysExRes] = await Promise.all([
        trainerId
          ? supabase.from('exercises').select('id, name, category').eq('trainer_id', trainerId).eq('is_pr_eligible', true).order('name')
          : { data: [] },
        supabase.from('exercises').select('id, name, category').is('trainer_id', null).eq('is_default', true).order('name'),
      ])

      const allExercises = [...(sysExRes.data || []), ...(trainerExRes.data || [])]
        .sort((a, b) => a.name.localeCompare(b.name))

      const prMap = {}
      ;(prsRes.data || []).forEach(pr => { prMap[pr.exercise_id] = pr })

      // Fetch pr_history for sparklines
      const { data: histData } = await supabase
        .from('pr_history')
        .select('exercise_id, new_weight, changed_at')
        .eq('client_id', profile.id)
        .order('changed_at', { ascending: true })

      const histMap = {}
      ;(histData || []).forEach(h => {
        if (!histMap[h.exercise_id]) histMap[h.exercise_id] = []
        histMap[h.exercise_id].push({ weight: Number(h.new_weight), date: h.changed_at })
      })

      // Calculate monthly gain
      const now = new Date()
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
      let monthGain = 0
      ;(histData || []).forEach(h => {
        if (h.changed_at >= monthStart) {
          const exHist = histMap[h.exercise_id]
          if (exHist && exHist.length >= 2) {
            const idx = exHist.findIndex(x => x.date === h.changed_at)
            if (idx > 0) monthGain += (Number(h.new_weight) - exHist[idx - 1].weight)
          }
        }
      })

      const withPR = allExercises.filter(e => prMap[e.id] && Number(prMap[e.id].weight_kg) > 0).length

      setExercises(allExercises)
      setPrs(prMap)
      setHistory(histMap)
      setStats({ total: allExercises.length, withPR, monthGain: Math.round(monthGain * 10) / 10 })
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [profile?.id])

  useEffect(() => { fetchData() }, [fetchData])

  async function handleSave(exerciseId) {
    const weight = parseFloat(editWeight)
    if (!weight || weight <= 0) return
    try {
      setSaving(true)
      const currentWeight = prs[exerciseId] ? Number(prs[exerciseId].weight_kg) : 0

      const { error: upsertErr } = await supabase
        .from('client_prs')
        .upsert({
          client_id: profile.id,
          exercise_id: exerciseId,
          weight_kg: weight,
          date_achieved: new Date().toISOString().split('T')[0],
        }, { onConflict: 'client_id,exercise_id' })

      if (upsertErr) throw upsertErr

      try {
        await supabase.from('pr_history').insert({
          client_id: profile.id,
          exercise_id: exerciseId,
          old_weight: currentWeight,
          new_weight: weight,
        })
      } catch { /* non-critical */ }

      setEditingId(null)
      setEditWeight('')
      toast('New PR! 🎉')
      setShowConfetti(true)
      setTimeout(() => setShowConfetti(false), 3000)
      await fetchData()
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  function getMonthChange(exerciseId) {
    const hist = history[exerciseId]
    if (!hist || hist.length < 2) return null
    const now = new Date()
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0]
    const thisMonth = hist.filter(h => h.date >= monthStart)
    if (thisMonth.length === 0) return { change: 0, label: 'No change' }
    const firstOfMonth = hist.find(h => h.date < monthStart) || hist[0]
    const latest = hist[hist.length - 1]
    const diff = Math.round((latest.weight - firstOfMonth.weight) * 10) / 10
    if (diff > 0) return { change: diff, label: `+${diff}kg` }
    if (diff < 0) return { change: diff, label: `${diff}kg` }
    return { change: 0, label: 'No change' }
  }

  if (loading) return <div className="px-5 py-4"><SkeletonList count={6} lines={1} /></div>

  if (error) {
    return (
      <div className="px-5 py-4">
        <div className="rounded-2xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-400">
          Failed to load PRs: {error}
        </div>
      </div>
    )
  }

  return (
    <div className="px-5 py-4 space-y-4">
      <Confetti active={showConfetti} />

      <div>
        <h1 className="text-xl font-bold text-white">PR Tracker</h1>
        <p className="text-xs text-slate-500">Track your personal records</p>
      </div>

      {/* Summary Strip */}
      <div className="grid grid-cols-3 gap-2">
        <div className="rounded-xl bg-[#1a1225] border border-white/5 p-3 text-center">
          <p className="text-lg font-bold text-primary">{stats.total}</p>
          <p className="text-[10px] text-slate-500">Exercises</p>
        </div>
        <div className="rounded-xl bg-[#1a1225] border border-white/5 p-3 text-center">
          <p className="text-lg font-bold text-primary">{stats.withPR}</p>
          <p className="text-[10px] text-slate-500">PRs set</p>
        </div>
        <div className="rounded-xl bg-[#1a1225] border border-white/5 p-3 text-center">
          <p className={`text-lg font-bold ${stats.monthGain > 0 ? 'text-emerald-400' : stats.monthGain < 0 ? 'text-red-400' : 'text-slate-400'}`}>
            {stats.monthGain > 0 ? '+' : ''}{stats.monthGain}
          </p>
          <p className="text-[10px] text-slate-500">kg this month</p>
        </div>
      </div>

      {/* Exercise List */}
      {exercises.length === 0 ? (
        <div className="rounded-2xl bg-[#1a1225] border border-white/5 p-8 text-center">
          <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-3">
            <span className="material-symbols-outlined text-primary text-3xl">trophy</span>
          </div>
          <p className="text-white font-semibold text-sm">No PR exercises yet</p>
          <p className="text-slate-500 text-xs mt-1">Your trainer will set up PR-eligible exercises for you</p>
        </div>
      ) : (
        <div className="space-y-1.5 stagger-list">
          {exercises.map(ex => {
            const pr = prs[ex.id]
            const weight = pr ? Number(pr.weight_kg) : 0
            const isEditing = editingId === ex.id
            const hist = history[ex.id] || []
            const sparkData = hist.slice(-5)
            const maxW = Math.max(...sparkData.map(h => h.weight), 1)
            const monthChange = getMonthChange(ex.id)

            return (
              <div key={ex.id}>
                <button
                  onClick={() => {
                    if (isEditing) { setEditingId(null) }
                    else { setEditingId(ex.id); setEditWeight(weight > 0 ? String(weight) : '') }
                  }}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all active:scale-[0.99] ${
                    isEditing ? 'bg-primary/10 border border-primary/20 rounded-b-none' : 'bg-[#1a1225] border border-white/5 hover:border-primary/15'
                  }`}
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white truncate">{ex.name}</p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      {weight > 0 && pr?.date_achieved && (
                        <span className="text-[10px] text-slate-500">
                          {new Date(pr.date_achieved).toLocaleDateString('en', { month: 'short', day: 'numeric' })}
                        </span>
                      )}
                      {monthChange && weight > 0 && (
                        <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                          monthChange.change > 0 ? 'bg-emerald-500/10 text-emerald-400'
                            : monthChange.change < 0 ? 'bg-red-500/10 text-red-400'
                            : 'bg-white/5 text-slate-500'
                        }`}>{monthChange.label}</span>
                      )}
                      {weight === 0 && <span className="text-[10px] text-slate-600">No PR yet</span>}
                    </div>
                  </div>

                  {sparkData.length > 0 && (
                    <div className="flex items-end gap-[3px] h-[22px] flex-shrink-0">
                      {sparkData.map((s, i) => (
                        <div key={i}
                          className={`w-[4px] rounded-sm ${i === sparkData.length - 1 ? 'bg-purple-400' : 'bg-primary/50'}`}
                          style={{ height: `${Math.max((s.weight / maxW) * 22, 3)}px` }}
                        />
                      ))}
                    </div>
                  )}

                  {weight > 0 ? (
                    <span className="text-base font-bold text-primary min-w-[52px] text-right">{weight}kg</span>
                  ) : (
                    <span className="text-[10px] font-medium text-primary/60 bg-primary/10 px-2 py-1 rounded-md">Set PR</span>
                  )}
                </button>

                {isEditing && (
                  <div className="px-3 py-3 bg-primary/5 border border-primary/20 border-t-0 rounded-b-xl space-y-3">
                    {/* Last 3 history entries */}
                    {hist.length > 0 && (
                      <div className="space-y-1">
                        <p className="text-[10px] font-medium text-slate-500 uppercase tracking-wider">Recent history</p>
                        {hist.slice(-3).reverse().map((h, i) => (
                          <div key={i} className="flex items-center justify-between py-1">
                            <span className="text-[11px] text-slate-400">
                              {new Date(h.date).toLocaleDateString('en', { month: 'short', day: 'numeric', year: 'numeric' })}
                            </span>
                            <span className={`text-[12px] font-medium ${i === 0 ? 'text-primary' : 'text-slate-400'}`}>
                              {h.weight}kg
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                    {/* Input row */}
                    <div className="space-y-2">
                      <input type="number" step="0.5" min="0" value={editWeight}
                        onChange={e => setEditWeight(e.target.value)} placeholder="New PR (kg)" autoFocus
                        className="w-full bg-slate-900/50 border border-slate-700 rounded-lg py-2 px-3 text-white placeholder:text-slate-500 focus:outline-none focus:border-primary" />
                      <div className="flex gap-2">
                        <button onClick={() => handleSave(ex.id)} disabled={saving || !editWeight}
                          className="flex-1 py-2 rounded-lg bg-primary text-white text-sm font-medium disabled:opacity-50 btn-press">
                          {saving ? '...' : 'Save'}
                        </button>
                        <button onClick={() => { setEditingId(null); setEditWeight('') }}
                          className="flex-1 py-2 rounded-lg bg-white/5 text-slate-400 text-sm btn-press">Cancel</button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Info */}
      <div className="flex items-start gap-2.5 rounded-xl border border-primary/10 bg-primary/5 p-3">
        <span className="material-symbols-outlined text-primary text-[18px] mt-0.5">info</span>
        <p className="text-[11px] text-slate-400 leading-relaxed">
          When you update a PR, your workout weights will automatically recalculate. Only exercises marked by your trainer as PR-eligible appear here.
        </p>
      </div>
    </div>
  )
}
