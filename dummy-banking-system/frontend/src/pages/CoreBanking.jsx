import { useState, useEffect } from 'react'
import { apiFetch } from '../App'
import KpiCard from '../components/KpiCard'
import Modal from '../components/Modal'
import { generateRandomTransactions, getRandomAmount } from '../utils/mockData'

const formatINR = (n) => `₹${Number(n).toLocaleString('en-IN')}`

export default function CoreBanking() {
  const [stats, setStats] = useState({
    totalDeposits: 450000000,
    activeAccounts: 1250,
    dailyWithdrawals: 12000000,
    pendingVerifications: 5
  })
  const [transactions, setTransactions] = useState([])
  const [accounts, setAccounts] = useState([
    { id: 'ACC-8901', name: 'Premium Savings', type: 'Savings', balance: 2500000, status: 'active' },
    { id: 'ACC-4421', name: 'Corporate Current', type: 'Current', balance: 18500000, status: 'active' },
    { id: 'ACC-3310', name: 'Fixed Deposit Pool', type: 'FD', balance: 120000000, status: 'active' },
    { id: 'ACC-9982', name: 'Salary Disbursement', type: 'Operational', balance: 4500000, status: 'active' },
  ])
  const [showAction, setShowAction] = useState(null) // 'deposit' or 'withdraw'
  const [formData, setFormData] = useState({})
  const [toast, setToast] = useState(null)
  const [activityFeed, setActivityFeed] = useState([
    { action: 'Account Created', detail: 'New Corporate Account ACC-5567', time: '10 mins ago' },
    { action: 'KYC Verified', detail: 'User ID: 122938 verified', time: '25 mins ago' },
    { action: 'Deposit', detail: 'Bulk salary credit processed', time: '1 hr ago' },
  ])

  useEffect(() => {
    // Simulate dynamic data
    setTransactions(generateRandomTransactions(10))
    setStats({
      totalDeposits: getRandomAmount(400000000, 500000000),
      activeAccounts: getRandomAmount(1200, 1300),
      dailyWithdrawals: getRandomAmount(10000000, 20000000),
      pendingVerifications: getRandomAmount(2, 12)
    })
  }, [])

  const showToast = (msg, type = 'success') => { setToast({ msg, type }); setTimeout(() => setToast(null), 4000) }

  const handleAction = () => {
    showToast(`${showAction === 'deposit' ? 'Deposit' : 'Withdrawal'} of ${formatINR(formData.amount)} successful.`)
    setShowAction(null)
    setFormData({})
  }

  return (
    <div className="core-banking-page">
      <div className="hero-landing-section">
        <div className="hero-card">
          <h3>Core Banking Terminal</h3>
          <p>Real-time account management, ledger reconciliation, and retail banking operations. Access restricted to Level 2 Administrative staff.</p>
        </div>
      </div>

      <div className="kpi-grid">
        <KpiCard icon="🏦" label="Total Deposits" value={formatINR(stats.totalDeposits)} color="blue" />
        <KpiCard icon="👥" label="Active Accounts" value={stats.activeAccounts} color="green" />
        <KpiCard icon="💸" label="Daily Withdrawals" value={formatINR(stats.dailyWithdrawals)} color="purple" />
        <KpiCard icon="🛡️" label="Pending KYC" value={stats.pendingVerifications} color="orange" />
      </div>

      <div className="grid-2">
        <div className="card">
          <div className="card-header">
            <h3>Master Account Ledger</h3>
          </div>
          <div className="card-body" style={{padding: 0}}>
            <div className="table-wrapper">
              <table>
                <thead><tr><th>Account ID</th><th>Name</th><th>Type</th><th className="text-right">Balance</th></tr></thead>
                <tbody>
                  {accounts.map(a => (
                    <tr key={a.id}>
                      <td style={{fontFamily:'monospace'}}>{a.id}</td>
                      <td><strong>{a.name}</strong></td>
                      <td><span className="badge neutral">{a.type}</span></td>
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
            <div className="card-header"><h3>Counter Operations</h3></div>
            <div className="card-body" style={{display:'flex', flexDirection:'column', gap:'12px'}}>
              <button className="btn btn-primary" onClick={() => setShowAction('deposit')}>📥 Cash Deposit</button>
              <button className="btn btn-outline" onClick={() => setShowAction('withdraw')}>💸 Immediate Withdrawal</button>
              <button className="btn btn-outline" disabled>📝 Open Account</button>
            </div>
          </div>

          <div className="card" style={{marginTop:'20px'}}>
            <div className="card-header"><h3>Internal Activity Feed</h3></div>
            <div className="card-body">
              <div className="activity-feed">
                {activityFeed.map((item, i) => (
                  <div className="activity-item" key={i}>
                    <div className="activity-dot"></div>
                    <div className="activity-content">
                      <div className="activity-title">{item.action}</div>
                      <div className="activity-detail">{item.detail}</div>
                      <div className="activity-time">{item.time}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-header"><h3>Transaction Audit Log</h3></div>
        <div className="card-body" style={{padding: 0}}>
          <div className="table-wrapper">
            <table>
              <thead><tr><th>TX ID</th><th>Type</th><th className="text-right">Amount</th><th>Description</th><th>Status</th><th>Timestamp</th></tr></thead>
              <tbody>
                {transactions.map(tx => (
                  <tr key={tx.id}>
                    <td style={{fontFamily:'monospace', fontSize:'13px'}}>{tx.id}</td>
                    <td><span className={`badge ${tx.type === 'deposit' ? 'success' : 'info'}`}>{tx.type}</span></td>
                    <td className="text-right amount">{tx.type === 'deposit' ? '+' : '-'}{formatINR(tx.amount)}</td>
                    <td style={{maxWidth:'250px', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}}>{tx.description}</td>
                    <td><span className={`badge ${tx.status === 'completed' ? 'success' : 'warning'}`}>{tx.status}</span></td>
                    <td style={{fontSize:'13px', color:'var(--text-muted)', whiteSpace:'nowrap'}}>
                      {tx.created_at ? new Date((typeof tx.created_at === 'string' && tx.created_at.includes(' ') && !tx.created_at.includes('Z')) ? tx.created_at.replace(' ', 'T') + 'Z' : tx.created_at).toLocaleString() : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <Modal show={!!showAction} onClose={() => setShowAction(null)} title={showAction === 'deposit' ? 'Cash Deposit' : 'Immediate Withdrawal'}
        footer={<><button className="btn btn-outline" onClick={() => setShowAction(null)}>Cancel</button>
          <button className="btn btn-primary" onClick={handleAction}>Process Transaction</button></>}>
        <div className="form-group">
          <label>Account Selection</label>
          <select className="form-select">
            {accounts.map(a => <option key={a.id} value={a.id}>{a.name} ({a.id})</option>)}
          </select>
        </div>
        <div className="form-group">
          <label>Transaction Amount (₹)</label>
          <input className="form-input" type="number" value={formData.amount || ''} onChange={e => setFormData({...formData, amount: e.target.value})} placeholder="0.00" />
        </div>
        <div className="form-group">
          <label>Authorized By (Officer ID)</label>
          <input className="form-input" placeholder="NB-OFF-XXXX" />
        </div>
      </Modal>

      {toast && <div className={`toast ${toast.type}`}>{toast.msg}</div>}
    </div>
  )
}
