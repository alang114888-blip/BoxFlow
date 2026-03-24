import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'

export default function PRBoard() {
  const { profile } = useAuth()
  const [exercises, setExercises] = useState([])
  const [clientPRs, setClientPRs] = useState([])
  const [clients, setClients] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // Add exercise form
  const [showAdd, setShowAdd] = useState(false)
  const [newName, setNewName] = useState('')
  const [newVideo, setNewVideo] = useState('')
  const [saving, setSaving] = useState(false)

  // Assign exercise modal
  const [assignExercise, setAssignExercise] = useState(null)
  const [selectedClient, setSelectedClient] = useState('')
  const [assigning, setAssigning] = useState(false)

  // Apply defaults
  const [applyingDefaults, setApplyingDefaults] = useState(false)
  const [defaultsApplied, setDefaultsApplied] = useState(false)

  // Client PR viewer
  const [selectedPRClient, setSelectedPRClient] = useState('')

  useEffect(() => {
    if (!profile) return
    fetchData()
  }, [profile])

  async function fetchData() {
    try {
      setLoading(true)
      setError(null)

      // Fetch trainer exercises + system defaults
      const [trainerExRes, sysExRes, clientRes] = await Promise.all([
        supabase
          .from('exercises')
          .select('id, name, video_url, is_pr_eligible, trainer_id')
          .eq('trainer_id', profile.id)
          .eq('is_pr_eligible', true)
          .order('name'),
        supabase
          .from('exercises')
          .select('id, name, video_url, is_pr_eligible, trainer_id')
          .is('trainer_id', null)
          .eq('is_default', true)
          .order('name'),
        supabase
          .from('trainer_clients')
          .select('client_id, profiles:client_id ( id, full_name, email )')
          .eq('trainer_id', profile.id)
          .eq('invite_accepted', true),
      ])

      const allExercises = [...(sysExRes.data || []), ...(trainerExRes.data || [])]
      const allExIds = allExercises.map(e => e.id)

      // Fetch PRs for all these exercises
      const { data: prData } = allExIds.length > 0
        ? await supabase
            .from('client_prs')
            .select('id, weight_kg, date_achieved, updated_at, client_id, exercises ( id, name ), profiles:client_id ( full_name, email )')
            .in('exercise_id', allExIds)
        : { data: [] }

      const prRes = { data: prData || [] }

      setExercises(allExercises)
      setClientPRs(prRes.data || [])
      setClients((clientRes.data || []).map(c => c.profiles).filter(Boolean))
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  async function handleAddExercise(e) {
    e.preventDefault()
    setSaving(true)
    try {
      const { error: insertErr } = await supabase.from('exercises').insert({
        trainer_id: profile.id,
        name: newName,
        video_url: newVideo || null,
        is_pr_eligible: true,
        category: 'strength',
      })
      if (insertErr) throw insertErr
      setNewName('')
      setNewVideo('')
      setShowAdd(false)
      fetchData()
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  async function handleAssign() {
    if (!assignExercise || !selectedClient) return
    setAssigning(true)
    try {
      // Create a PR record with 0 weight (client fills in later)
      const { error: insertErr } = await supabase.from('client_prs').upsert({
        client_id: selectedClient,
        exercise_id: assignExercise.id,
        weight_kg: 0,
        date_achieved: new Date().toISOString().split('T')[0],
      }, { onConflict: 'client_id,exercise_id' })
      if (insertErr) throw insertErr
      setAssignExercise(null)
      setSelectedClient('')
      fetchData()
    } catch (err) {
      setError(err.message)
    } finally {
      setAssigning(false)
    }
  }

  async function applyDefaultTemplate(clientId) {
    if (!clientId) return
    setApplyingDefaults(true)
    setDefaultsApplied(false)
    try {
      // Get trainer's default exercises
      const { data: defaults } = await supabase
        .from('trainer_default_exercises')
        .select('exercise_id')
        .eq('trainer_id', profile.id)
        .order('sort_order')

      if (!defaults || defaults.length === 0) {
        // Fallback: use all system default exercises
        const { data: sysDefaults } = await supabase
          .from('exercises')
          .select('id')
          .is('trainer_id', null)
          .eq('is_default', true)

        if (sysDefaults) {
          for (const ex of sysDefaults) {
            await supabase.from('client_prs').upsert({
              client_id: clientId,
              exercise_id: ex.id,
              weight_kg: 0,
              date_achieved: new Date().toISOString().split('T')[0],
            }, { onConflict: 'client_id,exercise_id', ignoreDuplicates: true })
          }
        }
      } else {
        for (const d of defaults) {
          await supabase.from('client_prs').upsert({
            client_id: clientId,
            exercise_id: d.exercise_id,
            weight_kg: 0,
            date_achieved: new Date().toISOString().split('T')[0],
          }, { onConflict: 'client_id,exercise_id', ignoreDuplicates: true })
        }
      }
      setDefaultsApplied(true)
      fetchData()
    } catch (err) {
      setError(err.message)
    } finally {
      setApplyingDefaults(false)
    }
  }

  async function handleDeleteExercise(id) {
    const ex = exercises.find(e => e.id === id)
    if (!ex?.trainer_id) { alert('Cannot delete system default exercises'); return }
    if (!confirm('Delete this PR exercise?')) return
    await supabase.from('exercises').delete().eq('id', id)
    fetchData()
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <span className="material-symbols-outlined text-primary animate-spin text-3xl">progress_activity</span>
      </div>
    )
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="text-xl font-bold text-white">PR Board</h2>
          <p className="text-xs text-slate-400">Track your clients' personal records</p>
        </div>
        <button
          onClick={() => setShowAdd(!showAdd)}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-primary to-purple-500 text-white text-xs font-bold shadow-lg shadow-primary/20 hover:shadow-primary/40 transition-all active:scale-95"
        >
          <span className="material-symbols-outlined text-[18px]">add</span>
          Add Exercise
        </button>
      </div>

      {error && (
        <div className="mb-4 rounded-xl bg-red-500/10 border border-red-500/20 p-3 text-sm text-red-400">{error}</div>
      )}

      {/* Apply Default Template */}
      {clients.length > 0 && (
        <div className="mb-4 rounded-2xl border border-primary/10 bg-[#1a1426] p-3">
          <div className="flex items-center gap-3">
            <span className="material-symbols-outlined text-primary text-[20px]">playlist_add_check</span>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-slate-200">Apply Default Template</p>
              <p className="text-[10px] text-slate-500">Add default PR exercises to a client</p>
            </div>
            <select
              defaultValue=""
              onChange={(e) => { if (e.target.value) applyDefaultTemplate(e.target.value) }}
              disabled={applyingDefaults}
              className="rounded-lg bg-slate-900/50 border border-slate-700 px-2 py-1.5 text-xs text-white focus:outline-none focus:ring-1 focus:ring-primary/50 max-w-[140px]"
            >
              <option value="">Select client...</option>
              {clients.map(c => <option key={c.id} value={c.id}>{c.full_name || c.email}</option>)}
            </select>
          </div>
          {applyingDefaults && <p className="mt-2 text-xs text-primary animate-pulse">Applying defaults...</p>}
          {defaultsApplied && <p className="mt-2 text-xs text-emerald-400">Default exercises applied!</p>}
        </div>
      )}

      {/* Add Exercise Form */}
      {showAdd && (
        <form onSubmit={handleAddExercise} className="mb-5 rounded-2xl border border-primary/10 bg-[#1a1426] p-4 space-y-3">
          <input
            type="text"
            required
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Exercise name (e.g. Back Squat)"
            className="w-full bg-slate-900/50 border border-slate-700 rounded-lg py-3 px-4 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all"
          />
          <input
            type="url"
            value={newVideo}
            onChange={(e) => setNewVideo(e.target.value)}
            placeholder="Video URL (optional)"
            className="w-full bg-slate-900/50 border border-slate-700 rounded-lg py-3 px-4 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all"
          />
          <div className="flex gap-2">
            <button type="button" onClick={() => setShowAdd(false)} className="flex-1 py-2.5 rounded-lg text-sm text-slate-400 hover:text-white hover:bg-white/5 transition">
              Cancel
            </button>
            <button type="submit" disabled={saving} className="flex-1 py-2.5 rounded-lg bg-primary text-white text-sm font-semibold hover:bg-[#6d28d9] transition disabled:opacity-50">
              {saving ? 'Saving...' : 'Save Exercise'}
            </button>
          </div>
        </form>
      )}

      {/* Exercises - compact table */}
      {exercises.length === 0 ? (
        <div className="text-center py-12 rounded-2xl border border-primary/10 bg-[#1a1225]">
          <span className="material-symbols-outlined text-slate-600 text-4xl mb-2">fitness_center</span>
          <p className="text-slate-400 text-sm">No PR exercises defined yet.</p>
        </div>
      ) : (
        <div className="mb-6 rounded-2xl border border-primary/10 bg-[#1a1225] overflow-hidden">
          {/* Group by category */}
          {(() => {
            const categories = {}
            exercises.forEach(ex => {
              const cat = ex.category || 'other'
              if (!categories[cat]) categories[cat] = []
              categories[cat].push(ex)
            })
            return Object.entries(categories).map(([cat, exList]) => (
              <div key={cat}>
                <div className="px-3 py-1.5 bg-white/[0.02] border-b border-white/5">
                  <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">{cat}</span>
                </div>
                {exList.map(ex => {
                  const prs = clientPRs.filter(p => p.exercises?.id === ex.id)
                  return (
                    <div key={ex.id} className="flex items-center px-3 py-2 border-b border-white/5 hover:bg-white/[0.02] group">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-white truncate">{ex.name}</p>
                        {ex.video_url && (
                          <a href={ex.video_url} target="_blank" rel="noreferrer" className="text-[9px] text-primary hover:underline">Video</a>
                        )}
                      </div>
                      <span className="text-[10px] text-slate-500 px-2 w-16 text-center">{prs.length} client{prs.length !== 1 ? 's' : ''}</span>
                      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => { setAssignExercise(ex); setSelectedClient('') }}
                          className="p-1 rounded text-slate-400 hover:text-primary transition" title="Assign">
                          <span className="material-symbols-outlined text-[16px]">person_add</span>
                        </button>
                        <button onClick={() => handleDeleteExercise(ex.id)}
                          className="p-1 rounded text-slate-400 hover:text-red-400 transition" title="Delete">
                          <span className="material-symbols-outlined text-[16px]">delete</span>
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            ))
          })()}
        </div>
      )}

      {/* Client PR Values — with client dropdown */}
      <div className="mb-6 rounded-2xl border border-primary/10 bg-[#1a1225] overflow-hidden">
        <div className="px-3 py-2.5 border-b border-white/5 flex items-center justify-between">
          <span className="text-xs font-bold text-slate-300">Client PR Values</span>
          <select
            value={selectedPRClient}
            onChange={(e) => setSelectedPRClient(e.target.value)}
            className="bg-[#0f0a19] border border-primary/10 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:ring-1 focus:ring-primary/30 max-w-[160px]"
          >
            <option value="">Select client...</option>
            {clients.map(c => <option key={c.id} value={c.id}>{c.full_name || c.email}</option>)}
          </select>
        </div>

        {!selectedPRClient ? (
          <div className="px-4 py-8 text-center">
            <span className="material-symbols-outlined text-slate-600 text-3xl mb-1">person_search</span>
            <p className="text-xs text-slate-500">Select a client to view their PRs</p>
          </div>
        ) : (() => {
          // Show all exercises with this client's PR values
          const clientPrMap = {}
          clientPRs.filter(p => p.client_id === selectedPRClient).forEach(p => {
            clientPrMap[p.exercise_id || p.exercises?.id] = p
          })

          // Group exercises by category
          const categories = {}
          exercises.forEach(ex => {
            const cat = ex.category || 'other'
            if (!categories[cat]) categories[cat] = []
            categories[cat].push(ex)
          })

          return (
            <div>
              {Object.entries(categories).map(([cat, exList]) => (
                <div key={cat}>
                  <div className="px-3 py-1 bg-white/[0.02] border-b border-white/5">
                    <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">{cat}</span>
                  </div>
                  {exList.map(ex => {
                    const pr = clientPrMap[ex.id]
                    return (
                      <div key={ex.id} className="flex items-center px-3 py-2 border-b border-white/5 hover:bg-white/[0.02]">
                        <span className="flex-1 text-xs text-slate-200">{ex.name}</span>
                        <span className={`text-xs font-bold w-16 text-right ${pr?.weight_kg > 0 ? 'text-primary' : 'text-slate-600'}`}>
                          {pr?.weight_kg > 0 ? `${pr.weight_kg} kg` : '0 kg'}
                        </span>
                        <span className="text-[10px] text-slate-500 w-20 text-right">
                          {pr?.date_achieved ? new Date(pr.date_achieved).toLocaleDateString() : '—'}
                        </span>
                      </div>
                    )
                  })}
                </div>
              ))}
            </div>
          )
        })()}
      </div>

      {/* Assign Exercise Modal */}
      {assignExercise && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm px-4">
          <div className="w-full max-w-sm rounded-2xl p-6 shadow-2xl" style={{ background: 'rgba(30, 41, 59, 0.9)', border: '1px solid rgba(124, 59, 237, 0.2)' }}>
            <h3 className="text-lg font-semibold text-white mb-1">Assign Exercise</h3>
            <p className="text-sm text-slate-400 mb-4">
              Assign <span className="text-primary font-medium">{assignExercise.name}</span> to a client
            </p>

            <select
              value={selectedClient}
              onChange={(e) => setSelectedClient(e.target.value)}
              className="w-full bg-slate-900/50 border border-slate-700 rounded-lg py-3 px-4 text-sm text-white focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary mb-4"
            >
              <option value="">Select a client...</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>{c.full_name || c.email}</option>
              ))}
            </select>

            <div className="flex gap-3">
              <button
                onClick={() => setAssignExercise(null)}
                className="flex-1 py-2.5 rounded-lg text-sm text-slate-400 hover:text-white hover:bg-white/5 transition"
              >
                Cancel
              </button>
              <button
                onClick={handleAssign}
                disabled={!selectedClient || assigning}
                className="flex-1 py-2.5 rounded-lg bg-primary text-white text-sm font-semibold hover:bg-[#6d28d9] transition disabled:opacity-50"
              >
                {assigning ? 'Assigning...' : 'Assign'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
