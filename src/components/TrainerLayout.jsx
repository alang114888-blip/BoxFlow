import { useState, useEffect } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { supabase } from '../lib/supabase'

// show = which effectiveModes display this tab
// 'fitness' → visible when effectiveMode is 'fitness'
// 'nutrition' → visible when effectiveMode is 'nutrition'
// '*' → always visible regardless of mode
const allTabs = [
  { key: 'home', to: '/trainer', label: 'Home', icon: 'home', show: ['*'] },
  { key: 'clients', to: '/trainer/clients', label: 'Clients', icon: 'group', show: ['*'] },
  { key: 'workouts', to: '/trainer/workouts', label: 'Workouts', icon: 'exercise', show: ['fitness'] },
  { key: 'nutrition', to: '/trainer/nutrition', label: 'Nutrition', icon: 'restaurant_menu', show: ['nutrition'] },
  { key: 'pr', to: '/trainer/pr-board', label: 'PR Board', icon: 'trophy', show: ['fitness'] },
  { key: 'wod', to: '/trainer/wod', label: 'WOD', icon: 'local_fire_department', show: ['fitness'] },
]

export default function TrainerLayout() {
  const { profile } = useAuth()
  const navigate = useNavigate()
  // Use trainer_type from AuthContext profile if available (instant load)
  const [trainerType, setTrainerType] = useState(() => profile?.trainer_type || null)
  const [loadingType, setLoadingType] = useState(!profile?.trainer_type)
  // Mode toggle for 'both' trainers
  const [activeMode, setActiveMode] = useState(() => localStorage.getItem('bf_trainer_mode') || 'fitness')

  useEffect(() => {
    if (!profile?.id) return

    // If AuthContext already has trainer_type, use it immediately
    if (profile.trainer_type && !trainerType) {
      setTrainerType(profile.trainer_type)
      if (profile.trainer_type !== 'both') setActiveMode(profile.trainer_type)
      setLoadingType(false)
    }

    // Always verify from DB
    supabase
      .from('trainer_profiles')
      .select('trainer_type')
      .eq('user_id', profile.id)
      .maybeSingle()
      .then(({ data, error }) => {
        if (error) console.error('TrainerLayout: fetch trainer_type error:', error)
        const type = data?.trainer_type || 'fitness'
        console.log('TrainerLayout: trainer_type from DB:', data?.trainer_type, '| AuthContext:', profile.trainer_type, '→ using:', type)
        setTrainerType(type)
        // If not 'both', force the mode to match type
        if (type !== 'both') setActiveMode(type)
        setLoadingType(false)
      })
  }, [profile?.id])

  function toggleMode(mode) {
    setActiveMode(mode)
    localStorage.setItem('bf_trainer_mode', mode)
  }

  // For 'both' trainers, filter tabs by activeMode
  // For single-type trainers, filter by their type
  const effectiveMode = trainerType === 'both' ? activeMode : trainerType
  const tabs = trainerType
    ? allTabs.filter((t) => t.show.includes('*') || t.show.includes(effectiveMode))
    : []

  const initial = (profile?.full_name || 'T').charAt(0).toUpperCase()
  const modeLabel = effectiveMode === 'fitness' ? 'Personal Trainer' : effectiveMode === 'nutrition' ? 'Nutritionist' : 'Trainer'

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
      <header className="flex-shrink-0 px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="relative h-10 w-10 rounded-full bg-gradient-to-br from-primary to-purple-400 p-[2px]">
              <div className="flex h-full w-full items-center justify-center rounded-full bg-[#1a1225] text-sm font-bold text-primary">
                {initial}
              </div>
            </div>
            <div className="leading-tight">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-primary">{modeLabel}</p>
              <h1 className="text-lg font-bold tracking-tight">Box<span className="text-primary">Flow</span></h1>
            </div>
          </div>
          <div className="flex items-center gap-1">
            {/* Mode toggle — compact, only for 'both' trainers */}
            {trainerType === 'both' && (
              <div className="flex rounded-lg bg-[#1a1225] border border-primary/10 p-0.5">
                <button onClick={() => toggleMode('fitness')}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-all ${activeMode === 'fitness' ? 'bg-primary text-white' : 'text-slate-500'}`}>
                  💪
                </button>
                <button onClick={() => toggleMode('nutrition')}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-all ${activeMode === 'nutrition' ? 'bg-primary text-white' : 'text-slate-500'}`}>
                  🥗
                </button>
              </div>
            )}
            <button onClick={() => navigate('/trainer/settings')} className="p-2 rounded-xl hover:bg-white/5 transition">
              <span className="material-symbols-outlined text-slate-400 text-[24px]">settings</span>
            </button>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 overflow-y-auto pb-28">
        <div className="mx-auto max-w-2xl px-4 py-2">
          <Outlet context={{ trainerType, activeMode: effectiveMode }} />
        </div>
      </main>

      {/* Bottom nav */}
      <nav className="fixed bottom-0 inset-x-0 bg-[#1a1225]/95 backdrop-blur-xl border-t border-white/5 pb-8 z-50">
        <div className="mx-auto flex max-w-lg justify-around pt-2">
          {tabs.map((tab) => (
            <NavLink
              key={tab.key}
              to={tab.to}
              end={tab.to === '/trainer'}
              className={({ isActive }) =>
                `flex flex-col items-center gap-0.5 px-2 py-1.5 transition-colors ${isActive ? 'text-primary' : 'text-slate-500'}`
              }
            >
              {({ isActive }) => (
                <div className={`flex flex-col items-center gap-0.5 ${isActive ? 'rounded-lg bg-primary/10 px-3 py-1' : 'px-3 py-1'}`}>
                  <span
                    className="material-symbols-outlined text-[22px]"
                    style={isActive ? { fontVariationSettings: "'FILL' 1" } : undefined}
                  >
                    {tab.icon}
                  </span>
                  <span className="text-[10px] font-bold uppercase tracking-tighter">{tab.label}</span>
                </div>
              )}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  )
}
