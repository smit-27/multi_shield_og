import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { apiFetch } from '../App'
import FreezeOverlay from '../components/FreezeOverlay'
import JustifyModal from '../components/JustifyModal'
import { AlertTriangle, ArrowRightLeft, UserCircle, CreditCard, Home, FileText, Terminal, LogOut } from 'lucide-react'
import SessionReplay from '../components/SessionReplay'

const formatINR = (n) => `₹${Number(n).toLocaleString('en-IN')}`

export default function CustomerDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState(null)

  // Fraud Action states
  const [transferAmount, setTransferAmount] = useState('')
  const [transferDest, setTransferDest] = useState('')
  const [newEmail, setNewEmail] = useState('')
  const [newPhone, setNewPhone] = useState('')
  const [newAddress, setNewAddress] = useState('')
  
  // ZTA Overlays
  const [freezeOverlay, setFreezeOverlay] = useState(null)
  const [justifyModal, setJustifyModal] = useState(null)
  const [pendingAction, setPendingAction] = useState(null)
  const [showReplay, setShowReplay] = useState(false)

  const load = async () => {
    try {
      const details = await apiFetch(`/api/customers/${id}/details`)
      setData(details)
      setNewEmail(details.customer.email || '')
      setNewPhone(details.customer.phone || '')
    } catch (err) {
      console.error(err)
      showToast('Failed to load customer details', 'error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [id])

  const showToast = (msg, type = 'success') => { setToast({ msg, type }); setTimeout(() => setToast(null), 4000) }

  const handleSecurityResponse = (err, actionType, actionBody) => {
    const resData = err.data || err

    if (resData.justify_required) {
      setJustifyModal({ data: resData })
      setPendingAction({ type: actionType, body: actionBody })
      return
    }
    if (resData.mfa_required || resData.step_up_required) {
      setFreezeOverlay({ mode: 'mfa', data: resData })
      setPendingAction({ type: actionType, body: actionBody })
      return
    }
    if (resData.admin_approval_required) {
      setFreezeOverlay({ mode: 'admin', data: resData })
      setPendingAction({ type: actionType, body: actionBody })
      return
    }
    if (resData.blocked) {
      setFreezeOverlay({ mode: 'admin', data: { ...resData, reason: resData.reason || resData.message } })
      return
    }
    showToast(resData.message || err.message || 'An error occurred', 'error')
  }

  const retryPendingAction = async () => {
    setFreezeOverlay(null)
    setJustifyModal(null)
    const action = pendingAction
    if (!action) return

    try {
      let res;
      if (action.type === 'transfer') {
        res = await apiFetch('/api/treasury/transfer', { method: 'POST', body: JSON.stringify(action.body) })
      } else if (action.type === 'contact') {
        res = await apiFetch(`/api/customers/${id}/contact`, { method: 'PUT', body: JSON.stringify(action.body) })
      } else if (action.type === 'card') {
        res = await apiFetch(`/api/customers/${id}/cards/replace`, { method: 'POST', body: JSON.stringify(action.body) })
      }

      if (res.justify_required || res.mfa_required || res.admin_approval_required) {
        showToast('Action still pending security verification', 'error')
      } else {
        showToast(res.message || 'Action completed successfully')
        load()
      }
    } catch (err) {
      handleSecurityResponse(err, action.type, action.body)
    } finally {
      setPendingAction(null)
    }
  }

  const handleJustifySubmit = async (reason) => {
    try {
      const action = pendingAction;
      let url, method;
      if (action.type === 'transfer') { url = '/api/treasury/transfer'; method = 'POST' }
      else if (action.type === 'contact') { url = `/api/customers/${id}/contact`; method = 'PUT' }
      else if (action.type === 'card') { url = `/api/customers/${id}/cards/replace`; method = 'POST' }

      const res = await apiFetch(url, {
        method,
        body: JSON.stringify({ ...action.body, details: `Justified: ${reason}` }),
        headers: { 'X-Device': 'internal workstation' }
      })
      
      setJustifyModal(null)
      if (res.justify_required || res.mfa_required || res.admin_approval_required) {
        handleSecurityResponse(res, action.type, action.body)
      } else {
        showToast(res.message || 'Action approved and executed')
        load()
      }
    } catch (err) {
      handleSecurityResponse(err, pendingAction.type, pendingAction.body)
      setJustifyModal(null)
    }
  }

  const doTransferFraud = async () => {
    if (!data.accounts?.[0]?.id) return showToast("No primary account found", "error")
    const body = { from_account_id: data.accounts[0].id, to_account_id: transferDest, amount: Number(transferAmount), description: 'Authorized Transfer' }
    try {
      const res = await apiFetch('/api/treasury/transfer', { method: 'POST', body: JSON.stringify(body) })
      if (res.justify_required || res.mfa_required || res.admin_approval_required || res.step_up_required) {
        handleSecurityResponse(res, 'transfer', body)
        return
      }
      showToast(res.message)
      setTransferAmount(''); setTransferDest(''); load()
    } catch (err) { handleSecurityResponse(err, 'transfer', body) }
  }

  const doContactFraud = async () => {
    const body = { email: newEmail, phone: newPhone }
    try {
      const res = await apiFetch(`/api/customers/${id}/contact`, { method: 'PUT', body: JSON.stringify(body) })
      if (res.justify_required || res.mfa_required || res.admin_approval_required || res.step_up_required) {
        handleSecurityResponse(res, 'contact', body)
        return
      }
      showToast(res.message)
      load()
    } catch (err) { handleSecurityResponse(err, 'contact', body) }
  }

  const doCardFraud = async () => {
    if (!data.cards?.[0]?.id) return showToast("No active cards found", "error")
    const body = { card_id: data.cards[0].id, new_address: newAddress }
    try {
      const res = await apiFetch(`/api/customers/${id}/cards/replace`, { method: 'POST', body: JSON.stringify(body) })
      if (res.justify_required || res.mfa_required || res.admin_approval_required || res.step_up_required) {
        handleSecurityResponse(res, 'card', body)
        return
      }
      showToast(res.message)
      setNewAddress(''); load()
    } catch (err) { handleSecurityResponse(err, 'card', body) }
  }

  if (loading) return <div style={{padding:'40px'}}>Loading profile...</div>
  if (!data) return <div style={{padding:'40px'}}>Customer not found.</div>

  const { customer, accounts, cards, interactions, expenses } = data
  const primaryAccount = accounts[0] || {}

  return (
    <div style={{ padding: '8px', backgroundColor: '#1a1a1a', minHeight: '100vh', fontFamily: "'Inter', sans-serif" }}>

      {/* PAM Vault Injection Banner */}
      <div style={{ background: '#000', color: '#0f0', padding: '12px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: '1px solid #333', borderBottom: 'none', borderTopLeftRadius: '8px', borderTopRightRadius: '8px', fontFamily: 'monospace' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span className="blinking-dot" style={{ background: '#ff3b30', width: '10px', height: '10px' }} />
          <strong style={{ color: '#fff', fontSize: '14px' }}>[PAW] SECURE PROXY SESSION</strong>
          <span style={{ color: '#888', fontSize: '13px' }}>Target: {primaryAccount.id || customer.full_name} | Credentials Auto-Injected</span>
        </div>
        <button className="btn btn-sm" style={{ background: 'transparent', borderColor: 'var(--danger)', color: 'var(--danger)', display: 'flex', alignItems: 'center', gap: '6px' }} onClick={() => navigate('/customers')}>
          <LogOut size={14}/> Disconnect Session
        </button>
      </div>

      <div style={{ padding: '24px', backgroundColor: '#f4f7f6', border: '1px solid #333', borderBottomLeftRadius: '8px', borderBottomRightRadius: '8px' }}>
      
      <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap' }}>
        
        {/* Left Side Navigation Mockup */}
        <div style={{ width: '220px', background: 'white', borderRadius: '8px', padding: '16px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
          <div style={{ background: '#f89c1e', color: 'white', padding: '12px', borderRadius: '6px', fontWeight: 'bold', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Home size={16}/> Account
          </div>
          {['Cards', 'Loan', 'IRS', 'EFT', 'Shares', 'Money Exchange'].map(item => (
            <div key={item} style={{ padding: '12px', color: '#555', borderBottom: '1px solid #eee', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <FileText size={14}/> {item}
            </div>
          ))}
        </div>

        {/* Main Dashboard Area */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          {/* Top Row: Account Statement & Customer Info */}
          <div style={{ display: 'flex', gap: '20px' }}>
            <div style={{ flex: 1, background: 'white', padding: '20px', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #eee', paddingBottom: '12px', marginBottom: '16px' }}>
                <h4 style={{ margin: 0, color: '#333' }}>Account Statement</h4>
                <span style={{ color: '#f89c1e', cursor: 'pointer', fontSize: '13px', fontWeight: 'bold' }}>Email</span>
              </div>
              <div style={{ color: '#888', fontSize: '13px' }}>Current Balance</div>
              <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#333', marginTop: '4px' }}>
                {formatINR(primaryAccount.balance || customer.balance)}
              </div>
              <div style={{ marginTop: '20px', textAlign: 'center' }}>
                <div style={{ width: '120px', height: '60px', borderTopLeftRadius: '60px', borderTopRightRadius: '60px', border: '8px solid #f89c1e', borderBottom: 'none', margin: '0 auto', position: 'relative' }}>
                  <div style={{ position: 'absolute', bottom: '0', left: '50%', transform: 'translateX(-50%)', fontWeight: 'bold', fontSize: '24px' }}>
                    797
                  </div>
                </div>
                <div style={{ fontSize: '12px', color: '#888', marginTop: '4px' }}>Score</div>
              </div>
            </div>

            <div style={{ flex: 2, background: 'white', padding: '20px', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
              <h4 style={{ margin: '0 0 16px 0', borderBottom: '1px solid #eee', paddingBottom: '12px', color: '#333' }}>Customer Information</h4>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', fontSize: '14px' }}>
                <div>
                  <span style={{ color: '#888', display: 'inline-block', width: '100px' }}>A/C Number:</span>
                  <strong>{primaryAccount.id || 'N/A'}</strong>
                </div>
                <div>
                  <span style={{ color: '#888', display: 'inline-block', width: '100px' }}>PAN:</span>
                  <strong>{customer.pan}</strong>
                </div>
                <div>
                  <span style={{ color: '#888', display: 'inline-block', width: '100px' }}>Name:</span>
                  <strong>{customer.full_name}</strong>
                </div>
                <div>
                  <span style={{ color: '#888', display: 'inline-block', width: '100px' }}>Country:</span>
                  <strong>India</strong>
                </div>
                <div>
                  <span style={{ color: '#888', display: 'inline-block', width: '100px' }}>Account Type:</span>
                  <strong>{customer.account_type.toUpperCase()}</strong>
                </div>
                <div>
                  <span style={{ color: '#888', display: 'inline-block', width: '100px' }}>Phone No:</span>
                  <strong>{customer.phone}</strong>
                </div>
                <div style={{ gridColumn: 'span 2' }}>
                  <span style={{ color: '#888', display: 'inline-block', width: '100px' }}>Email:</span>
                  <strong>{customer.email}</strong>
                </div>
              </div>
            </div>
          </div>

          {/* Middle Row: Interactions & Spend Analysis */}
          <div style={{ display: 'flex', gap: '20px' }}>
            <div style={{ flex: 2, background: 'white', padding: '20px', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #eee', paddingBottom: '12px', marginBottom: '16px' }}>
                <h4 style={{ margin: 0, color: '#333' }}>Recent Audited Actions</h4>
                <button className="btn btn-sm btn-outline" style={{ display: 'flex', alignItems: 'center', gap: '6px' }} onClick={() => setShowReplay(true)}>
                  <Terminal size={14}/> View Detailed Audit
                </button>
              </div>
              <table style={{ width: '100%', fontSize: '13px', textAlign: 'left', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ color: '#888', borderBottom: '1px solid #eee' }}>
                    <th style={{ padding: '8px 0' }}>Date & Time</th>
                    <th>Duration</th>
                    <th>Source</th>
                    <th>Call Reason</th>
                  </tr>
                </thead>
                <tbody>
                  {interactions.map((i, idx) => (
                    <tr key={idx} style={{ borderBottom: '1px solid #f9f9f9' }}>
                      <td style={{ padding: '12px 0' }}>{i.date}</td>
                      <td>{i.duration}</td>
                      <td>{i.source}</td>
                      <td>{i.reason}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div style={{ flex: 1, background: 'white', padding: '20px', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
              <h4 style={{ margin: '0 0 16px 0', borderBottom: '1px solid #eee', paddingBottom: '12px', color: '#333' }}>All Expenses</h4>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '150px' }}>
                <svg viewBox="0 0 32 32" style={{ width: '120px', height: '120px', borderRadius: '50%', background: 'conic-gradient(#f89c1e 0 40%, #ffc107 0 60%, #ffeb3b 0 85%, #ff9800 0 100%)' }}></svg>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', justifyContent: 'center', marginTop: '16px', fontSize: '12px' }}>
                {expenses.labels.map((l, i) => (
                  <span key={i} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <span style={{ display: 'inline-block', width: '8px', height: '8px', background: ['#f89c1e', '#ffc107', '#ffeb3b', '#ff9800'][i], borderRadius: '50%' }}></span>
                    {l} ({expenses.values[i]}%)
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Bottom Row: Privileged Actions (Insider Threat Vectors) */}
          <div style={{ background: '#fff3cd', padding: '20px', borderRadius: '8px', border: '1px solid #ffeeba', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
            <h4 style={{ margin: '0 0 16px 0', borderBottom: '1px solid #ffeeba', paddingBottom: '12px', color: '#856404', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Terminal size={20}/> Insider Threat Vectors — Credential Vault Actions
            </h4>
            <p style={{ fontSize: '13px', color: '#856404', marginBottom: '20px' }}>
              You do not see passwords. Credentials are automatically injected by the PAW. All actions executed here are explicitly tied to your session ID and audited.
            </p>
            
            <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap' }}>
              
              {/* Force Transfer */}
              <div style={{ flex: 1, minWidth: '250px', background: 'white', padding: '16px', borderRadius: '6px', border: '1px solid #ddd' }}>
                <h5 style={{ margin: '0 0 12px 0', color: '#d9534f', display: 'flex', alignItems: 'center', gap: '6px' }}><ArrowRightLeft size={16}/> Financial Fraud (Transfer)</h5>
                <input type="number" placeholder="Amount (INR)" className="form-input" style={{ marginBottom: '8px', width: '100%' }} value={transferAmount} onChange={e => setTransferAmount(e.target.value)} />
                <input type="text" placeholder="Destination AC (e.g. ACC004)" className="form-input" style={{ marginBottom: '12px', width: '100%' }} value={transferDest} onChange={e => setTransferDest(e.target.value)} />
                <button className="btn btn-sm btn-primary" onClick={doTransferFraud} style={{ width: '100%' }}>Initiate Transfer</button>
              </div>

              {/* Account Takeover */}
              <div style={{ flex: 1, minWidth: '250px', background: 'white', padding: '16px', borderRadius: '6px', border: '1px solid #ddd' }}>
                <h5 style={{ margin: '0 0 12px 0', color: '#f0ad4e', display: 'flex', alignItems: 'center', gap: '6px' }}><UserCircle size={16}/> Account Takeover (Modify Details)</h5>
                <input type="email" placeholder="New Email" className="form-input" style={{ marginBottom: '8px', width: '100%' }} value={newEmail} onChange={e => setNewEmail(e.target.value)} />
                <input type="text" placeholder="New Phone" className="form-input" style={{ marginBottom: '12px', width: '100%' }} value={newPhone} onChange={e => setNewPhone(e.target.value)} />
                <button className="btn btn-sm" onClick={doContactFraud} style={{ width: '100%', background: '#f0ad4e', color: 'white', border: 'none' }}>Change Details</button>
              </div>

              {/* Physical Fraud */}
              <div style={{ flex: 1, minWidth: '250px', background: 'white', padding: '16px', borderRadius: '6px', border: '1px solid #ddd' }}>
                <h5 style={{ margin: '0 0 12px 0', color: '#5bc0de', display: 'flex', alignItems: 'center', gap: '6px' }}><CreditCard size={16}/> Physical Fraud (Card Replacement)</h5>
                <textarea placeholder="New Shipping Address..." className="form-input" rows="2" style={{ marginBottom: '12px', width: '100%' }} value={newAddress} onChange={e => setNewAddress(e.target.value)} />
                <button className="btn btn-sm" onClick={doCardFraud} style={{ width: '100%', background: '#5bc0de', color: 'white', border: 'none' }}>Issue Replacement Card</button>
              </div>

            </div>
          </div>

        </div>
      </div>

      <JustifyModal show={!!justifyModal} data={justifyModal?.data} onSubmit={handleJustifySubmit} onClose={() => { setJustifyModal(null); setPendingAction(null) }} />
      {freezeOverlay && (
        <FreezeOverlay
          mode={freezeOverlay.mode}
          data={freezeOverlay.data}
          onResolved={() => { setTimeout(() => retryPendingAction(), 1500) }}
          onDenied={() => { setFreezeOverlay(null); setPendingAction(null); showToast('Action was denied by admin', 'error') }}
        />
      )}
      <SessionReplay show={showReplay} onClose={() => setShowReplay(false)} />
      {toast && <div className={`toast ${toast.type}`}>{toast.msg}</div>}
      </div>
    </div>
  )
}
