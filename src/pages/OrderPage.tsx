import { useMemo, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Plus,
  Trash2,
  Copy,
  Check,
  Upload,
  Loader2,
  AlertCircle,
  ShoppingBag,
} from 'lucide-react'
import { useCatalogue } from '@/hooks/useCatalogue'
import { createOrder, formatPrice, getPrix } from '@/lib/api'
import { uid, cn } from '@/lib/utils'
import type { LigneCommande, Modele, Version, Manches, Taille, MoyenPaiement } from '@/types'

const emptyLine = (): LigneCommande => ({
  id: uid(),
  modele: 'LICENCE',
  version: 'SIMPLE',
  manches: 'COURTES',
  taille: 'M',
  quantite: 1,
})

export default function OrderPage() {
  const { data: catalogue, loading, error } = useCatalogue()
  const navigate = useNavigate()

  const [nom, setNom] = useState('')
  const [prenoms, setPrenoms] = useState('')
  const [email, setEmail] = useState('')
  const [emailConfirm, setEmailConfirm] = useState('')
  const [lignes, setLignes] = useState<LigneCommande[]>([emptyLine()])
  const [moyen, setMoyen] = useState<MoyenPaiement | ''>('')
  const [numeroEnvoi, setNumeroEnvoi] = useState('')
  const [reference, setReference] = useState('')
  const [capture, setCapture] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [confirmation, setConfirmation] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const total = useMemo(() => {
    if (!catalogue) return 0
    return lignes.reduce((sum, l) => {
      const unit = getPrix(catalogue.tarifs, l.modele, l.version, l.manches)
      return sum + unit * l.quantite
    }, 0)
  }, [lignes, catalogue])

  const depotNumbers = useMemo(() => {
    if (!catalogue || !moyen) return []
    return catalogue.numeros_depot.filter((n) => n.moyen === moyen)
  }, [catalogue, moyen])

  const isSizeAvailable = useCallback(
    (modele: string, version: string, manches: string, taille: string) => {
      if (!catalogue) return true
      const d = catalogue.disponibilites.find(
        (x) =>
          x.modele === modele &&
          x.version === version &&
          x.manches === manches &&
          x.taille === taille
      )
      if (!d) return true // no limit
      return d.restant > 0
    },
    [catalogue]
  )

  const updateLine = (id: string, patch: Partial<LigneCommande>) => {
    setLignes((prev) => prev.map((l) => (l.id === id ? { ...l, ...patch } : l)))
  }

  const removeLine = (id: string) => {
    setLignes((prev) => (prev.length <= 1 ? prev : prev.filter((l) => l.id !== id)))
  }

  const onCaptureChange = (file: File | null) => {
    setCapture(file)
    if (preview) URL.revokeObjectURL(preview)
    if (file && file.type.startsWith('image/')) {
      setPreview(URL.createObjectURL(file))
    } else {
      setPreview(null)
    }
  }

  const copyNumber = async (num: string) => {
    try {
      await navigator.clipboard.writeText(num)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      /* ignore */
    }
  }

  const canSubmit =
    nom.trim().length >= 2 &&
    prenoms.trim().length >= 2 &&
    email.includes('@') &&
    email === emailConfirm &&
    lignes.length > 0 &&
    moyen &&
    numeroEnvoi.trim().length >= 8 &&
    capture &&
    confirmation &&
    catalogue?.ventes_ouvertes

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!canSubmit || !capture || !moyen) return
    setFormError(null)
    setSubmitting(true)
    try {
      const payload = {
        nom: nom.trim(),
        prenoms: prenoms.trim(),
        email: email.trim().toLowerCase(),
        email_confirmation: emailConfirm.trim().toLowerCase(),
        lignes: JSON.stringify(
          lignes.map(({ modele, version, manches, taille, quantite }) => ({
            modele,
            version,
            manches,
            taille,
            quantite,
          }))
        ),
        moyen_paiement: moyen,
        numero_envoi: numeroEnvoi.trim(),
        reference_transaction: reference.trim() || undefined,
        capture,
        confirmation: true,
      }
      const result = await createOrder(payload)
      navigate('/confirmation', {
        state: {
          code: result.code_suivi,
          montant: result.montant_total,
          email: payload.email,
        },
      })
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Erreur lors de l’envoi')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-accent" />
      </div>
    )
  }

  if (error || !catalogue) {
    return (
      <div className="mx-auto max-w-lg px-4 py-20 text-center">
        <AlertCircle className="mx-auto h-10 w-10 text-red-500" />
        <p className="mt-3 font-medium text-navy">Catalogue indisponible</p>
        <p className="mt-1 text-sm text-slate-500">{error}</p>
      </div>
    )
  }

  if (!catalogue.ventes_ouvertes) {
    return (
      <div className="mx-auto max-w-lg px-4 py-20 text-center">
        <ShoppingBag className="mx-auto h-10 w-10 text-slate-400" />
        <p className="mt-3 font-display text-xl font-semibold text-navy">
          Ventes fermées
        </p>
        <p className="mt-2 text-sm text-slate-500">
          Les commandes ne sont pas ouvertes pour le moment.
          {catalogue.date_ouverture && (
            <> Ouverture prévue le {new Date(catalogue.date_ouverture).toLocaleDateString('fr-FR')}.</>
          )}
        </p>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 sm:py-12">
      <div className="mb-8">
        <h1 className="font-display text-2xl font-bold text-navy sm:text-3xl">
          Commander mes polos
        </h1>
        <p className="mt-1.5 text-sm text-slate-500">
          Remplis le formulaire, paie en Mobile Money, joins ta capture.
          Une trésorière validera ensuite ta commande.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-8">
        {/* Identité */}
        <section className="card">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-400">
            1 · Identité
          </h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label" htmlFor="nom">
                Nom
              </label>
              <input
                id="nom"
                className="input-field"
                value={nom}
                onChange={(e) => setNom(e.target.value)}
                placeholder="Kouassi"
                required
                minLength={2}
                maxLength={60}
              />
            </div>
            <div>
              <label className="label" htmlFor="prenoms">
                Prénoms
              </label>
              <input
                id="prenoms"
                className="input-field"
                value={prenoms}
                onChange={(e) => setPrenoms(e.target.value)}
                placeholder="Jean-Baptiste"
                required
                minLength={2}
                maxLength={80}
              />
            </div>
            <div>
              <label className="label" htmlFor="email">
                Email
              </label>
              <input
                id="email"
                type="email"
                className="input-field"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="toi@exemple.com"
                required
              />
            </div>
            <div>
              <label className="label" htmlFor="email2">
                Confirmer l’email
              </label>
              <input
                id="email2"
                type="email"
                className="input-field"
                value={emailConfirm}
                onChange={(e) => setEmailConfirm(e.target.value)}
                placeholder="toi@exemple.com"
                required
              />
              {emailConfirm && email !== emailConfirm && (
                <p className="mt-1 text-xs text-red-500">Les emails ne correspondent pas</p>
              )}
            </div>
          </div>
        </section>

        {/* Polos */}
        <section className="card">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">
              2 · Polos
            </h2>
            <button
              type="button"
              onClick={() => setLignes((p) => [...p, emptyLine()])}
              className="btn-ghost !text-accent"
            >
              <Plus className="h-4 w-4" />
              Ajouter un polo
            </button>
          </div>

          <div className="space-y-4">
            <AnimatePresence initial={false}>
              {lignes.map((ligne, idx) => {
                const unit = getPrix(catalogue.tarifs, ligne.modele, ligne.version, ligne.manches)
                return (
                  <motion.div
                    key={ligne.id}
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="rounded-xl border border-slate-100 bg-slate-50/60 p-4"
                  >
                    <div className="mb-3 flex items-center justify-between">
                      <span className="text-xs font-medium text-slate-400">
                        Ligne {idx + 1}
                      </span>
                      {lignes.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeLine(ligne.id)}
                          className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-500"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                      <div>
                        <label className="label">Modèle</label>
                        <select
                          className="input-field"
                          value={ligne.modele}
                          onChange={(e) =>
                            updateLine(ligne.id, { modele: e.target.value as Modele })
                          }
                        >
                          {catalogue.modeles.map((m) => (
                            <option key={m.valeur} value={m.valeur}>
                              {m.libelle}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="label">Version</label>
                        <select
                          className="input-field"
                          value={ligne.version}
                          onChange={(e) =>
                            updateLine(ligne.id, { version: e.target.value as Version })
                          }
                        >
                          {catalogue.versions.map((v) => (
                            <option key={v.valeur} value={v.valeur}>
                              {v.libelle}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="label">Manches</label>
                        <select
                          className="input-field"
                          value={ligne.manches}
                          onChange={(e) =>
                            updateLine(ligne.id, { manches: e.target.value as Manches })
                          }
                        >
                          {catalogue.manches.map((m) => (
                            <option key={m.valeur} value={m.valeur}>
                              {m.libelle}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="label">Quantité</label>
                        <input
                          type="number"
                          min={1}
                          max={catalogue.quantite_max_par_ligne}
                          className="input-field"
                          value={ligne.quantite}
                          onChange={(e) =>
                            updateLine(ligne.id, {
                              quantite: Math.max(
                                1,
                                Math.min(
                                  catalogue.quantite_max_par_ligne,
                                  Number(e.target.value) || 1
                                )
                              ),
                            })
                          }
                        />
                      </div>
                    </div>

                    {/* Choix de taille — boutons S M L XL XXL */}
                    <div className="mt-4">
                      <label className="label">Taille</label>
                      <div className="flex flex-wrap gap-2">
                        {catalogue.tailles.map((t) => {
                          const ok = isSizeAvailable(
                            ligne.modele,
                            ligne.version,
                            ligne.manches,
                            t.valeur
                          )
                          const selected = ligne.taille === t.valeur
                          return (
                            <button
                              key={t.valeur}
                              type="button"
                              disabled={!ok}
                              onClick={() =>
                                updateLine(ligne.id, {
                                  taille: t.valeur as Taille,
                                })
                              }
                              className={cn(
                                'min-w-[3rem] rounded-xl border px-4 py-2.5 text-sm font-semibold transition',
                                selected && ok
                                  ? 'border-accent bg-accent text-white shadow-sm'
                                  : ok
                                    ? 'border-slate-200 bg-white text-navy hover:border-accent hover:bg-accent/5'
                                    : 'cursor-not-allowed border-slate-100 bg-slate-50 text-slate-300 line-through'
                              )}
                              title={!ok ? 'Taille épuisée' : t.libelle}
                            >
                              {t.libelle}
                            </button>
                          )
                        })}
                      </div>
                      {!isSizeAvailable(
                        ligne.modele,
                        ligne.version,
                        ligne.manches,
                        ligne.taille
                      ) && (
                        <p className="mt-1.5 text-xs text-red-500">
                          Cette taille est épuisée pour cette variante — choisis-en une autre.
                        </p>
                      )}
                    </div>
                    <p className="mt-3 text-right text-sm font-medium text-navy">
                      {formatPrice(unit * ligne.quantite)}
                      <span className="ml-1 text-xs font-normal text-slate-400">
                        ({formatPrice(unit)} × {ligne.quantite})
                      </span>
                    </p>
                  </motion.div>
                )
              })}
            </AnimatePresence>
          </div>

          <div className="mt-5 flex items-center justify-between rounded-xl bg-navy px-5 py-4 text-white">
            <span className="text-sm font-medium text-white/80">Total à payer</span>
            <span className="font-display text-xl font-bold">{formatPrice(total)}</span>
          </div>
        </section>

        {/* Paiement */}
        <section className="card">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-400">
            3 · Paiement
          </h2>
          <div className="space-y-4">
            <div>
              <label className="label">Moyen de paiement</label>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {catalogue.moyens_paiement.map((m) => (
                  <button
                    key={m.valeur}
                    type="button"
                    onClick={() => setMoyen(m.valeur as MoyenPaiement)}
                    className={cn(
                      'rounded-xl border px-3 py-3 text-sm font-medium transition',
                      moyen === m.valeur
                        ? 'border-accent bg-accent/10 text-accent'
                        : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                    )}
                  >
                    {m.libelle}
                  </button>
                ))}
              </div>
            </div>

            {depotNumbers.length > 0 && (
              <div className="rounded-xl border border-brand-100 bg-brand-50/60 p-4">
                <p className="text-xs font-medium text-brand-800">
                  Numéro{depotNumbers.length > 1 ? 's' : ''} de dépôt
                </p>
                {depotNumbers.map((d) => (
                  <div
                    key={d.numero}
                    className="mt-2 flex items-center justify-between gap-3"
                  >
                    <div>
                      <p className="font-mono text-lg font-semibold text-navy">
                        {d.numero}
                      </p>
                      <p className="text-xs text-slate-500">{d.titulaire}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => copyNumber(d.numero)}
                      className="btn-secondary !px-3 !py-2"
                    >
                      {copied ? (
                        <Check className="h-4 w-4 text-emerald-600" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                      Copier
                    </button>
                  </div>
                ))}
                <p className="mt-3 text-xs text-slate-500">
                  Envoie exactement <strong>{formatPrice(total)}</strong> puis reviens
                  saisir ton numéro d’envoi et la capture.
                </p>
              </div>
            )}

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="label" htmlFor="numero">
                  Numéro d’envoi
                </label>
                <input
                  id="numero"
                  className="input-field"
                  value={numeroEnvoi}
                  onChange={(e) => setNumeroEnvoi(e.target.value)}
                  placeholder="+225 07 XX XX XX XX"
                  required
                />
              </div>
              <div>
                <label className="label" htmlFor="ref">
                  Référence de transaction <span className="text-slate-400">(optionnel)</span>
                </label>
                <input
                  id="ref"
                  className="input-field"
                  value={reference}
                  onChange={(e) => setReference(e.target.value)}
                  placeholder="ID sur le reçu"
                />
              </div>
            </div>

            <div>
              <label className="label">Capture du paiement</label>
              <label
                className={cn(
                  'flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed px-4 py-8 transition',
                  capture
                    ? 'border-accent bg-accent/5'
                    : 'border-slate-200 hover:border-brand-300 hover:bg-brand-50/40'
                )}
              >
                <input
                  type="file"
                  accept="image/jpeg,image/png,application/pdf"
                  className="hidden"
                  onChange={(e) => onCaptureChange(e.target.files?.[0] ?? null)}
                />
                {preview ? (
                  <img
                    src={preview}
                    alt="Aperçu"
                    className="max-h-40 rounded-lg object-contain"
                  />
                ) : (
                  <>
                    <Upload className="mb-2 h-8 w-8 text-slate-400" />
                    <span className="text-sm font-medium text-slate-600">
                      {capture ? capture.name : 'JPG, PNG ou PDF · max 5 Mo'}
                    </span>
                  </>
                )}
              </label>
            </div>
          </div>
        </section>

        {/* Confirmation */}
        <section className="card">
          <label className="flex cursor-pointer items-start gap-3">
            <input
              type="checkbox"
              checked={confirmation}
              onChange={(e) => setConfirmation(e.target.checked)}
              className="mt-1 h-4 w-4 rounded border-slate-300 text-accent focus:ring-accent"
            />
            <span className="text-sm text-slate-700">
              Je certifie que les informations et le paiement sont exacts.
            </span>
          </label>
        </section>

        {formError && (
          <div className="flex items-start gap-2 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            {formError}
          </div>
        )}

        <button
          type="submit"
          disabled={!canSubmit || submitting}
          className="btn-primary w-full !py-3.5 text-base"
        >
          {submitting ? (
            <>
              <Loader2 className="h-5 w-5 animate-spin" />
              Envoi en cours…
            </>
          ) : (
            <>
              Envoyer ma commande · {formatPrice(total)}
            </>
          )}
        </button>
      </form>
    </div>
  )
}
