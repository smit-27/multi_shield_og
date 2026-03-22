import { useState, useEffect, createContext, useContext } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom'
import Sidebar from './components/Sidebar'
import Login from './pages/Login'
import Treasury from './pages/Treasury'
import Loans from './pages/Loans'
import Customers from './pages/Customers'
import CustomerDetail from './pages/CustomerDetail'
import Withdrawals from './pages/Withdrawals'
import { Landmark, Search, Settings, Bell, AlertTriangle, Lock, Shield, Server, Activity, X } from 'lucide-react'
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
  if (path.startsWith('/api/')) return `/api/banking${path.substring(4)}`
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

  const [showPamDrawer, setShowPamDrawer] = useState(false)
  const [timeLeft, setTimeLeft] = useState(7200) // 2 hours

  useEffect(() => {
    const timer = setInterval(() => setTimeLeft(t => (t > 0 ? t - 1 : 0)), 1000)
    return () => clearInterval(timer)
  }, [])

  const formatTime = (seconds) => {
    const h = Math.floor(seconds / 3600).toString().padStart(2, '0')
    const m = Math.floor((seconds % 3600) / 60).toString().padStart(2, '0')
    const s = (seconds % 60).toString().padStart(2, '0')
    return `${h}:${m}:${s}`
  }

  const getPageTitle = () => {
    if (location.pathname === '/treasury') return 'Treasury & Liquidity Portal'
    if (location.pathname === '/loans') return 'Commercial Loan Management'
    if (location.pathname === '/customers') return 'Unified Customer Database'
    return 'Internal Operations'
  }

  return (
    <div className="layout-root">
      <div className="top-alert-banner paw-banner">
        <span className="blinking-dot"></span> SESSION RECORDING ACTIVE
        <span style={{opacity: 0.5, margin: '0 8px'}}>|</span>
        <Shield size={14}/> ISOLATED PAW WORKSTATION
      </div>
      
      <div className="secure-info-bar">
        <span style={{display:'flex', alignItems:'center', gap:'4px'}}><Lock size={12}/> JIT ACCESS EXPIRES IN {formatTime(timeLeft)}</span>
        <span>•</span>
        <span>SESSION: {user.session_id || Math.random().toString(36).substring(7).toUpperCase()}</span>
        <span>•</span>
        <span>WORKSTATION: PAW-NODE-{Math.floor(Math.random() * 9000 + 1000)}</span>
      </div>

      <header className="main-brand-header">
        <div className="brand-section">
          <div className="brand-logo-small">
            <BankLogo size={24} />
          </div>
          <div className="brand-text">
            <h1>NATIONAL BANK</h1>
            <p>Core Banking System — Branch Operations</p>
          </div>
        </div>

        <div className="header-badges">
          <div className="badge-outline green">● CBS ONLINE</div>
          <div className="badge-outline gold">RBI COMPLIANT</div>
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
          <div className="portal-icons" style={{display:'flex', alignItems:'center'}}>
            <button className="btn btn-sm btn-outline" style={{display:'flex', alignItems:'center', gap:'6px', background:'#f8f9fa', color:'#1a202c', border:'1px solid #d5dce6', marginRight:'12px'}} onClick={() => setShowPamDrawer(true)}>
              <Server size={14}/> My PAM Session
            </button>
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

      {showPamDrawer && (
        <>
          <div className="pam-drawer-overlay" onClick={() => setShowPamDrawer(false)}></div>
          <div className="pam-drawer">
            <div className="pam-drawer-header">
              <h3 style={{display:'flex', alignItems:'center', gap:'8px', margin:0, fontSize:'16px'}}><Server size={18}/> Privilege Context</h3>
              <button className="icon-btn" onClick={() => setShowPamDrawer(false)} style={{background:'transparent', color:'var(--text-secondary)'}}><X size={18}/></button>
            </div>
            <div className="pam-drawer-body">
              <div className="pam-section">
                <h4><Shield size={14}/> Elevated Access Level</h4>
                <p>You are currently operating with JEA (Just-Enough-Administration) rights on the banking systems. Access is strictly time-bound and actively recorded.</p>
              </div>
              <div className="pam-section">
                <h4><Lock size={14}/> Active Clearances</h4>
                <ul className="pam-list">
                  <li>Customers DB (Read/Write)</li>
                  <li>Treasury Gateway (Approve)</li>
                  <li>Loans API (Level 2 Auth)</li>
                </ul>
              </div>
              <div className="pam-section">
                <h4><Activity size={14}/> Audit Stream</h4>
                <div className="audit-log">
                  <div className="audit-item"><span className="dot success"></span> PAW connection verified unconditionally</div>
                  <div className="audit-item"><span className="dot neutral"></span> Session recording module started</div>
                  <div className="audit-item"><span className="dot danger"></span> Outbound internet gateways isolated</div>
                  <div className="audit-item"><span className="dot neutral"></span> Keystroke telemetry engaged</div>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
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
    // ZTA gateway returns access_token; banking backend returns token
    localStorage.setItem('token', data.token || data.access_token)
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
          <Route path="/login" element={user ? <Navigate to="/customers" /> : <Login />} />
          <Route path="/*" element={<Layout />} />
        </Routes>
      </BrowserRouter>
    </AuthContext.Provider>
  )
}
