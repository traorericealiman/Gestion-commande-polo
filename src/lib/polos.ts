/** Licence = polo bleu, Master = polo blanc. */
export const POLO_IMAGES: Record<string, Record<string, string>> = {
  LICENCE: {
    COURTES: '/images/IMG_4873.PNG',
    LONGUES: '/images/IMG_4874.PNG',
  },
  MASTER: {
    COURTES: '/images/Polo3_ESATIC.png',
    LONGUES: '/images/Polo4_ESATIC.png',
  },
}

export const COULEUR_CYCLE: Record<string, string> = {
  LICENCE: 'Bleu',
  MASTER: 'Blanc',
}

export function poloImage(modele: string, manches: string): string {
  return POLO_IMAGES[modele]?.[manches] ?? POLO_IMAGES.MASTER.COURTES
}
