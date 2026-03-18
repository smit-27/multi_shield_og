import { useState, useEffect } from 'react'
import { apiFetch } from '../App'

export default function Incidents() {
  const [incidents, setIncidents] = useState([])
  const [stats, setStats] = useState({})
  const [filter, setFilter] = useState('open')
  const [selected, setSelected] = useState(null)
  const [toast, setToast] = useState(null)
  const [processing, setProcessing] = useState(false)

  const load = () => {
    const q = filter ? `?status=${filter}` : ''
    apiFetch(`/api/incidents${q}`).then(d => setIncidents(d.incidents)).catch(console.error)
    apiFetch('/api/incidents/stats').then(setStats).catch(console.error)
  }

  useEffect(() => {
    load()
    const timer = setInterval(load, 5000)
    return () => clearInterval(timer)
  }, [filter])

  useEffect(() => {
    if (!selected && incidents.length > 0) {
      setSelected(incidents[0].id)
    } else if (incidents.length === 0) {
      setSelected(null)
    }
  }, [incidents, selected])

  const showToast = (msg, type = 'success') => { setToast({ msg, type }); setTimeout(() => setToast(null), 3000) }

  const resolveIncident = async () => {
    if (!selected) return
    setProcessing(true)
    try {
      await apiFetch(`/api/incidents/${selected}/resolve`, { method: 'POST', body: JSON.stringify({ resolution: 'Resolved by Security Admin' }) })
      showToast('Incident resolved (Permanent Ban)')
      setSelected(null)
      load()
    } catch (e) { showToast(e.message, 'error') } finally { setProcessing(false) }
  }

  const approveIncident = async () => {
    if (!selected) return
    setProcessing(true)
    try {
      await apiFetch(`/api/incidents/${selected}/approve`, { method: 'POST', body: JSON.stringify({}) })
      showToast('Action forcefully approved', 'success')
      setSelected(null)
      load()
    } catch (e) { showToast(e.message, 'error') } finally { setProcessing(false) }
  }

  const formatTime = (t) => {
    if (!t) return '—'
    try { 
      const d = new Date(t)
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    } catch { 
      return t 
    }
  }

  const selData = incidents.find(i => i.id === selected)

  return (
    <div className="flex-1 p-8 relative bg-[#0b0510] text-[#eae6f5] min-h-screen" style={{ fontFamily: "'Inter', sans-serif" }}>
      {/* ── Background Cyber Grid Overlay (Purple Accent Variant) ── */}
      <div className="absolute inset-0 pointer-events-none" style={{
        backgroundImage: "linear-gradient(rgba(168, 85, 247, 0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(168, 85, 247, 0.05) 1px, transparent 1px)",
        backgroundSize: "40px 40px"
      }}></div>

      {toast && (
        <div className={`absolute top-4 right-4 px-4 py-2 rounded shadow-lg z-50 font-bold tracking-wide text-xs ${toast.type === 'error' ? 'bg-[#f43f5e] text-white' : 'bg-[#10b981] text-white'}`}>
          {toast.msg}
        </div>
      )}

      {/* ── Header Section ── */}
      <header className="mb-8 flex justify-between items-end relative z-10 w-full">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-white mb-0" style={{ margin: 0 }}>Incident Management</h2>
          <p className="text-sm text-[#a09bb8] mt-1 italic mb-0">Systemic telemetry of blocked temporal and policy events.</p>
        </div>
        <div className="flex gap-3">
          <div className="flex rounded-lg border border-[#3d2d6b] overflow-hidden mr-4">
            {['', 'open', 'resolved', 'approved'].map(f => (
              <button 
                key={f} 
                onClick={() => { setFilter(f); setSelected(null); }}
                className={`px-4 py-2.5 text-[11px] font-bold uppercase tracking-widest transition-colors cursor-pointer m-0 border-none ${filter === f ? 'bg-[#a855f7] text-white' : 'bg-[#1c1533] text-[#a09bb8] hover:bg-[#241c3e]'}`}
              >
                {f || 'All'}
              </button>
            ))}
          </div>
          <button onClick={load} className="px-5 py-2.5 bg-[#1c1533] border border-[#3d2d6b] text-[#a09bb8] text-[11px] font-bold uppercase tracking-[2px] rounded-lg hover:bg-[#241c3e] hover:text-white transition-all cursor-pointer m-0">
            Refresh
          </button>
        </div>
      </header>

      {/* ── Metric Grid ── */}
      <section className="grid grid-cols-4 gap-4 mb-8 relative z-10">
        <div className="p-5 rounded-xl border-l-4 border-l-[#f43f5e]" style={{ background: 'rgba(28, 21, 51, 0.7)', backdropFilter: 'blur(12px)' }}>
          <p className="text-[10px] text-[#635d7a] font-bold uppercase tracking-wider mb-0 text-center">Open Incidents</p>
          <h3 className="text-3xl font-mono font-bold mt-2 text-center" style={{ color: '#f43f5e', textShadow: '0 0 10px rgba(244, 63, 94, 0.5)' }}>
            {stats.open || 0}
          </h3>
        </div>
        <div className="p-5 rounded-xl border-l-4 border-l-[#10b981]" style={{ background: 'rgba(28, 21, 51, 0.7)', backdropFilter: 'blur(12px)' }}>
          <p className="text-[10px] text-[#635d7a] font-bold uppercase tracking-wider mb-0 text-center">Resolved</p>
          <h3 className="text-3xl font-mono font-bold mt-2 text-center" style={{ color: '#10b981', textShadow: '0 0 10px rgba(16, 185, 129, 0.5)' }}>
            {stats.resolved || 0}
          </h3>
        </div>
        <div className="p-5 rounded-xl border-l-4 border-l-[#f59e0b]" style={{ background: 'rgba(28, 21, 51, 0.7)', backdropFilter: 'blur(12px)' }}>
          <p className="text-[10px] text-[#635d7a] font-bold uppercase tracking-wider mb-0 text-center">Blocked Actions</p>
          <h3 className="text-3xl font-mono font-bold mt-2 text-center" style={{ color: '#f59e0b', textShadow: '0 0 10px rgba(245, 158, 11, 0.5)' }}>
            {stats.blocked || 0}
          </h3>
        </div>
        <div className="p-5 rounded-xl border-l-4 border-l-[#a855f7]" style={{ background: 'rgba(28, 21, 51, 0.7)', backdropFilter: 'blur(12px)' }}>
          <p className="text-[10px] text-[#635d7a] font-bold uppercase tracking-wider mb-0 text-center">Avg Risk Score</p>
          <h3 className="text-3xl font-mono font-bold mt-2 text-center" style={{ color: '#a855f7', textShadow: '0 0 10px rgba(168, 85, 247, 0.5)' }}>
            {stats.avgRisk || 0}
          </h3>
        </div>
      </section>

      {/* ── Review Grid ── */}
      <div className="grid grid-cols-12 gap-8 items-start relative z-10">
        
        {/* LEFT COLUMN: Selected Case Detailed Analysis */}
        <section className="col-span-8 flex flex-col gap-8">
          {selData ? (
             <>
                {/* Case Header & Trust Score */}
                <div className="rounded-2xl p-7 relative overflow-hidden" style={{ background: 'rgba(28, 21, 51, 0.7)', backdropFilter: 'blur(12px)', border: '1px solid #3d2d6b', boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)' }}>
                  <div className="scanline" style={{ background: '#a855f7' }}></div>
                  <div className="flex justify-between items-start relative z-20">
                    <div className="flex gap-5">
                      <div className="w-16 h-16 rounded-xl bg-[#0b0510] border border-[#3d2d6b] flex items-center justify-center text-[#a855f7] font-bold text-2xl shadow-inner uppercase">
                        {selData.user_id ? selData.user_id.substring(0, 2) : 'U'}
                      </div>
                      <div>
                        <h3 className="text-2xl font-bold text-white leading-tight tracking-tight mb-0" style={{ margin: 0 }}>{selData.user_id}</h3>
                        <p className="text-[#a09bb8] text-sm font-mono mt-1 mb-0">Role: {selData.role} • ID: #{String(selData.id).substring(0,6).toUpperCase()}</p>
                        <div className="flex gap-3 mt-4">
                          <span className={`bg-[#f43f5e1a] text-[#f43f5e] border border-[#f43f5e33] text-[10px] font-bold px-2.5 py-1 rounded uppercase tracking-wider`}>Incident Ticket</span>
                          <span className="bg-[#22d3ee1a] text-[#22d3ee] border border-[#22d3ee33] text-[10px] font-bold px-2.5 py-1 rounded uppercase tracking-wider font-mono">
                            STATUS: {selData.status}
                          </span>
                        </div>
                      </div>
                    </div>
                    {/* Trust Score Visualization */}
                    <div className="text-center">
                      <div className="relative w-24 h-24 mx-auto">
                        <svg className="w-full h-full transform -rotate-90">
                          <circle className="text-[#2d2548]" cx="48" cy="48" fill="transparent" r="40" stroke="currentColor" strokeWidth="7"></circle>
                          <circle className={`text-${selData.risk_score >= 80 ? '[#f43f5e]' : selData.risk_score >= 50 ? '[#f59e0b]' : '[#10b981]'}`} cx="48" cy="48" fill="transparent" r="40" stroke="currentColor" strokeDasharray="251.2" strokeDashoffset={`${251.2 - (selData.risk_score / 100 * 251.2)}`} strokeLinecap="round" strokeWidth="7" style={{ filter: `drop-shadow(0 0 8px ${selData.risk_score >= 80 ? '#f43f5e' : selData.risk_score >= 50 ? '#f59e0b' : '#10b981'})` }}></circle>
                        </svg>
                        <div className="absolute inset-0 flex flex-col items-center justify-center">
                          <span className="text-3xl font-bold font-mono text-white">{selData.risk_score}</span>
                          <span className="text-[9px] text-[#635d7a] uppercase font-bold tracking-tighter">Severity</span>
                        </div>
                      </div>
                      <p className={`text-[10px] font-bold uppercase tracking-[2px] mt-3 mb-0 ${selData.risk_score >= 80 ? 'text-[#f43f5e]' : selData.risk_score >= 50 ? 'text-[#f59e0b]' : 'text-[#10b981]'}`}>
                        {selData.risk_score >= 80 ? 'Critical Threat' : selData.risk_score >= 50 ? 'Suspicious' : 'Low Priority'}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Side-by-Side Comparison */}
                <div className="grid grid-cols-2 gap-6">
                  {/* Baseline Behavior */}
                  <div className="rounded-2xl p-6 border-l-4 border-l-[#10b981]" style={{ background: 'rgba(28, 21, 51, 0.7)', backdropFilter: 'blur(12px)', borderTop: '1px solid #3d2d6b', borderRight: '1px solid #3d2d6b', borderBottom: '1px solid #3d2d6b' }}>
                    <h4 className="text-[11px] font-bold text-[#10b981] uppercase tracking-[2px] mb-5 flex items-center gap-2 mt-0">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
                      Verified Default Policy
                    </h4>
                    <div className="space-y-4">
                      <div className="bg-[#0b051044] p-3.5 rounded-lg border border-[#3d2d6b33]">
                        <p className="text-[10px] text-[#635d7a] font-bold uppercase tracking-wider mb-0">Role Allowances</p>
                        <p className="text-sm font-mono text-[#a09bb8] mt-1 mb-0">{selData.role} Limits</p>
                      </div>
                      <div className="bg-[#0b051044] p-3.5 rounded-lg border border-[#3d2d6b33]">
                        <p className="text-[10px] text-[#635d7a] font-bold uppercase tracking-wider mb-0">Action Target</p>
                        <p className="text-sm font-mono text-[#a09bb8] mt-1 mb-0">{selData.action}</p>
                      </div>
                      <div className="bg-[#0b051044] p-3.5 rounded-lg border border-[#3d2d6b33]">
                        <p className="text-[10px] text-[#635d7a] font-bold uppercase tracking-wider mb-0">Resolution Status</p>
                        <p className="text-sm font-mono text-[#a09bb8] mt-1 mb-0 uppercase">{selData.status}</p>
                      </div>
                    </div>
                  </div>
                  {/* Anomalous Request */}
                  <div className="rounded-2xl p-6 border-l-4 border-l-[#f43f5e]" style={{ background: 'rgba(28, 21, 51, 0.7)', backdropFilter: 'blur(12px)', borderTop: '1px solid #3d2d6b', borderRight: '1px solid #3d2d6b', borderBottom: '1px solid #3d2d6b' }}>
                    <h4 className="text-[11px] font-bold text-[#f43f5e] uppercase tracking-[2px] mb-5 flex items-center gap-2 mt-0">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" x2="12" y1="9" y2="13"></line><line x1="12" x2="12.01" y1="17" y2="17"></line></svg>
                      Incident Delta
                    </h4>
                    <div className="space-y-4">
                      <div className="bg-[#f43f5e11] p-3.5 rounded-lg border border-[#f43f5e33]">
                        <p className="text-[10px] text-[#f43f5e] font-bold uppercase tracking-wider mb-0">Record Time</p>
                        <p className="text-sm font-mono text-white mt-1 mb-0">{formatTime(selData.created_at)}</p>
                      </div>
                      <div className="bg-[#f43f5e11] p-3.5 rounded-lg border border-[#f43f5e33]">
                        <p className="text-[10px] text-[#f43f5e] font-bold uppercase tracking-wider mb-0">Network Decision</p>
                        <p className="text-sm font-mono text-white mt-1 mb-0">{selData.decision}</p>
                      </div>
                      <div className="bg-[#f43f5e11] p-3.5 rounded-lg border border-[#f43f5e33]">
                        <p className="text-[10px] text-[#f43f5e] font-bold uppercase tracking-wider mb-0">Violation Reason</p>
                        <p className="text-xs font-mono text-white mt-1 mb-0">{selData.reason}</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Forensic Audit Trail Snippet */}
                <div className="rounded-2xl overflow-hidden border border-[#3d2d6b]" style={{ background: 'rgba(28, 21, 51, 0.7)', backdropFilter: 'blur(12px)' }}>
                  <div className="bg-[#1c1533] px-6 py-4 border-b border-[#3d2d6b] flex justify-between items-center">
                    <h4 className="text-[11px] font-bold text-[#a09bb8] uppercase tracking-[2px] mb-0">Forensic Audit Details</h4>
                    <span className="text-[10px] font-mono text-[#635d7a]">IncidentID: {selData.id}</span>
                  </div>
                  <div className="p-5 space-y-3 font-mono text-[11px]">
                    <div className="flex gap-6 items-center px-3 py-2.5 rounded-lg hover:bg-[#241c3e] transition-colors">
                      <span className="text-[#635d7a] w-16">{formatTime(selData.created_at)}</span>
                      <span className="text-[#a855f7] font-bold w-32">[METADATA]</span>
                      <span className="text-[#eae6f5] flex-1">Transaction Value: <span className="text-[#f59e0b]">₹{selData.amount ? Number(selData.amount).toLocaleString('en-IN') : 'N/A'}</span></span>
                    </div>
                    <div className="flex gap-6 items-center px-3 py-2.5 rounded-lg bg-[#f43f5e1a] border border-[#f43f5e33]">
                      <span className="text-[#f43f5e] w-16">{formatTime(selData.created_at)}</span>
                      <span className="text-[#f43f5e] font-bold w-32">[AI_LOGIC]</span>
                      <span className="text-white font-bold flex-1" style={{ color: '#f43f5e', textShadow: '0 0 10px rgba(244, 63, 94, 0.3)' }}>{selData.reason}</span>
                    </div>
                    <div className="flex gap-6 items-center px-3 py-2.5 rounded-lg italic opacity-60">
                      <span className="text-[#635d7a] w-16">{formatTime(selData.created_at)}</span>
                      <span className="text-[#a855f7] font-bold w-32">[STATUS]</span>
                      <span className="text-[#eae6f5] flex-1">Status: {selData.status.toUpperCase()}</span>
                    </div>
                  </div>
                </div>

                {/* Final Decision Actions */}
                {selData.status === 'open' && (
                  <div className="grid grid-cols-2 gap-5">
                    <button disabled={processing} onClick={resolveIncident} className="btn-action bg-transparent border border-[#f43f5e44] text-[#f43f5e] hover:bg-[#f43f5e] hover:text-white cursor-pointer" style={{ boxShadow: '0 0 15px rgba(244,63,94,0.1)' }}>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"></circle><line x1="4.93" x2="19.07" y1="4.93" y2="19.07"></line></svg>
                      {processing ? '...' : 'Mark Resolved (Permanent Block)'}
                    </button>
                    <button disabled={processing} onClick={approveIncident} className="btn-action bg-[#a855f7] text-white hover:bg-[#9333ea] cursor-pointer" style={{ boxShadow: '0 0 20px rgba(168,85,247,0.3)', border: 'none' }}>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"></polyline></svg>
                      {processing ? '...' : 'Force Approve Transaction'}
                    </button>
                  </div>
                )}
             </>
          ) : (
            <div className="rounded-xl p-16 flex flex-col items-center justify-center text-center mt-10" style={{ background: 'rgba(28, 21, 51, 0.7)', border: '1px dashed #3d2d6b', backdropFilter: 'blur(12px)' }}>
              <div className="text-6xl mb-4">✅</div>
              <h3 className="text-xl font-bold text-[#eae6f5] mb-0">Incident Queue Clear</h3>
              <p className="text-[#a09bb8] mt-2 mb-0">No `{filter}` incidents require attention right now.</p>
            </div>
          )}
        </section>

        {/* RIGHT COLUMN: Incident Grid */}
        <aside className="col-span-4 flex flex-col gap-4 sticky top-8">
          <div className="flex items-center justify-between px-1 mb-1">
            <h4 className="text-[11px] font-bold text-[#635d7a] uppercase tracking-[2px] mb-0">Incident Feed ({incidents.length})</h4>
            <span className="text-[9px] text-[#f43f5e] font-bold animate-pulse tracking-widest uppercase mb-0">Latest Events</span>
          </div>

          {incidents.map((req) => (
            <div 
              key={req.id}
              onClick={() => setSelected(req.id)}
              className={`p-5 cursor-pointer transition-all border group rounded-2xl ${selected === req.id ? 'active-card-glow bg-[rgba(28,21,51,0.9)] border-[#a855f7]' : 'border-[#2d2548] hover:border-[#3d2d6b] bg-[rgba(28,21,51,0.7)]'}`}
              style={selected === req.id ? { boxShadow: '0 0 25px rgba(168,85,247,0.15)' } : {}}
            >
              {selected === req.id && (
                <div className="absolute top-4 right-4">
                  <div className="w-2 h-2 bg-[#a855f7] rounded-full animate-ping"></div>
                </div>
              )}
              <div className="flex items-center gap-4 mb-4">
                <div className={`w-11 h-11 rounded-lg bg-[#0b0510] border flex items-center justify-center font-bold text-sm transition-colors uppercase ${selected === req.id ? 'border-[#a855f755] text-[#a855f7]' : 'border-[#2d2548] text-[#635d7a] group-hover:text-[#a09bb8]'}`}>
                  {req.user_id ? req.user_id.substring(0, 2) : 'U'}
                </div>
                <div>
                  <p className={`text-[15px] font-bold transition-colors tracking-tight mb-0 ${selected === req.id ? 'text-white' : 'text-[#a09bb8] group-hover:text-white'}`}>
                    {req.user_id}
                  </p>
                  <p className="text-[11px] text-[#635d7a] font-mono mt-0.5 mb-0">{formatTime(req.created_at)}</p>
                </div>
              </div>
              <p className={`text-[11px] mb-4 italic px-1 transition-colors ${selected === req.id ? 'text-[#eae6f5] bg-[#0b051088] p-3 rounded-xl border border-[#3d2d6b33]' : 'text-[#635d7a] group-hover:text-[#a09bb8]'}`}>
                "{req.reason}"
              </p>
              <div className="flex justify-between items-center">
                <span className={`text-[9px] font-bold px-2.5 py-1 rounded border tracking-widest uppercase ${req.risk_score >= 80 ? 'text-[#f43f5e] bg-[#f43f5e11] border-[#f43f5e22]' : req.risk_score >= 50 ? 'text-[#f59e0b] bg-[#f59e0b11] border-[#f59e0b22]' : 'text-[#22d3ee] bg-[#22d3ee11] border-[#22d3ee22]'}`}>
                  {req.decision}
                </span>
                <span className="text-[11px] text-[#635d7a] font-mono">#{String(req.id).substring(0,6).toUpperCase()}</span>
              </div>
            </div>
          ))}

          {/* Footer Stats Widget */}
          <div className="mt-4 p-5 rounded-2xl bg-[#0b0510] border border-[#2d2548] flex flex-col gap-3">
            <div className="flex justify-between text-[10px] font-bold uppercase tracking-[2px] text-[#635d7a] mb-0">
              <span>Weekly Mitigation</span>
              <span className="text-[#10b981]" style={{ color: '#22d3ee', textShadow: '0 0 10px rgba(34,211,238,0.3)' }}>94%</span>
            </div>
            <div className="w-full bg-[#1c1533] h-1.5 rounded-full overflow-hidden">
              <div className="h-full bg-gradient-to-r from-[#a855f7] to-[#22d3ee] w-[94%]" style={{ boxShadow: '0 0 10px rgba(34,211,238,0.4)' }}></div>
            </div>
          </div>
        </aside>
      </div>
    </div>
  )
}
