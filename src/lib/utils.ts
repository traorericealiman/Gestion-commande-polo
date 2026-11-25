export function cn(...classes: (string | false | null | undefined)[]) {
  return classes.filter(Boolean).join(' ')
}

/** Types et taille acceptés pour une capture de paiement. */
export const CAPTURE_TYPES = ['image/jpeg', 'image/png', 'application/pdf']
export const CAPTURE_MAX = 5 * 1024 * 1024

/** Renvoie un message d'erreur si le fichier n'est pas une capture valide, sinon null. */
export function checkCapture(file: File): string | null {
  if (!CAPTURE_TYPES.includes(file.type)) return 'Format non accepté : JPG, PNG ou PDF uniquement.'
  if (file.size > CAPTURE_MAX) return 'Fichier trop lourd (5 Mo maximum).'
  if (file.size === 0) return 'Le fichier est vide.'
  return null
}

export function uid() {
  return Math.random().toString(36).slice(2, 10)
}
