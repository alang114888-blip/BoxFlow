import { NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'

const tabs = [
  { to: '/client', label: 'Home', icon: 'home', end: true },
  { to: '/client/workouts', label: 'Workout', icon: 'fitness_center' },
  { to: '/client/nutrition', label: 'Eat', icon: 'restaurant' },
  { to: '/client/prs', label: 'Stats', icon: 'military_tech' },
  { to: '/client/wod', label: 'Social', icon: 'group' },
]

export default function ClientLayout() {
  const { profile } = useAuth()
  const firstName = profile?.full_name?.split(' ')[0] || 'Athlete'
  const avatarUrl = profile?.avatar_url

  return (
    <div className="h-[100dvh] flex flex-col bg-[#0f0a19] text-slate-100">
      {/* Header */}
      <header className="flex-shrink-0 px-5 pt-4 pb-3">
        <div className="flex items-center justify-between">
          {/* Left: Avatar + Greeting */}
          <div className="flex items-center gap-3">
            {/* Avatar with gradient ring + online dot */}
            <div className="relative">
              <div className="rounded-full bg-gradient-to-br from-primary to-purple-400 p-[2px]">
                <div className="h-10 w-10 rounded-full bg-[#1a1225] p-[2px]">
                  {avatarUrl ? (
                    <img
                      src={avatarUrl}
                      alt=""
                      className="h-full w-full rounded-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center rounded-full bg-[#251b3a] text-sm font-bold text-primary">
                      {firstName.charAt(0).toUpperCase()}
                    </div>
                  )}
                </div>
              </div>
              {/* Online dot */}
              <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-[#0f0a19] bg-emerald-400" />
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">
                Your Daily Focus
              </p>
              <h1 className="text-base font-bold text-white">
                Hey {firstName}!
              </h1>
            </div>
          </div>

          {/* Right: Search + Notifications */}
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

      {/* Content */}
      <main className="flex-1 overflow-y-auto pb-28">
        <Outlet />
      </main>

      {/* Bottom Navigation */}
      <nav className="fixed inset-x-0 bottom-0 z-50 bg-[#0f0a19]/95 backdrop-blur-xl border-t border-white/5 pb-8">
        <div className="mx-auto flex max-w-lg justify-around px-2 pt-2">
          {tabs.map((tab) => (
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
