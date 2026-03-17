import { useState, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'

export default function PhotoUpload({ onUpload }) {
  const { profile } = useAuth()
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState(null)
  const fileRef = useRef()

  async function handleUpload(e) {
    const file = e.target.files?.[0]
    if (!file || !profile) return

    setUploading(true)
    setError(null)

    try {
      const ext = file.name.split('.').pop()
      const fileName = `${profile.id}/${Date.now()}.${ext}`

      const { error: uploadErr } = await supabase.storage
        .from('progress-photos')
        .upload(fileName, file, { cacheControl: '3600', upsert: false })

      if (uploadErr) throw uploadErr

      const { data: { publicUrl } } = supabase.storage
        .from('progress-photos')
        .getPublicUrl(fileName)

      // Save to progress_photos table
      const { error: dbErr } = await supabase.from('progress_photos').insert({
        client_id: profile.id,
        photo_url: publicUrl,
        taken_at: new Date().toISOString().split('T')[0],
      })

      if (dbErr) throw dbErr

      onUpload?.()
      fileRef.current.value = ''
    } catch (err) {
      setError(err.message || 'Upload failed')
    } finally {
      setUploading(false)
    }
  }

  return (
    <div>
      <input ref={fileRef} type="file" accept="image/*" onChange={handleUpload} className="hidden" />
      <button
        onClick={() => fileRef.current?.click()}
        disabled={uploading}
        className="w-full flex items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-primary/20 bg-primary/5 py-4 text-sm font-medium text-primary hover:bg-primary/10 transition disabled:opacity-50"
      >
        <span className="material-symbols-outlined text-[20px]">{uploading ? 'progress_activity' : 'add_a_photo'}</span>
        {uploading ? 'Uploading...' : 'Upload Progress Photo'}
      </button>
      {error && <p className="text-xs text-red-400 mt-2">{error}</p>}
    </div>
  )
}
