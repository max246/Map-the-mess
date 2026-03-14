import { createContext, useContext, useState, useMemo } from 'react'
import api from '../api/client'

const AuthContext = createContext(null)

function decodeToken(token) {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]))
    return { email: payload.sub, userType: payload.type, exp: payload.exp }
  } catch {
    return null
  }
}

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem('token'))

  const user = useMemo(() => (token ? decodeToken(token) : null), [token])

  const login = async (email, password) => {
    const res = await api.post('/api/auth/login', { email, password })
    const t = res.data.access_token
    localStorage.setItem('token', t)
    setToken(t)
    return res.data
  }

  const register = async (email, fullName, password) => {
    const res = await api.post('/api/auth/register', {
      email,
      full_name: fullName,
      password,
    })
    return res.data
  }

  const forgotPassword = async (email) => {
    const res = await api.post('/api/auth/forgot-password', { email })
    return res.data
  }

  const resetPassword = async (resetToken, newPassword) => {
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
  return useContext(AuthContext)
}
