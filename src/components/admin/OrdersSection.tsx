import { useCallback, useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Loader2, Search, X, ChevronLeft, ChevronRight } from 'lucide-react'
import {
  fetchCommandes,
  exportCommandes,
  formatPrice,
  formatDate,
  type CommandeFilters,
} from '@/lib/api'
import type { CommandeListe } from '@/types'
import { STATUT_LABELS } from '@/types'
import { MOYEN_LABELS } from '@/types'
import { cn } from '@/lib/utils'
import StatusBadge from './StatusBadge'
import OperatorLogo from '@/components/OperatorLogo'
import OrderDetail from './OrderDetail'
import { useSearchParams } from 'react-router-dom'
import { useAutoRefresh } from '@/hooks/useAutoRefresh'

const PAR_PAGE = 10
const FILTRES = ['', 'EN_ATTENTE', 'VALIDEE', 'POLO_DISPONIBLE', 'REMIS', 'REFUSEE'] as const

interface Props {
  counters: Record<string, number>
  onChanged: () => void
}

export default function OrdersSection({ counters, onChanged }: Props) {
  // Filtres, page et commande ouverte sont dans l'URL : ils restent au rechargement
  const [params, setParams] = useSearchParams()
  const page = Math.max(1, Number(params.get('page') || 1))
  const statut = params.get('statut') || ''
  const search = params.get('q') || ''
  const selectedParam = params.get('commande')
  const selected = selectedParam ? Number(selectedParam) : null

  const update = useCallback(
    (changes: Record<string, string | null>) => {
      setParams(
        (prev) => {
          const next = new URLSearchParams(prev)
          Object.entries(changes).forEach(([k, v]) => (v ? next.set(k, v) : next.delete(k)))
          return next
        },
        { replace: true }
      )
    },
    [setParams]
  )
  const setPage = (p: number | ((p: number) => number)) => {
    const n = typeof p === 'function' ? p(page) : p
    update({ page: n > 1 ? String(n) : null })
  }
  const setStatut = (s: string) => update({ statut: s || null, page: null })
  const setSelected = (id: number | null) => update({ commande: id === null ? null : String(id) })

  const [orders, setOrders] = useState<CommandeListe[]>([])
  const [count, setCount] = useState(0)
  const [query, setQuery] = useState(search)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [exporting, setExporting] = useState(false)
  // Taille des pages renvoyées par l'API (détectée), pour découper en pages de 10
  const apiSize = useRef(20)

  useEffect(() => {
    if (query.trim() === search) return
    const t = setTimeout(() => update({ q: query.trim() || null, page: null }), 350)
    return () => clearTimeout(t)
  }, [query, search, update])

  /** silent = actualisation en arrière-plan, sans afficher le chargement */
  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    setError(null)
    try {
      const base: CommandeFilters = { ordering: '-date_creation' }
      if (search) base.search = search
      if (statut) base.statut = statut

      const fetchSlice = async () => {
        const start = (page - 1) * PAR_PAGE
        const apiPage = Math.floor(start / apiSize.current) + 1
        const offset = start % apiSize.current
        const data = await fetchCommandes({ ...base, page: apiPage })
        return { data, offset }
      }

      let { data, offset } = await fetchSlice()
      // Ajuste la taille de page si l'API en utilise une autre
      if (data.next && data.results.length !== apiSize.current && data.results.length > 0) {
        apiSize.current = data.results.length
        ;({ data, offset } = await fetchSlice())
      }
      let rows = data.results.slice(offset, offset + PAR_PAGE)
      // Une page de 10 peut chevaucher deux pages de l'API
      if (rows.length < PAR_PAGE && data.next && offset + PAR_PAGE > data.results.length) {
        const nextPage = Math.floor(((page - 1) * PAR_PAGE) / apiSize.current) + 2
        const more = await fetchCommandes({ ...base, page: nextPage })
        rows = rows.concat(more.results.slice(0, PAR_PAGE - rows.length))
      }
      setOrders(rows)
      setCount(data.count)
    } catch (e) {
      if (!silent) setError(e instanceof Error ? e.message : 'Chargement impossible')
    } finally {
      setLoading(false)
    }
  }, [page, search, statut])

  useEffect(() => {
    load()
  }, [load])

  // Actualisation automatique de la liste
  useAutoRefresh(() => load(true))

  useEffect(() => {
    if (selected === null) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setSelected(null)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [selected])

  const pages = Math.max(1, Math.ceil(count / PAR_PAGE))
  const total = Object.values(counters).reduce((a, b) => a + b, 0)

  const handleExport = async () => {
    setExporting(true)
    try {
      const f: CommandeFilters = {}
      if (search) f.search = search
      if (statut) f.statut = statut
      const blob = await exportCommandes(f)
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `commandes-polos-${new Date().toISOString().slice(0, 10)}.csv`
      a.click()
      URL.revokeObjectURL(url)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Export impossible')
    } finally {
      setExporting(false)
    }
  }

  return (
    <section>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <h2 className="font-display text-xl font-bold text-navy">Commandes</h2>
        <button
          type="button"
          onClick={handleExport}
          disabled={exporting}
          className="text-sm font-semibold text-navy hover:underline disabled:opacity-50"
        >
          {exporting ? 'Export…' : 'Exporter en CSV'}
        </button>
      </div>

      {/* Filtres */}
      <div className="mt-5 flex flex-wrap items-center justify-between gap-4 border-b border-slate-200">
        <div className="thin-scroll -mb-px flex gap-5 overflow-x-auto">
          {FILTRES.map((s) => {
            const n = s ? counters[s] ?? 0 : total
            const active = statut === s
            return (
              <button
                key={s || 'all'}
                type="button"
                onClick={() => setStatut(s)}
                className={cn(
                  'shrink-0 border-b-2 pb-3 text-sm font-semibold transition',
                  active ? 'border-navy text-navy' : 'border-transparent text-slate-400 hover:text-slate-600'
                )}
              >
                {s ? STATUT_LABELS[s] : 'Toutes'}
                <span className="ml-1.5 font-normal text-slate-400">{n}</span>
              </button>
            )
          })}
        </div>
      </div>

      <div className="relative mt-4">
        <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          className="input-field !pl-11"
          placeholder="Rechercher par nom, email, code ou numéro"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        {query && (
          <button
            type="button"
            onClick={() => setQuery('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-navy"
            aria-label="Effacer"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {error && <p className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}

      <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200">
        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
          </div>
        ) : orders.length === 0 ? (
          <p className="py-16 text-center text-sm text-slate-400">Aucune commande.</p>
        ) : (
          <>
            <table className="hidden w-full text-left text-sm md:table">
              <thead className="border-b border-slate-200 text-xs text-slate-500">
                <tr>
                  <th className="px-5 py-3 font-medium">Acheteur</th>
                  <th className="px-5 py-3 font-medium">Polos</th>
                  <th className="px-5 py-3 font-medium">Paiement</th>
                  <th className="px-5 py-3 text-right font-medium">Montant</th>
                  <th className="px-5 py-3 font-medium">Statut</th>
                  <th className="px-5 py-3 font-medium">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {orders.map((o) => (
                  <tr
                    key={o.id}
                    onClick={() => setSelected(o.id)}
                    className={cn(
                      'cursor-pointer transition hover:bg-slate-50',
                      selected === o.id && 'bg-slate-50'
                    )}
                  >
                    <td className="px-5 py-3.5">
                      <p className="font-semibold text-navy">
                        {o.nom} {o.prenoms}
                      </p>
                      <p className="font-mono text-xs text-slate-400">{o.code_suivi}</p>
                    </td>
                    <td className="px-5 py-3.5 text-slate-600">
                      {o.nombre_polos}
                      <span className="ml-1.5 text-xs text-slate-400">{o.resume_polos?.join(', ')}</span>
                    </td>
                    <td className="px-5 py-3.5 text-slate-600">
                      <span className="inline-flex items-center gap-2">
                        <OperatorLogo moyen={o.moyen_paiement} className="h-6 w-6 rounded-md" />
                        {MOYEN_LABELS[o.moyen_paiement] ?? o.moyen_paiement}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-right font-semibold text-navy">
                      {formatPrice(o.montant_total)}
                    </td>
                    <td className="px-5 py-3.5">
                      <StatusBadge statut={o.statut} />
                    </td>
                    <td className="px-5 py-3.5 text-slate-500">{formatDate(o.date_creation)}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <ul className="divide-y divide-slate-100 md:hidden">
              {orders.map((o) => (
                <li key={o.id}>
                  <button
                    type="button"
                    onClick={() => setSelected(o.id)}
                    className="w-full px-4 py-4 text-left active:bg-slate-50"
                  >
                    <div className="flex justify-between gap-3">
                      <p className="font-semibold text-navy">
                        {o.nom} {o.prenoms}
                      </p>
                      <p className="font-semibold text-navy">{formatPrice(o.montant_total)}</p>
                    </div>
                    <div className="mt-1 flex justify-between gap-3">
                      <span className="font-mono text-xs text-slate-400">{o.code_suivi}</span>
                      <StatusBadge statut={o.statut} />
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>

      {/* Pagination */}
      {pages > 1 && (
        <div className="mt-4 flex items-center justify-between gap-4 text-sm">
          <p className="text-slate-500">
            {(page - 1) * PAR_PAGE + 1}–{Math.min(page * PAR_PAGE, count)} sur {count}
          </p>
          <div className="flex items-center gap-1">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
              className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 disabled:opacity-30"
              aria-label="Page précédente"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            {pageList(page, pages).map((p, i) =>
              p === '…' ? (
                <span key={`e${i}`} className="px-2 text-slate-400">
                  …
                </span>
              ) : (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPage(p)}
                  className={cn(
                    'h-9 min-w-9 rounded-lg px-2 font-semibold',
                    p === page ? 'bg-navy text-white' : 'text-slate-600 hover:bg-slate-100'
                  )}
                >
                  {p}
                </button>
              )
            )}
            <button
              type="button"
              disabled={page >= pages}
              onClick={() => setPage((p) => p + 1)}
              className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 disabled:opacity-30"
              aria-label="Page suivante"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* Détail */}
      <AnimatePresence>
        {selected !== null && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[60] bg-navy-dark/30"
              onClick={() => setSelected(null)}
            />
            <motion.aside
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', stiffness: 320, damping: 34 }}
              className="fixed inset-y-0 right-0 z-[70] flex w-full max-w-xl flex-col bg-white shadow-2xl"
            >
              <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
                <p className="font-display font-bold text-navy">Détail de la commande</p>
                <button
                  type="button"
                  onClick={() => setSelected(null)}
                  className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-navy"
                  aria-label="Fermer"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <div className="thin-scroll flex-1 overflow-y-auto px-6 py-6">
                <OrderDetail
                  key={selected}
                  id={selected}
                  onChanged={() => {
                    load(true)
                    onChanged()
                  }}
                />
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </section>
  )
}

/** 1 … 4 5 6 … 12 */
function pageList(current: number, total: number): (number | '…')[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1)
  const out: (number | '…')[] = [1]
  const start = Math.max(2, current - 1)
  const end = Math.min(total - 1, current + 1)
  if (start > 2) out.push('…')
  for (let i = start; i <= end; i++) out.push(i)
  if (end < total - 1) out.push('…')
  out.push(total)
  return out
}
