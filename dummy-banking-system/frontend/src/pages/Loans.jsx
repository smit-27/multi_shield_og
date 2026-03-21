import { useState, useEffect } from 'react'
import { apiFetch } from '../App'
import KpiCard from '../components/KpiCard'
import Modal from '../components/Modal'
import FreezeOverlay from '../components/FreezeOverlay'
import JustifyModal from '../components/JustifyModal'
import { FileText, CheckCircle, Coins, ShieldAlert, Check, X, Clock } from 'lucide-react'

const formatINR = (n) => `₹${Number(n).toLocaleString('en-IN')}`

export default function Loans() {
  const [loans, setLoans] = useState([])
  const [stats, setStats] = useState({})
  const [blockModal, setBlockModal] = useState(null)
  const [toast, setToast] = useState(null)
  const [filter, setFilter] = useState('')

  // Tier-aware state
  const [freezeOverlay, setFreezeOverlay] = useState(null)
  const [justifyModal, setJustifyModal] = useState(null)
  const [pendingAction, setPendingAction] = useState(null)

  const load = () => {
    const q = filter ? `?status=${filter}` : ''
    apiFetch(`/api/loans${q}`).then(d => setLoans(d.loans)).catch(console.error)
    apiFetch('/api/loans/stats').then(setStats).catch(console.error)
  }
  useEffect(load, [filter])

  const showToast = (msg, type = 'success') => { setToast({ msg, type }); setTimeout(() => setToast(null), 4000) }

  const handleSecurityResponse = (err, loanId) => {
    const data = err.data || err

    if (data.justify_required) {
      setJustifyModal({ data })
      setPendingAction({ loanId })
      return
    }
    if (data.mfa_required) {
      setFreezeOverlay({ mode: 'mfa', data })
      setPendingAction({ loanId })
      return
    }
    if (data.admin_approval_required) {
      setFreezeOverlay({ mode: 'admin', data })
      setPendingAction({ loanId })
      return
    }
    if (data.blocked) {
      setBlockModal(data)
      return
    }
    showToast(data.message || err.message || 'An error occurred', 'error')
  }

  const approveLoan = async (id) => {
    try {
      const res = await apiFetch(`/api/loans/${id}/approve`, { method: 'POST', body: JSON.stringify({}) })
      if (res.justify_required || res.mfa_required || res.admin_approval_required) {
        handleSecurityResponse(res, id)
        return
      }
      showToast(res.message); load()
    } catch (err) {
      handleSecurityResponse(err, id)
    }
  }

  const rejectLoan = async (id) => {
    try {
      const res = await apiFetch(`/api/loans/${id}/reject`, { method: 'POST', body: JSON.stringify({}) })
      showToast(res.message); load()
    } catch (err) { showToast(err.message, 'error') }
  }

  const retryPendingAction = async () => {
    if (!pendingAction) return
    setFreezeOverlay(null)
    try {
      const res = await apiFetch(`/api/loans/${pendingAction.loanId}/approve`, { method: 'POST', body: JSON.stringify({}) })
      if (res.justify_required || res.mfa_required || res.admin_approval_required) {
        showToast('Action still requires additional verification', 'error')
      } else {
        showToast(res.message || 'Loan approved successfully')
        load()
      }
    } catch (err) {
      showToast('Action could not be completed: ' + (err.message || 'Unknown error'), 'error')
    } finally {
      setPendingAction(null)
    }
  }

  const handleJustifySubmit = async (reason) => {
    showToast(`Justification submitted: "${reason}"`)
    setJustifyModal(null)
    if (pendingAction) {
      try {
        const res = await apiFetch(`/api/loans/${pendingAction.loanId}/approve`, {
          method: 'POST',
          body: JSON.stringify({ details: `Justified: ${reason}` }),
          headers: { 'X-Device': 'internal workstation' }
        })
        if (res.justify_required || res.mfa_required || res.admin_approval_required) {
          handleSecurityResponse(res, pendingAction.loanId)
        } else {
          showToast(res.message || 'Loan approved successfully')
          load()
        }
      } catch (err) {
        handleSecurityResponse(err, pendingAction.loanId)
      } finally {
        setPendingAction(null)
      }
    }
  }

  const statusBadge = (s) => {
    const map = { pending: 'warning', approved: 'success', rejected: 'danger' }
    return <span className={`badge ${map[s] || 'neutral'}`}>{s}</span>
  }

  return (
    <div>
      <div className="hero-landing-section">
        <div className="hero-card">
          <h3>Credit & Lending Portfolio</h3>
          <p>Review and manage credit facility applications, term loan underwriting, and working capital sanctions. All approvals are governed by the bank’s Internal Credit Risk Rating framework.</p>
        </div>
      </div>

      <div className="kpi-grid">
        <KpiCard icon={<FileText size={20} />} label="Total Applications" value={stats.total || 0} color="blue" />
        <KpiCard icon={<Clock size={20} />} label="Pending Underwriting" value={stats.pending || 0} color="orange" />
        <KpiCard icon={<CheckCircle size={20} />} label="Sanctioned" value={stats.approved || 0} color="green" />
        <KpiCard icon={<Coins size={20} />} label="Sanctioned Amount" value={formatINR(stats.approvedAmount || 0)} color="purple" />
      </div>

      <div className="card">
        <div className="card-header">
           <h3>Credit Applications</h3>
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
               <thead><tr><th>Ref No.</th><th>Applicant</th><th>Facility Type</th><th className="text-right">Amount</th><th>Rate</th><th>Tenure</th><th>Status</th><th>Actions</th></tr></thead>
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
                          <button className="btn btn-sm btn-success" onClick={() => approveLoan(loan.id)}><Check size={14} /> Sanction</button>
                          <button className="btn btn-sm btn-danger" onClick={() => rejectLoan(loan.id)}><X size={14} /> Decline</button>
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

      {/* Legacy block modal */}
      <Modal show={!!blockModal} onClose={() => setBlockModal(null)}
        title="Action Blocked" icon={<ShieldAlert size={18} />}
        footer={<button className="btn btn-outline" onClick={() => setBlockModal(null)}>Close</button>}>
        {blockModal && (
          <>
            <div className="alert-block danger">
              <span className="alert-icon"><ShieldAlert size={18} /></span>
              <div className="alert-text">
                <div className="alert-title">{blockModal.message}</div>
                <div>{blockModal.reason}</div>
              </div>
            </div>
          </>
        )}
      </Modal>

      {/* Tier 2: Justification Modal */}
      <JustifyModal
        show={!!justifyModal}
        data={justifyModal?.data}
        onSubmit={handleJustifySubmit}
        onClose={() => { setJustifyModal(null); setPendingAction(null) }}
      />

      {/* Tier 3 & 4: Freeze Overlay */}
      {freezeOverlay && (
        <FreezeOverlay
          mode={freezeOverlay.mode}
          data={freezeOverlay.data}
          onResolved={() => { setTimeout(() => retryPendingAction(), 1500) }}
          onDenied={() => { setFreezeOverlay(null); setPendingAction(null); showToast('Action was denied by admin', 'error') }}
        />
      )}

      {toast && <div className={`toast ${toast.type}`}>{toast.msg}</div>}
    </div>
  )
}
