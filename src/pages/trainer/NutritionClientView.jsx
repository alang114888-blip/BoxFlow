import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { supabase } from '../../lib/supabase'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import PhotoUpload from '../../components/PhotoUpload'
import HabitManager from './HabitManager'

const TABS = ['Dashboard', 'Photos', 'Tools', 'History']
const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-lg bg-[#1a1225] border border-primary/20 p-2 shadow-xl text-xs">
      <p className="text-slate-400 mb-0.5">{label}</p>
      {payload.map((p, i) => <p key={i} className="font-bold" style={{ color: p.color }}>{p.value} kg</p>)}
    </div>
  )
}

export default function NutritionClientView() {
  const { clientId } = useParams()
  const { profile } = useAuth()
  const navigate = useNavigate()
  const [tab, setTab] = useState('Dashboard')
  const [loading, setLoading] = useState(true)
  const [client, setClient] = useState(null)
  const [tc, setTc] = useState(null) // trainer_clients record
  const [weights, setWeights] = useState([])
  const [moods, setMoods] = useState([])
  const [water, setWater] = useState([])
  const [checkins, setCheckins] = useState([])
  const [photos, setPhotos] = useState([])
  const [saving, setSaving] = useState(false)
  const [weightRange, setWeightRange] = useState(30) // 30/60/90 days

  // Editable fields
  const [notes, setNotes] = useState('')
  const [motivation, setMotivation] = useState('')
  const [weighInDay, setWeighInDay] = useState('')
  const [nextAppt, setNextAppt] = useState('')
  const [waterGoal, setWaterGoal] = useState(8)

  useEffect(() => {
    if (!clientId || !profile) return
    fetchAll()
  }, [clientId, profile])

  async function fetchAll() {
    setLoading(true)
    try {
      const cutoff = new Date(Date.now() - 90 * 86400000).toISOString().split('T')[0]
      const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0]

      const [clientRes, tcRes, weightRes, moodRes, waterRes, checkinRes, photoRes] = await Promise.all([
        supabase.from('profiles').select('id, full_name, email').eq('id', clientId).single(),
        supabase.from('trainer_clients').select('*').eq('trainer_id', profile.id).eq('client_id', clientId).maybeSingle(),
        supabase.from('weight_logs').select('*').eq('client_id', clientId).gte('logged_at', cutoff).order('logged_at'),
        supabase.from('daily_checkins').select('*').eq('client_id', clientId).gte('date', weekAgo).order('date'),
        supabase.from('water_logs').select('*').eq('client_id', clientId).gte('date', weekAgo).order('date'),
        supabase.from('weekly_checkins').select('*').eq('client_id', clientId).order('week_date', { ascending: false }).limit(20),
        supabase.from('progress_photos').select('*').eq('client_id', clientId).order('taken_at', { ascending: false }),
      ])

      setClient(clientRes.data)
      setTc(tcRes.data)
      setWeights(weightRes.data || [])
      setMoods(moodRes.data || [])
      setWater(waterRes.data || [])
      setCheckins(checkinRes.data || [])
      setPhotos(photoRes.data || [])

      if (tcRes.data) {
        setNotes(tcRes.data.personal_notes || '')
        setMotivation(tcRes.data.motivation_message || '')
        setWeighInDay(tcRes.data.weigh_in_day || '')
        setNextAppt(tcRes.data.next_appointment ? tcRes.data.next_appointment.slice(0, 16) : '')
        setWaterGoal(tcRes.data.water_goal || 8)
      }
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  async function saveField(field, value) {
    setSaving(true)
    await supabase.from('trainer_clients').update({ [field]: value }).eq('trainer_id', profile.id).eq('client_id', clientId)
    setSaving(false)
  }

  if (loading) {
    return <div className="flex items-center justify-center py-20"><span className="material-symbols-outlined text-primary animate-spin text-3xl">progress_activity</span></div>
  }

  // Computed values
  const latestWeight = weights.length > 0 ? weights[weights.length - 1].weight_kg : null
  const weekAgoWeight = weights.length > 1 ? weights.find(w => w.logged_at <= new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0])?.weight_kg : null
  const weightChange = latestWeight && weekAgoWeight ? Math.round((latestWeight - weekAgoWeight) * 10) / 10 : null
  const bestWeight = weights.length > 0 ? weights.reduce((min, w) => w.weight_kg < min.weight_kg ? w : min, weights[0]) : null

  // Weight trend (30 days)
  const thirtyDaysAgo = weights.filter(w => w.logged_at >= new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0])
  const weightTrend30 = thirtyDaysAgo.length >= 2 ? Math.round((thirtyDaysAgo[thirtyDaysAgo.length - 1].weight_kg - thirtyDaysAgo[0].weight_kg) * 10) / 10 : null

  // Water average
  const waterAvg = water.length > 0 ? Math.round(water.reduce((s, w) => s + w.glasses, 0) / water.length * 10) / 10 : 0
  const waterBelowGoal = water.filter(w => w.glasses < waterGoal).length

  // Mood analysis
  const moodMap = {}
  moods.forEach(m => { moodMap[m.mood_emoji] = (moodMap[m.mood_emoji] || 0) + 1 })
  const topMood = Object.entries(moodMap).sort((a, b) => b[1] - a[1])[0]

  // Status
  const daysSinceWeighIn = weights.length > 0 ? Math.floor((Date.now() - new Date(weights[weights.length - 1].logged_at).getTime()) / 86400000) : 999
  const isAtRisk = daysSinceWeighIn > 5 || waterBelowGoal >= 5
  const needsAttention = daysSinceWeighIn > 3 || waterBelowGoal >= 3
  const statusLabel = isAtRisk ? 'At Risk' : needsAttention ? 'Needs Attention' : 'On Track'
  const statusColor = isAtRisk ? 'text-red-400 bg-red-500/10 border-red-500/20' : needsAttention ? 'text-amber-400 bg-amber-500/10 border-amber-500/20' : 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20'
  const statusDot = isAtRisk ? '🔴' : needsAttention ? '🟡' : '🟢'

  // Appointment countdown
  const apptDate = tc?.next_appointment ? new Date(tc.next_appointment) : null
  const apptDays = apptDate ? Math.ceil((apptDate - new Date()) / 86400000) : null

  // Chart data
  const chartData = weights.filter(w => {
    const cutoff = new Date(Date.now() - weightRange * 86400000).toISOString().split('T')[0]
    return w.logged_at >= cutoff
  }).map(w => ({ date: new Date(w.logged_at).toLocaleDateString('en', { month: 'short', day: 'numeric' }), weight: parseFloat(w.weight_kg) }))

  // Weekly water grid (last 7 days)
  const waterGrid = []
  for (let i = 6; i >= 0; i--) {
    const d = new Date(); d.setDate(d.getDate() - i)
    const ds = d.toISOString().split('T')[0]
    const entry = water.find(w => w.date === ds)
    waterGrid.push({ day: DAY_LABELS[(d.getDay() + 6) % 7], glasses: entry?.glasses || 0, goal: waterGoal })
  }

  // Mood strip (last 7 days)
  const moodStrip = []
  for (let i = 6; i >= 0; i--) {
    const d = new Date(); d.setDate(d.getDate() - i)
    const ds = d.toISOString().split('T')[0]
    const entry = moods.find(m => m.date === ds)
    moodStrip.push({ day: DAY_LABELS[(d.getDay() + 6) % 7], emoji: entry?.mood_emoji || null })
  }

  const inputCls = "w-full bg-slate-900/50 border border-slate-700 rounded-lg py-2.5 px-3 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-primary/50 focus:border-primary"

  return (
    <div>
      {/* Back + Header */}
      <div className="flex items-center gap-3 mb-4">
        <button onClick={() => navigate(-1)} className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 transition">
          <span className="material-symbols-outlined text-[20px]">arrow_back</span>
        </button>
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/20 text-sm font-bold text-primary">
            {(client?.full_name || '?').charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0">
            <h2 className="text-lg font-bold text-white truncate">{client?.full_name}</h2>
            <div className="flex items-center gap-2">
              <span className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${statusColor}`}>{statusDot} {statusLabel}</span>
              {apptDays != null && apptDays >= 0 && (
                <span className="text-[10px] text-slate-400">📅 {apptDays === 0 ? 'Today' : apptDays === 1 ? 'Tomorrow' : `${apptDays}d`}</span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex rounded-xl bg-[#1a1225] border border-primary/10 p-0.5 mb-4 text-[10px] font-bold">
        {TABS.map(t => (
          <button key={t} onClick={() => setTab(t)} className={`flex-1 py-1.5 rounded-lg transition ${tab === t ? 'bg-primary text-white' : 'text-slate-400'}`}>{t}</button>
        ))}
      </div>

      {/* ================ DASHBOARD TAB ================ */}
      {tab === 'Dashboard' && (
        <div className="space-y-4">
          {/* Weight Card */}
          <div className="rounded-2xl border border-primary/10 bg-[#1a1225] p-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Weight</p>
              <div className="flex rounded-lg bg-[#0f0a19] p-0.5 text-[9px] font-bold">
                {[30, 60, 90].map(d => (
                  <button key={d} onClick={() => setWeightRange(d)} className={`px-2 py-0.5 rounded transition ${weightRange === d ? 'bg-primary text-white' : 'text-slate-500'}`}>{d}d</button>
                ))}
              </div>
            </div>
            <div className="flex items-baseline gap-3 mb-3">
              <span className="text-3xl font-bold text-white">{latestWeight || '—'}<span className="text-sm text-slate-500 ml-0.5">kg</span></span>
              {weightChange != null && (
                <span className={`text-sm font-bold flex items-center gap-0.5 ${weightChange < 0 ? 'text-emerald-400' : weightChange > 0 ? 'text-red-400' : 'text-slate-500'}`}>
                  <span className="material-symbols-outlined text-[14px]">{weightChange < 0 ? 'trending_down' : weightChange > 0 ? 'trending_up' : 'trending_flat'}</span>
                  {weightChange > 0 ? '+' : ''}{weightChange}kg
                </span>
              )}
            </div>
            {chartData.length > 1 ? (
              <ResponsiveContainer width="100%" height={140}>
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="date" tick={{ fill: '#94a3b8', fontSize: 9 }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fill: '#94a3b8', fontSize: 9 }} tickLine={false} axisLine={false} domain={['auto', 'auto']} />
                  <Tooltip content={<CustomTooltip />} />
                  <Line type="monotone" dataKey="weight" stroke="#7c3bed" strokeWidth={2} dot={{ r: 3, fill: '#7c3bed' }} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-xs text-slate-500 text-center py-6">Not enough weight data for chart</p>
            )}
            {bestWeight && (
              <p className="text-[10px] text-slate-500 mt-2">Best: {bestWeight.weight_kg}kg on {new Date(bestWeight.logged_at).toLocaleDateString()}</p>
            )}
          </div>

          {/* Daily Compliance */}
          <div className="rounded-2xl border border-primary/10 bg-[#1a1225] p-4">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">This Week</p>
            {/* Water grid */}
            <div className="mb-3">
              <p className="text-[10px] text-slate-500 mb-1.5">💧 Water</p>
              <div className="flex gap-1">
                {waterGrid.map((w, i) => (
                  <div key={i} className="flex-1 text-center">
                    <div className={`h-6 rounded-md flex items-center justify-center text-[9px] font-bold ${w.glasses >= w.goal ? 'bg-blue-500/20 text-blue-400' : w.glasses > 0 ? 'bg-amber-500/10 text-amber-400' : 'bg-slate-800 text-slate-600'}`}>
                      {w.glasses > 0 ? w.glasses : '·'}
                    </div>
                    <p className="text-[8px] text-slate-600 mt-0.5">{w.day}</p>
                  </div>
                ))}
              </div>
            </div>
            {/* Mood strip */}
            <div>
              <p className="text-[10px] text-slate-500 mb-1.5">😊 Mood</p>
              <div className="flex gap-1">
                {moodStrip.map((m, i) => (
                  <div key={i} className="flex-1 text-center">
                    <div className="h-6 rounded-md flex items-center justify-center text-sm bg-slate-800/50">
                      {m.emoji || <span className="text-[8px] text-slate-600">·</span>}
                    </div>
                    <p className="text-[8px] text-slate-600 mt-0.5">{m.day}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Trends & Alerts */}
          <div className="rounded-2xl border border-primary/10 bg-[#1a1225] p-4 space-y-2">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Trends</p>
            {weightTrend30 != null && (
              <div className={`flex items-center gap-2 text-xs ${weightTrend30 < 0 ? 'text-emerald-400' : weightTrend30 > 0 ? 'text-red-400' : 'text-slate-400'}`}>
                <span className="material-symbols-outlined text-[16px]">{weightTrend30 < 0 ? 'trending_down' : 'trending_up'}</span>
                {weightTrend30 < 0 ? `Lost ${Math.abs(weightTrend30)}kg in 30 days 📉` : `Gained ${weightTrend30}kg in 30 days 📈`}
              </div>
            )}
            <div className="text-xs text-blue-400 flex items-center gap-2">
              <span className="material-symbols-outlined text-[16px]">water_drop</span>
              Average {waterAvg}/{waterGoal} glasses
            </div>
            {topMood && (
              <div className="text-xs text-slate-300 flex items-center gap-2">
                <span>{topMood[0]}</span> Most common mood this week ({topMood[1]}x)
              </div>
            )}
            {daysSinceWeighIn > 3 && (
              <div className="text-xs text-red-400 flex items-center gap-2">
                <span className="material-symbols-outlined text-[16px]">warning</span>
                No weigh-in in {daysSinceWeighIn} days
              </div>
            )}
            {waterBelowGoal >= 3 && (
              <div className="text-xs text-amber-400 flex items-center gap-2">
                <span className="material-symbols-outlined text-[16px]">info</span>
                Water below goal {waterBelowGoal} days this week
              </div>
            )}
          </div>
        </div>
      )}

      {/* ================ PHOTOS TAB ================ */}
      {tab === 'Photos' && (
        <div className="space-y-4">
          {photos.length === 0 ? (
            <div className="text-center py-12 rounded-2xl border border-primary/10 bg-[#1a1225]">
              <span className="material-symbols-outlined text-slate-600 text-4xl mb-2">photo_library</span>
              <p className="text-slate-400 text-sm">No progress photos yet</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              {photos.map(p => (
                <div key={p.id} className="rounded-xl overflow-hidden border border-primary/10 bg-[#1a1225]">
                  <img src={p.photo_url} alt="" className="w-full h-36 object-cover" />
                  <div className="p-2">
                    <p className="text-[10px] text-slate-400">{new Date(p.taken_at).toLocaleDateString()}</p>
                    {p.notes && <p className="text-xs text-slate-300 mt-0.5">{p.notes}</p>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ================ TOOLS TAB ================ */}
      {tab === 'Tools' && (
        <div className="space-y-4">
          {/* Personal Notes */}
          <div className="rounded-2xl border border-primary/10 bg-[#1a1225] p-4">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Personal Notes</p>
            <textarea value={notes} onChange={e => setNotes(e.target.value)}
              onBlur={() => saveField('personal_notes', notes)} rows={3}
              className={inputCls} placeholder="Dietary notes, allergies, goals..." />
          </div>

          {/* Motivation Message */}
          <div className="rounded-2xl border border-primary/10 bg-[#1a1225] p-4">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">💪 Motivation Message</p>
            <textarea value={motivation} onChange={e => setMotivation(e.target.value)}
              onBlur={() => saveField('motivation_message', motivation)} rows={2}
              className={inputCls} placeholder="Write an encouraging message..." />
          </div>

          {/* Settings */}
          <div className="rounded-2xl border border-primary/10 bg-[#1a1225] p-4 space-y-3">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Settings</p>
            <div>
              <label className="text-[10px] text-slate-500 uppercase tracking-wider">Weigh-in Day</label>
              <select value={weighInDay} onChange={e => { setWeighInDay(e.target.value); saveField('weigh_in_day', e.target.value) }} className={inputCls}>
                <option value="">Not set</option>
                {['monday','tuesday','wednesday','thursday','friday','saturday','sunday'].map(d => (
                  <option key={d} value={d}>{d.charAt(0).toUpperCase() + d.slice(1)}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-[10px] text-slate-500 uppercase tracking-wider">Next Appointment</label>
              <input type="datetime-local" value={nextAppt} onChange={e => { setNextAppt(e.target.value); saveField('next_appointment', e.target.value || null) }}
                className={inputCls} />
            </div>
            <div>
              <label className="text-[10px] text-slate-500 uppercase tracking-wider">Daily Water Goal (glasses)</label>
              <input type="number" min={1} max={20} value={waterGoal} onChange={e => { setWaterGoal(parseInt(e.target.value) || 8); saveField('water_goal', parseInt(e.target.value) || 8) }}
                className={inputCls} />
            </div>
          </div>

          {/* Habits */}
          <HabitManager clientId={clientId} clientName={client?.full_name} />

          {/* Meal Plan */}
          <button onClick={() => navigate('/trainer/nutrition')}
            className="w-full flex items-center justify-center gap-2 rounded-2xl border border-primary/20 bg-primary/5 py-3 text-sm font-medium text-primary hover:bg-primary/10 transition">
            <span className="material-symbols-outlined text-[18px]">restaurant_menu</span>
            Open Nutrition Plan Builder
          </button>

          {saving && <p className="text-[10px] text-primary text-center animate-pulse">Saving...</p>}
        </div>
      )}

      {/* ================ HISTORY TAB ================ */}
      {tab === 'History' && (
        <div className="space-y-4">
          {/* Weight History */}
          <div className="rounded-2xl border border-primary/10 bg-[#1a1225] p-4">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Weight Log</p>
            {weights.length === 0 ? <p className="text-xs text-slate-500">No entries</p> : (
              <div className="max-h-48 overflow-y-auto space-y-1">
                {[...weights].reverse().map((w, i) => (
                  <div key={i} className="flex justify-between items-center text-xs py-1 border-b border-white/5">
                    <span className="text-slate-400">{new Date(w.logged_at).toLocaleDateString()}</span>
                    <span className="font-bold text-white">{w.weight_kg} kg</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Check-in History */}
          <div className="rounded-2xl border border-primary/10 bg-[#1a1225] p-4">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Check-ins</p>
            {checkins.length === 0 ? <p className="text-xs text-slate-500">No check-ins</p> : (
              <div className="max-h-48 overflow-y-auto space-y-2">
                {checkins.map(c => (
                  <div key={c.id} className="text-xs border-b border-white/5 pb-2">
                    <div className="flex justify-between text-slate-400 mb-0.5">
                      <span>{new Date(c.week_date).toLocaleDateString()}</span>
                      <span>{c.weight_kg ? `${c.weight_kg}kg` : ''}</span>
                    </div>
                    <div className="flex gap-3 text-slate-300">
                      {c.energy && <span>⚡{c.energy}</span>}
                      {c.sleep && <span>😴{c.sleep}</span>}
                      {c.stress && <span>😰{c.stress}</span>}
                    </div>
                    {c.notes && <p className="text-slate-500 mt-0.5">{c.notes}</p>}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Mood History */}
          <div className="rounded-2xl border border-primary/10 bg-[#1a1225] p-4">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Mood Log</p>
            {moods.length === 0 ? <p className="text-xs text-slate-500">No entries</p> : (
              <div className="flex flex-wrap gap-1.5">
                {moods.map((m, i) => (
                  <div key={i} className="text-center">
                    <span className="text-lg">{m.mood_emoji}</span>
                    <p className="text-[8px] text-slate-600">{new Date(m.date).toLocaleDateString('en', { month: 'short', day: 'numeric' })}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
