import { Outlet, Navigate, Link } from 'react-router-dom'
import { useAuth } from '@/lib/auth'
import Logo from './Logo'
import { useScrollMemory } from '@/hooks/useScrollMemory'

export default function AdminLayout() {
  const { user, loading, logout } = useAuth()
  useScrollMemory()

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white">
        <div className="h-7 w-7 animate-spin rounded-full border-2 border-navy border-t-transparent" />
      </div>
    )
  }

  if (!user) return <Navigate to="/admin/login" replace />

  return (
    <div className="min-h-screen bg-white">
      <header className="sticky top-0 z-40 border-b border-slate-100 bg-white/90 backdrop-blur-lg">
        <div className="mx-auto flex h-[72px] max-w-[1440px] items-center justify-between px-5 sm:px-8 lg:px-12">
          <Link to="/admin" aria-label="Tableau de bord">
            <Logo className="h-14" />
          </Link>
          <div className="flex items-center gap-5 text-sm">
            <span className="hidden text-slate-500 sm:inline">
              {user.first_name} {user.last_name}
            </span>
            <button
              type="button"
              onClick={() => logout()}
              className="font-semibold text-navy hover:underline"
            >
              Déconnexion
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1440px] px-5 pb-20 pt-10 sm:px-8 lg:px-12">
        <Outlet />
      </main>
    </div>
  )
}
