import { Outlet, Link, NavLink, useLocation } from 'react-router-dom'
import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'
import Logo from './Logo'
import { useScrollMemory } from '@/hooks/useScrollMemory'

const nav = [
  { to: '/', label: 'Accueil' },
  { to: '/commander', label: 'Commander' },
  { to: '/suivi', label: 'Suivre ma commande' },
]

export default function Layout() {
  const [scrolled, setScrolled] = useState(false)
  const { pathname } = useLocation()

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  // En changeant de page on remonte en haut ; au rechargement on garde la position
  useScrollMemory()
  const firstRender = useRef(true)
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false
      return
    }
    window.scrollTo({ top: 0 })
  }, [pathname])

  return (
    <div className="flex min-h-screen flex-col bg-white">
      <header
        className={cn(
          'fixed inset-x-0 top-0 z-50 bg-white/90 backdrop-blur-lg transition-shadow',
          scrolled ? 'shadow-[0_1px_0_rgba(0,34,74,0.08)]' : ''
        )}
      >
        <div className="mx-auto flex h-[72px] max-w-[1440px] items-center justify-between gap-3 px-4 sm:px-8 lg:px-12">
          <Link to="/" aria-label="Accueil" className="shrink-0">
            <Logo className="h-11 sm:h-14" />
          </Link>
          <nav className="flex items-center sm:gap-2">
            {nav.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end
                className={({ isActive }) =>
                  cn(
                    'whitespace-nowrap rounded-lg px-2 py-2 text-[13px] font-semibold transition sm:px-3 sm:text-sm',
                    isActive ? 'text-navy' : 'text-slate-500 hover:text-navy'
                  )
                }
              >
                {({ isActive }) => (
                  <span className="relative">
                    {item.label}
                    {isActive && (
                      <motion.span
                        layoutId="nav-underline"
                        className="absolute -bottom-1.5 left-0 right-0 h-0.5 rounded-full bg-brand-500"
                      />
                    )}
                  </span>
                )}
              </NavLink>
            ))}
          </nav>
        </div>
      </header>

      <main className="flex-1 pt-[72px]">
        <Outlet />
      </main>

      <footer className="border-t border-slate-100">
        <div className="mx-auto max-w-[1440px] px-5 py-8 text-center text-sm text-slate-500 sm:px-8 lg:px-12">
          <p>© {new Date().getFullYear()} Association Estudiantine de l’ESATIC</p>
        </div>
      </footer>
    </div>
  )
}
