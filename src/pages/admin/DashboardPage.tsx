import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Loader2, AlertCircle, ArrowRight } from 'lucide-react'
import { fetchDashboard, formatPrice } from '@/lib/api'
import type { TableauDeBord } from '@/types'
import { STATUT_LABELS } from '@/types'
import { cn } from '@/lib/utils'

const statusOrder = [
  'EN_ATTENTE',
  'A_CORRIGER',
  'VALIDEE',
  'POLO_DISPONIBLE',
  'REMIS',
  'REFUSEE',
  'CLOTUREE',
]

const statusColors: Record<string, string> = {
  EN_ATTENTE: 'bg-amber-50 border-amber-200 text-amber-800',
  A_CORRIGER: 'bg-orange-50 border-orange-200 text-orange-800',
  VALIDEE: 'bg-emerald-50 border-emerald-200 text-emerald-800',
  POLO_DISPONIBLE: 'bg-blue-50 border-blue-200 text-blue-800',
  REMIS: 'bg-slate-50 border-slate-200 text-slate-700',
  REFUSEE: 'bg-red-50 border-red-200 text-red-700',
  CLOTUREE: 'bg-slate-50 border-slate-100 text-slate-500',
}

export default function DashboardPage() {
  const [data, setData] = useState<TableauDeBord | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchDashboard()
      .then(setData)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-accent" />
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="rounded-xl border border-red-100 bg-red-50 p-4 text-sm text-red-700">
        <AlertCircle className="mb-1 inline h-4 w-4" /> {error || 'Erreur'}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-navy">
            Tableau de bord
          </h1>
          <p className="text-sm text-slate-500">Vue d’ensemble des commandes</p>
        </div>
        <Link to="/admin/commandes" className="btn-primary !py-2 !text-xs">
          Voir les commandes
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>

      {/* Counters */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7">
        {statusOrder.map((s) => {
          const count = data.compteurs[s] ?? 0
          return (
            <Link
              key={s}
              to={`/admin/commandes?statut=${s}`}
              className={cn(
                'rounded-xl border p-4 transition hover:shadow-soft',
                statusColors[s]
              )}
            >
              <p className="text-2xl font-bold">{count}</p>
              <p className="mt-0.5 text-xs font-medium opacity-80">
                {STATUT_LABELS[s as keyof typeof STATUT_LABELS] || s}
              </p>
            </Link>
          )
        })}
      </div>

      {/* Money */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="card">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
            Montant encaissé
          </p>
          <p className="mt-1 font-display text-2xl font-bold text-emerald-700">
            {formatPrice(data.montant_encaisse)}
          </p>
          <p className="mt-1 text-xs text-slate-400">
            Validées + disponibles + remises
          </p>
        </div>
        <div className="card">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
            En attente de vérification
          </p>
          <p className="mt-1 font-display text-2xl font-bold text-amber-700">
            {formatPrice(data.montant_en_attente)}
          </p>
        </div>
      </div>

      {/* Stocks */}
      {data.stocks.length > 0 && (
        <div className="card overflow-hidden !p-0">
          <div className="border-b border-slate-100 px-5 py-4">
            <h2 className="font-semibold text-navy">Stocks par variante</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-3 font-medium">Variante</th>
                  <th className="px-4 py-3 font-medium">Taille</th>
                  <th className="px-4 py-3 font-medium text-right">Demandé</th>
                  <th className="px-4 py-3 font-medium text-right">Validé</th>
                  <th className="px-4 py-3 font-medium text-right">Remis</th>
                  <th className="px-4 py-3 font-medium text-right">Restant</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.stocks.map((s, i) => (
                  <tr key={i} className="hover:bg-slate-50/50">
                    <td className="px-4 py-2.5">
                      {s.modele} · {s.version} · {s.manches}
                    </td>
                    <td className="px-4 py-2.5 font-medium">{s.taille}</td>
                    <td className="px-4 py-2.5 text-right">{s.demande}</td>
                    <td className="px-4 py-2.5 text-right">{s.valide}</td>
                    <td className="px-4 py-2.5 text-right">{s.remis}</td>
                    <td className="px-4 py-2.5 text-right">
                      {s.restant === null ? (
                        <span className="text-slate-400">∞</span>
                      ) : s.restant === 0 ? (
                        <span className="font-medium text-red-600">0</span>
                      ) : (
                        s.restant
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
