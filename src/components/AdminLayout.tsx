import { NavLink, Outlet, Navigate, Link } from 'react-router-dom'
import {
  LayoutDashboard,
  Package,
  LogOut,
  Menu,
  X,
  ChevronLeft,
} from 'lucide-react'
import { useState } from 'react'
import { useAuth } from '@/lib/auth'
import { cn } from '@/lib/utils'

const links = [
  { to: '/admin', end: true, label: 'Tableau de bord', icon: LayoutDashboard },
  { to: '/admin/commandes', end: false, label: 'Commandes', icon: Package },
]

export default function AdminLayout() {
  const { user, loading, logout } = useAuth()
  const [open, setOpen] = useState(false)

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-accent border-t-transparent" />
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/admin/login" replace />
  }

  return (
    <div className="flex min-h-screen bg-slate-50">
      {/* Sidebar desktop */}
      <aside className="hidden w-60 shrink-0 flex-col border-r border-slate-200 bg-navy text-white md:flex">
        <div className="flex h-16 items-center gap-2 border-b border-white/10 px-5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/10 text-xs font-bold">
            AE
          </div>
          <div>
            <p className="text-sm font-semibold">Admin Polos</p>
            <p className="text-[10px] text-white/50">ESATIC</p>
          </div>
        </div>
        <nav className="flex-1 space-y-1 p-3">
          {links.map((l) => (
            <NavLink
              key={l.to}
              to={l.to}
              end={l.end}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-medium transition',
                  isActive
                    ? 'bg-white/15 text-white'
                    : 'text-white/70 hover:bg-white/10 hover:text-white'
                )
              }
            >
              <l.icon className="h-4 w-4" />
              {l.label}
            </NavLink>
          ))}
        </nav>
        <div className="border-t border-white/10 p-4">
          <p className="truncate text-xs text-white/60">
            {user.first_name} {user.last_name}
          </p>
          <p className="truncate text-[11px] text-white/40">{user.email}</p>
          <p className="mt-0.5 text-[10px] uppercase tracking-wide text-white/30">
            {user.role === 'ADMIN' ? 'Administrateur' : 'Trésorière'}
          </p>
          <button
            type="button"
            onClick={() => logout()}
            className="mt-3 flex w-full items-center gap-2 rounded-lg px-2 py-2 text-xs text-white/60 hover:bg-white/10 hover:text-white"
          >
            <LogOut className="h-3.5 w-3.5" />
            Déconnexion
          </button>
        </div>
      </aside>

      {/* Main */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-40 flex h-14 items-center gap-3 border-b border-slate-200 bg-white px-4 md:px-6">
          <button
            type="button"
            className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 md:hidden"
            onClick={() => setOpen(true)}
          >
            <Menu className="h-5 w-5" />
          </button>
          <Link
            to="/"
            className="hidden items-center gap-1 text-xs text-slate-400 hover:text-navy sm:flex"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
            Site public
          </Link>
          <div className="ml-auto flex items-center gap-2 md:hidden">
            <span className="text-xs text-slate-500">
              {user.first_name}
            </span>
            <button
              type="button"
              onClick={() => logout()}
              className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </header>

        {/* Mobile drawer */}
        {open && (
          <div className="fixed inset-0 z-50 md:hidden">
            <div
              className="absolute inset-0 bg-black/40"
              onClick={() => setOpen(false)}
            />
            <div className="absolute left-0 top-0 flex h-full w-64 flex-col bg-navy text-white shadow-xl">
              <div className="flex h-14 items-center justify-between px-4">
                <span className="font-semibold">Admin Polos</span>
                <button type="button" onClick={() => setOpen(false)}>
                  <X className="h-5 w-5" />
                </button>
              </div>
              <nav className="flex-1 space-y-1 p-3">
                {links.map((l) => (
                  <NavLink
                    key={l.to}
                    to={l.to}
                    end={l.end}
                    onClick={() => setOpen(false)}
                    className={({ isActive }) =>
                      cn(
                        'flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-medium',
                        isActive ? 'bg-white/15' : 'text-white/70'
                      )
                    }
                  >
                    <l.icon className="h-4 w-4" />
                    {l.label}
                  </NavLink>
                ))}
              </nav>
            </div>
          </div>
        )}

        <main className="flex-1 overflow-auto p-4 sm:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
