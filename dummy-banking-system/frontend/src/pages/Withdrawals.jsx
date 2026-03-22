import { useState, useEffect } from 'react'
import { apiFetch, useAuth } from '../App'
import Modal from '../components/Modal'
import FreezeOverlay from '../components/FreezeOverlay'
import JustifyModal from '../components/JustifyModal'
import KpiCard from '../components/KpiCard'
import { ArrowDownToLine, Coins, Clock, ShieldAlert, CheckCircle } from 'lucide-react'

const formatINR = (n) => `₹${Number(n).toLocaleString('en-IN')}`

export default function Withdrawals() {
  const { user } = useAuth()
  const [accounts, setAccounts] = useState([])
  const [withdrawals, setWithdrawals] = useState([])
  const [formData, setFormData] = useState({})
  const [freezeData, setFreezeData] = useState(null)
  const [justifyData, setJustifyData] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [deniedModal, setDeniedModal] = useState(null)
  const [structuringDelay, setStructuringDelay] = useState(0) // 30s counter
  const [blockScreen, setBlockScreen] = useState(false)
  const [structPendingSuccess, setStructPendingSuccess] = useState(null)

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      const [balData, txData] = await Promise.all([
        apiFetch('/api/treasury/balances'),
        apiFetch('/api/treasury/transactions?limit=15&type=withdrawal')
      ])
      setAccounts(balData.accounts || [])
      const wds = (txData.transactions || []).filter(t => t.type === 'withdrawal')
      setWithdrawals(wds.length ? wds : [
        { id: 1042, account_name: 'Corporate Salary Acc', amount: 450000, description: 'Payroll Jan 2026', status: 'approved', created_at: new Date(Date.now() - 86400000).toISOString() },
        { id: 1041, account_name: 'Vendor Ops Acc', amount: 82000, description: 'Office Supplies Q1', status: 'approved', created_at: new Date(Date.now() - 172800000).toISOString() }
      ])
    } catch (err) {
      console.error(err)
    }
  }

  const handleWithdraw = async (justification = null) => {
    if (!formData.account_id || !formData.amount) return
    setSubmitting(true)
    setError('')
    setSuccess('')

    const payload = {
      account_id: parseInt(formData.account_id),
      amount: parseFloat(formData.amount),
      description: formData.description
    }
    if (justification) payload.justification = justification

    try {
      const data = await apiFetch('/api/treasury/withdraw', {
        method: 'POST',
        body: JSON.stringify(payload)
      })

      if (data.structuringFlag) {
        if (data.matchCount >= 3) {
          setBlockScreen(true)
          if (!justification) setSubmitting(false)
          return
        } else if (data.matchCount === 2) {
          setStructuringDelay(30)
          setStructPendingSuccess('Withdrawal processed successfully')
          if (!justification) setSubmitting(false)
          return
        } else if (data.matchCount === 1) {
          setError('') // clear error
          setSuccess("Repeated transaction detected. If this wasn't intentional, please contact support.")
        }
      }

      if (data.justify_required) {
        setJustifyData({ message: data.message })
        return
      }
      
      if (data.mfa_required || data.step_up_required) {
        setFreezeData({ mode: 'mfa', data })
        return
      }

      if (data.admin_approval_required) {
        setFreezeData({ mode: 'admin', data })
        return
      }

      if (data.matchCount !== 1) {
         setSuccess('Withdrawal processed successfully')
      }
      setFormData({})
      loadData()
    } catch (err) {
      setError(err.message || 'Failed to process withdrawal')
    } finally {
      if (!justification && !structuringDelay && !blockScreen) setSubmitting(false)
    }
  }

  const handleResolved = () => {
    setFreezeData(null)
    setJustifyData(null)
    setSuccess('Action authorized and completed.')
    setFormData({})
    loadData()
  }

  const handleDenied = () => {
    setFreezeData(null)
    setJustifyData(null)
    setFormData({})
    setDeniedModal('This action has been permanently blocked by the security administrator.')
  }

  // Structuring delay timer effect
  useEffect(() => {
    let interval = null;
    if (structuringDelay > 0) {
      interval = setInterval(() => {
        setStructuringDelay((d) => {
          if (d <= 1) {
            clearInterval(interval);
            if (structPendingSuccess) setSuccess(structPendingSuccess);
            setFormData({}); loadData();
            return 0;
          }
          return d - 1;
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [structuringDelay, structPendingSuccess]);

  if (blockScreen) {
    return (
      <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(20, 0, 0, 0.95)', zIndex: 99999, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column' }}>
        <ShieldAlert size={64} color="var(--danger)" style={{ marginBottom: '24px' }} />
        <h1 style={{ color: '#fff', fontSize: '32px', marginBottom: '16px' }}>Account Temporarily Suspended</h1>
        <p style={{ color: '#ccc', fontSize: '18px', maxWidth: '600px', textAlign: 'center', marginBottom: '40px' }}>
          Suspicious repetitive transaction activity has been detected. Your account is under review. Reference: TXN-{Date.now()}. Contact support to appeal.
        </p>
        <button className="btn btn-primary" style={{ padding: '12px 32px', fontSize: '18px' }} onClick={() => window.location.reload()}>Contact Support</button>
      </div>
    )
  }

  return (
    <div>
      <div className="hero-landing-section">
        <div className="hero-card">
          <h3>Cash Management & Disbursements</h3>
          <p>Process high-value withdrawals and fund disbursements. All requests above ₹50,000 are subject to mandatory compliance checks per RBI Master Direction on KYC.</p>
        </div>
      </div>

      <div className="grid-4" style={{ marginBottom: '24px' }}>
        <KpiCard icon={<Coins size={20} />} label="Total Disbursed Today" value={formatINR(850000)} color="blue" />
        <KpiCard icon={<Clock size={20} />} label="Pending Clearance" value={3} color="orange" />
        <KpiCard icon={<ShieldAlert size={20} />} label="Compliance Holds" value={1} color="red" />
        <KpiCard icon={<CheckCircle size={20} />} label="Cleared Limits" value={formatINR(5000000)} color="green" />
      </div>

      <div className="grid-2">
        <div className="card">
          <div className="card-header">
            <h3 style={{display: 'flex', alignItems: 'center', gap: '8px'}}><ArrowDownToLine size={18}/> Initiate Fund Disbursement</h3>
          </div>
          <div className="card-body">
            {error && <div className="alert alert-danger mb-4">{error}</div>}
            {success && <div className="alert alert-success mb-4">{success}</div>}
            
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
            
            <button style={{marginTop: '20px', width: '100%', justifyContent: 'center'}} className="btn btn-primary" onClick={() => handleWithdraw()} disabled={submitting}>
              {submitting ? 'Processing...' : 'Submit for Compliance Clearance'}
            </button>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <h3>Recent Disbursements</h3>
          </div>
          <div className="card-body" style={{padding: 0}}>
            <div className="table-wrapper">
              <table>
                <thead><tr><th>Account</th><th className="text-right">Amount</th><th>Narration</th><th>Status</th></tr></thead>
                <tbody>
                  {withdrawals.map(w => (
                    <tr key={w.id}>
                      <td>{w.account_name}</td>
                      <td className="text-right amount">{formatINR(w.amount)}</td>
                      <td>{w.description || '—'}</td>
                      <td>
                        <span className={`badge ${w.status === 'approved' ? 'success' : w.status === 'rejected' ? 'danger' : 'warning'}`}>
                          {w.status.toUpperCase()}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {withdrawals.length === 0 && <tr><td colSpan={4} className="empty-state">No recent disbursements</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {freezeData && <FreezeOverlay mode={freezeData.mode} data={freezeData.data} onResolved={handleResolved} onDenied={handleDenied} />}
      {justifyData && <JustifyModal message={justifyData.message} onSubmit={(j) => handleWithdraw(j)} onCancel={() => setJustifyData(null)} />}
      
      {/* 30s Structuring Delay Modal */}
      <Modal show={structuringDelay > 0} onClose={() => setStructuringDelay(0)} title="Security Review Pending" icon={<Clock size={20} color="var(--warning)" />}
        footer={<button className="btn btn-outline" onClick={() => { setStructuringDelay(0); setSuccess(''); setError('Transaction cancelled locally.'); }}>Cancel Transaction</button>}>
        <div style={{ textAlign: 'center', padding: '24px' }}>
          <h2 style={{ fontSize: '48px', margin: '0 0 16px 0', fontFamily: 'monospace', color: 'var(--warning)' }}>00:{structuringDelay.toString().padStart(2, '0')}</h2>
          <p style={{ color: 'var(--text-secondary)' }}>This is your 3rd repeated transaction pattern within 24 hours. It will be processed after a 30-second security review.</p>
        </div>
      </Modal>

      <Modal show={!!deniedModal} onClose={() => setDeniedModal(null)} title="Action Denied" icon={<ShieldAlert size={20} color="var(--danger)" />} footer={<button className="btn btn-outline" onClick={() => setDeniedModal(null)}>Close</button>}>
        <div className="alert-block danger">
          <span className="alert-icon"><ShieldAlert size={18}/></span>
          <div className="alert-text">
            <div className="alert-title">Admin Denial</div>
            <div>{deniedModal}</div>
          </div>
        </div>
      </Modal>
    </div>
  )
}
