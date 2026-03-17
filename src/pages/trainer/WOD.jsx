import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import {
  PlusIcon,
  TrashIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  FireIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline'

const SECTIONS = ['warmup', 'strength', 'cardio', 'metcon', 'other']

const SECTION_LABELS = {
  warmup: 'Warmup',
  strength: 'Strength',
  cardio: 'Cardio',
  metcon: 'Metcon',
  other: 'Other',
}

const SECTION_COLORS = {
  warmup: 'bg-yellow-500/20 text-yellow-400',
  strength: 'bg-red-500/20 text-red-400',
  cardio: 'bg-green-500/20 text-green-400',
  metcon: 'bg-purple-500/20 text-purple-400',
  other: 'bg-dark-500/20 text-dark-300',
}

function formatTime(seconds) {
  if (!seconds) return '—'
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${mins}:${String(secs).padStart(2, '0')}`
}

export default function WOD() {
  const { profile } = useAuth()
  const [wods, setWods] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [showForm, setShowForm] = useState(false)
  const [expandedId, setExpandedId] = useState(null)
  const [results, setResults] = useState({})
  const [loadingResults, setLoadingResults] = useState({})
  const [deleting, setDeleting] = useState(null)
  const [saving, setSaving] = useState(false)

  // Form state
  const [formTitle, setFormTitle] = useState('')
  const [formDescription, setFormDescription] = useState('')
  const [formSection, setFormSection] = useState('metcon')
  const [formDetails, setFormDetails] = useState('')

  const fetchWods = useCallback(async () => {
    if (!profile?.id) return
    try {
      setLoading(true)
      setError(null)

      const { data, error: fetchErr } = await supabase
        .from('wods')
        .select('*')
        .eq('trainer_id', profile.id)
        .order('created_at', { ascending: false })

      if (fetchErr) throw fetchErr
      setWods(data || [])
    } catch (err) {
      console.error('Fetch WODs error:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [profile?.id])

  useEffect(() => {
    fetchWods()
  }, [fetchWods])

  async function fetchResults(wodId) {
    if (results[wodId]) return
    try {
      setLoadingResults((prev) => ({ ...prev, [wodId]: true }))

      const { data, error: fetchErr } = await supabase
        .from('wod_results')
        .select('id, client_id, score, time_seconds, rx, notes, created_at')
        .eq('wod_id', wodId)
        .order('created_at', { ascending: true })

      if (fetchErr) throw fetchErr

      // Get client names
      const clientIds = [...new Set((data || []).map((r) => r.client_id))]
      let profileMap = {}

      if (clientIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, full_name')
          .in('id', clientIds)

        ;(profiles || []).forEach((p) => {
          profileMap[p.id] = p.full_name
        })
      }

      const enriched = (data || []).map((r) => ({
        ...r,
        client_name: profileMap[r.client_id] || 'Unknown',
      }))

      setResults((prev) => ({ ...prev, [wodId]: enriched }))
    } catch (err) {
      console.error('Fetch results error:', err)
      setError(err.message)
    } finally {
      setLoadingResults((prev) => ({ ...prev, [wodId]: false }))
    }
  }

  function handleExpand(wodId) {
    if (expandedId === wodId) {
      setExpandedId(null)
    } else {
      setExpandedId(wodId)
      fetchResults(wodId)
    }
  }

  async function handleCreate(e) {
    e.preventDefault()
    if (!formTitle.trim()) return

    try {
      setSaving(true)
      setError(null)

      const { error: insertErr } = await supabase.from('wods').insert({
        trainer_id: profile.id,
        title: formTitle.trim(),
        description: formDescription.trim() || null,
        section: formSection,
        workout_details: { prescription: formDetails.trim() },
        published_at: new Date().toISOString(),
      })

      if (insertErr) throw insertErr

      setFormTitle('')
      setFormDescription('')
      setFormSection('metcon')
      setFormDetails('')
      setShowForm(false)
      await fetchWods()
    } catch (err) {
      console.error('Create WOD error:', err)
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(wodId) {
    try {
      setDeleting(wodId)
      setError(null)

      const { error: deleteErr } = await supabase
        .from('wods')
        .delete()
        .eq('id', wodId)
        .eq('trainer_id', profile.id)

      if (deleteErr) throw deleteErr

      setWods((prev) => prev.filter((w) => w.id !== wodId))
      if (expandedId === wodId) setExpandedId(null)
      setResults((prev) => {
        const next = { ...prev }
        delete next[wodId]
        return next
      })
    } catch (err) {
      console.error('Delete WOD error:', err)
      setError(err.message)
    } finally {
      setDeleting(null)
    }
  }

  if (loading && wods.length === 0) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-dark-600 border-t-primary-500" />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6 lg:p-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <FireIcon className="h-7 w-7 text-primary-500" />
          <h1 className="text-2xl font-bold text-dark-100">Workout of the Day</h1>
        </div>
        <button
          onClick={() => setShowForm((prev) => !prev)}
          className="flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-500"
        >
          {showForm ? (
            <>
              <XMarkIcon className="h-4 w-4" />
              Cancel
            </>
          ) : (
            <>
              <PlusIcon className="h-4 w-4" />
              Create WOD
            </>
          )}
        </button>
      </div>

      {error && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-400">
          {error}
        </div>
      )}

      {/* Create Form */}
      {showForm && (
        <form
          onSubmit={handleCreate}
          className="space-y-4 rounded-xl border border-dark-700 bg-dark-800 p-5"
        >
          <h2 className="text-lg font-semibold text-dark-100">New WOD</h2>

          <div>
            <label className="mb-1 block text-xs font-medium text-dark-400">Title</label>
            <input
              type="text"
              value={formTitle}
              onChange={(e) => setFormTitle(e.target.value)}
              placeholder="e.g. Tuesday Grinder"
              required
              className="w-full rounded-lg border border-dark-600 bg-dark-700 px-3 py-2 text-sm text-dark-100 placeholder-dark-500 focus:border-primary-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-dark-400">Section</label>
            <select
              value={formSection}
              onChange={(e) => setFormSection(e.target.value)}
              className="w-full rounded-lg border border-dark-600 bg-dark-700 px-3 py-2 text-sm text-dark-100 focus:border-primary-500 focus:outline-none"
            >
              {SECTIONS.map((s) => (
                <option key={s} value={s}>
                  {SECTION_LABELS[s]}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-dark-400">Description</label>
            <textarea
              value={formDescription}
              onChange={(e) => setFormDescription(e.target.value)}
              placeholder="Brief description or coaching notes..."
              rows={2}
              className="w-full rounded-lg border border-dark-600 bg-dark-700 px-3 py-2 text-sm text-dark-100 placeholder-dark-500 focus:border-primary-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-dark-400">
              Workout Prescription
            </label>
            <textarea
              value={formDetails}
              onChange={(e) => setFormDetails(e.target.value)}
              placeholder={"3 Rounds For Time:\n  400m Run\n  21 KB Swings (24/16 kg)\n  12 Pull-ups"}
              rows={5}
              className="w-full rounded-lg border border-dark-600 bg-dark-700 px-3 py-2 text-sm font-mono text-dark-100 placeholder-dark-500 focus:border-primary-500 focus:outline-none"
            />
          </div>

          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="rounded-lg bg-dark-700 px-4 py-2 text-sm text-dark-300 transition-colors hover:bg-dark-600"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || !formTitle.trim()}
              className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-500 disabled:opacity-50"
            >
              {saving ? 'Creating...' : 'Create WOD'}
            </button>
          </div>
        </form>
      )}

      {/* WOD List */}
      {wods.length === 0 ? (
        <div className="rounded-xl border border-dark-700 bg-dark-800 p-12 text-center">
          <FireIcon className="mx-auto h-12 w-12 text-dark-500" />
          <p className="mt-3 text-dark-400">No WODs created yet.</p>
          <p className="mt-1 text-sm text-dark-500">
            Create your first Workout of the Day and it will be visible to all your clients.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {wods.map((wod) => {
            const isExpanded = expandedId === wod.id
            const wodResults = results[wod.id] || []
            const isLoadingResults = loadingResults[wod.id]
            const details =
              typeof wod.workout_details === 'object'
                ? wod.workout_details?.prescription || ''
                : ''

            return (
              <div
                key={wod.id}
                className="rounded-xl border border-dark-700 bg-dark-800 transition-colors"
              >
                {/* Card Header */}
                <button
                  onClick={() => handleExpand(wod.id)}
                  className="flex w-full items-start justify-between px-5 py-4 text-left"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-dark-100">{wod.title}</h3>
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${SECTION_COLORS[wod.section] || SECTION_COLORS.other}`}
                      >
                        {SECTION_LABELS[wod.section] || wod.section}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-dark-500">
                      {new Date(wod.created_at).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </p>
                    {wod.description && (
                      <p className="mt-1 line-clamp-2 text-sm text-dark-400">
                        {wod.description}
                      </p>
                    )}
                  </div>
                  {isExpanded ? (
                    <ChevronUpIcon className="ml-3 mt-1 h-5 w-5 shrink-0 text-dark-500" />
                  ) : (
                    <ChevronDownIcon className="ml-3 mt-1 h-5 w-5 shrink-0 text-dark-500" />
                  )}
                </button>

                {/* Expanded Content */}
                {isExpanded && (
                  <div className="border-t border-dark-700 px-5 py-4 space-y-4">
                    {/* Full Details */}
                    {details && (
                      <div>
                        <h4 className="mb-1 text-xs font-medium uppercase tracking-wide text-dark-400">
                          Workout Prescription
                        </h4>
                        <pre className="whitespace-pre-wrap rounded-lg bg-dark-700 p-3 text-sm font-mono text-dark-200">
                          {details}
                        </pre>
                      </div>
                    )}

                    {/* Results Table */}
                    <div>
                      <h4 className="mb-2 text-xs font-medium uppercase tracking-wide text-dark-400">
                        Client Results
                      </h4>

                      {isLoadingResults ? (
                        <div className="flex justify-center py-4">
                          <div className="h-5 w-5 animate-spin rounded-full border-2 border-dark-600 border-t-primary-500" />
                        </div>
                      ) : wodResults.length === 0 ? (
                        <p className="py-3 text-sm text-dark-500">
                          No results submitted yet.
                        </p>
                      ) : (
                        <div className="overflow-x-auto rounded-lg border border-dark-600">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="border-b border-dark-600 text-left text-xs uppercase tracking-wide text-dark-400">
                                <th className="px-4 py-2">Client Name</th>
                                <th className="px-4 py-2">Score</th>
                                <th className="px-4 py-2">Time</th>
                                <th className="px-4 py-2 text-center">Rx?</th>
                                <th className="px-4 py-2">Notes</th>
                              </tr>
                            </thead>
                            <tbody>
                              {wodResults.map((r) => (
                                <tr
                                  key={r.id}
                                  className="border-b border-dark-700/50 last:border-0"
                                >
                                  <td className="px-4 py-2 font-medium text-dark-200">
                                    {r.client_name}
                                  </td>
                                  <td className="px-4 py-2 text-primary-400">
                                    {r.score || '—'}
                                  </td>
                                  <td className="px-4 py-2 text-dark-300">
                                    {formatTime(r.time_seconds)}
                                  </td>
                                  <td className="px-4 py-2 text-center">
                                    {r.rx ? (
                                      <span className="text-green-400 font-semibold">Rx</span>
                                    ) : (
                                      <span className="text-dark-500">Scaled</span>
                                    )}
                                  </td>
                                  <td className="px-4 py-2 text-dark-400">
                                    {r.notes || '—'}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>

                    {/* Delete Button */}
                    <div className="flex justify-end border-t border-dark-700 pt-3">
                      {deleting === wod.id ? (
                        <div className="flex items-center gap-3">
                          <span className="text-sm text-dark-400">Delete this WOD?</span>
                          <button
                            onClick={() => handleDelete(wod.id)}
                            className="rounded-lg bg-red-600 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-red-500"
                          >
                            Confirm
                          </button>
                          <button
                            onClick={() => setDeleting(null)}
                            className="rounded-lg bg-dark-700 px-3 py-1.5 text-sm text-dark-300 transition-colors hover:bg-dark-600"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setDeleting(wod.id)}
                          className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm text-red-400 transition-colors hover:bg-red-500/10"
                        >
                          <TrashIcon className="h-4 w-4" />
                          Delete WOD
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {loading && wods.length > 0 && (
        <div className="flex justify-center py-4">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-dark-600 border-t-primary-500" />
        </div>
      )}
    </div>
  )
}
