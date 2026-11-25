import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'

/**
 * Garde la position de défilement au rechargement de la page.
 * Le contenu arrivant après coup (chargement de l'API), on réessaie
 * de revenir à la position tant que la page n'est pas assez haute.
 */
export function useScrollMemory() {
  const { pathname, search } = useLocation()
  const key = `a2e_scroll:${pathname}${search}`

  useEffect(() => {
    if ('scrollRestoration' in history) history.scrollRestoration = 'manual'
  }, [])

  // Enregistre la position
  useEffect(() => {
    let t: number | undefined
    const save = () => {
      window.clearTimeout(t)
      t = window.setTimeout(() => {
        try {
          sessionStorage.setItem(key, String(window.scrollY))
        } catch {
          /* ignore */
        }
      }, 120)
    }
    window.addEventListener('scroll', save, { passive: true })
    return () => {
      window.removeEventListener('scroll', save)
      window.clearTimeout(t)
    }
  }, [key])

  // Restaure la position au chargement
  useEffect(() => {
    let saved = 0
    try {
      saved = Number(sessionStorage.getItem(key) || 0)
    } catch {
      /* ignore */
    }
    if (!saved) return

    let stopped = false
    const stop = () => {
      stopped = true
    }
    // Si la personne défile elle-même, on arrête
    window.addEventListener('wheel', stop, { passive: true, once: true })
    window.addEventListener('touchstart', stop, { passive: true, once: true })
    window.addEventListener('keydown', stop, { once: true })

    const started = Date.now()
    const tryRestore = () => {
      if (stopped) return
      const max = document.documentElement.scrollHeight - window.innerHeight
      if (max >= saved) {
        window.scrollTo({ top: saved, behavior: 'instant' as ScrollBehavior })
        return
      }
      if (Date.now() - started < 4000) requestAnimationFrame(tryRestore)
      else window.scrollTo({ top: max, behavior: 'instant' as ScrollBehavior })
    }
    requestAnimationFrame(tryRestore)

    return () => {
      stopped = true
      window.removeEventListener('wheel', stop)
      window.removeEventListener('touchstart', stop)
      window.removeEventListener('keydown', stop)
    }
    // Seulement à l'arrivée sur la page
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname])
}
