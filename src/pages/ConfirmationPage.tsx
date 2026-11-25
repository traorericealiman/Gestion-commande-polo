import { Link, useLocation, Navigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Check, Copy } from 'lucide-react'
import { useState } from 'react'
import { formatPrice } from '@/lib/api'

interface State {
  code: string
  montant: number
  email: string
}

export default function ConfirmationPage() {
  const location = useLocation()
  const state = location.state as State | null
  const [copied, setCopied] = useState(false)

  if (!state?.code) return <Navigate to="/" replace />

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(state.code)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      /* ignore */
    }
  }

  return (
    <div className="mx-auto max-w-xl px-5 py-20 text-center">
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ type: 'spring', stiffness: 220, damping: 16 }}
        className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500 text-white"
      >
        <Check className="h-8 w-8" strokeWidth={3} />
      </motion.div>
      <h1 className="mt-6 font-display text-3xl font-extrabold tracking-tight text-navy">
        Merci, ta commande est enregistrée
      </h1>
      <p className="mt-3 text-slate-600">
        Montant : <b className="text-navy">{formatPrice(state.montant)}</b>. Un email de
        confirmation a été envoyé à <b className="text-navy">{state.email}</b>.
      </p>

      <div className="mt-10 rounded-2xl border border-slate-200 p-6">
        <p className="text-sm text-slate-500">Ton code de suivi</p>
        <div className="mt-2 flex items-center justify-center gap-3">
          <span className="font-mono text-2xl font-semibold tracking-wider text-navy sm:text-3xl">
            {state.code}
          </span>
          <button
            type="button"
            onClick={copyCode}
            className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-navy"
            aria-label="Copier le code"
          >
            {copied ? <Check className="h-5 w-5 text-emerald-600" /> : <Copy className="h-5 w-5" />}
          </button>
        </div>
        <p className="mt-3 text-sm text-slate-500">
          Garde-le : il te permet de suivre ta commande avec ton email.
        </p>
      </div>

      <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
        <Link to={`/suivi?code=${encodeURIComponent(state.code)}`} className="btn-dark">
          Suivre ma commande
        </Link>
        <Link to="/" className="btn-secondary">
          Retour à l’accueil
        </Link>
      </div>
    </div>
  )
}
