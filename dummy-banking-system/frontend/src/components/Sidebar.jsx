import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth, BankLogo } from '../App'
import { Landmark, FileText, Users, ArrowDownToLine, Lock } from 'lucide-react'

const navItems = [
  { path: '/customers', label: 'Vaulted Profiles', icon: Users },
  { path: '/treasury', label: 'Treasury Systems', icon: Landmark },
  { path: '/withdrawals', label: 'Core Transfers', icon: ArrowDownToLine },
  { path: '/loans', label: 'Loan Gateway', icon: FileText },
]

export default function Sidebar() {
  const { user, logout } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()

  return (
    <aside className="sidebar">
      <div className="sidebar-brand-box">
        <BankLogo size={42} />
        <div className="brand-name-large">National Bank</div>
      </div>

      <nav className="sidebar-nav">
        <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', padding: '12px 20px', fontWeight: '600' }}>
          Active Vault Sessions
        </div>
        {navItems.map(item => {
          const IconComponent = item.icon
          return (
            <button
              key={item.path}
              className={`nav-item ${location.pathname === item.path ? 'active' : ''}`}
              onClick={() => navigate(item.path)}
            >
              <span className="icon"><IconComponent size={18} /></span>
              {item.label}
            </button>
          )
        })}

        <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', padding: '12px 20px', fontWeight: '600', marginTop: '16px' }}>
          Access Control
        </div>
        <button className="nav-item">
          <span className="icon"><Lock size={18} /></span>
          Pending Approvals
          <span style={{ marginLeft: 'auto', background: 'var(--danger)', color: 'white', fontSize: '11px', padding: '2px 8px', borderRadius: '12px', fontWeight: 'bold' }}>2</span>
        </button>
      </nav>

      <div className="sidebar-footer-info">
        <p><strong>National Bank of India</strong><br/>
        Internal Secure Operations<br/>
        v2.4.1-PROD</p>
      </div>
    </aside>
  )
}
