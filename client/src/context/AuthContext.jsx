import { createContext, useContext, useState, useEffect } from 'react'
import { API } from '../utils/constants'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [token, setToken] = useState(null)
  const [loading, setLoading] = useState(true)

  // Hydrate permissions from backend when they're missing from local storage.
  // This handles users who logged in BEFORE Chunk 5 shipped.
  async function hydratePermissions(tok, baseUser) {
    try {
      const res = await fetch(`${API}/me/permissions`, {
        headers: { Authorization: 'Bearer ' + tok }
      })
      if (!res.ok) return null
      const data = await res.json()
      return {
        ...baseUser,
        permissions_resolved: data.permissions,
        scope: data.scope
      }
    } catch {
      return null
    }
  }

  useEffect(() => {
    const savedToken = localStorage.getItem('token')
    const savedUser = localStorage.getItem('user')
    if (!savedToken || !savedUser) {
      setLoading(false)
      return
    }

    const parsedUser = JSON.parse(savedUser)
    setToken(savedToken)
    setUser(parsedUser)

    // If permissions_resolved is missing (old session from before Chunk 5), hydrate.
    if (parsedUser.permissions_resolved === undefined) {
      hydratePermissions(savedToken, parsedUser).then(updated => {
        if (updated) {
          setUser(updated)
          localStorage.setItem('user', JSON.stringify(updated))
        }
        setLoading(false)
      })
    } else {
      setLoading(false)
    }
  }, [])

  async function login(email, password) {
    const res = await fetch(`${API}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || 'Login failed')
    setUser(data.user)
    setToken(data.token)
    localStorage.setItem('token', data.token)
    localStorage.setItem('user', JSON.stringify(data.user))
    return data.user
  }

  function logout() {
    setUser(null)
    setToken(null)
    localStorage.removeItem('token')
    localStorage.removeItem('user')
  }

  function updateUser(updates) {
    const updated = { ...user, ...updates }
    setUser(updated)
    localStorage.setItem('user', JSON.stringify(updated))
  }

  // Permission helper — checks if the current user has a named permission.
  // Director and super_admin always return true.
  function hasPermission(permName) {
    if (!user) return false
    if (user.role === 'director' || user.is_super_admin) return true
    if (!user.permissions_resolved) return false
    return user.permissions_resolved[permName] === true
  }

  // Scope helper — returns 'workspace_wide' or 'project_only' (or default).
  function getScope() {
    if (!user) return 'project_only'
    if (user.role === 'director' || user.is_super_admin) return 'workspace_wide'
    return user.scope || 'project_only'
  }

  const isDirector = user?.role === 'director'
  const isManager = user?.role === 'manager' || isDirector
  const isSeniorConsultant = user?.role === 'senior_consultant' || isManager

  return (
    <AuthContext.Provider value={{
      user, token, loading,
      login, logout, updateUser,
      isDirector, isManager, isSeniorConsultant,
      hasPermission, getScope,
      authHeader: token ? { Authorization: 'Bearer ' + token } : {}
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}