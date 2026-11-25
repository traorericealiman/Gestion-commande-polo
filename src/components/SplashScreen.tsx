import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'

const DUREE = 2000
const KEY = 'a2e_splash_vu'

/**
 * Écran de chargement avec le logo A2E.
 * Affiché à la première arrivée sur le site seulement : ni au rechargement, ni dans l'admin.
 */
function doitAfficher(): boolean {
  if (window.location.pathname.startsWith('/admin')) return false
  try {
    return sessionStorage.getItem(KEY) !== '1'
  } catch {
    return false
  }
}

export default function SplashScreen() {
  const [visible, setVisible] = useState(doitAfficher)

  useEffect(() => {
    if (!visible) return
    try {
      sessionStorage.setItem(KEY, '1')
    } catch {
      /* ignore */
    }
    document.body.style.overflow = 'hidden'
    const t = setTimeout(() => setVisible(false), DUREE)
    return () => {
      clearTimeout(t)
      document.body.style.overflow = ''
    }
  }, [visible])

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          key="splash"
          className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-white"
          exit={{ opacity: 0 }}
          transition={{ duration: 0.5, ease: 'easeInOut' }}
        >
          <motion.img
            src="/A2E.png"
            alt="A2E"
            className="w-40 sm:w-48"
            initial={{ opacity: 0, scale: 0.92 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ scale: 1.04 }}
            transition={{ duration: 0.7, ease: 'easeOut' }}
          />
        </motion.div>
      )}
    </AnimatePresence>
  )
}
