import { useEffect, useState } from 'react'
import {
  UserGroupIcon,
  UsersIcon,
  ClipboardDocumentListIcon,
  PlusIcon,
  XMarkIcon,
  ArrowPathIcon,
  EyeIcon,
  TrashIcon,
  KeyIcon,
} from '@heroicons/react/24/outline'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'

export default function AdminDashboard() {
  const { signOut } = useAuth()

  // Stats
  const [totalTrainers, setTotalTrainers] = useState(0)
  const [totalClients, setTotalClients] = useState(0)
  const [activeWorkoutPlans, setActiveWorkoutPlans] = useState(0)

  // Trainers table
  const [trainers, setTrainers] = useState([])
  const [loadingTrainers, setLoadingTrainers] = useState(true)
  const [error, setError] = useState(null)

  // Add Trainer modal
  const [showAddTrainer, setShowAddTrainer] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteName, setInviteName] = useState('')
  const [trainerType, setTrainerType] = useState('fitness')
  const [inviting, setInviting] = useState(false)
  const [inviteError, setInviteError] = useState(null)
  const [inviteSuccess, setInviteSuccess] = useState(false)

  // Client list viewer
  const [selectedTrainer, setSelectedTrainer] = useState(null)
  const [trainerClients, setTrainerClients] = useState([])
  const [loadingClients, setLoadingClients] = useState(false)

  // Delete trainer
  const [trainerToDelete, setTrainerToDelete] = useState(null)
  const [deleting, setDeleting] = useState(false)

  // Set password (for trainers)
  const [passwordTrainer, setPasswordTrainer] = useState(null)
  const [newPassword, setNewPassword] = useState('')
  const [settingPassword, setSettingPassword] = useState(false)
  const [passwordSuccess, setPasswordSuccess] = useState(false)

  // Change own password
  const [showChangeMyPassword, setShowChangeMyPassword] = useState(false)
  const [myNewPassword, setMyNewPassword] = useState('')
  const [myConfirmPassword, setMyConfirmPassword] = useState('')
  const [changingMyPassword, setChangingMyPassword] = useState(false)
  const [myPasswordError, setMyPasswordError] = useState(null)
  const [myPasswordSuccess, setMyPasswordSuccess] = useState(false)

  useEffect(() => {
    fetchStats()
    fetchTrainers()
  }, [])

  async function fetchStats() {
    try {
      const [trainersRes, clientsRes, plansRes] = await Promise.all([
        supabase
          .from('profiles')
          .select('id', { count: 'exact', head: true })
          .eq('role', 'trainer'),
        supabase
          .from('profiles')
          .select('id', { count: 'exact', head: true })
          .eq('role', 'client'),
        supabase
          .from('workout_plans')
          .select('id', { count: 'exact', head: true })
          .eq('is_active', true),
      ])

      setTotalTrainers(trainersRes.count ?? 0)
      setTotalClients(clientsRes.count ?? 0)
      setActiveWorkoutPlans(plansRes.count ?? 0)
    } catch (err) {
      console.error('Error fetching stats:', err.message)
    }
  }

  async function fetchTrainers() {
    setLoadingTrainers(true)
    setError(null)

    try {
      // Fetch trainers with their trainer_profiles joined
      const { data, error: fetchError } = await supabase
        .from('profiles')
        .select(`
          id,
          full_name,
          email,
          role,
          trainer_profiles (
            id,
            trainer_type,
            specializations
          )
        `)
        .eq('role', 'trainer')
        .order('full_name')

      if (fetchError) throw fetchError

      // For each trainer, get their client count
      const trainersWithCounts = await Promise.all(
        (data || []).map(async (trainer) => {
          const { count } = await supabase
            .from('trainer_clients')
            .select('id', { count: 'exact', head: true })
            .eq('trainer_id', trainer.id)

          return {
            ...trainer,
            clientCount: count ?? 0,
          }
        })
      )

      setTrainers(trainersWithCounts)
    } catch (err) {
      setError(err.message || 'Failed to fetch trainers')
    } finally {
      setLoadingTrainers(false)
    }
  }

  async function handleInviteTrainer(e) {
    e.preventDefault()
    setInviteError(null)
    setInviteSuccess(false)
    setInviting(true)

    try {
      const siteUrl = window.location.origin

      // Send magic link invite with role metadata
      const { error: inviteErr } = await supabase.auth.admin.inviteUserByEmail(
        inviteEmail,
        {
          data: {
            role: 'trainer',
            full_name: inviteName,
            trainer_type: trainerType,
          },
          redirectTo: siteUrl,
        }
      )

      if (inviteErr) {
        // Fallback: if admin API isn't available, use signInWithOtp
        const { error: otpError } = await supabase.auth.signInWithOtp({
          email: inviteEmail,
          options: {
            data: {
              role: 'trainer',
              full_name: inviteName,
              trainer_type: trainerType,
            },
            emailRedirectTo: siteUrl,
          },
        })
        if (otpError) throw otpError
      }

      setInviteSuccess(true)
      setInviteEmail('')
      setInviteName('')
      setTrainerType('fitness')
      // Refresh trainers list after a short delay
      setTimeout(() => {
        fetchStats()
        fetchTrainers()
      }, 1000)
    } catch (err) {
      setInviteError(err.message || 'Failed to send invite')
    } finally {
      setInviting(false)
    }
  }

  async function handleChangeRole(userId, newRole) {
    try {
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ role: newRole })
        .eq('id', userId)

      if (updateError) throw updateError

      fetchStats()
      fetchTrainers()
    } catch (err) {
      setError(err.message || 'Failed to update role')
    }
  }

  async function handleViewClients(trainer) {
    setSelectedTrainer(trainer)
    setLoadingClients(true)

    try {
      const { data, error: fetchError } = await supabase
        .from('trainer_clients')
        .select(`
          id,
          client:profiles!trainer_clients_client_id_fkey (
            id,
            full_name,
            email
          )
        `)
        .eq('trainer_id', trainer.id)

      if (fetchError) throw fetchError
      setTrainerClients(data || [])
    } catch (err) {
      console.error('Error fetching clients:', err.message)
      setTrainerClients([])
    } finally {
      setLoadingClients(false)
    }
  }

  async function handleDeleteTrainer() {
    if (!trainerToDelete) return
    setDeleting(true)
    try {
      const { error: deleteError } = await supabase
        .rpc('delete_user', { user_id: trainerToDelete.id })

      if (deleteError) throw deleteError

      setTrainerToDelete(null)
      fetchStats()
      fetchTrainers()
    } catch (err) {
      setError(err.message || 'Failed to delete trainer')
    } finally {
      setDeleting(false)
    }
  }

  async function handleSetPassword(e) {
    e.preventDefault()
    if (!passwordTrainer || !newPassword) return
    setSettingPassword(true)
    setPasswordSuccess(false)
    try {
      const { error: rpcError } = await supabase
        .rpc('set_user_password', { target_user_id: passwordTrainer.id, new_password: newPassword })
      if (rpcError) throw rpcError
      setPasswordSuccess(true)
      setNewPassword('')
    } catch (err) {
      setError(err.message || 'Failed to set password')
    } finally {
      setSettingPassword(false)
    }
  }

  async function handleChangeMyPassword(e) {
    e.preventDefault()
    setMyPasswordError(null)
    setMyPasswordSuccess(false)
    if (myNewPassword !== myConfirmPassword) {
      setMyPasswordError('Passwords do not match')
      return
    }
    if (myNewPassword.length < 6) {
      setMyPasswordError('Password must be at least 6 characters')
      return
    }
    setChangingMyPassword(true)
    try {
      const { error: updateErr } = await supabase.auth.updateUser({ password: myNewPassword })
      if (updateErr) throw updateErr
      setMyPasswordSuccess(true)
      setMyNewPassword('')
      setMyConfirmPassword('')
    } catch (err) {
      setMyPasswordError(err.message || 'Failed to change password')
    } finally {
      setChangingMyPassword(false)
    }
  }

  const statCards = [
    {
      label: 'Total Trainers',
      value: totalTrainers,
      icon: UserGroupIcon,
      color: 'text-primary-400',
      bg: 'bg-primary-900/30',
    },
    {
      label: 'Total Clients',
      value: totalClients,
      icon: UsersIcon,
      color: 'text-green-400',
      bg: 'bg-green-900/30',
    },
    {
      label: 'Active Workout Plans',
      value: activeWorkoutPlans,
      icon: ClipboardDocumentListIcon,
      color: 'text-amber-400',
      bg: 'bg-amber-900/30',
    },
  ]

  return (
    <div>
      {/* Header */}
      <header className="border-b border-dark-700 bg-dark-800">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-dark-100">
              Admin Dashboard
            </h1>
            <p className="text-sm text-dark-400 mt-0.5">
              Manage trainers, clients, and platform settings
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => { setShowChangeMyPassword(true); setMyPasswordError(null); setMyPasswordSuccess(false); setMyNewPassword(''); setMyConfirmPassword('') }}
              className="inline-flex items-center gap-1.5 rounded-lg border border-dark-600 bg-dark-700 px-4 py-2 text-sm text-dark-200 hover:bg-dark-600 transition"
            >
              <KeyIcon className="h-4 w-4" />
              Change Password
            </button>
            <button
              onClick={signOut}
              className="rounded-lg border border-dark-600 bg-dark-700 px-4 py-2 text-sm text-dark-200 hover:bg-dark-600 transition"
            >
              Sign Out
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {statCards.map((stat) => (
            <div
              key={stat.label}
              className="bg-dark-800 border border-dark-700 rounded-xl p-5 flex items-center gap-4"
            >
              <div className={`${stat.bg} rounded-lg p-3`}>
                <stat.icon className={`h-6 w-6 ${stat.color}`} />
              </div>
              <div>
                <p className="text-sm text-dark-400">{stat.label}</p>
                <p className="text-2xl font-bold text-dark-100">
                  {stat.value}
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* Trainers Section */}
        <div className="bg-dark-800 border border-dark-700 rounded-xl">
          <div className="px-5 py-4 border-b border-dark-700 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-dark-100">Trainers</h2>
            <button
              onClick={() => {
                setShowAddTrainer(true)
                setInviteSuccess(false)
                setInviteError(null)
              }}
              className="inline-flex items-center gap-1.5 rounded-lg bg-primary-600 px-3.5 py-2 text-sm font-medium text-white hover:bg-primary-700 transition"
            >
              <PlusIcon className="h-4 w-4" />
              Add Trainer
            </button>
          </div>

          {error && (
            <div className="mx-5 mt-4 rounded-lg bg-red-900/30 border border-red-700/50 p-3">
              <p className="text-sm text-red-400">{error}</p>
            </div>
          )}

          {loadingTrainers ? (
            <div className="flex items-center justify-center py-12">
              <ArrowPathIcon className="h-6 w-6 text-primary-500 animate-spin" />
            </div>
          ) : trainers.length === 0 ? (
            <div className="text-center py-12">
              <UserGroupIcon className="mx-auto h-10 w-10 text-dark-500" />
              <p className="mt-2 text-dark-400 text-sm">
                No trainers found. Add your first trainer to get started.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-dark-700">
                    <th className="px-5 py-3 text-xs font-medium text-dark-400 uppercase tracking-wider">
                      Name
                    </th>
                    <th className="px-5 py-3 text-xs font-medium text-dark-400 uppercase tracking-wider">
                      Email
                    </th>
                    <th className="px-5 py-3 text-xs font-medium text-dark-400 uppercase tracking-wider">
                      Type
                    </th>
                    <th className="px-5 py-3 text-xs font-medium text-dark-400 uppercase tracking-wider">
                      Clients
                    </th>
                    <th className="px-5 py-3 text-xs font-medium text-dark-400 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-dark-700">
                  {trainers.map((trainer) => (
                    <tr
                      key={trainer.id}
                      className="hover:bg-dark-700/50 transition"
                    >
                      <td className="px-5 py-3 text-sm text-dark-100 font-medium">
                        {trainer.full_name || 'Unnamed'}
                      </td>
                      <td className="px-5 py-3 text-sm text-dark-300">
                        {trainer.email}
                      </td>
                      <td className="px-5 py-3 text-sm">
                        <span className="inline-flex items-center rounded-full bg-primary-900/30 px-2.5 py-0.5 text-xs font-medium text-primary-300 capitalize">
                          {trainer.trainer_profiles?.[0]?.trainer_type || 'N/A'}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-sm text-dark-200">
                        {trainer.clientCount}
                      </td>
                      <td className="px-5 py-3 text-sm">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleViewClients(trainer)}
                            className="inline-flex items-center gap-1 rounded-md bg-dark-700 px-2.5 py-1.5 text-xs text-dark-200 hover:bg-dark-600 transition"
                            title="View clients"
                          >
                            <EyeIcon className="h-3.5 w-3.5" />
                            Clients
                          </button>
                          <select
                            value={trainer.role}
                            onChange={(e) =>
                              handleChangeRole(trainer.id, e.target.value)
                            }
                            className="rounded-md border border-dark-600 bg-dark-700 px-2 py-1.5 text-xs text-dark-200 focus:border-primary-500 focus:outline-none"
                          >
                            <option value="trainer">Trainer</option>
                            <option value="client">Client</option>
                            <option value="super_admin">Admin</option>
                          </select>
                          <button
                            onClick={() => { setPasswordTrainer(trainer); setNewPassword(''); setPasswordSuccess(false) }}
                            className="inline-flex items-center gap-1 rounded-md bg-dark-700 px-2.5 py-1.5 text-xs text-dark-200 hover:bg-dark-600 transition"
                            title="Set password"
                          >
                            <KeyIcon className="h-3.5 w-3.5" />
                            Password
                          </button>
                          <button
                            onClick={() => setTrainerToDelete(trainer)}
                            className="inline-flex items-center gap-1 rounded-md bg-red-900/30 px-2.5 py-1.5 text-xs text-red-400 hover:bg-red-900/50 transition"
                            title="Delete trainer"
                          >
                            <TrashIcon className="h-3.5 w-3.5" />
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>

      {/* Add Trainer Modal */}
      {showAddTrainer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
          <div className="w-full max-w-md bg-dark-800 border border-dark-700 rounded-xl shadow-xl">
            <div className="flex items-center justify-between px-5 py-4 border-b border-dark-700">
              <h3 className="text-lg font-semibold text-dark-100">
                Add Trainer
              </h3>
              <button
                onClick={() => setShowAddTrainer(false)}
                className="rounded-lg p-1 text-dark-400 hover:text-dark-200 hover:bg-dark-700 transition"
              >
                <XMarkIcon className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleInviteTrainer} className="p-5 space-y-4">
              <div>
                <label
                  htmlFor="trainer-name"
                  className="block text-sm font-medium text-dark-200 mb-1.5"
                >
                  Full Name
                </label>
                <input
                  id="trainer-name"
                  type="text"
                  required
                  value={inviteName}
                  onChange={(e) => setInviteName(e.target.value)}
                  placeholder="John Doe"
                  disabled={inviting}
                  className="block w-full rounded-lg border border-dark-600 bg-dark-700 px-3 py-2.5 text-sm text-dark-100 placeholder-dark-400 focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 focus:outline-none transition disabled:opacity-50"
                />
              </div>

              <div>
                <label
                  htmlFor="trainer-email"
                  className="block text-sm font-medium text-dark-200 mb-1.5"
                >
                  Email Address
                </label>
                <input
                  id="trainer-email"
                  type="email"
                  required
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="trainer@example.com"
                  disabled={inviting}
                  className="block w-full rounded-lg border border-dark-600 bg-dark-700 px-3 py-2.5 text-sm text-dark-100 placeholder-dark-400 focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 focus:outline-none transition disabled:opacity-50"
                />
              </div>

              <div>
                <label
                  htmlFor="trainer-type"
                  className="block text-sm font-medium text-dark-200 mb-1.5"
                >
                  Trainer Type
                </label>
                <select
                  id="trainer-type"
                  value={trainerType}
                  onChange={(e) => setTrainerType(e.target.value)}
                  disabled={inviting}
                  className="block w-full rounded-lg border border-dark-600 bg-dark-700 px-3 py-2.5 text-sm text-dark-100 focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 focus:outline-none transition disabled:opacity-50"
                >
                  <option value="fitness">Personal Trainer</option>
                  <option value="nutrition">Nutritionist</option>
                  <option value="both">Both (Trainer + Nutritionist)</option>
                </select>
              </div>

              {inviteError && (
                <div className="rounded-lg bg-red-900/30 border border-red-700/50 p-3">
                  <p className="text-sm text-red-400">{inviteError}</p>
                </div>
              )}

              {inviteSuccess && (
                <div className="rounded-lg bg-green-900/30 border border-green-700/50 p-3">
                  <p className="text-sm text-green-400">
                    Invite sent successfully! The trainer will receive a magic
                    link to set up their account.
                  </p>
                </div>
              )}

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddTrainer(false)}
                  className="rounded-lg border border-dark-600 bg-dark-700 px-4 py-2 text-sm text-dark-200 hover:bg-dark-600 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={inviting}
                  className="inline-flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {inviting ? (
                    <>
                      <ArrowPathIcon className="h-4 w-4 animate-spin" />
                      Sending...
                    </>
                  ) : (
                    'Send Invite'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* View Clients Modal */}
      {selectedTrainer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
          <div className="w-full max-w-lg bg-dark-800 border border-dark-700 rounded-xl shadow-xl">
            <div className="flex items-center justify-between px-5 py-4 border-b border-dark-700">
              <h3 className="text-lg font-semibold text-dark-100">
                Clients of{' '}
                <span className="text-primary-400">
                  {selectedTrainer.full_name || 'Unnamed'}
                </span>
              </h3>
              <button
                onClick={() => {
                  setSelectedTrainer(null)
                  setTrainerClients([])
                }}
                className="rounded-lg p-1 text-dark-400 hover:text-dark-200 hover:bg-dark-700 transition"
              >
                <XMarkIcon className="h-5 w-5" />
              </button>
            </div>

            <div className="p-5">
              {loadingClients ? (
                <div className="flex items-center justify-center py-8">
                  <ArrowPathIcon className="h-6 w-6 text-primary-500 animate-spin" />
                </div>
              ) : trainerClients.length === 0 ? (
                <div className="text-center py-8">
                  <UsersIcon className="mx-auto h-8 w-8 text-dark-500" />
                  <p className="mt-2 text-dark-400 text-sm">
                    This trainer has no clients yet.
                  </p>
                </div>
              ) : (
                <ul className="divide-y divide-dark-700">
                  {trainerClients.map((tc) => (
                    <li
                      key={tc.id}
                      className="flex items-center justify-between py-3"
                    >
                      <div>
                        <p className="text-sm font-medium text-dark-100">
                          {tc.client?.full_name || 'Unnamed'}
                        </p>
                        <p className="text-xs text-dark-400">
                          {tc.client?.email}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="px-5 py-3 border-t border-dark-700 flex justify-end">
              <button
                onClick={() => {
                  setSelectedTrainer(null)
                  setTrainerClients([])
                }}
                className="rounded-lg border border-dark-600 bg-dark-700 px-4 py-2 text-sm text-dark-200 hover:bg-dark-600 transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {trainerToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
          <div className="w-full max-w-sm bg-dark-800 border border-dark-700 rounded-xl shadow-xl p-6">
            <h3 className="text-lg font-semibold text-dark-100 mb-2">
              Delete Trainer
            </h3>
            <p className="text-sm text-dark-300 mb-1">
              Are you sure you want to delete{' '}
              <span className="font-medium text-dark-100">
                {trainerToDelete.full_name || trainerToDelete.email}
              </span>
              ?
            </p>
            <p className="text-xs text-red-400 mb-5">
              This will remove their profile, client relationships, and all associated data. This action cannot be undone.
            </p>
            <div className="flex items-center justify-end gap-3">
              <button
                onClick={() => setTrainerToDelete(null)}
                disabled={deleting}
                className="rounded-lg border border-dark-600 bg-dark-700 px-4 py-2 text-sm text-dark-200 hover:bg-dark-600 transition disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteTrainer}
                disabled={deleting}
                className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 transition disabled:opacity-50"
              >
                {deleting ? (
                  <>
                    <ArrowPathIcon className="h-4 w-4 animate-spin" />
                    Deleting...
                  </>
                ) : (
                  'Delete'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Set Password Modal */}
      {passwordTrainer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
          <div className="w-full max-w-sm bg-dark-800 border border-dark-700 rounded-xl shadow-xl p-6">
            <h3 className="text-lg font-semibold text-dark-100 mb-1">
              Set Password
            </h3>
            <p className="text-sm text-dark-400 mb-4">
              Set a new password for{' '}
              <span className="text-dark-100 font-medium">{passwordTrainer.full_name || passwordTrainer.email}</span>
            </p>
            <form onSubmit={handleSetPassword} className="space-y-4">
              <input
                type="password"
                required
                minLength={6}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="New password (min 6 chars)"
                className="block w-full rounded-lg border border-dark-600 bg-dark-700 px-3 py-2.5 text-sm text-dark-100 placeholder-dark-400 focus:border-primary-500 focus:outline-none"
              />
              {passwordSuccess && (
                <p className="text-sm text-green-400">Password updated successfully!</p>
              )}
              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setPasswordTrainer(null)}
                  className="rounded-lg border border-dark-600 bg-dark-700 px-4 py-2 text-sm text-dark-200 hover:bg-dark-600 transition"
                >
                  Close
                </button>
                <button
                  type="submit"
                  disabled={settingPassword || !newPassword}
                  className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700 transition disabled:opacity-50"
                >
                  {settingPassword ? 'Setting...' : 'Set Password'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Change My Password Modal */}
      {showChangeMyPassword && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
          <div className="w-full max-w-sm bg-dark-800 border border-dark-700 rounded-xl shadow-xl p-6">
            <h3 className="text-lg font-semibold text-dark-100 mb-4">Change My Password</h3>
            <form onSubmit={handleChangeMyPassword} className="space-y-4">
              <div>
                <label className="block text-sm text-dark-300 mb-1">New Password</label>
                <input
                  type="password"
                  required
                  minLength={6}
                  value={myNewPassword}
                  onChange={(e) => setMyNewPassword(e.target.value)}
                  placeholder="Min 6 characters"
                  className="block w-full rounded-lg border border-dark-600 bg-dark-700 px-3 py-2.5 text-sm text-dark-100 placeholder-dark-400 focus:border-primary-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-sm text-dark-300 mb-1">Confirm Password</label>
                <input
                  type="password"
                  required
                  minLength={6}
                  value={myConfirmPassword}
                  onChange={(e) => setMyConfirmPassword(e.target.value)}
                  placeholder="Re-enter password"
                  className="block w-full rounded-lg border border-dark-600 bg-dark-700 px-3 py-2.5 text-sm text-dark-100 placeholder-dark-400 focus:border-primary-500 focus:outline-none"
                />
              </div>
              {myPasswordError && (
                <p className="text-sm text-red-400">{myPasswordError}</p>
              )}
              {myPasswordSuccess && (
                <p className="text-sm text-green-400">Password changed successfully!</p>
              )}
              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowChangeMyPassword(false)}
                  className="rounded-lg border border-dark-600 bg-dark-700 px-4 py-2 text-sm text-dark-200 hover:bg-dark-600 transition"
                >
                  Close
                </button>
                <button
                  type="submit"
                  disabled={changingMyPassword || !myNewPassword || !myConfirmPassword}
                  className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700 transition disabled:opacity-50"
                >
                  {changingMyPassword ? 'Changing...' : 'Change Password'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
