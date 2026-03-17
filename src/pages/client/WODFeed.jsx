import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import {
  FireIcon,
  ClockIcon,
  CheckCircleIcon,
  PencilSquareIcon,
  PlusIcon,
  TrophyIcon,
  ChevronDownIcon,
  ChevronUpIcon,
} from '@heroicons/react/24/outline'

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

function getRankStyle(rank) {
  if (rank === 1) return 'text-yellow-400'
  if (rank === 2) return 'text-dark-300'
  if (rank === 3) return 'text-amber-600'
  return 'text-dark-400'
}

export default function WODFeed() {
  const { profile } = useAuth()
  const [wods, setWods] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [myResults, setMyResults] = useState({}) // keyed by wod_id
  const [loggingWodId, setLoggingWodId] = useState(null)
  const [leaderboardWodId, setLeaderboardWodId] = useState(null)
  const [leaderboards, setLeaderboards] = useState({}) // keyed by wod_id
  const [loadingLeaderboard, setLoadingLeaderboard] = useState({})
  const [saving, setSaving] = useState(false)

  // Form state
  const [formScore, setFormScore] = useState('')
  const [formMinutes, setFormMinutes] = useState('')
  const [formSeconds, setFormSeconds] = useState('')
  const [formRx, setFormRx] = useState(true)
  const [formNotes, setFormNotes] = useState('')

  const fetchWods = useCallback(async () => {
    if (!profile?.id) return
    try {
      setLoading(true)
      setError(null)

      // Get the client's trainer(s)
      const { data: links, error: linksErr } = await supabase
        .from('trainer_clients')
        .select('trainer_id')
        .eq('client_id', profile.id)
        .eq('invite_accepted', true)

      if (linksErr) throw linksErr

      const trainerIds = (links || []).map((l) => l.trainer_id).filter(Boolean)

      if (trainerIds.length === 0) {
        setWods([])
        setLoading(false)
        return
      }

      // Get all WODs from those trainers
      const { data: wodData, error: wodErr } = await supabase
        .from('wods')
        .select('*')
        .in('trainer_id', trainerIds)
        .not('published_at', 'is', null)
        .order('created_at', { ascending: false })

      if (wodErr) throw wodErr

      // Get this client's existing results
      const wodIds = (wodData || []).map((w) => w.id)
      let resultMap = {}

      if (wodIds.length > 0) {
        const { data: resData } = await supabase
          .from('wod_results')
          .select('*')
          .eq('client_id', profile.id)
          .in('wod_id', wodIds)

        ;(resData || []).forEach((r) => {
          resultMap[r.wod_id] = r
        })
      }

      setWods(wodData || [])
      setMyResults(resultMap)
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

  function openLogForm(wodId) {
    const existing = myResults[wodId]
    if (existing) {
      setFormScore(existing.score || '')
      const totalSecs = existing.time_seconds || 0
      setFormMinutes(totalSecs > 0 ? String(Math.floor(totalSecs / 60)) : '')
      setFormSeconds(totalSecs > 0 ? String(totalSecs % 60) : '')
      setFormRx(existing.rx ?? true)
      setFormNotes(existing.notes || '')
    } else {
      setFormScore('')
      setFormMinutes('')
      setFormSeconds('')
      setFormRx(true)
      setFormNotes('')
    }
    setLoggingWodId(wodId)
  }

  async function handleSubmitResult(e) {
    e.preventDefault()
    if (!loggingWodId) return

    try {
      setSaving(true)
      setError(null)

      const timeSeconds =
        formMinutes || formSeconds
          ? (parseInt(formMinutes, 10) || 0) * 60 + (parseInt(formSeconds, 10) || 0)
          : null

      const payload = {
        wod_id: loggingWodId,
        client_id: profile.id,
        score: formScore.trim() || null,
        time_seconds: timeSeconds,
        rx: formRx,
        notes: formNotes.trim() || null,
      }

      const existing = myResults[loggingWodId]

      if (existing) {
        const { error: updateErr } = await supabase
          .from('wod_results')
          .update({
            score: payload.score,
            time_seconds: payload.time_seconds,
            rx: payload.rx,
            notes: payload.notes,
          })
          .eq('id', existing.id)

        if (updateErr) throw updateErr
      } else {
        const { error: insertErr } = await supabase
          .from('wod_results')
          .insert(payload)

        if (insertErr) throw insertErr
      }

      setLoggingWodId(null)
      // Refresh to get updated results
      await fetchWods()
      // Also refresh leaderboard if open for this WOD
      if (leaderboardWodId === loggingWodId) {
        fetchLeaderboard(loggingWodId, true)
      }
    } catch (err) {
      console.error('Submit result error:', err)
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  async function fetchLeaderboard(wodId, force = false) {
    if (leaderboards[wodId] && !force) return
    try {
      setLoadingLeaderboard((prev) => ({ ...prev, [wodId]: true }))

      const { data, error: fetchErr } = await supabase
        .from('wod_results')
        .select('id, client_id, score, time_seconds, rx')
        .eq('wod_id', wodId)
        .order('time_seconds', { ascending: true, nullsFirst: false })

      if (fetchErr) throw fetchErr

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

      // Sort: Rx first, then by time (ascending, nulls last), then by score
      const sorted = (data || [])
        .map((r) => ({
          ...r,
          client_name: profileMap[r.client_id] || 'Unknown',
        }))
        .sort((a, b) => {
          // Rx before scaled
          if (a.rx !== b.rx) return a.rx ? -1 : 1
          // Then by time (ascending), nulls last
          if (a.time_seconds != null && b.time_seconds != null)
            return a.time_seconds - b.time_seconds
          if (a.time_seconds != null) return -1
          if (b.time_seconds != null) return 1
          // Then by score alphabetically
          return (a.score || '').localeCompare(b.score || '')
        })

      setLeaderboards((prev) => ({ ...prev, [wodId]: sorted }))
    } catch (err) {
      console.error('Fetch leaderboard error:', err)
    } finally {
      setLoadingLeaderboard((prev) => ({ ...prev, [wodId]: false }))
    }
  }

  function toggleLeaderboard(wodId) {
    if (leaderboardWodId === wodId) {
      setLeaderboardWodId(null)
    } else {
      setLeaderboardWodId(wodId)
      fetchLeaderboard(wodId)
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
      <div className="flex items-center gap-3">
        <FireIcon className="h-7 w-7 text-primary-500" />
        <div>
          <h1 className="text-2xl font-bold text-dark-100">Workout of the Day</h1>
          <p className="text-sm text-dark-400">Log your results and see how you stack up</p>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-400">
          {error}
        </div>
      )}

      {/* WOD Feed */}
      {wods.length === 0 ? (
        <div className="rounded-xl border border-dark-700 bg-dark-800 p-12 text-center">
          <FireIcon className="mx-auto h-12 w-12 text-dark-500" />
          <p className="mt-3 text-dark-400">No WODs available yet.</p>
          <p className="mt-1 text-sm text-dark-500">
            Your trainer hasn't published any workouts of the day.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {wods.map((wod) => {
            const existing = myResults[wod.id]
            const isLogging = loggingWodId === wod.id
            const isLeaderboardOpen = leaderboardWodId === wod.id
            const lb = leaderboards[wod.id] || []
            const isLoadingLb = loadingLeaderboard[wod.id]
            const details =
              typeof wod.workout_details === 'object'
                ? wod.workout_details?.prescription || ''
                : ''

            return (
              <div
                key={wod.id}
                className="rounded-xl border border-dark-700 bg-dark-800"
              >
                {/* WOD Card */}
                <div className="px-5 py-4">
                  <div className="flex items-start justify-between">
                    <div>
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
                          weekday: 'short',
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })}
                      </p>
                    </div>
                    {existing && (
                      <span className="flex items-center gap-1 rounded-full bg-green-500/10 px-2 py-0.5 text-xs font-medium text-green-400">
                        <CheckCircleIcon className="h-3.5 w-3.5" />
                        Logged
                      </span>
                    )}
                  </div>

                  {wod.description && (
                    <p className="mt-2 text-sm text-dark-300">{wod.description}</p>
                  )}

                  {details && (
                    <pre className="mt-3 whitespace-pre-wrap rounded-lg bg-dark-700 p-3 text-sm font-mono text-dark-200">
                      {details}
                    </pre>
                  )}

                  {/* Existing Result Display */}
                  {existing && !isLogging && (
                    <div className="mt-3 flex flex-wrap items-center gap-4 rounded-lg border border-dark-600 bg-dark-700/50 px-4 py-2.5 text-sm">
                      <span className="text-dark-400">
                        Your result:
                      </span>
                      {existing.score && (
                        <span className="text-primary-400 font-medium">
                          Score: {existing.score}
                        </span>
                      )}
                      {existing.time_seconds != null && (
                        <span className="flex items-center gap-1 text-dark-200">
                          <ClockIcon className="h-3.5 w-3.5 text-dark-500" />
                          {formatTime(existing.time_seconds)}
                        </span>
                      )}
                      <span className={existing.rx ? 'text-green-400 font-semibold' : 'text-dark-500'}>
                        {existing.rx ? 'Rx' : 'Scaled'}
                      </span>
                      {existing.notes && (
                        <span className="text-dark-400 text-xs">{existing.notes}</span>
                      )}
                    </div>
                  )}

                  {/* Action Buttons */}
                  <div className="mt-3 flex flex-wrap gap-2">
                    {!isLogging && (
                      <button
                        onClick={() => openLogForm(wod.id)}
                        className="flex items-center gap-1.5 rounded-lg bg-primary-600 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-primary-500"
                      >
                        {existing ? (
                          <>
                            <PencilSquareIcon className="h-4 w-4" />
                            Edit Result
                          </>
                        ) : (
                          <>
                            <PlusIcon className="h-4 w-4" />
                            Log Result
                          </>
                        )}
                      </button>
                    )}
                    <button
                      onClick={() => toggleLeaderboard(wod.id)}
                      className="flex items-center gap-1.5 rounded-lg border border-dark-600 px-3 py-1.5 text-sm text-dark-300 transition-colors hover:bg-dark-700 hover:text-dark-200"
                    >
                      <TrophyIcon className="h-4 w-4" />
                      Leaderboard
                      {isLeaderboardOpen ? (
                        <ChevronUpIcon className="h-3.5 w-3.5" />
                      ) : (
                        <ChevronDownIcon className="h-3.5 w-3.5" />
                      )}
                    </button>
                  </div>
                </div>

                {/* Log Result Form */}
                {isLogging && (
                  <div className="border-t border-dark-700 px-5 py-4">
                    <form onSubmit={handleSubmitResult} className="space-y-3">
                      <h4 className="text-sm font-semibold text-dark-200">
                        {existing ? 'Update Your Result' : 'Log Your Result'}
                      </h4>

                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <div>
                          <label className="mb-1 block text-xs font-medium text-dark-400">
                            Score
                          </label>
                          <input
                            type="text"
                            value={formScore}
                            onChange={(e) => setFormScore(e.target.value)}
                            placeholder="e.g. 5 rounds + 3 reps"
                            className="w-full rounded-lg border border-dark-600 bg-dark-700 px-3 py-2 text-sm text-dark-100 placeholder-dark-500 focus:border-primary-500 focus:outline-none"
                          />
                        </div>

                        <div>
                          <label className="mb-1 block text-xs font-medium text-dark-400">
                            Time
                          </label>
                          <div className="flex items-center gap-2">
                            <input
                              type="number"
                              min="0"
                              value={formMinutes}
                              onChange={(e) => setFormMinutes(e.target.value)}
                              placeholder="min"
                              className="w-full rounded-lg border border-dark-600 bg-dark-700 px-3 py-2 text-sm text-dark-100 placeholder-dark-500 focus:border-primary-500 focus:outline-none"
                            />
                            <span className="text-dark-500">:</span>
                            <input
                              type="number"
                              min="0"
                              max="59"
                              value={formSeconds}
                              onChange={(e) => setFormSeconds(e.target.value)}
                              placeholder="sec"
                              className="w-full rounded-lg border border-dark-600 bg-dark-700 px-3 py-2 text-sm text-dark-100 placeholder-dark-500 focus:border-primary-500 focus:outline-none"
                            />
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <label className="text-xs font-medium text-dark-400">Rx</label>
                        <button
                          type="button"
                          onClick={() => setFormRx((prev) => !prev)}
                          className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${
                            formRx ? 'bg-primary-600' : 'bg-dark-600'
                          }`}
                        >
                          <span
                            className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow transition-transform ${
                              formRx ? 'translate-x-5' : 'translate-x-0'
                            }`}
                          />
                        </button>
                        <span className="text-sm text-dark-300">
                          {formRx ? 'As prescribed' : 'Scaled'}
                        </span>
                      </div>

                      <div>
                        <label className="mb-1 block text-xs font-medium text-dark-400">
                          Notes
                        </label>
                        <textarea
                          value={formNotes}
                          onChange={(e) => setFormNotes(e.target.value)}
                          placeholder="How did it feel? Modifications?"
                          rows={2}
                          className="w-full rounded-lg border border-dark-600 bg-dark-700 px-3 py-2 text-sm text-dark-100 placeholder-dark-500 focus:border-primary-500 focus:outline-none"
                        />
                      </div>

                      <div className="flex justify-end gap-3">
                        <button
                          type="button"
                          onClick={() => setLoggingWodId(null)}
                          className="rounded-lg bg-dark-700 px-4 py-2 text-sm text-dark-300 transition-colors hover:bg-dark-600"
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          disabled={saving}
                          className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-500 disabled:opacity-50"
                        >
                          {saving ? 'Saving...' : existing ? 'Update Result' : 'Submit Result'}
                        </button>
                      </div>
                    </form>
                  </div>
                )}

                {/* Leaderboard */}
                {isLeaderboardOpen && (
                  <div className="border-t border-dark-700 px-5 py-4">
                    <h4 className="mb-2 flex items-center gap-2 text-sm font-semibold text-dark-200">
                      <TrophyIcon className="h-4 w-4 text-yellow-400" />
                      Leaderboard
                    </h4>

                    {isLoadingLb ? (
                      <div className="flex justify-center py-4">
                        <div className="h-5 w-5 animate-spin rounded-full border-2 border-dark-600 border-t-primary-500" />
                      </div>
                    ) : lb.length === 0 ? (
                      <p className="py-3 text-sm text-dark-500">
                        No results yet. Be the first to log!
                      </p>
                    ) : (
                      <div className="overflow-x-auto rounded-lg border border-dark-600">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b border-dark-600 text-left text-xs uppercase tracking-wide text-dark-400">
                              <th className="w-16 px-4 py-2">Rank</th>
                              <th className="px-4 py-2">Name</th>
                              <th className="px-4 py-2">Score</th>
                              <th className="px-4 py-2">Time</th>
                              <th className="px-4 py-2 text-center">Rx?</th>
                            </tr>
                          </thead>
                          <tbody>
                            {lb.map((entry, index) => {
                              const rank = index + 1
                              const isMe = entry.client_id === profile.id

                              return (
                                <tr
                                  key={entry.id}
                                  className={`border-b border-dark-700/50 last:border-0 ${
                                    isMe ? 'bg-primary-500/5' : ''
                                  } ${rank <= 3 ? 'bg-dark-700/20' : ''}`}
                                >
                                  <td className="px-4 py-2">
                                    <span className={`font-bold ${getRankStyle(rank)}`}>
                                      {rank === 1 && (
                                        <TrophyIcon className="mr-1 inline h-3.5 w-3.5 text-yellow-400" />
                                      )}
                                      {rank}
                                    </span>
                                  </td>
                                  <td className="px-4 py-2">
                                    <span className={`font-medium ${isMe ? 'text-primary-400' : 'text-dark-200'}`}>
                                      {entry.client_name}
                                      {isMe && (
                                        <span className="ml-1.5 text-xs text-primary-500">(you)</span>
                                      )}
                                    </span>
                                  </td>
                                  <td className="px-4 py-2 text-dark-300">
                                    {entry.score || '—'}
                                  </td>
                                  <td className="px-4 py-2 text-dark-300">
                                    {formatTime(entry.time_seconds)}
                                  </td>
                                  <td className="px-4 py-2 text-center">
                                    {entry.rx ? (
                                      <span className="font-semibold text-green-400">Rx</span>
                                    ) : (
                                      <span className="text-dark-500">Scaled</span>
                                    )}
                                  </td>
                                </tr>
                              )
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
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

