import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import LoadingSpinner from './LoadingSpinner'

const ROLE_DASHBOARDS = {
  super_admin: '/admin',
  trainer: '/trainer',
  client: '/client',
}

export default function ProtectedRoute({ allowedRoles }) {
  const { user, profile, loading } = useAuth()

  if (loading) {
    return <LoadingSpinner />
  }

  if (!user) {
    return <Navigate to="/login" replace />
  }

  if (allowedRoles && profile && !allowedRoles.includes(profile.role)) {
    const dashboard = ROLE_DASHBOARDS[profile.role] || '/'
    return <Navigate to={dashboard} replace />
  }

  return <Outlet />
}
