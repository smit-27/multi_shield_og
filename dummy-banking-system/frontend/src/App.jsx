import { useState, useEffect, createContext, useContext } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom'
import Sidebar from './components/Sidebar'
import Login from './pages/Login'
import Treasury from './pages/Treasury'
import Loans from './pages/Loans'
import Customers from './pages/Customers'

const API = 'http://localhost:3001'

export const AuthContext = createContext(null)

export function useAuth() { return useContext(AuthContext) }

export async function apiFetch(path, options = {}) {
  const token = localStorage.getItem('token')
  const res = await fetch(`${API}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers
    }
  })
  const data = await res.json()
  if (!res.ok) {
    const err = new Error(data.message || data.error || 'Request failed')
    err.status = res.status
    err.data = data
    throw err
  }
  return data
}

function Layout() {
  const { user } = useAuth()
  if (!user) return <Navigate to="/login" />
  return (
    <div className="layout">
      <Sidebar />
      <main className="main-content">
        <Routes>
          <Route path="/treasury" element={<Treasury />} />
          <Route path="/loans" element={<Loans />} />
          <Route path="/customers" element={<Customers />} />
          <Route path="*" element={<Navigate to="/treasury" />} />
        </Routes>
      </main>
    </div>
  )
}

export default function App() {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const token = localStorage.getItem('token')
    if (token) {
      apiFetch('/api/auth/me')
        .then(d => setUser(d.user))
        .catch(() => { localStorage.removeItem('token'); setUser(null) })
        .finally(() => setLoading(false))
    } else {
      setLoading(false)
    }
  }, [])

  const login = async (username, password) => {
    const data = await apiFetch('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password })
    })
    localStorage.setItem('token', data.token)
    setUser(data.user)
    return data
  }

  const logout = () => {
    apiFetch('/api/auth/logout', { method: 'POST' }).catch(() => {})
    localStorage.removeItem('token')
    setUser(null)
  }

  if (loading) return <div className="loading-screen"><div className="spinner" /><p>Loading...</p></div>

  return (
    <AuthContext.Provider value={{ user, login, logout }}>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={user ? <Navigate to="/treasury" /> : <Login />} />
          <Route path="/*" element={<Layout />} />
        </Routes>
      </BrowserRouter>
    </AuthContext.Provider>
  )
}
