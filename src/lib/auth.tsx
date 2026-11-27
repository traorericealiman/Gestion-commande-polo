import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import {
  login as apiLogin,
  logout as apiLogout,
  fetchMe,
  getAccessToken,
  setTokens,
  clearTokens,
  changerMotDePasse,
  AUTH_EXPIRED_EVENT,
  PASSWORD_CHANGE_EVENT,
} from './api'
import type { User } from '@/types'

interface AuthContextValue {
  user: User | null
  loading: boolean
  login: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
  changePassword: (ancien: string, nouveau: string) => Promise<void>
  isAdmin: boolean
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  const loadUser = useCallback(async () => {
    if (!getAccessToken()) {
      setUser(null)
      setLoading(false)
      return
    }
    try {
      const me = await fetchMe()
      setUser(me)
    } catch {
      clearTokens()
      setUser(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadUser()
  }, [loadUser])

  // Session expirée pendant l'utilisation : retour à l'écran de connexion
  useEffect(() => {
    const onExpired = () => setUser(null)
    window.addEventListener(AUTH_EXPIRED_EVENT, onExpired)
    return () => window.removeEventListener(AUTH_EXPIRED_EVENT, onExpired)
  }, [])

  // L'API refuse la gestion tant que le mot de passe provisoire n'est pas changé
  useEffect(() => {
    const onMustChange = () =>
      setUser((u) => (u ? { ...u, doit_changer_mot_de_passe: true } : u))
    window.addEventListener(PASSWORD_CHANGE_EVENT, onMustChange)
    return () => window.removeEventListener(PASSWORD_CHANGE_EVENT, onMustChange)
  }, [])

  const login = useCallback(async (email: string, password: string) => {
    const tokens = await apiLogin(email, password)
    setTokens(tokens)
    const me = await fetchMe()
    setUser({
      ...me,
      doit_changer_mot_de_passe: Boolean(me.doit_changer_mot_de_passe || tokens.doit_changer_mot_de_passe),
    })
  }, [])

  const changePassword = useCallback(async (ancien: string, nouveau: string) => {
    await changerMotDePasse(ancien, nouveau)
    const me = await fetchMe()
    setUser({ ...me, doit_changer_mot_de_passe: false })
  }, [])

  const logout = useCallback(async () => {
    await apiLogout()
    setUser(null)
  }, [])

  const value = useMemo(
    () => ({
      user,
      loading,
      login,
      logout,
      changePassword,
      isAdmin: user?.role === 'ADMIN',
    }),
    [user, loading, login, logout, changePassword]
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
