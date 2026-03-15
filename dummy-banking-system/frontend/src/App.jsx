import { useState, useEffect, createContext, useContext } from 'react'
import Icon from './components/Icon'
import { BrowserRouter, Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom'
import Sidebar from './components/Sidebar'
import Login from './pages/Login'
import Treasury from './pages/Treasury'
import Loans from './pages/Loans'
import Customers from './pages/Customers'

const API = 'http://localhost:3001'

export const AuthContext = createContext(null)

export function useAuth() { return useContext(AuthContext) }

export function BankLogo({ size = 48 }) {
  return (
    <div className="bank-logo-v2" style={{ width: size, height: size, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0d2240', borderRadius: '50%', color: 'white' }}>
      <Icon name="shield" size={size * 0.6} />
    </div>
  )
}

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
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  if (!user) return <Navigate to="/login" />

  const getPageTitle = () => {
    if (location.pathname === '/treasury') return 'Treasury & Liquidity Portal'
    if (location.pathname === '/loans') return 'Commercial Loan Management'
    if (location.pathname === '/customers') return 'Unified Customer Database'
    return 'Internal Operations'
  }

  return (
    <div className="layout-root">
      <div className="top-alert-banner">
        <Icon name="warning" size={14} /> CONFIDENTIAL SYSTEM: All operations are logged and monitored by the Federal Security Council. Unauthorized access is a felony.
      </div>
      
      <div className="secure-info-bar">
        <span><Icon name="shield" size={12} /> SECURE END-TO-END ENCRYPTION ACTIVE</span>
        <span>•</span>
        <span>SESSION: {Math.random().toString(36).substring(7).toUpperCase()}</span>
        <span>•</span>
        <span>WORKSTATION: NODE-IX-{Math.floor(Math.random() * 9000 + 1000)}</span>
      </div>

      <header className="main-brand-header">
        <div className="brand-section">
          <div className="brand-logo-small">
            <BankLogo size={24} />
          </div>
          <div className="brand-text">
            <h1>NATIONAL BANK</h1>
            <p>Institutional Banking & Markets</p>
          </div>
        </div>

        <div className="header-badges">
          <div className="badge-outline green">● SYSTEM ONLINE</div>
          <div className="badge-outline gold">TRUSTED NODE</div>
          <a href="#" className="access-link" onClick={(e) => { e.preventDefault(); logout(); navigate('/login'); }}>TERMINATE SESSION</a>
        </div>
      </header>

      <div className="customer-portal-strip">
        <div className="portal-title">{getPageTitle()}</div>
        <div className="portal-controls">
          <div className="lang-selector">
            <span>Terminal Language:</span>
            <select className="language-select"><option>English (US)</option></select>
          </div>
          <div className="portal-icons">
            <button className="icon-btn"><Icon name="customers" size={18} /></button>
            <button className="icon-btn"><Icon name="settings" size={18} /></button>
            <button className="icon-btn"><Icon name="incident" size={18} /></button>
          </div>
        </div>
      </div>

      <div className="layout-body">
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

      <div className="float-branding">
        <span className="float-logo"><Icon name="treasury" size={24} color="var(--primary-light)" /></span>
        National Bank of India
      </div>
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
