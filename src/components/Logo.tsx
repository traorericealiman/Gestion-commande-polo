import { cn } from '@/lib/utils'

/** Logo officiel A2E (image), sans texte ajouté. */
export default function Logo({ className }: { className?: string }) {
  return (
    <img
      src="/A2E.png"
      alt="A2E – Association Estudiantine de l’ESATIC"
      className={cn('h-11 w-auto select-none', className)}
      draggable={false}
    />
  )
}
