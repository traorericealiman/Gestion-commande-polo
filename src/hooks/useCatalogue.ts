import { useEffect, useState } from 'react'
import { fetchCatalogue } from '@/lib/api'
import type { Catalogue } from '@/types'

export function useCatalogue() {
  const [data, setData] = useState<Catalogue | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    fetchCatalogue()
      .then((c) => {
        if (!cancelled) {
          setData(c)
          setError(null)
        }
      })
      .catch((e: Error) => {
        if (!cancelled) setError(e.message || 'Impossible de charger le catalogue')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  return { data, loading, error, refetch: () => setLoading(true) }
}
