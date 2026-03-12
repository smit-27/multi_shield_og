import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../App'

const navItems = [
  { path: '/treasury', label: 'Treasury Operations', icon: '🏛️' },
  { path: '/loans', label: 'Loan Management', icon: '📋' },
  { path: '/customers', label: 'Customer Database', icon: '👥' },
]

export default function Sidebar() {
  const { user, logout } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()

  const initials = user?.full_name?.split(' ').map(n => n[0]).join('') || '?'

  return (
    <aside className="sidebar">
      <div className="sidebar-logo">
        <h1><span>🏦</span> SecureBank</h1>
        <p>Internal Operations</p>
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

      <div className="sidebar-user">
        <div className="user-avatar">{initials}</div>
        <div className="user-info">
          <div className="name">{user?.full_name}</div>
          <div className="role">{user?.role}</div>
        </div>
        <button className="btn-logout" onClick={() => { logout(); navigate('/login'); }} title="Logout">⏻</button>
      </div>
    </aside>
  )
}
