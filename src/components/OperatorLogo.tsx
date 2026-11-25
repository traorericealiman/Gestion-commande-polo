import { LOGOS_OPERATEURS, OPERATEURS } from '@/lib/status'
import { cn } from '@/lib/utils'

interface Props {
  moyen: string
  className?: string
}

/** Logo officiel de l'opérateur Mobile Money (carré arrondi). */
export default function OperatorLogo({ moyen, className }: Props) {
  const src = LOGOS_OPERATEURS[moyen]
  const nom = OPERATEURS[moyen]?.nom ?? moyen
  if (!src) {
    return (
      <span
        className={cn(
          'inline-flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-xs font-bold text-slate-500',
          className
        )}
      >
        {nom.slice(0, 2)}
      </span>
    )
  }
  return (
    <img
      src={src}
      alt={nom}
      className={cn('h-10 w-10 shrink-0 rounded-xl object-cover', className)}
      draggable={false}
    />
  )
}
