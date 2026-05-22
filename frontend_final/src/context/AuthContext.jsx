import React, { createContext, useContext, useState, useEffect, useCallback } from 'react'
import api from '../api/client'
import { DEMO_USERS } from '../data/demoData'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [isDemoMode, setIsDemoMode] = useState(false)

  // Hydrate user from localStorage on mount & validate token
  useEffect(() => {
    const stored = localStorage.getItem('sf_user')
    const token = localStorage.getItem('sf_token')
    if (stored && token) {
      setUser(JSON.parse(stored))
      // Validate token in background
      api.get('/auth/me').then(res => {
        const userData = res.data
        localStorage.setItem('sf_user', JSON.stringify(userData))
        setUser(userData)
      }).catch(() => {
        // Token expired — clear session
        localStorage.removeItem('sf_token')
        localStorage.removeItem('sf_user')
        sessionStorage.removeItem('demo_user')
        setUser(null)
      }).finally(() => setLoading(false))
    } else {
      setLoading(false)
    }
  }, [])

  // Emails are stored case-insensitively on the backend; normalize here too so
  // the form value the user typed always matches the canonical record.
  const normalizeEmail = (e) => (e || '').trim().toLowerCase()

  const login = async (email, password) => {
    sessionStorage.removeItem('demo_user')
    const res = await api.post('/auth/login', { email: normalizeEmail(email), password })
    const { access_token, user: userData } = res.data
    localStorage.setItem('sf_token', access_token)
    localStorage.setItem('sf_user', JSON.stringify(userData))
    setUser(userData)
    setIsDemoMode(false)
    return userData
  }

  const register = async (email, name, password, role = 'student') => {
    sessionStorage.removeItem('demo_user')
    const res = await api.post('/auth/register', {
      email: normalizeEmail(email),
      name,
      password,
      role,
    })
    const { access_token, user: userData } = res.data
    localStorage.setItem('sf_token', access_token)
    localStorage.setItem('sf_user', JSON.stringify(userData))
    setUser(userData)
    setIsDemoMode(false)
    return userData
  }

  const logout = () => {
    localStorage.removeItem('sf_token')
    localStorage.removeItem('sf_user')
    sessionStorage.removeItem('demo_user')
    setUser(null)
    setIsDemoMode(false)
  }

  const refreshUser = async () => {
    if (isDemoMode) return
    try {
      const res = await api.get('/auth/me')
      const userData = res.data
      localStorage.setItem('sf_user', JSON.stringify(userData))
      setUser(userData)
    } catch { }
  }

  const enterDemoMode = useCallback((role = 'student') => {
    localStorage.removeItem('sf_token')
    localStorage.removeItem('sf_user')
    const demoUser = role === 'admin' ? DEMO_USERS.admin : DEMO_USERS.student
    sessionStorage.setItem('demo_user', JSON.stringify(demoUser))
    setUser(demoUser)
    setIsDemoMode(true)
    return demoUser
  }, [])

  const exitDemoMode = useCallback(() => {
    sessionStorage.removeItem('demo_user')
    setUser(null)
    setIsDemoMode(false)
  }, [])

  return (
    <AuthContext.Provider value={{
      user, login, register, logout, refreshUser, loading,
      isDemoMode, enterDemoMode, exitDemoMode
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
