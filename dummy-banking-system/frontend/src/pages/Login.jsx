import { useState } from 'react'
import { useAuth, apiFetch } from '../App'

export default function Login() {
  const { login } = useAuth()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await login(username, password)
    } catch (err) {
      setError(err.message || 'Login failed')
    } finally {
      setLoading(false)
    }
  }

  const fillCredentials = (u, p) => { setUsername(u); setPassword(p) }

  return (
    <div className="login-container">
      <div className="login-card">
        <h1>🏦 SecureBank</h1>
        <p className="subtitle">Internal Operations Portal</p>

        {error && <div className="login-error">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Username</label>
            <input className="form-input" type="text" value={username} onChange={e => setUsername(e.target.value)} placeholder="Enter username" required />
          </div>
          <div className="form-group">
            <label>Password</label>
            <input className="form-input" type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Enter password" required />
          </div>
          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? 'Authenticating...' : 'Sign In'}
          </button>
        </form>

        <div className="credentials-hint">
          <h4>Demo Accounts</h4>
          <div className="hint-row" onClick={() => fillCredentials('rajesh.kumar', 'pass123')} style={{cursor:'pointer'}}>
            <span>🏛️ rajesh.kumar</span><span>Treasury Operator</span>
          </div>
          <div className="hint-row" onClick={() => fillCredentials('priya.sharma', 'pass123')} style={{cursor:'pointer'}}>
            <span>📋 priya.sharma</span><span>Loan Officer</span>
          </div>
          <div className="hint-row" onClick={() => fillCredentials('amit.patel', 'pass123')} style={{cursor:'pointer'}}>
            <span>🗄️ amit.patel</span><span>Database Admin</span>
          </div>
          <p style={{fontSize:'11px', color:'var(--text-muted)', marginTop:'8px'}}>Click to fill • Password: pass123</p>
        </div>
      </div>
    </div>
  )
}
