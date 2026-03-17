import { useState, useEffect } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { supabase } from '../lib/supabase'

const allTabs = [
  { key: 'home', to: '/trainer', label: 'Home', icon: 'home', show: ['fitness', 'nutrition', 'both'] },
  { key: 'clients', to: '/trainer/clients', label: 'Clients', icon: 'group', show: ['fitness', 'nutrition', 'both'] },
  { key: 'workouts', to: '/trainer/workouts', label: 'Workouts', icon: 'exercise', show: ['fitness', 'both'] },
  { key: 'nutrition', to: '/trainer/nutrition', label: 'Nutrition', icon: 'restaurant_menu', show: ['nutrition', 'both'] },
  { key: 'pr', to: '/trainer/leaderboard', label: 'PR', icon: 'trophy', show: ['fitness', 'both'] },
  { key: 'settings', to: '/trainer/settings', label: 'Settings', icon: 'settings', show: ['fitness', 'nutrition', 'both'] },
]

export default function TrainerLayout() {
  const { profile } = useAuth()
  const [trainerType, setTrainerType] = useState('both')

  useEffect(() => {
    if (!profile?.id) return
    supabase
      .from('trainer_profiles')
      .select('trainer_type')
      .eq('user_id', profile.id)
      .maybeSingle()
      .then(({ data }) => {
        if (data?.trainer_type) setTrainerType(data.trainer_type)
      })
  }, [profile?.id])

  const tabs = allTabs.filter((t) => t.show.includes(trainerType))
  const initial = (profile?.full_name || 'T').charAt(0).toUpperCase()

  return (
    <div className="h-[100dvh] flex flex-col bg-bg text-dark-100">
      {/* Header */}
      <header className="flex-shrink-0 flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-3">
          {/* Avatar with gradient ring */}
          <div className="relative h-10 w-10 rounded-full bg-gradient-to-br from-primary to-purple-400 p-[2px]">
            <div className="flex h-full w-full items-center justify-center rounded-full bg-surface text-sm font-bold text-primary">
              {initial}
            </div>
          </div>
          <div className="leading-tight">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-primary">Premium Trainer</p>
            <h1 className="text-lg font-bold tracking-tight text-dark-100">
              Box<span className="text-primary">Flow</span>
            </h1>
          </div>
        </div>
        {/* Notifications bell */}
        <button className="relative p-2">
          <span className="material-symbols-outlined text-dark-300 text-[24px]">notifications</span>
          <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-red-500" />
        </button>
      </header>

      {/* Content area */}
      <main className="flex-1 overflow-y-auto pb-32">
        <div className="mx-auto max-w-2xl px-4 py-2">
          <Outlet />
        </div>
      </main>

      {/* Bottom navigation */}
      <nav className="fixed bottom-0 inset-x-0 bg-surface border-t border-primary/10 pb-8 z-50">
        <div className="mx-auto flex max-w-lg justify-around pt-2">
          {tabs.map((tab) => (
            <NavLink
              key={tab.key}
              to={tab.to}
              end={tab.to === '/trainer'}
              className={({ isActive }) =>
                `flex flex-col items-center gap-0.5 px-2 py-1.5 transition-colors ${
                  isActive ? 'text-primary' : 'text-slate-400'
                }`
              }
            >
              {({ isActive }) => (
                <div className={`flex flex-col items-center gap-0.5 ${isActive ? 'rounded-lg bg-primary/10 px-3 py-1' : 'px-3 py-1'}`}>
                  <span
                    className="material-symbols-outlined text-[22px]"
                    style={isActive ? { fontVariationSettings: "'FILL' 1, 'wght' 400, 'GRAD' 0, 'opsz' 24" } : undefined}
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
