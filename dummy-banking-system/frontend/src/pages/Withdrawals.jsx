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
  const [stats, setStats] = useState({})
  const [formData, setFormData] = useState({})
  const [freezeData, setFreezeData] = useState(null)
  const [justifyData, setJustifyData] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      const [accs, wds, st] = await Promise.all([
        apiFetch('/api/accounts'),
        apiFetch('/api/withdrawals'),
        apiFetch('/api/withdrawals/stats')
      ])
      setAccounts(accs || [])
      setWithdrawals(wds || [])
      setStats(st || {})
    } catch (err) {
      console.error('Failed to load Cash Management data:', err)
    }
  }

  const handleWithdraw = async (justification = null) => {
    if (!formData.account_id || !formData.amount) {
      setError('Please select an account and enter an amount')
      return
    }
    setSubmitting(true)
    setError('')
    setSuccess('')

    const payload = {
      account_id: formData.account_id,
      amount: parseFloat(formData.amount),
      description: formData.description || ''
    }
    if (justification) payload.justification = justification

    try {
      const res = await apiFetch('/api/withdrawals', {
        method: 'POST',
        body: JSON.stringify(payload)
      })

      // Handle tiered security responses
      if (res.justify_required) {
        setJustifyData({ message: res.message })
        return
      }
      if (res.mfa_required || res.step_up_required) {
        setFreezeData({ mode: 'mfa', data: res })
        return
      }
      if (res.admin_approval_required) {
        setFreezeData({ mode: 'admin', data: res })
        return
      }

      setSuccess(res.message || 'Disbursement processed successfully')
      setFormData({})
      loadData()
    } catch (err) {
      const data = err.data || {}
      if (data.justify_required) {
        setJustifyData({ message: data.message })
      } else if (data.mfa_required || data.step_up_required) {
        setFreezeData({ mode: 'mfa', data })
      } else if (data.admin_approval_required) {
        setFreezeData({ mode: 'admin', data })
      } else {
        setError(err.message || 'Failed to process disbursement')
      }
    } finally {
      if (!justification) setSubmitting(false)
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
    setError('Action was blocked or denied.')
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
        <KpiCard icon={<Coins size={20} />} label="Total Disbursed Today" value={formatINR(stats.disbursedToday || 0)} color="blue" />
        <KpiCard icon={<Clock size={20} />} label="Pending Clearance" value={stats.pendingCount || 0} color="orange" />
        <KpiCard icon={<ShieldAlert size={20} />} label="Compliance Holds" value={stats.complianceHolds || 0} color="red" />
        <KpiCard icon={<CheckCircle size={20} />} label="Cleared Limits" value={formatINR(stats.clearedLimit || 0)} color="green" />
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
              <select className="form-select" value={formData.account_id || ''} onChange={e => setFormData({...formData, account_id: e.target.value})}>
                <option value="">Select an account...</option>
                {accounts.map(a => <option key={a.id} value={a.id}>{a.account_name} ({formatINR(a.balance)})</option>)}
              </select>
            </div>
            
            <div className="form-group">
              <label>Disbursement Amount (₹)</label>
              <input className="form-input" type="number" value={formData.amount || ''} onChange={e => setFormData({...formData, amount: e.target.value})} placeholder="Enter amount (min ₹1,000)" />
            </div>
            
            <div className="form-group">
              <label>Narration / Purpose</label>
              <input className="form-input" value={formData.description || ''} onChange={e => setFormData({...formData, description: e.target.value})} placeholder="e.g. Vendor Payment INV-2026-0431" />
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
                      <td>{w.account_name || w.account_id}</td>
                      <td className="text-right amount">{formatINR(w.amount)}</td>
                      <td>{w.description || '—'}</td>
                      <td>
                        <span className={`badge ${w.status === 'completed' || w.status === 'approved' ? 'success' : w.status === 'blocked' || w.status === 'rejected' ? 'danger' : 'warning'}`}>
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
      {justifyData && <JustifyModal show={true} data={justifyData} onSubmit={(j) => { setJustifyData(null); handleWithdraw(j) }} onClose={() => setJustifyData(null)} />}
    </div>
  )
}
