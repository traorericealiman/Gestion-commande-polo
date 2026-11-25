import type { Statut } from '@/types'

/** Pastilles de statut (fond + texte + point). */
export const STATUS_STYLES: Record<string, { chip: string; dot: string; card: string }> = {
  EN_ATTENTE: {
    chip: 'bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-200',
    dot: 'bg-amber-500',
    card: 'border-amber-200 bg-amber-50/70 text-amber-800',
  },
  A_CORRIGER: {
    chip: 'bg-orange-50 text-orange-700 ring-1 ring-inset ring-orange-200',
    dot: 'bg-orange-500',
    card: 'border-orange-200 bg-orange-50/70 text-orange-800',
  },
  VALIDEE: {
    chip: 'bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-200',
    dot: 'bg-emerald-500',
    card: 'border-emerald-200 bg-emerald-50/70 text-emerald-800',
  },
  POLO_DISPONIBLE: {
    chip: 'bg-brand-50 text-brand-700 ring-1 ring-inset ring-brand-200',
    dot: 'bg-brand-500',
    card: 'border-brand-200 bg-brand-50/70 text-brand-800',
  },
  REMIS: {
    chip: 'bg-navy/5 text-navy ring-1 ring-inset ring-navy/15',
    dot: 'bg-navy',
    card: 'border-slate-200 bg-white text-navy',
  },
  REFUSEE: {
    chip: 'bg-red-50 text-red-700 ring-1 ring-inset ring-red-200',
    dot: 'bg-red-500',
    card: 'border-red-200 bg-red-50/70 text-red-700',
  },
  CLOTUREE: {
    chip: 'bg-slate-100 text-slate-500 ring-1 ring-inset ring-slate-200',
    dot: 'bg-slate-400',
    card: 'border-slate-200 bg-slate-50 text-slate-500',
  },
}

export const statusChip = (s: string) =>
  STATUS_STYLES[s]?.chip ?? 'bg-slate-100 text-slate-600'

/** Parcours normal d'une commande, pour la frise de suivi. */
export const PARCOURS: { statut: Statut; titre: string; texte: string }[] = [
  { statut: 'EN_ATTENTE', titre: 'Commande reçue', texte: 'Ta commande est enregistrée.' },
  { statut: 'VALIDEE', titre: 'Paiement confirmé', texte: 'Ton paiement a été accepté.' },
  { statut: 'POLO_DISPONIBLE', titre: 'Polos prêts', texte: 'Tu peux venir les récupérer.' },
  { statut: 'REMIS', titre: 'Remis', texte: 'Tes polos t’ont été remis.' },
]

export function etapeIndex(statut: Statut): number {
  switch (statut) {
    case 'EN_ATTENTE':
    case 'A_CORRIGER':
    case 'REFUSEE':
      return 0
    case 'VALIDEE':
      return 1
    case 'POLO_DISPONIBLE':
      return 2
    case 'REMIS':
    case 'CLOTUREE':
      return 3
    default:
      return 0
  }
}

/** Couleurs d'opérateur Mobile Money. */
export const OPERATEURS: Record<
  string,
  { nom: string; court: string; bg: string; fg: string; ring: string }
> = {
  WAVE: { nom: 'Wave', court: 'W', bg: '#1DC8FF', fg: '#ffffff', ring: '#1DC8FF' },
  ORANGE_MONEY: { nom: 'Orange Money', court: 'OM', bg: '#FF7900', fg: '#ffffff', ring: '#FF7900' },
  MTN_MONEY: { nom: 'MTN MoMo', court: 'MTN', bg: '#FFCB05', fg: '#00224A', ring: '#E5B400' },
  MOOV_MONEY: { nom: 'Moov Money', court: 'MV', bg: '#0055A5', fg: '#ffffff', ring: '#0055A5' },
}

/** Logos officiels des opérateurs (public/images/operateurs). */
export const LOGOS_OPERATEURS: Record<string, string> = {
  WAVE: '/images/operateurs/wave.png',
  ORANGE_MONEY: '/images/operateurs/orange-money.png',
  MTN_MONEY: '/images/operateurs/mtn-money.png',
  MOOV_MONEY: '/images/operateurs/moov-money.png',
}

/** 0707070707 → 07 07 07 07 07 */
export function formatPhone(num: string): string {
  const d = num.replace(/\D/g, '')
  if (d.length === 10) return d.replace(/(\d{2})(?=\d)/g, '$1 ').trim()
  return num
}
