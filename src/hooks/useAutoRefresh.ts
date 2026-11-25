import { useEffect, useRef } from 'react'

/**
 * Relance `fn` toutes les `ms` millisecondes tant que l'onglet est visible,
 * et immédiatement quand on revient sur l'onglet.
 * Si l'actualisation précédente n'est pas finie, on attend (pas d'empilement de requêtes).
 */
export function useAutoRefresh(fn: () => unknown, ms = 1000) {
  const ref = useRef(fn)
  ref.current = fn

  useEffect(() => {
    let running = false
    const run = async () => {
      if (running || document.visibilityState !== 'visible') return
      running = true
      try {
        await ref.current()
      } finally {
        running = false
      }
    }
    const id = window.setInterval(run, ms)
    document.addEventListener('visibilitychange', run)
    window.addEventListener('focus', run)
    return () => {
      window.clearInterval(id)
      document.removeEventListener('visibilitychange', run)
      window.removeEventListener('focus', run)
    }
  }, [ms])
}
