import { BrowserRouter, Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom'
import Admin from './pages/Admin'
import Monitoring from './pages/Monitoring'
import Incidents from './pages/Incidents'
import ExplainableAI from './pages/ExplainableAI'
import MfaChallenge from './pages/MfaChallenge'
import ApprovalQueue from './pages/ApprovalQueue'
import { useState, useEffect } from 'react'

const API = 'http://localhost:3002'

export async function apiFetch(path, options = {}) {
  const res = await fetch(`${API}${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...options.headers }
  })
  const data = await res.json()
  if (!res.ok) { const err = new Error(data.error || 'Request failed'); err.data = data; err.status = res.status; throw err }
  return data
}

function Sidebar() {
  const location = useLocation()
  const navigate = useNavigate()
  const [pendingCount, setPendingCount] = useState(0)

  useEffect(() => {
    const fetchPending = () => {
      apiFetch('/api/approvals/stats').then(d => setPendingCount(d.pending || 0)).catch(() => {})
    }
    fetchPending()
    const interval = setInterval(fetchPending, 5000)
    return () => clearInterval(interval)
  }, [])

  const items = [
    { path: '/admin', label: 'Admin Dashboard', icon: 'settings' },
    { path: '/monitoring', label: 'Live Monitoring', icon: 'monitoring' },
    { path: '/incidents', label: 'Incident Management', icon: 'incident' },
    { path: '/approvals', label: 'Approval Queue', icon: 'check', badge: pendingCount },
    { path: '/explainable-ai', label: 'Explainable AI', icon: 'ai' },
  ]

  return (
    <aside className="sidebar">
      <div className="sidebar-logo">
        <h1><span><Icon name="shield" size={32} /></span> MultiShield</h1>
        <p>Zero Trust Security</p>
      </div>
      <nav className="sidebar-nav">
        {items.map(item => (
          <button key={item.path}
            className={`nav-item ${location.pathname === item.path ? 'active' : ''}`}
            onClick={() => navigate(item.path)}>
            <span className="icon"><Icon name={item.icon} size={20} /></span>
            {item.label}
            {item.badge > 0 && <span className="nav-badge">{item.badge}</span>}
          </button>
        ))}
      </nav>
      <div className="sidebar-footer">
        <div className="status-indicator"><span className="pulse" /> System Active</div>
        <div className="version">v1.0 — AI Engine Online</div>
      </div>
    </aside>
  )
}

// MFA page has its own layout (no sidebar)
function MfaLayout() {
  return (
    <div className="mfa-fullpage">
      <Routes>
        <Route path=":challengeId" element={<MfaChallenge />} />
      </Routes>
    </div>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* MFA routes use a separate fullscreen layout */}
        <Route path="/mfa/*" element={<MfaLayout />} />
        
        {/* Main app layout with sidebar */}
        <Route path="/*" element={
          <div className="layout">
            <Sidebar />
            <main className="main-content">
              <Routes>
                <Route path="/admin" element={<Admin />} />
                <Route path="/monitoring" element={<Monitoring />} />
                <Route path="/incidents" element={<Incidents />} />
                <Route path="/approvals" element={<ApprovalQueue />} />
                <Route path="/explainable-ai" element={<ExplainableAI />} />
                <Route path="*" element={<Navigate to="/monitoring" />} />
              </Routes>
            </main>
          </div>
        } />
      </Routes>
    </BrowserRouter>
  )
}
