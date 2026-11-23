import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  Loader2,
  AlertCircle,
  ArrowLeft,
  Download,
  Check,
  X,
  MessageSquare,
  Package,
  RotateCcw,
  Save,
} from 'lucide-react'
import {
  fetchCommande,
  validerCommande,
  refuserCommande,
  demanderComplement,
  marquerDisponible,
  marquerRemis,
  annulerDecision,
  updateNoteInterne,
  downloadCapture,
  formatPrice,
  formatDate,
} from '@/lib/api'
import type { CommandeDetail, Action, Motif } from '@/types'
import { STATUT_LABELS, MOTIF_LABELS, MOYEN_LABELS } from '@/types'
import { cn } from '@/lib/utils'
import { useAuth } from '@/lib/auth'

const statusColors: Record<string, string> = {
  EN_ATTENTE: 'bg-amber-100 text-amber-800',
  A_CORRIGER: 'bg-orange-100 text-orange-800',
  VALIDEE: 'bg-emerald-100 text-emerald-800',
  POLO_DISPONIBLE: 'bg-blue-100 text-blue-800',
  REMIS: 'bg-slate-100 text-slate-600',
  REFUSEE: 'bg-red-100 text-red-700',
  CLOTUREE: 'bg-slate-100 text-slate-500',
}

const MOTIFS: Motif[] = [
  'CAPTURE_ILLISIBLE',
  'MONTANT_INSUFFISANT',
  'PAIEMENT_INTROUVABLE',
  'DOUBLON',
  'AUTRE',
]

export default function OrderDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { isAdmin } = useAuth()
  const [order, setOrder] = useState<CommandeDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [acting, setActing] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)

  // Decision modal
  const [modal, setModal] = useState<'refuser' | 'complement' | 'annuler' | null>(
    null
  )
  const [motif, setMotif] = useState<Motif>('CAPTURE_ILLISIBLE')
  const [commentaire, setCommentaire] = useState('')

  // Note
  const [note, setNote] = useState('')
  const [savingNote, setSavingNote] = useState(false)

  // Capture preview
  const [captureBlob, setCaptureBlob] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!id) return
    setLoading(true)
    setError(null)
    try {
      const data = await fetchCommande(Number(id))
      setOrder(data)
      setNote(data.note_interne || '')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur')
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    if (!order?.capture) return
    let url: string | null = null
    downloadCapture(order.id)
      .then((blob) => {
        url = URL.createObjectURL(blob)
        setCaptureBlob(url)
      })
      .catch(() => setCaptureBlob(null))
    return () => {
      if (url) URL.revokeObjectURL(url)
    }
  }, [order?.id, order?.capture])

  const can = (action: Action) =>
    order?.actions_possibles?.includes(action) ?? false

  const runAction = async (fn: () => Promise<CommandeDetail>) => {
    setActing(true)
    setActionError(null)
    try {
      const updated = await fn()
      setOrder(updated)
      setModal(null)
      setCommentaire('')
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Action échouée')
    } finally {
      setActing(false)
    }
  }

  const handleSaveNote = async () => {
    if (!order) return
    setSavingNote(true)
    try {
      const updated = await updateNoteInterne(order.id, note)
      setOrder(updated)
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Erreur note')
    } finally {
      setSavingNote(false)
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-accent" />
      </div>
    )
  }

  if (error || !order) {
    return (
      <div className="space-y-4">
        <Link to="/admin/commandes" className="btn-ghost !px-0">
          <ArrowLeft className="h-4 w-4" /> Retour
        </Link>
        <div className="rounded-xl bg-red-50 p-4 text-sm text-red-700">
          <AlertCircle className="mb-1 inline h-4 w-4" /> {error || 'Introuvable'}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link
            to="/admin/commandes"
            className="mb-2 inline-flex items-center gap-1 text-xs text-slate-400 hover:text-navy"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Commandes
          </Link>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="font-mono text-xl font-bold text-navy">
              {order.code_suivi}
            </h1>
            <span
              className={cn(
                'rounded-full px-2.5 py-0.5 text-xs font-medium',
                statusColors[order.statut]
              )}
            >
              {STATUT_LABELS[order.statut]}
            </span>
          </div>
          <p className="mt-1 text-sm text-slate-500">
            {order.nom} {order.prenoms} · {order.email}
          </p>
        </div>
        <p className="text-xs text-slate-400">
          Créée le {formatDate(order.date_creation)}
        </p>
      </div>

      {actionError && (
        <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
          {actionError}
        </div>
      )}

      {/* Actions */}
      {order.actions_possibles?.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {can('VALIDER') && (
            <button
              type="button"
              disabled={acting}
              onClick={() => runAction(() => validerCommande(order.id))}
              className="btn-primary !bg-emerald-600 hover:!bg-emerald-700"
            >
              <Check className="h-4 w-4" /> Valider
            </button>
          )}
          {can('REFUSER') && (
            <button
              type="button"
              disabled={acting}
              onClick={() => setModal('refuser')}
              className="btn-primary !bg-red-600 hover:!bg-red-700"
            >
              <X className="h-4 w-4" /> Refuser
            </button>
          )}
          {can('DEMANDER_COMPLEMENT') && (
            <button
              type="button"
              disabled={acting}
              onClick={() => setModal('complement')}
              className="btn-secondary"
            >
              <MessageSquare className="h-4 w-4" /> Demander complément
            </button>
          )}
          {can('MARQUER_DISPONIBLE') && (
            <button
              type="button"
              disabled={acting}
              onClick={() => runAction(() => marquerDisponible(order.id))}
              className="btn-secondary"
            >
              <Package className="h-4 w-4" /> Marquer disponible
            </button>
          )}
          {can('MARQUER_REMIS') && (
            <button
              type="button"
              disabled={acting}
              onClick={() => runAction(() => marquerRemis(order.id))}
              className="btn-primary"
            >
              <Check className="h-4 w-4" /> Polos remis
            </button>
          )}
          {can('ANNULER_DECISION') && isAdmin && (
            <button
              type="button"
              disabled={acting}
              onClick={() => setModal('annuler')}
              className="btn-ghost text-orange-600"
            >
              <RotateCcw className="h-4 w-4" /> Annuler décision
            </button>
          )}
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-2">
        {/* Left: details */}
        <div className="space-y-5">
          {/* Polos */}
          <div className="card">
            <h2 className="mb-3 text-sm font-semibold text-navy">Polos</h2>
            <ul className="space-y-2">
              {order.lignes.map((l, i) => (
                <li
                  key={i}
                  className="flex justify-between rounded-lg bg-slate-50 px-3 py-2 text-sm"
                >
                  <span>
                    {l.modele} · {l.version} · {l.manches} · {l.taille} ×{' '}
                    {l.quantite}
                  </span>
                  <span className="font-medium">{formatPrice(l.prix_ligne)}</span>
                </li>
              ))}
            </ul>
            <p className="mt-3 flex justify-between border-t border-slate-100 pt-3 text-sm font-bold text-navy">
              <span>Total</span>
              <span>{formatPrice(order.montant_total)}</span>
            </p>
          </div>

          {/* Paiement */}
          <div className="card">
            <h2 className="mb-3 text-sm font-semibold text-navy">Paiement</h2>
            <dl className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <dt className="text-xs text-slate-400">Moyen</dt>
                <dd className="font-medium">
                  {MOYEN_LABELS[order.paiement?.moyen] ||
                    order.moyen_paiement}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-slate-400">N° d’envoi</dt>
                <dd className="font-mono text-sm">
                  {order.paiement?.numero_envoi || order.numero_envoi}
                </dd>
              </div>
              {order.paiement?.reference_transaction && (
                <div className="col-span-2">
                  <dt className="text-xs text-slate-400">Référence</dt>
                  <dd className="font-mono text-sm">
                    {order.paiement.reference_transaction}
                  </dd>
                </div>
              )}
            </dl>
          </div>

          {/* Alertes */}
          {order.alertes?.length > 0 && (
            <div className="rounded-xl border border-orange-200 bg-orange-50 p-4">
              <h2 className="mb-2 text-sm font-semibold text-orange-900">
                Alertes
              </h2>
              {order.alertes.map((a, i) => (
                <div key={i} className="mb-2 last:mb-0">
                  <p className="text-sm text-orange-800">{a.message}</p>
                  {a.commandes_liees?.length > 0 && (
                    <p className="text-xs text-orange-600">
                      Liées : {a.commandes_liees.join(', ')}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Note interne */}
          <div className="card">
            <h2 className="mb-2 text-sm font-semibold text-navy">
              Note interne
            </h2>
            <textarea
              className="input-field min-h-[80px] resize-y"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Visible uniquement par les trésorières…"
            />
            <button
              type="button"
              disabled={savingNote || note === (order.note_interne || '')}
              onClick={handleSaveNote}
              className="btn-secondary mt-2 !py-2 !text-xs"
            >
              {savingNote ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Save className="h-3.5 w-3.5" />
              )}
              Enregistrer
            </button>
          </div>

          {/* Historique */}
          {order.evenements?.length > 0 && (
            <div className="card">
              <h2 className="mb-3 text-sm font-semibold text-navy">Historique</h2>
              <ul className="space-y-3">
                {order.evenements.map((ev, i) => (
                  <li key={i} className="border-l-2 border-slate-200 pl-3 text-sm">
                    <p className="font-medium text-navy">
                      {ev.action}
                      {ev.auteur && (
                        <span className="ml-1 font-normal text-slate-400">
                          · {ev.auteur}
                        </span>
                      )}
                    </p>
                    <p className="text-xs text-slate-400">
                      {formatDate(ev.date)}
                      {ev.statut_avant &&
                        ` · ${ev.statut_avant} → ${ev.statut_apres}`}
                    </p>
                    {ev.commentaire && (
                      <p className="mt-0.5 text-xs text-slate-600">
                        {ev.commentaire}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Right: capture */}
        <div className="card">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-navy">
              Capture de paiement
            </h2>
            {order.capture && (
              <button
                type="button"
                onClick={async () => {
                  const blob = await downloadCapture(order.id)
                  const url = URL.createObjectURL(blob)
                  const a = document.createElement('a')
                  a.href = url
                  a.download = `capture-${order.code_suivi}`
                  a.click()
                  URL.revokeObjectURL(url)
                }}
                className="btn-ghost !px-2 !py-1 !text-xs"
              >
                <Download className="h-3.5 w-3.5" /> Télécharger
              </button>
            )}
          </div>
          {captureBlob ? (
            order.capture?.type_mime === 'application/pdf' ? (
              <iframe
                src={captureBlob}
                title="Capture PDF"
                className="h-[480px] w-full rounded-lg border border-slate-100"
              />
            ) : (
              <img
                src={captureBlob}
                alt="Capture de paiement"
                className="max-h-[520px] w-full rounded-lg object-contain"
              />
            )
          ) : order.capture ? (
            <div className="flex h-40 items-center justify-center text-sm text-slate-400">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Chargement…
            </div>
          ) : (
            <p className="py-10 text-center text-sm text-slate-400">
              Aucune capture
            </p>
          )}
        </div>
      </div>

      {/* Decision modal */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-card">
            <h3 className="font-display text-lg font-semibold text-navy">
              {modal === 'refuser' && 'Refuser la commande'}
              {modal === 'complement' && 'Demander un complément'}
              {modal === 'annuler' && 'Annuler la décision'}
            </h3>
            <div className="mt-4 space-y-3">
              <div>
                <label className="label">Motif</label>
                <select
                  className="input-field"
                  value={motif}
                  onChange={(e) => setMotif(e.target.value as Motif)}
                >
                  {MOTIFS.map((m) => (
                    <option key={m} value={m}>
                      {MOTIF_LABELS[m]}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">Commentaire</label>
                <textarea
                  className="input-field min-h-[80px]"
                  value={commentaire}
                  onChange={(e) => setCommentaire(e.target.value)}
                  placeholder="Message visible par l’acheteur…"
                />
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setModal(null)}
                className="btn-ghost"
              >
                Annuler
              </button>
              <button
                type="button"
                disabled={acting}
                onClick={() => {
                  const payload = { motif, commentaire }
                  if (modal === 'refuser')
                    runAction(() => refuserCommande(order.id, payload))
                  else if (modal === 'complement')
                    runAction(() => demanderComplement(order.id, payload))
                  else if (modal === 'annuler')
                    runAction(() => annulerDecision(order.id, payload))
                }}
                className={cn(
                  'btn-primary',
                  modal === 'refuser' && '!bg-red-600 hover:!bg-red-700'
                )}
              >
                {acting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  'Confirmer'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
