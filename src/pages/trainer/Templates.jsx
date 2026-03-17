import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'

export default function Templates() {
  const { profile } = useAuth()
  const [templates, setTemplates] = useState([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [showDuplicate, setShowDuplicate] = useState(null) // template id
  const [plans, setPlans] = useState([])
  const [clients, setClients] = useState([])
  const [deleteConfirm, setDeleteConfirm] = useState(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  // Create form state
  const [formTitle, setFormTitle] = useState('')
  const [formDescription, setFormDescription] = useState('')
  const [formSourcePlan, setFormSourcePlan] = useState('')
  const [formAutoAssign, setFormAutoAssign] = useState(false)

  // Duplicate form state
  const [duplicateClientId, setDuplicateClientId] = useState('')

  useEffect(() => {
    if (!profile) return
    fetchTemplates()
  }, [profile])

  async function fetchTemplates() {
    try {
      setLoading(true)
      const { data, error: fetchErr } = await supabase
        .from('workout_templates')
        .select('*')
        .eq('trainer_id', profile.id)
        .order('created_at', { ascending: false })

      if (fetchErr) throw fetchErr
      setTemplates(data || [])
    } catch (err) {
      console.error('Fetch templates error:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  async function fetchPlansAndClients() {
    const [plansRes, clientsRes] = await Promise.all([
      supabase
        .from('workout_plans')
        .select('id, name, client_id, profiles!workout_plans_client_id_fkey ( full_name )')
        .eq('trainer_id', profile.id)
        .order('name'),
      supabase
        .from('trainer_clients')
        .select('client_id, profiles!trainer_clients_client_id_fkey ( id, full_name )')
        .eq('trainer_id', profile.id)
        .eq('invite_accepted', true),
    ])
    setPlans(plansRes.data || [])
    setClients(
      (clientsRes.data || []).map((tc) => ({
        id: tc.client_id,
        full_name: tc.profiles?.full_name || 'Unknown',
      }))
    )
  }

  async function openCreateModal() {
    setFormTitle('')
    setFormDescription('')
    setFormSourcePlan('')
    setFormAutoAssign(false)
    setError(null)
    await fetchPlansAndClients()
    setShowCreate(true)
  }

  async function openDuplicateModal(templateId) {
    setDuplicateClientId('')
    setError(null)
    await fetchPlansAndClients()
    setShowDuplicate(templateId)
  }

  async function buildStructureFromPlan(planId) {
    const { data: days } = await supabase
      .from('workout_days')
      .select(`
        id, day_of_week, name,
        workout_exercises (
          exercise_id, sets, reps, percentage_of_pr, section, notes, order_index
        )
      `)
      .eq('plan_id', planId)
      .order('day_of_week')

    const structure = {
      days: (days || []).map((day) => ({
        name: day.name || day.day_of_week,
        day_of_week: day.day_of_week,
        exercises: (day.workout_exercises || [])
          .sort((a, b) => (a.order_index || 0) - (b.order_index || 0))
          .map((ex) => ({
            exercise_id: ex.exercise_id,
            sets: ex.sets,
            reps: ex.reps,
            percentage_of_pr: ex.percentage_of_pr,
            section: ex.section || 'strength',
            notes: ex.notes || '',
          })),
      })),
    }
    return structure
  }

  async function handleCreateTemplate() {
    if (!formTitle.trim()) {
      setError('Title is required')
      return
    }
    try {
      setSaving(true)
      setError(null)

      let structureJson = { days: [] }
      if (formSourcePlan) {
        structureJson = await buildStructureFromPlan(formSourcePlan)
      }

      const { error: insertErr } = await supabase.from('workout_templates').insert({
        trainer_id: profile.id,
        title: formTitle.trim(),
        description: formDescription.trim(),
        structure_json: structureJson,
        auto_assign: formAutoAssign,
      })

      if (insertErr) throw insertErr

      setShowCreate(false)
      await fetchTemplates()
    } catch (err) {
      console.error('Create template error:', err)
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  async function handleDuplicate(templateId) {
    if (!duplicateClientId) {
      setError('Please select a client')
      return
    }
    try {
      setSaving(true)
      setError(null)

      const template = templates.find((t) => t.id === templateId)
      if (!template) throw new Error('Template not found')

      const structure = template.structure_json

      // Create workout plan
      const { data: newPlan, error: planErr } = await supabase
        .from('workout_plans')
        .insert({
          trainer_id: profile.id,
          client_id: duplicateClientId,
          name: template.title,
          is_active: true,
        })
        .select('id')
        .single()

      if (planErr) throw planErr

      // Insert days and exercises
      if (structure?.days?.length > 0) {
        for (const day of structure.days) {
          const { data: newDay, error: dayErr } = await supabase
            .from('workout_days')
            .insert({
              plan_id: newPlan.id,
              day_of_week: day.day_of_week,
              name: day.name,
            })
            .select('id')
            .single()

          if (dayErr) throw dayErr

          if (day.exercises?.length > 0) {
            const exerciseRows = day.exercises.map((ex, idx) => ({
              day_id: newDay.id,
              exercise_id: ex.exercise_id,
              sets: ex.sets,
              reps: ex.reps,
              percentage_of_pr: ex.percentage_of_pr,
              section: ex.section || 'strength',
              notes: ex.notes || '',
              order_index: idx,
            }))
            const { error: exErr } = await supabase.from('workout_exercises').insert(exerciseRows)
            if (exErr) throw exErr
          }
        }
      }

      setShowDuplicate(null)
      alert('Plan created from template successfully!')
    } catch (err) {
      console.error('Duplicate template error:', err)
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(templateId) {
    try {
      const { error: delErr } = await supabase
        .from('workout_templates')
        .delete()
        .eq('id', templateId)
        .eq('trainer_id', profile.id)

      if (delErr) throw delErr
      setDeleteConfirm(null)
      await fetchTemplates()
    } catch (err) {
      console.error('Delete template error:', err)
      setError(err.message)
    }
  }

  function countExercises(template) {
    const structure = template.structure_json
    if (!structure?.days) return 0
    return structure.days.reduce((sum, day) => sum + (day.exercises?.length || 0), 0)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-dark-600 border-t-primary" />
      </div>
    )
  }

  return (
    <div className="font-[Lexend]">
      {/* Header */}
      <div className="mb-5 flex items-center justify-between">
        <h2 className="text-lg font-bold text-white">Templates</h2>
        <button
          onClick={openCreateModal}
          className="flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-primary/90 active:scale-[0.97]"
        >
          <span className="material-symbols-outlined text-base">add</span>
          Create Template
        </button>
      </div>

      {/* Templates List */}
      {templates.length === 0 ? (
        <div className="rounded-2xl border border-primary/10 bg-[#1a1225] p-8 text-center">
          <span className="material-symbols-outlined mb-2 text-4xl text-dark-500">content_copy</span>
          <p className="text-sm text-dark-400">No templates yet</p>
          <p className="mt-1 text-xs text-dark-500">Create a template to quickly assign workout plans</p>
        </div>
      ) : (
        <div className="space-y-3">
          {templates.map((template) => (
            <div
              key={template.id}
              className="rounded-2xl border border-primary/10 bg-[#1a1426] p-4"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="truncate text-sm font-semibold text-white">{template.title}</h3>
                    {template.auto_assign && (
                      <span className="rounded-full bg-primary/20 px-2 py-0.5 text-[10px] font-semibold text-primary">
                        Auto-assign
                      </span>
                    )}
                  </div>
                  {template.description && (
                    <p className="mt-1 text-xs text-dark-400 line-clamp-2">{template.description}</p>
                  )}
                  <div className="mt-2 flex items-center gap-3 text-[10px] text-dark-500">
                    <span className="flex items-center gap-1">
                      <span className="material-symbols-outlined text-xs">fitness_center</span>
                      {countExercises(template)} exercise{countExercises(template) !== 1 ? 's' : ''}
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="material-symbols-outlined text-xs">calendar_today</span>
                      {template.structure_json?.days?.length || 0} day{(template.structure_json?.days?.length || 0) !== 1 ? 's' : ''}
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="material-symbols-outlined text-xs">schedule</span>
                      {new Date(template.created_at).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="mt-3 flex gap-2 border-t border-white/5 pt-3">
                <button
                  onClick={() => openDuplicateModal(template.id)}
                  className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-primary/10 py-2 text-xs font-semibold text-primary transition-colors hover:bg-primary/20"
                >
                  <span className="material-symbols-outlined text-sm">person_add</span>
                  Assign to Client
                </button>
                {deleteConfirm === template.id ? (
                  <div className="flex gap-1.5">
                    <button
                      onClick={() => handleDelete(template.id)}
                      className="rounded-xl bg-red-500/20 px-3 py-2 text-xs font-semibold text-red-400 transition-colors hover:bg-red-500/30"
                    >
                      Confirm
                    </button>
                    <button
                      onClick={() => setDeleteConfirm(null)}
                      className="rounded-xl bg-dark-600/50 px-3 py-2 text-xs font-semibold text-dark-300 transition-colors hover:bg-dark-600"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setDeleteConfirm(template.id)}
                    className="flex items-center justify-center rounded-xl bg-red-500/10 px-3 py-2 text-xs text-red-400 transition-colors hover:bg-red-500/20"
                  >
                    <span className="material-symbols-outlined text-sm">delete</span>
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Template Modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 sm:items-center" onClick={() => setShowCreate(false)}>
          <div
            className="w-full max-w-md rounded-t-2xl bg-[#0f0a19] p-5 sm:rounded-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-base font-bold text-white">Create Template</h3>
              <button onClick={() => setShowCreate(false)} className="text-dark-400 hover:text-white">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            {error && (
              <div className="mb-3 rounded-xl bg-red-500/10 border border-red-500/20 p-3 text-xs text-red-400">
                {error}
              </div>
            )}

            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-dark-400">
                  Title *
                </label>
                <input
                  type="text"
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  placeholder="e.g. 5x5 Strength Program"
                  className="w-full rounded-xl border border-primary/10 bg-[#1a1225] px-3 py-2.5 text-sm text-white placeholder:text-dark-500 focus:border-primary/40 focus:outline-none"
                />
              </div>

              <div>
                <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-dark-400">
                  Description
                </label>
                <textarea
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  placeholder="Brief description of this template..."
                  rows={2}
                  className="w-full rounded-xl border border-primary/10 bg-[#1a1225] px-3 py-2.5 text-sm text-white placeholder:text-dark-500 focus:border-primary/40 focus:outline-none resize-none"
                />
              </div>

              <div>
                <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-dark-400">
                  Copy from existing plan
                </label>
                <select
                  value={formSourcePlan}
                  onChange={(e) => setFormSourcePlan(e.target.value)}
                  className="w-full rounded-xl border border-primary/10 bg-[#1a1225] px-3 py-2.5 text-sm text-white focus:border-primary/40 focus:outline-none"
                >
                  <option value="">Start from scratch</option>
                  {plans.map((plan) => (
                    <option key={plan.id} value={plan.id}>
                      {plan.name} {plan.profiles?.full_name ? `(${plan.profiles.full_name})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              <label className="flex items-center gap-3 rounded-xl border border-primary/10 bg-[#1a1225] px-3 py-2.5 cursor-pointer">
                <div
                  className={`relative h-5 w-9 rounded-full transition-colors ${formAutoAssign ? 'bg-primary' : 'bg-dark-600'}`}
                  onClick={() => setFormAutoAssign(!formAutoAssign)}
                >
                  <div
                    className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-transform ${formAutoAssign ? 'translate-x-4' : 'translate-x-0.5'}`}
                  />
                </div>
                <span className="text-xs text-dark-200">Auto-assign to new clients</span>
              </label>
            </div>

            <div className="mt-4 flex gap-2">
              <button
                onClick={() => setShowCreate(false)}
                className="flex-1 rounded-xl bg-dark-600/50 py-2.5 text-xs font-semibold text-dark-300 hover:bg-dark-600"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateTemplate}
                disabled={saving}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-primary py-2.5 text-xs font-semibold text-white hover:bg-primary/90 disabled:opacity-50"
              >
                {saving ? (
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                ) : (
                  <>
                    <span className="material-symbols-outlined text-sm">save</span>
                    Create Template
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Duplicate to Client Modal */}
      {showDuplicate && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 sm:items-center" onClick={() => setShowDuplicate(null)}>
          <div
            className="w-full max-w-md rounded-t-2xl bg-[#0f0a19] p-5 sm:rounded-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-base font-bold text-white">Assign to Client</h3>
              <button onClick={() => setShowDuplicate(null)} className="text-dark-400 hover:text-white">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <p className="mb-3 text-xs text-dark-400">
              This will create a new workout plan for the selected client based on the template structure.
            </p>

            {error && (
              <div className="mb-3 rounded-xl bg-red-500/10 border border-red-500/20 p-3 text-xs text-red-400">
                {error}
              </div>
            )}

            <div>
              <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-dark-400">
                Select Client *
              </label>
              <select
                value={duplicateClientId}
                onChange={(e) => setDuplicateClientId(e.target.value)}
                className="w-full rounded-xl border border-primary/10 bg-[#1a1225] px-3 py-2.5 text-sm text-white focus:border-primary/40 focus:outline-none"
              >
                <option value="">Choose a client...</option>
                {clients.map((client) => (
                  <option key={client.id} value={client.id}>
                    {client.full_name}
                  </option>
                ))}
              </select>
            </div>

            <div className="mt-4 flex gap-2">
              <button
                onClick={() => setShowDuplicate(null)}
                className="flex-1 rounded-xl bg-dark-600/50 py-2.5 text-xs font-semibold text-dark-300 hover:bg-dark-600"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDuplicate(showDuplicate)}
                disabled={saving}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-primary py-2.5 text-xs font-semibold text-white hover:bg-primary/90 disabled:opacity-50"
              >
                {saving ? (
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                ) : (
                  <>
                    <span className="material-symbols-outlined text-sm">content_copy</span>
                    Create Plan
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
