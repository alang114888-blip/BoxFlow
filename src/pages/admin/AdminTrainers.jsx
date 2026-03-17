import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'

export default function AdminTrainers() {
  const { profile } = useAuth()

  const [trainers, setTrainers] = useState([])
  const [loadingTrainers, setLoadingTrainers] = useState(true)
  const [error, setError] = useState(null)

  // Filter
  const [filter, setFilter] = useState('all')

  // Stats
  const [activeCount, setActiveCount] = useState(0)
  const [newThisMonth, setNewThisMonth] = useState(0)
  const [avgClients, setAvgClients] = useState(0)

  // Delete trainer
  const [trainerToDelete, setTrainerToDelete] = useState(null)
  const [deleting, setDeleting] = useState(false)

  // Set password
  const [passwordTrainer, setPasswordTrainer] = useState(null)
  const [newPassword, setNewPassword] = useState('')
  const [settingPassword, setSettingPassword] = useState(false)
  const [passwordSuccess, setPasswordSuccess] = useState(false)

  // Add Trainer modal
  const [showAddTrainer, setShowAddTrainer] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteName, setInviteName] = useState('')
  const [trainerType, setTrainerType] = useState('fitness')
  const [inviting, setInviting] = useState(false)
  const [inviteError, setInviteError] = useState(null)
  const [inviteSuccess, setInviteSuccess] = useState(false)

  useEffect(() => {
    fetchTrainers()
  }, [])

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
          created_at,
          locked_at,
          failed_attempts,
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

      // Compute stats
      const total = trainersWithCounts.length
      setActiveCount(total)

      const now = new Date()
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
      const newCount = trainersWithCounts.filter(
        (t) => new Date(t.created_at) >= monthStart
      ).length
      setNewThisMonth(newCount)

      if (total > 0) {
        const totalClients = trainersWithCounts.reduce((sum, t) => sum + t.clientCount, 0)
        setAvgClients(Math.round((totalClients / total) * 10) / 10)
      } else {
        setAvgClients(0)
      }
    } catch (err) {
      setError(err.message || 'Failed to fetch trainers')
    } finally {
      setLoadingTrainers(false)
    }
  }

  async function handleDeleteTrainer() {
    if (!trainerToDelete) return
    setDeleting(true)
    try {
      const { error: deleteError } = await supabase.rpc('delete_user', {
        user_id: trainerToDelete.id,
      })
      if (deleteError) throw deleteError
      setTrainerToDelete(null)
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
      const { error: rpcError } = await supabase.rpc('set_user_password', {
        target_user_id: passwordTrainer.id,
        new_password: newPassword,
      })
      if (rpcError) throw rpcError
      setPasswordSuccess(true)
      setNewPassword('')
    } catch (err) {
      setError(err.message || 'Failed to set password')
    } finally {
      setSettingPassword(false)
    }
  }

  async function handleInviteTrainer(e) {
    e.preventDefault()
    setInviteError(null)
    setInviteSuccess(false)
    setInviting(true)

    try {
      const siteUrl = window.location.origin

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
      setTimeout(() => fetchTrainers(), 1000)
    } catch (err) {
      setInviteError(err.message || 'Failed to send invite')
    } finally {
      setInviting(false)
    }
  }

  function formatDate(dateStr) {
    if (!dateStr) return ''
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  }

  function getTrainerTypeLabel(trainer) {
    const type = trainer.trainer_profiles?.[0]?.trainer_type
    if (!type) return 'N/A'
    if (type === 'fitness') return 'Personal Trainer'
    if (type === 'nutrition') return 'Nutritionist'
    if (type === 'both') return 'Both'
    return type
  }

  function getTrainerTypeBadgeColor(trainer) {
    const type = trainer.trainer_profiles?.[0]?.trainer_type
    if (type === 'fitness') return 'text-primary-light bg-primary/10'
    if (type === 'nutrition') return 'text-emerald-400 bg-emerald-500/10'
    if (type === 'both') return 'text-amber-400 bg-amber-500/10'
    return 'text-slate-400 bg-white/5'
  }

  const filteredTrainers = trainers.filter((t) => {
    if (filter === 'all') return true
    const type = t.trainer_profiles?.[0]?.trainer_type
    return type === filter
  })

  const maxClients = Math.max(...trainers.map((t) => t.clientCount), 1)

  const statCards = [
    {
      label: 'Active Trainers',
      value: activeCount,
      icon: 'groups',
      gradient: 'from-primary to-purple-600',
    },
    {
      label: 'New This Month',
      value: newThisMonth,
      icon: 'person_add',
      gradient: 'from-emerald-500 to-teal-600',
    },
    {
      label: 'Avg Clients / Trainer',
      value: avgClients,
      icon: 'analytics',
      gradient: 'from-amber-500 to-orange-600',
    },
  ]

  return (
    <div>
      {/* Header */}
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">
            Trainer <span className="text-primary-light">Directory</span>
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Manage and monitor your coaching team
          </p>
        </div>
        <button
          onClick={() => {
            setShowAddTrainer(true)
            setInviteSuccess(false)
            setInviteError(null)
          }}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-primary to-primary-dark text-white text-sm font-medium hover:shadow-lg hover:shadow-primary/25 transition-all"
        >
          <span className="material-symbols-outlined text-[18px]">person_add</span>
          Add Trainer
        </button>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-8">
        {statCards.map((stat) => (
          <div
            key={stat.label}
            className="glass-card rounded-2xl p-6 relative overflow-hidden group hover:border-primary/30 transition-all duration-300"
          >
            <div className="flex items-start justify-between mb-4">
              <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${stat.gradient} flex items-center justify-center shadow-lg`}>
                <span className="material-symbols-outlined text-white text-xl">{stat.icon}</span>
              </div>
            </div>
            <p className="text-3xl font-bold text-white mb-1">{stat.value}</p>
            <p className="text-sm text-slate-400">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 mb-6">
        {[
          { key: 'all', label: 'All Coaches' },
          { key: 'fitness', label: 'Personal Trainers' },
          { key: 'nutrition', label: 'Nutritionists' },
          { key: 'both', label: 'Both' },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setFilter(tab.key)}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
              filter === tab.key
                ? 'bg-primary/10 text-primary-light border border-primary/20'
                : 'text-slate-400 hover:text-white hover:bg-white/5 border border-transparent'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {error && (
        <div className="mb-4 rounded-xl bg-red-500/10 border border-red-500/20 p-3">
          <p className="text-sm text-red-400">{error}</p>
        </div>
      )}

      {/* Trainers Table */}
      <div className="glass-card rounded-2xl overflow-hidden">
        {loadingTrainers ? (
          <div className="flex items-center justify-center py-16">
            <span className="material-symbols-outlined text-primary animate-spin text-3xl">progress_activity</span>
          </div>
        ) : filteredTrainers.length === 0 ? (
          <div className="text-center py-16">
            <span className="material-symbols-outlined text-slate-600 text-5xl mb-3">group_off</span>
            <p className="text-slate-500 text-sm">No trainers found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-glass-border">
                  <th className="px-6 py-4 text-xs font-medium text-slate-500 uppercase tracking-wider">
                    Trainer Profile
                  </th>
                  <th className="px-6 py-4 text-xs font-medium text-slate-500 uppercase tracking-wider">
                    Email
                  </th>
                  <th className="px-6 py-4 text-xs font-medium text-slate-500 uppercase tracking-wider">
                    Type
                  </th>
                  <th className="px-6 py-4 text-xs font-medium text-slate-500 uppercase tracking-wider">
                    Client Load
                  </th>
                  <th className="px-6 py-4 text-xs font-medium text-slate-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-glass-border">
                {filteredTrainers.map((trainer) => (
                  <tr
                    key={trainer.id}
                    className="hover:bg-white/[0.02] transition-colors"
                  >
                    {/* Profile */}
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-purple-600 flex items-center justify-center text-sm font-semibold text-white flex-shrink-0">
                          {(trainer.full_name || 'U').charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-white flex items-center gap-2">
                            {trainer.full_name || 'Unnamed'}
                            {trainer.locked_at && (
                              <span className="text-[9px] font-bold uppercase tracking-wider text-red-400 bg-red-500/10 px-1.5 py-0.5 rounded border border-red-500/20">Locked</span>
                            )}
                          </p>
                          <p className="text-xs text-slate-500">
                            Joined {formatDate(trainer.created_at)}
                          </p>
                        </div>
                      </div>
                    </td>

                    {/* Email */}
                    <td className="px-6 py-4 text-sm text-slate-400">
                      {trainer.email}
                    </td>

                    {/* Type Badge */}
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${getTrainerTypeBadgeColor(trainer)}`}>
                        {getTrainerTypeLabel(trainer)}
                      </span>
                    </td>

                    {/* Client Load */}
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <span className="text-sm text-white font-medium w-6">
                          {trainer.clientCount}
                        </span>
                        <div className="flex-1 max-w-[100px] h-2 rounded-full bg-white/5 overflow-hidden">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-primary to-primary-light transition-all duration-500"
                            style={{
                              width: `${Math.max((trainer.clientCount / maxClients) * 100, 4)}%`,
                            }}
                          />
                        </div>
                      </div>
                    </td>

                    {/* Actions */}
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => {}}
                          className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 transition"
                          title="View details"
                        >
                          <span className="material-symbols-outlined text-[18px]">visibility</span>
                        </button>
                        {trainer.locked_at && (
                          <button
                            onClick={async () => {
                              await supabase.rpc('unlock_account', { target_user_id: trainer.id })
                              fetchTrainers()
                            }}
                            className="p-2 rounded-lg text-amber-400 hover:text-amber-300 hover:bg-amber-500/10 transition"
                            title="Unlock account"
                          >
                            <span className="material-symbols-outlined text-[18px]">lock_open</span>
                          </button>
                        )}
                        <button
                          onClick={() => {
                            setPasswordTrainer(trainer)
                            setNewPassword('')
                            setPasswordSuccess(false)
                          }}
                          className="p-2 rounded-lg text-slate-400 hover:text-primary-light hover:bg-primary/5 transition"
                          title="Set password"
                        >
                          <span className="material-symbols-outlined text-[18px]">lock_reset</span>
                        </button>
                        <button
                          onClick={() => setTrainerToDelete(trainer)}
                          className="p-2 rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-500/5 transition"
                          title="Delete trainer"
                        >
                          <span className="material-symbols-outlined text-[18px]">delete</span>
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

      {/* ============ MODALS ============ */}

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
              <span className="text-white font-medium">
                {passwordTrainer.full_name || passwordTrainer.email}
              </span>
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
                <label htmlFor="t-name" className="block text-sm font-medium text-slate-300 mb-1.5">
                  Full Name
                </label>
                <input
                  id="t-name"
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
                <label htmlFor="t-email" className="block text-sm font-medium text-slate-300 mb-1.5">
                  Email Address
                </label>
                <input
                  id="t-email"
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
                <label htmlFor="t-type" className="block text-sm font-medium text-slate-300 mb-1.5">
                  Trainer Type
                </label>
                <select
                  id="t-type"
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
                    Invite sent successfully!
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
    </div>
  )
}
