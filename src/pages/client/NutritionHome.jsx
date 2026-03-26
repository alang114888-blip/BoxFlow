import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { supabase } from '../../lib/supabase'
import { LineChart, Line, ResponsiveContainer } from 'recharts'

const MOODS = ['😴', '😔', '😐', '🙂', '😄', '💪']

function todayISO() {
  return new Date().toISOString().slice(0, 10)
}

function formatAppointment(dateStr) {
  const d = new Date(dateStr)
  const now = new Date()
  const diffMs = d.getTime() - now.getTime()
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24))
  const formatted = d.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
  return { diffDays, formatted }
}

export default function NutritionHome() {
  const { profile } = useAuth()
  const [loading, setLoading] = useState(true)
  const [trainerClient, setTrainerClient] = useState(null)
  const [mood, setMood] = useState(null)
  const [waterGlasses, setWaterGlasses] = useState(0)
  const [waterGoal, setWaterGoal] = useState(8)
  const [weightData, setWeightData] = useState([])
  const [latestWeight, setLatestWeight] = useState(null)
  const [weightTrend, setWeightTrend] = useState(null)
  const [newWeight, setNewWeight] = useState('')

  const fetchData = useCallback(async () => {
    if (!profile?.id) return
    try {
      setLoading(true)
      const today = todayISO()
      const fourteenDaysAgo = new Date()
      fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14)

      const [tcRes, checkinRes, waterRes, weightRes] = await Promise.all([
        supabase
          .from('trainer_clients')
          .select('personal_notes, motivation_message, next_appointment, water_goal')
          .eq('client_id', profile.id)
          .maybeSingle(),
        supabase
          .from('daily_checkins')
          .select('mood_emoji')
          .eq('client_id', profile.id)
          .eq('date', today)
          .maybeSingle(),
        supabase
          .from('water_logs')
          .select('glasses, goal')
          .eq('client_id', profile.id)
          .eq('date', today)
          .maybeSingle(),
        supabase
          .from('weight_logs')
          .select('weight_kg, logged_at')
          .eq('client_id', profile.id)
          .gte('logged_at', fourteenDaysAgo.toISOString().slice(0, 10))
          .order('logged_at', { ascending: true }),
      ])

      if (tcRes.data) {
        setTrainerClient(tcRes.data)
        setWaterGoal(tcRes.data.water_goal || 8)
      }
      if (checkinRes.data) {
        setMood(checkinRes.data.mood_emoji)
      }
      if (waterRes.data) {
        setWaterGlasses(waterRes.data.glasses || 0)
      }
      if (weightRes.data && weightRes.data.length > 0) {
        const mapped = weightRes.data.map((w) => ({
          date: w.logged_at,
          kg: w.weight_kg,
        }))
        setWeightData(mapped)
        const latest = mapped[mapped.length - 1]
        setLatestWeight(latest.kg)

        const sevenDaysAgo = new Date()
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
        const sevenDayStr = sevenDaysAgo.toISOString().slice(0, 10)
        const older = mapped.filter((w) => w.date <= sevenDayStr)
        if (older.length > 0) {
          const oldWeight = older[older.length - 1].kg
          setWeightTrend(latest.kg > oldWeight ? 'up' : latest.kg < oldWeight ? 'down' : null)
        }
      }
    } catch (err) {
      console.error('NutritionHome fetch error:', err)
    } finally {
      setLoading(false)
    }
  }, [profile?.id])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  async function handleMood(emoji) {
    setMood(emoji)
    const today = todayISO()
    await supabase.from('daily_checkins').upsert(
      { client_id: profile.id, date: today, mood_emoji: emoji },
      { onConflict: 'client_id,date' }
    )
  }

  async function updateWater(delta) {
    const next = Math.max(0, waterGlasses + delta)
    setWaterGlasses(next)
    const today = todayISO()
    await supabase.from('water_logs').upsert(
      { client_id: profile.id, date: today, glasses: next, goal: waterGoal },
      { onConflict: 'client_id,date' }
    )
  }

  async function logWeight() {
    const kg = parseFloat(newWeight)
    if (isNaN(kg) || kg <= 0) return
    const today = todayISO()
    await supabase.from('weight_logs').upsert(
      { client_id: profile.id, weight_kg: kg, logged_at: today },
      { onConflict: 'client_id,logged_at' }
    )
    setNewWeight('')
    setLatestWeight(kg)
    setWeightData((prev) => {
      const filtered = prev.filter((w) => w.date !== today)
      return [...filtered, { date: today, kg }]
    })
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <span className="material-symbols-rounded animate-spin text-4xl text-[#7c3bed]">
          progress_activity
        </span>
      </div>
    )
  }

  const waterPct = waterGoal > 0 ? Math.round((waterGlasses / waterGoal) * 100) : 0

  return (
    <div className="max-w-lg mx-auto px-4 py-4 space-y-3 font-[Lexend]">
      {/* Weigh-in Reminder Banner */}
      {(() => {
        const dayNames = ['sunday','monday','tuesday','wednesday','thursday','friday','saturday']
        const today = dayNames[new Date().getDay()]
        if (trainerClient?.weigh_in_day && today === trainerClient.weigh_in_day) {
          return (
            <div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 p-4 flex items-center gap-3">
              <span className="text-2xl">⚖️</span>
              <div>
                <p className="text-sm font-bold text-amber-400">Today is your weigh-in day!</p>
                <p className="text-xs text-amber-400/70">Log your weight below</p>
              </div>
            </div>
          )
        }
        return null
      })()}

      {/* 1. Motivation Card */}
      {trainerClient?.motivation_message && (
        <div className="rounded-2xl bg-gradient-to-br from-[#7c3bed] to-[#5b21b6] p-4 shadow-lg">
          <p className="text-xs text-white/70 font-medium mb-1">Your coach says:</p>
          <div className="flex items-start gap-2">
            <span className="text-2xl leading-none mt-0.5">💪</span>
            <p className="text-white text-sm font-medium leading-relaxed">
              {trainerClient.motivation_message}
            </p>
          </div>
        </div>
      )}

      {/* 2. Next Appointment */}
      {trainerClient?.next_appointment && (() => {
        const { diffDays, formatted } = formatAppointment(trainerClient.next_appointment)
        if (diffDays < 0) return null
        return (
          <div className="rounded-2xl border border-[#7c3bed]/10 bg-[#1a1225] p-4">
            <div className="flex items-center gap-3">
              <span className="material-symbols-rounded text-[#7c3bed] text-2xl">
                calendar_month
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-white/50 font-medium">Next appointment</p>
                <p className="text-white text-sm font-semibold">
                  {diffDays === 0 ? 'Today' : `In ${diffDays} day${diffDays !== 1 ? 's' : ''}`}
                </p>
                <p className="text-white/60 text-xs">{formatted}</p>
              </div>
            </div>
          </div>
        )
      })()}

      {/* 3. Daily Mood Check-in */}
      <div className="rounded-2xl border border-[#7c3bed]/10 bg-[#1a1225] p-4">
        <p className="text-xs text-white/50 font-medium mb-3">How are you feeling today?</p>
        <div className="flex items-center justify-between gap-1">
          {MOODS.map((emoji) => (
            <button
              key={emoji}
              onClick={() => handleMood(emoji)}
              className={`text-2xl p-2 rounded-xl transition-all ${
                mood === emoji
                  ? 'ring-2 ring-[#7c3bed] bg-[#7c3bed]/20 scale-110'
                  : 'hover:bg-white/5'
              }`}
            >
              {emoji}
            </button>
          ))}
        </div>
      </div>

      {/* 4. Water Intake Tracker */}
      <div className="rounded-2xl border border-[#7c3bed]/10 bg-[#1a1225] p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className="material-symbols-rounded text-[#7c3bed] text-xl">water_drop</span>
            <p className="text-xs text-white/50 font-medium">Water Intake</p>
          </div>
          <p className="text-sm text-white font-semibold">
            {waterGlasses}/{waterGoal} <span className="text-white/40 text-xs">glasses</span>
          </p>
        </div>
        <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden mb-3">
          <div
            className="h-full bg-[#7c3bed] rounded-full transition-all duration-300"
            style={{ width: `${Math.min(waterPct, 100)}%` }}
          />
        </div>
        <div className="flex items-center justify-between">
          <p className="text-xs text-white/40">{waterPct}%</p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => updateWater(-1)}
              className="w-9 h-9 rounded-xl bg-white/5 flex items-center justify-center text-white/70 hover:bg-white/10 transition-colors"
            >
              <span className="material-symbols-rounded text-lg">remove</span>
            </button>
            <button
              onClick={() => updateWater(1)}
              className="w-9 h-9 rounded-xl bg-[#7c3bed]/20 flex items-center justify-center text-[#7c3bed] hover:bg-[#7c3bed]/30 transition-colors"
            >
              <span className="material-symbols-rounded text-lg">add</span>
            </button>
          </div>
        </div>
      </div>

      {/* 5. Weight Log + Mini Graph */}
      <div className="rounded-2xl border border-[#7c3bed]/10 bg-[#1a1225] p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className="material-symbols-rounded text-[#7c3bed] text-xl">monitor_weight</span>
            <p className="text-xs text-white/50 font-medium">Weight</p>
          </div>
          {latestWeight != null && (
            <div className="flex items-center gap-1">
              <p className="text-white text-lg font-bold">{latestWeight} kg</p>
              {weightTrend === 'up' && (
                <span className="material-symbols-rounded text-red-400 text-lg">arrow_upward</span>
              )}
              {weightTrend === 'down' && (
                <span className="material-symbols-rounded text-green-400 text-lg">arrow_downward</span>
              )}
            </div>
          )}
        </div>

        {weightData.length > 1 && (
          <div className="w-full h-20 mb-3">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={weightData}>
                <Line
                  type="monotone"
                  dataKey="kg"
                  stroke="#7c3bed"
                  strokeWidth={2}
                  dot={{ r: 2, fill: '#7c3bed' }}
                  activeDot={{ r: 4 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}

        <div className="flex items-center gap-2">
          <input
            type="number"
            step="0.1"
            placeholder="Log weight (kg)"
            value={newWeight}
            onChange={(e) => setNewWeight(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && logWeight()}
            className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white placeholder-white/30 outline-none focus:border-[#7c3bed]/50 transition-colors"
          />
          <button
            onClick={logWeight}
            className="px-4 py-2 bg-[#7c3bed] rounded-xl text-white text-sm font-medium hover:bg-[#6d2ed4] transition-colors"
          >
            Log
          </button>
        </div>
      </div>

      {/* 6. Personal Notes */}
      {trainerClient?.personal_notes && (
        <div className="rounded-2xl border border-[#7c3bed]/10 bg-[#1a1225] p-4">
          <div className="flex items-start gap-2">
            <span className="text-xl leading-none mt-0.5">📋</span>
            <div>
              <p className="text-xs text-white/50 font-medium mb-1">Coach Notes</p>
              <p className="text-white/80 text-sm leading-relaxed whitespace-pre-wrap">
                {trainerClient.personal_notes}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
