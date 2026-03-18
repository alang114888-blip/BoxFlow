import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'

export default function AdminClients() {
  const { profile } = useAuth()

  const [clients, setClients] = useState([])
  const [trainers, setTrainers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // Filters
  const [searchQuery, setSearchQuery] = useState('')
  const [trainerFilter, setTrainerFilter] = useState('all')

  // Stats
  const [totalCount, setTotalCount] = useState(0)
  const [activeCount, setActiveCount] = useState(0)
  const [lockedCount, setLockedCount] = useState(0)

  // View modal
  const [viewClient, setViewClient] = useState(null)

  // Delete modal
  const [clientToDelete, setClientToDelete] = useState(null)
  const [deleting, setDeleting] = useState(false)

  // Set password modal
  const [passwordClient, setPasswordClient] = useState(null)
  const [newPassword, setNewPassword] = useState('')
  const [settingPassword, setSettingPassword] = useState(false)
  const [passwordSuccess, setPasswordSuccess] = useState(false)

  useEffect(() => {
    fetchClients()
  }, [])

  async function fetchClients() {
    setLoading(true)
    setError(null)

    try {
      // Fetch all client profiles
      const { data: clientData, error: clientError } = await supabase
        .from('profiles')
        .select('id, full_name, email, role, locked_at, failed_attempts, phone, is_onboarded, created_at')
        .eq('role', 'client')
        .order('full_name')

      if (clientError) throw clientError

      // Fetch trainer_clients relationships
      const { data: tcData, error: tcError } = await supabase
        .from('trainer_clients')
        .select('client_id, trainer_id')

      if (tcError) throw tcError

      // Fetch trainer profiles for names
      const trainerIds = [...new Set((tcData || []).map((tc) => tc.trainer_id))]
      let trainerMap = {}
      if (trainerIds.length > 0) {
        const { data: trainerData, error: trainerError } = await supabase
          .from('profiles')
          .select('id, full_name, email')
          .in('id', trainerIds)

        if (trainerError) throw trainerError

        trainerMap = (trainerData || []).reduce((acc, t) => {
          acc[t.id] = t
          return acc
        }, {})
      }

      // Build client-to-trainer lookup
      const clientTrainerMap = (tcData || []).reduce((acc, tc) => {
        acc[tc.client_id] = trainerMap[tc.trainer_id] || null
        return acc
      }, {})

      const enrichedClients = (clientData || []).map((c) => ({
        ...c,
        trainer: clientTrainerMap[c.id] || null,
      }))

      setClients(enrichedClients)

      // Build unique trainers list for filter dropdown
      const uniqueTrainers = Object.values(trainerMap).sort((a, b) =>
        (a.full_name || '').localeCompare(b.full_name || '')
      )
      setTrainers(uniqueTrainers)

      // Stats
      const total = enrichedClients.length
      setTotalCount(total)
      setActiveCount(enrichedClients.filter((c) => !c.locked_at).length)
      setLockedCount(enrichedClients.filter((c) => c.locked_at).length)
    } catch (err) {
      setError(err.message || 'Failed to fetch clients')
    } finally {
      setLoading(false)
    }
  }

  async function handleDeleteClient() {
    if (!clientToDelete) return
    setDeleting(true)
    try {
      const { error: deleteError } = await supabase.rpc('delete_user', {
        user_id: clientToDelete.id,
      })
      if (deleteError) throw deleteError
      setClientToDelete(null)
      fetchClients()
    } catch (err) {
      setError(err.message || 'Failed to delete client')
    } finally {
      setDeleting(false)
    }
  }

  async function handleSetPassword(e) {
    e.preventDefault()
    if (!passwordClient || !newPassword) return
    setSettingPassword(true)
    setPasswordSuccess(false)
    try {
      const { error: rpcError } = await supabase.rpc('set_user_password', {
        target_user_id: passwordClient.id,
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

  async function handleUnlock(client) {
    try {
      const { error: rpcError } = await supabase.rpc('unlock_account', {
        target_user_id: client.id,
      })
      if (rpcError) throw rpcError
      fetchClients()
    } catch (err) {
      setError(err.message || 'Failed to unlock account')
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

  // Filtered clients
  const filteredClients = clients.filter((c) => {
    const matchesSearch =
      !searchQuery ||
      (c.full_name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (c.email || '').toLowerCase().includes(searchQuery.toLowerCase())

    const matchesTrainer =
      trainerFilter === 'all' ||
      (trainerFilter === 'unassigned' && !c.trainer) ||
      c.trainer?.id === trainerFilter

    return matchesSearch && matchesTrainer
  })

  const statCards = [
    {
      label: 'Total Clients',
      value: totalCount,
      icon: 'person',
      gradient: 'from-primary to-purple-600',
    },
    {
      label: 'Active Clients',
      value: activeCount,
      icon: 'check_circle',
      gradient: 'from-emerald-500 to-teal-600',
    },
    {
      label: 'Locked Clients',
      value: lockedCount,
      icon: 'lock',
      gradient: 'from-red-500 to-rose-600',
    },
  ]

  return (
    <div>
      {/* Header */}
      <div className="mb-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">
            Client <span className="text-primary-light">Directory</span>
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            View and manage all registered clients
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* Search */}
          <div className="relative">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-[18px]">
              search
            </span>
            <input
              type="text"
              placeholder="Search clients..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-64 pl-9 pr-4 py-2 rounded-xl bg-white/5 border border-glass-border text-sm text-white placeholder-slate-500 focus:outline-none focus:border-primary/40 transition-colors"
            />
          </div>
          {/* Trainer filter */}
          <select
            value={trainerFilter}
            onChange={(e) => setTrainerFilter(e.target.value)}
            className="appearance-none bg-white/5 border border-glass-border rounded-xl px-4 py-2 text-sm text-slate-300 focus:ring-1 focus:ring-primary/40 focus:outline-none cursor-pointer transition-all"
          >
            <option value="all">All Trainers</option>
            <option value="unassigned">Unassigned</option>
            {trainers.map((t) => (
              <option key={t.id} value={t.id}>
                {t.full_name || t.email}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-8">
        {statCards.map((stat) => (
          <div
            key={stat.label}
            className="glass-card rounded-2xl p-6 relative overflow-hidden group hover:border-primary/30 transition-all duration-300"
          >
            <div className="flex items-start justify-between mb-4">
              <div
                className={`w-12 h-12 rounded-xl bg-gradient-to-br ${stat.gradient} flex items-center justify-center shadow-lg`}
              >
                <span className="material-symbols-outlined text-white text-xl">
                  {stat.icon}
                </span>
              </div>
            </div>
            <p className="text-3xl font-bold text-white mb-1">{stat.value}</p>
            <p className="text-sm text-slate-400">{stat.label}</p>
          </div>
        ))}
      </div>

      {error && (
        <div className="mb-4 rounded-xl bg-red-500/10 border border-red-500/20 p-3">
          <p className="text-sm text-red-400">{error}</p>
        </div>
      )}

      {/* Clients Table */}
      <div className="glass-card rounded-2xl overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <span className="material-symbols-outlined text-primary animate-spin text-3xl">
              progress_activity
            </span>
          </div>
        ) : filteredClients.length === 0 ? (
          <div className="text-center py-16">
            <span className="material-symbols-outlined text-slate-600 text-5xl mb-3">
              person_off
            </span>
            <p className="text-slate-500 text-sm">No clients found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-glass-border">
                  <th className="px-6 py-4 text-xs font-medium text-slate-500 uppercase tracking-wider">
                    Client Profile
                  </th>
                  <th className="px-6 py-4 text-xs font-medium text-slate-500 uppercase tracking-wider">
                    Email
                  </th>
                  <th className="px-6 py-4 text-xs font-medium text-slate-500 uppercase tracking-wider">
                    Phone
                  </th>
                  <th className="px-6 py-4 text-xs font-medium text-slate-500 uppercase tracking-wider">
                    Trainer
                  </th>
                  <th className="px-6 py-4 text-xs font-medium text-slate-500 uppercase tracking-wider">
                    Joined
                  </th>
                  <th className="px-6 py-4 text-xs font-medium text-slate-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-4 text-xs font-medium text-slate-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-glass-border">
                {filteredClients.map((client) => (
                  <tr
                    key={client.id}
                    className="hover:bg-white/[0.02] transition-colors"
                  >
                    {/* Client Profile */}
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-purple-600 flex items-center justify-center text-sm font-semibold text-white flex-shrink-0">
                          {(client.full_name || 'U').charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-white">
                            {client.full_name || 'Unnamed'}
                          </p>
                          <p className="text-xs text-slate-500">
                            Joined {formatDate(client.created_at)}
                          </p>
                        </div>
                      </div>
                    </td>

                    {/* Email */}
                    <td className="px-6 py-4 text-sm text-slate-400">
                      {client.email}
                    </td>

                    {/* Phone */}
                    <td className="px-6 py-4 text-sm text-slate-400">
                      {client.phone || <span className="text-slate-600">-</span>}
                    </td>

                    {/* Trainer */}
                    <td className="px-6 py-4 text-sm text-slate-400">
                      {client.trainer ? (
                        <span className="text-slate-300">
                          {client.trainer.full_name || client.trainer.email}
                        </span>
                      ) : (
                        <span className="text-slate-600 italic">Unassigned</span>
                      )}
                    </td>

                    {/* Joined */}
                    <td className="px-6 py-4 text-sm text-slate-400">
                      {formatDate(client.created_at)}
                    </td>

                    {/* Status */}
                    <td className="px-6 py-4">
                      {client.locked_at ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider text-red-400 bg-red-500/10 px-2 py-1 rounded-lg border border-red-500/20">
                          Locked
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider text-emerald-400 bg-emerald-500/10 px-2 py-1 rounded-lg border border-emerald-500/20">
                          Active
                        </span>
                      )}
                    </td>

                    {/* Actions */}
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => setViewClient(client)}
                          className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 transition"
                          title="View details"
                        >
                          <span className="material-symbols-outlined text-[18px]">
                            visibility
                          </span>
                        </button>
                        <button
                          onClick={() => {
                            setPasswordClient(client)
                            setNewPassword('')
                            setPasswordSuccess(false)
                          }}
                          className="p-2 rounded-lg text-slate-400 hover:text-primary-light hover:bg-primary/5 transition"
                          title="Set password"
                        >
                          <span className="material-symbols-outlined text-[18px]">
                            lock_reset
                          </span>
                        </button>
                        {client.locked_at && (
                          <button
                            onClick={() => handleUnlock(client)}
                            className="p-2 rounded-lg text-amber-400 hover:text-amber-300 hover:bg-amber-500/10 transition"
                            title="Unlock account"
                          >
                            <span className="material-symbols-outlined text-[18px]">
                              lock_open
                            </span>
                          </button>
                        )}
                        <button
                          onClick={() => setClientToDelete(client)}
                          className="p-2 rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-500/5 transition"
                          title="Delete client"
                        >
                          <span className="material-symbols-outlined text-[18px]">
                            delete
                          </span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination footer */}
        {!loading && filteredClients.length > 0 && (
          <div className="px-6 py-4 border-t border-glass-border">
            <p className="text-sm text-slate-500">
              Displaying {filteredClients.length} of {clients.length} clients
            </p>
          </div>
        )}
      </div>

      {/* ============ MODALS ============ */}

      {/* View Client Modal */}
      {viewClient && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm px-4">
          <div className="w-full max-w-md glass-card rounded-2xl shadow-2xl shadow-primary/10">
            <div className="flex items-center justify-between px-6 py-5 border-b border-glass-border">
              <h3 className="text-lg font-semibold text-white">Client Details</h3>
              <button
                onClick={() => setViewClient(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="flex items-center gap-4 mb-2">
                <div className="w-14 h-14 rounded-full bg-gradient-to-br from-primary to-purple-600 flex items-center justify-center text-lg font-bold text-white">
                  {(viewClient.full_name || 'U').charAt(0).toUpperCase()}
                </div>
                <div>
                  <p className="text-lg font-semibold text-white">
                    {viewClient.full_name || 'Unnamed'}
                  </p>
                  <p className="text-sm text-slate-400">{viewClient.email}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Phone</p>
                  <p className="text-sm text-slate-300">{viewClient.phone || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Trainer</p>
                  <p className="text-sm text-slate-300">
                    {viewClient.trainer?.full_name || viewClient.trainer?.email || 'Unassigned'}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Status</p>
                  {viewClient.locked_at ? (
                    <span className="inline-flex text-xs font-semibold text-red-400 bg-red-500/10 px-2 py-0.5 rounded border border-red-500/20">
                      Locked
                    </span>
                  ) : (
                    <span className="inline-flex text-xs font-semibold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                      Active
                    </span>
                  )}
                </div>
                <div>
                  <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Onboarded</p>
                  <p className="text-sm text-slate-300">
                    {viewClient.is_onboarded ? 'Yes' : 'No'}
                  </p>
                </div>
                <div className="col-span-2">
                  <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Joined</p>
                  <p className="text-sm text-slate-300">{formatDate(viewClient.created_at)}</p>
                </div>
              </div>
            </div>
            <div className="px-6 py-4 border-t border-glass-border flex justify-end">
              <button
                onClick={() => setViewClient(null)}
                className="px-4 py-2 rounded-xl text-sm text-slate-400 hover:text-white hover:bg-white/5 transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Set Password Modal */}
      {passwordClient && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm px-4">
          <div className="w-full max-w-sm glass-card rounded-2xl shadow-2xl p-6">
            <h3 className="text-lg font-semibold text-white mb-1">Set Password</h3>
            <p className="text-sm text-slate-400 mb-5">
              Set a new password for{' '}
              <span className="text-white font-medium">
                {passwordClient.full_name || passwordClient.email}
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
                  onClick={() => setPasswordClient(null)}
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

      {/* Delete Confirmation Modal */}
      {clientToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm px-4">
          <div className="w-full max-w-sm glass-card rounded-2xl shadow-2xl p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-red-500/10 flex items-center justify-center">
                <span className="material-symbols-outlined text-red-400 text-xl">warning</span>
              </div>
              <h3 className="text-lg font-semibold text-white">Delete Client</h3>
            </div>
            <p className="text-sm text-slate-300 mb-1">
              Are you sure you want to delete{' '}
              <span className="font-medium text-white">
                {clientToDelete.full_name || clientToDelete.email}
              </span>
              ?
            </p>
            <p className="text-xs text-red-400/80 mb-6">
              This will remove their profile and all associated data. This action cannot be undone.
            </p>
            <div className="flex items-center justify-end gap-3">
              <button
                onClick={() => setClientToDelete(null)}
                disabled={deleting}
                className="px-4 py-2 rounded-xl text-sm text-slate-400 hover:text-white hover:bg-white/5 transition disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteClient}
                disabled={deleting}
                className="inline-flex items-center gap-2 px-5 py-2 rounded-xl bg-red-600 text-sm font-semibold text-white hover:bg-red-700 transition disabled:opacity-50"
              >
                {deleting ? (
                  <>
                    <span className="material-symbols-outlined text-[18px] animate-spin">
                      progress_activity
                    </span>
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
    </div>
  )
}
