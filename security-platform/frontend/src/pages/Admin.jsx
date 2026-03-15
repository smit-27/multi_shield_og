import { useState, useEffect } from 'react'
import { apiFetch, Icon } from '../App'


export default function Admin() {
  const [policies, setPolicies] = useState([])
  const [incidentStats, setIncidentStats] = useState({})
  const [editing, setEditing] = useState(null)
  const [toast, setToast] = useState(null)

  const load = () => {
    apiFetch('/api/policies').then(d => setPolicies(d.policies)).catch(console.error)
    apiFetch('/api/incidents/stats').then(setIncidentStats).catch(console.error)
  }
  useEffect(load, [])

  const showToast = (msg, type = 'success') => { setToast({ msg, type }); setTimeout(() => setToast(null), 3000) }

  const updatePolicy = async (id, threshold) => {
    try {
      await apiFetch(`/api/policies/${id}`, { method: 'PUT', body: JSON.stringify({ threshold: Number(threshold) }) })
      showToast('Policy updated'); setEditing(null); load()
    } catch (e) { showToast(e.message, 'error') }
  }

  const categoryIcons = { transaction: 'money', time: 'clock', data: 'volume', loan: 'loans', risk: 'target' }
  const formatValue = (p) => {
    if (p.category === 'transaction' || p.category === 'loan') return `₹${Number(p.threshold).toLocaleString('en-IN')}`
    if (p.category === 'time') return `${p.threshold}:00`
    return p.threshold
  }

  return (
    <div>
      <div className="page-header">
        <h2><Icon name="settings" size={24} style={{verticalAlign:'middle', marginRight:'8px'}} /> Admin Dashboard</h2>
        <p>Configure security policies and manage system settings</p>
      </div>

      <div className="kpi-grid">
        <div className="kpi-card green">
          <div className="kpi-icon"><Icon name="shield" /></div>
          <div className="kpi-label">Active Policies</div>
          <div className="kpi-value">{policies.filter(p => p.enabled).length}</div>
        </div>
        <div className="kpi-card red">
          <div className="kpi-icon"><Icon name="incident" /></div>
          <div className="kpi-label">Open Incidents</div>
          <div className="kpi-value">{incidentStats.open || 0}</div>
        </div>
        <div className="kpi-card orange">
          <div className="kpi-icon"><Icon name="warning" /></div>
          <div className="kpi-label">Blocked Actions</div>
          <div className="kpi-value">{incidentStats.blocked || 0}</div>
        </div>
        <div className="kpi-card purple">
          <div className="kpi-icon"><Icon name="volume" /></div>
          <div className="kpi-label">Avg Risk Score</div>
          <div className="kpi-value">{incidentStats.avgRisk || 0}</div>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <h3><Icon name="settings" size={18} style={{marginRight:'8px'}} /> Security Policies</h3>
          <span className="badge cyan">{policies.length} policies</span>
        </div>
        <div className="card-body">
          <div className="policy-grid">
            {policies.map(p => (
              <div className="policy-card" key={p.id}>
                <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'8px'}}>
                  <span className="policy-category badge neutral"><Icon name={categoryIcons[p.category] || 'treasury'} size={14} style={{marginRight:'4px'}} /> {p.category}</span>
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
                    <button className="btn btn-sm btn-outline" onClick={() => setEditing(p.id)}><Icon name="edit" size={14} /> Edit</button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {toast && <div className={`toast ${toast.type}`}>{toast.msg}</div>}
    </div>
  )
}
