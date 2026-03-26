export function SkeletonCard({ lines = 3 }) {
  return (
    <div className="animate-pulse rounded-2xl bg-[#1a1225] border border-white/5 p-4 space-y-3">
      <div className="h-4 bg-white/5 rounded-lg w-3/4" />
      {Array.from({ length: lines - 1 }).map((_, i) => (
        <div key={i} className="h-3 bg-white/5 rounded-lg" style={{ width: `${60 + Math.random() * 30}%` }} />
      ))}
    </div>
  )
}

export function SkeletonList({ count = 4, lines = 2 }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonCard key={i} lines={lines} />
      ))}
    </div>
  )
}

export function SkeletonDashboard() {
  return (
    <div className="space-y-6 px-5 py-4">
      <div className="animate-pulse rounded-2xl bg-gradient-to-r from-primary/20 to-purple-500/20 h-32" />
      <div className="grid grid-cols-3 gap-3">
        {[1,2,3].map(i => (
          <div key={i} className="animate-pulse rounded-2xl bg-[#1a1225] border border-white/5 h-20" />
        ))}
      </div>
      <SkeletonList count={3} />
    </div>
  )
}

export function SkeletonTable({ rows = 5, cols = 4 }) {
  return (
    <div className="animate-pulse space-y-2">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex gap-4 py-3 border-b border-white/5">
          {Array.from({ length: cols }).map((_, j) => (
            <div key={j} className="h-3 bg-white/5 rounded flex-1" />
          ))}
        </div>
      ))}
    </div>
  )
}
