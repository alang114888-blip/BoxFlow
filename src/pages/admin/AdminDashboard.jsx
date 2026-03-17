import { useEffect, useState } from 'react'
import { supabase, SITE_URL } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import PasswordInput, { validatePassword, validatePasswordMatch } from '../../components/PasswordInput'

export default function AdminDashboard() {
  const { signOut, changePassword } = useAuth()

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

  // Recent activity
  const [recentActivity, setRecentActivity] = useState([])
  const [loadingActivity, setLoadingActivity] = useState(true)

  useEffect(() => {
    fetchStats()
    fetchTrainers()
    fetchRecentActivity()
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

  async function fetchRecentActivity() {
    setLoadingActivity(true)
    try {
      const [clientJoins, workoutLogs] = await Promise.all([
        supabase
          .from('trainer_clients')
          .select(`
            id,
            created_at,
            client:profiles!trainer_clients_client_id_fkey ( full_name, email ),
            trainer:profiles!trainer_clients_trainer_id_fkey ( full_name )
          `)
          .order('created_at', { ascending: false })
          .limit(5),
        supabase
          .from('workout_logs')
          .select(`
            id,
            created_at,
            profiles ( full_name, email )
          `)
          .order('created_at', { ascending: false })
          .limit(5),
      ])

      const activities = []

      if (clientJoins.data) {
        clientJoins.data.forEach((j) => {
          activities.push({
            id: `join-${j.id}`,
            type: 'join',
            name: j.client?.full_name || j.client?.email || 'Unknown',
            detail: `Joined ${j.trainer?.full_name || 'a trainer'}`,
            time: j.created_at,
          })
        })
      }

      if (workoutLogs.data) {
        workoutLogs.data.forEach((w) => {
          activities.push({
            id: `log-${w.id}`,
            type: 'workout',
            name: w.profiles?.full_name || w.profiles?.email || 'Unknown',
            detail: 'Completed a workout',
            time: w.created_at,
          })
        })
      }

      activities.sort((a, b) => new Date(b.time) - new Date(a.time))
      setRecentActivity(activities.slice(0, 8))
    } catch (err) {
      console.error('Error fetching activity:', err.message)
    } finally {
      setLoadingActivity(false)
    }
  }

  async function handleInviteTrainer(e) {
    e.preventDefault()
    setInviteError(null)
    setInviteSuccess(false)
    setInviting(true)

    try {
      const siteUrl = SITE_URL

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
    const { allPassed } = validatePassword(myNewPassword)
    if (!allPassed) { setMyPasswordError('Password does not meet all requirements'); return }
    if (!validatePasswordMatch(myNewPassword, myConfirmPassword)) { setMyPasswordError('Passwords do not match'); return }
    setChangingMyPassword(true)
    try {
      await changePassword(myNewPassword)
      setMyPasswordSuccess(true)
      setMyNewPassword('')
      setMyConfirmPassword('')
    } catch (err) {
      setMyPasswordError(err.message || 'Failed to change password')
    } finally {
      setChangingMyPassword(false)
    }
  }

  function timeAgo(dateStr) {
    if (!dateStr) return ''
    const diff = Date.now() - new Date(dateStr).getTime()
    const mins = Math.floor(diff / 60000)
    if (mins < 1) return 'Just now'
    if (mins < 60) return `${mins}m ago`
    const hrs = Math.floor(mins / 60)
    if (hrs < 24) return `${hrs}h ago`
    const days = Math.floor(hrs / 24)
    return `${days}d ago`
  }

  const statCards = [
    {
      label: 'Total Trainers',
      value: totalTrainers,
      icon: 'groups',
      gradient: 'from-primary to-purple-600',
      badge: '+12%',
      badgeColor: 'text-emerald-400',
    },
    {
      label: 'Active Members',
      value: totalClients,
      icon: 'person',
      gradient: 'from-emerald-500 to-teal-600',
      badge: '+8%',
      badgeColor: 'text-emerald-400',
    },
    {
      label: 'Active Workout Plans',
      value: activeWorkoutPlans,
      icon: 'exercise',
      gradient: 'from-amber-500 to-orange-600',
      badge: '+5%',
      badgeColor: 'text-emerald-400',
    },
  ]

  return (
    <div>
      {/* Header */}
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">
            Workspace <span className="text-primary-light">Intelligence</span>
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Monitor your platform performance and team activity
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              setShowChangeMyPassword(true)
              setMyPasswordError(null)
              setMyPasswordSuccess(false)
              setMyNewPassword('')
              setMyConfirmPassword('')
            }}
            className="flex items-center gap-2 px-4 py-2 rounded-xl glass-card text-sm text-slate-300 hover:text-white transition-colors"
          >
            <span className="material-symbols-outlined text-[18px]">lock</span>
            Change Password
          </button>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-8">
        {statCards.map((stat) => (
          <div
            key={stat.label}
            className="glass-card rounded-2xl p-6 relative overflow-hidden group hover:border-primary/30 transition-all duration-300"
          >
            <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br opacity-10 rounded-full -translate-y-8 translate-x-8 group-hover:opacity-20 transition-opacity" />
            <div className="flex items-start justify-between mb-4">
              <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${stat.gradient} flex items-center justify-center shadow-lg`}>
                <span className="material-symbols-outlined text-white text-xl">{stat.icon}</span>
              </div>
              <span className={`text-xs font-medium ${stat.badgeColor} bg-emerald-500/10 px-2 py-1 rounded-full`}>
                {stat.badge}
              </span>
            </div>
            <p className="text-3xl font-bold text-white mb-1">{stat.value}</p>
            <p className="text-sm text-slate-400">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Recent Activity */}
      <div className="glass-card rounded-2xl p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold text-white">Recent Activity</h2>
          <button
            onClick={fetchRecentActivity}
            className="text-xs text-slate-400 hover:text-primary-light transition-colors flex items-center gap-1"
          >
            <span className="material-symbols-outlined text-[16px]">refresh</span>
            Refresh
          </button>
        </div>

        {loadingActivity ? (
          <div className="flex items-center justify-center py-12">
            <span className="material-symbols-outlined text-primary animate-spin text-3xl">progress_activity</span>
          </div>
        ) : recentActivity.length === 0 ? (
          <div className="text-center py-12">
            <span className="material-symbols-outlined text-slate-600 text-4xl mb-2">inbox</span>
            <p className="text-slate-500 text-sm">No recent activity yet</p>
          </div>
        ) : (
          <div className="space-y-3">
            {recentActivity.map((item) => (
              <div
                key={item.id}
                className="flex items-center gap-4 p-3 rounded-xl hover:bg-white/[0.03] transition-colors"
              >
                <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-semibold text-white ${
                  item.type === 'join'
                    ? 'bg-gradient-to-br from-emerald-500 to-teal-600'
                    : 'bg-gradient-to-br from-primary to-purple-600'
                }`}>
                  {item.name.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-white font-medium truncate">{item.name}</p>
                  <p className="text-xs text-slate-400 truncate">{item.detail}</p>
                </div>
                <span className={`text-xs px-2 py-1 rounded-full ${
                  item.type === 'join'
                    ? 'text-emerald-400 bg-emerald-500/10'
                    : 'text-primary-light bg-primary/10'
                }`}>
                  {item.type === 'join' ? 'New Client' : 'Workout'}
                </span>
                <span className="text-xs text-slate-500 whitespace-nowrap">{timeAgo(item.time)}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ============ MODALS ============ */}

      {/* Add Trainer Modal */}
      {showAddTrainer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm px-4">
          <div className="w-full max-w-md glass-card rounded-2xl shadow-2xl shadow-primary/10">
            <div className="flex items-center justify-between px-6 py-5 border-b border-glass-border">
              <h3 className="text-lg font-semibold text-white">Add Trainer</h3>
              <button
                onClick={() => setShowAddTrainer(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            <form onSubmit={handleInviteTrainer} className="p-6 space-y-4">
              <div>
                <label htmlFor="trainer-name" className="block text-sm font-medium text-slate-300 mb-1.5">
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
                  className="block w-full rounded-xl bg-white/5 border border-glass-border px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:border-primary/40 focus:outline-none transition disabled:opacity-50"
                />
              </div>

              <div>
                <label htmlFor="trainer-email" className="block text-sm font-medium text-slate-300 mb-1.5">
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
                  className="block w-full rounded-xl bg-white/5 border border-glass-border px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:border-primary/40 focus:outline-none transition disabled:opacity-50"
                />
              </div>

              <div>
                <label htmlFor="trainer-type" className="block text-sm font-medium text-slate-300 mb-1.5">
                  Trainer Type
                </label>
                <select
                  id="trainer-type"
                  value={trainerType}
                  onChange={(e) => setTrainerType(e.target.value)}
                  disabled={inviting}
                  className="block w-full rounded-xl bg-white/5 border border-glass-border px-4 py-2.5 text-sm text-white focus:border-primary/40 focus:outline-none transition disabled:opacity-50"
                >
                  <option value="fitness">Personal Trainer</option>
                  <option value="nutrition">Nutritionist</option>
                  <option value="both">Both (Trainer + Nutritionist)</option>
                </select>
              </div>

              {inviteError && (
                <div className="rounded-xl bg-red-500/10 border border-red-500/20 p-3">
                  <p className="text-sm text-red-400">{inviteError}</p>
                </div>
              )}

              {inviteSuccess && (
                <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/20 p-3">
                  <p className="text-sm text-emerald-400">
                    Invite sent successfully! The trainer will receive a magic link to set up their account.
                  </p>
                </div>
              )}

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddTrainer(false)}
                  className="px-4 py-2 rounded-xl text-sm text-slate-400 hover:text-white hover:bg-white/5 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={inviting}
                  className="inline-flex items-center gap-2 px-5 py-2 rounded-xl bg-gradient-to-r from-primary to-primary-dark text-sm font-semibold text-white hover:shadow-lg hover:shadow-primary/25 transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {inviting ? (
                    <>
                      <span className="material-symbols-outlined text-[18px] animate-spin">progress_activity</span>
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm px-4">
          <div className="w-full max-w-lg glass-card rounded-2xl shadow-2xl shadow-primary/10">
            <div className="flex items-center justify-between px-6 py-5 border-b border-glass-border">
              <h3 className="text-lg font-semibold text-white">
                Clients of{' '}
                <span className="text-primary-light">{selectedTrainer.full_name || 'Unnamed'}</span>
              </h3>
              <button
                onClick={() => { setSelectedTrainer(null); setTrainerClients([]) }}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            <div className="p-6">
              {loadingClients ? (
                <div className="flex items-center justify-center py-8">
                  <span className="material-symbols-outlined text-primary animate-spin text-3xl">progress_activity</span>
                </div>
              ) : trainerClients.length === 0 ? (
                <div className="text-center py-8">
                  <span className="material-symbols-outlined text-slate-600 text-4xl">person_off</span>
                  <p className="mt-2 text-slate-500 text-sm">This trainer has no clients yet.</p>
                </div>
              ) : (
                <ul className="space-y-2">
                  {trainerClients.map((tc) => (
                    <li key={tc.id} className="flex items-center gap-3 p-3 rounded-xl hover:bg-white/[0.03] transition-colors">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-purple-600 flex items-center justify-center text-xs font-semibold text-white">
                        {(tc.client?.full_name || 'U').charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-white">{tc.client?.full_name || 'Unnamed'}</p>
                        <p className="text-xs text-slate-400">{tc.client?.email}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="px-6 py-4 border-t border-glass-border flex justify-end">
              <button
                onClick={() => { setSelectedTrainer(null); setTrainerClients([]) }}
                className="px-4 py-2 rounded-xl text-sm text-slate-400 hover:text-white hover:bg-white/5 transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {trainerToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm px-4">
          <div className="w-full max-w-sm glass-card rounded-2xl shadow-2xl p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-red-500/10 flex items-center justify-center">
                <span className="material-symbols-outlined text-red-400 text-xl">warning</span>
              </div>
              <h3 className="text-lg font-semibold text-white">Delete Trainer</h3>
            </div>
            <p className="text-sm text-slate-300 mb-1">
              Are you sure you want to delete{' '}
              <span className="font-medium text-white">
                {trainerToDelete.full_name || trainerToDelete.email}
              </span>
              ?
            </p>
            <p className="text-xs text-red-400/80 mb-6">
              This will remove their profile, client relationships, and all associated data. This action cannot be undone.
            </p>
            <div className="flex items-center justify-end gap-3">
              <button
                onClick={() => setTrainerToDelete(null)}
                disabled={deleting}
                className="px-4 py-2 rounded-xl text-sm text-slate-400 hover:text-white hover:bg-white/5 transition disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteTrainer}
                disabled={deleting}
                className="inline-flex items-center gap-2 px-5 py-2 rounded-xl bg-red-600 text-sm font-semibold text-white hover:bg-red-700 transition disabled:opacity-50"
              >
                {deleting ? (
                  <>
                    <span className="material-symbols-outlined text-[18px] animate-spin">progress_activity</span>
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm px-4">
          <div className="w-full max-w-sm glass-card rounded-2xl shadow-2xl p-6">
            <h3 className="text-lg font-semibold text-white mb-1">Set Password</h3>
            <p className="text-sm text-slate-400 mb-5">
              Set a new password for{' '}
              <span className="text-white font-medium">{passwordTrainer.full_name || passwordTrainer.email}</span>
            </p>
            <form onSubmit={handleSetPassword} className="space-y-4">
              <input
                type="password"
                required
                minLength={6}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="New password (min 6 chars)"
                className="block w-full rounded-xl bg-white/5 border border-glass-border px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:border-primary/40 focus:outline-none transition"
              />
              {passwordSuccess && (
                <p className="text-sm text-emerald-400">Password updated successfully!</p>
              )}
              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setPasswordTrainer(null)}
                  className="px-4 py-2 rounded-xl text-sm text-slate-400 hover:text-white hover:bg-white/5 transition"
                >
                  Close
                </button>
                <button
                  type="submit"
                  disabled={settingPassword || !newPassword}
                  className="px-5 py-2 rounded-xl bg-gradient-to-r from-primary to-primary-dark text-sm font-semibold text-white hover:shadow-lg hover:shadow-primary/25 transition disabled:opacity-50"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm px-4">
          <div className="w-full max-w-sm glass-card rounded-2xl shadow-2xl p-6">
            <h3 className="text-lg font-semibold text-white mb-5">Change My Password</h3>
            <form onSubmit={handleChangeMyPassword} className="space-y-4">
              <PasswordInput
                password={myNewPassword}
                setPassword={setMyNewPassword}
                confirmPassword={myConfirmPassword}
                setConfirmPassword={setMyConfirmPassword}
                disabled={changingMyPassword}
              />
              {myPasswordError && (
                <p className="text-sm text-red-400">{myPasswordError}</p>
              )}
              {myPasswordSuccess && (
                <p className="text-sm text-emerald-400">Password changed successfully!</p>
              )}
              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowChangeMyPassword(false)}
                  className="px-4 py-2 rounded-xl text-sm text-slate-400 hover:text-white hover:bg-white/5 transition"
                >
                  Close
                </button>
                <button
                  type="submit"
                  disabled={changingMyPassword || !myNewPassword || !myConfirmPassword}
                  className="px-5 py-2 rounded-xl bg-gradient-to-r from-primary to-primary-dark text-sm font-semibold text-white hover:shadow-lg hover:shadow-primary/25 transition disabled:opacity-50"
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
