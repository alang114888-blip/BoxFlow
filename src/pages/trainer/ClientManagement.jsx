import { useState, useEffect } from 'react'
import { supabase, SITE_URL } from '../../lib/supabase'
import { logError, logAction } from '../../lib/logger'
import { useAuth } from '../../hooks/useAuth'
import {
  MagnifyingGlassIcon,
  EnvelopeIcon,
  XMarkIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  UserPlusIcon,
  KeyIcon,
} from '@heroicons/react/24/outline'

export default function ClientManagement() {
  const { profile } = useAuth()
  const [clients, setClients] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState('all') // all | accepted | pending
  const [expandedClient, setExpandedClient] = useState(null)
  const [clientDetails, setClientDetails] = useState({})
  const [showInviteModal, setShowInviteModal] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviting, setInviting] = useState(false)
  const [inviteError, setInviteError] = useState(null)
  const [inviteSuccess, setInviteSuccess] = useState(false)

  // For assigning plans
  const [showAssignModal, setShowAssignModal] = useState(null) // { clientId, type: 'workout' | 'nutrition' }
  const [availablePlans, setAvailablePlans] = useState([])
  const [assigningPlan, setAssigningPlan] = useState(false)

  // Delete client
  const [clientToDelete, setClientToDelete] = useState(null)

  // Pending invite actions
  const [pendingToDelete, setPendingToDelete] = useState(null)
  const [resendSuccess, setResendSuccess] = useState(null)

  // Set password
  const [passwordClient, setPasswordClient] = useState(null)
  const [newPassword, setNewPassword] = useState('')
  const [settingPassword, setSettingPassword] = useState(false)
  const [passwordSuccess, setPasswordSuccess] = useState(false)

  useEffect(() => {
    if (!profile) return
    fetchClients()
  }, [profile])

  async function fetchClients() {
    try {
      setLoading(true)
      setError(null)

      const { data, error: fetchErr } = await supabase
        .from('trainer_clients')
        .select(`
          id,
          client_id,
          invited_email,
          invite_accepted,
          profiles!trainer_clients_client_id_fkey ( id, full_name, email, locked_at, failed_attempts )
        `)
        .eq('trainer_id', profile.id)

      if (fetchErr) throw fetchErr

      // For each accepted client, get active plans count and last workout
      const enriched = await Promise.all(
        (data || []).map(async (tc) => {
          if (!tc.invite_accepted || !tc.client_id) {
            return { ...tc, activePlansCount: 0, lastWorkout: null }
          }

          const [wpRes, npRes, logRes] = await Promise.all([
            supabase
              .from('workout_plans')
              .select('id', { count: 'exact', head: true })
              .eq('client_id', tc.client_id)
              .eq('trainer_id', profile.id)
              .eq('is_active', true),
            supabase
              .from('nutrition_plans')
              .select('id', { count: 'exact', head: true })
              .eq('client_id', tc.client_id)
              .eq('trainer_id', profile.id)
              .eq('is_active', true),
            supabase
              .from('workout_logs')
              .select('completed_at')
              .eq('client_id', tc.client_id)
              .order('completed_at', { ascending: false })
              .limit(1),
          ])

          return {
            ...tc,
            activePlansCount: (wpRes.count || 0) + (npRes.count || 0),
            lastWorkout: logRes.data?.[0]?.completed_at || null,
          }
        })
      )

      // Also fetch pending invites
      const { data: pending } = await supabase
        .from('pending_invites')
        .select('id, email, created_at')
        .eq('trainer_id', profile.id)

      const pendingAsClients = (pending || []).map(p => ({
        id: `pending-${p.id}`,
        client_id: null,
        invited_email: p.email,
        invite_accepted: false,
        profiles: null,
        activePlansCount: 0,
        lastWorkout: null,
        _isPending: true,
      }))

      setClients([...enriched, ...pendingAsClients])
    } catch (err) {
      console.error('Fetch clients error:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  async function handleInvite(e) {
    e.preventDefault()
    try {
      setInviting(true)
      setInviteError(null)
      setInviteSuccess(false)

      // Check if already invited
      const { data: existingInvite } = await supabase
        .from('pending_invites')
        .select('id')
        .eq('trainer_id', profile.id)
        .eq('email', inviteEmail)
        .maybeSingle()

      const { data: existingTC } = await supabase
        .from('trainer_clients')
        .select('id')
        .eq('trainer_id', profile.id)
        .eq('invited_email', inviteEmail)
        .maybeSingle()

      if (existingInvite || existingTC) {
        setInviteError('This email has already been invited.')
        return
      }

      // Check if client already has a profile
      const { data: existingProfile } = await supabase
        .from('profiles')
        .select('id')
        .eq('email', inviteEmail)
        .maybeSingle()

      if (existingProfile) {
        // Client already exists → link directly
        const { error: insertErr } = await supabase.from('trainer_clients').insert({
          trainer_id: profile.id,
          client_id: existingProfile.id,
          invited_email: inviteEmail,
          invite_accepted: true,
        })
        if (insertErr) throw insertErr

        setInviteSuccess(true)
        setInviteEmail('')
        fetchClients()
      } else {
        // New client → use Edge Function (has service role key)
        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
        const { data: { session } } = await supabase.auth.getSession()

        console.log('Invite: supabaseUrl=', supabaseUrl)
        console.log('Invite: session exists=', !!session, 'token length=', session?.access_token?.length)
        console.log('Invite: email=', inviteEmail, 'trainer_id=', profile.id)

        if (!session?.access_token) {
          throw new Error('No active session. Please log in again.')
        }

        let res
        try {
          res = await fetch(`${supabaseUrl}/functions/v1/invite-client`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${session.access_token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              email: inviteEmail,
              trainer_id: profile.id,
            }),
          })
        } catch (fetchErr) {
          console.error('Invite: fetch failed:', fetchErr)
          throw new Error('Network error calling invite function: ' + fetchErr.message)
        }

        let result
        try {
          result = await res.json()
        } catch (jsonErr) {
          const text = await res.text().catch(() => '')
          console.error('Invite: response not JSON, status:', res.status, 'body:', text)
          throw new Error(`Invite function returned status ${res.status}: ${text.substring(0, 200)}`)
        }

        console.log('Edge Function response:', JSON.stringify(result))
        if (result.logs) console.log('Edge Function logs:', result.logs.join('\n'))

        if (!res.ok) {
          const errMsg = result.error || `Failed (status ${res.status})`
          await logError('invite_client', errMsg, { email: inviteEmail, trainer_id: profile.id, edgeLogs: result.logs })
          throw new Error(errMsg)
        }

        logAction('invite_sent', { email: inviteEmail, type: result.type })
        setInviteSuccess(true)
        setInviteEmail('')
        fetchClients()
      }
    } catch (err) {
      console.error('Invite error:', err)
      setInviteError(err.message)
    } finally {
      setInviting(false)
    }
  }

  async function toggleExpand(clientId) {
    if (expandedClient === clientId) {
      setExpandedClient(null)
      return
    }
    setExpandedClient(clientId)

    if (clientDetails[clientId]) return

    try {
      const [prsRes, wpRes, npRes] = await Promise.all([
        supabase
          .from('client_prs')
          .select(`
            id,
            weight_kg,
            date_achieved,
            exercises ( name, category )
          `)
          .eq('client_id', clientId)
          .order('date_achieved', { ascending: false }),
        supabase
          .from('workout_plans')
          .select('id, name, is_active')
          .eq('client_id', clientId)
          .eq('trainer_id', profile.id)
          .order('is_active', { ascending: false }),
        supabase
          .from('nutrition_plans')
          .select('id, name, is_active')
          .eq('client_id', clientId)
          .eq('trainer_id', profile.id)
          .order('is_active', { ascending: false }),
      ])

      setClientDetails((prev) => ({
        ...prev,
        [clientId]: {
          prs: prsRes.data || [],
          workoutPlans: wpRes.data || [],
          nutritionPlans: npRes.data || [],
        },
      }))
    } catch (err) {
      console.error('Fetch client details error:', err)
    }
  }

  async function openAssignModal(clientId, type) {
    setShowAssignModal({ clientId, type })
    const table = type === 'workout' ? 'workout_plans' : 'nutrition_plans'

    const { data } = await supabase
      .from(table)
      .select('id, name')
      .eq('trainer_id', profile.id)
      .is('client_id', null)

    setAvailablePlans(data || [])
  }

  async function assignPlan(planId) {
    if (!showAssignModal) return
    try {
      setAssigningPlan(true)
      const table =
        showAssignModal.type === 'workout' ? 'workout_plans' : 'nutrition_plans'

      const { error: upErr } = await supabase
        .from(table)
        .update({ client_id: showAssignModal.clientId, is_active: true })
        .eq('id', planId)

      if (upErr) throw upErr

      // Refresh details
      setClientDetails((prev) => ({ ...prev, [showAssignModal.clientId]: undefined }))
      toggleExpand(showAssignModal.clientId)
      setShowAssignModal(null)
      fetchClients()
    } catch (err) {
      console.error('Assign plan error:', err)
    } finally {
      setAssigningPlan(false)
    }
  }

  async function handleSetClientPassword(e) {
    e.preventDefault()
    if (!passwordClient || !newPassword) return
    setSettingPassword(true)
    setPasswordSuccess(false)
    try {
      const { error: rpcError } = await supabase
        .rpc('set_user_password', { target_user_id: passwordClient.id, new_password: newPassword })
      if (rpcError) throw rpcError
      setPasswordSuccess(true)
      setNewPassword('')
    } catch (err) {
      setError(err.message || 'Failed to set password')
    } finally {
      setSettingPassword(false)
    }
  }

  const filteredClients = clients.filter((c) => {
    const name = c.profiles?.full_name || c.invited_email || ''
    const email = c.profiles?.email || c.invited_email || ''
    const matchesSearch =
      name.toLowerCase().includes(search.toLowerCase()) ||
      email.toLowerCase().includes(search.toLowerCase())

    if (filterStatus === 'accepted') return matchesSearch && c.invite_accepted
    if (filterStatus === 'pending') return matchesSearch && !c.invite_accepted
    return matchesSearch
  })

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-dark-600 border-t-primary-500" />
      </div>
    )
  }

  return (
    <div className="p-6 lg:p-8">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold text-dark-100">Client Management</h1>
        <button
          onClick={() => {
            setShowInviteModal(true)
            setInviteSuccess(false)
            setInviteError(null)
          }}
          className="flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-500"
        >
          <UserPlusIcon className="h-4 w-4" />
          Invite Client
        </button>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-400">
          {error}
        </div>
      )}

      {resendSuccess && (
        <div className="mb-4 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-400 flex items-center gap-2">
          <span className="material-symbols-outlined text-[16px]">check_circle</span>
          Invite resent to {resendSuccess}
        </div>
      )}

      {/* Search & Filter */}
      <div className="mb-6 flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-dark-400" />
          <input
            type="text"
            placeholder="Search clients..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg border border-dark-600 bg-dark-800 py-2 pl-9 pr-3 text-sm text-dark-100 placeholder-dark-500 focus:border-primary-500 focus:outline-none"
          />
        </div>
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="rounded-lg border border-dark-600 bg-dark-800 px-3 py-2 text-sm text-dark-100 focus:border-primary-500 focus:outline-none"
        >
          <option value="all">All</option>
          <option value="accepted">Active</option>
          <option value="pending">Pending</option>
        </select>
      </div>

      {/* Client List */}
      {filteredClients.length === 0 ? (
        <div className="rounded-xl border border-dark-700 bg-dark-800 p-12 text-center">
          <UserPlusIcon className="mx-auto h-12 w-12 text-dark-500" />
          <p className="mt-3 text-dark-400">
            {clients.length === 0
              ? 'No clients yet. Invite your first client to get started.'
              : 'No clients match your search.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredClients.map((client) => {
            const clientName = client.profiles?.full_name || 'Pending'
            const clientEmail = client.profiles?.email || client.invited_email
            const isExpanded = expandedClient === client.client_id
            const details = clientDetails[client.client_id]

            return (
              <div
                key={client.id}
                className="rounded-xl border border-dark-700 bg-dark-800 overflow-hidden"
              >
                {/* Client Card Header */}
                <div
                  className={`flex cursor-pointer items-center justify-between p-4 transition-colors hover:bg-dark-700/50 ${
                    !client.invite_accepted ? 'opacity-60' : ''
                  }`}
                  onClick={() =>
                    client.invite_accepted && client.client_id && toggleExpand(client.client_id)
                  }
                >
                  <div className="flex items-center gap-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary-500/20 text-sm font-semibold text-primary-400">
                      {clientName.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="font-medium text-dark-100 flex items-center gap-2">
                        {clientName}
                        {client.profiles?.locked_at && (
                          <span className="text-[9px] font-bold uppercase tracking-wider text-red-400 bg-red-500/10 px-1.5 py-0.5 rounded border border-red-500/20">Locked</span>
                        )}
                      </p>
                      <p className="text-sm text-dark-400">{clientEmail}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-6">
                    {client.invite_accepted ? (
                      <>
                        <div className="text-right">
                          <p className="text-xs text-dark-400">Active Plans</p>
                          <p className="text-sm font-semibold text-dark-200">
                            {client.activePlansCount}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-xs text-dark-400">Last Workout</p>
                          <p className="text-sm text-dark-200">
                            {client.lastWorkout
                              ? new Date(client.lastWorkout).toLocaleDateString()
                              : 'Never'}
                          </p>
                        </div>
                        {isExpanded ? (
                          <ChevronUpIcon className="h-5 w-5 text-dark-400" />
                        ) : (
                          <ChevronDownIcon className="h-5 w-5 text-dark-400" />
                        )}
                      </>
                    ) : (
                      <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                        <span className="rounded-full bg-yellow-500/10 px-2 py-0.5 text-[10px] font-medium text-yellow-400">
                          Pending
                        </span>
                        {pendingToDelete === client.id ? (
                          <div className="flex items-center gap-1">
                            <button
                              onClick={async () => {
                                const pendingId = client.id.replace('pending-', '')
                                await supabase.from('pending_invites').delete().eq('id', pendingId)
                                setPendingToDelete(null)
                                fetchClients()
                              }}
                              className="rounded bg-red-600 px-2 py-0.5 text-[10px] text-white font-medium"
                            >Yes</button>
                            <button onClick={() => setPendingToDelete(null)}
                              className="rounded bg-dark-600 px-2 py-0.5 text-[10px] text-dark-200"
                            >No</button>
                          </div>
                        ) : (
                          <>
                            <button
                              onClick={async () => {
                                try {
                                  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
                                  const { data: { session } } = await supabase.auth.getSession()
                                  const res = await fetch(`${supabaseUrl}/functions/v1/invite-client`, {
                                    method: 'POST',
                                    headers: { 'Authorization': `Bearer ${session?.access_token}`, 'Content-Type': 'application/json' },
                                    body: JSON.stringify({ email: clientEmail, trainer_id: profile.id }),
                                  })
                                  if (!res.ok) { const r = await res.json(); throw new Error(r.error) }
                                  const pendingId = client.id.replace('pending-', '')
                                  await supabase.from('pending_invites').update({ created_at: new Date().toISOString() }).eq('id', pendingId)
                                  setResendSuccess(clientEmail)
                                  setTimeout(() => setResendSuccess(null), 3000)
                                } catch (err) { console.error(err) }
                              }}
                              className="rounded-lg bg-dark-700 p-1.5 text-dark-300 hover:text-primary hover:bg-dark-600 transition" title="Resend invite"
                            >
                              <span className="material-symbols-outlined text-[16px]">send</span>
                            </button>
                            <button
                              onClick={() => setPendingToDelete(client.id)}
                              className="rounded-lg bg-dark-700 p-1.5 text-dark-300 hover:text-red-400 hover:bg-red-500/10 transition" title="Cancel invite"
                            >
                              <span className="material-symbols-outlined text-[16px]">close</span>
                            </button>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Expanded Details */}
                {isExpanded && client.client_id && (
                  <div className="border-t border-dark-700 p-4">
                    {!details ? (
                      <div className="flex justify-center py-4">
                        <div className="h-6 w-6 animate-spin rounded-full border-2 border-dark-600 border-t-primary-500" />
                      </div>
                    ) : (
                      <div className="space-y-6">
                        {/* Actions */}
                        <div className="flex gap-2 flex-wrap">
                          <button
                            onClick={() => { setPasswordClient({ id: client.client_id, name: clientName, email: clientEmail }); setNewPassword(''); setPasswordSuccess(false) }}
                            className="inline-flex items-center gap-1 rounded-md bg-dark-700 px-3 py-1.5 text-xs text-dark-200 hover:bg-dark-600 transition"
                          >
                            <KeyIcon className="h-3.5 w-3.5" />
                            Set Password
                          </button>
                          {client.profiles?.locked_at && (
                            <button
                              onClick={async () => {
                                await supabase.rpc('unlock_account', { target_user_id: client.client_id })
                                fetchClients()
                              }}
                              className="inline-flex items-center gap-1.5 rounded-md bg-amber-500/10 border border-amber-500/20 px-3 py-1.5 text-xs text-amber-400 hover:bg-amber-500/20 transition"
                            >
                              <span className="material-symbols-outlined text-[14px]">lock_open</span>
                              Unlock Account
                            </button>
                          )}
                          {clientToDelete === client.client_id ? (
                            <div className="inline-flex items-center gap-1.5">
                              <span className="text-xs text-red-400">Delete this client?</span>
                              <button onClick={async () => { await supabase.rpc('delete_user', { user_id: client.client_id }); setClientToDelete(null); fetchClients() }}
                                className="rounded-md bg-red-600 px-2 py-1 text-xs text-white hover:bg-red-700 transition">Yes</button>
                              <button onClick={() => setClientToDelete(null)}
                                className="rounded-md bg-dark-600 px-2 py-1 text-xs text-dark-200 hover:bg-dark-500 transition">No</button>
                            </div>
                          ) : (
                            <button onClick={() => setClientToDelete(client.client_id)}
                              className="inline-flex items-center gap-1 rounded-md bg-red-500/10 border border-red-500/20 px-3 py-1.5 text-xs text-red-400 hover:bg-red-500/20 transition">
                              <span className="material-symbols-outlined text-[14px]">delete</span>
                              Delete Client
                            </button>
                          )}
                        </div>

                        {/* PRs Table */}
                        <div>
                          <h3 className="mb-2 text-sm font-semibold text-dark-200">
                            Personal Records
                          </h3>
                          {details.prs.length === 0 ? (
                            <p className="text-xs text-dark-500">No PRs recorded yet.</p>
                          ) : (
                            <div className="overflow-x-auto">
                              <table className="w-full text-sm">
                                <thead>
                                  <tr className="border-b border-dark-600 text-left text-xs text-dark-400">
                                    <th className="pb-2 pr-4">Exercise</th>
                                    <th className="pb-2 pr-4">Category</th>
                                    <th className="pb-2 pr-4">Weight (kg)</th>
                                    <th className="pb-2">Date</th>
                                  </tr>
                                </thead>
                                <tbody className="text-dark-200">
                                  {details.prs.map((pr) => (
                                    <tr
                                      key={pr.id}
                                      className="border-b border-dark-700/50"
                                    >
                                      <td className="py-2 pr-4">
                                        {pr.exercises?.name}
                                      </td>
                                      <td className="py-2 pr-4">
                                        {pr.exercises?.category}
                                      </td>
                                      <td className="py-2 pr-4 font-medium">
                                        {pr.weight_kg}
                                      </td>
                                      <td className="py-2">
                                        {new Date(
                                          pr.date_achieved
                                        ).toLocaleDateString()}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          )}
                        </div>

                        {/* Workout Plans */}
                        <div>
                          <div className="mb-2 flex items-center justify-between">
                            <h3 className="text-sm font-semibold text-dark-200">
                              Workout Plans
                            </h3>
                            <button
                              onClick={() =>
                                openAssignModal(client.client_id, 'workout')
                              }
                              className="text-xs text-primary-400 hover:text-primary-300"
                            >
                              + Assign Plan
                            </button>
                          </div>
                          {details.workoutPlans.length === 0 ? (
                            <p className="text-xs text-dark-500">
                              No workout plans assigned.
                            </p>
                          ) : (
                            <div className="space-y-1">
                              {details.workoutPlans.map((wp) => (
                                <div
                                  key={wp.id}
                                  className="flex items-center justify-between rounded bg-dark-700/50 px-3 py-2"
                                >
                                  <span className="text-sm text-dark-200">
                                    {wp.name}
                                  </span>
                                  <span
                                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                                      wp.is_active
                                        ? 'bg-green-500/10 text-green-400'
                                        : 'bg-dark-600 text-dark-400'
                                    }`}
                                  >
                                    {wp.is_active ? 'Active' : 'Inactive'}
                                  </span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>

                        {/* Nutrition Plans */}
                        <div>
                          <div className="mb-2 flex items-center justify-between">
                            <h3 className="text-sm font-semibold text-dark-200">
                              Nutrition Plans
                            </h3>
                            <button
                              onClick={() =>
                                openAssignModal(client.client_id, 'nutrition')
                              }
                              className="text-xs text-primary-400 hover:text-primary-300"
                            >
                              + Assign Plan
                            </button>
                          </div>
                          {details.nutritionPlans.length === 0 ? (
                            <p className="text-xs text-dark-500">
                              No nutrition plans assigned.
                            </p>
                          ) : (
                            <div className="space-y-1">
                              {details.nutritionPlans.map((np) => (
                                <div
                                  key={np.id}
                                  className="flex items-center justify-between rounded bg-dark-700/50 px-3 py-2"
                                >
                                  <span className="text-sm text-dark-200">
                                    {np.name}
                                  </span>
                                  <span
                                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                                      np.is_active
                                        ? 'bg-green-500/10 text-green-400'
                                        : 'bg-dark-600 text-dark-400'
                                    }`}
                                  >
                                    {np.is_active ? 'Active' : 'Inactive'}
                                  </span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Invite Modal */}
      {showInviteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md rounded-xl border border-dark-700 bg-dark-800 p-6">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-dark-100">Invite Client</h2>
              <button
                onClick={() => setShowInviteModal(false)}
                className="text-dark-400 hover:text-dark-200"
              >
                <XMarkIcon className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleInvite}>
              <label className="mb-1 block text-sm text-dark-300">
                Client Email
              </label>
              <div className="relative">
                <EnvelopeIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-dark-400" />
                <input
                  type="email"
                  required
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="client@example.com"
                  className="w-full rounded-lg border border-dark-600 bg-dark-700 py-2 pl-9 pr-3 text-sm text-dark-100 placeholder-dark-500 focus:border-primary-500 focus:outline-none"
                />
              </div>

              {inviteError && (
                <p className="mt-2 text-sm text-red-400">{inviteError}</p>
              )}
              {inviteSuccess && (
                <p className="mt-2 text-sm text-green-400">
                  Invitation sent successfully!
                </p>
              )}

              <button
                type="submit"
                disabled={inviting}
                className="mt-4 w-full rounded-lg bg-primary-600 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-500 disabled:opacity-50"
              >
                {inviting ? 'Sending...' : 'Send Invite'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Set Password Modal */}
      {passwordClient && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-sm rounded-xl border border-dark-700 bg-dark-800 p-6">
            <h3 className="text-lg font-semibold text-dark-100 mb-1">Set Password</h3>
            <p className="text-sm text-dark-400 mb-4">
              Set password for <span className="text-dark-100 font-medium">{passwordClient.name || passwordClient.email}</span>
            </p>
            <form onSubmit={handleSetClientPassword} className="space-y-4">
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
                <button type="button" onClick={() => setPasswordClient(null)}
                  className="rounded-lg border border-dark-600 bg-dark-700 px-4 py-2 text-sm text-dark-200 hover:bg-dark-600 transition">
                  Close
                </button>
                <button type="submit" disabled={settingPassword || !newPassword}
                  className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700 transition disabled:opacity-50">
                  {settingPassword ? 'Setting...' : 'Set Password'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Assign Plan Modal */}
      {showAssignModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md rounded-xl border border-dark-700 bg-dark-800 p-6">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-dark-100">
                Assign {showAssignModal.type === 'workout' ? 'Workout' : 'Nutrition'}{' '}
                Plan
              </h2>
              <button
                onClick={() => setShowAssignModal(null)}
                className="text-dark-400 hover:text-dark-200"
              >
                <XMarkIcon className="h-5 w-5" />
              </button>
            </div>

            {availablePlans.length === 0 ? (
              <p className="text-sm text-dark-400">
                No unassigned plans available. Create a new plan first.
              </p>
            ) : (
              <div className="space-y-2">
                {availablePlans.map((plan) => (
                  <button
                    key={plan.id}
                    disabled={assigningPlan}
                    onClick={() => assignPlan(plan.id)}
                    className="flex w-full items-center justify-between rounded-lg border border-dark-600 bg-dark-700/50 p-3 text-left transition-colors hover:border-primary-500/50 hover:bg-dark-700 disabled:opacity-50"
                  >
                    <span className="text-sm text-dark-200">{plan.name}</span>
                    <span className="text-xs text-primary-400">Assign</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
