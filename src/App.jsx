import { lazy, Suspense } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './hooks/useAuth'
import ProtectedRoute from './components/ProtectedRoute'
import ClientLayout from './components/ClientLayout'
import TrainerLayout from './components/TrainerLayout'
import AdminLayout from './components/AdminLayout'
import LoadingSpinner from './components/LoadingSpinner'
import Auth from './pages/Auth'
import Onboarding from './pages/Onboarding'
import ResetPassword from './pages/ResetPassword'

// Lazy-loaded pages (code splitting)
const AdminDashboard = lazy(() => import('./pages/admin/AdminDashboard'))
const AdminTrainers = lazy(() => import('./pages/admin/AdminTrainers'))
const AdminClients = lazy(() => import('./pages/admin/AdminClients'))
const TrainerDashboard = lazy(() => import('./pages/trainer/TrainerDashboard'))
const ClientManagement = lazy(() => import('./pages/trainer/ClientManagement'))
const ExerciseLibrary = lazy(() => import('./pages/trainer/ExerciseLibrary'))
const WorkoutPlanBuilder = lazy(() => import('./pages/trainer/WorkoutPlanBuilder'))
const NutritionPlanBuilder = lazy(() => import('./pages/trainer/NutritionPlanBuilder'))
const Leaderboard = lazy(() => import('./pages/trainer/Leaderboard'))
const WOD = lazy(() => import('./pages/trainer/WOD'))
const Settings = lazy(() => import('./pages/trainer/Settings'))
const PRBoard = lazy(() => import('./pages/trainer/PRBoard'))
const Templates = lazy(() => import('./pages/trainer/Templates'))
const ClientHistory = lazy(() => import('./pages/trainer/ClientHistory'))
const NutritionClientView = lazy(() => import('./pages/trainer/NutritionClientView'))
const Calendar = lazy(() => import('./pages/trainer/Calendar'))
const ClientDashboard = lazy(() => import('./pages/client/ClientDashboard'))
const MyWorkouts = lazy(() => import('./pages/client/MyWorkouts'))
const MyNutrition = lazy(() => import('./pages/client/MyNutrition'))
const PRTracker = lazy(() => import('./pages/client/PRTracker'))
const PercentageCalculator = lazy(() => import('./pages/client/PercentageCalculator'))
const WODFeed = lazy(() => import('./pages/client/WODFeed'))
const WeeklyCheckIn = lazy(() => import('./pages/client/WeeklyCheckIn'))
const NutritionHome = lazy(() => import('./pages/client/NutritionHome'))
const MyPhotos = lazy(() => import('./pages/client/MyPhotos'))
const ClientLeaderboard = lazy(() => import('./pages/client/Leaderboard'))

function RoleRedirect() {
  const { user, profile, loading } = useAuth()

  if (loading) return <LoadingSpinner />

  if (!user || !profile) return <Navigate to="/login" replace />

  if (!profile.is_onboarded && profile.role !== 'super_admin') {
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
    <Suspense fallback={<LoadingSpinner />}>
      <Routes>
        <Route path="/login" element={<Auth />} />
        <Route path="/onboarding" element={<Onboarding />} />
        <Route path="/reset-password" element={<ResetPassword />} />

        <Route path="/" element={<RoleRedirect />} />

        {/* Admin Routes */}
        <Route element={<ProtectedRoute allowedRoles={['super_admin']} />}>
          <Route element={<AdminLayout />}>
            <Route path="/admin" element={<AdminDashboard />} />
            <Route path="/admin/trainers" element={<AdminTrainers />} />
            <Route path="/admin/clients" element={<AdminClients />} />
          </Route>
        </Route>

        {/* Trainer Routes */}
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
            <Route path="/trainer/templates" element={<Templates />} />
            <Route path="/trainer/client-history/:clientId" element={<ClientHistory />} />
            <Route path="/trainer/nutrition-client/:clientId" element={<NutritionClientView />} />
            <Route path="/trainer/calendar" element={<Calendar />} />
            <Route path="/trainer/settings" element={<Settings />} />
          </Route>
        </Route>

        {/* Client Routes */}
        <Route element={<ProtectedRoute allowedRoles={['client', 'super_admin', 'trainer']} />}>
          <Route element={<ClientLayout />}>
            <Route path="/client" element={<ClientDashboard />} />
            <Route path="/client/workouts" element={<MyWorkouts />} />
            <Route path="/client/nutrition" element={<MyNutrition />} />
            <Route path="/client/prs" element={<PRTracker />} />
            <Route path="/client/calculator" element={<PercentageCalculator />} />
            <Route path="/client/wod" element={<WODFeed />} />
            <Route path="/client/checkin" element={<WeeklyCheckIn />} />
            <Route path="/client/nutrition-home" element={<NutritionHome />} />
            <Route path="/client/photos" element={<MyPhotos />} />
            <Route path="/client/leaderboard" element={<ClientLeaderboard />} />
          </Route>
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  )
}
