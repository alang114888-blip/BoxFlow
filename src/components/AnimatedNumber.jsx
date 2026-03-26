import { useState, useEffect } from 'react'

export default function AnimatedNumber({ value, duration = 600, className = '' }) {
  const [display, setDisplay] = useState(0)

  useEffect(() => {
    if (value === 0) { setDisplay(0); return }
    const startTime = Date.now()

    function tick() {
      const elapsed = Date.now() - startTime
      const progress = Math.min(elapsed / duration, 1)
      const eased = 1 - Math.pow(1 - progress, 3)
      setDisplay(Math.round(value * eased))
      if (progress < 1) requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
  }, [value, duration])

  return <span className={className}>{display}</span>
}
