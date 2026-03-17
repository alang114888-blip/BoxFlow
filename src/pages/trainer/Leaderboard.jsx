import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'

export default function Leaderboard() {
  const { profile } = useAuth()
  const [wods, setWods] = useState([])
  const [selectedWod, setSelectedWod] = useState(null)
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(true)
  const [showHistory, setShowHistory] = useState(false)

  useEffect(() => {
    if (!profile) return
    fetchWods()
  }, [profile])

  async function fetchWods() {
    try {
      setLoading(true)
      const { data } = await supabase
        .from('wods')
        .select('*')
        .eq('trainer_id', profile.id)
        .order('published_at', { ascending: false })

      setWods(data || [])
      if (data?.length > 0) {
        setSelectedWod(data[0])
        await fetchResults(data[0].id)
      }
    } catch (err) {
      console.error('Fetch WODs error:', err)
    } finally {
      setLoading(false)
    }
  }

  async function fetchResults(wodId) {
    const { data } = await supabase
      .from('wod_results')
      .select(`
        id, score, time_seconds, rx, notes, created_at,
        profiles:client_id ( id, full_name, email )
      `)
      .eq('wod_id', wodId)
      .order('time_seconds', { ascending: true, nullsFirst: false })

    setResults(data || [])
  }

  async function selectWod(wod) {
    setSelectedWod(wod)
    setShowHistory(false)
    await fetchResults(wod.id)
  }

  function formatTime(seconds) {
    if (!seconds) return '—'
    const m = Math.floor(seconds / 60)
    const s = seconds % 60
    return `${m}:${s.toString().padStart(2, '0')}`
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <span className="material-symbols-outlined text-primary animate-spin text-3xl">progress_activity</span>
      </div>
    )
  }

  if (wods.length === 0) {
    return (
      <div className="text-center py-20">
        <span className="material-symbols-outlined text-slate-600 text-5xl mb-3">leaderboard</span>
        <p className="text-slate-400 text-sm">No WODs published yet.</p>
        <p className="text-slate-500 text-xs mt-1">Create a workout with Metcon section and enable "Publish to Leaderboard"</p>
      </div>
    )
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold text-white">Leaderboard</h2>
        <button
          onClick={() => setShowHistory(!showHistory)}
          className="flex items-center gap-1 text-xs font-medium text-primary hover:text-primary-light transition"
        >
          <span className="material-symbols-outlined text-[16px]">{showHistory ? 'close' : 'history'}</span>
          {showHistory ? 'Close' : 'History'}
        </button>
      </div>

      {/* WOD History List */}
      {showHistory && (
        <div className="mb-4 space-y-2 max-h-60 overflow-y-auto rounded-2xl border border-primary/10 bg-[#1a1426] p-3">
          {wods.map((wod) => (
            <button
              key={wod.id}
              onClick={() => selectWod(wod)}
              className={`w-full text-left px-3 py-2.5 rounded-xl transition ${
                selectedWod?.id === wod.id ? 'bg-primary/20 border border-primary/30' : 'hover:bg-white/5'
              }`}
            >
              <p className="text-sm font-medium text-white truncate">{wod.title}</p>
              <p className="text-[10px] text-slate-400">
                {new Date(wod.published_at).toLocaleDateString()}
              </p>
            </button>
          ))}
        </div>
      )}

      {/* Selected WOD Info */}
      {selectedWod && (
        <div className="mb-4 rounded-2xl border border-primary/10 bg-[#1a1426] p-4">
          <div className="flex items-center gap-2 mb-1">
            <span className="h-1 w-6 bg-primary rounded-full" />
            <span className="text-[9px] font-bold uppercase tracking-widest text-primary">Active WOD</span>
          </div>
          <h3 className="text-lg font-bold text-white">{selectedWod.title}</h3>
          <p className="text-xs text-slate-400 mt-1">{selectedWod.description}</p>
          <p className="text-[10px] text-slate-500 mt-2 flex items-center gap-1">
            <span className="material-symbols-outlined text-[14px]">calendar_today</span>
            {new Date(selectedWod.published_at).toLocaleDateString()}
          </p>
        </div>
      )}

      {/* Results Table */}
      <div className="rounded-2xl border border-primary/10 bg-[#1a1426] overflow-hidden">
        <div className="px-4 py-3 border-b border-white/5 flex items-center text-[9px] font-bold uppercase tracking-widest text-slate-500">
          <div className="w-8">#</div>
          <div className="flex-1 ml-2">Athlete</div>
          <div className="w-16 text-center">Score</div>
          <div className="w-16 text-right">Time</div>
        </div>

        {results.length === 0 ? (
          <div className="p-8 text-center">
            <span className="material-symbols-outlined text-slate-600 text-3xl mb-2">group_off</span>
            <p className="text-slate-500 text-sm">No results logged yet</p>
          </div>
        ) : (
          <div className="divide-y divide-white/5">
            {results.map((r, i) => {
              const rank = i + 1
              const isFirst = rank === 1
              return (
                <div
                  key={r.id}
                  className={`flex items-center px-4 py-3 transition ${
                    isFirst ? 'bg-yellow-500/5' : 'hover:bg-white/[0.02]'
                  }`}
                >
                  <div className="w-8">
                    <span className={`font-black text-lg italic ${isFirst ? 'text-yellow-500' : 'text-slate-500'}`}>
                      {rank}
                    </span>
                  </div>
                  <div className="flex-1 ml-2 flex items-center gap-3">
                    <div className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold ${
                      isFirst
                        ? 'bg-yellow-500/20 text-yellow-500 border border-yellow-500/30'
                        : 'bg-white/5 text-slate-400 border border-white/10'
                    }`}>
                      {(r.profiles?.full_name || '?').charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-white">{r.profiles?.full_name || r.profiles?.email || '—'}</p>
                      <div className="flex items-center gap-2">
                        {r.rx && <span className="text-[8px] font-black uppercase tracking-wider text-primary bg-primary/10 px-1.5 py-0.5 rounded">Rx</span>}
                        {r.notes && <span className="text-[10px] text-slate-500 truncate max-w-[120px]">{r.notes}</span>}
                      </div>
                    </div>
                  </div>
                  <div className="w-16 text-center text-sm font-medium text-slate-300">{r.score || '—'}</div>
                  <div className="w-16 text-right text-sm font-bold text-white italic">{formatTime(r.time_seconds)}</div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
