import { useCallback, useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Loader2, X } from 'lucide-react'
import {
  fetchCommande,
  validerCommande,
  refuserCommande,
  demanderComplement,
  marquerDisponible,
  marquerRemis,
  annulerDecision,
  downloadCapture,
  formatPrice,
  formatDate,
} from '@/lib/api'
import type { CommandeDetail, Action, Motif } from '@/types'
import { MOTIF_LABELS, MOYEN_LABELS } from '@/types'
import { cn } from '@/lib/utils'
import { useAuth } from '@/lib/auth'
import { formatPhone } from '@/lib/status'
import StatusBadge from './StatusBadge'
import { useAutoRefresh } from '@/hooks/useAutoRefresh'
import OperatorLogo from '@/components/OperatorLogo'

const MOTIFS: Motif[] = ['CAPTURE_ILLISIBLE', 'MONTANT_INSUFFISANT', 'PAIEMENT_INTROUVABLE', 'DOUBLON', 'AUTRE']

const SAFE_TYPES = ['image/jpeg', 'image/png', 'application/pdf']
const EXTENSIONS: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'application/pdf': '.pdf',
}

type ModalKind ='refuser' | 'complement' | 'annuler'

interface Props {
  id: number
  onChanged?: (o: CommandeDetail) => void
}

export default function OrderDetail({ id, onChanged }: Props) {
  const { isAdmin } = useAuth()
  const [order, setOrder] = useState<CommandeDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [acting, setActing] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)
  const [modal, setModal] = useState<ModalKind | null>(null)
  const [motif, setMotif] = useState<Motif>('CAPTURE_ILLISIBLE')
  const [commentaire, setCommentaire] = useState('')
  const [captureUrl, setCaptureUrl] = useState<string | null>(null)
  const [zoom, setZoom] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    setCaptureUrl(null)
    try {
      const data = await fetchCommande(id)
      setOrder(data)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur')
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    load()
  }, [load])

  // Actualisation en arrière-plan, sauf pendant une action ou une fenêtre de décision ouverte
  useAutoRefresh(async () => {
    if (!order || acting || modal) return
    try {
      setOrder(await fetchCommande(id))
    } catch {
      /* on garde l'affichage actuel */
    }
  })

  const captureId = order?.capture?.id
  useEffect(() => {
    if (!order?.capture) return
    // Aperçu uniquement pour les types attendus. Le type est imposé côté navigateur :
    // un fichier piégé (HTML, SVG…) ne peut donc jamais s'exécuter dans l'admin.
    const mime = order.capture.type_mime
    if (!SAFE_TYPES.includes(mime)) return
    let url: string | null = null
    let cancelled = false
    downloadCapture(order.id)
      .then((blob) => {
        if (cancelled) return
        url = URL.createObjectURL(new Blob([blob], { type: mime }))
        setCaptureUrl(url)
      })
      .catch(() => setCaptureUrl(null))
    return () => {
      cancelled = true
      if (url) URL.revokeObjectURL(url)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [order?.id, captureId])

  const can = (a: Action) => order?.actions_possibles?.includes(a) ?? false

  const run = async (fn: () => Promise<CommandeDetail>) => {
    setActing(true)
    setActionError(null)
    try {
      const updated = await fn()
      setOrder(updated)
      onChanged?.(updated)
      setModal(null)
      setCommentaire('')
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Action impossible')
    } finally {
      setActing(false)
    }
  }

  const download = async () => {
    if (!order) return
    const blob = await downloadCapture(order.id)
    // Téléchargement brut : le fichier est enregistré, jamais ouvert dans la page
    const url = URL.createObjectURL(new Blob([blob], { type: 'application/octet-stream' }))
    const ext = EXTENSIONS[order.capture?.type_mime ?? ''] ?? ''
    const a = document.createElement('a')
    a.href = url
    a.download = `capture-${order.code_suivi.replace(/[^A-Za-z0-9-]/g, '')}${ext}`
    a.click()
    URL.revokeObjectURL(url)
  }

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
      </div>
    )
  }

  if (error || !order) {
    return <p className="rounded-xl bg-red-50 p-4 text-sm text-red-700">{error || 'Commande introuvable'}</p>
  }

  const isPdf = order.capture?.type_mime === 'application/pdf'
  const moyen = order.paiement?.moyen || order.moyen_paiement

  return (
    <>
      <div className="space-y-8">
        {/* En-tête */}
        <div>
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="font-display text-2xl font-bold text-navy">
                {order.nom} {order.prenoms}
              </p>
              <p className="mt-1 text-sm text-slate-500">{order.email}</p>
            </div>
            <p className="font-display text-2xl font-bold text-navy">{formatPrice(order.montant_total)}</p>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-slate-500">
            <span className="font-mono">{order.code_suivi}</span>
            <StatusBadge statut={order.statut} />
            <span>{formatDate(order.date_creation)}</span>
          </div>
        </div>

        {/* Actions */}
        {order.actions_possibles?.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {can('VALIDER') && (
              <button type="button" disabled={acting} onClick={() => run(() => validerCommande(order.id))} className="btn-dark">
                Valider le paiement
              </button>
            )}
            {can('MARQUER_DISPONIBLE') && (
              <button type="button" disabled={acting} onClick={() => run(() => marquerDisponible(order.id))} className="btn-dark">
                Polos disponibles
              </button>
            )}
            {can('MARQUER_REMIS') && (
              <button type="button" disabled={acting} onClick={() => run(() => marquerRemis(order.id))} className="btn-dark">
                Marquer remis
              </button>
            )}
            {can('DEMANDER_COMPLEMENT') && (
              <button type="button" disabled={acting} onClick={() => setModal('complement')} className="btn-secondary">
                Demander un complément
              </button>
            )}
            {can('REFUSER') && (
              <button type="button" disabled={acting} onClick={() => setModal('refuser')} className="btn-secondary !text-red-600">
                Refuser
              </button>
            )}
            {can('ANNULER_DECISION') && isAdmin && (
              <button type="button" disabled={acting} onClick={() => setModal('annuler')} className="btn-ghost">
                Annuler la décision
              </button>
            )}
            {acting && <Loader2 className="h-5 w-5 animate-spin self-center text-slate-400" />}
          </div>
        )}
        {actionError && <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{actionError}</p>}

        {/* Alertes */}
        {(order.alertes?.length > 0 || order.autres_commandes_meme_email?.length > 0) && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            <p className="font-semibold">À vérifier</p>
            <ul className="mt-1 list-disc space-y-0.5 pl-5">
              {order.alertes?.map((a, i) => (
                <li key={i}>
                  {a.message}
                  {a.commandes_liees?.length > 0 && (
                    <span className="font-mono text-xs"> ({a.commandes_liees.join(', ')})</span>
                  )}
                </li>
              ))}
              {order.autres_commandes_meme_email?.length > 0 && (
                <li>
                  Autres commandes avec cet email :{' '}
                  <span className="font-mono text-xs">{order.autres_commandes_meme_email.join(', ')}</span>
                </li>
              )}
            </ul>
          </div>
        )}

        {/* Capture */}
        <Block
          title="Capture du paiement"
          right={
            order.capture && (
              <button type="button" onClick={download} className="text-sm font-semibold text-navy hover:underline">
                Télécharger
              </button>
            )
          }
        >
          {captureUrl ? (
            isPdf ? (
              <iframe src={captureUrl} title="Capture" className="h-[420px] w-full rounded-xl border border-slate-200" />
            ) : (
              <button
                type="button"
                onClick={() => setZoom(true)}
                className="block w-full overflow-hidden rounded-xl border border-slate-200 bg-slate-50"
              >
                <img src={captureUrl} alt="Capture du paiement" className="max-h-[380px] w-full object-contain" />
              </button>
            )
          ) : order.capture && !SAFE_TYPES.includes(order.capture.type_mime) ? (
            <p className="rounded-xl bg-slate-50 py-10 text-center text-sm text-slate-500">
              Format inattendu ({order.capture.type_mime}) : aperçu désactivé. Téléchargez le fichier
              pour le vérifier.
            </p>
          ) : order.capture ? (
            <div className="flex h-32 items-center justify-center">
              <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
            </div>
          ) : (
            <p className="rounded-xl bg-slate-50 py-10 text-center text-sm text-slate-400">Aucune capture</p>
          )}
        </Block>

        {/* Paiement */}
        <Block title="Paiement">
          <div className="mb-4 flex items-center gap-3">
            <OperatorLogo moyen={moyen} />
            <p className="font-semibold text-navy">{MOYEN_LABELS[moyen] ?? moyen}</p>
          </div>
          <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
            <Row label="Numéro d’envoi" value={formatPhone(order.paiement?.numero_envoi || order.numero_envoi)} mono />
            <Row label="Référence" value={order.paiement?.reference_transaction || '—'} mono />
            <Row label="Montant attendu" value={formatPrice(order.montant_total)} />
          </dl>
        </Block>

        {/* Polos */}
        <Block title={`Polos (${order.nombre_polos})`}>
          <ul className="divide-y divide-slate-100 text-sm">
            {order.lignes.map((l, i) => (
              <li key={i} className="flex justify-between gap-4 py-2.5">
                <span className="text-slate-700">
                  {l.modele_libelle || l.modele} · {l.version_libelle || l.version} ·{' '}
                  {l.manches_libelle || l.manches} · <b>{l.taille}</b> × {l.quantite}
                </span>
                <span className="font-semibold text-navy">{formatPrice(l.prix_ligne)}</span>
              </li>
            ))}
          </ul>
        </Block>

        {(order.motif || order.commentaire) && (
          <Block title="Dernière décision">
            <p className="text-sm text-slate-700">
              {order.motif && <b>{MOTIF_LABELS[order.motif] || order.motif}. </b>}
              {order.commentaire}
            </p>
          </Block>
        )}
      </div>

      {/* Zoom */}
      <AnimatePresence>
        {zoom && captureUrl && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[80] flex items-center justify-center bg-navy-dark/90 p-6"
            onClick={() => setZoom(false)}
          >
            <img src={captureUrl} alt="Capture" className="max-h-full max-w-full rounded-xl object-contain" />
            <button type="button" className="absolute right-5 top-5 text-white/80" aria-label="Fermer">
              <X className="h-6 w-6" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Décision */}
      <AnimatePresence>
        {modal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[80] flex items-center justify-center bg-navy-dark/40 p-4"
          >
            <motion.div
              initial={{ scale: 0.97, y: 8 }}
              animate={{ scale: 1, y: 0 }}
              className="w-full max-w-md rounded-2xl bg-white p-6 shadow-card"
            >
              <h3 className="font-display text-lg font-bold text-navy">
                {modal === 'refuser' && 'Refuser la commande'}
                {modal === 'complement' && 'Demander un complément'}
                {modal === 'annuler' && 'Annuler la décision'}
              </h3>
              <p className="mt-1 text-sm text-slate-500">
                {modal === 'annuler'
                  ? 'La commande revient à son état précédent.'
                  : 'L’acheteur reçoit ce message par email.'}
              </p>
              <div className="mt-5 space-y-4">
                <div>
                  <p className="label">Motif</p>
                  <div className="flex flex-wrap gap-2">
                    {MOTIFS.map((m) => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => setMotif(m)}
                        className={cn(
                          'rounded-full border px-3 py-1.5 text-xs font-semibold transition',
                          motif === m ? 'border-navy bg-navy text-white' : 'border-slate-200 text-slate-600'
                        )}
                      >
                        {MOTIF_LABELS[m]}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="label">Message</label>
                  <textarea
                    className="input-field min-h-[90px]"
                    value={commentaire}
                    onChange={(e) => setCommentaire(e.target.value)}
                    placeholder="Ex. : le montant n’apparaît pas sur la capture."
                  />
                </div>
              </div>
              <div className="mt-6 flex justify-end gap-2">
                <button type="button" onClick={() => setModal(null)} className="btn-ghost">
                  Annuler
                </button>
                <button
                  type="button"
                  disabled={acting}
                  onClick={() => {
                    const p = { motif, commentaire }
                    if (modal === 'refuser') run(() => refuserCommande(order.id, p))
                    else if (modal === 'complement') run(() => demanderComplement(order.id, p))
                    else run(() => annulerDecision(order.id, p))
                  }}
                  className={cn('btn-dark', modal === 'refuser' && '!bg-red-600 hover:!bg-red-700')}
                >
                  {acting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Confirmer'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}

function Block({ title, right, children }: { title: string; right?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section>
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-500">{title}</h3>
        {right}
      </div>
      {children}
    </section>
  )
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <dt className="text-slate-400">{label}</dt>
      <dd className={cn('mt-0.5 text-navy', mono && 'font-mono')}>{value}</dd>
    </div>
  )
}
