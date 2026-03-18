import { createContext, useContext, useState, useMemo, type ReactNode } from 'react'
import api from '../api/client'

interface User {
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
  login: (email: string, password: string) => Promise<unknown>
  register: (email: string, fullName: string, password: string) => Promise<unknown>
  forgotPassword: (email: string) => Promise<unknown>
  resetPassword: (resetToken: string, newPassword: string) => Promise<unknown>
  logout: () => void
}

const AuthContext = createContext<AuthContextType | null>(null)

function decodeToken(token: string): User | null {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]))
    return { email: payload.sub, userType: payload.type, exp: payload.exp }
  } catch {
    return null
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('token'))

  const user = useMemo(() => (token ? decodeToken(token) : null), [token])

  const login = async (email: string, password: string) => {
    const res = await api.post('/api/auth/login', { email, password })
    const t = res.data.access_token
    localStorage.setItem('token', t)
    setToken(t)
    return res.data
  }

  const register = async (email: string, fullName: string, password: string) => {
    const res = await api.post('/api/auth/register', {
      email,
      full_name: fullName,
      password,
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

  const logout = () => {
    localStorage.removeItem('token')
    setToken(null)
  }

  const isLoggedIn = !!token && !!user
  const isAdmin = user?.userType === 'admin' || user?.userType === 'superuser'
  const isModerator = user?.userType === 'moderator'
  const canManageUsers = isAdmin || isModerator

  return (
    <AuthContext.Provider
      value={{
        token,
        user,
        isLoggedIn,
        isAdmin,
        isModerator,
        canManageUsers,
        login,
        register,
        forgotPassword,
        resetPassword,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used within an AuthProvider')
  return context
}
