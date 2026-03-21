import { useState, useEffect, createContext, useContext } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom'
import Sidebar from './components/Sidebar'
import Login from './pages/Login'
import Treasury from './pages/Treasury'
import Loans from './pages/Loans'
import Customers from './pages/Customers'
import CustomerDetail from './pages/CustomerDetail'
import Withdrawals from './pages/Withdrawals'
import { Landmark, Search, Settings, Bell, AlertTriangle, Lock } from 'lucide-react'
const API = 'http://127.0.0.1:3002'

export const AuthContext = createContext(null)

export function useAuth() { return useContext(AuthContext) }

export function BankLogo({ size = 48 }) {
  return (
    <div className="bank-logo-v2" style={{ width: size, height: size, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0d2240', borderRadius: '50%', color: 'white' }}>
      <Landmark size={size * 0.55} />
    </div>
  )
}

/**
 * Remap paths so that banking operations go through the ZTA gateway:
 *   /api/auth/login  → /api/zta/login
 *   /api/auth/me     → /api/zta/session
 *   /api/auth/logout → /api/zta/logout
 *   /api/*           → /api/banking/* (proxied through ZTA middleware)
 */
function remapPath(path) {
  if (path === '/api/auth/login') return '/api/zta/login'
  if (path === '/api/auth/me') return '/api/zta/session'
  if (path === '/api/auth/logout') return '/api/zta/logout'
  if (path.startsWith('/api/zta/')) return path
  if (path.startsWith('/api/')) return '/api/banking' + path.slice(4)
  return path
}

export async function apiFetch(path, options = {}) {
  const token = localStorage.getItem('token')
  const overridesStr = localStorage.getItem('zta-overrides')
  
  let overrideHeaders = {}
  if (overridesStr) {
    try {
      const parsed = JSON.parse(overridesStr)
      if (parsed.amountLimit) overrideHeaders['x-zta-override-amount'] = String(parsed.amountLimit)
      if (parsed.criticalRiskScore) overrideHeaders['x-zta-override-risk-block'] = String(parsed.criticalRiskScore)
      if (parsed.sandboxRiskScore) overrideHeaders['x-zta-override-risk-sandbox'] = String(parsed.sandboxRiskScore)
      if (parsed.temporalOverride != null) overrideHeaders['x-zta-override-time'] = String(parsed.temporalOverride)
    } catch(e) {}
  }

  const mappedPath = remapPath(path)
  const res = await fetch(`${API}${mappedPath}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...overrideHeaders,
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
      <div className="top-alert-banner" style={{display:'flex', alignItems:'center', justifyContent:'center', gap:'6px'}}>
        <AlertTriangle size={14}/> CONFIDENTIAL SYSTEM: All operations are logged and monitored by the Federal Security Council. Unauthorized access is a felony.
      </div>
      
      <div className="secure-info-bar">
        <span style={{display:'flex', alignItems:'center', gap:'4px'}}><Lock size={12}/> SECURE END-TO-END ENCRYPTION ACTIVE</span>
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
            <button className="icon-btn"><Search size={14}/></button>
            <button className="icon-btn"><Settings size={14}/></button>
            <button className="icon-btn"><Bell size={14}/></button>
          </div>
        </div>
      </div>

      <div className="layout-body">
        <Sidebar />
        <main className="main-content">
          <Routes>
            <Route path="/treasury" element={<Treasury />} />
            <Route path="/withdrawals" element={<Withdrawals />} />
            <Route path="/loans" element={<Loans />} />
            <Route path="/customers" element={<Customers />} />
            <Route path="/customers/:id" element={<CustomerDetail />} />
            <Route path="*" element={<Navigate to="/customers" />} />
          </Routes>
        </main>
      </div>

      <div className="float-branding">
        <span className="float-logo"><Landmark size={14}/></span>
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
      apiFetch('/api/zta/session')
        .then(d => setUser(d.user))
        .catch(() => { localStorage.removeItem('token'); setUser(null) })
        .finally(() => setLoading(false))
    } else {
      setLoading(false)
    }
  }, [])

  const login = async (username, password) => {
    const data = await apiFetch('/api/zta/login', {
      method: 'POST',
      body: JSON.stringify({ username, password })
    })
    // ZTA gateway returns access_token; banking backend returns token
    localStorage.setItem('token', data.access_token || data.token)
    setUser(data.user)
    return data
  }

  const logout = () => {
    apiFetch('/api/zta/logout', { method: 'POST' }).catch(() => {})
    localStorage.removeItem('token')
    setUser(null)
  }

  if (loading) return <div className="loading-screen"><div className="spinner" /><p>Loading...</p></div>

  return (
    <AuthContext.Provider value={{ user, login, logout }}>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={user ? <Navigate to="/customers" /> : <Login />} />
          <Route path="/*" element={<Layout />} />
        </Routes>
      </BrowserRouter>
    </AuthContext.Provider>
  )
}
