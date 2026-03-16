export default function LoadingSpinner() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-dark-900">
      <div className="h-12 w-12 animate-spin rounded-full border-4 border-dark-600 border-t-primary-500" />
    </div>
  )
}
