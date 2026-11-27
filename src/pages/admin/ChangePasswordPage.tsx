import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Loader2, Eye, EyeOff, Check, ArrowLeft } from 'lucide-react'
import { useAuth } from '@/lib/auth'
import { ApiError } from '@/lib/api'
import { cn } from '@/lib/utils'
import Logo from '@/components/Logo'

interface Props {
  /** Première connexion : écran plein, impossible d'accéder à la gestion avant. */
  obligatoire?: boolean
}

export default function ChangePasswordPage({ obligatoire = false }: Props) {
  const { user, changePassword, logout } = useAuth()
  const navigate = useNavigate()
  const [ancien, setAncien] = useState('')
  const [nouveau, setNouveau] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [voir, setVoir] = useState(false)
  const [envoi, setEnvoi] = useState(false)
  const [erreur, setErreur] = useState<string | null>(null)
  const [erreursChamps, setErreursChamps] = useState<Record<string, string>>({})
  const [fait, setFait] = useState(false)

  // Règles vérifiées pendant la saisie (le serveur applique aussi les siennes)
  const regles = [
    { ok: nouveau.length >= 8, texte: 'Au moins 8 caractères' },
    { ok: /\D/.test(nouveau) && nouveau.length > 0, texte: 'Pas uniquement des chiffres' },
    { ok: nouveau.length > 0 && nouveau !== ancien, texte: 'Différent du mot de passe actuel' },
    { ok: confirmation.length > 0 && confirmation === nouveau, texte: 'Les deux saisies sont identiques' },
  ]
  const valide = ancien.length > 0 && regles.every((r) => r.ok)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!valide) return
    setErreur(null)
    setErreursChamps({})
    setEnvoi(true)
    try {
      await changePassword(ancien, nouveau)
      setFait(true)
      if (!obligatoire) setTimeout(() => navigate('/admin'), 1200)
    } catch (err) {
      if (err instanceof ApiError && Object.keys(err.erreurs).length) {
        setErreursChamps(err.erreurs)
      } else {
        setErreur(err instanceof Error ? err.message : 'Changement impossible')
      }
    } finally {
      setEnvoi(false)
    }
  }

  const champ = (
    id: string,
    label: string,
    value: string,
    onChange: (v: string) => void,
    autoComplete: string,
    erreurServeur?: string
  ) => (
    <div>
      <label className="label" htmlFor={id}>
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          type={voir ? 'text' : 'password'}
          className={cn('input-field !py-3.5 !pr-11', erreurServeur && '!border-red-300')}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          autoComplete={autoComplete}
          maxLength={128}
          required
        />
        <button
          type="button"
          onClick={() => setVoir((v) => !v)}
          className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 text-slate-400 hover:text-navy"
          aria-label={voir ? 'Masquer les mots de passe' : 'Afficher les mots de passe'}
        >
          {voir ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
      {erreurServeur && <p className="mt-1.5 text-sm text-red-600">{erreurServeur}</p>}
    </div>
  )

  const formulaire = fait ? (
    <div className="text-center">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500 text-white">
        <Check className="h-7 w-7" strokeWidth={3} />
      </div>
      <h1 className="mt-5 font-display text-2xl font-extrabold text-navy">Mot de passe modifié</h1>
      <p className="mt-2 text-slate-500">
        {obligatoire ? 'Votre compte est prêt.' : 'Retour au tableau de bord…'}
      </p>
      {obligatoire && (
        <Link to="/admin" className="btn-dark mt-8 w-full !py-3.5">
          Accéder au tableau de bord
        </Link>
      )}
    </div>
  ) : (
    <>
      <h1 className="font-display text-3xl font-extrabold tracking-tight text-navy">
        {obligatoire ? 'Nouveau mot de passe' : 'Changer mon mot de passe'}
      </h1>
      <p className="mt-2 text-slate-500">
        {obligatoire
          ? `Bienvenue${user?.first_name ? ` ${user.first_name}` : ''}. Pour votre première connexion, remplacez le mot de passe provisoire par le vôtre.`
          : 'Saisissez votre mot de passe actuel, puis le nouveau.'}
      </p>

      <form onSubmit={handleSubmit} className="mt-10 space-y-5">
        {champ(
          'ancien',
          obligatoire ? 'Mot de passe provisoire' : 'Mot de passe actuel',
          ancien,
          setAncien,
          'current-password',
          erreursChamps.ancien_mot_de_passe
        )}
        {champ(
          'nouveau',
          'Nouveau mot de passe',
          nouveau,
          setNouveau,
          'new-password',
          erreursChamps.nouveau_mot_de_passe
        )}
        {champ('confirmation', 'Confirmer le nouveau mot de passe', confirmation, setConfirmation, 'new-password')}

        <ul className="space-y-1.5 text-sm">
          {regles.map((r) => (
            <li
              key={r.texte}
              className={cn('flex items-center gap-2', r.ok ? 'text-emerald-600' : 'text-slate-400')}
            >
              <Check className={cn('h-4 w-4', !r.ok && 'opacity-30')} />
              {r.texte}
            </li>
          ))}
        </ul>

        {erreur && <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{erreur}</p>}

        <button type="submit" disabled={!valide || envoi} className="btn-dark w-full !py-3.5">
          {envoi ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Enregistrer le mot de passe'}
        </button>
      </form>
    </>
  )

  // Depuis le tableau de bord : carte avec photo d'un côté et formulaire de l'autre
  if (!obligatoire) {
    return (
      <div className="mx-auto max-w-5xl">
        <Link
          to="/admin"
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-500 hover:text-navy"
        >
          <ArrowLeft className="h-4 w-4" /> Tableau de bord
        </Link>
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-6 grid overflow-hidden rounded-3xl border border-slate-200 shadow-soft md:grid-cols-2"
        >
          <div className="relative h-48 md:h-auto">
            <img
              src="/images/campus/accord.jpg"
              alt="Deux étudiants de l’ESATIC en polo"
              className="absolute inset-0 h-full w-full object-cover object-[35%_center]"
            />
          </div>
          <div className="px-6 py-10 sm:px-10">{formulaire}</div>
        </motion.div>
      </div>
    )
  }

  // Première connexion : même présentation que la page de connexion
  return (
    <div className="grid min-h-screen bg-white lg:grid-cols-2">
      <div className="relative hidden lg:block">
        <img
          src="/images/campus/tresoriere.jpg"
          alt="Étudiante de l’ESATIC en polo bleu"
          className="absolute inset-0 h-full w-full object-cover object-[45%_30%]"
        />
      </div>
      <div className="flex flex-col px-6 py-8 sm:px-12">
        <div className="flex items-center justify-between">
          <Logo className="h-14" />
          <button
            type="button"
            onClick={() => logout()}
            className="text-sm font-semibold text-slate-500 hover:text-navy"
          >
            Se déconnecter
          </button>
        </div>
        <div className="flex flex-1 items-center justify-center py-12">
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-sm">
            {formulaire}
          </motion.div>
        </div>
      </div>
    </div>
  )
}
