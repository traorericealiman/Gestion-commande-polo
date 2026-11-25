import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  Loader2,
  Search,
  AlertCircle,
  UploadCloud,
  CheckCircle2,
  Check,
  MapPin,
  Clock,
  XCircle,
  RefreshCw,
} from 'lucide-react'
import { trackOrder, resendCapture, formatPrice } from '@/lib/api'
import type { SuiviCommande } from '@/types'
import { cn, checkCapture } from '@/lib/utils'
import { PARCOURS, etapeIndex, statusChip } from '@/lib/status'

export default function TrackPage() {
  const [params] = useSearchParams()
  const [code, setCode] = useState(params.get('code') ?? '')
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [order, setOrder] = useState<SuiviCommande | null>(null)

  const [newCapture, setNewCapture] = useState<File | null>(null)
  const [newRef, setNewRef] = useState('')
  const [resending, setResending] = useState(false)
  const [resendOk, setResendOk] = useState(false)

  const mail = email.trim().toLowerCase()

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setOrder(null)
    setResendOk(false)
    setLoading(true)
    try {
      setOrder(await trackOrder(code.trim().toUpperCase(), mail))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Commande introuvable')
    } finally {
      setLoading(false)
    }
  }

  const handleResend = async () => {
    if (!order || !newCapture) return
    setResending(true)
    setError(null)
    try {
      await resendCapture(order.code_suivi, mail, newCapture, newRef.trim() || undefined)
      setResendOk(true)
      setNewCapture(null)
      setOrder(await trackOrder(order.code_suivi, mail))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Échec du renvoi')
    } finally {
      setResending(false)
    }
  }

  const refusee = order?.statut === 'REFUSEE'
  const aCorriger = order?.statut === 'A_CORRIGER'
  const current = order ? etapeIndex(order.statut) : 0

  return (
    <div className="pb-24">
      <div className="mx-auto max-w-3xl px-4 pb-8 pt-14 text-center sm:px-6">
        <h1 className="font-display text-3xl font-extrabold tracking-tight text-navy sm:text-4xl">
          Suivre ma commande
        </h1>
        <p className="mx-auto mt-3 max-w-md text-slate-500">
          Ton code de suivi se trouve dans l’email reçu après ta commande.
        </p>
      </div>

      <div className="relative mx-auto max-w-3xl px-4 sm:px-6">
        <form
          onSubmit={handleSearch}
          className="grid gap-4 rounded-3xl border border-slate-200/70 bg-white p-5 shadow-soft sm:grid-cols-[1fr_1fr_auto] sm:items-end sm:p-6"
        >
          <div>
            <label className="label" htmlFor="code">
              Code de suivi
            </label>
            <input
              id="code"
              className="input-field font-mono uppercase"
              value={code}
              maxLength={20}
              onChange={(e) => setCode(e.target.value)}
              placeholder="POLO-2026-0042"
              required
            />
          </div>
          <div>
            <label className="label" htmlFor="email-track">
              Email de commande
            </label>
            <input
              id="email-track"
              type="email"
              className="input-field"
              value={email}
              maxLength={254}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="toi@exemple.com"
              required
            />
          </div>
          <button type="submit" disabled={loading} className="btn-dark h-[46px] !px-6">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            Suivre
          </button>
        </form>

        {error && (
          <div className="mt-4 flex items-start gap-2 rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            {error}
          </div>
        )}

        {order && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-6 space-y-5"
          >
            {/* En-tête commande */}
            <div className="rounded-3xl border border-slate-200/70 bg-white p-6 shadow-soft">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                    Commande
                  </p>
                  <p className="mt-1 font-mono text-xl font-semibold text-navy">{order.code_suivi}</p>
                  <p className="mt-1 text-xs text-slate-400">
                    Passée le{' '}
                    {new Date(order.date_creation).toLocaleString('fr-FR', {
                      dateStyle: 'long',
                      timeStyle: 'short',
                    })}
                  </p>
                </div>
                <span className={cn('chip !px-3 !py-1', statusChip(order.statut))}>
                  {order.statut_libelle}
                </span>
              </div>

              {/* Frise */}
              {refusee ? (
                <div className="mt-6 flex gap-3 rounded-2xl bg-red-50 p-4 text-red-800">
                  <XCircle className="mt-0.5 h-5 w-5 shrink-0" />
                  <div>
                    <p className="font-semibold">Commande refusée</p>
                    {order.motif_libelle && <p className="text-sm">{order.motif_libelle}</p>}
                    {order.commentaire && <p className="mt-1 text-sm opacity-80">{order.commentaire}</p>}
                  </div>
                </div>
              ) : (
                <ol className="mt-8 grid grid-cols-4">
                  {PARCOURS.map((p, i) => {
                    const done = i < current || (i === current && order.statut === 'REMIS')
                    const active = i === current && !done
                    return (
                      <li key={p.statut} className="relative flex flex-col items-center text-center">
                        {i > 0 && (
                          <span
                            className={cn(
                              'absolute right-1/2 top-4 h-0.5 w-full -translate-y-1/2',
                              i <= current ? 'bg-accent' : 'bg-slate-200'
                            )}
                          />
                        )}
                        <span
                          className={cn(
                            'relative z-10 flex h-8 w-8 items-center justify-center rounded-full ring-4 ring-white',
                            done
                              ? 'bg-accent text-white'
                              : active
                                ? aCorriger
                                  ? 'bg-orange-500 text-white'
                                  : 'bg-navy text-white'
                                : 'bg-slate-200 text-slate-400'
                          )}
                        >
                          {done ? (
                            <Check className="h-4 w-4" />
                          ) : active ? (
                            aCorriger ? <RefreshCw className="h-4 w-4" /> : <Clock className="h-4 w-4" />
                          ) : (
                            <span className="text-xs font-bold">{i + 1}</span>
                          )}
                        </span>
                        <p
                          className={cn(
                            'mt-2.5 text-xs font-semibold sm:text-sm',
                            done || active ? 'text-navy' : 'text-slate-400'
                          )}
                        >
                          {active && aCorriger ? 'À corriger' : p.titre}
                        </p>
                        <p className="mt-0.5 hidden text-[11px] text-slate-400 sm:block">{p.texte}</p>
                      </li>
                    )
                  })}
                </ol>
              )}
            </div>

            {/* Correction demandée */}
            {order.peut_renvoyer_capture && (
              <div className="rounded-3xl border border-orange-200 bg-orange-50/60 p-6">
                <p className="font-display font-bold text-orange-900">
                  La trésorerie demande une nouvelle capture
                </p>
                {(order.motif_libelle || order.commentaire) && (
                  <p className="mt-1 text-sm text-orange-800">
                    {order.motif_libelle}
                    {order.commentaire && ` — ${order.commentaire}`}
                  </p>
                )}
                {resendOk ? (
                  <p className="mt-4 flex items-center gap-1.5 text-sm font-semibold text-emerald-700">
                    <CheckCircle2 className="h-4 w-4" />
                    Capture envoyée, merci.
                  </p>
                ) : (
                  <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-stretch">
                    <label className="flex cursor-pointer items-center gap-3 rounded-xl border-2 border-dashed border-orange-200 bg-white px-4 py-3">
                      <input
                        type="file"
                        accept="image/jpeg,image/png,application/pdf"
                        className="hidden"
                        onChange={(e) => {
                          const f = e.target.files?.[0] ?? null
                          const err = f ? checkCapture(f) : null
                          setError(err)
                          setNewCapture(err ? null : f)
                        }}
                      />
                      <UploadCloud className="h-5 w-5 shrink-0 text-orange-500" />
                      <span className="truncate text-sm text-slate-600">
                        {newCapture ? newCapture.name : 'Choisir la capture'}
                      </span>
                    </label>
                    <input
                      className="input-field"
                      value={newRef}
                      maxLength={100}
                      onChange={(e) => setNewRef(e.target.value)}
                      placeholder="Référence (facultatif)"
                    />
                    <button
                      type="button"
                      disabled={!newCapture || resending}
                      onClick={handleResend}
                      className="btn-primary !bg-orange-600 hover:!bg-orange-700"
                    >
                      {resending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Renvoyer'}
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Retrait */}
            {order.retrait && (order.retrait.lieu || order.retrait.horaires) && (
              <div className="flex gap-4 rounded-3xl border border-emerald-200 bg-emerald-50/60 p-6">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-emerald-500 text-white">
                  <MapPin className="h-5 w-5" />
                </span>
                <div className="text-sm">
                  <p className="font-display font-bold text-emerald-900">Retrait de tes polos</p>
                  {order.retrait.lieu && <p className="mt-1 text-emerald-900">{order.retrait.lieu}</p>}
                  {order.retrait.horaires && (
                    <p className="text-emerald-800/80">{order.retrait.horaires}</p>
                  )}
                  {order.retrait.instructions && (
                    <p className="mt-1 text-emerald-800/70">{order.retrait.instructions}</p>
                  )}
                </div>
              </div>
            )}

            {/* Détail */}
            <div className="rounded-3xl border border-slate-200/70 bg-white p-6 shadow-soft">
              <p className="font-display font-bold text-navy">Détail de la commande</p>
              <ul className="mt-3 divide-y divide-slate-100">
                {order.lignes.map((l, i) => (
                  <li key={i} className="flex justify-between gap-4 py-3 text-sm">
                    <span className="text-slate-700">
                      {l.modele_libelle || l.modele} · {l.version_libelle || l.version} ·{' '}
                      {l.manches_libelle || l.manches} · <b>{l.taille}</b> × {l.quantite}
                    </span>
                    <span className="font-semibold text-navy">{formatPrice(l.prix_ligne)}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-2 flex justify-between border-t border-slate-200 pt-4">
                <span className="text-sm font-medium text-slate-500">Total</span>
                <span className="font-display text-lg font-extrabold text-navy">
                  {formatPrice(order.montant_total)}
                </span>
              </div>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  )
}
