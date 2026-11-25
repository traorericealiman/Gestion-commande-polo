import { STATUT_LABELS, type Statut } from '@/types'
import { STATUS_STYLES } from '@/lib/status'
import { cn } from '@/lib/utils'

/** Statut sobre : point de couleur + libellé. */
export default function StatusBadge({ statut }: { statut: Statut | string }) {
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-sm text-slate-700">
      <span className={cn('h-1.5 w-1.5 rounded-full', STATUS_STYLES[statut]?.dot ?? 'bg-slate-300')} />
      {STATUT_LABELS[statut as Statut] ?? statut}
    </span>
  )
}
