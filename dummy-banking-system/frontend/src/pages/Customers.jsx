import { useState, useEffect } from 'react'
import { apiFetch } from '../App'
import KpiCard from '../components/KpiCard'
import Modal from '../components/Modal'
import Icon from '../components/Icon'

const formatINR = (n) => `₹${Number(n).toLocaleString('en-IN')}`

export default function Customers() {
  const [customers, setCustomers] = useState([])
  const [stats, setStats] = useState({})
  const [search, setSearch] = useState('')
  const [blockModal, setBlockModal] = useState(null)
  const [toast, setToast] = useState(null)
  const [exporting, setExporting] = useState(false)

  const load = () => {
    const q = search ? `?search=${encodeURIComponent(search)}` : ''
    apiFetch(`/api/customers${q}`).then(d => setCustomers(d.customers)).catch(console.error)
    apiFetch('/api/customers/stats').then(setStats).catch(console.error)
  }
  useEffect(load, [search])

  const showToast = (msg, type = 'success') => { setToast({ msg, type }); setTimeout(() => setToast(null), 4000) }

  const exportData = async () => {
    setExporting(true)
    try {
      const res = await apiFetch('/api/customers/export', { method: 'POST', body: JSON.stringify({ format: 'json' }) })
      showToast(`Exported ${res.record_count} records`)
    } catch (err) {
      if (err.status === 403 || err.status === 202) {
        setBlockModal(err.data)
      } else {
        showToast(err.message, 'error')
      }
    } finally { setExporting(false) }
  }

  const riskBadge = (r) => {
    const map = { low: 'success', medium: 'warning', high: 'danger' }
    return <span className={`badge ${map[r] || 'neutral'}`}>{r}</span>
  }

  return (
    <div>
      <div className="hero-landing-section">
        <div className="hero-card">
          <h3>Customer Relationship Index</h3>
          <p>Access authorized customer records, perform KYC audits, and manage high-net-worth relationships within the secure database.</p>
        </div>
      </div>

      <div className="kpi-grid">
        <KpiCard icon={<Icon name="customers" color="var(--primary)" />} label="Total Customers" value={stats.total || 0} color="blue" />
        <KpiCard icon={<Icon name="check" color="var(--success)" />} label="Active Accounts" value={stats.active || 0} color="green" />
        <KpiCard icon={<Icon name="warning" color="var(--danger)" />} label="High Risk" value={stats.highRisk || 0} color="red" />
        <KpiCard icon={<Icon name="money" color="var(--purple)" />} label="Total Deposits" value={formatINR(stats.totalBalance || 0)} color="purple" />
      </div>

      <div className="card">
        <div className="card-header">
          <h3>Customer Records</h3>
          <div style={{display:'flex', gap:'8px'}}>
            <button className="btn btn-sm btn-outline" onClick={exportData} disabled={exporting}>
              {exporting ? <><Icon name="refresh" size={14} className="spin" /> Exporting...</> : <><Icon name="withdraw" size={14} /> Export All</>}
            </button>
          </div>
        </div>
        <div className="card-body">
          <div className="search-box">
            <span className="search-icon"><Icon name="customers" size={16} /></span>
            <input className="form-input" placeholder="Search customers by name, email, PAN, phone..."
              value={search} onChange={e => setSearch(e.target.value)} style={{paddingLeft:'40px'}} />
          </div>
          <div className="table-wrapper">
            <table>
              <thead><tr><th>ID</th><th>Name</th><th>Contact</th><th>PAN</th><th>Account</th><th className="text-right">Balance</th><th>Risk</th></tr></thead>
              <tbody>
                {customers.map(c => (
                  <tr key={c.id}>
                    <td style={{fontFamily:'monospace', fontSize:'13px'}}>{c.id}</td>
                    <td><strong>{c.full_name}</strong><br/><span style={{fontSize:'12px', color:'var(--text-muted)'}}>{c.address}</span></td>
                    <td><div style={{fontSize:'13px'}}>{c.email}</div><div style={{fontSize:'12px', color:'var(--text-muted)'}}>{c.phone}</div></td>
                    <td style={{fontFamily:'monospace', fontSize:'13px'}}>{c.pan}</td>
                    <td><span className="badge neutral">{c.account_type}</span></td>
                    <td className="text-right amount">{formatINR(c.balance)}</td>
                    <td>{riskBadge(c.risk_category)}</td>
                  </tr>
                ))}
                {customers.length === 0 && <tr><td colSpan={7} className="empty-state">No customers found</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <Modal show={!!blockModal} onClose={() => setBlockModal(null)}
        title={blockModal?.mfa_required ? 'Verification Required' : 'Export Blocked'}
        icon={<Icon name="block" />}
        footer={<button className="btn btn-outline" onClick={() => setBlockModal(null)}>Close</button>}>
        {blockModal && (
          <>
            <div className={`alert-block ${blockModal.blocked ? 'danger' : 'warning'}`}>
              <span className="alert-icon"><Icon name="block" /></span>
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
