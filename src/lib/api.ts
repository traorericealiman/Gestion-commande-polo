import type {
  Catalogue,
  CommandeCreee,
  SuiviCommande,
  AuthTokens,
  User,
  TableauDeBord,
  PaginatedCommandes,
  CommandeDetail,
  DecisionPayload,
  NumeroDepotGestion,
} from '@/types'

export const API_BASE =
  import.meta.env.VITE_API_URL ??
  (import.meta.env.DEV ? '' : 'https://api-production-02aa0543.up.railway.app')

const TOKEN_KEY = 'polo_access'
const REFRESH_KEY = 'polo_refresh'

export function getAccessToken(): string | null {
  return localStorage.getItem(TOKEN_KEY)
}

export function getRefreshToken(): string | null {
  return localStorage.getItem(REFRESH_KEY)
}

export function setTokens(tokens: Partial<AuthTokens> & { access: string }) {
  localStorage.setItem(TOKEN_KEY, tokens.access)
  // Le rafraîchissement peut ne renvoyer que "access" : on garde alors l'ancien refresh
  if (tokens.refresh) localStorage.setItem(REFRESH_KEY, tokens.refresh)
}

export function clearTokens() {
  localStorage.removeItem(TOKEN_KEY)
  localStorage.removeItem(REFRESH_KEY)
}

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let detail = 'Une erreur est survenue'
    try {
      const body = await res.json()
      if (typeof body === 'object' && body !== null) {
        if (body.detail)
          detail =
            typeof body.detail === 'string' ? body.detail : JSON.stringify(body.detail)
        else if (body.non_field_errors) detail = body.non_field_errors.join(' ')
        else {
          const first = Object.values(body)[0]
          if (Array.isArray(first)) detail = String(first[0])
          else if (typeof first === 'string') detail = first
        }
      }
    } catch {
      /* ignore */
    }
    throw new Error(detail)
  }
  if (res.status === 204) return undefined as T
  return res.json()
}

async function authFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const token = getAccessToken()
  const headers = new Headers(options.headers)
  if (token) headers.set('Authorization', `Bearer ${token}`)
  if (!(options.body instanceof FormData) && !headers.has('Content-Type') && options.body) {
    headers.set('Content-Type', 'application/json')
  }

  let res = await fetch(url, { ...options, headers })

  if (res.status === 401) {
    if (getRefreshToken()) {
      try {
        const refreshed = await refreshToken()
        setTokens(refreshed)
        headers.set('Authorization', `Bearer ${refreshed.access}`)
        res = await fetch(url, { ...options, headers })
      } catch {
        /* rafraîchissement impossible : traité juste en dessous */
      }
    }
    if (res.status === 401) expireSession()
  }
  return res
}

/** Session expirée : on efface les jetons et on prévient l'application (retour à la connexion). */
export const AUTH_EXPIRED_EVENT = 'a2e:auth-expired'
function expireSession() {
  clearTokens()
  window.dispatchEvent(new Event(AUTH_EXPIRED_EVENT))
}

/* ——— Public ——— */

export async function fetchCatalogue(): Promise<Catalogue> {
  const res = await fetch(`${API_BASE}/api/v1/catalogue/`)
  return handleResponse<Catalogue>(res)
}

export interface CreateOrderPayload {
  nom: string
  prenoms: string
  email: string
  email_confirmation: string
  lignes: string
  moyen_paiement: string
  numero_envoi: string
  reference_transaction?: string
  capture: File
  confirmation: boolean
}

export async function createOrder(payload: CreateOrderPayload): Promise<CommandeCreee> {
  const form = new FormData()
  form.append('nom', payload.nom)
  form.append('prenoms', payload.prenoms)
  form.append('email', payload.email)
  form.append('email_confirmation', payload.email_confirmation)
  form.append('lignes', payload.lignes)
  form.append('moyen_paiement', payload.moyen_paiement)
  form.append('numero_envoi', payload.numero_envoi)
  if (payload.reference_transaction) {
    form.append('reference_transaction', payload.reference_transaction)
  }
  form.append('capture', payload.capture)
  form.append('confirmation', payload.confirmation ? 'true' : 'false')

  const res = await fetch(`${API_BASE}/api/v1/commandes/`, {
    method: 'POST',
    body: form,
  })
  return handleResponse<CommandeCreee>(res)
}

export async function trackOrder(code_suivi: string, email: string): Promise<SuiviCommande> {
  const res = await fetch(`${API_BASE}/api/v1/suivi/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code_suivi, email }),
  })
  return handleResponse<SuiviCommande>(res)
}

export async function resendCapture(
  code_suivi: string,
  email: string,
  capture: File,
  reference_transaction?: string
): Promise<{ detail: string }> {
  const form = new FormData()
  form.append('code_suivi', code_suivi)
  form.append('email', email)
  form.append('capture', capture)
  if (reference_transaction) form.append('reference_transaction', reference_transaction)

  const res = await fetch(`${API_BASE}/api/v1/suivi/capture/`, {
    method: 'POST',
    body: form,
  })
  return handleResponse(res)
}

/* ——— Auth ——— */

export async function login(email: string, password: string): Promise<AuthTokens> {
  const res = await fetch(`${API_BASE}/api/v1/auth/connexion/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })
  return handleResponse<AuthTokens>(res)
}

export async function refreshToken(): Promise<AuthTokens> {
  const refresh = getRefreshToken()
  if (!refresh) throw new Error('Pas de refresh token')
  const res = await fetch(`${API_BASE}/api/v1/auth/rafraichir/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refresh }),
  })
  return handleResponse<AuthTokens>(res)
}

export async function logout(): Promise<void> {
  const refresh = getRefreshToken()
  try {
    if (refresh) {
      await authFetch(`${API_BASE}/api/v1/auth/deconnexion/`, {
        method: 'POST',
        body: JSON.stringify({ refresh }),
      })
    }
  } finally {
    clearTokens()
  }
}

export async function fetchMe(): Promise<User> {
  const res = await authFetch(`${API_BASE}/api/v1/auth/moi/`)
  return handleResponse<User>(res)
}

/* ——— Gestion ——— */

export async function fetchDashboard(): Promise<TableauDeBord> {
  const res = await authFetch(`${API_BASE}/api/v1/gestion/tableau-de-bord/`)
  return handleResponse<TableauDeBord>(res)
}

export interface CommandeFilters {
  search?: string
  statut?: string
  moyen_paiement?: string
  modele?: string
  version?: string
  manches?: string
  taille?: string
  date_min?: string
  date_max?: string
  page?: number
  ordering?: string
}

export async function fetchCommandes(
  filters: CommandeFilters = {}
): Promise<PaginatedCommandes> {
  const params = new URLSearchParams()
  Object.entries(filters).forEach(([k, v]) => {
    if (v !== undefined && v !== '') params.set(k, String(v))
  })
  const qs = params.toString()
  const res = await authFetch(
    `${API_BASE}/api/v1/gestion/commandes/${qs ? `?${qs}` : ''}`
  )
  return handleResponse<PaginatedCommandes>(res)
}

export async function fetchCommande(id: number): Promise<CommandeDetail> {
  const res = await authFetch(`${API_BASE}/api/v1/gestion/commandes/${id}/`)
  return handleResponse<CommandeDetail>(res)
}

export async function updateNoteInterne(
  id: number,
  note_interne: string
): Promise<CommandeDetail> {
  const res = await authFetch(`${API_BASE}/api/v1/gestion/commandes/${id}/`, {
    method: 'PATCH',
    body: JSON.stringify({ note_interne }),
  })
  // La réponse peut ne contenir que la note : on relit la commande complète
  await handleResponse<unknown>(res)
  return fetchCommande(id)
}

async function postAction(
  id: number,
  action: string,
  body?: DecisionPayload
): Promise<CommandeDetail> {
  const res = await authFetch(
    `${API_BASE}/api/v1/gestion/commandes/${id}/${action}/`,
    {
      method: 'POST',
      body: body ? JSON.stringify(body) : undefined,
    }
  )
  // L'API répond 204 (sans contenu) : on relit la commande à jour
  await handleResponse<unknown>(res)
  return fetchCommande(id)
}

export const validerCommande = (id: number) => postAction(id, 'valider')
export const refuserCommande = (id: number, payload: DecisionPayload) =>
  postAction(id, 'refuser', payload)
export const demanderComplement = (id: number, payload: DecisionPayload) =>
  postAction(id, 'demander-complement', payload)
export const marquerDisponible = (id: number) => postAction(id, 'marquer-disponible')
export const marquerRemis = (id: number) => postAction(id, 'marquer-remis')
export const annulerDecision = (id: number, payload: DecisionPayload) =>
  postAction(id, 'annuler-decision', payload)

export function captureUrl(id: number): string {
  return `${API_BASE}/api/v1/gestion/commandes/${id}/capture/`
}

export async function downloadCapture(id: number): Promise<Blob> {
  const res = await authFetch(captureUrl(id))
  if (!res.ok) throw new Error('Impossible de télécharger la capture')
  return res.blob()
}

export async function exportCommandes(filters: CommandeFilters = {}): Promise<Blob> {
  const params = new URLSearchParams()
  Object.entries(filters).forEach(([k, v]) => {
    if (v !== undefined && v !== '' && k !== 'page') params.set(k, String(v))
  })
  const qs = params.toString()
  const res = await authFetch(
    `${API_BASE}/api/v1/gestion/commandes/export/${qs ? `?${qs}` : ''}`
  )
  if (!res.ok) throw new Error('Export impossible')
  return res.blob()
}

/* ——— Numéros de dépôt (configurés par les trésorières) ——— */

export async function fetchNumerosDepot(): Promise<NumeroDepotGestion[]> {
  const res = await authFetch(`${API_BASE}/api/v1/gestion/numeros-depot/`)
  const data = await handleResponse<NumeroDepotGestion[] | { results: NumeroDepotGestion[] }>(res)
  return Array.isArray(data) ? data : data.results
}

export interface NumeroDepotPayload {
  moyen: string
  numero: string
  titulaire: string
  actif?: boolean
}

export async function createNumeroDepot(p: NumeroDepotPayload): Promise<NumeroDepotGestion> {
  const res = await authFetch(`${API_BASE}/api/v1/gestion/numeros-depot/`, {
    method: 'POST',
    body: JSON.stringify(p),
  })
  return handleResponse<NumeroDepotGestion>(res)
}

export async function updateNumeroDepot(
  id: number,
  p: Partial<NumeroDepotPayload>
): Promise<NumeroDepotGestion> {
  const res = await authFetch(`${API_BASE}/api/v1/gestion/numeros-depot/${id}/`, {
    method: 'PATCH',
    body: JSON.stringify(p),
  })
  return handleResponse<NumeroDepotGestion>(res)
}

/* ——— Helpers ——— */

export function formatPrice(fcfa: number): string {
  return new Intl.NumberFormat('fr-FR').format(fcfa) + ' FCFA'
}

export function getPrix(
  tarifs: { modele: string; version: string; manches: string; prix: number }[],
  modele: string,
  version: string,
  manches: string
): number {
  const t = tarifs.find(
    (x) => x.modele === modele && x.version === version && x.manches === manches
  )
  return t?.prix ?? 0
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleString('fr-FR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}
