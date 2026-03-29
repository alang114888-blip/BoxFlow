import { useState, useEffect } from 'react'
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { supabase } from '../lib/supabase'
import PullToRefresh from './PullToRefresh'

// Tabs filtered by trainer type
const allTabs = [
  { to: '/client', label: 'Home', icon: 'home', end: true, show: ['*'] },
  { to: '/client/workouts', label: 'My Workout', icon: 'fitness_center', show: ['fitness'] },
  { to: '/client/nutrition', label: 'My Nutrition', icon: 'restaurant', show: ['nutrition'] },
  { to: '/client/prs', label: 'PR Board', icon: 'trophy', show: ['fitness'] },
  { to: '/client/wod', label: 'WOD', icon: 'local_fire_department', show: ['fitness'] },
  { to: '/client/calculator', label: 'Settings', icon: 'settings', show: ['*'] },
]

export default function ClientLayout() {
  const { profile } = useAuth()
  const [trainerType, setTrainerType] = useState(null)
  const [loadingType, setLoadingType] = useState(true)
  const [hasTrainer, setHasTrainer] = useState(true)
  const [clientMode, setClientMode] = useState('fitness')

  const navigate = useNavigate()
  const location = useLocation()
  const firstName = profile?.full_name?.split(' ')[0] || 'Athlete'
  const avatarUrl = profile?.avatar_url
  const isTrainerViewing = profile?.role === 'trainer'

  useEffect(() => {
    if (!profile?.id) return
    async function fetchTrainerType() {
      if (profile?.role === 'super_admin' || profile?.role === 'trainer') {
        setTrainerType('both')
        setHasTrainer(true)
        setLoadingType(false)
        return
      }
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
        setHasTrainer(true)
      } else {
        setHasTrainer(false)
        setTrainerType(null)
      }
      setLoadingType(false)
    }
    fetchTrainerType()
  }, [profile?.id])

  const effectiveMode = trainerType === 'both' ? clientMode : trainerType
  const tabs = trainerType ? allTabs.filter((t) => t.show.includes(effectiveMode) || t.show.includes('*')) : []

  if (loadingType) {
    return (
      <div className="h-[100dvh] flex items-center justify-center bg-[#0f0a19]">
        <span className="material-symbols-outlined text-primary animate-spin text-4xl">progress_activity</span>
      </div>
    )
  }

  if (!hasTrainer && !isTrainerViewing) {
    return (
      <div className="h-[100dvh] flex flex-col items-center justify-center bg-[#0f0a19] text-slate-100 p-6">
        <div className="w-16 h-16 rounded-2xl bg-red-500/10 flex items-center justify-center mb-4">
          <span className="material-symbols-outlined text-red-400 text-3xl">lock</span>
        </div>
        <h2 className="text-xl font-bold text-white mb-2">No trainer assigned</h2>
        <p className="text-slate-400 text-sm text-center max-w-[280px]">
          You need to be connected to a trainer or nutritionist to access the app. Ask your coach to send you an invite.
        </p>
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
          <div className="flex items-center gap-1">
            {trainerType === 'both' && (
              <div className="flex rounded-lg bg-[#1a1225] border border-primary/10 p-0.5">
                <button onClick={() => setClientMode('fitness')}
                  className={`px-2.5 py-1 rounded-md text-[10px] font-bold transition ${clientMode === 'fitness' ? 'bg-primary text-white' : 'text-slate-400'}`}>
                  💪
                </button>
                <button onClick={() => setClientMode('nutrition')}
                  className={`px-2.5 py-1 rounded-md text-[10px] font-bold transition ${clientMode === 'nutrition' ? 'bg-primary text-white' : 'text-slate-400'}`}>
                  🥗
                </button>
              </div>
            )}
            <button className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#1a1225] text-slate-400 transition hover:text-white">
              <span className="material-symbols-outlined text-[20px]">settings</span>
            </button>
          </div>
        </div>
      </header>

      {profile?.role === 'super_admin' && (
        <div className="flex rounded-lg bg-white/5 border border-white/10 p-0.5 mx-5 mt-2 mb-1">
          <button onClick={() => navigate('/admin')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[11px] font-bold text-slate-400 hover:text-white transition">
            <span className="material-symbols-outlined text-[14px]">shield</span>
            Admin
          </button>
          <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[11px] font-bold bg-emerald-500 text-white transition">
            <span className="material-symbols-outlined text-[14px]">fitness_center</span>
            Client
          </button>
        </div>
      )}
      {profile?.role === 'trainer' && (
        <div className="flex rounded-lg bg-white/5 border border-white/10 p-0.5 mx-5 mt-2 mb-1">
          <button onClick={() => navigate('/trainer')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[11px] font-bold text-slate-400 hover:text-white transition">
            <span className="material-symbols-outlined text-[14px]">exercise</span>
            Trainer
          </button>
          <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[11px] font-bold bg-emerald-500 text-white transition">
            <span className="material-symbols-outlined text-[14px]">fitness_center</span>
            Client
          </button>
        </div>
      )}

      {/* Content */}
      <PullToRefresh>
        <div key={location.pathname} className="page-enter pb-28">
          <Outlet context={{ trainerType, clientMode: effectiveMode }} />
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
