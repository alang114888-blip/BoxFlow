const CONFIGS = {
  workout: { icon: 'fitness_center', title: 'No workout today', subtitle: 'Your trainer will assign your next workout soon' },
  nutrition: { icon: 'restaurant', title: 'No nutrition plan yet', subtitle: 'Your trainer will set up your meal plan' },
  clients: { icon: 'group', title: 'No clients yet', subtitle: 'Invite your first client to get started' },
  prs: { icon: 'trophy', title: 'No PR exercises', subtitle: 'Your trainer will set up PR tracking for you' },
  habits: { icon: 'checklist', title: 'No habits set up', subtitle: 'Ask your trainer to add daily habits' },
  wod: { icon: 'local_fire_department', title: 'No workouts posted', subtitle: 'Check back later for new challenges' },
  photos: { icon: 'photo_library', title: 'No photos yet', subtitle: 'Upload your first progress photo' },
  history: { icon: 'history', title: 'No activity yet', subtitle: 'Complete your first workout to see history' },
}

export default function EmptyState({ type = 'workout', action, actionLabel }) {
  const config = CONFIGS[type] || CONFIGS.workout
  return (
    <div className="flex flex-col items-center justify-center py-12 px-6">
      <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
        <span className="material-symbols-outlined text-primary text-3xl">{config.icon}</span>
      </div>
      <p className="text-white font-semibold text-sm mb-1">{config.title}</p>
      <p className="text-slate-500 text-xs text-center max-w-[240px]">{config.subtitle}</p>
      {action && (
        <button onClick={action} className="mt-4 px-5 py-2 rounded-xl bg-primary/20 text-primary text-xs font-semibold hover:bg-primary/30 transition btn-press">
          {actionLabel || 'Get started'}
        </button>
      )}
    </div>
  )
}
