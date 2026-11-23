import { useCallback, useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import {
  Loader2,
  Search,
  Download,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
} from 'lucide-react'
import {
  fetchCommandes,
  exportCommandes,
  formatPrice,
  formatDate,
} from '@/lib/api'
import type { CommandeListe, CommandeFilters } from '@/types'
import { STATUT_LABELS, MOYEN_LABELS } from '@/types'
import { cn } from '@/lib/utils'

const statusColors: Record<string, string> = {
  EN_ATTENTE: 'bg-amber-100 text-amber-800',
  A_CORRIGER: 'bg-orange-100 text-orange-800',
  VALIDEE: 'bg-emerald-100 text-emerald-800',
  POLO_DISPONIBLE: 'bg-blue-100 text-blue-800',
  REMIS: 'bg-slate-100 text-slate-600',
  REFUSEE: 'bg-red-100 text-red-700',
  CLOTUREE: 'bg-slate-100 text-slate-500',
}

export default function OrdersPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [orders, setOrders] = useState<CommandeListe[]>([])
  const [count, setCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [exporting, setExporting] = useState(false)

  const page = Number(searchParams.get('page') || 1)
  const search = searchParams.get('search') || ''
  const statut = searchParams.get('statut') || ''

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const filters: CommandeFilters = {
        page,
        ordering: 'date_creation',
      }
      if (search) filters.search = search
      if (statut) filters.statut = statut
      const data = await fetchCommandes(filters)
      setOrders(data.results)
      setCount(data.count)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur de chargement')
    } finally {
      setLoading(false)
    }
  }, [page, search, statut])

  useEffect(() => {
    load()
  }, [load])

  const setFilter = (key: string, value: string) => {
    const next = new URLSearchParams(searchParams)
    if (value) next.set(key, value)
    else next.delete(key)
    if (key !== 'page') next.delete('page')
    setSearchParams(next)
  }

  const totalPages = Math.max(1, Math.ceil(count / 20))

  const handleExport = async () => {
    setExporting(true)
    try {
      const filters: CommandeFilters = {}
      if (search) filters.search = search
      if (statut) filters.statut = statut
      const blob = await exportCommandes(filters)
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `commandes-polos-${new Date().toISOString().slice(0, 10)}.csv`
      a.click()
      URL.revokeObjectURL(url)
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Export échoué')
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-navy">Commandes</h1>
          <p className="text-sm text-slate-500">
            {count} commande{count > 1 ? 's' : ''}
          </p>
        </div>
        <button
          type="button"
          onClick={handleExport}
          disabled={exporting}
          className="btn-secondary !py-2 !text-xs"
        >
          {exporting ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Download className="h-3.5 w-3.5" />
          )}
          Export CSV
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <div className="relative min-w-[200px] flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            className="input-field !pl-9"
            placeholder="Nom, email, code, numéro…"
            defaultValue={search}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                setFilter('search', (e.target as HTMLInputElement).value)
              }
            }}
          />
        </div>
        <select
          className="input-field max-w-[180px]"
          value={statut}
          onChange={(e) => setFilter('statut', e.target.value)}
        >
          <option value="">Tous les statuts</option>
          {Object.entries(STATUT_LABELS).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
          <AlertCircle className="h-4 w-4" />
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-accent" />
        </div>
      ) : orders.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-200 py-16 text-center text-sm text-slate-400">
          Aucune commande trouvée
        </div>
      ) : (
        <div className="card overflow-hidden !p-0">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-3 font-medium">Code</th>
                  <th className="px-4 py-3 font-medium">Acheteur</th>
                  <th className="px-4 py-3 font-medium">Polos</th>
                  <th className="px-4 py-3 font-medium text-right">Montant</th>
                  <th className="px-4 py-3 font-medium">Paiement</th>
                  <th className="px-4 py-3 font-medium">Statut</th>
                  <th className="px-4 py-3 font-medium">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {orders.map((o) => (
                  <tr key={o.id} className="hover:bg-brand-50/40">
                    <td className="px-4 py-3">
                      <Link
                        to={`/admin/commandes/${o.id}`}
                        className="font-mono text-xs font-semibold text-accent hover:underline"
                      >
                        {o.code_suivi}
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        to={`/admin/commandes/${o.id}`}
                        className="font-medium text-navy hover:underline"
                      >
                        {o.nom} {o.prenoms}
                      </Link>
                      <p className="text-xs text-slate-400">{o.email}</p>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs text-slate-600">
                        {o.nombre_polos} polo{o.nombre_polos > 1 ? 's' : ''}
                      </span>
                      <p className="max-w-[160px] truncate text-[11px] text-slate-400">
                        {o.resume_polos?.join(', ')}
                      </p>
                    </td>
                    <td className="px-4 py-3 text-right font-medium">
                      {formatPrice(o.montant_total)}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-600">
                      {MOYEN_LABELS[o.moyen_paiement] || o.moyen_paiement}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={cn(
                          'rounded-full px-2 py-0.5 text-[11px] font-medium',
                          statusColors[o.statut] || 'bg-slate-100'
                        )}
                      >
                        {STATUT_LABELS[o.statut] || o.statut}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-500">
                      {formatDate(o.date_creation)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between border-t border-slate-100 px-4 py-3">
              <p className="text-xs text-slate-500">
                Page {page} / {totalPages}
              </p>
              <div className="flex gap-1">
                <button
                  type="button"
                  disabled={page <= 1}
                  onClick={() => setFilter('page', String(page - 1))}
                  className="btn-ghost !px-2 !py-1.5 disabled:opacity-40"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  disabled={page >= totalPages}
                  onClick={() => setFilter('page', String(page + 1))}
                  className="btn-ghost !px-2 !py-1.5 disabled:opacity-40"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
