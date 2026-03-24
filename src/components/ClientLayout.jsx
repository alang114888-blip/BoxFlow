import { useState, useEffect } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { supabase } from '../lib/supabase'
import PullToRefresh from './PullToRefresh'

// Tabs filtered by trainer type
const allTabs = [
  { to: '/client', label: 'Home', icon: 'home', end: true, show: ['fitness', 'nutrition', 'both'] },
  { to: '/client/workouts', label: 'My Workout', icon: 'fitness_center', show: ['fitness', 'both'] },
  { to: '/client/nutrition', label: 'My Nutrition', icon: 'restaurant', show: ['nutrition', 'both'] },
  { to: '/client/prs', label: 'PR Board', icon: 'trophy', show: ['fitness', 'both'] },
  { to: '/client/wod', label: 'WOD', icon: 'local_fire_department', show: ['fitness', 'both'] },
  { to: '/client/calculator', label: 'Settings', icon: 'settings', show: ['fitness', 'nutrition', 'both'] },
]

export default function ClientLayout() {
  const { profile } = useAuth()
  const [trainerType, setTrainerType] = useState(null)
  const [loadingType, setLoadingType] = useState(true)

  const navigate = useNavigate()
  const firstName = profile?.full_name?.split(' ')[0] || 'Athlete'
  const avatarUrl = profile?.avatar_url
  const isTrainerViewing = profile?.role === 'trainer'

  useEffect(() => {
    if (!profile?.id) return
    // Find the client's trainer and get their type
    async function fetchTrainerType() {
      const { data: tc } = await supabase
        .from('trainer_clients')
        .select('trainer_id')
        .eq('client_id', profile.id)
        .eq('invite_accepted', true)
        .limit(1)
        .maybeSingle()

      if (tc?.trainer_id) {
        const { data: tp } = await supabase
          .from('trainer_profiles')
          .select('trainer_type')
          .eq('user_id', tc.trainer_id)
          .maybeSingle()

        setTrainerType(tp?.trainer_type || 'fitness')
      } else {
        // No trainer assigned — show all tabs
        setTrainerType('both')
      }
      setLoadingType(false)
    }
    fetchTrainerType()
  }, [profile?.id])

  const tabs = trainerType ? allTabs.filter((t) => t.show.includes(trainerType)) : []

  if (loadingType) {
    return (
      <div className="h-[100dvh] flex items-center justify-center bg-[#0f0a19]">
        <span className="material-symbols-outlined text-primary animate-spin text-4xl">progress_activity</span>
      </div>
    )
  }

  return (
    <div className="h-[100dvh] flex flex-col bg-[#0f0a19] text-slate-100">
      {/* Header */}
      <header className="flex-shrink-0 px-5 pt-4 pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="rounded-full bg-gradient-to-br from-primary to-purple-400 p-[2px]">
                <div className="h-10 w-10 rounded-full bg-[#1a1225] p-[2px]">
                  {avatarUrl ? (
                    <img src={avatarUrl} alt="" className="h-full w-full rounded-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center rounded-full bg-[#251b3a] text-sm font-bold text-primary">
                      {firstName.charAt(0).toUpperCase()}
                    </div>
                  )}
                </div>
              </div>
              <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-[#0f0a19] bg-emerald-400" />
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">Your Daily Focus</p>
              <h1 className="text-base font-bold text-white">Hey {firstName}!</h1>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#1a1225] text-slate-400 transition hover:text-white">
              <span className="material-symbols-outlined text-[20px]">search</span>
            </button>
            <button className="relative flex h-9 w-9 items-center justify-center rounded-xl bg-[#1a1225] text-slate-400 transition hover:text-white">
              <span className="material-symbols-outlined text-[20px]">notifications</span>
              <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-primary" />
            </button>
          </div>
        </div>
      </header>

      {/* Back to Trainer button — shown when trainer views as client */}
      {isTrainerViewing && (
        <div className="px-5 pb-2">
          <button onClick={() => navigate('/trainer')}
            className="w-full flex items-center justify-center gap-2 rounded-xl bg-primary/10 border border-primary/20 py-2 text-xs font-semibold text-primary hover:bg-primary/20 transition">
            <span className="material-symbols-outlined text-[16px]">arrow_back</span>
            Back to Trainer Dashboard
          </button>
        </div>
      )}

      {/* Content */}
      <PullToRefresh>
        <div className="pb-28">
          <Outlet context={{ trainerType }} />
        </div>
      </PullToRefresh>

      {/* Bottom Navigation */}
      <nav className="fixed inset-x-0 bottom-0 z-50 bg-[#0f0a19]/95 backdrop-blur-xl border-t border-white/5 pb-8">
        <div className="mx-auto flex max-w-lg justify-around px-2 pt-2">
          {tabs.map((tab) => (
            <NavLink
              key={tab.to}
              to={tab.to}
              end={tab.end}
              className={({ isActive }) =>
                `flex flex-col items-center gap-1 px-3 py-1.5 transition-colors ${isActive ? 'text-primary' : 'text-slate-500 hover:text-slate-300'}`
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
                  <span className="text-[9px] font-extrabold uppercase tracking-widest">{tab.label}</span>
                </>
              )}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  )
}
