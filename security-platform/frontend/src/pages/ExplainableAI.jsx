import { useState, useEffect } from 'react'
import { io } from 'socket.io-client'

export default function ExplainableAI() {
  const [activities, setActivities] = useState([])
  const [trafficStats, setTrafficStats] = useState({ verified: 0, sandboxed: 0, blocked: 0 })
  const [serverTime, setServerTime] = useState(new Date())
  const [packets, setPackets] = useState([])

  // Keep a live clock updating
  useEffect(() => {
    const timer = setInterval(() => setServerTime(new Date()), 100)
    return () => clearInterval(timer)
  }, [])

  // Socket connection for live telemetry
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
      
      // Spawn a visual packet mapped to the real action
      spawnPacket(data.action)
    })

    return () => socket.disconnect()
  }, [])
  
  // Also spawn random background packets to simulate high network flow (since real requests might be slow)
  useEffect(() => {
    const spawner = setInterval(() => {
      const types = ['verified', 'verified', 'verified', 'sandboxed']
      const randomType = types[Math.floor(Math.random() * types.length)]
      spawnPacket(randomType)
    }, 1500)
    return () => clearInterval(spawner)
  }, [])

  const spawnPacket = (action) => {
    const id = Date.now() + Math.random()
    let type = 'verified'
    if (action === 'BLOCKED' || action === 'AUTH_LOCKED') type = 'blocked'
    if (action === 'SANDBOXED' || action === 'sandboxed') type = 'sandboxed'
    
    const newPacket = { id, type, delay: `${Math.random() * 2}s` }
    setPackets(prev => [...prev, newPacket])
    setTimeout(() => {
      setPackets(prev => prev.filter(p => p.id !== id))
    }, 5000)
  }

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
    <div className="flex-1 p-10 relative" style={{ backgroundColor: '#0b0510', color: '#eae6f5', fontFamily: "'Inter', sans-serif" }}>
      {/* ── Background Cyber Grid Overlay ── */}
      <div className="absolute inset-0 pointer-events-none" style={{
        backgroundImage: "linear-gradient(rgba(124, 92, 252, 0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(124, 92, 252, 0.05) 1px, transparent 1px)",
        backgroundSize: "40px 40px"
      }}></div>

      {/* ── Page Header ── */}
      <header className="relative flex justify-between items-end mb-10 z-10 w-full">
        <div>
          <h2 className="text-4xl font-bold tracking-tight text-white mb-0" style={{ margin: 0 }}>XAI Engine Dashboard</h2>
          <p className="text-[#a09bb8] text-sm mt-2 mb-0">Real-time aggregate risk analysis and traffic orchestration.</p>
        </div>
        <div className="flex gap-4">
          <div className="text-right">
            <p className="text-[10px] text-[#635d7a] uppercase tracking-widest font-bold mb-0">Terminal Time</p>
            <p className="text-xl font-mono font-bold text-[#7c5cfc] mb-0">{formatClock(serverTime)}</p>
          </div>
        </div>
      </header>

      {/* ── KPI Grid ── */}
      <section className="relative grid grid-cols-1 md:grid-cols-3 gap-8 mb-10 z-10">
        <div className="p-8 rounded-2xl border-l-4 border-l-[#f43f5e]" style={{ background: 'rgba(28, 21, 51, 0.6)', backdropFilter: 'blur(16px)', borderTop: '1px solid #3d2d6b', borderRight: '1px solid #3d2d6b', borderBottom: '1px solid #3d2d6b' }}>
          <div className="flex justify-between items-start">
            <p className="text-[11px] text-[#635d7a] font-bold uppercase tracking-wider mb-0">Active Threats</p>
            <span className="px-2 py-0.5 rounded bg-[#f43f5e1a] text-[#f43f5e] text-[10px] font-mono font-bold">LIVE</span>
          </div>
          <h3 className="text-5xl font-mono font-bold mt-3" style={{ color: '#f43f5e', textShadow: '0 0 10px rgba(244, 63, 94, 0.5)' }}>{loadActiveThreats}</h3>
          <p className="text-xs text-[#635d7a] mt-3 mb-0">Critical escalation required</p>
        </div>
        <div className="p-8 rounded-2xl border-l-4 border-l-[#22d3ee]" style={{ background: 'rgba(28, 21, 51, 0.6)', backdropFilter: 'blur(16px)', borderTop: '1px solid #3d2d6b', borderRight: '1px solid #3d2d6b', borderBottom: '1px solid #3d2d6b' }}>
          <div className="flex justify-between items-start">
            <p className="text-[11px] text-[#635d7a] font-bold uppercase tracking-wider mb-0">Gateway Load</p>
            <span className="px-2 py-0.5 rounded bg-[#22d3ee1a] text-[#22d3ee] text-[10px] font-mono font-bold">STABLE</span>
          </div>
          <h3 className="text-5xl font-mono font-bold mt-3" style={{ color: '#22d3ee', textShadow: '0 0 10px rgba(34, 211, 238, 0.5)' }}>{trafficStats.verified}</h3>
          <p className="text-xs text-[#635d7a] mt-3 mb-0">Verified legitimate requests</p>
        </div>
        <div className="p-8 rounded-2xl border-l-4 border-l-[#f59e0b]" style={{ background: 'rgba(28, 21, 51, 0.6)', backdropFilter: 'blur(16px)', borderTop: '1px solid #3d2d6b', borderRight: '1px solid #3d2d6b', borderBottom: '1px solid #3d2d6b' }}>
          <div className="flex justify-between items-start">
            <p className="text-[11px] text-[#635d7a] font-bold uppercase tracking-wider mb-0">Global Risk Index</p>
            <div className="flex gap-1" style={{ marginTop: '4px' }}>
              <div className="w-1 h-3 bg-[#f59e0b] rounded-full"></div>
              <div className="w-1 h-3 bg-[#f59e0b] rounded-full"></div>
              <div className="w-1 h-3 bg-[#635d7a] rounded-full"></div>
            </div>
          </div>
          <h3 className="text-5xl font-mono font-bold mt-3" style={{ color: '#f59e0b', textShadow: '0 0 10px rgba(245, 158, 11, 0.5)' }}>{riskIndex}</h3>
          <p className="text-xs text-[#635d7a] mt-3 mb-0">Aggregate network threat level</p>
        </div>
      </section>

      <div className="relative grid grid-cols-1 lg:grid-cols-4 gap-10 z-10">
        {/* ── Network Topology Map ── */}
        <section className="lg:col-span-3 space-y-10">
          <div className="rounded-2xl h-[550px] overflow-hidden flex flex-col border border-[#2d2548]" style={{ background: 'rgba(28, 21, 51, 0.6)' }}>
            <div className="p-6 border-b border-[#2d2548] flex justify-between items-center bg-[#0a0515]">
              <h4 className="text-xs font-bold uppercase tracking-[2px] text-[#a09bb8] flex items-center gap-3 mb-0">
                <span className="w-2 h-2 bg-[#7c5cfc] rounded-full shadow-[0_0_8px_var(--accent)]"></span>
                Real-Time Traffic Orchestration
              </h4>
              <div className="flex gap-6 text-[10px] font-mono">
                <div className="flex items-center gap-2"><span className="w-2 h-2 bg-[#10b981] rounded-full shadow-[0_0_5px_var(--success)]"></span> VERIFIED</div>
                <div className="flex items-center gap-2"><span className="w-2 h-2 bg-[#f59e0b] rounded-full shadow-[0_0_5px_var(--amber)]"></span> SANDBOXED</div>
                <div className="flex items-center gap-2"><span className="w-2 h-2 bg-[#f43f5e] rounded-full shadow-[0_0_5px_var(--danger)]"></span> BLOCKED</div>
              </div>
            </div>
            <div className="flex-1 relative bg-[#05050a] overflow-hidden">
              {/* Visual Nodes */}
              <div className="absolute left-10 top-1/2 -translate-y-1/2 z-20 text-center">
                <div className="w-16 h-16 bg-[#1c1533] border-2 border-[#7c5cfc] rounded-xl flex items-center justify-center shadow-[0_0_20px_rgba(124,92,252,0.3)]">
                  <svg className="w-8 h-8 text-[#7c5cfc]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5"></path></svg>
                </div>
                <p className="mt-2 text-[10px] font-mono text-[#a09bb8]">MAIN_GW_01</p>
              </div>
              
              <div className="absolute left-1/2 top-0 bottom-0 w-[1px] bg-gradient-to-b from-transparent via-[#7c5cfc33] to-transparent z-10">
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 px-3 py-1 bg-[#05050a] border border-[#2d2548] rounded text-[9px] font-bold tracking-tighter text-[#635d7a]">
                  ZTA_LAYER_V2
                </div>
              </div>
              
              <div className="absolute right-10 top-1/4 -translate-y-1/2 z-20 text-center">
                <div className="w-16 h-16 bg-[#0a1510] border-2 border-[#10b981] rounded-full flex items-center justify-center shadow-[0_0_20px_rgba(16,185,129,0.2)]">
                  <svg className="w-8 h-8 text-[#10b981]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5"></path></svg>
                </div>
                <p className="mt-2 text-[10px] font-mono text-[#10b981]">PROD_CLUSTER</p>
              </div>
              
              <div className="absolute right-10 bottom-1/4 translate-y-1/2 z-20 text-center">
                <div className="w-16 h-16 bg-[#151005] border-2 border-[#f59e0b] rounded-full flex items-center justify-center shadow-[0_0_20px_rgba(245,158,11,0.2)]">
                  <svg className="w-8 h-8 text-[#f59e0b]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.628.288a2 2 0 01-1.408 0l-.628-.288a6 6 0 00-3.86-.517l-2.387.477a2 2 0 00-1.022.547V18a2 2 0 002 2h11a2 2 0 002-2v-2.572zM12 11V3m0 0L9 6m3-3l3 3" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5"></path></svg>
                </div>
                <p className="mt-2 text-[10px] font-mono text-[#f59e0b]">ISOLATION_ZONE</p>
              </div>
              
              <div id="packet-container">
                {packets.map(p => (
                  <div key={p.id} className={`packet packet-${p.type}`} style={{ animationDelay: p.delay }}></div>
                ))}
              </div>
            </div>
          </div>

          {/* ── Activity Ticker ── */}
          <div className="rounded-2xl overflow-hidden border border-[#2d2548]" style={{ background: 'rgba(28, 21, 51, 0.6)', backdropFilter: 'blur(16px)' }}>
            <div className="px-8 py-5 border-b border-[#2d2548] bg-[#1c1533]">
              <h3 className="text-[11px] font-bold text-[#a09bb8] uppercase tracking-widest mb-0">Live Forensics Log</h3>
            </div>
            <div className="p-0 max-h-[250px] overflow-y-auto font-mono text-[11px] custom-scrollbar">
              <table className="w-full text-left" style={{ borderCollapse: 'collapse' }}>
                <thead className="bg-[#150f28] text-[#635d7a]">
                  <tr>
                    <th className="px-8 py-4 font-medium uppercase tracking-wider">Timestamp</th>
                    <th className="px-8 py-4 font-medium uppercase tracking-wider">Source</th>
                    <th className="px-8 py-4 font-medium uppercase tracking-wider">Action</th>
                    <th className="px-8 py-4 font-medium uppercase tracking-wider">Score</th>
                    <th className="px-8 py-4 font-medium uppercase tracking-wider">Signature</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#2d2548] text-[#a09bb8]">
                  {activities.slice(0, 15).map((act, i) => (
                    <tr key={i} className={`hover:bg-[#7c5cfc0d] transition-colors ${act.action === 'BLOCKED' ? 'bg-[#f43f5e0a]' : ''}`}>
                      <td className="px-8 py-4 text-[#635d7a]">{act.timestamp?.split('T')[1]?.substring(0,8) || serverTime.toLocaleTimeString()}</td>
                      <td className="px-8 py-4 text-[#eae6f5]">{act.location}</td>
                      <td className="px-8 py-4">
                        <span className={act.action === 'BLOCKED' ? 'text-[#f43f5e] font-bold' : act.action === 'SANDBOXED' ? 'text-[#f59e0b] font-bold' : 'text-[#10b981] font-bold'}>
                          {act.action}
                        </span>
                      </td>
                      <td className={`px-8 py-4 ${act.score > 80 ? 'font-bold text-[#f43f5e]' : act.score > 50 ? 'font-bold text-[#f59e0b]' : ''}`}>{act.score}</td>
                      <td className="px-8 py-4 text-[10px]" style={{ maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{act.details}</td>
                    </tr>
                  ))}
                  {activities.length === 0 && (
                    <tr>
                      <td colSpan="5" className="px-8 py-10 text-center text-[#635d7a]">Awaiting network traffic...</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* ── Explainable AI Sidebar (Restyled) ── */}
        <aside className="space-y-8 lg:col-span-1">
          <div className="p-8 rounded-2xl border-t-2 border-[#7c5cfc]" style={{ background: 'rgba(28, 21, 51, 0.6)', backdropFilter: 'blur(16px)', borderLeft: '1px solid #3d2d6b', borderRight: '1px solid #3d2d6b', borderBottom: '1px solid #3d2d6b' }}>
            <h4 className="text-sm font-bold text-white mb-8 flex items-center gap-2">
              <svg className="w-4 h-4 text-[#7c5cfc]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M13 10V3L4 14h7v7l9-11h-7z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"></path></svg>
              Explainable AI (XAI)
            </h4>
            
            <div className="flex flex-col items-center mb-10">
              <div className="relative flex items-center justify-center">
                {/* SVG Gauge */}
                <svg className="w-36 h-36 transform -rotate-90">
                  <circle cx="72" cy="72" fill="transparent" r="66" stroke="#2d2548" strokeWidth="10"></circle>
                  <circle cx="72" cy="72" fill="transparent" r="66" stroke="url(#riskGradient)" strokeDasharray="414.69" strokeDashoffset="136.8" strokeLinecap="round" strokeWidth="10"></circle>
                  <defs>
                    <linearGradient id="riskGradient" x1="0%" x2="100%" y1="0%" y2="0%">
                      <stop offset="0%" stopColor="#22d3ee"></stop>
                      <stop offset="50%" stopColor="#7c5cfc"></stop>
                      <stop offset="100%" stopColor="#f43f5e"></stop>
                    </linearGradient>
                  </defs>
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-4xl font-mono font-bold text-white drop-shadow-[0_0_10px_rgba(255,255,255,0.3)]">{Math.round(riskIndex * 2)}</span>
                  <span className="text-[9px] text-[#635d7a] font-bold uppercase tracking-[2px] mt-1">Risk Score</span>
                </div>
              </div>
              <p className="mt-6 text-xs text-[#a09bb8] text-center px-4 leading-relaxed mb-0">
                Score driven primarily by <span className="text-[#f59e0b] font-bold underline decoration-[#f59e0b]">Temporal Anomaly</span> and <span className="text-[#22d3ee] font-bold underline decoration-[#22d3ee]">API Velocity</span>.
              </p>
            </div>
            
            <div className="space-y-6 flex flex-col items-center w-full">
              {/* Factor 1: Temporal Anomaly (Amber/Danger) */}
              <div className="w-full">
                <div className="flex justify-between text-[11px] font-bold mb-3 w-full">
                  <span className="text-[#a09bb8] uppercase tracking-tighter">Temporal Anomaly</span>
                  <span className="text-[#f59e0b] font-mono">High (0.82)</span>
                </div>
                <div className="h-1.5 w-full bg-[#2d2548] rounded-full overflow-hidden">
                  <div className="h-full bg-[#f59e0b] w-[82%] shadow-[0_0_12px_rgba(245,158,11,0.6)]"></div>
                </div>
              </div>
              {/* Factor 2: API Velocity (Cyan) */}
              <div className="w-full">
                <div className="flex justify-between text-[11px] font-bold mb-3 w-full">
                  <span className="text-[#a09bb8] uppercase tracking-tighter">API Velocity</span>
                  <span className="text-[#22d3ee] font-mono">Med (0.45)</span>
                </div>
                <div className="h-1.5 w-full bg-[#2d2548] rounded-full overflow-hidden">
                  <div className="h-full bg-[#22d3ee] w-[45%] shadow-[0_0_12px_rgba(34,211,238,0.6)]"></div>
                </div>
              </div>
              {/* Factor 3: Payload Signature (Success/Clean) */}
              <div className="w-full">
                <div className="flex justify-between text-[11px] font-bold mb-3 w-full">
                  <span className="text-[#a09bb8] uppercase tracking-tighter">Payload Signature</span>
                  <span className="text-[#10b981] font-mono">Clean (0.12)</span>
                </div>
                <div className="h-1.5 w-full bg-[#2d2548] rounded-full overflow-hidden">
                  <div className="h-full bg-[#10b981] w-[12%] shadow-[0_0_12px_rgba(16,185,129,0.6)]"></div>
                </div>
              </div>
            </div>
            
            <button className="w-full mt-10 py-4 rounded-xl bg-[#7c5cfc1a] border border-[#7c5cfc33] text-[#7c5cfc] text-xs font-bold uppercase tracking-widest hover:bg-[#7c5cfc33] hover:shadow-[0_0_15px_rgba(124,92,252,0.2)] transition-all cursor-pointer">
              Full Breakdown →
            </button>
          </div>

          {/* Quick Actions */}
          <div className="p-8 rounded-2xl border border-[#2d2548]" style={{ background: 'rgba(10, 5, 21, 0.8)' }}>
            <h4 className="text-[10px] font-bold text-[#635d7a] uppercase tracking-widest mb-6 border-b border-[#2d2548] pb-3 mt-0">Command Center</h4>
            <div className="grid grid-cols-2 gap-4">
              <button className="p-4 bg-[#1c1533] border border-[#2d2548] rounded-xl text-[11px] font-semibold text-[#a09bb8] hover:border-[#7c5cfc] hover:text-white hover:bg-[#2d2548] transition-all cursor-pointer m-0 w-full">Flush DNS</button>
              <button className="p-4 bg-[#1c1533] border border-[#2d2548] rounded-xl text-[11px] font-semibold text-[#a09bb8] hover:border-[#7c5cfc] hover:text-white hover:bg-[#2d2548] transition-all cursor-pointer m-0 w-full">IP Ban List</button>
              <button className="p-4 bg-[#1c1533] border border-[#2d2548] rounded-xl text-[11px] font-semibold text-[#a09bb8] hover:border-[#7c5cfc] hover:text-white hover:bg-[#2d2548] transition-all cursor-pointer m-0 w-full">Isolation</button>
              <button className="p-4 bg-[#f43f5e1a] border border-[#f43f5e33] rounded-xl text-[11px] font-bold text-[#f43f5e] hover:bg-[#f43f5e33] hover:shadow-[0_0_15px_rgba(244,63,94,0.2)] transition-all cursor-pointer m-0 w-full">HALT</button>
            </div>
          </div>
        </aside>
      </div>
    </div>
  )
}
