import { useState, useEffect } from 'react'
import { apiFetch } from '../App'
import KpiCard from '../components/KpiCard'
import Modal from '../components/Modal'

const formatINR = (n) => `₹${Number(n).toLocaleString('en-IN')}`

export default function Loans() {
  const [loans, setLoans] = useState([])
  const [stats, setStats] = useState({})
  const [blockModal, setBlockModal] = useState(null)
  const [toast, setToast] = useState(null)
  const [filter, setFilter] = useState('')

  const load = () => {
    const q = filter ? `?status=${filter}` : ''
    apiFetch(`/api/loans${q}`).then(d => setLoans(d.loans)).catch(console.error)
    apiFetch('/api/loans/stats').then(setStats).catch(console.error)
  }
  useEffect(load, [filter])

  const showToast = (msg, type = 'success') => { setToast({ msg, type }); setTimeout(() => setToast(null), 4000) }

  const approveLoan = async (id) => {
    try {
      const res = await apiFetch(`/api/loans/${id}/approve`, { method: 'POST', body: JSON.stringify({}) })
      showToast(res.message); load()
    } catch (err) {
      if (err.status === 403 || err.status === 202) {
        setBlockModal(err.data)
      } else {
        showToast(err.message, 'error')
      }
    }
  }

  const rejectLoan = async (id) => {
    try {
      const res = await apiFetch(`/api/loans/${id}/reject`, { method: 'POST', body: JSON.stringify({}) })
      showToast(res.message); load()
    } catch (err) { showToast(err.message, 'error') }
  }

  const statusBadge = (s) => {
    const map = { pending: 'warning', approved: 'success', rejected: 'danger' }
    return <span className={`badge ${map[s] || 'neutral'}`}>{s}</span>
  }

  return (
    <div>
      <div className="hero-landing-section">
        <div className="hero-card">
          <h3>Commercial Loan Portfolio</h3>
          <p>Manage corporate credit facilities, term loans, and working capital approvals. Review applications against the National Risk Framework.</p>
        </div>
      </div>

      <div className="kpi-grid">
        <KpiCard icon="📑" label="Total Applications" value={stats.total || 0} color="blue" />
        <KpiCard icon="⏳" label="Pending Review" value={stats.pending || 0} color="orange" />
        <KpiCard icon="✅" label="Approved" value={stats.approved || 0} color="green" />
        <KpiCard icon="💰" label="Approved Amount" value={formatINR(stats.approvedAmount || 0)} color="purple" />
      </div>

      <div className="card">
        <div className="card-header">
          <h3>Loan Applications</h3>
          <div style={{display:'flex', gap:'8px'}}>
            {['', 'pending', 'approved', 'rejected'].map(f => (
              <button key={f} className={`btn btn-sm ${filter === f ? 'btn-primary' : 'btn-outline'}`} onClick={() => setFilter(f)}>
                {f || 'All'}
              </button>
            ))}
          </div>
        </div>
        <div className="card-body" style={{padding: 0}}>
          <div className="table-wrapper">
            <table>
              <thead><tr><th>ID</th><th>Applicant</th><th>Type</th><th className="text-right">Amount</th><th>Rate</th><th>Tenure</th><th>Status</th><th>Actions</th></tr></thead>
              <tbody>
                {loans.map(loan => (
                  <tr key={loan.id}>
                    <td style={{fontFamily:'monospace', fontSize:'13px'}}>{loan.id}</td>
                    <td><strong>{loan.applicant_name}</strong></td>
                    <td><span className="badge neutral">{loan.loan_type}</span></td>
                    <td className="text-right amount">{formatINR(loan.amount)}</td>
                    <td>{loan.interest_rate}%</td>
                    <td>{loan.tenure_months}mo</td>
                    <td>{statusBadge(loan.status)}</td>
                    <td>
                      {loan.status === 'pending' && (
                        <div style={{display:'flex',gap:'6px'}}>
                          <button className="btn btn-sm btn-success" onClick={() => approveLoan(loan.id)}>✓ Approve</button>
                          <button className="btn btn-sm btn-danger" onClick={() => rejectLoan(loan.id)}>✗ Reject</button>
                        </div>
                      )}
                      {loan.status !== 'pending' && <span style={{fontSize:'12px',color:'var(--text-muted)'}}>—</span>}
                    </td>
                  </tr>
                ))}
                {loans.length === 0 && <tr><td colSpan={8} className="empty-state">No loans found</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <Modal show={!!blockModal} onClose={() => setBlockModal(null)}
        title={blockModal?.mfa_required ? 'Verification Required' : 'Action Blocked'}
        icon={blockModal?.mfa_required ? '⚠️' : '🚨'}
        footer={<button className="btn btn-outline" onClick={() => setBlockModal(null)}>Close</button>}>
        {blockModal && (
          <>
            <div className={`alert-block ${blockModal.blocked ? 'danger' : 'warning'}`}>
              <span className="alert-icon">{blockModal.blocked ? '🛑' : '⚠️'}</span>
              <div className="alert-text">
                <div className="alert-title">{blockModal.message}</div>
                <div>{blockModal.reason}</div>
              </div>
            </div>
            <div style={{display:'flex', justifyContent:'space-between', padding:'12px 0'}}>
              <span style={{color:'var(--text-muted)', fontSize:'13px'}}>Risk Score</span>
              <span className="amount" style={{color:'var(--danger)', fontSize:'18px'}}>{blockModal.risk_score}/100</span>
            </div>
            {blockModal.factors?.length > 0 && (
              <div className="risk-factors">
                {blockModal.factors.map((f, i) => (
                  <div className="risk-factor" key={i}>
                    <span className={`factor-score ${f.score >= 15 ? 'high' : 'medium'}`}>{f.score}</span>
                    <div>{f.factor}</div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </Modal>

      {toast && <div className={`toast ${toast.type}`}>{toast.msg}</div>}
    </div>
  )
}
