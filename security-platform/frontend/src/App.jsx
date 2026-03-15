import { BrowserRouter, Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom'
import Admin from './pages/Admin'
import Monitoring from './pages/Monitoring'
import Incidents from './pages/Incidents'
import ExplainableAI from './pages/ExplainableAI'
import Icon from './components/Icon'

const API = 'http://localhost:3002'

export async function apiFetch(path, options = {}) {
  const res = await fetch(`${API}${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...options.headers }
  })
  const data = await res.json()
  if (!res.ok) { const err = new Error(data.error || 'Request failed'); err.data = data; throw err }
  return data
}

function Sidebar() {
  const location = useLocation()
  const navigate = useNavigate()
  const items = [
    { path: '/admin', label: 'Admin Dashboard', icon: 'settings' },
    { path: '/monitoring', label: 'Live Monitoring', icon: 'monitoring' },
    { path: '/incidents', label: 'Incident Management', icon: 'incident' },
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
            <span className="icon"><Icon name={item.icon} size={20} /></span>{item.label}
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

export default function App() {
  return (
    <BrowserRouter>
      <div className="layout">
        <Sidebar />
        <main className="main-content">
          <Routes>
            <Route path="/admin" element={<Admin />} />
            <Route path="/monitoring" element={<Monitoring />} />
            <Route path="/incidents" element={<Incidents />} />
            <Route path="/explainable-ai" element={<ExplainableAI />} />
            <Route path="*" element={<Navigate to="/monitoring" />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  )
}
