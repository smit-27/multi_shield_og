import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth, BankLogo } from '../App'
import { Landmark, FileText, Users, ArrowDownToLine, User, LogOut, Clock } from 'lucide-react'

const navItems = [
  { path: '/customers', label: 'Customer Database', icon: Users },
  { path: '/treasury', label: 'Treasury & Settlements', icon: Landmark },
  { path: '/withdrawals', label: 'Cash Management', icon: ArrowDownToLine },
  { path: '/loans', label: 'Credit & Lending', icon: FileText },
]

export default function Sidebar() {
  const { user, logout } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()

  const now = new Date()
  const loginTime = new Date(now.getTime() - Math.random() * 3600000)

  return (
    <aside className="sidebar">
      <div className="sidebar-brand-box">
        <BankLogo size={42} />
        <div className="brand-name-large">National Bank</div>
      </div>

      {/* Logged-in User Info */}
      <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', background: 'rgba(0,0,0,0.02)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
          <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: 'var(--accent)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px', fontWeight: '600' }}>
            {user?.name ? user.name.split(' ').map(n => n[0]).join('') : 'U'}
          </div>
          <div>
            <div style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-primary)' }}>{user?.name || user?.username || 'Officer'}</div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>{user?.role || 'Branch Officer'}</div>
          </div>
        </div>
        <div style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
          <Clock size={10}/> Last login: {loginTime.toLocaleString('en-IN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: 'short' })}
        </div>
      </div>

      <nav className="sidebar-nav">
        <div style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.8px', padding: '16px 20px 8px', fontWeight: '700' }}>
          Main Menu
        </div>
        {navItems.map(item => {
          const IconComponent = item.icon
          const isActive = item.path === '/customers' 
            ? location.pathname.startsWith('/customers')
            : location.pathname === item.path
          return (
            <button
              key={item.path}
              className={`nav-item ${isActive ? 'active' : ''}`}
              onClick={() => navigate(item.path)}
            >
              <span className="icon"><IconComponent size={18} /></span>
              {item.label}
            </button>
          )
        })}
      </nav>

      <div className="sidebar-footer-info">
        <p><strong>National Bank of India</strong><br/>
        RBI Licensed — NABARD Reg.<br/>
        CBS Core v4.2.1 | Branch: HQ-001</p>
        <button 
          onClick={() => { logout(); navigate('/login') }}
          style={{ marginTop: '8px', background: 'transparent', border: '1px solid var(--border)', color: 'var(--text-muted)', padding: '6px 12px', borderRadius: '4px', cursor: 'pointer', width: '100%', fontSize: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
        >
          <LogOut size={12}/> Sign Out
        </button>
      </div>
    </aside>
  )
}
