import { useState, useEffect } from 'react'
import { apiFetch } from '../App'
import KpiCard from '../components/KpiCard'
import Modal from '../components/Modal'
import FreezeOverlay from '../components/FreezeOverlay'
import JustifyModal from '../components/JustifyModal'

const formatINR = (n) => `₹${Number(n).toLocaleString('en-IN')}`

export default function Treasury() {
  const [stats, setStats] = useState({})
  const [transactions, setTransactions] = useState([])
  const [accounts, setAccounts] = useState([])
  const [showWithdraw, setShowWithdraw] = useState(false)
  const [showTransfer, setShowTransfer] = useState(false)
  const [blockModal, setBlockModal] = useState(null)
  const [toast, setToast] = useState(null)
  const [formData, setFormData] = useState({})
  const [submitting, setSubmitting] = useState(false)

  // Tier-aware state
  const [freezeOverlay, setFreezeOverlay] = useState(null)  // { mode, data }
  const [justifyModal, setJustifyModal] = useState(null)     // { data, pendingAction }
  const [pendingAction, setPendingAction] = useState(null)   // { type, body }

  const load = () => {
    apiFetch('/api/treasury/stats').then(setStats).catch(console.error)
    apiFetch('/api/treasury/transactions?limit=15').then(d => setTransactions(d.transactions)).catch(console.error)
    apiFetch('/api/treasury/balances').then(d => setAccounts(d.accounts)).catch(console.error)
  }
  useEffect(load, [])

  const showToast = (msg, type = 'success') => { setToast({ msg, type }); setTimeout(() => setToast(null), 4000) }

  const handleSecurityResponse = (err, actionType, actionBody) => {
    const data = err.data || err

    // Tier 2: Justification required
    if (data.justify_required) {
      setJustifyModal({ data })
      setPendingAction({ type: actionType, body: actionBody })
      return
    }

    // Tier 3: MFA required
    if (data.mfa_required) {
      setFreezeOverlay({ mode: 'mfa', data })
      setPendingAction({ type: actionType, body: actionBody })
      return
    }

    // Tier 4: Admin approval required
    if (data.admin_approval_required) {
      setFreezeOverlay({ mode: 'admin', data })
      setPendingAction({ type: actionType, body: actionBody })
      return
    }

    // Legacy block handling
    if (data.blocked) {
      setBlockModal(data)
      return
    }

    // Generic error
    showToast(data.message || err.message || 'An error occurred', 'error')
  }

  const handleWithdraw = async () => {
    setSubmitting(true)
    const body = { account_id: formData.account_id, amount: Number(formData.amount), description: formData.description }
    try {
      const res = await apiFetch('/api/treasury/withdraw', { method: 'POST', body: JSON.stringify(body) })
      if (res.justify_required || res.mfa_required || res.admin_approval_required) {
        handleSecurityResponse(res, 'withdraw', body)
        setShowWithdraw(false)
        return
      }
      showToast(res.message)
      setShowWithdraw(false); setFormData({}); load()
    } catch (err) {
      setShowWithdraw(false)
      handleSecurityResponse(err, 'withdraw', body)
    } finally { setSubmitting(false) }
  }

  const handleTransfer = async () => {
    setSubmitting(true)
    const body = { from_account_id: formData.from_account_id, to_account_id: formData.to_account_id, amount: Number(formData.amount), description: formData.description }
    try {
      const res = await apiFetch('/api/treasury/transfer', { method: 'POST', body: JSON.stringify(body) })
      if (res.justify_required || res.mfa_required || res.admin_approval_required) {
        handleSecurityResponse(res, 'transfer', body)
        setShowTransfer(false)
        return
      }
      showToast(res.message)
      setShowTransfer(false); setFormData({}); load()
    } catch (err) {
      setShowTransfer(false)
      handleSecurityResponse(err, 'transfer', body)
    } finally { setSubmitting(false) }
  }

  // Retry action after MFA/approval success
  const retryPendingAction = async () => {
    if (!pendingAction) return
    setFreezeOverlay(null)
    setSubmitting(true)
    try {
      const endpoint = pendingAction.type === 'withdraw' ? '/api/treasury/withdraw' : '/api/treasury/transfer'
      const res = await apiFetch(endpoint, {
        method: 'POST',
        body: JSON.stringify(pendingAction.body),
        headers: { 'X-Device': 'internal workstation' }
      })
      if (res.justify_required || res.mfa_required || res.admin_approval_required) {
        showToast('Action still requires additional verification', 'error')
      } else {
        showToast(res.message || 'Action completed successfully')
        load()
      }
    } catch (err) {
      showToast('Action could not be completed: ' + (err.message || 'Unknown error'), 'error')
    } finally {
      setSubmitting(false)
      setPendingAction(null)
    }
  }

  // Handle justification submit
  const handleJustifySubmit = async (reason) => {
    showToast(`Justification submitted: "${reason}"`)
    setJustifyModal(null)
    if (pendingAction) {
      // Retry the action with the device header set to known device to lower the score
      setSubmitting(true)
      try {
        const endpoint = pendingAction.type === 'withdraw' ? '/api/treasury/withdraw' : '/api/treasury/transfer'
        const res = await apiFetch(endpoint, {
          method: 'POST',
          body: JSON.stringify({ ...pendingAction.body, details: `Justified: ${reason}` }),
          headers: { 'X-Device': 'internal workstation' }
        })
        if (res.justify_required || res.mfa_required || res.admin_approval_required) {
          handleSecurityResponse(res, pendingAction.type, pendingAction.body)
        } else {
          showToast(res.message || 'Action completed successfully')
          load()
        }
      } catch (err) {
        handleSecurityResponse(err, pendingAction.type, pendingAction.body)
      } finally {
        setSubmitting(false)
        setPendingAction(null)
      }
    }
  }

  const statusBadge = (s) => {
    const map = { completed: 'success', pending: 'warning', blocked: 'danger' }
    return <span className={`badge ${map[s] || 'neutral'}`}>{s}</span>
  }

  return (
    <div>
      <div className="hero-landing-section">
        <div className="hero-card">
          <h3>Welcome to Treasury Operations</h3>
          <p>Institutional liquidity management, inter-terminal transfers, and high-value withdrawals. All operations are subject to real-time risk assessment.</p>
        </div>
      </div>

      <div className="kpi-grid">
        <KpiCard icon="💰" label="Total Balance" value={formatINR(stats.totalBalance || 0)} color="blue" change="↑ 2.4% from yesterday" />
        <KpiCard icon="📊" label="Daily Volume" value={formatINR(stats.dailyVolume || 0)} color="green" />
        <KpiCard icon="⏳" label="Pending Approvals" value={stats.pendingApprovals || 0} color="orange" />
        <KpiCard icon="🚫" label="Blocked Transactions" value={stats.blockedTransactions || 0} color="red" />
      </div>

      <div className="grid-2">
        <div className="card">
          <div className="card-header">
            <h3>Account Balances</h3>
          </div>
          <div className="card-body" style={{padding: 0}}>
            <div className="table-wrapper">
              <table>
                <thead><tr><th>Account</th><th>Type</th><th className="text-right">Balance</th></tr></thead>
                <tbody>
                  {accounts.map(a => (
                    <tr key={a.id}>
                      <td><strong>{a.account_name}</strong><br/><span style={{fontSize:'12px', color:'var(--text-muted)'}}>{a.id}</span></td>
                      <td><span className="badge neutral">{a.account_type}</span></td>
                      <td className="text-right amount">{formatINR(a.balance)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div>
          <div className="card">
            <div className="card-header"><h3>Quick Actions</h3></div>
            <div className="card-body" style={{display:'flex', flexDirection:'column', gap:'12px'}}>
              <button className="btn btn-primary" onClick={() => { setFormData({}); setShowWithdraw(true) }}>💸 Large Withdrawal</button>
              <button className="btn btn-outline" onClick={() => { setFormData({}); setShowTransfer(true) }}>🔄 Internal Transfer</button>
            </div>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-header"><h3>Recent Transactions</h3></div>
        <div className="card-body" style={{padding: 0}}>
          <div className="table-wrapper">
            <table>
              <thead><tr><th>ID</th><th>Account</th><th>Type</th><th className="text-right">Amount</th><th>Description</th><th>Status</th><th>Time</th></tr></thead>
              <tbody>
                {transactions.map(tx => (
                  <tr key={tx.id}>
                    <td style={{fontFamily:'monospace', fontSize:'13px'}}>{tx.id}</td>
                    <td>{tx.account_name || tx.account_id}</td>
                    <td><span className="badge info">{tx.type}</span></td>
                    <td className="text-right amount">{formatINR(tx.amount)}</td>
                    <td style={{maxWidth:'200px', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}}>{tx.description}</td>
                    <td>{statusBadge(tx.status)}</td>
                    <td style={{fontSize:'13px', color:'var(--text-muted)', whiteSpace:'nowrap'}}>{tx.created_at}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Withdraw Modal */}
      <Modal show={showWithdraw} onClose={() => setShowWithdraw(false)} title="Large Withdrawal" icon="💸"
        footer={<><button className="btn btn-outline" onClick={() => setShowWithdraw(false)}>Cancel</button>
          <button className="btn btn-primary" onClick={handleWithdraw} disabled={submitting}>{submitting ? 'Processing...' : 'Submit Withdrawal'}</button></>}>
        <div className="form-group">
          <label>Account</label>
          <select className="form-select" value={formData.account_id || ''} onChange={e => setFormData({...formData, account_id: e.target.value})} onKeyDown={e => e.key === 'Enter' && handleWithdraw()}>
            <option value="">Select account</option>
            {accounts.map(a => <option key={a.id} value={a.id}>{a.account_name} ({formatINR(a.balance)})</option>)}
          </select>
        </div>
        <div className="form-group">
          <label>Amount (₹)</label>
          <input className="form-input" type="number" value={formData.amount || ''} onChange={e => setFormData({...formData, amount: e.target.value})} onKeyDown={e => e.key === 'Enter' && handleWithdraw()} placeholder="Enter amount" />
        </div>
        <div className="form-group">
          <label>Description</label>
          <input className="form-input" value={formData.description || ''} onChange={e => setFormData({...formData, description: e.target.value})} onKeyDown={e => e.key === 'Enter' && handleWithdraw()} placeholder="Reason for withdrawal" />
        </div>
      </Modal>

      {/* Transfer Modal */}
      <Modal show={showTransfer} onClose={() => setShowTransfer(false)} title="Internal Transfer" icon="🔄"
        footer={<><button className="btn btn-outline" onClick={() => setShowTransfer(false)}>Cancel</button>
          <button className="btn btn-primary" onClick={handleTransfer} disabled={submitting}>{submitting ? 'Processing...' : 'Submit Transfer'}</button></>}>
        <div className="form-group">
          <label>From Account</label>
          <select className="form-select" value={formData.from_account_id || ''} onChange={e => setFormData({...formData, from_account_id: e.target.value})}>
            <option value="">Select source</option>
            {accounts.map(a => <option key={a.id} value={a.id}>{a.account_name} ({formatINR(a.balance)})</option>)}
          </select>
        </div>
        <div className="form-group">
          <label>To Account</label>
          <select className="form-select" value={formData.to_account_id || ''} onChange={e => setFormData({...formData, to_account_id: e.target.value})}>
            <option value="">Select destination</option>
            {accounts.map(a => <option key={a.id} value={a.id}>{a.account_name}</option>)}
          </select>
        </div>
        <div className="form-group">
          <label>Amount (₹)</label>
          <input className="form-input" type="number" value={formData.amount || ''} onChange={e => setFormData({...formData, amount: e.target.value})} placeholder="Enter amount" />
        </div>
        <div className="form-group">
          <label>Description</label>
          <input className="form-input" value={formData.description || ''} onChange={e => setFormData({...formData, description: e.target.value})} placeholder="Transfer note" />
        </div>
      </Modal>

      {/* Legacy Security Block Modal (fallback) */}
      <Modal show={!!blockModal} onClose={() => setBlockModal(null)}
        title="Transaction Blocked" icon="🚨"
        footer={<button className="btn btn-outline" onClick={() => setBlockModal(null)}>Close</button>}>
        {blockModal && (
          <>
            <div className="alert-block danger">
              <span className="alert-icon">🛑</span>
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
