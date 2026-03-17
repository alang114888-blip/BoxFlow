import { NavLink, Outlet } from 'react-router-dom'
import {
  HomeIcon,
  UserGroupIcon,
  ClipboardDocumentListIcon,
  CakeIcon,
  Cog6ToothIcon,
} from '@heroicons/react/24/outline'
import {
  HomeIcon as HomeIconSolid,
  UserGroupIcon as UserGroupIconSolid,
  ClipboardDocumentListIcon as ClipboardDocumentListIconSolid,
  CakeIcon as CakeIconSolid,
  Cog6ToothIcon as Cog6ToothIconSolid,
} from '@heroicons/react/24/solid'

const tabs = [
  { to: '/trainer', label: 'Home', icon: HomeIcon, activeIcon: HomeIconSolid },
  { to: '/trainer/clients', label: 'Clients', icon: UserGroupIcon, activeIcon: UserGroupIconSolid },
  { to: '/trainer/workouts', label: 'Workouts', icon: ClipboardDocumentListIcon, activeIcon: ClipboardDocumentListIconSolid },
  { to: '/trainer/nutrition', label: 'Nutrition', icon: CakeIcon, activeIcon: CakeIconSolid },
  { to: '/trainer/settings', label: 'Settings', icon: Cog6ToothIcon, activeIcon: Cog6ToothIconSolid },
]

export default function TrainerLayout() {
  return (
    <div className="flex h-[100dvh] flex-col bg-dark-900 text-dark-100">
      {/* Top bar - minimal */}
      <header className="flex-shrink-0 border-b border-dark-700 bg-dark-800 px-4 py-3">
        <h1 className="text-center text-lg font-bold tracking-tight">
          Box<span className="text-primary-500">Flow</span>
        </h1>
      </header>

      {/* Content area - scrollable */}
      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-2xl px-4 py-4">
          <Outlet />
        </div>
      </main>

      {/* Bottom navigation */}
      <nav className="flex-shrink-0 border-t border-dark-700 bg-dark-800 pb-[env(safe-area-inset-bottom)]">
        <div className="mx-auto flex max-w-lg justify-around">
          {tabs.map((tab) => (
            <NavLink
              key={tab.to}
              to={tab.to}
              end={tab.to === '/trainer'}
              className={({ isActive }) =>
                `flex flex-col items-center gap-0.5 px-3 py-2 text-[10px] font-medium transition-colors ${
                  isActive
                    ? 'text-primary-500'
                    : 'text-dark-400 hover:text-dark-200'
                }`
              }
            >
              {({ isActive }) => {
                const Icon = isActive ? tab.activeIcon : tab.icon
                return (
                  <>
                    <Icon className="h-6 w-6" />
                    <span>{tab.label}</span>
                  </>
                )
              }}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  )
}
