import { BrowserRouter, Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom'
import Admin from './pages/Admin'
import Monitoring from './pages/Monitoring'
import Incidents from './pages/Incidents'
import PolicyOverrides from './pages/PolicyOverrides'
import PredictiveIsolation from './pages/PredictiveIsolation'
import ForensicAudit from './pages/ForensicAudit'
import ExplainableAI from './pages/ExplainableAI'
import MfaChallenge from './pages/MfaChallenge'
import ApprovalQueue from './pages/ApprovalQueue'
import { useState, useEffect } from 'react'

const API = 'http://127.0.0.1:3002'

export async function apiFetch(path, options = {}) {
  const res = await fetch(`${API}${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...options.headers }
  })
  const data = await res.json()
  if (!res.ok) { const err = new Error(data.error || 'Request failed'); err.data = data; err.status = res.status; throw err }
  return data
}

export function Icon({ name, size = 24, color = 'currentColor' }) {
  const icons = {
    settings: <path d="M12 15.5A3.5 3.5 0 0 1 8.5 12 3.5 3.5 0 0 1 12 8.5a3.5 3.5 0 0 1 3.5 3.5 3.5 3.5 0 0 1-3.5 3.5m7.43-2.53c.04-.32.07-.64.07-.97 0-.33-.03-.66-.07-1l2.11-1.63c.19-.15.24-.42.12-.64l-2-3.46c-.12-.22-.39-.31-.61-.22l-2.49 1c-.52-.39-1.06-.73-1.69-.98l-.38-2.65A.488.488 0 0 0 14 2h-4c-.25 0-.46.18-.5.42l-.37 2.65c-.63.25-1.17.59-1.69.98l-2.49-1c-.22-.09-.49 0-.61.22l-2 3.46c-.13.22-.07.49.12.64l2.11 1.63c-.04.34-.07.67-.07 1s.03.65.07.97l-2.11 1.66c-.19.15-.25.42-.12.64l2 3.46c.12.22.39.3.61.22l2.49-1c.52.4 1.06.74 1.69.99l.38 2.65c.04.24.25.42.5.42h4c.25 0 .46-.18.5-.42l.37-2.65c.63-.26 1.17-.59 1.69-.99l2.49 1c.22.08.49-.01.61-.22l2-3.46c.12-.22.07-.49-.12-.64l-2.11-1.66z" />,
    monitoring: <path d="M3 3v18h18V3H3zm16 16H5V5h14v14zM7 11h2v6H7v-6zm4-4h2v10h-2V7zm4 6h2v4h-2v-4z" />,
    incident: <path d="M12 2L1 21h22M12 6l7.53 13H4.47M11 10v4h2v-4m-2 6v2h2v-2" />,
    check: <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />,
    ai: <path d="M12 2c5.52 0 10 4.48 10 10s-4.48 10-10 10S2 17.52 2 12 6.48 2 12 2zm0 18c4.41 0 8-3.59 8-8s-3.59-8-8-8-8 3.59-8 8 3.59 8 8 8zm-1-13h2v4h-2zm0 6h2v2h-2z" />,
    shield: <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm0 19.93A10.02 10.02 0 0 1 5 11V6.3l7-3.11 7 3.11V11c0 4.34-3.51 8.52-7 9.93z" />,
  }
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={color} xmlns="http://www.w3.org/2000/svg">
      {icons[name] || <circle cx="12" cy="12" r="10" />}
    </svg>
  )
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
    { path: '/predictive-isolation', label: 'Predictive Isolation', icon: 'shield' },
    { path: '/forensic-audit', label: 'Forensic Audit', icon: 'ai' },
    { path: '/incidents', label: 'Incident Management', icon: 'incident' },
    { path: '/approvals', label: 'Approval Queue', icon: 'check', badge: pendingCount },
    { path: '/policy-overrides', label: 'Policy Overrides', icon: 'settings' },
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
                <Route path="/policy-overrides" element={<PolicyOverrides />} />
                <Route path="/predictive-isolation" element={<PredictiveIsolation />} />
                <Route path="/forensic-audit" element={<ForensicAudit />} />
                <Route path="/explainable-ai" element={<ExplainableAI />} />
                <Route path="*" element={<Navigate to="/forensic-audit" />} />
              </Routes>
            </main>
          </div>
        } />
      </Routes>
    </BrowserRouter>
  )
}
