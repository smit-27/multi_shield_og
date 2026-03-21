import { useState, useEffect } from 'react'
import { apiFetch } from '../App'
import FreezeOverlay from '../components/FreezeOverlay'
import JustifyModal from '../components/JustifyModal'
import { ArrowDownToLine, ShieldAlert } from 'lucide-react'

const formatINR = (n) => `₹${Number(n).toLocaleString('en-IN')}`

export default function Withdrawals() {
  const [accounts, setAccounts] = useState([])
  const [formData, setFormData] = useState({})
  const [submitting, setSubmitting] = useState(false)
  const [toast, setToast] = useState(null)

  // Tier-aware state
  const [freezeOverlay, setFreezeOverlay] = useState(null)
  const [justifyModal, setJustifyModal] = useState(null)
  const [pendingAction, setPendingAction] = useState(null)
  const [blockModal, setBlockModal] = useState(null)

  const load = () => {
    apiFetch('/api/treasury/balances').then(d => setAccounts(d.accounts)).catch(console.error)
  }
  useEffect(load, [])

  const showToast = (msg, type = 'success') => { setToast({ msg, type }); setTimeout(() => setToast(null), 4000) }

  const handleSecurityResponse = (err, actionType, actionBody) => {
    const data = err.data || err

    if (data.justify_required) {
      setJustifyModal({ data })
      setPendingAction({ type: actionType, body: actionBody })
      return
    }

    if (data.mfa_required || data.step_up_required) {
      setFreezeOverlay({ mode: 'mfa', data })
      setPendingAction({ type: actionType, body: actionBody })
      return
    }

    if (data.admin_approval_required) {
      setFreezeOverlay({ mode: 'admin', data })
      setPendingAction({ type: actionType, body: actionBody })
      return
    }

    if (data.blocked) {
      setBlockModal(data)
      return
    }

    showToast(data.message || err.message || 'An error occurred', 'error')
  }

  const handleWithdraw = async () => {
    if (!formData.account_id || !formData.amount) {
      showToast('Please fill all required fields', 'error')
      return
    }
    
    setSubmitting(true)
    const body = { account_id: formData.account_id, amount: Number(formData.amount), description: formData.description || 'Large Withdrawal' }
    try {
      const res = await apiFetch('/api/treasury/withdraw', { method: 'POST', body: JSON.stringify(body) })
      if (res.justify_required || res.mfa_required || res.step_up_required || res.admin_approval_required) {
        handleSecurityResponse(res, 'withdraw', body)
        return
      }
      showToast(res.message)
      setFormData({}); load()
    } catch (err) {
      handleSecurityResponse(err, 'withdraw', body)
    } finally { setSubmitting(false) }
  }

  const retryPendingAction = async () => {
    if (!pendingAction) return
    setFreezeOverlay(null)
    setSubmitting(true)
    try {
      const endpoint = '/api/treasury/withdraw'
      const res = await apiFetch(endpoint, {
        method: 'POST',
        body: JSON.stringify(pendingAction.body),
        headers: { 'X-Device': 'internal workstation' }
      })
      if (res.justify_required || res.mfa_required || res.step_up_required || res.admin_approval_required) {
        showToast('Action still requires additional verification', 'error')
      } else {
        showToast(res.message || 'Action completed successfully')
        setFormData({}); load()
      }
    } catch (err) {
      showToast('Action could not be completed: ' + (err.message || 'Unknown error'), 'error')
    } finally {
      setSubmitting(false)
      setPendingAction(null)
    }
  }

  const handleJustifySubmit = async (reason) => {
    showToast(`Justification submitted: "${reason}"`)
    setJustifyModal(null)
    if (pendingAction) {
      setSubmitting(true)
      try {
        const endpoint = '/api/treasury/withdraw'
        const res = await apiFetch(endpoint, {
          method: 'POST',
          body: JSON.stringify({ ...pendingAction.body, details: `Justified: ${reason}` }),
          headers: { 'X-Device': 'internal workstation' }
        })
        if (res.justify_required || res.mfa_required || res.step_up_required || res.admin_approval_required) {
          handleSecurityResponse(res, pendingAction.type, pendingAction.body)
        } else {
          showToast(res.message || 'Action completed successfully')
          setFormData({}); load()
        }
      } catch (err) {
        handleSecurityResponse(err, pendingAction.type, pendingAction.body)
      } finally {
        setSubmitting(false)
        setPendingAction(null)
      }
    }
  }

  return (
    <div>
      <div className="page-header">
        <h2>Cash Management & Disbursements</h2>
        <p>Process high-value withdrawals and fund disbursements. All requests above ₹50,000 are subject to mandatory compliance checks per RBI Master Direction on KYC.</p>
      </div>

      <div className="card" style={{ maxWidth: '600px', margin: '0 auto' }}>
        <div className="card-header">
           <h3 style={{display: 'flex', alignItems: 'center', gap: '8px'}}><ArrowDownToLine size={18}/> Initiate Fund Disbursement</h3>
        </div>
        <div className="card-body">
          <div className="form-group">
             <label>Debit Account (Source)</label>
            <select className="form-select" value={formData.account_id || ''} onChange={e => setFormData({...formData, account_id: e.target.value})} onKeyDown={e => e.key === 'Enter' && handleWithdraw()}>
              <option value="">Select an account...</option>
              {accounts.map(a => <option key={a.id} value={a.id}>{a.account_name} ({formatINR(a.balance)})</option>)}
            </select>
          </div>
          <div className="form-group">
             <label>Disbursement Amount (₹)</label>
            <input className="form-input" type="number" value={formData.amount || ''} onChange={e => setFormData({...formData, amount: e.target.value})} onKeyDown={e => e.key === 'Enter' && handleWithdraw()} placeholder="Enter amount (min ₹1,000)" />
          </div>
          <div className="form-group">
             <label>Narration / Purpose</label>
            <input className="form-input" value={formData.description || ''} onChange={e => setFormData({...formData, description: e.target.value})} onKeyDown={e => e.key === 'Enter' && handleWithdraw()} placeholder="e.g. Vendor Payment INV-2026-0431" />
          </div>
          
          <button style={{marginTop: '20px', width: '100%', justifyContent: 'center'}} className="btn btn-primary" onClick={handleWithdraw} disabled={submitting}>
            {submitting ? 'Processing...' : 'Submit for Compliance Clearance'}
          </button>
        </div>
      </div>

      {blockModal && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <h3><ShieldAlert size={20}/> Transaction Blocked</h3>
              <button className="modal-close" onClick={() => setBlockModal(null)}>×</button>
            </div>
            <div className="modal-body">
              <div className="alert-block danger">
                <span className="alert-icon"><ShieldAlert size={18}/></span>
                <div className="alert-text">
                  <div className="alert-title">{blockModal.message}</div>
                  <div>{blockModal.reason}</div>
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-outline" onClick={() => setBlockModal(null)}>Close</button>
            </div>
          </div>
        </div>
      )}

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
          onResolved={() => {
            setTimeout(() => {
              retryPendingAction()
            }, 1500)
          }}
          onDenied={() => {
            setFreezeOverlay(null)
            setPendingAction(null)
            showToast('Action was denied by admin', 'error')
          }}
        />
      )}

      {toast && <div className={`toast ${toast.type}`}>{toast.msg}</div>}
    </div>
  )
}
