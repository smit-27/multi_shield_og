import { useState, useEffect, useRef } from 'react'
import { apiFetch } from '../App'

export default function ApprovalQueue() {
  const [approvals, setApprovals] = useState([])
  const [stats, setStats] = useState({})
  const [selected, setSelected] = useState(null)
  const [adminResponse, setAdminResponse] = useState('')
  const [processing, setProcessing] = useState(false)
  const [toast, setToast] = useState(null)
  const pollRef = useRef(null)

  const load = () => {
    apiFetch('/api/approvals').then(d => setApprovals(d.approvals)).catch(console.error)
    apiFetch('/api/approvals/stats').then(setStats).catch(console.error)
  }

  useEffect(() => {
    load()
    pollRef.current = setInterval(load, 5000)
    return () => clearInterval(pollRef.current)
  }, [])

  // Auto-select the first pending approval if none is selected
  const pendingApprovals = approvals.filter(a => a.status === 'pending')
  useEffect(() => {
    if (!selected && pendingApprovals.length > 0) {
      setSelected(pendingApprovals[0].id)
    } else if (pendingApprovals.length === 0) {
      setSelected(null)
    }
  }, [approvals, selected])

  const showToast = (msg, type = 'success') => { setToast({ msg, type }); setTimeout(() => setToast(null), 4000) }

  const handleDecision = async (decision) => {
    if (!selected) return
    setProcessing(true)
    try {
      await apiFetch(`/api/approvals/${selected}/decide`, {
        method: 'POST',
        body: JSON.stringify({ decision, response: adminResponse || `Action ${decision} by admin` })
      })
      showToast(`Request ${decision}`)
      setSelected(null)
      setAdminResponse('')
      load()
    } catch (err) {
      showToast(err.message || 'Failed to process', 'error')
    } finally {
      setProcessing(false)
    }
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

  const selectedData = approvals.find(a => a.id === selected)
  const resolvedApprovals = approvals.filter(a => a.status !== 'pending')

  return (
    <div className="flex-1 p-9 relative bg-[#0f0b1e] text-[#eae6f5] min-h-screen" style={{ fontFamily: "'Inter', sans-serif" }}>
      {/* ── Background Cyber Grid Overlay ── */}
      <div className="absolute inset-0 pointer-events-none" style={{
        backgroundImage: "linear-gradient(rgba(124, 92, 252, 0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(124, 92, 252, 0.05) 1px, transparent 1px)",
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
          <h2 className="text-3xl font-bold tracking-tight text-[#eae6f5] mb-0" style={{ margin: 0 }}>Forensic Review Center</h2>
          <p className="text-sm text-[#a09bb8] mt-1 italic font-medium mb-0">Resolution required for high-risk escalated privilege requests.</p>
        </div>
        <div className="flex gap-3">
          <button className="px-5 py-2.5 bg-[#1c1533] border border-[#2d2548] text-[#a09bb8] text-[11px] font-bold uppercase tracking-widest rounded hover:bg-[#241c3e] transition-colors cursor-pointer m-0">
            History
          </button>
          <button onClick={load} className="px-5 py-2.5 bg-[#7c5cfc] text-white text-[11px] font-bold uppercase tracking-widest rounded hover:bg-[#6344e0] shadow-lg shadow-[#7c5cfc33] transition-colors cursor-pointer m-0">
            Refresh Queue
          </button>
        </div>
      </header>

      {/* ── KPI Grid ── */}
      <section className="grid grid-cols-3 gap-6 mb-8 relative z-10">
        <div className="p-6 rounded-xl border-l-4 border-l-[#f43f5e]" style={{ background: 'rgba(23, 17, 42, 0.7)', backdropFilter: 'blur(12px)', borderTop: '1px solid #3d2d6b', borderRight: '1px solid #3d2d6b', borderBottom: '1px solid #3d2d6b' }}>
          <div className="flex justify-between items-start">
            <p className="text-[11px] text-[#635d7a] font-bold uppercase tracking-wider mb-0">Queue Priority</p>
            {stats.pending > 0 && <span className="px-2 py-0.5 rounded bg-[#f43f5e1a] text-[#f43f5e] text-[10px] font-mono font-bold">CRITICAL</span>}
          </div>
          <h3 className="text-4xl font-mono font-bold mt-2 neon-text-danger" style={{ color: '#f43f5e', textShadow: '0 0 10px rgba(244, 63, 94, 0.5)' }}>
            {String(stats.pending || 0).padStart(2, '0')}
          </h3>
          <p className="text-xs text-[#635d7a] mt-2 italic mb-0">Active forensic escalations</p>
        </div>
        <div className="p-6 rounded-xl border-l-4 border-l-[#10b981]" style={{ background: 'rgba(23, 17, 42, 0.7)', backdropFilter: 'blur(12px)', borderTop: '1px solid #3d2d6b', borderRight: '1px solid #3d2d6b', borderBottom: '1px solid #3d2d6b' }}>
          <div className="flex justify-between items-start">
            <p className="text-[11px] text-[#635d7a] font-bold uppercase tracking-wider mb-0">Total Resolutions</p>
            <span className="px-2 py-0.5 rounded bg-[#10b9811a] text-[#10b981] text-[10px] font-mono font-bold">OPTIMAL</span>
          </div>
          <h3 className="text-4xl font-mono font-bold mt-2" style={{ color: '#10b981', textShadow: '0 0 10px rgba(16, 185, 129, 0.5)' }}>
            {String((stats.approved || 0) + (stats.denied || 0)).padStart(2, '0')}
          </h3>
          <p className="text-xs text-[#635d7a] mt-2 italic mb-0">Historical queue clearance</p>
        </div>
        <div className="p-6 rounded-xl border-l-4 border-l-[#f59e0b]" style={{ background: 'rgba(23, 17, 42, 0.7)', backdropFilter: 'blur(12px)', borderTop: '1px solid #3d2d6b', borderRight: '1px solid #3d2d6b', borderBottom: '1px solid #3d2d6b' }}>
          <div className="flex justify-between items-start">
            <p className="text-[11px] text-[#635d7a] font-bold uppercase tracking-wider mb-0">Aggregated Risk</p>
            <div className="flex gap-1">
              <div className="w-1 h-3 bg-[#f59e0b] rounded-full"></div>
              <div className="w-1 h-3 bg-[#f59e0b] rounded-full"></div>
              <div className="w-1 h-3 bg-[#635d7a] rounded-full"></div>
            </div>
          </div>
          <h3 className="text-4xl font-mono font-bold mt-2 neon-text-amber" style={{ color: '#f59e0b', textShadow: '0 0 10px rgba(245, 158, 11, 0.5)' }}>
            {stats.approved ? ((stats.denied || 0) / (stats.total || 1)).toFixed(1) * 100 : '0.0'}
          </h3>
          <p className="text-xs text-[#635d7a] mt-2 italic mb-0">Composite block threat index</p>
        </div>
      </section>

      {/* ── Review Grid ── */}
      <div className="grid grid-cols-12 gap-8 items-start relative z-10">
        
        {/* LEFT COLUMN: Selected Case Detailed Analysis */}
        <section className="col-span-8 flex flex-col gap-6">
          {selectedData ? (
            <>
              {/* Case Header & Trust Score */}
              <div className="obsidian-glass rounded-xl p-6 relative overflow-hidden bg-[rgba(23,17,42,0.7)]">
                <div className="scanline"></div>
                <div className="flex justify-between items-start relative z-20">
                  <div className="flex gap-5">
                    <div className="w-16 h-16 rounded bg-[#1c1533] border border-[#3d2d6b] flex items-center justify-center text-[#7c5cfc] font-bold text-2xl shadow-inner uppercase">
                      {selectedData.username ? selectedData.username.substring(0, 2) : 'U'}
                    </div>
                    <div>
                      <h3 className="text-2xl font-bold text-white leading-tight mb-0" style={{ margin: 0 }}>{selectedData.username || selectedData.user_id}</h3>
                      <p className="text-[#a09bb8] text-sm font-mono mt-1 font-medium mb-0">Role: {selectedData.role} • ID: #{String(selectedData.id).substring(0,6).toUpperCase()}</p>
                      <div className="flex gap-2 mt-4">
                        <span className={`bg-[#f43f5e1a] text-[#f43f5e] border border-[#f43f5e33] text-[10px] font-bold px-2.5 py-1 rounded uppercase tracking-wider`}>Escalation Request</span>
                        <span className="bg-[#22d3ee1a] text-[#22d3ee] border border-[#22d3ee33] text-[10px] font-bold px-2.5 py-1 rounded uppercase tracking-wider font-mono">
                          AMOUNT: ₹{selectedData.amount ? Number(selectedData.amount).toLocaleString('en-IN') : 'N/A'}
                        </span>
                      </div>
                    </div>
                  </div>
                  {/* Trust Score Visualization */}
                  <div className="text-center">
                    <div className="relative w-24 h-24 mx-auto">
                      <svg className="w-full h-full transform -rotate-90">
                        <circle className="text-[#2d2548]" cx="48" cy="48" fill="transparent" r="40" stroke="currentColor" strokeWidth="6"></circle>
                        <circle className={`trust-gauge text-${selectedData.risk_score >= 80 ? '[#f43f5e]' : selectedData.risk_score >= 50 ? '[#f59e0b]' : '[#10b981]'}`} cx="48" cy="48" fill="transparent" r="40" stroke="currentColor" strokeDasharray="251.2" strokeDashoffset={`${251.2 - (selectedData.risk_score / 100 * 251.2)}`} strokeLinecap="round" strokeWidth="6" style={{ filter: `drop-shadow(0 0 10px ${selectedData.risk_score >= 80 ? '#f43f5e' : selectedData.risk_score >= 50 ? '#f59e0b' : '#10b981'})` }}></circle>
                      </svg>
                      <div className="absolute inset-0 flex flex-col items-center justify-center">
                        <span className="text-3xl font-bold font-mono text-white">{selectedData.risk_score}</span>
                        <span className="text-[9px] text-[#635d7a] uppercase font-bold tracking-tighter">Risk Score</span>
                      </div>
                    </div>
                    <p className={`text-[10px] font-bold uppercase tracking-widest mt-2 ${selectedData.risk_score >= 80 ? 'text-[#f43f5e]' : selectedData.risk_score >= 50 ? 'text-[#f59e0b]' : 'text-[#10b981]'}`}>
                      {selectedData.risk_score >= 80 ? 'Critical Risk' : selectedData.risk_score >= 50 ? 'At-Risk State' : 'Trusted Status'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Forensic Details & Admin Response Input */}
              <div className="grid grid-cols-2 gap-6">
                {/* User Message */}
                <div className="obsidian-glass rounded-xl overflow-hidden border-t-2 border-[#10b981] h-full flex flex-col bg-[rgba(23,17,42,0.7)]">
                  <div className="px-5 py-3 border-b border-[#2d2548] bg-[#10b9810a] flex items-center justify-between">
                    <h4 className="text-[11px] font-bold text-[#10b981] uppercase tracking-[2px] flex items-center gap-2 mb-0">
                      <span className="w-2 h-2 rounded-full bg-[#10b981] animate-pulse"></span>
                      Provided Context
                    </h4>
                  </div>
                  <div className="p-5 flex-1 relative flex flex-col items-center justify-center font-mono text-xs">
                    {selectedData.user_message ? (
                      <p className="text-[#eae6f5] italic text-center w-full bg-[#1c1533] p-4 rounded border border-[#2d2548]">"{selectedData.user_message}"</p>
                    ) : (
                      <p className="text-[#635d7a] italic text-center">No message attached explicitly.</p>
                    )}
                  </div>
                </div>

                {/* Input Area */}
                <div className="obsidian-glass rounded-xl overflow-hidden border-t-2 border-[#7c5cfc] h-full flex flex-col bg-[rgba(23,17,42,0.7)]">
                  <div className="px-5 py-3 border-b border-[#2d2548] bg-[#7c5cfc0a] flex items-center justify-between">
                    <h4 className="text-[11px] font-bold text-[#7c5cfc] uppercase tracking-[2px] flex items-center gap-2 mb-0">
                      <span className="w-2 h-2 rounded-full bg-[#7c5cfc]"></span>
                      Resolution Input
                    </h4>
                  </div>
                  <div className="p-5 flex-1 flex flex-col">
                    <textarea 
                      className="w-full flex-1 bg-[#17112a] border border-[#3d2d6b] rounded-lg p-3 text-sm text-white focus:outline-none focus:border-[#7c5cfc] resize-none"
                      placeholder="Enter SOC reason for approval/denial..."
                      value={adminResponse}
                      onChange={e => setAdminResponse(e.target.value)}
                    />
                  </div>
                </div>
              </div>

              {/* Forensic Audit Trail Snippet */}
              <div className="obsidian-glass rounded-xl overflow-hidden border border-[#2d2548] bg-[rgba(23,17,42,0.7)]">
                <div className="bg-[#1c1533] px-5 py-3 border-b border-[#2d2548] flex justify-between items-center">
                  <h4 className="text-[11px] font-bold text-[#a09bb8] uppercase tracking-[2px] mb-0">Action Type Details</h4>
                  <span className="text-[10px] font-mono text-[#635d7a]">SESSION_ID: {selectedData.id}</span>
                </div>
                <div className="p-4 space-y-2 font-mono text-[11px]">
                  <div className="flex gap-4 items-center p-2 rounded hover:bg-[#241c3e] transition-colors">
                    <span className="text-[#635d7a] w-16">{formatTime(selectedData.created_at)}</span>
                    <span className="text-[#22d3ee] font-bold w-32">[ACTION]</span>
                    <span className="text-[#eae6f5]">Type: <span className="font-bold text-white uppercase">{selectedData.action}</span></span>
                  </div>
                  <div className="flex gap-4 items-center p-2 rounded hover:bg-[#241c3e] transition-colors">
                    <span className="text-[#635d7a] w-16">{formatTime(selectedData.created_at)}</span>
                    <span className="text-[#f59e0b] font-bold w-32">[METADATA]</span>
                    <span className="text-[#eae6f5]">Value: {selectedData.amount ? `₹${selectedData.amount}` : 'N/A'}</span>
                  </div>
                  <div className="flex gap-4 items-center p-2 rounded italic opacity-70">
                    <span className="text-[#635d7a] w-16">{formatTime(selectedData.created_at)}</span>
                    <span className="text-[#7c5cfc] font-bold w-32">[STATUS]</span>
                    <span className="text-[#eae6f5]">Pending approval...</span>
                  </div>
                </div>
              </div>

              {/* Final Decision Actions */}
              <div className="grid grid-cols-2 gap-4 pt-2">
                <button disabled={processing} onClick={() => handleDecision('denied')} className="btn-action bg-[#f43f5e1a] border border-[#f43f5e44] text-[#f43f5e] hover:bg-[#f43f5e] hover:text-white shadow-lg shadow-[#f43f5e11] cursor-pointer">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"></circle><line x1="4.93" x2="19.07" y1="4.93" y2="19.07"></line></svg>
                  {processing ? 'Processing...' : 'Reject Request'}
                </button>
                <button disabled={processing} onClick={() => handleDecision('approved')} className="btn-action bg-[#7c5cfc] text-white hover:bg-[#6344e0] shadow-lg shadow-[#7c5cfc33] cursor-pointer" style={{ border: 'none' }}>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"></polyline></svg>
                  {processing ? 'Processing...' : 'Approve Override'}
                </button>
              </div>
            </>
          ) : (
            <div className="obsidian-glass rounded-xl p-16 flex flex-col items-center justify-center text-center bg-[rgba(23,17,42,0.7)] mt-10" style={{ border: '1px dashed #3d2d6b' }}>
              <div className="text-6xl mb-4">✅</div>
              <h3 className="text-xl font-bold text-[#eae6f5]">Queue Clear</h3>
              <p className="text-[#a09bb8] mt-2">No pending escalations require forensic review right now.</p>
            </div>
          )}
        </section>

        {/* RIGHT COLUMN: Approval Queue List */}
        <aside className="col-span-4 flex flex-col gap-4 sticky top-9">
          <div className="flex items-center justify-between mb-1">
            <h4 className="text-[11px] font-bold text-[#635d7a] uppercase tracking-[2px] mb-0">Queue Activity ({pendingApprovals.length})</h4>
            <span className="text-[9px] text-[#22d3ee] font-bold font-mono animate-pulse">LIVE REFRESH</span>
          </div>

          {pendingApprovals.map((req) => (
            <div 
              key={req.id}
              onClick={() => setSelected(req.id)}
              className={`p-5 cursor-pointer transition-all border group ${selected === req.id ? 'active-card-glow bg-[rgba(23,17,42,0.9)] rounded-xl border-[#7c5cfc]' : 'obsidian-card rounded-xl border-[#2d2548] hover:border-[#3d2d6b] bg-[rgba(23,17,42,0.7)]'}`}
            >
              {selected === req.id && (
                <div className="absolute top-0 right-0 p-3">
                  <div className="w-2.5 h-2.5 bg-[#7c5cfc] rounded-full animate-ping"></div>
                </div>
              )}
              <div className="flex items-center gap-4 mb-4">
                <div className={`w-12 h-12 rounded bg-[#1c1533] border flex items-center justify-center font-bold transition-colors uppercase ${selected === req.id ? 'border-[#7c5cfc44] text-[#7c5cfc] shadow-inner' : 'border-[#2d2548] text-[#a09bb8] group-hover:text-[#7c5cfc]'}`}>
                  {req.username ? req.username.substring(0, 2) : 'U'}
                </div>
                <div>
                  <p className={`text-[15px] font-bold transition-colors mb-0 ${selected === req.id ? 'text-white' : 'text-[#a09bb8] group-hover:text-white'}`}>
                    {req.username || req.user_id}
                  </p>
                  <p className="text-[11px] text-[#635d7a] font-mono mb-0">REC: {formatTime(req.created_at)}</p>
                </div>
              </div>
              <p className={`text-xs mb-4 line-clamp-2 italic font-medium leading-relaxed ${selected === req.id ? 'text-[#eae6f5] bg-[#0f0b1e88] p-3 rounded border border-[#2d2548]' : 'text-[#635d7a] group-hover:text-[#a09bb8]'}`}>
                "{req.user_message || `Requesting ${req.action} ${req.amount ? `for ₹${req.amount}` : ''}`}"
              </p>
              <div className="flex justify-between items-center">
                <span className={`text-[9px] font-bold px-2.5 py-1 rounded border uppercase tracking-wider ${req.risk_score >= 80 ? 'text-[#f43f5e] bg-[#f43f5e1a] border-[#f43f5e33]' : req.risk_score >= 50 ? 'text-[#f59e0b] bg-[#f59e0b1a] border-[#f59e0b33]' : 'text-[#10b981] bg-[#10b9811a] border-[#10b98133]'}`}>
                  {req.risk_score >= 80 ? 'Critical' : req.risk_score >= 50 ? 'Medium' : 'Low'}
                </span>
                <span className="text-[11px] text-[#635d7a] font-mono">#{String(req.id).substring(0,6).toUpperCase()}</span>
              </div>
            </div>
          ))}

          {/* Footer Efficiency Stats */}
          <div className="mt-4 p-6 obsidian-card rounded-2xl border-t-2 border-[#7c5cfc] bg-[rgba(10,5,21,0.5)]">
            <div className="flex justify-between text-[11px] font-bold uppercase tracking-[2px] text-[#a09bb8] mb-4">
              <span>Weekly Accuracy</span>
              <span className="text-[#10b981] font-mono">94.2%</span>
            </div>
            <div className="w-full bg-[#1c1533] h-2 rounded-full overflow-hidden border border-[#2d2548]">
              <div className="bg-gradient-to-r from-[#7c5cfc] to-[#10b981] h-full w-[94.2%]" style={{boxShadow: '0 0 10px rgba(16,185,129,0.3)'}}></div>
            </div>
            <p className="text-[10px] text-[#635d7a] mt-3 italic font-medium leading-tight mb-0">Last 7 days performance metrics across SOC Tier-1 team.</p>
          </div>
        </aside>
      </div>
    </div>
  )
}
