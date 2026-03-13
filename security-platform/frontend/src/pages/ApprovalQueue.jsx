import { useState, useEffect, useRef } from 'react'
import { apiFetch } from '../App'

export default function ApprovalQueue() {
  const [approvals, setApprovals] = useState([])
  const [stats, setStats] = useState({})
  const [selected, setSelected] = useState(null)
  const [adminResponse, setAdminResponse] = useState('')
  const [processing, setProcessing] = useState(false)
  const [toast, setToast] = useState(null)
  const pollRef = useRef(null)

  const load = () => {
    apiFetch('/api/approvals').then(d => setApprovals(d.approvals)).catch(console.error)
    apiFetch('/api/approvals/stats').then(setStats).catch(console.error)
  }

  useEffect(() => {
    load()
    pollRef.current = setInterval(load, 5000)
    return () => clearInterval(pollRef.current)
  }, [])

  const showToast = (msg, type = 'success') => { setToast({ msg, type }); setTimeout(() => setToast(null), 4000) }

  const handleDecision = async (id, decision) => {
    setProcessing(true)
    try {
      await apiFetch(`/api/approvals/${id}/decide`, {
        method: 'POST',
        body: JSON.stringify({ decision, response: adminResponse || `Action ${decision} by admin` })
      })
      showToast(`Request ${decision}`)
      setSelected(null)
      setAdminResponse('')
      load()
    } catch (err) {
      showToast(err.message || 'Failed to process', 'error')
    } finally {
      setProcessing(false)
    }
  }

  const statusBadge = (s) => {
    const map = { pending: 'warning', approved: 'success', denied: 'danger' }
    return <span className={`badge ${map[s] || 'neutral'}`}>{s}</span>
  }

  const formatTime = (t) => {
    if (!t) return '—'
    try { return new Date(t).toLocaleString() } catch { return t }
  }

  const pendingApprovals = approvals.filter(a => a.status === 'pending')
  const resolvedApprovals = approvals.filter(a => a.status !== 'pending')

  return (
    <div>
      <div className="page-header">
        <h2>📋 Approval Queue</h2>
        <p>Review and decide on high-risk action requests from banking users</p>
      </div>

      <div className="kpi-grid">
        <div className="kpi-card orange">
          <div className="kpi-icon">⏳</div>
          <div className="kpi-label">Pending</div>
          <div className="kpi-value">{stats.pending || 0}</div>
        </div>
        <div className="kpi-card green">
          <div className="kpi-icon">✅</div>
          <div className="kpi-label">Approved</div>
          <div className="kpi-value">{stats.approved || 0}</div>
        </div>
        <div className="kpi-card red">
          <div className="kpi-icon">🚫</div>
          <div className="kpi-label">Denied</div>
          <div className="kpi-value">{stats.denied || 0}</div>
        </div>
        <div className="kpi-card blue">
          <div className="kpi-icon">📊</div>
          <div className="kpi-label">Total</div>
          <div className="kpi-value">{stats.total || 0}</div>
        </div>
      </div>

      {/* Pending Approvals */}
      {pendingApprovals.length > 0 && (
        <div className="card">
          <div className="card-header">
            <h3>🔔 Pending Requests</h3>
            <span className="badge warning">{pendingApprovals.length} waiting</span>
          </div>
          <div className="card-body" style={{padding: 0}}>
            {pendingApprovals.map(a => (
              <div key={a.id} className={`approval-card ${selected === a.id ? 'expanded' : ''}`}>
                <div className="approval-summary" onClick={() => setSelected(selected === a.id ? null : a.id)}>
                  <div className="approval-info">
                    <div className="approval-user">
                      <strong>{a.username || a.user_id}</strong>
                      <span className="badge neutral">{a.role}</span>
                    </div>
                    <div className="approval-action">
                      <span className="badge info">{a.action}</span>
                      {a.amount > 0 && <span className="approval-amount">₹{Number(a.amount).toLocaleString('en-IN')}</span>}
                    </div>
                  </div>
                  <div className="approval-meta">
                    <span className={`risk-badge ${a.risk_score >= 90 ? 'critical' : 'high'}`}>{a.risk_score}</span>
                    <span className="approval-time">{formatTime(a.created_at)}</span>
                  </div>
                </div>

                {selected === a.id && (
                  <div className="approval-detail">
                    {a.user_message && (
                      <div className="user-message-box">
                        <h4>💬 Message from User</h4>
                        <p>{a.user_message}</p>
                      </div>
                    )}
                    {!a.user_message && (
                      <div className="user-message-box empty">
                        <p>No message from user yet. They can still send one while waiting.</p>
                      </div>
                    )}

                    <div className="admin-decision-box">
                      <h4>Admin Response (optional)</h4>
                      <textarea
                        className="form-input"
                        placeholder="Provide a reason for your decision..."
                        value={adminResponse}
                        onChange={e => setAdminResponse(e.target.value)}
                        rows={3}
                        style={{resize:'vertical'}}
                      />
                      <div className="decision-buttons">
                        <button
                          className="btn btn-success"
                          onClick={() => handleDecision(a.id, 'approved')}
                          disabled={processing}
                        >
                          {processing ? 'Processing...' : '✓ Approve Action'}
                        </button>
                        <button
                          className="btn btn-danger"
                          onClick={() => handleDecision(a.id, 'denied')}
                          disabled={processing}
                        >
                          {processing ? 'Processing...' : '✗ Deny Action'}
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {pendingApprovals.length === 0 && (
        <div className="card">
          <div className="card-body" style={{textAlign:'center', padding:'48px 24px'}}>
            <div style={{fontSize:'48px', marginBottom:'12px'}}>✅</div>
            <h3 style={{color:'var(--text-secondary)', fontWeight:'500'}}>No pending approvals</h3>
            <p style={{color:'var(--text-muted)', fontSize:'14px'}}>New requests will appear here automatically</p>
          </div>
        </div>
      )}

      {/* Resolved History */}
      {resolvedApprovals.length > 0 && (
        <div className="card">
          <div className="card-header">
            <h3>📜 Resolution History</h3>
            <span className="badge neutral">{resolvedApprovals.length} resolved</span>
          </div>
          <div className="card-body" style={{padding: 0}}>
            <div className="table-wrapper">
              <table>
                <thead><tr><th>User</th><th>Action</th><th>Risk</th><th>Status</th><th>Admin Response</th><th>Resolved At</th></tr></thead>
                <tbody>
                  {resolvedApprovals.map(a => (
                    <tr key={a.id}>
                      <td><strong>{a.username || a.user_id}</strong></td>
                      <td><span className="badge info">{a.action}</span></td>
                      <td><span className={`risk-badge ${a.risk_score >= 90 ? 'critical' : 'high'}`}>{a.risk_score}</span></td>
                      <td>{statusBadge(a.status)}</td>
                      <td style={{maxWidth:'200px', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}}>{a.admin_response || '—'}</td>
                      <td style={{fontSize:'13px', color:'var(--text-muted)'}}>{formatTime(a.resolved_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {toast && <div className={`toast ${toast.type}`}>{toast.msg}</div>}
    </div>
  )
}
