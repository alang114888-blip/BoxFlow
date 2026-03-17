import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { supabase } from '../../lib/supabase'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts'

const TABS = [
  { id: 'overview', label: 'Overview', icon: 'dashboard' },
  { id: 'weight', label: 'Weight', icon: 'monitor_weight' },
  { id: 'mood', label: 'Mood', icon: 'mood' },
  { id: 'notes', label: 'Notes', icon: 'edit_note' },
  { id: 'photos', label: 'Photos', icon: 'photo_library' },
]

const DAYS_OF_WEEK = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

function formatDate(dateStr) {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  })
}

function formatDateTime(dateStr) {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

export default function NutritionClientView() {
  const { clientId } = useParams()
  const navigate = useNavigate()
  const { profile } = useAuth()

  const [activeTab, setActiveTab] = useState('overview')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // Client data
  const [clientProfile, setClientProfile] = useState(null)
  const [trainerClient, setTrainerClient] = useState(null)
  const [weightLogs, setWeightLogs] = useState([])
  const [checkins, setCheckins] = useState([])
  const [waterLogs, setWaterLogs] = useState([])
  const [photos, setPhotos] = useState([])

  // Editable fields
  const [motivationMessage, setMotivationMessage] = useState('')
  const [personalNotes, setPersonalNotes] = useState('')
  const [nextAppointment, setNextAppointment] = useState('')
  const [waterGoal, setWaterGoal] = useState(8)
  const [weighInDay, setWeighInDay] = useState('Monday')
  const [saving, setSaving] = useState(false)

  const fetchData = useCallback(async () => {
    if (!profile?.id || !clientId) return
    try {
      setLoading(true)
      setError(null)

      const [profileRes, tcRes, weightRes, checkinRes, waterRes, photoRes] = await Promise.all([
        supabase
          .from('profiles')
          .select('id, full_name, email')
          .eq('id', clientId)
          .single(),
        supabase
          .from('trainer_clients')
          .select('id, personal_notes, motivation_message, next_appointment, water_goal, weigh_in_day, weigh_in_reminder_time')
          .eq('trainer_id', profile.id)
          .eq('client_id', clientId)
          .single(),
        supabase
          .from('weight_logs')
          .select('id, weight_kg, logged_at')
          .eq('client_id', clientId)
          .order('logged_at', { ascending: true }),
        supabase
          .from('daily_checkins')
          .select('id, date, mood_emoji, notes')
          .eq('client_id', clientId)
          .order('date', { ascending: false })
          .limit(30),
        supabase
          .from('water_logs')
          .select('id, date, glasses, goal')
          .eq('client_id', clientId)
          .order('date', { ascending: false })
          .limit(30),
        supabase
          .from('progress_photos')
          .select('id, photo_url, taken_at, notes')
          .eq('client_id', clientId)
          .order('taken_at', { ascending: false }),
      ])

      if (profileRes.error) throw profileRes.error
      setClientProfile(profileRes.data)

      if (tcRes.data) {
        setTrainerClient(tcRes.data)
        setMotivationMessage(tcRes.data.motivation_message || '')
        setPersonalNotes(tcRes.data.personal_notes || '')
        setNextAppointment(tcRes.data.next_appointment || '')
        setWaterGoal(tcRes.data.water_goal ?? 8)
        setWeighInDay(tcRes.data.weigh_in_day || 'Monday')
      }

      setWeightLogs(weightRes.data || [])
      setCheckins(checkinRes.data || [])
      setWaterLogs(waterRes.data || [])
      setPhotos(photoRes.data || [])
    } catch (err) {
      console.error('NutritionClientView fetch error:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [profile?.id, clientId])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  async function saveField(field, value) {
    if (!trainerClient) return
    setSaving(true)
    try {
      const { error: updateErr } = await supabase
        .from('trainer_clients')
        .update({ [field]: value })
        .eq('id', trainerClient.id)
      if (updateErr) throw updateErr
    } catch (err) {
      console.error('Save error:', err)
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  // Derived data
  const todayStr = new Date().toISOString().split('T')[0]
  const todayCheckin = checkins.find(c => c.date === todayStr)
  const todayWater = waterLogs.find(w => w.date === todayStr)
  const latestWeight = weightLogs.length > 0 ? weightLogs[weightLogs.length - 1] : null
  const prevWeight = weightLogs.length > 1 ? weightLogs[weightLogs.length - 2] : null
  const weightTrend = latestWeight && prevWeight
    ? (latestWeight.weight_kg - prevWeight.weight_kg).toFixed(1)
    : null

  // Chart data (last 30 days)
  const chartData = weightLogs.slice(-30).map(w => ({
    date: new Date(w.logged_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    weight: w.weight_kg,
  }))

  // Weight table with change column
  const weightTableData = [...weightLogs].reverse().map((w, i, arr) => {
    const prev = arr[i + 1]
    const change = prev ? (w.weight_kg - prev.weight_kg).toFixed(1) : null
    return { ...w, change }
  })

  // Mood calendar (last 30 days)
  const moodDays = []
  for (let i = 29; i >= 0; i--) {
    const d = new Date()
    d.setDate(d.getDate() - i)
    const ds = d.toISOString().split('T')[0]
    const checkin = checkins.find(c => c.date === ds)
    moodDays.push({
      date: ds,
      dayNum: d.getDate(),
      dayName: d.toLocaleDateString('en-US', { weekday: 'short' }),
      emoji: checkin?.mood_emoji || null,
    })
  }

  // Mood breakdown
  const moodCounts = {}
  checkins.forEach(c => {
    if (c.mood_emoji) {
      moodCounts[c.mood_emoji] = (moodCounts[c.mood_emoji] || 0) + 1
    }
  })

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20" style={{ fontFamily: 'Lexend, sans-serif' }}>
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-[#1a1225] border-t-[#7c3bed]" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#0f0a19] p-4 sm:p-6 lg:p-8" style={{ fontFamily: 'Lexend, sans-serif' }}>
      {/* Header */}
      <div className="mb-6 flex items-center gap-4">
        <button
          onClick={() => navigate('/trainer/clients')}
          className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#7c3bed]/10 bg-[#1a1225] text-slate-300 transition hover:bg-[#7c3bed]/20"
        >
          <span className="material-symbols-outlined text-[20px]">arrow_back</span>
        </button>
        <div>
          <h1 className="text-xl font-bold text-white sm:text-2xl">
            {clientProfile?.full_name || 'Client'}
          </h1>
          <p className="text-sm text-slate-400">{clientProfile?.email}</p>
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-400">
          {error}
        </div>
      )}

      {/* Tabs */}
      <div className="mb-6 flex gap-2 overflow-x-auto pb-1">
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-1.5 whitespace-nowrap rounded-full px-4 py-2 text-sm font-medium transition ${
              activeTab === tab.id
                ? 'bg-[#7c3bed] text-white'
                : 'bg-[#1a1225] text-slate-400 hover:text-slate-200'
            }`}
          >
            <span className="material-symbols-outlined text-[18px]">{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === 'overview' && (
        <OverviewTab
          clientProfile={clientProfile}
          latestWeight={latestWeight}
          weightTrend={weightTrend}
          todayCheckin={todayCheckin}
          todayWater={todayWater}
          waterGoal={waterGoal}
          nextAppointment={nextAppointment}
          setNextAppointment={setNextAppointment}
          motivationMessage={motivationMessage}
          setMotivationMessage={setMotivationMessage}
          saveField={saveField}
          saving={saving}
        />
      )}

      {activeTab === 'weight' && (
        <WeightTab chartData={chartData} weightTableData={weightTableData} />
      )}

      {activeTab === 'mood' && (
        <MoodTab moodDays={moodDays} moodCounts={moodCounts} />
      )}

      {activeTab === 'notes' && (
        <NotesTab
          personalNotes={personalNotes}
          setPersonalNotes={setPersonalNotes}
          weighInDay={weighInDay}
          setWeighInDay={setWeighInDay}
          waterGoal={waterGoal}
          setWaterGoal={setWaterGoal}
          nextAppointment={nextAppointment}
          setNextAppointment={setNextAppointment}
          saveField={saveField}
          saving={saving}
        />
      )}

      {activeTab === 'photos' && (
        <PhotosTab photos={photos} />
      )}
    </div>
  )
}

/* ──────────────────────────── Overview Tab ──────────────────────────── */

function OverviewTab({
  clientProfile, latestWeight, weightTrend, todayCheckin, todayWater,
  waterGoal, nextAppointment, setNextAppointment, motivationMessage,
  setMotivationMessage, saveField, saving,
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {/* Client Info */}
      <div className="rounded-2xl border border-[#7c3bed]/10 bg-[#1a1225] p-4">
        <div className="mb-3 flex items-center gap-2 text-slate-400">
          <span className="material-symbols-outlined text-[20px]">person</span>
          <span className="text-xs font-semibold uppercase tracking-wider">Client Info</span>
        </div>
        <p className="text-lg font-semibold text-white">{clientProfile?.full_name}</p>
        <p className="text-sm text-slate-400">{clientProfile?.email}</p>
      </div>

      {/* Current Weight */}
      <div className="rounded-2xl border border-[#7c3bed]/10 bg-[#1a1225] p-4">
        <div className="mb-3 flex items-center gap-2 text-slate-400">
          <span className="material-symbols-outlined text-[20px]">monitor_weight</span>
          <span className="text-xs font-semibold uppercase tracking-wider">Current Weight</span>
        </div>
        {latestWeight ? (
          <div className="flex items-end gap-2">
            <span className="text-2xl font-bold text-white">{latestWeight.weight_kg} kg</span>
            {weightTrend && (
              <span className={`text-sm font-medium ${
                parseFloat(weightTrend) > 0 ? 'text-red-400' : parseFloat(weightTrend) < 0 ? 'text-green-400' : 'text-slate-400'
              }`}>
                {parseFloat(weightTrend) > 0 ? '+' : ''}{weightTrend} kg
              </span>
            )}
          </div>
        ) : (
          <p className="text-sm text-slate-500">No weight logged yet</p>
        )}
      </div>

      {/* Today's Mood */}
      <div className="rounded-2xl border border-[#7c3bed]/10 bg-[#1a1225] p-4">
        <div className="mb-3 flex items-center gap-2 text-slate-400">
          <span className="material-symbols-outlined text-[20px]">mood</span>
          <span className="text-xs font-semibold uppercase tracking-wider">Today's Mood</span>
        </div>
        {todayCheckin?.mood_emoji ? (
          <span className="text-3xl">{todayCheckin.mood_emoji}</span>
        ) : (
          <p className="text-sm text-slate-500">No check-in today</p>
        )}
      </div>

      {/* Water Intake */}
      <div className="rounded-2xl border border-[#7c3bed]/10 bg-[#1a1225] p-4">
        <div className="mb-3 flex items-center gap-2 text-slate-400">
          <span className="material-symbols-outlined text-[20px]">water_drop</span>
          <span className="text-xs font-semibold uppercase tracking-wider">Water Today</span>
        </div>
        {todayWater ? (
          <div className="flex items-end gap-1">
            <span className="text-2xl font-bold text-white">{todayWater.glasses}</span>
            <span className="mb-0.5 text-sm text-slate-400">/ {waterGoal} glasses</span>
          </div>
        ) : (
          <p className="text-sm text-slate-500">No water logged today</p>
        )}
      </div>

      {/* Next Appointment */}
      <div className="rounded-2xl border border-[#7c3bed]/10 bg-[#1a1225] p-4">
        <div className="mb-3 flex items-center gap-2 text-slate-400">
          <span className="material-symbols-outlined text-[20px]">event</span>
          <span className="text-xs font-semibold uppercase tracking-wider">Next Appointment</span>
        </div>
        <input
          type="datetime-local"
          value={nextAppointment || ''}
          onChange={(e) => setNextAppointment(e.target.value)}
          onBlur={() => saveField('next_appointment', nextAppointment || null)}
          className="w-full rounded-lg border border-[#7c3bed]/10 bg-[#0f0a19] px-3 py-2 text-sm text-white focus:border-[#7c3bed] focus:outline-none [color-scheme:dark]"
        />
      </div>

      {/* Motivation Message */}
      <div className="rounded-2xl border border-[#7c3bed]/10 bg-[#1a1225] p-4 sm:col-span-2 lg:col-span-1">
        <div className="mb-3 flex items-center gap-2 text-slate-400">
          <span className="material-symbols-outlined text-[20px]">emoji_objects</span>
          <span className="text-xs font-semibold uppercase tracking-wider">Motivation Message</span>
        </div>
        <textarea
          rows={3}
          value={motivationMessage}
          onChange={(e) => setMotivationMessage(e.target.value)}
          onBlur={() => saveField('motivation_message', motivationMessage || null)}
          placeholder="Write an encouraging message for your client..."
          className="w-full resize-none rounded-lg border border-[#7c3bed]/10 bg-[#0f0a19] px-3 py-2 text-sm text-white placeholder-slate-600 focus:border-[#7c3bed] focus:outline-none"
        />
        {saving && <p className="mt-1 text-xs text-[#7c3bed]">Saving...</p>}
      </div>
    </div>
  )
}

/* ──────────────────────────── Weight Tab ──────────────────────────── */

function WeightTab({ chartData, weightTableData }) {
  return (
    <div className="space-y-6">
      {/* Chart */}
      <div className="rounded-2xl border border-[#7c3bed]/10 bg-[#1a1225] p-4">
        <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-slate-400">
          <span className="material-symbols-outlined text-[20px]">show_chart</span>
          Weight Trend (Last 30 Days)
        </h2>
        {chartData.length > 1 ? (
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis
                  dataKey="date"
                  tick={{ fill: '#94a3b8', fontSize: 12 }}
                  axisLine={{ stroke: 'rgba(255,255,255,0.1)' }}
                  tickLine={false}
                />
                <YAxis
                  domain={['dataMin - 1', 'dataMax + 1']}
                  tick={{ fill: '#94a3b8', fontSize: 12 }}
                  axisLine={{ stroke: 'rgba(255,255,255,0.1)' }}
                  tickLine={false}
                  unit=" kg"
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#1a1225',
                    border: '1px solid rgba(124,59,237,0.2)',
                    borderRadius: '12px',
                    color: '#fff',
                    fontSize: '13px',
                  }}
                  labelStyle={{ color: '#94a3b8' }}
                />
                <Line
                  type="monotone"
                  dataKey="weight"
                  stroke="#7c3bed"
                  strokeWidth={2}
                  dot={{ fill: '#7c3bed', r: 4 }}
                  activeDot={{ r: 6, stroke: '#7c3bed', strokeWidth: 2, fill: '#fff' }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <p className="py-8 text-center text-sm text-slate-500">
            {chartData.length === 1 ? 'Need at least 2 entries to show a chart' : 'No weight data yet'}
          </p>
        )}
      </div>

      {/* Weight Table */}
      <div className="rounded-2xl border border-[#7c3bed]/10 bg-[#1a1225] p-4">
        <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-slate-400">
          <span className="material-symbols-outlined text-[20px]">table_rows</span>
          All Entries
        </h2>
        {weightTableData.length === 0 ? (
          <p className="py-4 text-center text-sm text-slate-500">No weight entries yet</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/5 text-left text-xs uppercase tracking-wider text-slate-500">
                  <th className="pb-3 pr-4">Date</th>
                  <th className="pb-3 pr-4">Weight</th>
                  <th className="pb-3">Change</th>
                </tr>
              </thead>
              <tbody>
                {weightTableData.map((w) => (
                  <tr key={w.id} className="border-b border-white/5">
                    <td className="py-3 pr-4 text-slate-300">{formatDate(w.logged_at)}</td>
                    <td className="py-3 pr-4 font-medium text-white">{w.weight_kg} kg</td>
                    <td className="py-3">
                      {w.change !== null ? (
                        <span className={`font-medium ${
                          parseFloat(w.change) > 0 ? 'text-red-400' : parseFloat(w.change) < 0 ? 'text-green-400' : 'text-slate-400'
                        }`}>
                          {parseFloat(w.change) > 0 ? '+' : ''}{w.change} kg
                        </span>
                      ) : (
                        <span className="text-slate-600">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

/* ──────────────────────────── Mood Tab ──────────────────────────── */

function MoodTab({ moodDays, moodCounts }) {
  return (
    <div className="space-y-6">
      {/* Calendar Grid */}
      <div className="rounded-2xl border border-[#7c3bed]/10 bg-[#1a1225] p-4">
        <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-slate-400">
          <span className="material-symbols-outlined text-[20px]">calendar_month</span>
          Mood Calendar (Last 30 Days)
        </h2>
        <div className="grid grid-cols-7 gap-2 sm:grid-cols-10">
          {moodDays.map((day) => (
            <div
              key={day.date}
              className="flex flex-col items-center gap-1 rounded-xl border border-white/5 bg-[#0f0a19] p-2"
              title={day.date}
            >
              <span className="text-[10px] text-slate-500">{day.dayName}</span>
              <span className="text-xs text-slate-400">{day.dayNum}</span>
              {day.emoji ? (
                <span className="text-xl">{day.emoji}</span>
              ) : (
                <div className="h-6 w-6 rounded-full bg-slate-700/40" />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Mood Breakdown */}
      <div className="rounded-2xl border border-[#7c3bed]/10 bg-[#1a1225] p-4">
        <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-slate-400">
          <span className="material-symbols-outlined text-[20px]">bar_chart</span>
          Mood Breakdown
        </h2>
        {Object.keys(moodCounts).length === 0 ? (
          <p className="py-4 text-center text-sm text-slate-500">No mood data yet</p>
        ) : (
          <div className="flex flex-wrap gap-4">
            {Object.entries(moodCounts)
              .sort((a, b) => b[1] - a[1])
              .map(([emoji, count]) => (
                <div
                  key={emoji}
                  className="flex items-center gap-2 rounded-xl border border-white/5 bg-[#0f0a19] px-4 py-3"
                >
                  <span className="text-2xl">{emoji}</span>
                  <span className="text-lg font-semibold text-white">{count}</span>
                  <span className="text-xs text-slate-500">time{count !== 1 ? 's' : ''}</span>
                </div>
              ))}
          </div>
        )}
      </div>
    </div>
  )
}

/* ──────────────────────────── Notes Tab ──────────────────────────── */

function NotesTab({
  personalNotes, setPersonalNotes, weighInDay, setWeighInDay,
  waterGoal, setWaterGoal, nextAppointment, setNextAppointment,
  saveField, saving,
}) {
  return (
    <div className="space-y-6">
      {/* Personal Notes */}
      <div className="rounded-2xl border border-[#7c3bed]/10 bg-[#1a1225] p-4">
        <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-slate-400">
          <span className="material-symbols-outlined text-[20px]">edit_note</span>
          Personal Dietary Notes
        </h2>
        <textarea
          rows={6}
          value={personalNotes}
          onChange={(e) => setPersonalNotes(e.target.value)}
          onBlur={() => saveField('personal_notes', personalNotes || null)}
          placeholder="Add dietary notes, allergies, preferences, goals..."
          className="w-full resize-none rounded-lg border border-[#7c3bed]/10 bg-[#0f0a19] px-3 py-2 text-sm text-white placeholder-slate-600 focus:border-[#7c3bed] focus:outline-none"
        />
        {saving && <p className="mt-1 text-xs text-[#7c3bed]">Saving...</p>}
      </div>

      {/* Settings Row */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {/* Weigh-in Day */}
        <div className="rounded-2xl border border-[#7c3bed]/10 bg-[#1a1225] p-4">
          <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-slate-400">
            <span className="material-symbols-outlined text-[20px]">calendar_today</span>
            Weigh-in Day
          </h3>
          <select
            value={weighInDay}
            onChange={(e) => {
              setWeighInDay(e.target.value)
              saveField('weigh_in_day', e.target.value)
            }}
            className="w-full rounded-lg border border-[#7c3bed]/10 bg-[#0f0a19] px-3 py-2 text-sm text-white focus:border-[#7c3bed] focus:outline-none"
          >
            {DAYS_OF_WEEK.map(day => (
              <option key={day} value={day}>{day}</option>
            ))}
          </select>
        </div>

        {/* Water Goal */}
        <div className="rounded-2xl border border-[#7c3bed]/10 bg-[#1a1225] p-4">
          <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-slate-400">
            <span className="material-symbols-outlined text-[20px]">water_drop</span>
            Daily Water Goal
          </h3>
          <div className="flex items-center gap-2">
            <input
              type="number"
              min={1}
              max={20}
              value={waterGoal}
              onChange={(e) => setWaterGoal(parseInt(e.target.value) || 8)}
              onBlur={() => saveField('water_goal', waterGoal)}
              className="w-24 rounded-lg border border-[#7c3bed]/10 bg-[#0f0a19] px-3 py-2 text-sm text-white focus:border-[#7c3bed] focus:outline-none"
            />
            <span className="text-sm text-slate-400">glasses</span>
          </div>
        </div>

        {/* Next Appointment */}
        <div className="rounded-2xl border border-[#7c3bed]/10 bg-[#1a1225] p-4">
          <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-slate-400">
            <span className="material-symbols-outlined text-[20px]">event</span>
            Next Appointment
          </h3>
          <input
            type="datetime-local"
            value={nextAppointment || ''}
            onChange={(e) => setNextAppointment(e.target.value)}
            onBlur={() => saveField('next_appointment', nextAppointment || null)}
            className="w-full rounded-lg border border-[#7c3bed]/10 bg-[#0f0a19] px-3 py-2 text-sm text-white focus:border-[#7c3bed] focus:outline-none [color-scheme:dark]"
          />
        </div>
      </div>
    </div>
  )
}

/* ──────────────────────────── Photos Tab ──────────────────────────── */

function PhotosTab({ photos }) {
  if (photos.length === 0) {
    return (
      <div className="rounded-2xl border border-[#7c3bed]/10 bg-[#1a1225] p-12 text-center">
        <span className="material-symbols-outlined text-[48px] text-slate-600">photo_library</span>
        <p className="mt-3 text-sm text-slate-500">No photos yet</p>
        <p className="mt-1 text-xs text-slate-600">
          Progress photos will appear here once your client uploads them.
        </p>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-2 gap-4">
      {photos.map((photo) => (
        <div
          key={photo.id}
          className="overflow-hidden rounded-2xl border border-[#7c3bed]/10 bg-[#1a1225]"
        >
          <img
            src={photo.photo_url}
            alt="Progress photo"
            className="aspect-square w-full object-cover"
          />
          <div className="p-3">
            <p className="text-xs text-slate-400">{formatDate(photo.taken_at)}</p>
            {photo.notes && (
              <p className="mt-1 text-sm text-slate-300">{photo.notes}</p>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}
