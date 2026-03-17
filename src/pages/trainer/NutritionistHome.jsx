import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'

const MOODS = { '😴': 'Tired', '😔': 'Low', '😐': 'Okay', '🙂': 'Good', '😄': 'Great', '💪': 'Strong' }

export default function NutritionistHome() {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [clients, setClients] = useState([])
  const [alerts, setAlerts] = useState([])
  const [filter, setFilter] = useState('all')
  const [search, setSearch] = useState('')

  useEffect(() => {
    if (!profile) return
    fetchData()
  }, [profile])

  async function fetchData() {
    try {
      setLoading(true)

      // Get all accepted clients
      const { data: tcs } = await supabase
        .from('trainer_clients')
        .select('client_id, next_appointment, water_goal, weigh_in_day, profiles!trainer_clients_client_id_fkey ( id, full_name, email )')
        .eq('trainer_id', profile.id)
        .eq('invite_accepted', true)

      if (!tcs?.length) { setClients([]); setLoading(false); return }

      const clientIds = tcs.map(tc => tc.client_id).filter(Boolean)
      const today = new Date().toISOString().split('T')[0]
      const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0]

      // Fetch latest data for all clients in parallel
      const [weightsRes, moodsRes, waterRes, checkinsRes] = await Promise.all([
        supabase.from('weight_logs').select('client_id, weight_kg, logged_at').in('client_id', clientIds).gte('logged_at', weekAgo).order('logged_at', { ascending: false }),
        supabase.from('daily_checkins').select('client_id, mood_emoji, date').in('client_id', clientIds).eq('date', today),
        supabase.from('water_logs').select('client_id, glasses, goal, date').in('client_id', clientIds).eq('date', today),
        supabase.from('weekly_checkins').select('client_id, week_date').eq('trainer_id', profile.id).gte('week_date', weekAgo),
      ])

      // Build client data
      const alertsList = []
      const enriched = tcs.map(tc => {
        const p = tc.profiles
        if (!p) return null
        const cid = tc.client_id

        // Latest weight + trend
        const weights = (weightsRes.data || []).filter(w => w.client_id === cid).sort((a, b) => b.logged_at.localeCompare(a.logged_at))
        const latestWeight = weights[0]?.weight_kg || null
        const prevWeight = weights.length > 1 ? weights[weights.length - 1].weight_kg : null
        const weightChange = latestWeight && prevWeight ? Math.round((latestWeight - prevWeight) * 10) / 10 : null
        const hasWeighedIn = weights.some(w => w.logged_at >= weekAgo)

        // Mood today
        const mood = (moodsRes.data || []).find(m => m.client_id === cid)
        const moodEmoji = mood?.mood_emoji || null

        // Water today
        const water = (waterRes.data || []).find(w => w.client_id === cid)
        const glasses = water?.glasses || 0
        const waterGoal = tc.water_goal || 8

        // Check-in this week
        const hasCheckin = (checkinsRes.data || []).some(c => c.client_id === cid)

        // Appointment
        const appt = tc.next_appointment ? new Date(tc.next_appointment) : null
        const apptDays = appt ? Math.ceil((appt - new Date()) / 86400000) : null

        // Alerts
        if (!hasWeighedIn) alertsList.push({ type: 'weigh', icon: '🔴', text: `${p.full_name} - No weigh-in this week`, cid })
        if (glasses > 0 && glasses < waterGoal / 2) alertsList.push({ type: 'water', icon: '💧', text: `${p.full_name} - Low water (${glasses}/${waterGoal})`, cid })
        if (moodEmoji === '😔' || moodEmoji === '😴') alertsList.push({ type: 'mood', icon: '😔', text: `${p.full_name} - ${MOODS[moodEmoji] || 'Low'} mood today`, cid })
        if (apptDays === 1) alertsList.push({ type: 'appt', icon: '📅', text: `${p.full_name} - Appointment tomorrow`, cid })

        // Status
        const needsAttention = !hasWeighedIn || (glasses < waterGoal / 2) || moodEmoji === '😔' || moodEmoji === '😴'

        return {
          id: cid,
          name: p.full_name || p.email,
          email: p.email,
          latestWeight,
          weightChange,
          moodEmoji,
          glasses,
          waterGoal,
          hasCheckin,
          apptDays,
          needsAttention,
        }
      }).filter(Boolean)

      setAlerts(alertsList)
      setClients(enriched)
    } catch (err) {
      console.error('NutritionistHome error:', err)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <span className="material-symbols-outlined text-primary animate-spin text-3xl">progress_activity</span>
      </div>
    )
  }

  const filtered = clients.filter(c => {
    if (search && !c.name.toLowerCase().includes(search.toLowerCase())) return false
    if (filter === 'attention') return c.needsAttention
    if (filter === 'ontrack') return !c.needsAttention
    return true
  })

  return (
    <div>
      {/* Welcome */}
      <div className="mb-4">
        <h2 className="text-xl font-bold text-white">Good {new Date().getHours() < 12 ? 'morning' : new Date().getHours() < 18 ? 'afternoon' : 'evening'}</h2>
        <p className="text-xs text-slate-400">{clients.length} client{clients.length !== 1 ? 's' : ''} under your care</p>
      </div>

      {/* Alerts strip */}
      {alerts.length > 0 && (
        <div className="mb-4">
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">Today's Alerts</p>
          <div className="flex gap-2 overflow-x-auto pb-2 -mx-4 px-4">
            {alerts.map((a, i) => (
              <button key={i} onClick={() => navigate(`/trainer/nutrition-client/${a.cid}`)}
                className="flex-shrink-0 flex items-center gap-2 rounded-xl border border-red-500/20 bg-red-500/5 px-3 py-2 text-xs text-slate-200 hover:bg-red-500/10 transition">
                <span>{a.icon}</span>
                <span className="whitespace-nowrap">{a.text}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Filter + Search */}
      <div className="flex items-center gap-2 mb-4">
        <div className="flex rounded-lg bg-[#1a1225] border border-primary/10 p-0.5 text-[10px] font-bold">
          {[{ k: 'all', l: 'All' }, { k: 'attention', l: 'Need attention' }, { k: 'ontrack', l: 'On track' }].map(f => (
            <button key={f.k} onClick={() => setFilter(f.k)}
              className={`px-3 py-1 rounded-md transition ${filter === f.k ? 'bg-primary text-white' : 'text-slate-400'}`}>
              {f.l}
            </button>
          ))}
        </div>
        <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search..."
          className="flex-1 bg-[#1a1225] border border-primary/10 rounded-lg px-3 py-1.5 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-primary/30" />
      </div>

      {/* Client Cards */}
      {filtered.length === 0 ? (
        <div className="text-center py-12 rounded-2xl border border-primary/10 bg-[#1a1225]">
          <span className="material-symbols-outlined text-slate-600 text-4xl mb-2">group_off</span>
          <p className="text-slate-400 text-sm">{clients.length === 0 ? 'No clients yet' : 'No clients match filter'}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(c => (
            <button key={c.id} onClick={() => navigate(`/trainer/nutrition-client/${c.id}`)}
              className={`w-full text-left rounded-2xl border bg-[#1a1225] p-3.5 transition hover:border-primary/30 active:scale-[0.99] ${c.needsAttention ? 'border-amber-500/20' : 'border-primary/10'}`}>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/20 text-sm font-bold text-primary">
                    {c.name.charAt(0).toUpperCase()}
                  </div>
                  <span className="text-sm font-semibold text-white">{c.name}</span>
                </div>
                {c.apptDays != null && c.apptDays >= 0 && c.apptDays <= 7 && (
                  <span className="text-[10px] text-slate-400 flex items-center gap-1">
                    <span className="material-symbols-outlined text-[12px]">calendar_today</span>
                    {c.apptDays === 0 ? 'Today' : c.apptDays === 1 ? 'Tomorrow' : `${c.apptDays}d`}
                  </span>
                )}
              </div>
              <div className="grid grid-cols-4 gap-2 text-[10px]">
                <div className="text-center">
                  <p className="text-slate-500">Weight</p>
                  <p className="font-bold text-white">{c.latestWeight ? `${c.latestWeight}kg` : '—'}</p>
                  {c.weightChange != null && (
                    <p className={`font-medium ${c.weightChange < 0 ? 'text-green-400' : c.weightChange > 0 ? 'text-red-400' : 'text-slate-500'}`}>
                      {c.weightChange > 0 ? '+' : ''}{c.weightChange}
                    </p>
                  )}
                </div>
                <div className="text-center">
                  <p className="text-slate-500">Mood</p>
                  <p className="text-lg leading-none mt-0.5">{c.moodEmoji || '—'}</p>
                </div>
                <div className="text-center">
                  <p className="text-slate-500">Water</p>
                  <p className="font-bold text-white">{c.glasses}/{c.waterGoal}</p>
                  <div className="mt-0.5 h-1 rounded-full bg-slate-700 overflow-hidden">
                    <div className="h-full bg-blue-400 rounded-full" style={{ width: `${Math.min((c.glasses / c.waterGoal) * 100, 100)}%` }} />
                  </div>
                </div>
                <div className="text-center">
                  <p className="text-slate-500">Check-in</p>
                  <span className={`material-symbols-outlined text-[18px] mt-0.5 ${c.hasCheckin ? 'text-green-400' : 'text-slate-600'}`}
                    style={c.hasCheckin ? { fontVariationSettings: "'FILL' 1" } : undefined}>
                    {c.hasCheckin ? 'check_circle' : 'cancel'}
                  </span>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
