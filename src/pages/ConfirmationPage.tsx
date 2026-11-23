import { Link, useLocation, Navigate } from 'react-router-dom'
import { CheckCircle2, Copy, Check } from 'lucide-react'
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

  if (!state?.code) {
    return <Navigate to="/" replace />
  }

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
    <div className="mx-auto max-w-md px-4 py-16 text-center sm:px-6">
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100">
        <CheckCircle2 className="h-8 w-8 text-emerald-600" />
      </div>
      <h1 className="mt-6 font-display text-2xl font-bold text-navy">
        Commande enregistrée
      </h1>
      <p className="mt-2 text-sm text-slate-500">
        Un accusé de réception a été envoyé à{' '}
        <span className="font-medium text-navy">{state.email}</span>.
      </p>

      <div className="card mt-8 text-left">
        <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
          Code de suivi
        </p>
        <div className="mt-2 flex items-center justify-between gap-3">
          <span className="font-mono text-xl font-bold tracking-wide text-navy">
            {state.code}
          </span>
          <button type="button" onClick={copyCode} className="btn-secondary !px-3 !py-2">
            {copied ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
          </button>
        </div>
        <p className="mt-4 text-sm text-slate-600">
          Montant déclaré :{' '}
          <strong className="text-navy">{formatPrice(state.montant)}</strong>
        </p>
        <p className="mt-2 text-xs leading-relaxed text-slate-400">
          Ta commande est en attente de vérification. Une trésorière examinera
          ta capture sous peu. Conserve ton code pour le suivi.
        </p>
      </div>

      <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
        <Link to="/suivi" className="btn-primary">
          Suivre ma commande
        </Link>
        <Link to="/" className="btn-secondary">
          Retour à l’accueil
        </Link>
      </div>
    </div>
  )
}
