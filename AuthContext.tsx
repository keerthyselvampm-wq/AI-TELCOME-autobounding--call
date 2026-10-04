import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react'
import { api } from '../api/client'

interface AuthUser {
  username: string
  role: string
}

interface AuthContextType {
  user: AuthUser | null
  token: string | null
  isLoading: boolean
  login: (username: string, password: string) => Promise<void>
  logout: () => void
  isAuthenticated: boolean
}

const AuthContext = createContext<AuthContextType | null>(null)

const STORAGE_KEY = 'vdart_auth'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [token, setToken] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored) {
        const data = JSON.parse(stored)
        if (data.token && data.user) {
          setToken(data.token)
          setUser(data.user)
          api.setToken(data.token)
        }
      }
    } catch { }
    setIsLoading(false)
  }, [])

  const login = useCallback(async (username: string, password: string) => {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    })
    if (!res.ok) {
      const err = await res.json()
      throw new Error(err.detail || 'Login failed')
    }
    const data = await res.json()
    setToken(data.access_token)
    setUser({ username: data.username, role: data.role })
    api.setToken(data.access_token)
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      token: data.access_token,
      user: { username: data.username, role: data.role },
    }))
  }, [])

  const logout = useCallback(() => {
    setToken(null)
    setUser(null)
    api.setToken(null)
    localStorage.removeItem(STORAGE_KEY)
  }, [])

  return (
    <AuthContext.Provider value={{ user, token, isLoading, login, logout, isAuthenticated: !!token }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
