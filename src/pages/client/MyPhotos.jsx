import { useState, useEffect } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { supabase } from '../../lib/supabase'
import PhotoUpload from '../../components/PhotoUpload'
import EmptyState from '../../components/EmptyState'

export default function MyPhotos() {
  const { profile } = useAuth()
  const [photos, setPhotos] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!profile) return
    fetchPhotos()
  }, [profile])

  async function fetchPhotos() {
    setLoading(true)
    const { data } = await supabase
      .from('progress_photos')
      .select('*')
      .eq('client_id', profile.id)
      .order('taken_at', { ascending: false })
    setPhotos(data || [])
    setLoading(false)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <span className="material-symbols-outlined text-primary animate-spin text-3xl">progress_activity</span>
      </div>
    )
  }

  return (
    <div className="px-4 py-4 max-w-lg mx-auto space-y-4">
      <h2 className="text-xl font-bold text-white">Progress Photos</h2>
      <p className="text-xs text-slate-400">Track your body transformation over time</p>

      <PhotoUpload onUpload={fetchPhotos} />

      {photos.length === 0 ? (
        <EmptyState type="photos" />
      ) : (
        <div className="space-y-4">
          {/* Group by month */}
          {(() => {
            const grouped = {}
            photos.forEach(p => {
              const month = new Date(p.taken_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long' })
              if (!grouped[month]) grouped[month] = []
              grouped[month].push(p)
            })
            return Object.entries(grouped).map(([month, items]) => (
              <div key={month}>
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">{month}</h3>
                <div className="grid grid-cols-2 gap-2">
                  {items.map(photo => (
                    <div key={photo.id} className="rounded-xl overflow-hidden border border-primary/10 bg-[#1a1225]">
                      <img src={photo.photo_url} alt="" className="w-full h-40 object-cover" />
                      <div className="p-2">
                        <p className="text-[10px] text-slate-400">{new Date(photo.taken_at).toLocaleDateString()}</p>
                        {photo.notes && <p className="text-xs text-slate-300 mt-0.5">{photo.notes}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))
          })()}
        </div>
      )}
    </div>
  )
}
