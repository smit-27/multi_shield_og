import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { apiFetch } from '../App'
import KpiCard from '../components/KpiCard'
import FreezeOverlay from '../components/FreezeOverlay'
import JustifyModal from '../components/JustifyModal'

const formatINR = (n) => `₹${Number(n).toLocaleString('en-IN')}`

export default function Customers() {
  const navigate = useNavigate()
  const [customers, setCustomers] = useState([])
  const [stats, setStats] = useState({})
  const [search, setSearch] = useState('')
  const [toast, setToast] = useState(null)
  const [exporting, setExporting] = useState(false)

  // Tier-aware state
  const [freezeOverlay, setFreezeOverlay] = useState(null)
  const [justifyModal, setJustifyModal] = useState(null)
  const [pendingAction, setPendingAction] = useState(null)

  const load = () => {
    const q = search ? `?search=${encodeURIComponent(search)}` : ''
    apiFetch(`/api/customers${q}`).then(d => setCustomers(d.customers)).catch(console.error)
    apiFetch('/api/customers/stats').then(setStats).catch(console.error)
  }
  useEffect(load, [search])

  const showToast = (msg, type = 'success') => { setToast({ msg, type }); setTimeout(() => setToast(null), 4000) }

  const handleSecurityResponse = (err) => {
    const data = err.data || err

    if (data.justify_required) {
      setJustifyModal({ data })
      setPendingAction({ type: 'export' })
      return
    }
    if (data.mfa_required) {
      setFreezeOverlay({ mode: 'mfa', data })
      setPendingAction({ type: 'export' })
      return
    }
    if (data.admin_approval_required) {
      setFreezeOverlay({ mode: 'admin', data })
      setPendingAction({ type: 'export' })
      return
    }
    if (data.blocked) {
      setFreezeOverlay({ mode: 'admin', data: { ...data, reason: data.reason || data.message } })
      setPendingAction({ type: 'export' })
      return
    }
    showToast(data.message || err.message || 'An error occurred', 'error')
  }

  const exportData = async () => {
    setExporting(true)
    try {
      const res = await apiFetch('/api/customers/export', { method: 'POST', body: JSON.stringify({ format: 'json' }) })
      if (res.justify_required || res.mfa_required || res.admin_approval_required) {
        handleSecurityResponse(res)
        return
      }
      showToast(`Exported ${res.record_count} records`)
    } catch (err) {
      handleSecurityResponse(err)
    } finally { setExporting(false) }
  }

  const retryPendingAction = async () => {
    if (!pendingAction) return
    setFreezeOverlay(null)
    setExporting(true)
    try {
      const res = await apiFetch('/api/customers/export', {
        method: 'POST',
        body: JSON.stringify({ format: 'json' }),
        headers: { 'X-Device': 'internal workstation' }
      })
      if (res.justify_required || res.mfa_required || res.admin_approval_required) {
        showToast('Action still requires additional verification', 'error')
      } else {
        showToast(res.message || `Exported ${res.record_count} records`)
      }
    } catch (err) {
      showToast('Action could not be completed: ' + (err.message || 'Unknown error'), 'error')
    } finally {
      setExporting(false)
      setPendingAction(null)
    }
  }

  const handleJustifySubmit = async (reason) => {
    showToast(`Justification submitted: "${reason}"`)
    setJustifyModal(null)
    if (pendingAction) {
      setExporting(true)
      try {
        const res = await apiFetch('/api/customers/export', {
          method: 'POST',
          body: JSON.stringify({ format: 'json', details: `Justified: ${reason}` }),
          headers: { 'X-Device': 'internal workstation' }
        })
        if (res.justify_required || res.mfa_required || res.admin_approval_required) {
          handleSecurityResponse(res)
        } else {
          showToast(res.message || `Exported ${res.record_count} records`)
        }
      } catch (err) {
        handleSecurityResponse(err)
      } finally {
        setExporting(false)
        setPendingAction(null)
      }
    }
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
        <KpiCard icon="👤" label="Total Customers" value={stats.total || 0} color="blue" />
        <KpiCard icon="✅" label="Active Accounts" value={stats.active || 0} color="green" />
        <KpiCard icon="⚠️" label="High Risk" value={stats.highRisk || 0} color="red" />
        <KpiCard icon="💰" label="Total Deposits" value={formatINR(stats.totalBalance || 0)} color="purple" />
      </div>

      <div className="card">
        <div className="card-header">
          <h3>Customer Records</h3>
          <div style={{display:'flex', gap:'8px'}}>
            <button className="btn btn-sm btn-outline" onClick={exportData} disabled={exporting}>
              {exporting ? '⏳ Exporting...' : '📥 Export All'}
            </button>
          </div>
        </div>
        <div className="card-body">
          <div className="search-box">
            <span className="search-icon">🔍</span>
            <input className="form-input" placeholder="Search customers by name, email, PAN, phone..."
              value={search} onChange={e => setSearch(e.target.value)} style={{paddingLeft:'40px'}} />
          </div>
          <div className="table-wrapper">
            <table>
              <thead><tr><th>ID</th><th>Name</th><th>Contact</th><th>PAN</th><th>Account</th><th className="text-right">Balance</th><th>Risk</th><th>Action</th></tr></thead>
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
                    <td>
                      <button className="btn btn-sm btn-primary" onClick={() => navigate(`/customers/${c.id}`)}>
                        View Profile
                      </button>
                    </td>
                  </tr>
                ))}
                {customers.length === 0 && <tr><td colSpan={7} className="empty-state">No customers found</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Tier 2: Full-screen Justification Overlay */}
      <JustifyModal
        show={!!justifyModal}
        data={justifyModal?.data}
        onSubmit={handleJustifySubmit}
        onClose={() => { setJustifyModal(null); setPendingAction(null) }}
      />

      {/* Tier 3 & 4: Full-screen Freeze Overlay */}
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
