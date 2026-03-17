import { useState, useEffect } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import { format } from 'date-fns'

const CATEGORIES = ['RX', 'Scaled', 'Masters']

const bottomTabs = [
  { to: '/client', label: 'Home', icon: 'home', end: true },
  { to: '/client/workouts', label: 'Workout', icon: 'fitness_center' },
  { to: '/client/nutrition', label: 'Eat', icon: 'restaurant' },
  { to: '/client/prs', label: 'Stats', icon: 'military_tech' },
  { to: '/client/wod', label: 'Social', icon: 'group' },
]

export default function Leaderboard() {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [activeCategory, setActiveCategory] = useState('RX')
  const [wod, setWod] = useState(null)
  const [rankings, setRankings] = useState([])

  useEffect(() => {
    fetchLatestWod()
  }, [])

  useEffect(() => {
    if (wod?.id) {
      fetchResults()
    }
  }, [wod?.id, activeCategory])

  async function fetchLatestWod() {
    try {
      const { data } = await supabase
        .from('wods')
        .select('*')
        .order('published_at', { ascending: false })
        .limit(1)
        .single()

      if (data) setWod(data)
    } catch {
      // no wod found
    }
  }

  async function fetchResults() {
    try {
      setLoading(true)
      const isRx = activeCategory === 'RX'

      let query = supabase
        .from('wod_results')
        .select(`
          id, score, time_seconds, rx, notes, created_at,
          client:profiles!wod_results_client_id_fkey ( id, full_name, avatar_url )
        `)
        .eq('wod_id', wod.id)
        .order('time_seconds', { ascending: true, nullsFirst: false })

      if (activeCategory === 'RX') {
        query = query.eq('rx', true)
      } else if (activeCategory === 'Scaled') {
        query = query.eq('rx', false)
      }
      // Masters: show all for now (could filter by age group)

      const { data } = await query
      setRankings(data || [])
    } catch {
      setRankings([])
    } finally {
      setLoading(false)
    }
  }

  function formatTime(seconds) {
    if (!seconds) return '—'
    const m = Math.floor(seconds / 60)
    const s = seconds % 60
    return `${m}:${s.toString().padStart(2, '0')}`
  }

  return (
    <div className="flex h-[100dvh] flex-col bg-[#0f0a19] text-slate-100">
      {/* Header */}
      <header className="flex-shrink-0 px-5 pt-4 pb-3">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate(-1)}
            className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#1a1225] text-slate-400 transition hover:text-white"
          >
            <span className="material-symbols-outlined text-[20px]">arrow_back</span>
          </button>
          <h1 className="text-sm font-extrabold uppercase tracking-[0.2em] text-white">
            Leaderboard
          </h1>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 overflow-y-auto pb-28 px-5">
        {/* WOD Info */}
        {wod ? (
          <div className="mb-5">
            <p className="text-[10px] font-bold uppercase tracking-widest text-primary">
              WOD Series
            </p>
            <h2 className="mt-1 text-xl font-bold text-white">{wod.title}</h2>
            <p className="text-xs text-slate-500">
              {format(new Date(wod.published_at), 'EEEE, MMMM d, yyyy')}
            </p>
            {wod.description && (
              <p className="mt-2 text-sm leading-relaxed text-slate-400">{wod.description}</p>
            )}
          </div>
        ) : (
          <div className="mb-5 text-center py-8">
            <span className="material-symbols-outlined mb-2 text-[36px] text-slate-600">leaderboard</span>
            <p className="text-sm text-slate-500">No WODs published yet.</p>
          </div>
        )}

        {/* Category Tabs */}
        <div className="mb-5 flex gap-1 rounded-xl bg-[#1a1225] p-1">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`flex-1 rounded-lg py-2 text-xs font-bold uppercase tracking-wider transition ${
                activeCategory === cat
                  ? 'bg-primary text-white shadow-lg shadow-primary/25'
                  : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Rankings Table Header */}
        <div className="mb-2 flex items-center px-3 text-[10px] font-bold uppercase tracking-widest text-slate-500">
          <span className="w-8">#</span>
          <span className="flex-1">Athlete</span>
          <span className="text-right">Time</span>
        </div>

        {/* Rankings */}
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#251b3a] border-t-primary" />
          </div>
        ) : rankings.length === 0 ? (
          <div className="py-12 text-center text-sm text-slate-500">
            No results in this category yet.
          </div>
        ) : (
          <div className="space-y-2">
            {rankings.map((entry, idx) => {
              const rank = idx + 1
              const isCurrentUser = entry.client?.id === profile?.id
              const isGold = rank === 1
              const name = entry.client?.full_name || 'Athlete'
              const avatarUrl = entry.client?.avatar_url
              const initial = name.charAt(0).toUpperCase()

              return (
                <div
                  key={entry.id}
                  className={`relative flex items-center gap-3 rounded-xl px-3 py-3 transition ${
                    isCurrentUser
                      ? 'bg-gradient-to-r from-primary/20 to-purple-500/10 border border-primary/30 shadow-[0_0_20px_-4px_rgba(124,59,237,0.3)]'
                      : isGold
                      ? 'bg-[#1a1225] border border-yellow-500/20 shadow-[0_0_16px_-4px_rgba(234,179,8,0.15)]'
                      : 'bg-[#1a1225] border border-white/5'
                  }`}
                >
                  {/* Rank */}
                  <div className={`flex h-7 w-7 items-center justify-center rounded-lg text-xs font-bold ${
                    isGold
                      ? 'bg-yellow-500/20 text-yellow-500'
                      : rank === 2
                      ? 'bg-slate-400/20 text-slate-400'
                      : rank === 3
                      ? 'bg-amber-700/20 text-amber-600'
                      : 'bg-[#251b3a] text-slate-500'
                  }`}>
                    {rank}
                  </div>

                  {/* Avatar */}
                  <div className={`relative flex-shrink-0 ${isCurrentUser ? 'ring-2 ring-primary rounded-full' : ''}`}>
                    {avatarUrl ? (
                      <img
                        src={avatarUrl}
                        alt=""
                        className="h-9 w-9 rounded-full object-cover"
                      />
                    ) : (
                      <div className={`flex h-9 w-9 items-center justify-center rounded-full text-sm font-bold ${
                        isGold
                          ? 'bg-yellow-500/20 text-yellow-500'
                          : 'bg-[#251b3a] text-primary'
                      }`}>
                        {initial}
                      </div>
                    )}
                  </div>

                  {/* Name + badges */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-sm font-semibold text-white">
                        {name}
                      </p>
                      {isCurrentUser && (
                        <span className="rounded bg-primary/30 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-primary-light">
                          YOU
                        </span>
                      )}
                      {isGold && (
                        <span className="rounded bg-yellow-500/20 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-yellow-500">
                          MVP
                        </span>
                      )}
                    </div>
                    {entry.score && (
                      <p className="text-[11px] text-slate-500">{entry.score}</p>
                    )}
                  </div>

                  {/* Time */}
                  <span className={`text-sm font-bold ${
                    isGold ? 'text-yellow-500' : isCurrentUser ? 'text-primary-light' : 'text-slate-300'
                  }`}>
                    {formatTime(entry.time_seconds)}
                  </span>
                </div>
              )
            })}
          </div>
        )}
      </main>

      {/* Bottom Navigation */}
      <nav className="fixed inset-x-0 bottom-0 z-50 bg-[#0f0a19]/95 backdrop-blur-xl border-t border-white/5 pb-8">
        <div className="mx-auto flex max-w-lg justify-around px-2 pt-2">
          {bottomTabs.map((tab) => (
            <NavLink
              key={tab.to}
              to={tab.to}
              end={tab.end}
              className={({ isActive }) =>
                `flex flex-col items-center gap-1 px-3 py-1.5 transition-colors ${
                  isActive
                    ? 'text-primary'
                    : 'text-slate-500 hover:text-slate-300'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <span
                    className="material-symbols-outlined text-[22px]"
                    style={isActive ? { fontVariationSettings: "'FILL' 1" } : undefined}
                  >
                    {tab.icon}
                  </span>
                  <span className="text-[9px] font-extrabold uppercase tracking-widest">
                    {tab.label}
                  </span>
                </>
              )}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  )
}
