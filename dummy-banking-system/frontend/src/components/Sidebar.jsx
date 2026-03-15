import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth, BankLogo } from '../App'

const navItems = [
  { path: '/treasury', label: 'Treasury Operations', icon: '🏛️' },
  { path: '/loans', label: 'Loan Management', icon: '📋' },
  { path: '/customers', label: 'Customer Database', icon: '👥' },
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
        {navItems.map(item => (
          <button
            key={item.path}
            className={`nav-item ${location.pathname === item.path ? 'active' : ''}`}
            onClick={() => navigate(item.path)}
          >
            <span className="icon">{item.icon}</span>
            {item.label}
          </button>
        ))}
      </nav>

      <div className="sidebar-footer-info">
        <p><strong>National Bank of India</strong><br/>
        Internal Secure Operations<br/>
        v2.4.1-PROD</p>
      </div>
    </aside>
  )
}
