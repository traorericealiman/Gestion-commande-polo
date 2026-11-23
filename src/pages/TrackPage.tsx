import { useState } from 'react'
import { Loader2, Search, AlertCircle, Upload, CheckCircle2 } from 'lucide-react'
import { trackOrder, resendCapture, formatPrice } from '@/lib/api'
import type { SuiviCommande } from '@/types'
import { cn } from '@/lib/utils'

const statusColors: Record<string, string> = {
  EN_ATTENTE: 'bg-amber-100 text-amber-800',
  A_CORRIGER: 'bg-orange-100 text-orange-800',
  VALIDEE: 'bg-emerald-100 text-emerald-800',
  POLO_DISPONIBLE: 'bg-blue-100 text-blue-800',
  REMIS: 'bg-slate-100 text-slate-700',
  REFUSEE: 'bg-red-100 text-red-800',
  CLOTUREE: 'bg-slate-100 text-slate-500',
}

export default function TrackPage() {
  const [code, setCode] = useState('')
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [order, setOrder] = useState<SuiviCommande | null>(null)

  const [newCapture, setNewCapture] = useState<File | null>(null)
  const [resending, setResending] = useState(false)
  const [resendOk, setResendOk] = useState(false)

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setOrder(null)
    setResendOk(false)
    setLoading(true)
    try {
      const data = await trackOrder(code.trim().toUpperCase(), email.trim().toLowerCase())
      setOrder(data)
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
      await resendCapture(order.code_suivi, email.trim().toLowerCase(), newCapture)
      setResendOk(true)
      setNewCapture(null)
      // refresh
      const data = await trackOrder(order.code_suivi, email.trim().toLowerCase())
      setOrder(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Échec du renvoi')
    } finally {
      setResending(false)
    }
  }

  return (
    <div className="mx-auto max-w-lg px-4 py-10 sm:px-6 sm:py-14">
      <h1 className="font-display text-2xl font-bold text-navy">Suivre ma commande</h1>
      <p className="mt-1.5 text-sm text-slate-500">
        Saisis ton code de suivi et l’email utilisé lors de la commande.
      </p>

      <form onSubmit={handleSearch} className="card mt-6 space-y-4">
        <div>
          <label className="label" htmlFor="code">
            Code de suivi
          </label>
          <input
            id="code"
            className="input-field font-mono uppercase"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="POLO-2026-0042"
            required
          />
        </div>
        <div>
          <label className="label" htmlFor="email-track">
            Email
          </label>
          <input
            id="email-track"
            type="email"
            className="input-field"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="toi@exemple.com"
            required
          />
        </div>
        <button type="submit" disabled={loading} className="btn-primary w-full">
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Search className="h-4 w-4" />
          )}
          Rechercher
        </button>
      </form>

      {error && (
        <div className="mt-4 flex items-start gap-2 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      {order && (
        <div className="card mt-6 space-y-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="font-mono text-sm font-semibold text-navy">{order.code_suivi}</p>
              <p className="mt-0.5 text-xs text-slate-400">
                {new Date(order.date_creation).toLocaleString('fr-FR')}
              </p>
            </div>
            <span
              className={cn(
                'rounded-full px-2.5 py-1 text-xs font-medium',
                statusColors[order.statut] || 'bg-slate-100 text-slate-600'
              )}
            >
              {order.statut_libelle}
            </span>
          </div>

          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
              Polos
            </p>
            <ul className="mt-2 space-y-2">
              {order.lignes.map((l, i) => (
                <li
                  key={i}
                  className="flex justify-between text-sm text-slate-700"
                >
                  <span>
                    {l.modele_libelle || l.modele} · {l.version_libelle || l.version} ·{' '}
                    {l.manches_libelle || l.manches} · {l.taille} × {l.quantite}
                  </span>
                  <span className="font-medium">{formatPrice(l.prix_ligne)}</span>
                </li>
              ))}
            </ul>
            <p className="mt-3 flex justify-between border-t border-slate-100 pt-3 text-sm font-semibold text-navy">
              <span>Total</span>
              <span>{formatPrice(order.montant_total)}</span>
            </p>
          </div>

          {(order.motif_libelle || order.commentaire) && (
            <div className="rounded-xl bg-slate-50 p-3 text-sm">
              {order.motif_libelle && (
                <p className="font-medium text-navy">{order.motif_libelle}</p>
              )}
              {order.commentaire && (
                <p className="mt-1 text-slate-600">{order.commentaire}</p>
              )}
            </div>
          )}

          {order.retrait && (
            <div className="rounded-xl border border-emerald-100 bg-emerald-50/60 p-4 text-sm">
              <p className="font-semibold text-emerald-900">Retrait</p>
              {order.retrait.lieu && <p className="mt-1">{order.retrait.lieu}</p>}
              {order.retrait.horaires && (
                <p className="text-emerald-800/80">{order.retrait.horaires}</p>
              )}
              {order.retrait.instructions && (
                <p className="mt-1 text-emerald-800/70">{order.retrait.instructions}</p>
              )}
            </div>
          )}

          {order.peut_renvoyer_capture && (
            <div className="rounded-xl border border-orange-100 bg-orange-50/50 p-4">
              <p className="text-sm font-medium text-orange-900">
                Une nouvelle capture est demandée
              </p>
              {resendOk ? (
                <p className="mt-2 flex items-center gap-1.5 text-sm text-emerald-700">
                  <CheckCircle2 className="h-4 w-4" />
                  Capture renvoyée. Elle sera vérifiée prochainement.
                </p>
              ) : (
                <div className="mt-3 space-y-3">
                  <label className="flex cursor-pointer flex-col items-center rounded-lg border border-dashed border-orange-200 bg-white px-3 py-5">
                    <input
                      type="file"
                      accept="image/jpeg,image/png,application/pdf"
                      className="hidden"
                      onChange={(e) => setNewCapture(e.target.files?.[0] ?? null)}
                    />
                    <Upload className="mb-1 h-5 w-5 text-orange-400" />
                    <span className="text-xs text-slate-600">
                      {newCapture ? newCapture.name : 'Choisir une capture'}
                    </span>
                  </label>
                  <button
                    type="button"
                    disabled={!newCapture || resending}
                    onClick={handleResend}
                    className="btn-primary w-full !bg-orange-600 hover:!bg-orange-700"
                  >
                    {resending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      'Renvoyer la capture'
                    )}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
