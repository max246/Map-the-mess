import {
  createContext,
  useContext,
  useState,
  useMemo,
  useCallback,
  useEffect,
  type ReactNode,
} from 'react'
import api from '../api/client'
import { flush as flushOfflineQueue } from '../offline/reportQueue'

interface User {
  id: string
  email: string
  userType: string
  exp: number
}

interface AuthContextType {
  token: string | null
  user: User | null
  isLoggedIn: boolean
  isAdmin: boolean
  isModerator: boolean
  canManageUsers: boolean
  sessionExpired: boolean
  dismissSessionExpired: () => void
  login: (email: string, password: string) => Promise<unknown>
  register: (
    email: string,
    fullName: string,
    password: string,
    cityLatitude?: number,
    cityLongitude?: number
  ) => Promise<unknown>
  forgotPassword: (email: string) => Promise<unknown>
  resetPassword: (resetToken: string, newPassword: string) => Promise<unknown>
  loginWithProvider: (provider: string, credential: string) => Promise<unknown>
  linkProvider: (provider: string, credential: string) => Promise<unknown>
  unlinkProvider: (provider: string) => Promise<unknown>
  logout: () => void
}

const AuthContext = createContext<AuthContextType | null>(null)

function decodeToken(token: string): User | null {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]))
    return { id: payload.user_id, email: payload.sub, userType: payload.type, exp: payload.exp }
  } catch {
    return null
  }
}

let refreshPromise: Promise<string | null> | null = null

export async function tryRefreshToken(): Promise<string | null> {
  // Deduplicate concurrent refresh attempts
  if (refreshPromise) return refreshPromise

  refreshPromise = (async () => {
    const refreshToken = localStorage.getItem('refresh_token')
    if (!refreshToken) return null

    try {
      const res = await api.post('/api/auth/refresh', { refresh_token: refreshToken }, {
        _skipAuthRetry: true,
      } as never)
      const { access_token, refresh_token: newRefresh } = res.data
      localStorage.setItem('token', access_token)
      localStorage.setItem('refresh_token', newRefresh)
      return access_token
    } catch {
      // Refresh failed — tokens are invalid
      localStorage.removeItem('token')
      localStorage.removeItem('refresh_token')
      return null
    } finally {
      refreshPromise = null
    }
  })()

  return refreshPromise
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('token'))
  const [sessionExpired, setSessionExpired] = useState(false)

  const user = useMemo(() => (token ? decodeToken(token) : null), [token])

  // Called by the axios interceptor when refresh succeeds
  const updateToken = useCallback((newToken: string) => {
    setToken(newToken)
  }, [])

  // Called by the axios interceptor when refresh fails
  const handleSessionExpired = useCallback(() => {
    setToken(null)
    setSessionExpired(true)
  }, [])

  const dismissSessionExpired = useCallback(() => {
    setSessionExpired(false)
  }, [])

  const login = async (email: string, password: string) => {
    const res = await api.post('/api/auth/login', { email, password })
    const { access_token, refresh_token } = res.data
    localStorage.setItem('token', access_token)
    localStorage.setItem('refresh_token', refresh_token)
    setToken(access_token)
    setSessionExpired(false)
    // Drain any queued offline items that were waiting on a valid session.
    void flushOfflineQueue().catch(() => {})
    return res.data
  }

  const register = async (
    email: string,
    fullName: string,
    password: string,
    cityLatitude = 0,
    cityLongitude = 0
  ) => {
    const res = await api.post('/api/auth/register', {
      email,
      full_name: fullName,
      password,
      city_latitude: cityLatitude,
      city_longitude: cityLongitude,
    })
    return res.data
  }

  const forgotPassword = async (email: string) => {
    const res = await api.post('/api/auth/forgot-password', { email })
    return res.data
  }

  const resetPassword = async (resetToken: string, newPassword: string) => {
    const res = await api.post('/api/auth/reset-password', {
      token: resetToken,
      new_password: newPassword,
    })
    return res.data
  }

  const loginWithProvider = async (provider: string, credential: string) => {
    const res = await api.post(`/api/auth/${provider}/login`, { credential })
    const { access_token, refresh_token } = res.data
    localStorage.setItem('token', access_token)
    localStorage.setItem('refresh_token', refresh_token)
    setToken(access_token)
    setSessionExpired(false)
    void flushOfflineQueue().catch(() => {})
    return res.data
  }

  const linkProvider = async (provider: string, credential: string) => {
    const res = await api.post(`/api/auth/${provider}/link`, { credential })
    return res.data
  }

  const unlinkProvider = async (provider: string) => {
    const res = await api.delete(`/api/auth/${provider}/link`)
    return res.data
  }

  const logout = () => {
    const refreshToken = localStorage.getItem('refresh_token')
    if (refreshToken) {
      api
        .post('/api/auth/logout', { refresh_token: refreshToken }, {
          _skipAuthRetry: true,
        } as never)
        .catch(() => {})
    }
    localStorage.removeItem('token')
    localStorage.removeItem('refresh_token')
    setToken(null)
    setSessionExpired(false)
  }

  const isLoggedIn = !!token && !!user
  const isAdmin = user?.userType === 'admin' || user?.userType === 'superuser'
  const isModerator = user?.userType === 'moderator'
  const canManageUsers = isAdmin || isModerator

  // Expose updateToken and handleSessionExpired to the interceptor
  useEffect(() => {
    authBridge.updateToken = updateToken
    authBridge.handleSessionExpired = handleSessionExpired
  }, [updateToken, handleSessionExpired])

  return (
    <AuthContext.Provider
      value={{
        token,
        user,
        isLoggedIn,
        isAdmin,
        isModerator,
        canManageUsers,
        sessionExpired,
        dismissSessionExpired,
        login,
        register,
        forgotPassword,
        resetPassword,
        loginWithProvider,
        linkProvider,
        unlinkProvider,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

// Bridge to let the axios interceptor communicate with React state
// without circular imports
export const authBridge = {
  updateToken: (_token: string) => {},
  handleSessionExpired: () => {},
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used within an AuthProvider')
  return context
}
