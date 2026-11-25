import { useMemo, useState, useCallback, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Plus,
  Minus,
  Trash2,
  Copy,
  Check,
  UploadCloud,
  Loader2,
  AlertCircle,
  ShoppingBag,
  User,
  Shirt,
  Wallet,
  ClipboardCheck,
  ArrowRight,
  ArrowLeft,
  FileText,
  X,
  Info,
  Lock,
} from 'lucide-react'
import { useCatalogue } from '@/hooks/useCatalogue'
import { createOrder, formatPrice, getPrix } from '@/lib/api'
import { uid, cn, checkCapture } from '@/lib/utils'
import { OPERATEURS, formatPhone } from '@/lib/status'
import { COULEUR_CYCLE, poloImage } from '@/lib/polos'
import OperatorLogo from '@/components/OperatorLogo'
import type {
  Catalogue,
  LigneCommande,
  Modele,
  Version,
  Manches,
  Taille,
  MoyenPaiement,
} from '@/types'

const emptyLine = (): LigneCommande => ({
  id: uid(),
  modele: 'LICENCE',
  version: 'SIMPLE',
  manches: 'COURTES',
  taille: 'M',
  quantite: 1,
})

const STEPS = [
  { key: 'polos', label: 'Polos', icon: Shirt },
  { key: 'identite', label: 'Identité', icon: User },
  { key: 'paiement', label: 'Paiement', icon: Wallet },
  { key: 'recap', label: 'Récapitulatif', icon: ClipboardCheck },
] as const

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

export default function OrderPage() {
  const { data: catalogue, loading, error } = useCatalogue()
  const navigate = useNavigate()

  const [step, setStep] = useState(0)
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
  const [touched, setTouched] = useState(false)

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' })
    setTouched(false)
  }, [step])

  const total = useMemo(() => {
    if (!catalogue) return 0
    return lignes.reduce(
      (sum, l) => sum + getPrix(catalogue.tarifs, l.modele, l.version, l.manches) * l.quantite,
      0
    )
  }, [lignes, catalogue])

  const nbPolos = lignes.reduce((s, l) => s + l.quantite, 0)

  const numerosParMoyen = useMemo(() => {
    const map: Record<string, Catalogue['numeros_depot']> = {}
    catalogue?.numeros_depot.forEach((n) => {
      ;(map[n.moyen] ||= []).push(n)
    })
    return map
  }, [catalogue])

  const depotNumbers = moyen ? numerosParMoyen[moyen] ?? [] : []

  const isSizeAvailable = useCallback(
    (modele: string, version: string, manches: string, taille: string) => {
      const d = catalogue?.disponibilites.find(
        (x) =>
          x.modele === modele && x.version === version && x.manches === manches && x.taille === taille
      )
      return !d || d.restant > 0
    },
    [catalogue]
  )

  const updateLine = (id: string, patch: Partial<LigneCommande>) =>
    setLignes((prev) => prev.map((l) => (l.id === id ? { ...l, ...patch } : l)))
  const removeLine = (id: string) =>
    setLignes((prev) => (prev.length <= 1 ? prev : prev.filter((l) => l.id !== id)))

  const onCaptureChange = (file: File | null) => {
    if (preview) URL.revokeObjectURL(preview)
    setCapture(file)
    // Aperçu seulement pour les images JPG/PNG (jamais d'autre type, ex. SVG)
    setPreview(
      file && (file.type === 'image/jpeg' || file.type === 'image/png') ? URL.createObjectURL(file) : null
    )
  }

  /* ——— Validation par étape ——— */
  const phoneDigits = numeroEnvoi.replace(/[^\d+]/g, '')
  const errors = {
    nom: nom.trim().length < 2 ? 'Indique ton nom' : null,
    prenoms: prenoms.trim().length < 2 ? 'Indique tes prénoms' : null,
    email: !EMAIL_RE.test(email.trim()) ? 'Adresse email invalide' : null,
    emailConfirm:
      emailConfirm.trim().toLowerCase() !== email.trim().toLowerCase()
        ? 'Les deux emails ne correspondent pas'
        : null,
    lignes: lignes.some((l) => !isSizeAvailable(l.modele, l.version, l.manches, l.taille))
      ? 'Une taille choisie est épuisée'
      : null,
    moyen: !moyen
      ? 'Choisis ton opérateur'
      : depotNumbers.length === 0
        ? 'Aucun numéro disponible pour cet opérateur'
        : null,
    numero: !/^\+?\d{8,15}$/.test(phoneDigits) ? 'Numéro invalide (10 chiffres)' : null,
    capture: !capture ? 'Ajoute la capture de ton paiement' : checkCapture(capture),
    confirmation: !confirmation ? 'Coche la case pour confirmer' : null,
  }

  const stepValid = [
    !errors.lignes,
    !errors.nom && !errors.prenoms && !errors.email && !errors.emailConfirm,
    !errors.moyen && !errors.numero && !errors.capture,
    !errors.confirmation,
  ]

  const next = () => {
    if (!stepValid[step]) {
      setTouched(true)
      return
    }
    setStep((s) => Math.min(STEPS.length - 1, s + 1))
  }

  const handleSubmit = async () => {
    if (!stepValid.every(Boolean) || !capture || !moyen) {
      setTouched(true)
      return
    }
    setFormError(null)
    setSubmitting(true)
    try {
      const mail = email.trim().toLowerCase()
      const result = await createOrder({
        nom: nom.trim(),
        prenoms: prenoms.trim(),
        email: mail,
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
        numero_envoi: phoneDigits,
        reference_transaction: reference.trim() || undefined,
        capture,
        confirmation: true,
      })
      navigate('/confirmation', {
        state: { code: result.code_suivi, montant: result.montant_total, email: mail },
      })
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Erreur lors de l’envoi')
    } finally {
      setSubmitting(false)
    }
  }

  /* ——— États globaux ——— */
  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-accent" />
      </div>
    )
  }

  if (error || !catalogue) {
    return (
      <EmptyState
        icon={<AlertCircle className="h-7 w-7 text-red-500" />}
        title="Catalogue indisponible"
        text={error ?? 'Réessaie dans un instant.'}
      />
    )
  }

  if (!catalogue.ventes_ouvertes) {
    return (
      <EmptyState
        icon={<ShoppingBag className="h-7 w-7 text-slate-400" />}
        title="Les ventes sont fermées"
        text={
          catalogue.date_ouverture
            ? `Ouverture prévue le ${new Date(catalogue.date_ouverture).toLocaleDateString('fr-FR')}.`
            : 'Les commandes ne sont pas ouvertes pour le moment.'
        }
      />
    )
  }

  const show = (k: keyof typeof errors) => (touched ? errors[k] : null)

  return (
    <div className="pb-24">
      {/* En-tête */}
      <div className="border-b border-slate-200/70 bg-white">
        <div className="mx-auto max-w-7xl px-4 pb-8 pt-10 sm:px-6 lg:px-8">
          <h1 className="font-display text-3xl font-extrabold tracking-tight text-navy sm:text-4xl">
            Commander
          </h1>
          <p className="mt-2 max-w-2xl text-slate-500">
            Remplis le formulaire, paie par Mobile Money et joins la capture du paiement.
          </p>

          {/* Stepper */}
          <ol className="mt-8 grid grid-cols-4 gap-2 sm:gap-4">
            {STEPS.map((s, i) => {
              const done = i < step
              const active = i === step
              return (
                <li key={s.key}>
                  <button
                    type="button"
                    disabled={i > step}
                    onClick={() => setStep(i)}
                    className="group w-full text-left disabled:cursor-default"
                  >
                    <div
                      className={cn(
                        'h-1.5 rounded-full transition-colors',
                        done ? 'bg-accent' : active ? 'bg-navy' : 'bg-slate-200'
                      )}
                    />
                    <div className="mt-3 flex items-center gap-2.5">
                      <span
                        className={cn(
                          'flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold transition',
                          done
                            ? 'bg-accent text-white'
                            : active
                              ? 'bg-navy text-white'
                              : 'bg-slate-100 text-slate-400'
                        )}
                      >
                        {done ? <Check className="h-4 w-4" /> : <s.icon className="h-4 w-4" />}
                      </span>
                      <span
                        className={cn(
                          'hidden text-sm font-semibold sm:block',
                          active ? 'text-navy' : done ? 'text-slate-600' : 'text-slate-400'
                        )}
                      >
                        {s.label}
                      </span>
                    </div>
                  </button>
                </li>
              )
            })}
          </ol>
        </div>
      </div>

      <div className="mx-auto max-w-5xl px-4 pt-8 sm:px-6 lg:px-8">
        {/* ——— Colonne formulaire ——— */}
        <div className="min-w-0">
          <AnimatePresence mode="wait">
            <motion.div
              key={step}
              initial={{ opacity: 0, x: 24 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -24 }}
              transition={{ duration: 0.25 }}
            >
              {step === 1 && (
                <Panel
                  title="Tes informations"
                  subtitle="Ton email recevra l’accusé de réception et le code de suivi."
                >
                  <div className="grid gap-5 sm:grid-cols-2">
                    <Field label="Nom" error={show('nom')}>
                      <input
                        className="input-field"
                        value={nom}
                        onChange={(e) => setNom(e.target.value)}
                        placeholder="Kouassi"
                        maxLength={60}
                        autoComplete="family-name"
                      />
                    </Field>
                    <Field label="Prénoms" error={show('prenoms')}>
                      <input
                        className="input-field"
                        value={prenoms}
                        onChange={(e) => setPrenoms(e.target.value)}
                        placeholder="Aya Marie"
                        maxLength={80}
                        autoComplete="given-name"
                      />
                    </Field>
                    <Field label="Adresse email" error={show('email')}>
                      <input
                        type="email"
                        className="input-field"
                        value={email}
                        maxLength={254}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="prenom.nom@gmail.com"
                        autoComplete="email"
                      />
                    </Field>
                    <Field
                      label="Confirme l’email"
                      error={
                        show('emailConfirm') ||
                        (emailConfirm && errors.emailConfirm ? errors.emailConfirm : null)
                      }
                    >
                      <input
                        type="email"
                        className="input-field"
                        value={emailConfirm}
                        maxLength={254}
                        onChange={(e) => setEmailConfirm(e.target.value)}
                        onPaste={(e) => e.preventDefault()}
                        placeholder="Retape ton email"
                        autoComplete="off"
                      />
                    </Field>
                  </div>
                  <Notice>
                    Tu recevras ton code de suivi à cette adresse.
                  </Notice>
                </Panel>
              )}

              {step === 0 && (
                <Panel
                  title="Choisis tes polos"
                  subtitle={`Jusqu’à ${catalogue.quantite_max_par_ligne} polos par ligne. Ajoute une ligne pour chaque variante différente.`}
                >
                  <div className="space-y-5">
                    <AnimatePresence initial={false}>
                      {lignes.map((ligne, idx) => (
                        <motion.div
                          key={ligne.id}
                          layout
                          initial={{ opacity: 0, y: 12 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, scale: 0.97 }}
                        >
                          <LineEditor
                            index={idx}
                            ligne={ligne}
                            catalogue={catalogue}
                            canRemove={lignes.length > 1}
                            onChange={(p) => updateLine(ligne.id, p)}
                            onRemove={() => removeLine(ligne.id)}
                            isSizeAvailable={isSizeAvailable}
                          />
                        </motion.div>
                      ))}
                    </AnimatePresence>
                    <button
                      type="button"
                      onClick={() => setLignes((p) => [...p, emptyLine()])}
                      className="flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-slate-200 py-5 text-sm font-semibold text-slate-500 transition hover:border-accent hover:bg-brand-50/50 hover:text-accent"
                    >
                      <Plus className="h-4 w-4" />
                      Ajouter une autre variante
                    </button>
                    {show('lignes') && <ErrorText>{errors.lignes}</ErrorText>}
                    <div className="flex items-center justify-between rounded-2xl bg-slate-50 px-5 py-4">
                      <span className="text-sm text-slate-600">
                        Total · {nbPolos} polo{nbPolos > 1 ? 's' : ''}
                      </span>
                      <span className="font-display text-2xl font-extrabold text-navy">
                        {formatPrice(total)}
                      </span>
                    </div>
                  </div>
                </Panel>
              )}

              {step === 2 && (
                <Panel
                  title="Paiement Mobile Money"
                  subtitle="Choisis ton opérateur : le numéro officiel de la trésorerie s’affiche."
                >
                  {/* Opérateurs */}
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                    {catalogue.moyens_paiement.map((m) => {
                      const op = OPERATEURS[m.valeur]
                      const dispo = (numerosParMoyen[m.valeur]?.length ?? 0) > 0
                      const selected = moyen === m.valeur
                      return (
                        <button
                          key={m.valeur}
                          type="button"
                          disabled={!dispo}
                          onClick={() => setMoyen(m.valeur as MoyenPaiement)}
                          className={cn(
                            'relative flex flex-col items-center gap-2.5 rounded-2xl border-2 bg-white px-3 py-5 transition',
                            selected
                              ? 'shadow-card'
                              : 'border-slate-200 hover:border-slate-300',
                            !dispo && 'cursor-not-allowed opacity-45 grayscale'
                          )}
                          style={selected ? { borderColor: op?.ring } : undefined}
                        >
                          {selected && (
                            <span
                              className="absolute right-2 top-2 flex h-5 w-5 items-center justify-center rounded-full text-white"
                              style={{ background: op?.ring }}
                            >
                              <Check className="h-3 w-3" />
                            </span>
                          )}
                          <OperatorLogo moyen={m.valeur} className="h-14 w-14 rounded-2xl" />
                          <span className="text-sm font-semibold text-navy">{m.libelle}</span>
                          {!dispo && (
                            <span className="text-[10px] font-semibold uppercase text-slate-400">
                              Indisponible
                            </span>
                          )}
                        </button>
                      )
                    })}
                  </div>
                  {catalogue.numeros_depot.length === 0 && (
                    <div className="mt-4 flex gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
                      <Info className="mt-0.5 h-4 w-4 shrink-0" />
                      La trésorerie n’a pas encore publié ses numéros de paiement.
                      Reviens un peu plus tard.
                    </div>
                  )}
                  {show('moyen') && <ErrorText>{errors.moyen}</ErrorText>}

                  {/* Numéro de dépôt */}
                  <AnimatePresence mode="wait">
                    {moyen && depotNumbers.length > 0 && (
                      <motion.div
                        key={moyen}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        className="mt-6 rounded-2xl border border-slate-200"
                      >
                        <ul className="divide-y divide-slate-100">
                          {depotNumbers.map((d) => (
                            <li key={d.numero} className="flex items-center gap-4 px-5 py-4">
                              <OperatorLogo moyen={moyen} className="h-11 w-11" />
                              <div className="min-w-0 flex-1">
                                <p className="text-lg font-semibold tracking-wide text-navy">
                                  {formatPhone(d.numero)}
                                </p>
                                <p className="truncate text-sm text-slate-500">{d.titulaire}</p>
                              </div>
                              <CopyButton value={d.numero} label="Copier" />
                            </li>
                          ))}
                        </ul>
                        <p className="border-t border-slate-100 px-5 py-4 text-sm text-slate-600">
                          Envoie <b className="text-navy">{formatPrice(total)}</b> à ce numéro
                          par {OPERATEURS[moyen]?.nom}, puis ajoute la capture du paiement
                          ci-dessous.
                        </p>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Preuve */}
                  <div className="mt-8 grid gap-5 sm:grid-cols-2">
                    <Field label="Numéro utilisé pour payer" error={show('numero')}>
                      <div className="relative">
                        <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 border-r border-slate-200 pr-2.5 font-mono text-sm font-semibold text-slate-400">
                          +225
                        </span>
                        <input
                          inputMode="tel"
                          className="input-field !pl-[4.25rem] font-mono"
                          value={numeroEnvoi}
                          maxLength={20}
                          onChange={(e) => setNumeroEnvoi(e.target.value)}
                          placeholder="07 00 00 00 00"
                          autoComplete="tel"
                        />
                      </div>
                    </Field>
                    <Field label="Référence de transaction" hint="Facultatif">
                      <input
                        className="input-field font-mono"
                        value={reference}
                        maxLength={100}
                        onChange={(e) => setReference(e.target.value)}
                        placeholder="Ex. CI250612.1234.A56789"
                      />
                    </Field>
                  </div>

                  <div className="mt-5">
                    <Field label="Capture du paiement" error={show('capture')}>
                      <Dropzone file={capture} preview={preview} onChange={onCaptureChange} />
                    </Field>
                  </div>
                </Panel>
              )}

              {step === 3 && (
                <Panel title="Récapitulatif" subtitle="Relis ta commande avant de l’envoyer.">
                  {/* Polos */}
                  <RecapBlock title="Polos" onEdit={() => setStep(0)}>
                    <ul className="divide-y divide-slate-100">
                      {lignes.map((l) => {
                        const unit = getPrix(catalogue.tarifs, l.modele, l.version, l.manches)
                        return (
                          <li key={l.id} className="flex items-center gap-4 py-3">
                            <img
                              src={poloImage(l.modele, l.manches)}
                              alt=""
                              className="h-12 w-12 shrink-0 rounded-lg bg-slate-50 object-contain p-1"
                            />
                            <div className="min-w-0 flex-1 text-sm">
                              <p className="font-semibold text-navy">{libelle(catalogue, l)}</p>
                              <p className="text-slate-500">
                                Taille {l.taille} · {l.quantite} × {formatPrice(unit)}
                              </p>
                            </div>
                            <span className="text-sm font-semibold text-navy">
                              {formatPrice(unit * l.quantite)}
                            </span>
                          </li>
                        )
                      })}
                    </ul>
                    <div className="mt-2 flex items-baseline justify-between border-t border-slate-200 pt-4">
                      <span className="text-sm text-slate-500">
                        Total · {nbPolos} polo{nbPolos > 1 ? 's' : ''}
                      </span>
                      <span className="font-display text-2xl font-extrabold text-navy">
                        {formatPrice(total)}
                      </span>
                    </div>
                  </RecapBlock>

                  <div className="mt-4 grid gap-4 sm:grid-cols-2">
                    <RecapBlock title="Identité" onEdit={() => setStep(1)}>
                      <p className="font-semibold text-navy">
                        {nom} {prenoms}
                      </p>
                      <p className="text-sm text-slate-500">{email}</p>
                    </RecapBlock>
                    <RecapBlock title="Paiement" onEdit={() => setStep(2)}>
                      <div className="flex items-center gap-3">
                        {moyen && <OperatorLogo moyen={moyen} className="h-9 w-9 rounded-lg" />}
                        <div className="min-w-0 text-sm">
                          <p className="font-semibold text-navy">
                            {moyen && OPERATEURS[moyen]?.nom} · depuis le {formatPhone(phoneDigits)}
                          </p>
                          <p className="flex items-center gap-1.5 truncate text-slate-500">
                            <FileText className="h-3.5 w-3.5 shrink-0" /> {capture?.name}
                          </p>
                        </div>
                      </div>
                      {reference && (
                        <p className="mt-2 text-sm text-slate-500">Référence : {reference}</p>
                      )}
                    </RecapBlock>
                  </div>

                  {/* Règles à confirmer */}
                  <div className="mt-6 rounded-2xl border border-slate-200 p-5">
                    <p className="text-sm font-semibold text-navy">En envoyant ma commande, je confirme que :</p>
                    <ul className="mt-3 list-disc space-y-1.5 pl-5 text-sm text-slate-600">
                      <li>
                        j’ai envoyé exactement <b className="text-navy">{formatPrice(total)}</b> par{' '}
                        {moyen && OPERATEURS[moyen]?.nom}
                        {depotNumbers[0] && <> au {formatPhone(depotNumbers[0].numero)}</>} ;
                      </li>
                      <li>la capture jointe correspond bien à ce paiement ;</li>
                      <li>mes informations et ma taille sont exactes ;</li>
                      <li>une commande dont le paiement est introuvable sera refusée ;</li>
                      <li>je récupère mes polos sur le campus quand je suis prévenu par email.</li>
                    </ul>
                    <label className="mt-4 flex cursor-pointer items-center gap-3 border-t border-slate-100 pt-4">
                      <input
                        type="checkbox"
                        checked={confirmation}
                        onChange={(e) => setConfirmation(e.target.checked)}
                        className="h-5 w-5 rounded border-slate-300 text-navy focus:ring-navy"
                      />
                      <span className="text-sm font-semibold text-navy">J’ai lu et je confirme</span>
                    </label>
                  </div>
                  {show('confirmation') && <ErrorText>{errors.confirmation}</ErrorText>}

                  {formError && (
                    <div className="mt-4 flex items-start gap-2 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
                      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                      {formError}
                    </div>
                  )}
                </Panel>
              )}
            </motion.div>
          </AnimatePresence>

          {/* Navigation */}
          <div className="mt-6 flex items-center justify-between gap-3">
            {step > 0 ? (
              <button type="button" onClick={() => setStep((s) => s - 1)} className="btn-secondary">
                <ArrowLeft className="h-4 w-4" /> Retour
              </button>
            ) : (
              <Link to="/" className="btn-ghost">
                Annuler
              </Link>
            )}
            {step < STEPS.length - 1 ? (
              <button type="button" onClick={next} className="btn-dark !px-7">
                Continuer <ArrowRight className="h-4 w-4" />
              </button>
            ) : (
              <button
                type="button"
                onClick={handleSubmit}
                disabled={submitting}
                className="btn-primary !px-7 !py-3.5"
              >
                {submitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" /> Envoi…
                  </>
                ) : (
                  <>
                    <Lock className="h-4 w-4" /> Envoyer ma commande
                  </>
                )}
              </button>
            )}
          </div>
        </div>

      </div>
    </div>
  )
}

/* ——————————————————— Sous-composants ——————————————————— */

function libelle(c: Catalogue, l: LigneCommande) {
  const f = (arr: { valeur: string; libelle: string }[], v: string) =>
    arr.find((x) => x.valeur === v)?.libelle ?? v
  return `${f(c.modeles, l.modele)} · ${f(c.versions, l.version)} · ${court(f(c.manches, l.manches))}`
}

/** "Manches courtes" → "Courtes" */
function court(s: string) {
  const t = s.replace(/^Manches\s+/i, '')
  return t.charAt(0).toUpperCase() + t.slice(1)
}

function Panel({
  title,
  subtitle,
  children,
}: {
  title: string
  subtitle?: string
  children: React.ReactNode
}) {
  return (
    <section className="rounded-3xl border border-slate-200/70 bg-white p-6 shadow-soft sm:p-8">
      <h2 className="font-display text-xl font-bold text-navy sm:text-2xl">{title}</h2>
      {subtitle && <p className="mt-1.5 text-sm text-slate-500">{subtitle}</p>}
      <div className="mt-7">{children}</div>
    </section>
  )
}

function Field({
  label,
  hint,
  error,
  children,
}: {
  label: string
  hint?: string
  error?: string | null
  children: React.ReactNode
}) {
  return (
    <div>
      <label className="label">
        {label}
        {hint && <span className="ml-1.5 font-normal text-slate-400">{hint}</span>}
      </label>
      {children}
      {error && <ErrorText>{error}</ErrorText>}
    </div>
  )
}

function ErrorText({ children }: { children: React.ReactNode }) {
  return (
    <p className="mt-1.5 flex items-center gap-1 text-xs font-medium text-red-600">
      <AlertCircle className="h-3.5 w-3.5" />
      {children}
    </p>
  )
}

function Notice({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-6 flex gap-3 rounded-2xl bg-brand-50 p-4 text-sm text-brand-900">
      <Info className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
      <p>{children}</p>
    </div>
  )
}

function Segmented({
  options,
  value,
  onChange,
  extra,
}: {
  options: { valeur: string; libelle: string }[]
  value: string
  onChange: (v: string) => void
  extra?: (v: string) => React.ReactNode
}) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {options.map((o) => {
        const active = o.valeur === value
        return (
          <button
            key={o.valeur}
            type="button"
            onClick={() => onChange(o.valeur)}
            className={cn(
              'rounded-xl border-2 px-3 py-2.5 text-left transition',
              active
                ? 'border-accent bg-brand-50 text-navy'
                : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
            )}
          >
            <span className="block text-sm font-semibold">{court(o.libelle)}</span>
            {extra && <span className="block text-[11px] text-slate-500">{extra(o.valeur)}</span>}
          </button>
        )
      })}
    </div>
  )
}

function LineEditor({
  index,
  ligne,
  catalogue,
  canRemove,
  onChange,
  onRemove,
  isSizeAvailable,
}: {
  index: number
  ligne: LigneCommande
  catalogue: Catalogue
  canRemove: boolean
  onChange: (p: Partial<LigneCommande>) => void
  onRemove: () => void
  isSizeAvailable: (m: string, v: string, ma: string, t: string) => boolean
}) {
  const unit = getPrix(catalogue.tarifs, ligne.modele, ligne.version, ligne.manches)
  const max = catalogue.quantite_max_par_ligne

  return (
    <div className="rounded-2xl border border-slate-200 bg-[#FAFBFD] p-5">
      <div className="flex items-start gap-5">
        <div className="hidden h-28 w-24 shrink-0 items-center justify-center rounded-2xl bg-white shadow-soft sm:flex">
          <img
            src={poloImage(ligne.modele, ligne.manches)}
            alt=""
            className="h-24 w-20 object-contain"
          />
        </div>
        <div className="min-w-0 flex-1">
          <div className="mb-4 flex items-center justify-between">
            <p className="font-display text-sm font-bold text-navy">Polo n°{index + 1}</p>
            <div className="flex items-center gap-3">
              <span className="font-display text-lg font-extrabold text-navy">
                {formatPrice(unit * ligne.quantite)}
              </span>
              {canRemove && (
                <button
                  type="button"
                  onClick={onRemove}
                  className="rounded-lg p-1.5 text-slate-400 transition hover:bg-red-50 hover:text-red-500"
                  aria-label="Supprimer"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <p className="label">Cycle</p>
              <Segmented
                options={catalogue.modeles}
                value={ligne.modele}
                onChange={(v) => onChange({ modele: v as Modele })}
                extra={(v) => `Polo ${COULEUR_CYCLE[v]?.toLowerCase() ?? ''}`}
              />
            </div>
            <div>
              <p className="label">Finition</p>
              <Segmented
                options={catalogue.versions}
                value={ligne.version}
                onChange={(v) => onChange({ version: v as Version })}
              />
            </div>
            <div>
              <p className="label">Manches</p>
              <Segmented
                options={catalogue.manches}
                value={ligne.manches}
                onChange={(v) => onChange({ manches: v as Manches })}
                extra={(v) => formatPrice(getPrix(catalogue.tarifs, ligne.modele, ligne.version, v))}
              />
            </div>
          </div>

          <div className="mt-5 flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="label">Taille</p>
              <div className="flex flex-wrap gap-2">
                {catalogue.tailles.map((t) => {
                  const ok = isSizeAvailable(ligne.modele, ligne.version, ligne.manches, t.valeur)
                  const selected = ligne.taille === t.valeur
                  return (
                    <button
                      key={t.valeur}
                      type="button"
                      disabled={!ok}
                      onClick={() => onChange({ taille: t.valeur as Taille })}
                      title={ok ? t.libelle : 'Épuisé'}
                      className={cn(
                        'h-11 min-w-[3rem] rounded-xl border-2 px-3 text-sm font-bold transition',
                        selected && ok
                          ? 'border-navy bg-navy text-white'
                          : ok
                            ? 'border-slate-200 bg-white text-navy hover:border-navy'
                            : 'cursor-not-allowed border-slate-100 bg-slate-50 text-slate-300 line-through'
                      )}
                    >
                      {t.libelle}
                    </button>
                  )
                })}
              </div>
            </div>
            <div>
              <p className="label">Quantité</p>
              <div className="flex h-11 items-center rounded-xl border-2 border-slate-200 bg-white">
                <button
                  type="button"
                  disabled={ligne.quantite <= 1}
                  onClick={() => onChange({ quantite: ligne.quantite - 1 })}
                  className="flex h-full w-10 items-center justify-center text-slate-500 hover:text-navy disabled:opacity-30"
                  aria-label="Moins"
                >
                  <Minus className="h-4 w-4" />
                </button>
                <span className="w-8 text-center font-display font-bold text-navy">
                  {ligne.quantite}
                </span>
                <button
                  type="button"
                  disabled={ligne.quantite >= max}
                  onClick={() => onChange({ quantite: ligne.quantite + 1 })}
                  className="flex h-full w-10 items-center justify-center text-slate-500 hover:text-navy disabled:opacity-30"
                  aria-label="Plus"
                >
                  <Plus className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
          {!isSizeAvailable(ligne.modele, ligne.version, ligne.manches, ligne.taille) && (
            <ErrorText>Cette taille est épuisée pour cette variante.</ErrorText>
          )}
        </div>
      </div>
    </div>
  )
}

function Dropzone({
  file,
  preview,
  onChange,
}: {
  file: File | null
  preview: string | null
  onChange: (f: File | null) => void
}) {
  const [drag, setDrag] = useState(false)

  if (file) {
    return (
      <div className="flex items-center gap-4 rounded-2xl border-2 border-emerald-200 bg-emerald-50/50 p-4">
        {preview ? (
          <img src={preview} alt="Aperçu" className="h-20 w-20 rounded-xl object-cover" />
        ) : (
          <div className="flex h-20 w-20 items-center justify-center rounded-xl bg-white">
            <FileText className="h-8 w-8 text-slate-400" />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-navy">{file.name}</p>
          <p className="text-xs text-slate-500">{(file.size / 1024).toFixed(0)} Ko</p>
          <p className="mt-1 flex items-center gap-1 text-xs font-semibold text-emerald-700">
            <Check className="h-3.5 w-3.5" /> Prêt à envoyer
          </p>
        </div>
        <button
          type="button"
          onClick={() => onChange(null)}
          className="rounded-lg p-2 text-slate-400 hover:bg-white hover:text-red-500"
          aria-label="Retirer"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    )
  }

  return (
    <label
      onDragOver={(e) => {
        e.preventDefault()
        setDrag(true)
      }}
      onDragLeave={() => setDrag(false)}
      onDrop={(e) => {
        e.preventDefault()
        setDrag(false)
        onChange(e.dataTransfer.files?.[0] ?? null)
      }}
      className={cn(
        'flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed px-6 py-10 text-center transition',
        drag ? 'border-accent bg-brand-50' : 'border-slate-300 bg-slate-50/60 hover:border-accent hover:bg-brand-50/50'
      )}
    >
      <input
        type="file"
        accept="image/jpeg,image/png,application/pdf"
        className="hidden"
        onChange={(e) => onChange(e.target.files?.[0] ?? null)}
      />
      <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-accent shadow-soft">
        <UploadCloud className="h-6 w-6" />
      </span>
      <p className="mt-3 text-sm font-semibold text-navy">
        Glisse ta capture ici ou <span className="text-accent underline">parcours</span>
      </p>
      <p className="mt-1 text-xs text-slate-500">JPG, PNG ou PDF · 5 Mo maximum</p>
    </label>
  )
}

function CopyButton({ value, label, dark }: { value: string; label: string; dark?: boolean }) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value)
          setCopied(true)
          setTimeout(() => setCopied(false), 1800)
        } catch {
          /* ignore */
        }
      }}
      className={cn(
        'inline-flex items-center gap-2 rounded-xl px-3.5 py-2 text-sm font-semibold transition',
        dark ? 'bg-white/10 text-white hover:bg-white/20' : 'text-slate-500 hover:bg-slate-100 hover:text-navy'
      )}
    >
      {copied ? <Check className="h-4 w-4 text-lime" /> : <Copy className="h-4 w-4" />}
      {label && (copied ? 'Copié' : label)}
    </button>
  )
}

function RecapBlock({
  title,
  onEdit,
  children,
  className,
}: {
  title: string
  onEdit: () => void
  children: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn('rounded-2xl border border-slate-200 p-4', className)}>
      <div className="mb-2 flex items-center justify-between">
        <p className="text-xs font-bold uppercase tracking-wide text-slate-400">{title}</p>
        <button type="button" onClick={onEdit} className="text-xs font-semibold text-accent hover:underline">
          Modifier
        </button>
      </div>
      {children}
    </div>
  )
}

function EmptyState({ icon, title, text }: { icon: React.ReactNode; title: string; text: string }) {
  return (
    <div className="mx-auto max-w-md px-4 py-24 text-center">
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-white shadow-soft">
        {icon}
      </div>
      <h1 className="mt-5 font-display text-2xl font-bold text-navy">{title}</h1>
      <p className="mt-2 text-slate-500">{text}</p>
      <Link to="/" className="btn-secondary mt-6">
        Retour à l’accueil
      </Link>
    </div>
  )
}
