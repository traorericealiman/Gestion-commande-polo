import { Outlet, Link, useLocation } from 'react-router-dom'
import { ShoppingBag, Search, Menu, X } from 'lucide-react'
import { useState } from 'react'
import { cn } from '@/lib/utils'

export default function Layout() {
  const [open, setOpen] = useState(false)
  const { pathname } = useLocation()

  const nav = [
    { to: '/', label: 'Accueil' },
    { to: '/commander', label: 'Commander' },
    { to: '/suivi', label: 'Suivre ma commande' },
  ]

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-50 border-b border-slate-100/80 bg-white/90 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <Link to="/" className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-xl shadow-sm">
  <img
    src="/A2E.png"
    alt="Logo Association Étudiante ESATIC"
    className="h-full w-full object-contain"
  />
</div>
            <div className="leading-tight">
              <span className="block font-display text-sm font-semibold text-navy sm:text-base">
                Polos ESATIC
              </span>
              <span className="hidden text-[11px] text-slate-500 sm:block">
                Association Étudiante
              </span>
            </div>
          </Link>

          <nav className="hidden items-center gap-1 md:flex">
            {nav.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  'rounded-lg px-3.5 py-2 text-sm font-medium transition',
                  pathname === item.to
                    ? 'bg-accent/10 text-accent'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-navy'
                )}
              >
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            <Link
              to="/commander"
              className="btn-primary hidden !py-2 !text-xs sm:inline-flex"
            >
              <ShoppingBag className="h-3.5 w-3.5" />
              Commander
            </Link>
            <button
              type="button"
              className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 md:hidden"
              onClick={() => setOpen((v) => !v)}
              aria-label="Menu"
            >
              {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>

        {open && (
          <div className="border-t border-slate-100 bg-white px-4 py-3 md:hidden">
            {nav.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                onClick={() => setOpen(false)}
                className={cn(
                  'block rounded-lg px-3 py-2.5 text-sm font-medium',
                  pathname === item.to ? 'bg-accent/10 text-accent' : 'text-slate-700'
                )}
              >
                {item.label}
              </Link>
            ))}
            <Link
              to="/commander"
              onClick={() => setOpen(false)}
              className="btn-primary mt-2 w-full !py-2.5"
            >
              <ShoppingBag className="h-4 w-4" />
              Passer commande
            </Link>
          </div>
        )}
      </header>

      <main className="flex-1">
        <Outlet />
      </main>

      <footer className="border-t border-slate-100 bg-navy text-white">
        <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="font-display text-lg font-semibold">Polos ESATIC</p>
              <p className="mt-1 max-w-xs text-sm text-white/70">
                Vente officielle des polos de l'Association Étudiante d'ESATIC.
                Paiement vérifié, retrait sur campus.
              </p>
            </div>
            <div className="flex flex-wrap gap-6 text-sm">
              <Link to="/commander" className="text-white/80 hover:text-white">
                Commander
              </Link>
              <Link to="/suivi" className="text-white/80 hover:text-white">
                Suivre ma commande
              </Link>
            </div>
          </div>
          <div className="mt-8 flex flex-col gap-2 border-t border-white/10 pt-6 text-xs text-white/50 sm:flex-row sm:justify-between">
            <span>© {new Date().getFullYear()} Association Étudiante ESATIC</span>
            <span className="flex items-center gap-1.5">
              <Search className="h-3 w-3" />
              Paiement manuel · Vérification humaine
            </span>
          </div>
        </div>
      </footer>
    </div>
  )
}
