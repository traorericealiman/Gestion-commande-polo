import { Outlet, Link, NavLink, useLocation } from 'react-router-dom'
import { ShoppingBag, Search } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { cn } from '@/lib/utils'
import Logo from './Logo'
import { useScrollMemory } from '@/hooks/useScrollMemory'

const nav = [
  { to: '/', label: 'Accueil' },
  { to: '/commander', label: 'Commander' },
  { to: '/suivi', label: 'Suivi' },
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

  // Les boutons flottants disparaissent quand le pied de page est visible
  const footerRef = useRef<HTMLElement>(null)
  const [footerVisible, setFooterVisible] = useState(false)
  useEffect(() => {
    const el = footerRef.current
    if (!el) return
    const obs = new IntersectionObserver(([e]) => setFooterVisible(e.isIntersecting), {
      threshold: 0,
    })
    obs.observe(el)
    return () => obs.disconnect()
  }, [])

  const showOrder = pathname !== '/commander' && !footerVisible
  const showTrack = pathname !== '/suivi' && !footerVisible

  return (
    <div className="flex min-h-screen flex-col bg-white">
      <header
        className={cn(
          'fixed inset-x-0 top-0 z-50 bg-white/90 backdrop-blur-lg transition-shadow',
          scrolled ? 'shadow-[0_1px_0_rgba(0,34,74,0.08)]' : ''
        )}
      >
        <div className="mx-auto flex h-[72px] max-w-[1440px] items-center justify-between px-5 sm:px-8 lg:px-12">
          <Link to="/" aria-label="Accueil">
            <Logo className="h-14" />
          </Link>
          <nav className="flex items-center gap-1 sm:gap-2">
            {nav.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end
                className={({ isActive }) =>
                  cn(
                    'rounded-lg px-3 py-2 text-sm font-semibold transition',
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

      <footer ref={footerRef} className="border-t border-slate-100">
        <div className="mx-auto max-w-[1440px] px-5 py-8 text-center text-sm text-slate-500 sm:px-8 lg:px-12">
          <p>© {new Date().getFullYear()} Association Estudiantine de l’ESATIC</p>
        </div>
      </footer>

      {/* Boutons flottants */}
      <AnimatePresence>
        {showOrder && (
          <motion.div
            key="fab-order"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="fixed bottom-5 left-5 z-40 sm:bottom-6 sm:left-6"
          >
            <Link
              to="/commander"
              className="inline-flex items-center gap-2 rounded-full bg-navy px-5 py-3.5 text-sm font-semibold text-white shadow-[0_10px_30px_-8px_rgba(0,34,74,0.5)] transition hover:-translate-y-0.5 hover:bg-navy-light"
            >
              <ShoppingBag className="h-4 w-4" />
              Passer une commande
            </Link>
          </motion.div>
        )}
        {showTrack && (
          <motion.div
            key="fab-track"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="fixed bottom-5 right-5 z-40 sm:bottom-6 sm:right-6"
          >
            <Link
              to="/suivi"
              className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-5 py-3.5 text-sm font-semibold text-navy shadow-[0_10px_30px_-10px_rgba(0,34,74,0.35)] transition hover:-translate-y-0.5 hover:border-brand-300"
            >
              <Search className="h-4 w-4" />
              Suivre ma commande
            </Link>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
