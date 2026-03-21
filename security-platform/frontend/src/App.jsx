import { BrowserRouter, Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom'
import Admin from './pages/Admin'
import Incidents from './pages/Incidents'
import PolicyOverrides from './pages/PolicyOverrides'
import MfaChallenge from './pages/MfaChallenge'
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


const COLORS = {
  base: '#0A0C0F',
  surface: '#0F1217',
  elevated: '#151921',
  accent: '#3D7EFF',
  borderLight: 'rgba(255,255,255,0.055)',
  border: 'rgba(255,255,255,0.11)',
  textPrimary: '#E8EAF0',
  textSecondary: '#6B7280',
  textTertiary: '#3D4451',
  mono: '#A8B5C8',
  highBg: 'rgba(139,38,53,0.15)',
  highText: '#C4404F',
  medBg: 'rgba(122,92,30,0.15)',
  medText: '#C49A3C',
  lowBg: 'rgba(28,74,53,0.15)',
  lowText: '#3D9E6E',
};

const injectedStyles = `
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500&family=Syne:wght@600;700&family=IBM+Plex+Mono:wght@400&display=swap');

.dashboard-root {
  font-family: 'Inter', sans-serif;
  color: ${COLORS.textPrimary};
  background-color: ${COLORS.base};
}
.font-syne {
  font-family: 'Syne', sans-serif;
}
.font-mono {
  font-family: 'IBM Plex Mono', monospace;
}
.transition-fast {
  transition: all 0.1s ease;
}
*:focus-visible {
  outline: 1px solid ${COLORS.accent};
  outline-offset: 2px;
}
.custom-scrollbar::-webkit-scrollbar {
  width: 4px;
}
.custom-scrollbar::-webkit-scrollbar-track {
  background: transparent;
}
.custom-scrollbar::-webkit-scrollbar-thumb {
  background: rgba(255,255,255,0.1);
  border-radius: 0px;
}
.recharts-tooltip-wrapper {
  outline: none !important;
}
`;

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
    { path: '/incidents', label: 'Incident Management', icon: 'incident', badge: pendingCount },
    { path: '/policy-overrides', label: 'Policy Overrides', icon: 'settings' },
  ]

  return (
    <aside 
      style={{ width: '212px', backgroundColor: COLORS.base, borderRight: `1px solid ${COLORS.borderLight}` }}
      className="flex flex-col flex-shrink-0 h-screen"
    >
      {/* Logo Area */}
      <div style={{ padding: '24px 20px', borderBottom: `1px solid ${COLORS.borderLight}` }}>
        <div className="flex items-center gap-2 mb-1">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={COLORS.textPrimary} strokeWidth="2.5" strokeLinecap="square" strokeLinejoin="miter">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          </svg>
          <span className="font-syne" style={{ fontSize: '13px', fontWeight: 700, letterSpacing: '0.15em', color: COLORS.textPrimary, textTransform: 'uppercase' }}>MULTISHIELD</span>
        </div>
        <div style={{ fontSize: '9px', color: COLORS.textTertiary, letterSpacing: '0.2em', textTransform: 'uppercase', paddingLeft: '26px' }}>
          ZERO TRUST PLATFORM
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1" style={{ paddingTop: '24px', paddingBottom: '24px' }}>
        {items.map(item => {
          const isActive = location.pathname === item.path;
          return (
            <div 
              key={item.path}
              className="flex items-center justify-between cursor-pointer transition-fast" 
              style={{ 
                height: '44px',
                padding: '0 16px 0 16px', 
                backgroundColor: isActive ? 'rgba(61,126,255,0.06)' : 'transparent', 
                borderLeft: `3px solid ${isActive ? COLORS.accent : 'transparent'}`
              }}
              onClick={() => navigate(item.path)}
            >
              <div className="flex items-center gap-3">
                <div style={{ opacity: isActive ? 1 : 0.4 }}>
                  <Icon name={item.icon} size={18} color={isActive ? COLORS.accent : COLORS.textPrimary} />
                </div>
                <span style={{ fontSize: '14px', fontWeight: 500, color: isActive ? COLORS.textPrimary : COLORS.textSecondary }}>{item.label}</span>
              </div>
              
              {item.badge > 0 && (
                <span className="font-mono" style={{ fontSize: '11px', backgroundColor: COLORS.highBg, color: COLORS.highText, padding: '2px 6px', borderRadius: '4px' }}>{item.badge}</span>
              )}
            </div>
          )
        })}
      </nav>

      {/* User Info Bottom */}
      <div style={{ padding: '20px', borderTop: `1px solid ${COLORS.borderLight}` }} className="flex items-center gap-3">
        <div className="font-mono" style={{ width: '28px', height: '28px', backgroundColor: COLORS.elevated, border: `1px solid rgba(255,255,255,0.08)`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', color: COLORS.textPrimary, borderRadius: '2px' }}>
          SA
        </div>
        <div className="flex flex-col">
          <span style={{ fontSize: '13px', fontWeight: 500, color: COLORS.textPrimary }}>System Admin</span>
          <span style={{ fontSize: '11px', color: COLORS.textSecondary }}>Superuser</span>
        </div>
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
          <div className="dashboard-root flex overflow-hidden w-screen h-screen">
            <style>{injectedStyles}</style>
            <Sidebar />
            <main className="flex-1 overflow-y-auto custom-scrollbar" style={{ backgroundColor: COLORS.base }}>
              <div style={{ maxWidth: '1400px', margin: '0 auto 0 0', width: '100%', padding: '0' }}>
                <Routes>
                  <Route path="/admin" element={<Admin />} />
                  <Route path="/incidents" element={<Incidents />} />
                  <Route path="/policy-overrides" element={<PolicyOverrides />} />
                  <Route path="*" element={<Navigate to="/admin" />} />
                </Routes>
              </div>
            </main>
          </div>
        } />
      </Routes>
    </BrowserRouter>
  )
}
