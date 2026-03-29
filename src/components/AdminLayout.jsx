import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useState } from 'react'

const navItems = [
  { to: '/admin', icon: 'dashboard', label: 'Dashboard', end: true },
  { to: '/admin/trainers', icon: 'groups', label: 'Trainers' },
  { to: '/admin/clients', icon: 'person', label: 'Clients' },
]

export default function AdminLayout() {
  const { profile, signOut } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [searchQuery, setSearchQuery] = useState('')

  const initials = (profile?.full_name || 'A')
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)

  return (
    <div className="flex h-screen overflow-hidden mesh-bg">
      {/* Sidebar */}
      <aside className="glass-sidebar w-72 flex-shrink-0 flex flex-col border-r border-glass-border">
        {/* Logo */}
        <div className="px-6 py-6 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-primary-dark flex items-center justify-center shadow-lg shadow-primary/30">
            <span className="material-symbols-outlined text-white text-xl">fitness_center</span>
          </div>
          <span className="text-xl font-bold text-white tracking-tight">
            Box<span className="text-primary-light">Flow</span>
          </span>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-4 mt-4 space-y-1">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 ${
                  isActive
                    ? 'bg-primary/10 border border-primary/20 text-primary-light'
                    : 'text-slate-400 hover:text-white hover:bg-white/5 border border-transparent'
                }`
              }
            >
              <span className="material-symbols-outlined text-[20px]">{item.icon}</span>
              {item.label}
            </NavLink>
          ))}
        </nav>

        {/* User Card */}
        <div className="p-4 mt-auto">
          <div className="glass-card rounded-xl p-4">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-primary-dark flex items-center justify-center text-white text-sm font-semibold">
                {initials}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white truncate">
                  {profile?.full_name || 'Admin'}
                </p>
                <p className="text-xs text-slate-400 truncate">
                  {profile?.email || ''}
                </p>
              </div>
            </div>
            <button
              onClick={signOut}
              className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-medium text-slate-400 hover:text-white hover:bg-white/5 transition-colors"
            >
              <span className="material-symbols-outlined text-[16px]">logout</span>
              Sign Out
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header Bar */}
        <header className="flex-shrink-0 h-16 border-b border-glass-border flex items-center justify-between px-8">
          <div className="relative">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-[20px]">search</span>
            <input
              type="text"
              placeholder="Search trainers, clients..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-80 pl-10 pr-4 py-2 rounded-xl bg-white/5 border border-glass-border text-sm text-white placeholder-slate-500 focus:outline-none focus:border-primary/40 transition-colors"
            />
          </div>
          <div className="flex items-center gap-3 flex-shrink-0">
            <div className="flex rounded-lg bg-white/5 border border-white/10 p-0.5 flex-shrink-0">
              <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[11px] font-bold bg-primary text-white transition">
                <span className="material-symbols-outlined text-[14px]">shield</span>
                Admin
              </button>
              <button onClick={() => navigate('/client')}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[11px] font-bold text-emerald-400 hover:bg-emerald-500/10 transition">
                <span className="material-symbols-outlined text-[14px]">fitness_center</span>
                Client
              </button>
            </div>
            <button
              onClick={() => navigate('/admin/trainers')}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-primary to-primary-dark text-white text-sm font-medium hover:shadow-lg hover:shadow-primary/25 transition-all"
            >
              <span className="material-symbols-outlined text-[18px]">person_add</span>
              Add New Trainer
            </button>
          </div>
        </header>

        {/* Scrollable Content */}
        <main className="flex-1 overflow-y-auto p-8">
          <div key={location.pathname} className="page-enter">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  )
}
