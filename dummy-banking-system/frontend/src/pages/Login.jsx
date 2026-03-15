import { useState } from 'react'
import { useAuth, BankLogo } from '../App'

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
    <div className="login-page-v2">
      <div className="login-bg-overlay"></div>
      
      <header className="login-v2-header">
        <div className="v2-brand">
          <BankLogo size={32} />
          <span className="v2-brand-name">National Bank</span>
          <span className="v2-header-sep">|</span>
          <span className="v2-header-title">Internal Operations Portal</span>
        </div>
      </header>

      <main className="login-v2-main">
        <div className="login-v2-container">
          <div className="login-v2-marketing">
            <div className="marketing-text">
              <h2>SECURE YOUR DREAMS</h2>
              <h1>WHAT YOU WANT AND NEED</h1>
              <div className="marketing-cta">
                <span>Learn more</span>
                <div className="cta-arrow">→</div>
              </div>
            </div>
          </div>

          <div className="login-v2-card">
            <h3>Internal Portal <strong>Secure Access</strong></h3>
            
            <form onSubmit={handleSubmit} className="v2-login-form">
              <div className="v2-form-group">
                <label>Username</label>
                <div className="v2-input-wrapper">
                  <span className="v2-input-icon">👤</span>
                  <input 
                    type="text" 
                    value={username} 
                    onChange={e => setUsername(e.target.value)} 
                    placeholder="Enter username" 
                    required 
                  />
                </div>
              </div>

              <div className="v2-form-group">
                <label>Password</label>
                <div className="v2-input-wrapper">
                  <span className="v2-input-icon">🔒</span>
                  <input 
                    type="password" 
                    value={password} 
                    onChange={e => setPassword(e.target.value)} 
                    placeholder="Enter password" 
                    required 
                  />
                </div>
              </div>

              {error && <div className="v2-login-error">{error}</div>}

              <a href="#" className="v2-forgot-link">Forgot your username?</a>

              <div className="v2-form-actions">
                <button type="submit" className="v2-btn-primary" disabled={loading}>
                  {loading ? 'Entering...' : 'Enter'}
                </button>
              </div>
            </form>

            <div className="v2-credentials-hint">
              <p>Demo Accounts (Click to auto-fill)</p>
              <div className="v2-hint-pills">
                <button onClick={() => fillCredentials('rajesh.kumar', 'pass123')}>Rajesh (Treasury)</button>
                <button onClick={() => fillCredentials('priya.sharma', 'pass123')}>Priya (Loans)</button>
                <button onClick={() => fillCredentials('amit.patel', 'pass123')}>Amit (Admin)</button>
              </div>
            </div>
          </div>
        </div>
      </main>

      <aside className="v2-social-bar">
        <div className="social-icon">f</div>
        <div className="social-icon">𝕏</div>
        <div className="social-icon">▶</div>
      </aside>

      <footer className="login-v2-footer">
        <div className="footer-v2-grid">
          <div className="footer-v2-col">
            <h4>Phone Lines</h4>
            <p>National line <strong>018000 200 300</strong></p>
          </div>
          <div className="footer-v2-col">
            <h4>Offices and ATMs</h4>
            <p>Find your nearest office <a href="#">here</a></p>
          </div>
          <div className="footer-v2-col">
            <h4>Questions, doubts?</h4>
            <p>Use our <a href="#">contact form</a></p>
          </div>
        </div>
        <div className="footer-v2-legal">
          <a href="#">Privacy Policy</a>
          <a href="#">Terms and Conditions</a>
        </div>
      </footer>
    </div>
  )
}
