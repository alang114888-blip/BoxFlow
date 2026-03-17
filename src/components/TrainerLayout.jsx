import { useState, useEffect } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { supabase } from '../lib/supabase'

const allTabs = [
  { key: 'home', to: '/trainer', label: 'Home', icon: 'home', show: ['fitness', 'nutrition', 'both'] },
  { key: 'clients', to: '/trainer/clients', label: 'Clients', icon: 'group', show: ['fitness', 'nutrition', 'both'] },
  { key: 'workouts', to: '/trainer/workouts', label: 'Workouts', icon: 'exercise', show: ['fitness', 'both'] },
  { key: 'nutrition', to: '/trainer/nutrition', label: 'Nutrition', icon: 'restaurant_menu', show: ['nutrition', 'both'] },
  { key: 'pr', to: '/trainer/pr-board', label: 'PR Board', icon: 'trophy', show: ['fitness', 'both'] },
  { key: 'wod', to: '/trainer/wod', label: 'WOD', icon: 'local_fire_department', show: ['both'] },
  { key: 'settings', to: '/trainer/settings', label: 'Settings', icon: 'settings', show: ['fitness', 'nutrition', 'both'] },
]

export default function TrainerLayout() {
  const { profile } = useAuth()
  const [trainerType, setTrainerType] = useState(null) // null = loading
  const [loadingType, setLoadingType] = useState(true)

  useEffect(() => {
    if (!profile?.id) return
    supabase
      .from('trainer_profiles')
      .select('trainer_type')
      .eq('user_id', profile.id)
      .maybeSingle()
      .then(({ data }) => {
        setTrainerType(data?.trainer_type || 'fitness')
        setLoadingType(false)
      })
  }, [profile?.id])

  const tabs = trainerType ? allTabs.filter((t) => t.show.includes(trainerType)) : []
  const initial = (profile?.full_name || 'T').charAt(0).toUpperCase()

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
      <header className="flex-shrink-0 flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="relative h-10 w-10 rounded-full bg-gradient-to-br from-primary to-purple-400 p-[2px]">
            <div className="flex h-full w-full items-center justify-center rounded-full bg-[#1a1225] text-sm font-bold text-primary">
              {initial}
            </div>
          </div>
          <div className="leading-tight">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-primary">
              {trainerType === 'fitness' ? 'Personal Trainer' : trainerType === 'nutrition' ? 'Nutritionist' : 'Trainer'}
            </p>
            <h1 className="text-lg font-bold tracking-tight">
              Box<span className="text-primary">Flow</span>
            </h1>
          </div>
        </div>
        <button className="relative p-2">
          <span className="material-symbols-outlined text-slate-400 text-[24px]">notifications</span>
          <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-red-500" />
        </button>
      </header>

      {/* Content */}
      <main className="flex-1 overflow-y-auto pb-28">
        <div className="mx-auto max-w-2xl px-4 py-2">
          <Outlet context={{ trainerType }} />
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
