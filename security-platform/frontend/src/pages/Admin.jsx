import { useState, useEffect, useRef } from 'react'
import { apiFetch } from '../App'

export default function Admin() {
  const [policies, setPolicies] = useState([])
  const [incidentStats, setIncidentStats] = useState({})
  const [editing, setEditing] = useState(null)
  const [toast, setToast] = useState(null)
  const [activeMfa, setActiveMfa] = useState([])
  const pollRef = useRef(null)

  const load = () => {
    apiFetch('/api/policies').then(d => setPolicies(d.policies)).catch(console.error)
    apiFetch('/api/incidents/stats').then(setIncidentStats).catch(console.error)
    apiFetch('/api/mfa/active/codes').then(d => setActiveMfa(d.challenges || [])).catch(console.error)
  }
  useEffect(() => {
    load()
    pollRef.current = setInterval(load, 5000)
    return () => clearInterval(pollRef.current)
  }, [])

  const showToast = (msg, type = 'success') => { setToast({ msg, type }); setTimeout(() => setToast(null), 3000) }

  const updatePolicy = async (id, threshold) => {
    try {
      await apiFetch(`/api/policies/${id}`, { method: 'PUT', body: JSON.stringify({ threshold: Number(threshold) }) })
      showToast('Policy updated'); setEditing(null); load()
    } catch (e) { showToast(e.message, 'error') }
  }

  const categoryIcons = { transaction: '💰', time: '🕐', data: '📊', loan: '📋', risk: '🎯' }
  const formatValue = (p) => {
    if (p.category === 'transaction' || p.category === 'loan') return `₹${Number(p.threshold).toLocaleString('en-IN')}`
    if (p.category === 'time') return `${p.threshold}:00`
    return p.threshold
  }

  return (
    <div>
      <div className="page-header">
        <h2>⚙️ Admin Dashboard</h2>
        <p>Configure security policies and manage system settings</p>
      </div>

      <div className="kpi-grid">
        <div className="kpi-card green">
          <div className="kpi-icon">🛡️</div>
          <div className="kpi-label">Active Policies</div>
          <div className="kpi-value">{policies.filter(p => p.enabled).length}</div>
        </div>
        <div className="kpi-card red">
          <div className="kpi-icon">🚨</div>
          <div className="kpi-label">Open Incidents</div>
          <div className="kpi-value">{incidentStats.open || 0}</div>
        </div>
        <div className="kpi-card orange">
          <div className="kpi-icon">⚠️</div>
          <div className="kpi-label">Blocked Actions</div>
          <div className="kpi-value">{incidentStats.blocked || 0}</div>
        </div>
        <div className="kpi-card purple">
          <div className="kpi-icon">📊</div>
          <div className="kpi-label">Avg Risk Score</div>
          <div className="kpi-value">{incidentStats.avgRisk || 0}</div>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <h3>🔧 Security Policies</h3>
          <span className="badge cyan">{policies.length} policies</span>
        </div>
        <div className="card-body">
          <div className="policy-grid">
            {policies.map(p => (
              <div className="policy-card" key={p.id}>
                <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'8px'}}>
                  <span className="policy-category badge neutral">{categoryIcons[p.category] || '📌'} {p.category}</span>
                  <span className="badge" style={{background: p.enabled ? 'var(--success-light)' : 'var(--danger-light)', color: p.enabled ? 'var(--success)' : 'var(--danger)'}}>
                    {p.enabled ? 'Active' : 'Disabled'}
                  </span>
                </div>
                <div className="policy-name">{p.name}</div>
                <div className="policy-desc">{p.description}</div>
                {editing === p.id ? (
                  <div style={{display:'flex', gap:'8px', alignItems:'center'}}>
                    <input className="form-input" type="number" defaultValue={p.threshold} id={`policy-${p.id}`}
                      style={{flex:1, padding:'8px 12px'}} onKeyDown={e => { if (e.key === 'Enter') updatePolicy(p.id, e.target.value) }} />
                    <button className="btn btn-sm btn-primary" onClick={() => updatePolicy(p.id, document.getElementById(`policy-${p.id}`).value)}>Save</button>
                    <button className="btn btn-sm btn-outline" onClick={() => setEditing(null)}>✕</button>
                  </div>
                ) : (
                  <div style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
                    <div className="policy-value">{formatValue(p)}</div>
                    <button className="btn btn-sm btn-outline" onClick={() => setEditing(p.id)}>✏️ Edit</button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Active MFA Hex OTP Codes */}
      <div className="card">
        <div className="card-header">
          <h3>🔐 Active MFA Codes</h3>
          <span className="badge" style={{background: activeMfa.length > 0 ? 'var(--warning-light)' : 'var(--success-light)', color: activeMfa.length > 0 ? 'var(--warning)' : 'var(--success)'}}>
            {activeMfa.length > 0 ? `${activeMfa.length} pending` : 'None active'}
          </span>
        </div>
        <div className="card-body" style={{padding: 0}}>
          {activeMfa.length === 0 ? (
            <div className="empty-state" style={{padding:'32px'}}>
              <div className="icon">✅</div>
              <p>No active MFA challenges. Hex OTP codes will appear here when users trigger MFA.</p>
            </div>
          ) : (
            <div className="table-wrapper">
              <table>
                <thead>
                  <tr><th>User</th><th>Action</th><th>Risk</th><th>Step</th><th>Hex OTP Code</th><th>Created</th></tr>
                </thead>
                <tbody>
                  {activeMfa.map(m => (
                    <tr key={m.id}>
                      <td><strong className="mono">{m.user_id}</strong><br/><span style={{fontSize:'12px', color:'var(--text-muted)'}}>{m.role}</span></td>
                      <td><span className="badge neutral">{m.action}</span></td>
                      <td><span className="mono" style={{fontWeight:'700', color: m.risk_score >= 71 ? 'var(--danger)' : 'var(--warning)'}}>{m.risk_score}</span></td>
                      <td><span className="badge info">Step {m.step}/4</span></td>
                      <td>
                        <span className="mono" style={{fontSize:'18px', fontWeight:'700', color:'var(--cyan)', letterSpacing:'2px', background:'var(--bg-surface)', padding:'6px 14px', border:'1px dashed var(--border-accent)'}}>
                          {m.otp_code}
                        </span>
                      </td>
                      <td style={{fontSize:'12px', color:'var(--text-muted)'}}>{m.created_at}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {toast && <div className={`toast ${toast.type}`}>{toast.msg}</div>}
    </div>
  )
}
