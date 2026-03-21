import { useState, useEffect } from 'react'
import { io } from 'socket.io-client'

export default function Admin() {
  const [activities, setActivities] = useState([])
  const [trafficStats, setTrafficStats] = useState({ verified: 0, sandboxed: 0, blocked: 0 })
  const [serverTime, setServerTime] = useState(new Date())
  const [mfaCodes, setMfaCodes] = useState([])

  // Keep a live clock updating
  useEffect(() => {
    const timer = setInterval(() => setServerTime(new Date()), 100)
    return () => clearInterval(timer)
  }, [])

  // Poll for active MFA codes
  useEffect(() => {
    const fetchCodes = () => {
      fetch('http://127.0.0.1:3002/api/mfa/active/codes')
        .then(res => res.json())
        .then(data => setMfaCodes(data.challenges || []))
        .catch(console.error)
    }
    fetchCodes()
    const interval = setInterval(fetchCodes, 3000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    const socket = io('http://127.0.0.1:3002')

    socket.on('zta-activity', (data) => {
      setActivities(prev => [data, ...prev].slice(0, 50))

      setTrafficStats(prev => {
        let { verified, sandboxed, blocked } = prev
        if (data.action === 'BLOCKED' || data.action === 'AUTH_LOCKED') blocked++
        else if (data.action === 'SANDBOXED') sandboxed++
        else verified++
        return { verified, sandboxed, blocked }
      })
    })

    return () => socket.disconnect()
  }, [])

  const totalTraffic = trafficStats.verified + trafficStats.sandboxed + trafficStats.blocked
  const loadActiveThreats = trafficStats.blocked
  const riskIndex = ((trafficStats.blocked * 0.9 + trafficStats.sandboxed * 0.4) / (totalTraffic || 1) * 100).toFixed(1)
  
  const formatClock = (date) => {
    const h = String(date.getHours()).padStart(2, '0')
    const m = String(date.getMinutes()).padStart(2, '0')
    const s = String(date.getSeconds()).padStart(2, '0')
    const ms = String(Math.floor(date.getMilliseconds() / 10)).padStart(2, '0')
    return `${h}:${m}:${s}:${ms}`
  }

  return (
    <div className="flex-1 p-8 relative" style={{ backgroundColor: '#0f0b1e', color: '#eae6f5', fontFamily: "'Inter', sans-serif" }}>
      {/* ── Background Cyber Grid Overlay ── */}
      <div className="absolute inset-0 pointer-events-none" style={{
        backgroundImage: "linear-gradient(rgba(124, 92, 252, 0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(124, 92, 252, 0.05) 1px, transparent 1px)",
        backgroundSize: "40px 40px"
      }}></div>

      {/* ── Page Header ── */}
      <header className="relative flex justify-between items-end mb-8 z-10 w-full">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-white mb-0" style={{ margin: 0 }}>Admin Center</h2>
          <p className="text-[#a09bb8] text-sm mt-1 mb-0">Real-time aggregate risk analysis and global threat tracking.</p>
        </div>
        <div className="flex gap-4">
          <div className="text-right">
            <p className="text-[10px] text-[#635d7a] uppercase tracking-widest font-bold mb-0">Terminal Time</p>
            <p className="text-lg font-mono font-bold text-[#7c5cfc] mb-0" id="terminal-clock">{formatClock(serverTime)}</p>
          </div>
        </div>
      </header>

      {/* ── KPI Grid ── */}
      <section className="relative grid grid-cols-1 md:grid-cols-3 gap-6 mb-8 z-10">
        <div className="p-6 rounded-xl border-l-4 border-l-[#f43f5e]" style={{ background: 'rgba(23, 17, 42, 0.7)', backdropFilter: 'blur(12px)', borderTop: '1px solid #3d2d6b', borderRight: '1px solid #3d2d6b', borderBottom: '1px solid #3d2d6b' }}>
          <div className="flex justify-between items-start">
            <p className="text-[11px] text-[#635d7a] font-bold uppercase tracking-wider mb-0">Active Threats</p>
            <span className="px-2 py-0.5 rounded bg-[#f43f5e1a] text-[#f43f5e] text-[10px] font-mono font-bold">LIVE</span>
          </div>
          <h3 className="text-4xl font-mono font-bold mt-2" style={{ color: '#f43f5e', textShadow: '0 0 10px rgba(244, 63, 94, 0.5)' }}>{loadActiveThreats}</h3>
          <p className="text-xs text-[#635d7a] mt-2 mb-0">Blocked or Locked sessions</p>
        </div>
        <div className="p-6 rounded-xl border-l-4 border-l-[#22d3ee]" style={{ background: 'rgba(23, 17, 42, 0.7)', backdropFilter: 'blur(12px)', borderTop: '1px solid #3d2d6b', borderRight: '1px solid #3d2d6b', borderBottom: '1px solid #3d2d6b' }}>
          <div className="flex justify-between items-start">
            <p className="text-[11px] text-[#635d7a] font-bold uppercase tracking-wider mb-0">Secure Throughput</p>
            <span className="px-2 py-0.5 rounded bg-[#22d3ee1a] text-[#22d3ee] text-[10px] font-mono font-bold">STABLE</span>
          </div>
          <h3 className="text-4xl font-mono font-bold mt-2" style={{ color: '#22d3ee', textShadow: '0 0 10px rgba(34, 211, 238, 0.5)' }}>{trafficStats.verified}</h3>
          <p className="text-xs text-[#635d7a] mt-2 mb-0">Verified legitimate requests</p>
        </div>
        <div className="p-6 rounded-xl border-l-4 border-l-[#f59e0b]" style={{ background: 'rgba(23, 17, 42, 0.7)', backdropFilter: 'blur(12px)', borderTop: '1px solid #3d2d6b', borderRight: '1px solid #3d2d6b', borderBottom: '1px solid #3d2d6b' }}>
          <div className="flex justify-between items-start">
            <p className="text-[11px] text-[#635d7a] font-bold uppercase tracking-wider mb-0">Global Risk Index</p>
            <div className="flex gap-1" style={{ marginTop: '4px' }}>
              <div className="w-1 h-3 bg-[#f59e0b] rounded-full"></div>
              <div className="w-1 h-3 bg-[#f59e0b] rounded-full"></div>
              <div className="w-1 h-3 bg-[#635d7a] rounded-full"></div>
            </div>
          </div>
          <h3 className="text-4xl font-mono font-bold mt-2" style={{ color: '#f59e0b', textShadow: '0 0 10px rgba(245, 158, 11, 0.5)' }}>{riskIndex}</h3>
          <p className="text-xs text-[#635d7a] mt-2 mb-0">Aggregate network threat level</p>
        </div>
      </section>

      <div className="relative grid grid-cols-1 lg:grid-cols-4 gap-8 z-10">
        {/* ── Geographical Threat Map ── */}
        <section className="lg:col-span-3 space-y-6">
          <div className="rounded-2xl h-[550px] overflow-hidden flex flex-col border border-[#22d3ee]/40" style={{ background: 'rgba(23, 17, 42, 0.7)' }}>
            <div className="p-5 border-b border-[#2d2548] flex justify-between items-center bg-[#0a0515] relative z-20">
              <h4 className="text-xs font-bold uppercase tracking-[2px] text-[#a09bb8] flex items-center gap-3 mb-0">
                <span className="w-2 h-2 bg-[#22d3ee] rounded-full animate-pulse"></span>
                ZTA Network Edge Topology
              </h4>
              <div className="flex gap-6 text-[10px] font-mono">
                <div className="flex items-center gap-2"><span className="w-2 h-2 bg-[#10b981] rounded-full"></span> SECURE NODE</div>
                <div className="flex items-center gap-2"><span className="w-2 h-2 bg-[#f43f5e] rounded-full"></span> THREAT ORIGIN</div>
              </div>
            </div>
            <div className="flex-1 relative bg-[#05050a] overflow-hidden group">
              {/* Background Map SVG */}
              <div className="absolute inset-0 opacity-20 pointer-events-none">
                <svg className="w-full h-full text-[#7c5cfc]" fill="currentColor" viewBox="0 0 1000 500">
                  <path d="M150,150 Q180,120 220,150 T300,140 Q350,160 380,200 T450,220 Q500,180 550,200 T650,180 Q700,150 750,170 T850,200 Q900,250 850,350 T750,400 Q650,450 550,420 T400,450 Q300,420 200,400 T150,350 Z" opacity="0.1"></path>
                  <circle cx="200" cy="180" opacity="0.1" r="40"></circle>
                  <circle cx="700" cy="220" opacity="0.1" r="60"></circle>
                  <circle cx="500" cy="350" opacity="0.1" r="30"></circle>
                  <defs>
                    <pattern height="20" id="mapGrid" patternUnits="userSpaceOnUse" width="20">
                      <path d="M 20 0 L 0 0 0 20" fill="none" stroke="currentColor" strokeWidth="0.2"></path>
                    </pattern>
                  </defs>
                  <rect fill="url(#mapGrid)" height="500" width="1000"></rect>
                </svg>
              </div>
              {/* Threat Overlay UI */}
              <div className="absolute inset-0 z-10">
                <div className="absolute top-[35%] left-[20%] group/node">
                  <div className="w-4 h-4 bg-[#10b981] rounded-full shadow-[0_0_15px_#10b981] border-2 border-white/20"></div>
                  <div className="absolute top-6 left-1/2 -translate-x-1/2 whitespace-nowrap bg-[#1c1533]/80 border border-[#2d2548] px-2 py-1 rounded text-[9px] text-[#10b981] font-bold">HQ_NODE_ALPHA</div>
                </div>
                <div className="absolute top-[30%] left-[52%] group/node">
                  <div className="w-4 h-4 bg-[#10b981] rounded-full shadow-[0_0_15px_#10b981] border-2 border-white/20"></div>
                  <div className="absolute top-6 left-1/2 -translate-x-1/2 whitespace-nowrap bg-[#1c1533]/80 border border-[#2d2548] px-2 py-1 rounded text-[9px] text-[#10b981] font-bold">EURO_EDGE_01</div>
                </div>
                {/* Threat Vectors (SVG) */}
                <svg className="absolute inset-0 w-full h-full pointer-events-none">
                  <path className="threat-vector" d="M 800 350 Q 500 100 200 175" fill="none" stroke="rgba(244, 63, 94, 0.4)" strokeWidth="1.5" style={{ animationDuration: '4s' }}></path>
                  <path className="threat-vector" d="M 650 200 Q 400 50 200 175" fill="none" stroke="rgba(244, 63, 94, 0.4)" strokeWidth="1.5" style={{ animationDuration: '3s' }}></path>
                  <path className="threat-vector" d="M 300 400 Q 450 300 520 150" fill="none" stroke="rgba(244, 63, 94, 0.4)" strokeWidth="1.5" style={{ animationDuration: '5s' }}></path>
                  <path d="M 100 300 Q 300 200 520 150" fill="none" stroke="rgba(34, 211, 238, 0.2)" strokeDasharray="4 4" strokeWidth="1"></path>
                  <path d="M 850 150 Q 700 100 520 150" fill="none" stroke="rgba(34, 211, 238, 0.2)" strokeDasharray="4 4" strokeWidth="1"></path>
                </svg>
                {/* Threat Origin Pings */}
                <div className="map-ping top-[70%] left-[80%]"></div>
                <div className="map-ping top-[40%] left-[65%]"></div>
                <div className="map-ping top-[80%] left-[30%]"></div>
              </div>

              {/* Map Controls */}
              <div className="absolute bottom-6 left-1/2 -translate-x-1/2 w-[80%] z-30">
                <div className="px-6 py-3 rounded-2xl flex items-center gap-6 bg-[#0a0515]/95 shadow-[0_0_20px_rgba(34,211,238,0.1)] border border-[#22d3ee]/30">
                  <div className="flex flex-col">
                    <span className="text-[8px] font-bold text-[#22d3ee] uppercase tracking-[2px]">Network Topology</span>
                    <button className="mt-1 flex items-center justify-center text-[#22d3ee] hover:text-white transition-colors bg-transparent border-0 p-0 m-0">
                      ▶
                    </button>
                  </div>
                  <div className="flex-1 flex flex-col gap-2">
                    <div className="flex justify-between text-[9px] font-mono text-[#635d7a] uppercase tracking-wider">
                      <span>Gateway 01</span>
                      <span>Router 04</span>
                      <span className="text-[#22d3ee] font-bold">Live Flow</span>
                    </div>
                    <div className="relative h-1 w-full bg-[#2d2548] rounded-full group cursor-pointer">
                      <div className="absolute top-0 left-0 h-full w-[100%] bg-gradient-to-r from-[#7c5cfc] to-[#22d3ee] rounded-full shadow-[0_0_10px_#22d3ee]"></div>
                      <div className="absolute top-1/2 left-[100%] -translate-x-1/2 -translate-y-1/2 w-4 h-4 bg-white rounded-full shadow-[0_0_15px_#fff] border-4 border-[#22d3ee]"></div>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] text-[#a09bb8] font-mono leading-none mb-0">SYNC_STATUS</p>
                    <p className="text-xs font-mono font-bold text-white mb-0 mt-1">REAL-TIME</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* ── Activity Ticker ── */}
          <div className="rounded-xl overflow-hidden border border-[#2d2548]" style={{ background: 'rgba(23, 17, 42, 0.7)' }}>
            <div className="px-6 py-4 border-b border-[#2d2548] bg-[#1c1533]">
              <h3 className="text-[11px] font-bold text-[#a09bb8] uppercase tracking-widest mb-0">Live Forensics Log</h3>
            </div>
            <div className="p-0 max-h-[180px] overflow-y-auto font-mono text-[11px] custom-scrollbar">
              <table className="w-full text-left" style={{ borderCollapse: 'collapse' }}>
                <thead className="bg-[#150f28] text-[#635d7a]">
                  <tr>
                    <th className="px-6 py-3 font-medium">TIMESTAMP</th>
                    <th className="px-6 py-3 font-medium">SOURCE</th>
                    <th className="px-6 py-3 font-medium">ACTION</th>
                    <th className="px-6 py-3 font-medium">SCORE</th>
                    <th className="px-6 py-3 font-medium">DETAILS</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#2d2548] text-[#a09bb8]">
                  {activities.slice(0, 10).map((act, i) => (
                    <tr key={i} className={`hover:bg-[#7c5cfc0d] transition-colors ${act.action === 'BLOCKED' ? 'bg-[#f43f5e0a]' : ''}`}>
                      <td className="px-6 py-3 text-[#635d7a]">{act.timestamp.split('T')[1].substring(0, 8)}</td>
                      <td className="px-6 py-3 text-[#eae6f5]">{act.location}</td>
                      <td className="px-6 py-3">
                        <span className={act.action === 'BLOCKED' ? 'text-[#f43f5e] font-bold' : act.action === 'SANDBOXED' ? 'text-[#f59e0b]' : 'text-[#10b981]'}>
                          {act.action}
                        </span>
                      </td>
                      <td className={`px-6 py-3 ${act.score > 80 ? 'font-bold text-[#f43f5e]' : act.score > 50 ? 'font-bold text-[#f59e0b]' : ''}`}>{act.score}</td>
                      <td className="px-6 py-3" style={{ maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{act.details}</td>
                    </tr>
                  ))}
                  {activities.length === 0 && (
                    <tr>
                      <td colSpan="5" className="px-6 py-8 text-center text-[#635d7a]">Awaiting network traffic...</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* ── Active MFA Codes ── */}
          <div className="rounded-xl overflow-hidden border border-[#2d2548] p-6" style={{ background: 'rgba(23, 17, 42, 0.7)' }}>
            <div className="flex justify-between items-center mb-4">
              <h4 className="text-[11px] font-bold text-[#a09bb8] uppercase tracking-widest mb-0">Active MFA Verification Codes</h4>
              <span className="text-[9px] font-mono text-[#635d7a]">Latest first · IST</span>
            </div>
            <div className="flex flex-col gap-3 max-h-[320px] overflow-y-auto custom-scrollbar pr-1">
              {mfaCodes.length === 0 ? (
                <div className="p-4 bg-[#1c1533] border border-[#2d2548] rounded-lg text-xs text-center text-[#635d7a]">
                  No active MFA sessions
                </div>
              ) : (
                [...mfaCodes]
                  .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
                  .map((code, idx) => {
                    const istTime = new Date(
                      code.created_at.includes('Z') || code.created_at.includes('+')
                        ? code.created_at
                        : code.created_at.replace(' ', 'T') + 'Z'
                    ).toLocaleString('en-IN', {
                      timeZone: 'Asia/Kolkata',
                      hour: '2-digit', minute: '2-digit', second: '2-digit',
                      hour12: true, day: '2-digit', month: 'short'
                    })
                    return (
                      <div key={code.id} className="p-3 bg-[#1c1533] border border-[#3d2d6b] rounded-lg flex items-center gap-4 relative overflow-hidden">
                        <div className="absolute left-0 top-0 bottom-0 w-1 bg-[#10b981]"></div>
                        {/* Serial number */}
                        <div className="pl-2 text-[10px] font-mono text-[#635d7a] w-6 flex-shrink-0">#{idx + 1}</div>
                        {/* User & action info */}
                        <div className="flex-1 min-w-0">
                          <div className="text-[10px] font-bold text-white uppercase tracking-wider truncate">{code.username || code.user_id}</div>
                          <div className="text-[9px] text-[#22d3ee] uppercase">{code.action}</div>
                        </div>
                        {/* IST Timestamp */}
                        <div className="text-[9px] font-mono text-[#635d7a] text-right flex-shrink-0">
                          <div>{istTime.split(', ')[0]}</div>
                          <div>{istTime.split(', ')[1]}</div>
                        </div>
                        {/* OTP Code */}
                        <div className="font-mono text-base font-bold text-[#10b981] tracking-widest bg-[#0a0515] px-3 py-1 rounded border border-[#10b98144] shadow-[0_0_10px_rgba(16,185,129,0.2)] flex-shrink-0">
                          {code.otp_code}
                        </div>
                      </div>
                    )
                  })
              )}
            </div>
          </div>
        </section>

        {/* ── Explainable AI Sidebar (Static Representation for Admin Center) ── */}
        <aside className="space-y-6 lg:col-span-1">
          <div className="p-6 rounded-2xl border-t-2 border-[#7c5cfc]" style={{ background: 'rgba(23, 17, 42, 0.7)', borderLeft: '1px solid #3d2d6b', borderRight: '1px solid #3d2d6b', borderBottom: '1px solid #3d2d6b' }}>
            <h4 className="text-sm font-bold text-white mb-6 flex items-center gap-2">
              <svg className="w-4 h-4 text-[#7c5cfc]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M13 10V3L4 14h7v7l9-11h-7z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"></path></svg>
              Aggregate XAI Metrics
            </h4>
            <div className="flex flex-col items-center mb-8">
              <div className="relative flex flex-col items-center justify-center h-full w-full">
                <div className="text-5xl font-mono font-bold" style={{ color: '#a855f7', textShadow: '0 0 16px rgba(168,85,247,0.5)' }}>
                  ZTA
                </div>
                <span className="text-[9px] text-[#635d7a] font-bold uppercase tracking-widest mt-2">ENGINE ACTIVE</span>
              </div>
              <p className="mt-4 text-xs text-[#a09bb8] text-center px-4 leading-relaxed mb-0">
                Evaluating traffic heuristically via <span className="text-[#f59e0b] font-bold">Temporal Anomaly</span> and <span className="text-[#22d3ee] font-bold">Geographic Drift</span>.
              </p>
            </div>
            
            {/* Quick Actions */}
            <h4 className="text-[10px] font-bold text-[#635d7a] uppercase tracking-widest mb-4">Command Actions</h4>
            <div className="grid grid-cols-2 gap-3">
              <button className="p-3 bg-[#1c1533] border border-[#2d2548] rounded-lg text-xs font-semibold text-[#a09bb8] hover:border-[#7c5cfc] hover:text-white transition-all m-0 w-full cursor-pointer">Flush DNS</button>
              <button className="p-3 bg-[#1c1533] border border-[#2d2548] rounded-lg text-xs font-semibold text-[#a09bb8] hover:border-[#7c5cfc] hover:text-white transition-all m-0 w-full cursor-pointer">IP Ban List</button>
              <button className="p-3 bg-[#1c1533] border border-[#2d2548] rounded-lg text-xs font-semibold text-[#a09bb8] hover:border-[#7c5cfc] hover:text-white transition-all m-0 w-full cursor-pointer">Isolate VLAN</button>
              <button className="p-3 bg-[#f43f5e1a] border border-[#f43f5e33] rounded-lg text-xs font-semibold text-[#f43f5e] hover:bg-[#f43f5e33] transition-all m-0 w-full cursor-pointer">Halt System</button>
            </div>

            </div>
          </aside>
      </div>
    </div>
  )
}
