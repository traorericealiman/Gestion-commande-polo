export type Modele = 'LICENCE' | 'MASTER'
export type Version = 'SIMPLE' | 'BRODE'
export type Manches = 'COURTES' | 'LONGUES'
export type Taille = 'S' | 'M' | 'L' | 'XL' | 'XXL'
export type MoyenPaiement = 'WAVE' | 'ORANGE_MONEY' | 'MTN_MONEY' | 'MOOV_MONEY'

export type Statut =
  | 'EN_ATTENTE'
  | 'A_CORRIGER'
  | 'VALIDEE'
  | 'POLO_DISPONIBLE'
  | 'REMIS'
  | 'REFUSEE'
  | 'CLOTUREE'

export type Motif =
  | 'CAPTURE_ILLISIBLE'
  | 'MONTANT_INSUFFISANT'
  | 'PAIEMENT_INTROUVABLE'
  | 'DOUBLON'
  | 'AUTRE'
  | ''

export type Role = 'TRESORIERE' | 'ADMIN'

export type Action =
  | 'VALIDER'
  | 'REFUSER'
  | 'DEMANDER_COMPLEMENT'
  | 'MARQUER_DISPONIBLE'
  | 'MARQUER_REMIS'
  | 'ANNULER_DECISION'

export interface Choix {
  valeur: string
  libelle: string
}

export interface Tarif {
  modele: string
  version: string
  manches: string
  prix: number
}

export interface Disponibilite {
  modele: string
  version: string
  manches: string
  taille: string
  restant: number
}

export interface NumeroDepot {
  moyen: string
  numero: string
  titulaire: string
}

export interface NumeroDepotGestion {
  id: number
  moyen: MoyenPaiement
  moyen_libelle: string
  numero: string
  titulaire: string
  actif: boolean
  date_creation: string
  date_modification: string
  modifie_par: string | null
}

export interface Catalogue {
  ventes_ouvertes: boolean
  date_ouverture: string | null
  date_cloture: string | null
  quantite_max_par_ligne: number
  modeles: Choix[]
  versions: Choix[]
  manches: Choix[]
  tailles: Choix[]
  moyens_paiement: Choix[]
  tarifs: Tarif[]
  disponibilites: Disponibilite[]
  numeros_depot: NumeroDepot[]
}

export interface LigneCommande {
  id: string
  modele: Modele
  version: Version
  manches: Manches
  taille: Taille
  quantite: number
}

export interface CommandeCreee {
  code_suivi: string
  statut: Statut
  montant_total: number
}

export interface LigneSortie {
  modele: string
  version: string
  manches: string
  taille: string
  quantite: number
  prix_unitaire: number
  prix_ligne: number
  modele_libelle?: string
  version_libelle?: string
  manches_libelle?: string
}

export interface Retrait {
  lieu?: string
  horaires?: string
  instructions?: string
}

export interface SuiviCommande {
  code_suivi: string
  statut: Statut
  statut_libelle: string
  montant_total: number
  lignes: LigneSortie[]
  date_creation: string
  motif: string
  motif_libelle: string
  commentaire: string
  retrait: Retrait | null
  peut_renvoyer_capture: boolean
}

/* ——— Auth & Admin ——— */

export interface User {
  id: number
  email: string
  first_name: string
  last_name: string
  role: Role
  last_login: string | null
  /** Vrai à la première connexion : il faut choisir un nouveau mot de passe */
  doit_changer_mot_de_passe?: boolean
}

export interface AuthTokens {
  access: string
  refresh: string
}

export interface StockLigne {
  modele: string
  version: string
  manches: string
  taille: string
  demande: number
  valide: number
  remis: number
  restant: number | null
}

export interface TableauDeBord {
  compteurs: Record<string, number>
  montant_encaisse: number
  montant_en_attente: number
  stocks: StockLigne[]
}

export interface CommandeListe {
  id: number
  code_suivi: string
  nom: string
  prenoms: string
  email: string
  nombre_polos: number
  resume_polos: string[]
  montant_total: number
  moyen_paiement: string
  numero_envoi: string
  statut: Statut
  date_creation: string
}

export interface Paiement {
  moyen: string
  numero_envoi: string
  reference_transaction?: string
}

export interface CaptureInfo {
  id: number
  type_mime: string
  taille_octets: number
  date_envoi: string
  url_telechargement: string
}

export interface Alerte {
  code: string
  message: string
  commandes_liees: string[]
}

export interface Evenement {
  action: string
  statut_avant?: string
  statut_apres: string
  auteur: string | null
  motif?: string
  commentaire?: string
  date: string
}

export interface CommandeDetail extends CommandeListe {
  lignes: LigneSortie[]
  paiement: Paiement
  capture: CaptureInfo | null
  motif: string
  commentaire: string
  note_interne: string
  date_decision: string | null
  date_remise: string | null
  alertes: Alerte[]
  evenements: Evenement[]
  autres_commandes_meme_email: string[]
  actions_possibles: Action[]
}

export interface PaginatedCommandes {
  count: number
  next: string | null
  previous: string | null
  results: CommandeListe[]
}

export interface DecisionPayload {
  motif?: Motif | string
  commentaire?: string
}

export const STATUT_LABELS: Record<Statut, string> = {
  EN_ATTENTE: 'En attente',
  A_CORRIGER: 'À corriger',
  VALIDEE: 'Validée',
  POLO_DISPONIBLE: 'Disponible',
  REMIS: 'Remis',
  REFUSEE: 'Refusée',
  CLOTUREE: 'Clôturée',
}

export const MOTIF_LABELS: Record<string, string> = {
  CAPTURE_ILLISIBLE: 'Capture illisible',
  MONTANT_INSUFFISANT: 'Montant insuffisant',
  PAIEMENT_INTROUVABLE: 'Paiement introuvable',
  DOUBLON: 'Doublon',
  AUTRE: 'Autre',
}

export const MOYEN_LABELS: Record<string, string> = {
  WAVE: 'Wave',
  ORANGE_MONEY: 'Orange Money',
  MTN_MONEY: 'MTN Money',
  MOOV_MONEY: 'Moov Money',
}
