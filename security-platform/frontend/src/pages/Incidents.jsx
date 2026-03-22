import { useState, useEffect, useMemo } from 'react'
import { apiFetch } from '../App'
import { io } from 'socket.io-client'

const COLORS = {
  base: '#0A0C0F',
  surface: '#0F1217',
  elevated: '#151921',
  accent: '#3D7EFF',
  high: '#C4404F',
  medium: '#D49F30',
  low: '#34A853',
  border: 'rgba(255,255,255,0.055)',
  textPrimary: '#E8EAF0',
  textSecondary: '#6B7280',
  textTertiary: '#3D4451',
  mono: '#A8B5C8',
};

export default function Incidents() {
  const [incidents, setIncidents] = useState([])
  const [approvals, setApprovals] = useState([])
  const [stats, setStats] = useState({})
  
  const [selected, setSelected] = useState(null)
  const [toast, setToast] = useState(null)
  const [processing, setProcessing] = useState(false)

  const loadIncidents = () => {
    apiFetch(`/api/incidents`).then(d => {
      const queue = d.incidents.filter(i => i.status === 'pending_approval')
      const regular = d.incidents.filter(i => i.status !== 'pending_approval')
      setApprovals(queue)
      setIncidents(regular)
    }).catch(console.error)
    apiFetch('/api/incidents/stats').then(setStats).catch(console.error)
  }

  const loadApprovalsOnly = () => {
    apiFetch('/api/incidents').then(d => {
      setApprovals(d.incidents.filter(i => i.status === 'pending_approval'))
    }).catch(console.error)
  }

  useEffect(() => {
    loadIncidents()
    const timer = setInterval(loadIncidents, 5000)
    
    // Real-time log/event hooking via live architecture
    const socket = io('http://127.0.0.1:3002')
    socket.on('zta-activity', (data) => {
      // Re-poll the backend aggressively on live blocks/suspicious metrics
      if (data.action === 'BLOCKED' || data.action === 'SANDBOXED' || data.score >= 40) {
        loadIncidents()
      }
    })

    return () => {
      clearInterval(timer)
      socket.disconnect()
    }
  }, [])

  const allData = useMemo(() => [...approvals, ...incidents], [approvals, incidents])
  useEffect(() => {
    if (!selected && allData.length > 0) {
      setSelected(allData[0].id)
    } else if (allData.length === 0) {
      setSelected(null)
    }
  }, [allData, selected])

  const showToast = (msg, type = 'success') => { setToast({ msg, type }); setTimeout(() => setToast(null), 3000) }

  const resolveIncident = async () => {
    if (!selected) return
    setProcessing(true)
    try {
      await apiFetch(`/api/incidents/${selected}/resolve`, { method: 'POST', body: JSON.stringify({ resolution: 'Resolved by Security Admin' }) })
      showToast('Incident resolved (Permanent Ban)')
      setSelected(null)
      loadIncidents()
    } catch (e) { showToast(e.message, 'error') } finally { setProcessing(false) }
  }

  const approveAction = async (id = selected) => {
    if (!id) return
    setProcessing(true)
    try {
      await apiFetch(`/api/incidents/${id}/approve`, { method: 'POST', body: JSON.stringify({}) })
      showToast('Action approved', 'success')
      if (selected === id) setSelected(null)
      loadApprovalsOnly() 
    } catch (e) { showToast(e.message, 'error') } finally { setProcessing(false) }
  }

  const rejectAction = async (id = selected) => {
    if (!id) return
    setProcessing(true)
    try {
      await apiFetch(`/api/incidents/${id}/reject`, { method: 'POST', body: JSON.stringify({ reason: 'Rejected by admin' }) })
      showToast('Action rejected', 'success')
      if (selected === id) setSelected(null)
      loadApprovalsOnly()
    } catch (e) { showToast(e.message, 'error') } finally { setProcessing(false) }
  }

  const formatTime = (t) => {
    if (!t) return '—'
    try { 
      // Convert SQLite UTC "YYYY-MM-DD HH:MM:SS" strictly to ISO string "YYYY-MM-DDTHH:MM:SSZ"
      const validT = (typeof t === 'string' && t.includes(' ') && !t.includes('Z')) 
        ? t.replace(' ', 'T') + 'Z' 
        : t;
      const d = new Date(validT)
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    } catch { 
      return t 
    }
  }

  const selData = allData.find(i => i.id === selected)

  const renderCard = (req, isApproval = false) => {
    const isSel = selected === req.id;
    return (
      <div 
        key={req.id}
        onClick={() => setSelected(req.id)}
        className="cursor-pointer transition-colors group relative"
        style={{ 
          padding: '16px', 
          backgroundColor: isSel ? COLORS.elevated : COLORS.base, 
          border: `1px solid ${COLORS.border}`,
          borderLeft: isSel ? `2px solid ${COLORS.accent}` : `1px solid ${COLORS.border}`,
        }}
        onMouseEnter={(e) => { if (!isSel) e.currentTarget.style.backgroundColor = '#161b22' }}
        onMouseLeave={(e) => { if (!isSel) e.currentTarget.style.backgroundColor = COLORS.base }}
      >
        <div className="flex items-center gap-3 mb-3">
          <div style={{ width: '32px', height: '32px', backgroundColor: COLORS.surface, border: `1px solid ${COLORS.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 600, color: '#fff' }}>
            {req.requestedBy ? req.requestedBy.substring(0, 2).toUpperCase() : 'U'}
          </div>
          <div className="flex-1">
            <p style={{ fontSize: '13px', fontWeight: 600, color: '#fff', margin: 0 }}>
              {req.requestedBy}
            </p>
            <p className="font-mono" style={{ fontSize: '11px', color: COLORS.textSecondary, margin: 0 }}>
              {formatTime(req.createdAt)}
            </p>
          </div>
        </div>

        <p style={{ fontSize: '12px', color: COLORS.textPrimary, marginBottom: '12px', lineHeight: 1.4 }}>
           "{req.description}"
        </p>
        
        {isApproval && (
          <div className="flex gap-2 mb-3">
            <button onClick={(e) => { e.stopPropagation(); approveAction(req.id); }} style={{ flex: 1, padding: '6px', backgroundColor: 'transparent', color: COLORS.low, border: `1px solid ${COLORS.low}`, fontSize: '10px', fontWeight: 600, textTransform: 'uppercase', cursor: 'pointer' }}>Approve</button>
            <button onClick={(e) => { e.stopPropagation(); rejectAction(req.id); }} style={{ flex: 1, padding: '6px', backgroundColor: 'transparent', color: COLORS.high, border: `1px solid ${COLORS.high}`, fontSize: '10px', fontWeight: 600, textTransform: 'uppercase', cursor: 'pointer' }}>Reject</button>
          </div>
        )}

        <div className="flex justify-between items-center mt-2">
          <span style={{ fontSize: '9px', fontWeight: 600, padding: '4px 8px', textTransform: 'uppercase', letterSpacing: '0.04em', color: req.severity === 'high' ? COLORS.high : req.severity === 'medium' ? COLORS.medium : COLORS.low, border: `1px solid ${req.severity === 'high' ? COLORS.high : req.severity === 'medium' ? COLORS.medium : COLORS.low}` }}>
            {req.requestedAction}
          </span>
          <span className="font-mono" style={{ fontSize: '10px', color: COLORS.textSecondary }}>#{String(req.id).substring(0,6).toUpperCase()}</span>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col h-full w-full">
      {toast && (
        <div style={{ position: 'absolute', top: '16px', right: '16px', padding: '8px 16px', backgroundColor: toast.type === 'error' ? COLORS.high : COLORS.low, color: '#fff', fontSize: '12px', fontWeight: 600, zIndex: 100 }}>
          {toast.msg}
        </div>
      )}

      {/* ── Header Section ── */}
      <header style={{ padding: '32px 40px', borderBottom: `1px solid ${COLORS.border}`, backgroundColor: COLORS.base, marginBottom: '32px' }}>
        <div className="flex justify-between items-baseline mb-2">
          <h1 className="font-syne" style={{ fontSize: '28px', fontWeight: 700, letterSpacing: '-0.02em', color: COLORS.textPrimary, margin: 0 }}>Incident Management</h1>
          <button onClick={loadIncidents} className="flex items-center gap-2 cursor-pointer transition-fast" style={{ background: 'none', border: '1px solid transparent', padding: '6px 12px', borderRadius: '4px', outline: 'none', color: COLORS.textPrimary }} onMouseEnter={e => Object.assign(e.currentTarget.style, { backgroundColor: COLORS.surface, border: `1px solid ${COLORS.border}` })} onMouseLeave={e => Object.assign(e.currentTarget.style, { backgroundColor: 'transparent', border: '1px solid transparent' })}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="square" strokeLinejoin="miter">
              <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.92-10.44l5.08 5.08" />
            </svg>
            <span style={{ fontSize: '13px', fontWeight: 500 }}>Refresh</span>
          </button>
        </div>
        <p style={{ fontSize: '15px', color: COLORS.textSecondary, margin: '8px 0 0 0' }}>Systemic telemetry of blocked temporal and policy events.</p>
      </header>

      {/* ── Metric Grid ── */}
      <section className="grid grid-cols-4 gap-8 mb-8" style={{ padding: '0 40px' }}>
        {[
          { label: 'Open Incidents', value: stats.open || 0, color: COLORS.high },
          { label: 'Resolved', value: stats.resolved || 0, color: COLORS.low },
          { label: 'Blocked Actions', value: stats.blocked || 0, color: COLORS.medium },
          { label: 'Avg Risk Score', value: stats.avgRisk || 0, color: '#fff' }
        ].map((stat, idx) => (
          <div key={idx} style={{ backgroundColor: COLORS.surface, border: `1px solid ${COLORS.border}`, padding: '24px' }}>
            <div style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.08em', color: COLORS.textSecondary, marginBottom: '16px', fontWeight: 600 }}>
              {stat.label}
            </div>
            <div className="font-mono" style={{ fontSize: '32px', color: stat.color, marginBottom: '8px', lineHeight: 1 }}>
              {stat.value}
            </div>
          </div>
        ))}
      </section>

      {/* ── Review Grid ── */}
      <div className="flex gap-8 items-start h-[600px]" style={{ padding: '0 40px 40px 40px' }}>
        
        {/* LEFT COLUMN: Selected Case Detailed Analysis */}
        <section style={{ width: '65%', display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {selData ? (
             <>
                {/* Case Header & Trust Score */}
                <div style={{ backgroundColor: COLORS.surface, border: `1px solid ${COLORS.border}`, padding: '32px' }} className="flex justify-between items-start">
                  <div className="flex gap-6">
                    <div style={{ width: '64px', height: '64px', backgroundColor: COLORS.base, border: `1px solid ${COLORS.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px', fontWeight: 600, color: '#fff' }}>
                      {selData.requestedBy ? selData.requestedBy.substring(0, 2).toUpperCase() : 'U'}
                    </div>
                    <div>
                      <h3 className="font-syne" style={{ fontSize: '28px', fontWeight: 700, color: COLORS.textPrimary, margin: '0 0 4px 0' }}>{selData.requestedBy}</h3>
                      <p className="font-mono" style={{ fontSize: '12px', color: COLORS.textSecondary, margin: '0 0 16px 0' }}>ID: #{String(selData.id).substring(0,6).toUpperCase()}</p>
                      <div className="flex gap-3">
                        <span style={{ fontSize: '10px', fontWeight: 600, padding: '4px 8px', textTransform: 'uppercase', letterSpacing: '0.04em', color: COLORS.high, border: `1px solid ${COLORS.high}` }}>
                          Incident Ticket
                        </span>
                        <span className="font-mono" style={{ fontSize: '10px', padding: '4px 8px', textTransform: 'uppercase', color: COLORS.textSecondary, border: `1px solid ${COLORS.border}` }}>
                          STATUS: {selData.status}
                        </span>
                      </div>
                    </div>
                  </div>
                  {/* Trust Score Visualization (Bloomberg style: simple text + static bar) */}
                  <div className="text-right">
                    <div className="font-mono" style={{ fontSize: '48px', fontWeight: 400, color: selData.severity === 'high' ? COLORS.high : selData.severity === 'medium' ? COLORS.medium : COLORS.low, lineHeight: 1 }}>
                      {selData.riskScore}
                    </div>
                    <p style={{ fontSize: '10px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: COLORS.textSecondary, marginTop: '8px' }}>
                      Severity: {selData.severity === 'high' ? 'Critical' : selData.severity === 'medium' ? 'Suspicious' : 'Low'}
                    </p>
                  </div>
                </div>

                {/* Side-by-Side Comparison */}
                <div className="grid grid-cols-2 gap-6">
                  {/* Baseline Behavior */}
                  <div style={{ backgroundColor: COLORS.surface, border: `1px solid ${COLORS.border}`, padding: '24px' }}>
                    <h4 className="font-syne" style={{ fontSize: '14px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', color: COLORS.textTertiary, marginBottom: '24px', margin: 0 }}>
                      Verified Default Policy
                    </h4>
                    <div className="flex flex-col gap-4 mt-6">
                      <div>
                        <p style={{ fontSize: '10px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', color: COLORS.textSecondary, margin: '0 0 4px 0' }}>Role Allowances</p>
                        <p className="font-mono" style={{ fontSize: '13px', color: '#fff', margin: 0 }}>Standard Limits</p>
                      </div>
                      <div style={{ height: '1px', backgroundColor: COLORS.border }} />
                      <div>
                        <p style={{ fontSize: '10px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', color: COLORS.textSecondary, margin: '0 0 4px 0' }}>Action Target</p>
                        <p className="font-mono" style={{ fontSize: '13px', color: '#fff', margin: 0 }}>{selData.requestedAction}</p>
                      </div>
                      <div style={{ height: '1px', backgroundColor: COLORS.border }} />
                      <div>
                        <p style={{ fontSize: '10px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', color: COLORS.textSecondary, margin: '0 0 4px 0' }}>Resolution Status</p>
                        <p className="font-mono" style={{ fontSize: '13px', color: '#fff', margin: 0, textTransform: 'uppercase' }}>{selData.status}</p>
                      </div>
                    </div>
                  </div>

                  {/* Anomalous Request */}
                  <div style={{ backgroundColor: COLORS.surface, border: `1px solid ${COLORS.border}`, padding: '24px' }}>
                    <h4 className="font-syne" style={{ fontSize: '14px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', color: COLORS.high, marginBottom: '24px', margin: 0 }}>
                      Incident Delta
                    </h4>
                    <div className="flex flex-col gap-4 mt-6">
                      <div>
                        <p style={{ fontSize: '10px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', color: COLORS.high, margin: '0 0 4px 0' }}>Record Time</p>
                        <p className="font-mono" style={{ fontSize: '13px', color: '#fff', margin: 0 }}>{formatTime(selData.createdAt)}</p>
                      </div>
                      <div style={{ height: '1px', backgroundColor: COLORS.border }} />
                      <div>
                        <p style={{ fontSize: '10px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', color: COLORS.high, margin: '0 0 4px 0' }}>Violation Reason</p>
                        <p className="font-mono" style={{ fontSize: '12px', color: '#fff', margin: 0 }}>{selData.description}</p>
                      </div>
                      {selData.approvalReason && (
                        <>
                          <div style={{ height: '1px', backgroundColor: COLORS.border }} />
                          <div>
                            <p style={{ fontSize: '10px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', color: COLORS.medium, margin: '0 0 4px 0' }}>User Justification</p>
                            <p className="font-mono" style={{ fontSize: '12px', color: '#fff', margin: 0 }}>{selData.approvalReason}</p>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {/* Final Decision Actions */}
                {selData.status === 'open' && (
                  <div className="flex gap-4 mt-2">
                    <button disabled={processing} onClick={resolveIncident} style={{ flex: 1, padding: '12px', backgroundColor: 'transparent', color: COLORS.high, border: `1px solid ${COLORS.high}`, fontSize: '12px', fontWeight: 600, textTransform: 'uppercase', cursor: 'pointer' }}>
                      Mark Resolved (Permanent Block)
                    </button>
                    <button disabled={processing} onClick={() => approveAction(selData.id)} style={{ flex: 1, padding: '12px', backgroundColor: 'transparent', color: COLORS.accent, border: `1px solid ${COLORS.accent}`, fontSize: '12px', fontWeight: 600, textTransform: 'uppercase', cursor: 'pointer' }}>
                      Force Approve Transaction
                    </button>
                  </div>
                )}
                {selData.status === 'pending_approval' && (
                  <div className="flex gap-4 mt-2">
                    <button disabled={processing} onClick={() => rejectAction(selData.id)} style={{ flex: 1, padding: '12px', backgroundColor: 'transparent', color: COLORS.high, border: `1px solid ${COLORS.high}`, fontSize: '12px', fontWeight: 600, textTransform: 'uppercase', cursor: 'pointer' }}>
                      Deny Request
                    </button>
                    <button disabled={processing} onClick={() => approveAction(selData.id)} style={{ flex: 1, padding: '12px', backgroundColor: 'transparent', color: COLORS.low, border: `1px solid ${COLORS.low}`, fontSize: '12px', fontWeight: 600, textTransform: 'uppercase', cursor: 'pointer' }}>
                      Approve Request
                    </button>
                  </div>
                )}
             </>
          ) : (
            <div style={{ backgroundColor: COLORS.surface, border: `1px dashed ${COLORS.border}`, padding: '64px', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
              <p className="font-mono" style={{ color: COLORS.textSecondary, fontSize: '13px', margin: 0 }}>Select an incident to view details</p>
            </div>
          )}
        </section>

        {/* RIGHT COLUMN: Stacked incident/approval feeds */}
        <aside style={{ width: '35%', display: 'flex', flexDirection: 'column', gap: '32px', overflowY: 'auto' }} className="custom-scrollbar h-full pr-2">
          
          {/* Approval Queue Section */}
          <div style={{ backgroundColor: COLORS.surface, border: `1px solid ${COLORS.border}`, padding: '24px' }}>
            <div className="flex items-center justify-between mb-6">
              <h4 className="font-syne" style={{ fontSize: '14px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', color: COLORS.textTertiary, margin: 0 }}>Approval Queue</h4>
              {approvals.length > 0 && <span style={{ fontSize: '9px', fontWeight: 600, color: COLORS.medium, letterSpacing: '0.04em', textTransform: 'uppercase' }}>{approvals.length} PENDING</span>}
            </div>
            
            <div className="flex flex-col gap-2">
              {approvals.length === 0 ? (
                <div style={{ padding: '20px', textAlign: 'center', border: `1px dashed ${COLORS.border}` }}>
                  <p style={{ fontSize: '12px', color: COLORS.textSecondary, margin: 0 }}>No 'open' incidents require attention right now.</p>
                </div>
              ) : (
                approvals.map(req => renderCard(req, true))
              )}
            </div>
          </div>

          {/* Regular Incident Feed Section */}
          <div style={{ backgroundColor: COLORS.surface, border: `1px solid ${COLORS.border}`, padding: '24px' }}>
            <div className="flex items-center justify-between mb-6">
              <h4 className="font-syne" style={{ fontSize: '14px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', color: COLORS.textTertiary, margin: 0 }}>Incident Feed</h4>
            </div>
            
            <div className="flex flex-col gap-2">
              {incidents.length === 0 ? (
                <div style={{ padding: '20px', textAlign: 'center', border: `1px dashed ${COLORS.border}` }}>
                  <p style={{ fontSize: '12px', color: COLORS.textSecondary, margin: 0 }}>No incidents recorded.</p>
                </div>
              ) : (
                incidents.map(req => renderCard(req, false))
              )}
            </div>
          </div>

        </aside>
      </div>
    </div>
  )
}
