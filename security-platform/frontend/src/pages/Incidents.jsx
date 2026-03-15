import { apiFetch } from '../App'
import Icon from '../components/Icon'

export default function Incidents() {
  const [incidents, setIncidents] = useState([])
  const [stats, setStats] = useState({})
  const [filter, setFilter] = useState('')
  const [toast, setToast] = useState(null)

  const load = () => {
    const q = filter ? `?status=${filter}` : ''
    apiFetch(`/api/incidents${q}`).then(d => setIncidents(d.incidents)).catch(console.error)
    apiFetch('/api/incidents/stats').then(setStats).catch(console.error)
  }
  useEffect(load, [filter])

  const showToast = (msg, type = 'success') => { setToast({ msg, type }); setTimeout(() => setToast(null), 3000) }

  const resolveIncident = async (id) => {
    try {
      await apiFetch(`/api/incidents/${id}/resolve`, { method: 'POST', body: JSON.stringify({ resolution: 'Resolved by admin review' }) })
      showToast('Incident resolved'); load()
    } catch (e) { showToast(e.message, 'error') }
  }

  const approveIncident = async (id) => {
    try {
      await apiFetch(`/api/incidents/${id}/approve`, { method: 'POST', body: JSON.stringify({}) })
      showToast('Action approved'); load()
    } catch (e) { showToast(e.message, 'error') }
  }

  const decisionBadge = (d) => {
    const map = { BLOCK: 'block', REQUIRE_MFA: 'mfa', ALLOW: 'allow' }
    return <span className={`badge ${map[d] || 'neutral'}`}>{d}</span>
  }

  const statusBadge = (s) => {
    const map = { open: 'danger', resolved: 'success', approved: 'info' }
    return <span className={`badge ${map[s] || 'neutral'}`}>{s}</span>
  }

  return (
    <div>
      <div className="page-header">
        <h2><Icon name="incident" size={24} style={{verticalAlign:'middle', marginRight:'8px'}} /> Incident Management</h2>
        <p>Review and resolve security incidents</p>
      </div>

      <div className="kpi-grid">
        <div className="kpi-card red"><div className="kpi-icon"><Icon name="shield" /></div><div className="kpi-label">Open Incidents</div><div className="kpi-value">{stats.open || 0}</div></div>
        <div className="kpi-card green"><div className="kpi-icon"><Icon name="check" /></div><div className="kpi-label">Resolved</div><div className="kpi-value">{stats.resolved || 0}</div></div>
        <div className="kpi-card orange"><div className="kpi-icon"><Icon name="block" /></div><div className="kpi-label">Blocked Actions</div><div className="kpi-value">{stats.blocked || 0}</div></div>
        <div className="kpi-card purple"><div className="kpi-icon"><Icon name="target" /></div><div className="kpi-label">Avg Risk Score</div><div className="kpi-value">{stats.avgRisk || 0}</div></div>
      </div>

      <div className="card">
        <div className="card-header">
          <h3>Incident List</h3>
          <div style={{display:'flex', gap:'8px'}}>
            {['', 'open', 'resolved', 'approved'].map(f => (
              <button key={f} className={`btn btn-sm ${filter === f ? 'btn-primary' : 'btn-outline'}`} onClick={() => setFilter(f)}>
                {f || 'All'}
              </button>
            ))}
          </div>
        </div>
        <div className="card-body" style={{padding: 0}}>
          <div className="table-wrapper">
            <table>
              <thead><tr><th>ID</th><th>User</th><th>Action</th><th>Amount</th><th>Risk</th><th>Decision</th><th>Reason</th><th>Status</th><th>Actions</th></tr></thead>
              <tbody>
                {incidents.map(inc => (
                  <tr key={inc.id}>
                    <td className="mono" style={{fontSize:'13px'}}>#{inc.id}</td>
                    <td><strong className="mono">{inc.user_id}</strong><br/><span style={{fontSize:'12px', color:'var(--text-muted)'}}>{inc.role}</span></td>
                    <td><span className="badge neutral">{inc.action}</span></td>
                    <td className="mono" style={{color:'var(--cyan)'}}>{inc.amount > 0 ? `₹${Number(inc.amount).toLocaleString('en-IN')}` : '—'}</td>
                    <td><span className="mono" style={{fontSize:'18px', fontWeight:'700', color: inc.risk_score >= 71 ? 'var(--danger)' : 'var(--warning)'}}>{inc.risk_score}</span></td>
                    <td>{decisionBadge(inc.decision)}</td>
                    <td style={{maxWidth:'200px', fontSize:'13px', color:'var(--text-secondary)'}}>{inc.reason}</td>
                    <td>{statusBadge(inc.status)}</td>
                    <td>
                      {inc.status === 'open' && (
                        <div style={{display:'flex', gap:'6px'}}>
                          <button className="btn btn-sm btn-primary" onClick={() => approveIncident(inc.id)}>✓ Approve</button>
                          <button className="btn btn-sm btn-outline" onClick={() => resolveIncident(inc.id)}>🔒 Resolve</button>
                        </div>
                      )}
                      {inc.status !== 'open' && <span style={{fontSize:'12px', color:'var(--text-muted)'}}>—</span>}
                    </td>
                  </tr>
                ))}
                {incidents.length === 0 && <tr><td colSpan={9} className="empty-state"><div className="icon"><Icon name="check" size={48} /></div><p>No incidents to display</p></td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {toast && <div className={`toast ${toast.type}`}>{toast.msg}</div>}
    </div>
  )
}
