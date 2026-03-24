import { useState, useRef } from 'react'

export default function PullToRefresh({ children }) {
  const [pulling, setPulling] = useState(false)
  const [pullDistance, setPullDistance] = useState(0)
  const startY = useRef(0)
  const containerRef = useRef(null)

  const threshold = 80

  function handleTouchStart(e) {
    if (containerRef.current?.scrollTop === 0) {
      startY.current = e.touches[0].clientY
    }
  }

  function handleTouchMove(e) {
    if (containerRef.current?.scrollTop > 0) return
    const diff = e.touches[0].clientY - startY.current
    if (diff > 0) {
      setPulling(true)
      setPullDistance(Math.min(diff * 0.5, 120))
    }
  }

  function handleTouchEnd() {
    if (pullDistance >= threshold) {
      window.location.reload()
    }
    setPulling(false)
    setPullDistance(0)
  }

  return (
    <div
      ref={containerRef}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      className="flex-1 overflow-y-auto"
      style={{ position: 'relative' }}
    >
      {pulling && (
        <div className="flex items-center justify-center transition-all" style={{ height: pullDistance }}>
          <span
            className={`material-symbols-outlined text-primary ${pullDistance >= threshold ? 'animate-spin' : ''}`}
            style={{ opacity: Math.min(pullDistance / threshold, 1), transform: `rotate(${pullDistance * 3}deg)` }}
          >
            refresh
          </span>
        </div>
      )}
      {children}
    </div>
  )
}
