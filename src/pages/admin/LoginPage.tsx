import { useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Loader2, Eye, EyeOff } from 'lucide-react'
import { useAuth } from '@/lib/auth'
import Logo from '@/components/Logo'

export default function LoginPage() {
  const { user, loading, login } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPwd, setShowPwd] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  if (!loading && user) return <Navigate to="/admin" replace />

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      await login(email.trim(), password)
      navigate('/admin', { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Identifiants incorrects')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="grid min-h-screen bg-white lg:grid-cols-2">
      {/* Photo */}
      <div className="relative hidden lg:block">
        <img
          src="/images/campus/tresoriere.jpg"
          alt="Étudiante de l’ESATIC en polo bleu"
          className="absolute inset-0 h-full w-full object-cover object-[45%_30%]"
        />
      </div>

      {/* Formulaire */}
      <div className="flex flex-col px-6 py-8 sm:px-12">
        <div className="flex items-center justify-between">
          <Link to="/" aria-label="Accueil">
            <Logo className="h-14" />
          </Link>
          <Link to="/" className="text-sm font-semibold text-slate-500 hover:text-navy">
            Retour au site
          </Link>
        </div>

        <div className="flex flex-1 items-center justify-center py-12">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="w-full max-w-sm"
          >
            <h1 className="font-display text-3xl font-extrabold tracking-tight text-navy">Connexion</h1>
            <p className="mt-2 text-slate-500">Accès réservé à l’équipe de l’A2E.</p>

            <form onSubmit={handleSubmit} className="mt-10 space-y-5">
              <div>
                <label className="label" htmlFor="email">
                  Email
                </label>
                <input
                  id="email"
                  type="email"
                  className="input-field !py-3.5"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="username"
                  required
                />
              </div>
              <div>
                <label className="label" htmlFor="password">
                  Mot de passe
                </label>
                <div className="relative">
                  <input
                    id="password"
                    type={showPwd ? 'text' : 'password'}
                    className="input-field !py-3.5 !pr-11"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="current-password"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPwd((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 text-slate-400 hover:text-navy"
                    aria-label={showPwd ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
                  >
                    {showPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {error && <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}

              <button type="submit" disabled={submitting} className="btn-dark w-full !py-3.5">
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Se connecter'}
              </button>
            </form>
          </motion.div>
        </div>
      </div>
    </div>
  )
}
