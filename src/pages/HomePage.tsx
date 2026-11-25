import { useState } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ArrowRight } from 'lucide-react'
import { useCatalogue } from '@/hooks/useCatalogue'
import { getPrix } from '@/lib/api'
import { cn } from '@/lib/utils'
import { POLO_IMAGES } from '@/lib/polos'
import OperatorLogo from '@/components/OperatorLogo'

const nf = new Intl.NumberFormat('fr-FR')

const cycles = [
  {
    modele: 'LICENCE',
    titre: 'Licence',
    couleur: 'Bleu',
    pastille: '#1E3FB4',
    texte: 'Le polo bleu, pour les étudiants en Licence.',
  },
  {
    modele: 'MASTER',
    titre: 'Master',
    couleur: 'Blanc',
    pastille: '#FFFFFF',
    texte: 'Le polo blanc, pour les étudiants en Master.',
  },
] as const

const etapes = [
  { titre: 'Choisis ton polo', texte: 'Licence ou Master, simple ou brodé, manches courtes ou longues, et ta taille.' },
  { titre: 'Paie par Mobile Money', texte: 'Wave, Orange Money, MTN ou Moov. Le numéro s’affiche selon ton opérateur.' },
  { titre: 'Envoie ta capture', texte: 'Ajoute la capture du paiement à ta commande. Tu reçois un code de suivi par email.' },
  { titre: 'Récupère ton polo', texte: 'On te prévient par email dès qu’il est prêt à être retiré sur le campus.' },
]

const reveal = {
  initial: { opacity: 0, y: 16 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: '-60px' },
  transition: { duration: 0.5 },
}

export default function HomePage() {
  const { data: catalogue } = useCatalogue()

  const prix = (version: string, manches: string) =>
    catalogue ? getPrix(catalogue.tarifs, 'LICENCE', version, manches) : null


  return (
    <div>
      {/* ——— Accueil ——— */}
      <section className="mx-auto grid max-w-[1440px] gap-12 px-5 pb-20 pt-10 sm:px-8 lg:px-12 lg:min-h-[calc(100vh-72px)] lg:grid-cols-[1fr_1.15fr] lg:items-center lg:gap-16 lg:py-12">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <h1 className="font-display text-5xl font-extrabold leading-[1.05] tracking-tight text-navy sm:text-6xl xl:text-7xl">
            Le polo officiel
            <br />
            de l’<span className="text-brand-600">ESATIC</span>.
          </h1>

          <div className="mt-10 flex flex-wrap items-center gap-6">
            <Link to="/commander" className="btn-dark !rounded-full !px-7 !py-4 text-base">
              Commander
              <ArrowRight className="h-4 w-4" />
            </Link>
            {prix('SIMPLE', 'COURTES') !== null && (
              <p className="text-slate-500">
                À partir de <b className="text-navy">{nf.format(prix('SIMPLE', 'COURTES')!)} FCFA</b>
              </p>
            )}
          </div>

          {/* Les deux polos */}
          <div className="mt-12 grid max-w-md grid-cols-2 gap-4">
            {[
              { img: POLO_IMAGES.LICENCE.COURTES, titre: 'Licence', couleur: 'Polo bleu' },
              { img: POLO_IMAGES.MASTER.COURTES, titre: 'Master', couleur: 'Polo blanc' },
            ].map((p) => (
              <Link
                key={p.titre}
                to="/commander"
                className="group flex items-center gap-3 rounded-2xl border border-slate-200 p-3 transition hover:border-slate-300 hover:shadow-soft"
              >
                <img
                  src={p.img}
                  alt={`${p.couleur} ${p.titre}`}
                  className="h-14 w-14 shrink-0 rounded-xl bg-slate-50 object-contain p-1"
                />
                <div>
                  <p className="font-display font-bold text-navy">{p.titre}</p>
                  <p className="text-sm text-slate-500">{p.couleur}</p>
                </div>
              </Link>
            ))}
          </div>

          {/* Moyens de paiement */}
          <div className="mt-8 flex items-center gap-4">
            <p className="text-sm text-slate-500">Paiement</p>
            <div className="flex gap-2">
              {['WAVE', 'ORANGE_MONEY', 'MTN_MONEY', 'MOOV_MONEY'].map((m) => (
                <OperatorLogo key={m} moyen={m} className="h-9 w-9 rounded-lg" />
              ))}
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.1 }}
          className="relative"
        >
          <div className="overflow-hidden rounded-[2rem]">
            <img
              src="/images/campus/equipe.jpg"
              alt="Étudiants de l’ESATIC en polo bleu et blanc"
              className="aspect-[4/3] w-full object-cover lg:aspect-auto lg:h-[min(78vh,680px)]"
            />
          </div>
          <img
            src="/images/campus/dos-a2e.jpg"
            alt="Logo A2E au dos des polos"
            className="absolute -bottom-8 -left-8 hidden w-44 rounded-2xl border-[6px] border-white object-cover shadow-card xl:block"
          />
        </motion.div>
      </section>

      {/* ——— Les deux polos ——— */}
      <section className="bg-[#F6F8FB]">
        <div className="mx-auto max-w-[1440px] px-5 py-20 sm:px-8 lg:px-12">
          <motion.div {...reveal} className="max-w-xl">
            <h2 className="section-title">Deux polos, un par cycle</h2>
            <p className="mt-3 text-slate-600">
              Chaque modèle existe en manches courtes ou longues, en version simple ou brodée.
            </p>
          </motion.div>

          <div className="mt-10 grid gap-6 md:grid-cols-2">
            {cycles.map((c, i) => (
              <CycleCard key={c.modele} cycle={c} index={i} />
            ))}
          </div>
        </div>
      </section>

      {/* ——— Tarifs ——— */}
      <section className="mx-auto max-w-[1440px] px-5 py-20 sm:px-8 lg:px-12">
        <motion.div {...reveal} className="grid gap-10 lg:grid-cols-[1fr_1.4fr] lg:items-start">
          <div>
            <h2 className="section-title">Tarifs</h2>
            <p className="mt-3 text-slate-600">Les mêmes prix pour la Licence et le Master.</p>
          </div>
          <div className="overflow-hidden rounded-2xl border border-slate-200">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-slate-200 text-sm text-slate-500">
                  <th className="px-5 py-4 font-medium" />
                  <th className="px-5 py-4 text-right font-medium">Manches courtes</th>
                  <th className="px-5 py-4 text-right font-medium">Manches longues</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {[
                  ['SIMPLE', 'Simple'],
                  ['BRODE', 'Brodé'],
                ].map(([v, l]) => (
                  <tr key={v}>
                    <td className="px-5 py-5 font-semibold text-navy">{l}</td>
                    {['COURTES', 'LONGUES'].map((m) => (
                      <td key={m} className="px-5 py-5 text-right">
                        <span className="font-display text-xl font-bold text-navy">
                          {prix(v, m) !== null ? nf.format(prix(v, m)!) : '—'}
                        </span>
                        <span className="ml-1 text-sm text-slate-400">FCFA</span>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </motion.div>
      </section>

      {/* ——— Comment commander ——— */}
      <section className="border-t border-slate-100">
        <div className="mx-auto grid max-w-[1440px] gap-12 px-5 py-20 sm:px-8 lg:px-12 lg:grid-cols-2 lg:items-center">
          <motion.div {...reveal}>
            <h2 className="section-title">Comment commander</h2>
            <ol className="mt-8 space-y-7">
              {etapes.map((e, i) => (
                <li key={e.titre} className="flex gap-5">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 border-navy font-display text-sm font-bold text-navy">
                    {i + 1}
                  </span>
                  <div>
                    <h3 className="font-display text-lg font-bold text-navy">{e.titre}</h3>
                    <p className="mt-1 text-slate-600">{e.texte}</p>
                  </div>
                </li>
              ))}
            </ol>
          </motion.div>
          <motion.div {...reveal} className="grid grid-cols-2 gap-4">
            <img
              src="/images/campus/accord.jpg"
              alt="Deux étudiants en polo de l’ESATIC"
              loading="lazy"
              className="col-span-2 aspect-[16/10] w-full rounded-3xl object-cover"
            />
            <img
              src="/images/campus/dos-a2e.jpg"
              alt="Logo A2E au dos des polos"
              loading="lazy"
              className="aspect-square w-full rounded-3xl object-cover"
            />
            <img
              src="/images/campus/portrait.jpg"
              alt="Étudiant en polo blanc"
              loading="lazy"
              className="aspect-square w-full rounded-3xl object-cover"
            />
          </motion.div>
        </div>
      </section>
    </div>
  )
}

function CycleCard({ cycle, index }: { cycle: (typeof cycles)[number]; index: number }) {
  const [manches, setManches] = useState<'COURTES' | 'LONGUES'>('COURTES')
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ delay: index * 0.08 }}
      className="overflow-hidden rounded-3xl bg-white"
    >
      <div className="relative aspect-[5/4] bg-white">
        <img
          key={manches}
          src={POLO_IMAGES[cycle.modele][manches]}
          alt={`Polo ${cycle.titre} ${cycle.couleur}, manches ${manches === 'COURTES' ? 'courtes' : 'longues'}`}
          loading="lazy"
          className="h-full w-full object-contain p-6"
        />
      </div>
      <div className="flex flex-wrap items-end justify-between gap-4 border-t border-slate-100 p-6">
        <div>
          <div className="flex items-center gap-2.5">
            <span
              className="h-4 w-4 rounded-full ring-1 ring-slate-300"
              style={{ background: cycle.pastille }}
            />
            <h3 className="font-display text-xl font-bold text-navy">{cycle.titre}</h3>
          </div>
          <p className="mt-1 text-sm text-slate-500">{cycle.texte}</p>
        </div>
        <div className="flex rounded-full bg-slate-100 p-1 text-xs font-semibold">
          {(['COURTES', 'LONGUES'] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setManches(m)}
              className={cn(
                'rounded-full px-3 py-1.5 transition',
                manches === m ? 'bg-white text-navy shadow-sm' : 'text-slate-500'
              )}
            >
              {m === 'COURTES' ? 'Courtes' : 'Longues'}
            </button>
          ))}
        </div>
      </div>
    </motion.div>
  )
}
