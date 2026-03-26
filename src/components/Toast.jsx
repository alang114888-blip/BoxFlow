import { useState, useEffect } from 'react'

let showToastFn = null

export function toast(message, type = 'success') {
  if (showToastFn) showToastFn({ message, type })
}

export default function ToastContainer() {
  const [toasts, setToasts] = useState([])

  useEffect(() => {
    showToastFn = (t) => {
      const id = Date.now()
      setToasts(prev => [...prev, { ...t, id }])
      setTimeout(() => setToasts(prev => prev.filter(x => x.id !== id)), 3000)
    }
    return () => { showToastFn = null }
  }, [])

  const icons = { success: 'check_circle', error: 'error', info: 'info' }
  const colors = { success: 'text-emerald-400', error: 'text-red-400', info: 'text-blue-400' }

  return (
    <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[100] flex flex-col gap-2 items-center pointer-events-none">
      {toasts.map(t => (
        <div key={t.id} className="slide-up flex items-center gap-2 bg-[#1a1225] border border-white/10 rounded-xl px-4 py-2.5 shadow-xl pointer-events-auto">
          <span className={`material-symbols-outlined text-[18px] ${colors[t.type]}`} style={{ fontVariationSettings: "'FILL' 1" }}>{icons[t.type]}</span>
          <span className="text-sm text-white font-medium">{t.message}</span>
        </div>
      ))}
    </div>
  )
}
