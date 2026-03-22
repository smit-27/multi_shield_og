import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { apiFetch } from '../App'
import KpiCard from '../components/KpiCard'
import FreezeOverlay from '../components/FreezeOverlay'
import JustifyModal from '../components/JustifyModal'
import Modal from '../components/Modal'
import { Users, CheckCircle, AlertTriangle, Coins, Download, Search, Lock, Unlock, Eye, ShieldAlert } from 'lucide-react'

const formatINR = (n) => `₹${Number(n).toLocaleString('en-IN')}`
const maskPAN = (pan) => pan ? pan.substring(0, 3) + '****' + pan.substring(pan.length - 1) : '—'

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
  const [unlockedCustomers, setUnlockedCustomers] = useState(new Set())
  const [deniedModal, setDeniedModal] = useState(null)

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
    if (!pendingAction) {
      setFreezeOverlay(null)
      return
    }
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
    showToast(`Justification pending approval...`)
    setJustifyModal(null)
    
    if (pendingAction?.type === 'jit_access') {
      setTimeout(() => {
        setUnlockedCustomers(prev => new Set(prev).add(pendingAction.customerId))
        setPendingAction(null)
        showToast(`JIT Access Approved. Credentials procured for Vault Connection.`)
      }, 1500)
      return
    }

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
          <h3>Customer Information File (CIF)</h3>
          <p>Access KYC-verified customer records, perform due diligence checks, and manage relationship profiles. All data access is logged per RBI Master Circular on KYC/AML.</p>
        </div>
      </div>

      <div className="kpi-grid">
        <KpiCard icon={<Users size={20} />} label="Total Customers" value={stats.total || 0} color="blue" />
        <KpiCard icon={<CheckCircle size={20} />} label="Active Accounts" value={stats.active || 0} color="green" />
        <KpiCard icon={<AlertTriangle size={20} />} label="High Risk" value={stats.highRisk || 0} color="red" />
        <KpiCard icon={<Coins size={20} />} label="Total Deposits" value={formatINR(stats.totalBalance || 0)} color="purple" />
      </div>

      <div className="card">
        <div className="card-header">
          <h3>Customer Records</h3>
          <div style={{display:'flex', gap:'8px'}}>
            <button className="btn btn-sm btn-outline" onClick={exportData} disabled={exporting}>
              {exporting ? 'Exporting...' : <span style={{display:'flex', alignItems:'center', gap:'6px'}}><Download size={14}/> Export All</span>}
            </button>
          </div>
        </div>
        <div className="card-body">
          <div className="search-box">
            <span className="search-icon"><Search size={14} /></span>
            <input className="form-input" placeholder="Search customers by name, email, PAN, phone..."
              value={search} onChange={e => setSearch(e.target.value)} style={{paddingLeft:'40px'}} />
          </div>
          <div className="table-wrapper">
            <table>
              <thead><tr><th>CIF ID</th><th>Name & Address</th><th>Contact</th><th>PAN</th><th>A/C Type</th><th>KYC Status</th><th className="text-right">Balance</th><th>Action</th></tr></thead>
              <tbody>
                {customers.map(c => (
                  <tr key={c.id}>
                    <td style={{fontFamily:'monospace', fontSize:'13px', color:'var(--accent)'}}>CIF-{String(c.id).padStart(6, '0')}</td>
                    <td><strong>{c.full_name}</strong><br/><span style={{fontSize:'12px', color:'var(--text-muted)'}}>{c.address}</span></td>
                    <td><div style={{fontSize:'13px'}}>{c.email}</div><div style={{fontSize:'12px', color:'var(--text-muted)'}}>{c.phone}</div></td>
                    <td style={{fontFamily:'monospace', fontSize:'13px'}}>{maskPAN(c.pan)}</td>
                    <td><span className="badge neutral">{c.account_type?.toUpperCase()}</span></td>
                    <td><span className={`badge ${c.risk_category === 'high' ? 'danger' : 'success'}`}>{c.risk_category === 'high' ? 'Re-KYC Due' : 'Verified'}</span></td>
                    <td className="text-right amount">{formatINR(c.balance)}</td>
                    <td>
                      {unlockedCustomers.has(c.id) ? (
                        <button className="btn btn-sm" onClick={() => navigate(`/customers/${c.id}`)} style={{background: 'var(--success)', color: 'white', border: 'none', display: 'flex', alignItems: 'center', gap: '6px'}}>
                          <Unlock size={14}/> Connect Securely
                        </button>
                      ) : (
                        <button className="btn btn-sm btn-outline" onClick={() => {
                          setJustifyModal({ data: { message: `Requesting JIT access for Customer ID: ${c.id}. This session will be recorded and audited.` } })
                          setPendingAction({ type: 'jit_access', customerId: c.id })
                        }} style={{display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-primary)'}}>
                          <Lock size={14}/> Request Access
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
                {customers.length === 0 && <tr><td colSpan={8} className="empty-state">No customers found</td></tr>}
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
          onDenied={() => { setFreezeOverlay(null); setPendingAction(null); setDeniedModal('This action has been permanently blocked by the security administrator.') }}
        />
      )}

      <Modal show={!!deniedModal} onClose={() => setDeniedModal(null)} title="Action Denied" icon={<ShieldAlert size={20} color="var(--danger)" />} footer={<button className="btn btn-outline" onClick={() => setDeniedModal(null)}>Close</button>}>
        <div className="alert-block danger">
          <span className="alert-icon"><ShieldAlert size={18}/></span>
          <div className="alert-text">
            <div className="alert-title">Admin Denial</div>
            <div>{deniedModal}</div>
          </div>
        </div>
      </Modal>

      {toast && <div className={`toast ${toast.type}`}>{toast.msg}</div>}
    </div>
  )
}
