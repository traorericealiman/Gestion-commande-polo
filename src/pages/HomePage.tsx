import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ArrowRight, ShieldCheck, Package, CreditCard, Clock } from 'lucide-react'

const polos = [
  {
    src: '/images/Polo3_ESATIC.png',
    alt: 'Polo blanc manches courtes',
    label: 'Blanc · Manches courtes',
  },
  {
    src: '/images/Polo4_ESATIC.png',
    alt: 'Polo blanc manches longues',
    label: 'Blanc · Manches longues',
  },
  {
    src: '/images/IMG_4873.PNG',
    alt: 'Polo bleu manches courtes',
    label: 'Bleu · Manches courtes',
  },
  {
    src: '/images/IMG_4874.PNG',
    alt: 'Polo bleu manches longues',
    label: 'Bleu · Manches longues',
  },
]

const steps = [
  {
    icon: Package,
    title: 'Choisis tes polos',
    desc: 'Licence ou Master, simple ou brodé, manches courtes ou longues.',
  },
  {
    icon: CreditCard,
    title: 'Paye en Mobile Money',
    desc: 'Wave, Orange, MTN ou Moov. Dépose puis joins la capture.',
  },
  {
    icon: ShieldCheck,
    title: 'Vérification trésorière',
    desc: 'Une trésorière valide ton paiement avant toute remise.',
  },
  {
    icon: Clock,
    title: 'Retrait sur campus',
    desc: 'Tu reçois un email dès que tes polos sont prêts.',
  },
]

const prices = [
  { label: 'Simple · Courtes', price: '6 000' },
  { label: 'Simple · Longues', price: '8 000' },
  { label: 'Brodé · Courtes', price: '8 000' },
  { label: 'Brodé · Longues', price: '10 000' },
]

export default function HomePage() {
  return (
    <div>
      {/* Hero */}
      <section className="relative overflow-hidden bg-navy text-white">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-accent/30 via-transparent to-transparent" />
        <div className="absolute -right-20 -top-20 h-72 w-72 rounded-full bg-accent/20 blur-3xl" />
        <div className="relative mx-auto grid max-w-6xl gap-10 px-4 py-16 sm:px-6 sm:py-24 lg:grid-cols-2 lg:items-center lg:gap-16">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <span className="mb-4 inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-white/90 backdrop-blur">
            
              
            </span>
            <h1 className="font-display text-3xl font-bold leading-tight tracking-tight sm:text-4xl lg:text-5xl">
              Les polos ESATIC,
              <br />
              <span className="text-brand-300">officiels &amp; vérifiés</span>
            </h1>
            <p className="mt-4 max-w-md text-base text-white/75 sm:text-lg">
              Commande en ligne, paie en Mobile Money, et récupère tes polos
              après validation par une trésorière. Zéro erreur, zéro attente inutile.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link to="/commander" className="btn-primary !bg-white !text-navy hover:!bg-brand-50">
                Commander maintenant
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                to="/suivi"
                className="inline-flex items-center gap-2 rounded-xl border border-white/20 bg-white/5 px-5 py-3 text-sm font-semibold text-white backdrop-blur transition hover:bg-white/10"
              >
                Suivre ma commande
              </Link>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="relative hidden lg:block"
          >
            <div className="relative mx-auto max-w-md">
              <img
                src="/images/Polo4_ESATIC.png"
                alt="Polo ESATIC"
                className="relative z-10 w-full drop-shadow-2xl"
              />
              <div className="absolute -bottom-4 left-1/2 h-8 w-3/4 -translate-x-1/2 rounded-full bg-black/30 blur-xl" />
            </div>
          </motion.div>
        </div>
      </section>

      {/* Price grid */}
      <section className="border-b border-slate-100 bg-white">
        <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
          <div className="mb-6 flex items-end justify-between gap-4">
            <div>
              <h2 className="section-title">Tarifs (FCFA)</h2>
              <p className="mt-1 text-sm text-slate-500">
                Identiques pour Licence et Master
              </p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {prices.map((p) => (
              <div
                key={p.label}
                className="rounded-2xl border border-slate-100 bg-slate-50/80 px-4 py-5 text-center transition hover:border-brand-200 hover:bg-brand-50/50"
              >
                <p className="text-xs font-medium text-slate-500">{p.label}</p>
                <p className="mt-1 font-display text-xl font-bold text-navy">
                  {p.price}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Gallery */}
      <section className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
        <h2 className="section-title mb-2">Les modèles</h2>
        <p className="mb-8 max-w-lg text-sm text-slate-500">
          Blanc ou bleu, manches courtes ou longues. Logo ESATIC devant, logo
          Association au dos.
        </p>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {polos.map((polo, i) => (
            <motion.div
              key={polo.src}
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.05 }}
              className="group overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-soft"
            >
              <div className="aspect-[4/5] overflow-hidden bg-slate-50">
                <img
                  src={polo.src}
                  alt={polo.alt}
                  className="h-full w-full object-contain p-4 transition duration-300 group-hover:scale-105"
                  loading="lazy"
                />
              </div>
              <div className="border-t border-slate-50 px-4 py-3">
                <p className="text-sm font-medium text-navy">{polo.label}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="bg-slate-50/80">
        <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
          <h2 className="section-title mb-2">Comment ça marche</h2>
          <p className="mb-10 max-w-lg text-sm text-slate-500">
            Un parcours simple, avec contrôle humain à chaque étape.
          </p>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {steps.map((s, i) => (
              <div key={s.title} className="card relative">
                <span className="absolute right-4 top-4 font-display text-3xl font-bold text-slate-100">
                  {i + 1}
                </span>
                <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-accent/10 text-accent">
                  <s.icon className="h-5 w-5" />
                </div>
                <h3 className="font-semibold text-navy">{s.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-slate-500">
                  {s.desc}
                </p>
              </div>
            ))}
          </div>
          <div className="mt-10 text-center">
            <Link to="/commander" className="btn-primary">
              Passer ma commande
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>
    </div>
  )
}
