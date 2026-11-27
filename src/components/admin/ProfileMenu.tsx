import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { ChevronDown, KeyRound, LogOut } from 'lucide-react'
import type { User } from '@/types'
import { cn } from '@/lib/utils'

interface Props {
  user: User
  onLogout: () => void
}

/** Bouton profil (initiales + nom + rôle) avec un menu : mot de passe, déconnexion. */
export default function ProfileMenu({ user, onLogout }: Props) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('mousedown', onClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const nom = [user.first_name, user.last_name].filter(Boolean).join(' ') || user.email
  const initiales =
    ((user.first_name?.[0] ?? '') + (user.last_name?.[0] ?? '')).toUpperCase() ||
    user.email[0].toUpperCase()
  const role = user.role === 'ADMIN' ? 'Administrateur' : 'Trésorière'

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        className={cn(
          'flex items-center gap-3 rounded-full border py-1.5 pl-1.5 pr-3 transition',
          open ? 'border-slate-300 bg-slate-50' : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
        )}
      >
        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-navy font-display text-sm font-bold text-white">
          {initiales}
        </span>
        <span className="hidden text-left leading-tight sm:block">
          <span className="block text-sm font-semibold text-navy">{nom}</span>
          <span className="block text-xs text-slate-500">{role}</span>
        </span>
        <ChevronDown className={cn('h-4 w-4 text-slate-400 transition', open && 'rotate-180')} />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            role="menu"
            initial={{ opacity: 0, y: -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.98 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 mt-2 w-64 origin-top-right overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-card"
          >
            <div className="flex items-center gap-3 border-b border-slate-100 px-4 py-4">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-navy font-display text-sm font-bold text-white">
                {initiales}
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-navy">{nom}</p>
                <p className="truncate text-xs text-slate-500">{user.email}</p>
              </div>
            </div>
            <div className="p-2">
              <Link
                to="/admin/mot-de-passe"
                role="menuitem"
                onClick={() => setOpen(false)}
                className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 hover:text-navy"
              >
                <KeyRound className="h-4 w-4 text-slate-400" />
                Changer le mot de passe
              </Link>
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setOpen(false)
                  onLogout()
                }}
                className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-red-600 hover:bg-red-50"
              >
                <LogOut className="h-4 w-4" />
                Se déconnecter
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
