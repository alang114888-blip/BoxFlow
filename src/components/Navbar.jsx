import { useState } from 'react'
import { NavLink } from 'react-router-dom'
import { Bars3Icon, XMarkIcon, ArrowRightStartOnRectangleIcon } from '@heroicons/react/24/outline'
import { useAuth } from '../hooks/useAuth'

const NAV_LINKS = {
  super_admin: [
    { to: '/admin', label: 'Dashboard' },
  ],
  trainer: [
    { to: '/trainer', label: 'Dashboard' },
    { to: '/trainer/clients', label: 'Clients' },
    { to: '/trainer/exercises', label: 'Exercises' },
    { to: '/trainer/workouts', label: 'Workouts' },
    { to: '/trainer/nutrition', label: 'Nutrition' },
    { to: '/trainer/leaderboard', label: 'Leaderboard' },
  ],
  client: [
    { to: '/client', label: 'Dashboard' },
    { to: '/client/workouts', label: 'Workouts' },
    { to: '/client/nutrition', label: 'Nutrition' },
    { to: '/client/prs', label: 'PRs' },
    { to: '/client/calculator', label: 'Calculator' },
  ],
}

const ROLE_LABELS = {
  super_admin: 'Admin',
  trainer: 'Trainer',
  client: 'Client',
}

export default function Navbar() {
  const { profile, signOut } = useAuth()
  const [mobileOpen, setMobileOpen] = useState(false)

  const links = NAV_LINKS[profile?.role] || []
  const roleLabel = ROLE_LABELS[profile?.role] || ''

  function linkClasses({ isActive }) {
    return `px-3 py-2 rounded-md text-sm font-medium transition-colors ${
      isActive
        ? 'bg-primary-500/20 text-primary-500'
        : 'text-dark-100 hover:bg-dark-700 hover:text-white'
    }`
  }

  async function handleSignOut() {
    try {
      await signOut()
    } catch (error) {
      console.error('Sign out error:', error.message)
    }
  }

  return (
    <nav className="bg-dark-800 border-b border-dark-700">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          {/* Brand */}
          <div className="flex items-center gap-8">
            <span className="text-xl font-bold text-primary-500">BoxFlow</span>

            {/* Desktop links */}
            <div className="hidden md:flex items-center gap-1">
              {links.map((link) => (
                <NavLink key={link.to} to={link.to} className={linkClasses}>
                  {link.label}
                </NavLink>
              ))}
            </div>
          </div>

          {/* Right side */}
          <div className="hidden md:flex items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-sm text-dark-100">
                {profile?.full_name || profile?.email}
              </span>
              {roleLabel && (
                <span className="rounded-full bg-primary-500/20 px-2 py-0.5 text-xs font-medium text-primary-500">
                  {roleLabel}
                </span>
              )}
            </div>
            <button
              onClick={handleSignOut}
              className="flex items-center gap-1 rounded-md px-3 py-2 text-sm text-dark-300 transition-colors hover:bg-dark-700 hover:text-white"
            >
              <ArrowRightStartOnRectangleIcon className="h-5 w-5" />
              Sign out
            </button>
          </div>

          {/* Mobile hamburger */}
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="md:hidden rounded-md p-2 text-dark-300 hover:bg-dark-700 hover:text-white"
          >
            {mobileOpen ? (
              <XMarkIcon className="h-6 w-6" />
            ) : (
              <Bars3Icon className="h-6 w-6" />
            )}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="md:hidden border-t border-dark-700 px-4 pb-4 pt-2">
          <div className="flex flex-col gap-1">
            {links.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                className={linkClasses}
                onClick={() => setMobileOpen(false)}
              >
                {link.label}
              </NavLink>
            ))}
          </div>
          <div className="mt-4 flex items-center justify-between border-t border-dark-700 pt-4">
            <div className="flex items-center gap-2">
              <span className="text-sm text-dark-100">
                {profile?.full_name || profile?.email}
              </span>
              {roleLabel && (
                <span className="rounded-full bg-primary-500/20 px-2 py-0.5 text-xs font-medium text-primary-500">
                  {roleLabel}
                </span>
              )}
            </div>
            <button
              onClick={handleSignOut}
              className="flex items-center gap-1 rounded-md px-3 py-2 text-sm text-dark-300 hover:bg-dark-700 hover:text-white"
            >
              <ArrowRightStartOnRectangleIcon className="h-5 w-5" />
              Sign out
            </button>
          </div>
        </div>
      )}
    </nav>
  )
}
