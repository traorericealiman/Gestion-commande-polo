import { Outlet, Navigate, Link, NavLink } from 'react-router-dom'
import { LayoutDashboard, ExternalLink } from 'lucide-react'
import { useAuth } from '@/lib/auth'
import { cn } from '@/lib/utils'
import Logo from './Logo'
import ProfileMenu from './admin/ProfileMenu'
import { useScrollMemory } from '@/hooks/useScrollMemory'
import ChangePasswordPage from '@/pages/admin/ChangePasswordPage'

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

  // Mot de passe provisoire : la gestion reste fermée tant qu'il n'est pas changé
  if (user.doit_changer_mot_de_passe) return <ChangePasswordPage obligatoire />

  return (
    <div className="min-h-screen bg-white">
      <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/90 backdrop-blur-lg">
        <div className="mx-auto flex h-[72px] max-w-[1440px] items-center justify-between gap-4 px-4 sm:px-8 lg:px-12">
          <div className="flex items-center gap-4 sm:gap-6">
            <Link to="/admin" aria-label="Tableau de bord" className="shrink-0">
              <Logo className="h-11 sm:h-14" />
            </Link>
            <span className="hidden h-8 w-px bg-slate-200 sm:block" />
            <nav className="flex items-center gap-1">
              <NavLink
                to="/admin"
                end
                className={({ isActive }) =>
                  cn(
                    'inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold transition',
                    isActive ? 'bg-navy text-white' : 'text-slate-600 hover:bg-slate-100 hover:text-navy'
                  )
                }
              >
                <LayoutDashboard className="h-4 w-4" />
                <span className="hidden sm:inline">Tableau de bord</span>
              </NavLink>
              <a
                href="/"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-100 hover:text-navy"
              >
                <ExternalLink className="h-4 w-4" />
                <span className="hidden md:inline">Voir le site</span>
              </a>
            </nav>
          </div>

          <ProfileMenu user={user} onLogout={() => logout()} />
        </div>
      </header>

      <main className="mx-auto max-w-[1440px] px-5 pb-20 pt-10 sm:px-8 lg:px-12">
        <Outlet />
      </main>
    </div>
  )
}
