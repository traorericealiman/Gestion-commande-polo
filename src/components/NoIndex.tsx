import { useEffect } from 'react'

/** Demande aux moteurs de recherche de ne pas indexer la page (espace admin). */
export default function NoIndex() {
  useEffect(() => {
    const meta = document.createElement('meta')
    meta.name = 'robots'
    meta.content = 'noindex, nofollow'
    document.head.appendChild(meta)
    return () => meta.remove()
  }, [])
  return null
}
