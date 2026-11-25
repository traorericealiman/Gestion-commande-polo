import { useCallback, useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { fetchNumerosDepot, createNumeroDepot, updateNumeroDepot } from '@/lib/api'
import type { NumeroDepotGestion } from '@/types'
import { MOYEN_LABELS } from '@/types'
import { formatPhone } from '@/lib/status'
import { cn } from '@/lib/utils'
import OperatorLogo from '@/components/OperatorLogo'

const MOYENS = ['WAVE', 'ORANGE_MONEY', 'MTN_MONEY', 'MOOV_MONEY'] as const

interface Draft {
  numero: string
  titulaire: string
}

export default function NumerosSection() {
  const [items, setItems] = useState<NumeroDepotGestion[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [editing, setEditing] = useState<number | null>(null)
  const [adding, setAdding] = useState<string | null>(null)
  const [draft, setDraft] = useState<Draft>({ numero: '', titulaire: '' })
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      setItems(await fetchNumerosDepot())
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Chargement impossible')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const cancel = () => {
    setAdding(null)
    setEditing(null)
    setFormError(null)
  }

  const save = async () => {
    if (!draft.numero.trim() || !draft.titulaire.trim()) {
      setFormError('Le numéro et le titulaire sont obligatoires.')
      return
    }
    setSaving(true)
    setFormError(null)
    try {
      if (adding) {
        const created = await createNumeroDepot({
          moyen: adding,
          numero: draft.numero.trim(),
          titulaire: draft.titulaire.trim(),
          actif: true,
        })
        setItems((p) => [...p, created])
      } else if (editing !== null) {
        const updated = await updateNumeroDepot(editing, {
          numero: draft.numero.trim(),
          titulaire: draft.titulaire.trim(),
        })
        setItems((p) => p.map((x) => (x.id === updated.id ? updated : x)))
      }
      cancel()
    } catch (e) {
      setFormError(e instanceof Error ? e.message : 'Enregistrement impossible')
    } finally {
      setSaving(false)
    }
  }

  const toggle = async (n: NumeroDepotGestion) => {
    try {
      const updated = await updateNumeroDepot(n.id, { actif: !n.actif })
      setItems((p) => p.map((x) => (x.id === updated.id ? updated : x)))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Action impossible')
    }
  }

  const form = (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        save()
      }}
      className="mt-3 grid gap-3 sm:grid-cols-[1fr_1.3fr_auto] sm:items-start"
    >
      <input
        autoFocus
        inputMode="tel"
        className="input-field font-mono"
        value={draft.numero}
        onChange={(e) => setDraft({ ...draft, numero: e.target.value })}
        placeholder="07 00 00 00 00"
        maxLength={30}
      />
      <input
        className="input-field"
        value={draft.titulaire}
        onChange={(e) => setDraft({ ...draft, titulaire: e.target.value })}
        placeholder="Nom du titulaire"
        maxLength={100}
      />
      <div className="flex gap-2">
        <button type="submit" disabled={saving} className="btn-dark">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Enregistrer'}
        </button>
        <button type="button" onClick={cancel} className="btn-ghost">
          Annuler
        </button>
      </div>
      {formError && <p className="text-sm text-red-600 sm:col-span-3">{formError}</p>}
    </form>
  )

  return (
    <section>
      <h2 className="font-display text-xl font-bold text-navy">Numéros de paiement</h2>
      <p className="mt-1 text-sm text-slate-500">
        Les numéros actifs sont affichés aux acheteurs selon l’opérateur choisi.
      </p>

      {error && <p className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}

      {loading ? (
        <div className="flex justify-center py-10">
          <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
        </div>
      ) : (
        <div className="mt-5 divide-y divide-slate-100 rounded-2xl border border-slate-200">
          {MOYENS.map((moyen) => {
            const list = items.filter((i) => i.moyen === moyen)
            return (
              <div key={moyen} className="px-5 py-4">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <OperatorLogo moyen={moyen} className="h-9 w-9 rounded-lg" />
                    <p className="font-semibold text-navy">{MOYEN_LABELS[moyen]}</p>
                  </div>
                  {adding !== moyen && (
                    <button
                      type="button"
                      onClick={() => {
                        setEditing(null)
                        setAdding(moyen)
                        setDraft({ numero: '', titulaire: '' })
                        setFormError(null)
                      }}
                      className="text-sm font-semibold text-navy hover:underline"
                    >
                      Ajouter un numéro
                    </button>
                  )}
                </div>

                {list.length === 0 && adding !== moyen && (
                  <p className="mt-1 text-sm text-slate-400">Aucun numéro</p>
                )}

                <ul className="mt-1">
                  {list.map((n) =>
                    editing === n.id ? (
                      <li key={n.id}>{form}</li>
                    ) : (
                      <li key={n.id} className="flex flex-wrap items-center justify-between gap-3 py-2">
                        <div className={cn(!n.actif && 'opacity-50')}>
                          <span className="font-mono text-navy">{formatPhone(n.numero)}</span>
                          <span className="ml-3 text-sm text-slate-500">{n.titulaire}</span>
                          {!n.actif && <span className="ml-3 text-xs text-slate-400">désactivé</span>}
                        </div>
                        <div className="flex gap-4 text-sm">
                          <button
                            type="button"
                            onClick={() => {
                              setAdding(null)
                              setEditing(n.id)
                              setDraft({ numero: n.numero, titulaire: n.titulaire })
                              setFormError(null)
                            }}
                            className="text-slate-500 hover:text-navy"
                          >
                            Modifier
                          </button>
                          <button
                            type="button"
                            onClick={() => toggle(n)}
                            className="text-slate-500 hover:text-navy"
                          >
                            {n.actif ? 'Désactiver' : 'Réactiver'}
                          </button>
                        </div>
                      </li>
                    )
                  )}
                </ul>
                {adding === moyen && form}
              </div>
            )
          })}
        </div>
      )}
    </section>
  )
}
