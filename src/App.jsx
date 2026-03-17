import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './hooks/useAuth'
import ProtectedRoute from './components/ProtectedRoute'
import Layout from './components/Layout'
import ClientLayout from './components/ClientLayout'
import TrainerLayout from './components/TrainerLayout'
import LoadingSpinner from './components/LoadingSpinner'
import Auth from './pages/Auth'
import AdminLayout from './components/AdminLayout'
import AdminDashboard from './pages/admin/AdminDashboard'
import AdminTrainers from './pages/admin/AdminTrainers'
import TrainerDashboard from './pages/trainer/TrainerDashboard'
import ClientManagement from './pages/trainer/ClientManagement'
import ExerciseLibrary from './pages/trainer/ExerciseLibrary'
import WorkoutPlanBuilder from './pages/trainer/WorkoutPlanBuilder'
import NutritionPlanBuilder from './pages/trainer/NutritionPlanBuilder'
import Leaderboard from './pages/trainer/Leaderboard'
import WOD from './pages/trainer/WOD'
import Settings from './pages/trainer/Settings'
import PRBoard from './pages/trainer/PRBoard'
import ClientDashboard from './pages/client/ClientDashboard'
import MyWorkouts from './pages/client/MyWorkouts'
import MyNutrition from './pages/client/MyNutrition'
import PRTracker from './pages/client/PRTracker'
import PercentageCalculator from './pages/client/PercentageCalculator'
import WODFeed from './pages/client/WODFeed'
import ClientLeaderboard from './pages/client/Leaderboard'
import Onboarding from './pages/Onboarding'

function RoleRedirect() {
  const { user, profile, loading } = useAuth()

  if (loading) return <LoadingSpinner />

  if (!user || !profile) return <Navigate to="/login" replace />

  // New users without phone → onboarding
  if (!profile.phone && profile.role !== 'super_admin') {
    return <Navigate to="/onboarding" replace />
  }

  switch (profile.role) {
    case 'super_admin':
      return <Navigate to="/admin" replace />
    case 'trainer':
      return <Navigate to="/trainer" replace />
    case 'client':
      return <Navigate to="/client" replace />
    default:
      return <Navigate to="/login" replace />
  }
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Auth />} />
      <Route path="/onboarding" element={<Onboarding />} />

      <Route path="/" element={<RoleRedirect />} />

      {/* Admin Routes */}
      <Route element={<ProtectedRoute allowedRoles={['super_admin']} />}>
        <Route element={<AdminLayout />}>
          <Route path="/admin" element={<AdminDashboard />} />
          <Route path="/admin/trainers" element={<AdminTrainers />} />
        </Route>
      </Route>

      {/* Trainer Routes — mobile-first bottom nav layout */}
      <Route element={<ProtectedRoute allowedRoles={['trainer']} />}>
        <Route element={<TrainerLayout />}>
          <Route path="/trainer" element={<TrainerDashboard />} />
          <Route path="/trainer/clients" element={<ClientManagement />} />
          <Route path="/trainer/exercises" element={<ExerciseLibrary />} />
          <Route path="/trainer/workouts" element={<WorkoutPlanBuilder />} />
          <Route path="/trainer/nutrition" element={<NutritionPlanBuilder />} />
          <Route path="/trainer/leaderboard" element={<Leaderboard />} />
          <Route path="/trainer/wod" element={<WOD />} />
          <Route path="/trainer/pr-board" element={<PRBoard />} />
          <Route path="/trainer/settings" element={<Settings />} />
        </Route>
      </Route>

      {/* Client Routes */}
      <Route element={<ProtectedRoute allowedRoles={['client']} />}>
        <Route element={<ClientLayout />}>
          <Route path="/client" element={<ClientDashboard />} />
          <Route path="/client/workouts" element={<MyWorkouts />} />
          <Route path="/client/nutrition" element={<MyNutrition />} />
          <Route path="/client/prs" element={<PRTracker />} />
          <Route path="/client/calculator" element={<PercentageCalculator />} />
          <Route path="/client/wod" element={<WODFeed />} />
        </Route>
        {/* Leaderboard has its own full-screen layout */}
        <Route path="/client/leaderboard" element={<ClientLeaderboard />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
