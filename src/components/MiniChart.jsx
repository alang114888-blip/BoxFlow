import { useRef, useEffect } from 'react'

export default function MiniChart({ data = [], color = '#7c3bed', height = 60, showDots = true }) {
  const canvasRef = useRef(null)

  useEffect(() => {
    if (!canvasRef.current || data.length < 2) return
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    const dpr = window.devicePixelRatio || 1
    const w = canvas.clientWidth
    const h = canvas.clientHeight
    canvas.width = w * dpr
    canvas.height = h * dpr
    ctx.scale(dpr, dpr)
    ctx.clearRect(0, 0, w, h)

    const values = data.map(d => d.value)
    const min = Math.min(...values)
    const max = Math.max(...values)
    const range = max - min || 1
    const padY = 8

    const points = values.map((v, i) => ({
      x: (i / (values.length - 1)) * (w - 20) + 10,
      y: padY + (1 - (v - min) / range) * (h - padY * 2),
    }))

    ctx.beginPath()
    ctx.moveTo(points[0].x, h)
    points.forEach(p => ctx.lineTo(p.x, p.y))
    ctx.lineTo(points[points.length - 1].x, h)
    ctx.closePath()
    ctx.fillStyle = color + '15'
    ctx.fill()

    ctx.beginPath()
    points.forEach((p, i) => i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y))
    ctx.strokeStyle = color
    ctx.lineWidth = 2
    ctx.lineJoin = 'round'
    ctx.stroke()

    if (showDots) {
      points.forEach((p, i) => {
        ctx.beginPath()
        ctx.arc(p.x, p.y, i === points.length - 1 ? 4 : 2.5, 0, Math.PI * 2)
        ctx.fillStyle = i === points.length - 1 ? color : color + '80'
        ctx.fill()
      })
    }
  }, [data, color, height])

  if (data.length < 2) {
    return (
      <div className="flex items-center justify-center text-slate-600 text-xs" style={{ height }}>
        Not enough data yet
      </div>
    )
  }

  return <canvas ref={canvasRef} style={{ width: '100%', height }} />
}
