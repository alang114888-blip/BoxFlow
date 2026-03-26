import { useEffect, useRef } from 'react'

const COLORS = ['#7c3bed', '#a855f7', '#6366f1', '#10b981', '#f59e0b', '#ef4444', '#3b82f6', '#ec4899']

export default function Confetti({ active, duration = 2500 }) {
  const canvasRef = useRef(null)
  const animRef = useRef(null)

  useEffect(() => {
    if (!active || !canvasRef.current) return

    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    const dpr = window.devicePixelRatio || 1
    canvas.width = window.innerWidth * dpr
    canvas.height = window.innerHeight * dpr
    ctx.scale(dpr, dpr)

    const particles = []
    for (let i = 0; i < 80; i++) {
      particles.push({
        x: Math.random() * window.innerWidth,
        y: -20 - Math.random() * 100,
        w: 4 + Math.random() * 6,
        h: 3 + Math.random() * 4,
        color: COLORS[Math.floor(Math.random() * COLORS.length)],
        vx: (Math.random() - 0.5) * 4,
        vy: 2 + Math.random() * 4,
        rotation: Math.random() * 360,
        rotationSpeed: (Math.random() - 0.5) * 12,
        opacity: 1,
      })
    }

    const startTime = Date.now()
    function animate() {
      const elapsed = Date.now() - startTime
      if (elapsed > duration) { ctx.clearRect(0, 0, window.innerWidth, window.innerHeight); return }
      ctx.clearRect(0, 0, window.innerWidth, window.innerHeight)
      const fadeStart = duration * 0.7
      particles.forEach(p => {
        p.x += p.vx; p.y += p.vy; p.vy += 0.1; p.rotation += p.rotationSpeed
        if (elapsed > fadeStart) p.opacity = Math.max(0, 1 - (elapsed - fadeStart) / (duration - fadeStart))
        ctx.save()
        ctx.translate(p.x, p.y)
        ctx.rotate((p.rotation * Math.PI) / 180)
        ctx.globalAlpha = p.opacity
        ctx.fillStyle = p.color
        ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h)
        ctx.restore()
      })
      animRef.current = requestAnimationFrame(animate)
    }
    animRef.current = requestAnimationFrame(animate)
    return () => { if (animRef.current) cancelAnimationFrame(animRef.current) }
  }, [active, duration])

  if (!active) return null
  return <canvas ref={canvasRef} style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', pointerEvents: 'none', zIndex: 9999 }} />
}
