import { useCallback, useEffect, useState } from 'react'
import { fetchDashboard, formatPrice } from '@/lib/api'
import type { TableauDeBord } from '@/types'
import OrdersSection from '@/components/admin/OrdersSection'
import NumerosSection from '@/components/admin/NumerosSection'
import { useAutoRefresh } from '@/hooks/useAutoRefresh'

/** Les 8 modèles possibles, dans l'ordre d'affichage. */
const MODELES = [
  { modele: 'LICENCE', version: 'SIMPLE', manches: 'COURTES', label: 'Licence simple · manches courtes' },
  { modele: 'LICENCE', version: 'SIMPLE', manches: 'LONGUES', label: 'Licence simple · manches longues' },
  { modele: 'LICENCE', version: 'BRODE', manches: 'COURTES', label: 'Licence brodé · manches courtes' },
  { modele: 'LICENCE', version: 'BRODE', manches: 'LONGUES', label: 'Licence brodé · manches longues' },
  { modele: 'MASTER', version: 'SIMPLE', manches: 'COURTES', label: 'Master simple · manches courtes' },
  { modele: 'MASTER', version: 'SIMPLE', manches: 'LONGUES', label: 'Master simple · manches longues' },
  { modele: 'MASTER', version: 'BRODE', manches: 'COURTES', label: 'Master brodé · manches courtes' },
  { modele: 'MASTER', version: 'BRODE', manches: 'LONGUES', label: 'Master brodé · manches longues' },
]

export default function DashboardPage() {
  const [data, setData] = useState<TableauDeBord | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(() => {
    return fetchDashboard()
      .then((d) => {
        setData(d)
        setError(null)
      })
      .catch((e: Error) => setError(e.message))
  }, [])

  useEffect(() => {
    load()
  }, [load])

  // Actualisation automatique des chiffres
  useAutoRefresh(load)

  const c =data?.compteurs ?? {}
  const total = Object.values(c).reduce((a, b) => a + b, 0)
  const remis = data?.stocks.reduce((s, x) => s + x.remis, 0) ?? 0

  // Polos commandés par modèle (toutes tailles confondues, hors commandes refusées)
  const parModele = MODELES.map((m) => ({
    ...m,
    n:
      data?.stocks
        .filter((s) => s.modele === m.modele && s.version === m.version && s.manches === m.manches)
        .reduce((a, s) => a + s.demande, 0) ?? 0,
  }))

  const stats = [
    { label: 'Montant encaissé', value: data ? formatPrice(data.montant_encaisse) : '—' },
    { label: 'En attente', value: data ? formatPrice(data.montant_en_attente) : '—', sub: `${c.EN_ATTENTE ?? 0} commande(s)` },
    { label: 'Commandes', value: data ? String(total) : '—' },
    { label: 'Polos remis', value: data ? String(remis) : '—' },
  ]

  return (
    <div className="space-y-14">
      <div>
        <h1 className="font-display text-3xl font-extrabold tracking-tight text-navy">Tableau de bord</h1>
        {error && <p className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}

        <div className="mt-8 overflow-hidden rounded-2xl border border-slate-200">
          <dl className="grid grid-cols-2 gap-px bg-slate-200 lg:grid-cols-4">
            {stats.map((s) => (
              <div key={s.label} className="bg-white px-5 py-5">
                <dt className="text-sm text-slate-500">{s.label}</dt>
                <dd className="mt-1 font-display text-2xl font-bold text-navy">{s.value}</dd>
                {s.sub && <dd className="text-xs text-slate-400">{s.sub}</dd>}
              </div>
            ))}
          </dl>

          <p className="border-t border-slate-200 bg-slate-50 px-5 py-2.5 text-xs font-medium text-slate-500">
            Polos commandés par modèle
          </p>
          <dl className="grid grid-cols-2 gap-px border-t border-slate-200 bg-slate-200 sm:grid-cols-4">
            {parModele.map((m) => (
              <div key={m.label} className="bg-white px-5 py-4">
                <dt className="text-sm text-slate-500">{m.label}</dt>
                <dd
                  className={
                    m.n > 0
                      ? 'mt-1 font-display text-xl font-bold text-navy'
                      : 'mt-1 font-display text-xl font-bold text-slate-300'
                  }
                >
                  {data ? m.n : '—'}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </div>

      <OrdersSection counters={c} onChanged={load} />

      <NumerosSection />
    </div>
  )
}
