import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import {
  MagnifyingGlassIcon,
  PlusIcon,
  PencilSquareIcon,
  TrashIcon,
  XMarkIcon,
  VideoCameraIcon,
  StarIcon,
  FunnelIcon,
} from '@heroicons/react/24/outline'

const CATEGORIES = [
  'Strength',
  'Cardio',
  'Flexibility',
  'Olympic Lifting',
  'Bodyweight',
  'Core',
  'Plyometrics',
  'Other',
]

const initialForm = {
  name: '',
  category: '',
  description: '',
  video_url: '',
  is_pr_eligible: false,
}

export default function ExerciseLibrary() {
  const { profile } = useAuth()
  const [exercises, setExercises] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [search, setSearch] = useState('')
  const [filterCategory, setFilterCategory] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [form, setForm] = useState(initialForm)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState(null)
  const [deleting, setDeleting] = useState(null)

  useEffect(() => {
    if (!profile) return
    fetchExercises()
  }, [profile])

  async function fetchExercises() {
    try {
      setLoading(true)
      setError(null)

      const { data, error: fetchErr } = await supabase
        .from('exercises')
        .select('*')
        .eq('trainer_id', profile.id)
        .order('name')

      if (fetchErr) throw fetchErr
      setExercises(data || [])
    } catch (err) {
      console.error('Fetch exercises error:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  function openAddForm() {
    setForm(initialForm)
    setEditingId(null)
    setFormError(null)
    setShowForm(true)
  }

  function openEditForm(exercise) {
    setForm({
      name: exercise.name,
      category: exercise.category || '',
      description: exercise.description || '',
      video_url: exercise.video_url || '',
      is_pr_eligible: exercise.is_pr_eligible || false,
    })
    setEditingId(exercise.id)
    setFormError(null)
    setShowForm(true)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    try {
      setSaving(true)
      setFormError(null)

      const payload = {
        name: form.name.trim(),
        category: form.category || null,
        description: form.description.trim() || null,
        video_url: form.video_url.trim() || null,
        is_pr_eligible: form.is_pr_eligible,
        trainer_id: profile.id,
      }

      if (editingId) {
        const { error: upErr } = await supabase
          .from('exercises')
          .update(payload)
          .eq('id', editingId)
        if (upErr) throw upErr
      } else {
        const { error: insErr } = await supabase.from('exercises').insert(payload)
        if (insErr) throw insErr
      }

      setShowForm(false)
      setForm(initialForm)
      setEditingId(null)
      fetchExercises()
    } catch (err) {
      console.error('Save exercise error:', err)
      setFormError(err.message)
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id) {
    if (!confirm('Are you sure you want to delete this exercise?')) return
    try {
      setDeleting(id)
      const { error: delErr } = await supabase
        .from('exercises')
        .delete()
        .eq('id', id)
      if (delErr) throw delErr
      setExercises((prev) => prev.filter((ex) => ex.id !== id))
    } catch (err) {
      console.error('Delete exercise error:', err)
      alert('Failed to delete: ' + err.message)
    } finally {
      setDeleting(null)
    }
  }

  const filteredExercises = exercises.filter((ex) => {
    const matchesSearch = ex.name
      .toLowerCase()
      .includes(search.toLowerCase())
    const matchesCategory = !filterCategory || ex.category === filterCategory
    return matchesSearch && matchesCategory
  })

  const categories = [...new Set(exercises.map((e) => e.category).filter(Boolean))]

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
        <h1 className="text-2xl font-bold text-dark-100">Exercise Library</h1>
        <button
          onClick={openAddForm}
          className="flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-500"
        >
          <PlusIcon className="h-4 w-4" />
          Add Exercise
        </button>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-400">
          {error}
        </div>
      )}

      {/* Search & Filter */}
      <div className="mb-6 flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-dark-400" />
          <input
            type="text"
            placeholder="Search exercises..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg border border-dark-600 bg-dark-800 py-2 pl-9 pr-3 text-sm text-dark-100 placeholder-dark-500 focus:border-primary-500 focus:outline-none"
          />
        </div>
        <div className="relative">
          <FunnelIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-dark-400" />
          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            className="rounded-lg border border-dark-600 bg-dark-800 py-2 pl-9 pr-8 text-sm text-dark-100 focus:border-primary-500 focus:outline-none"
          >
            <option value="">All Categories</option>
            {categories.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Exercise Grid */}
      {filteredExercises.length === 0 ? (
        <div className="rounded-xl border border-dark-700 bg-dark-800 p-12 text-center">
          <PlusIcon className="mx-auto h-12 w-12 text-dark-500" />
          <p className="mt-3 text-dark-400">
            {exercises.length === 0
              ? 'No exercises yet. Add your first exercise to get started.'
              : 'No exercises match your search.'}
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredExercises.map((exercise) => (
            <div
              key={exercise.id}
              className="rounded-xl border border-dark-700 bg-dark-800 p-4"
            >
              <div className="mb-3 flex items-start justify-between">
                <div>
                  <h3 className="font-semibold text-dark-100">{exercise.name}</h3>
                  {exercise.category && (
                    <span className="mt-1 inline-block rounded-full bg-dark-700 px-2 py-0.5 text-xs text-dark-300">
                      {exercise.category}
                    </span>
                  )}
                </div>
                <div className="flex gap-1">
                  <button
                    onClick={() => openEditForm(exercise)}
                    className="rounded p-1.5 text-dark-400 transition-colors hover:bg-dark-700 hover:text-dark-200"
                  >
                    <PencilSquareIcon className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(exercise.id)}
                    disabled={deleting === exercise.id}
                    className="rounded p-1.5 text-dark-400 transition-colors hover:bg-red-500/10 hover:text-red-400 disabled:opacity-50"
                  >
                    <TrashIcon className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {exercise.description && (
                <p className="mb-3 text-sm text-dark-400 line-clamp-2">
                  {exercise.description}
                </p>
              )}

              <div className="flex items-center gap-3">
                {exercise.is_pr_eligible && (
                  <span className="flex items-center gap-1 rounded-full bg-yellow-500/10 px-2 py-0.5 text-xs font-medium text-yellow-400">
                    <StarIcon className="h-3 w-3" />
                    PR Eligible
                  </span>
                )}
                {exercise.video_url && (
                  <a
                    href={exercise.video_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-xs text-primary-400 hover:text-primary-300"
                  >
                    <VideoCameraIcon className="h-3.5 w-3.5" />
                    Video
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add/Edit Form Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-lg rounded-xl border border-dark-700 bg-dark-800 p-6">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-dark-100">
                {editingId ? 'Edit Exercise' : 'Add Exercise'}
              </h2>
              <button
                onClick={() => setShowForm(false)}
                className="text-dark-400 hover:text-dark-200"
              >
                <XMarkIcon className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="mb-1 block text-sm text-dark-300">Name *</label>
                <input
                  type="text"
                  required
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full rounded-lg border border-dark-600 bg-dark-700 px-3 py-2 text-sm text-dark-100 placeholder-dark-500 focus:border-primary-500 focus:outline-none"
                  placeholder="e.g. Back Squat"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm text-dark-300">Category</label>
                <select
                  value={form.category}
                  onChange={(e) => setForm({ ...form, category: e.target.value })}
                  className="w-full rounded-lg border border-dark-600 bg-dark-700 px-3 py-2 text-sm text-dark-100 focus:border-primary-500 focus:outline-none"
                >
                  <option value="">Select category</option>
                  {CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-sm text-dark-300">
                  Description
                </label>
                <textarea
                  value={form.description}
                  onChange={(e) =>
                    setForm({ ...form, description: e.target.value })
                  }
                  rows={3}
                  className="w-full rounded-lg border border-dark-600 bg-dark-700 px-3 py-2 text-sm text-dark-100 placeholder-dark-500 focus:border-primary-500 focus:outline-none"
                  placeholder="Exercise description or coaching cues..."
                />
              </div>

              <div>
                <label className="mb-1 block text-sm text-dark-300">Video URL</label>
                <input
                  type="url"
                  value={form.video_url}
                  onChange={(e) => setForm({ ...form, video_url: e.target.value })}
                  className="w-full rounded-lg border border-dark-600 bg-dark-700 px-3 py-2 text-sm text-dark-100 placeholder-dark-500 focus:border-primary-500 focus:outline-none"
                  placeholder="https://youtube.com/watch?v=..."
                />
              </div>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() =>
                    setForm({ ...form, is_pr_eligible: !form.is_pr_eligible })
                  }
                  className={`relative h-6 w-11 rounded-full transition-colors ${
                    form.is_pr_eligible ? 'bg-primary-600' : 'bg-dark-600'
                  }`}
                >
                  <span
                    className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white transition-transform ${
                      form.is_pr_eligible ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
                <label className="text-sm text-dark-300">PR Eligible</label>
              </div>

              {formError && (
                <p className="text-sm text-red-400">{formError}</p>
              )}

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="rounded-lg border border-dark-600 px-4 py-2 text-sm text-dark-300 transition-colors hover:bg-dark-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-500 disabled:opacity-50"
                >
                  {saving ? 'Saving...' : editingId ? 'Update' : 'Add Exercise'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
