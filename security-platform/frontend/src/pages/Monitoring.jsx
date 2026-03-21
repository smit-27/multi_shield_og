import { useState, useEffect, useRef } from 'react'
import { apiFetch, Icon } from '../App'
import { io } from 'socket.io-client'
import { Activity, Clock, ShieldAlert, Cpu, Database, ServerCrash, AlertTriangle } from 'lucide-react'

export default function SOCDashboard() {
  const [activities, setActivities] = useState([])
  const [serverTime, setServerTime] = useState(new Date())
  const [isConnected, setIsConnected] = useState(false)
  
  // Hardcode policy times (match backend: Mon-Fri, 9AM-6PM)
  const isOfficeHours = (time) => {
    const hour = time.getHours()
    const day = time.getDay()
    return (day >= 1 && day <= 5) && (hour >= 9 && hour < 18)
  }

  const officeHoursActive = isOfficeHours(serverTime)

  useEffect(() => {
    // Connect to Backend Socket.io
    const socket = io('http://127.0.0.1:3002')

    socket.on('connect', () => setIsConnected(true))
    socket.on('disconnect', () => setIsConnected(false))

    // Listen for real-time ZTA activity logs
    socket.on('zta-activity', (data) => {
      setActivities(prev => {
        const updated = [data, ...prev]
        return updated.length > 50 ? updated.slice(0, 50) : updated
      })
    })

    // Tick the master clock every second based on UI system time (as a proxy for Server Time unless requested)
    const interval = setInterval(() => {
      setServerTime(new Date()) // In production, we'd sync this offset with the server
    }, 1000)

    return () => {
      socket.disconnect()
      clearInterval(interval)
    }
  }, [])

  // Format digital clock
  const timeString = serverTime.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })
  const msString = serverTime.getMilliseconds().toString().padStart(3, '0')

  return (
    <div className="cyber-soc-dashboard">
      <div className="soc-content" style={{ padding: '40px' }}>
        
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '40px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <Cpu size={36} color="var(--cyan)" />
            <div>
              <h1 style={{ margin: 0, fontSize: '24px', letterSpacing: '2px', textTransform: 'uppercase' }}>Security Operations Center</h1>
              <p style={{ margin: 0, color: 'var(--cyan)', fontSize: '12px', letterSpacing: '4px' }}>TEMPORAL ACCESS CONTROL MODULE</p>
            </div>
          </div>
          <div className={`status-pill ${isConnected ? 'active' : 'warning'}`} style={{ fontSize: '12px', padding: '8px 16px' }}>
            <div className="pulse" style={{ width: '8px', height: '8px', background: isConnected ? 'var(--success)' : 'var(--warning)', boxShadow: 'none' }} />
            {isConnected ? 'NODE SOCKET RUNNING' : 'RECONNECTING...'}
          </div>
        </div>

        {/* Main Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '30px' }}>
          
          {/* Left Column: Clock and Flow */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '30px' }}>
            
            {/* System Master Clock Card */}
            <div className="soc-glass-card">
              <div className="soc-title">
                <Clock size={16} color="var(--cyan)" /> System Master Clock
              </div>
              
              <div className="master-clock-container">
                <div className={`master-clock clock-pulse ${officeHoursActive ? 'clock-office-hours' : 'clock-off-hours'}`}>
                  {timeString}<span style={{ fontSize: '32px', opacity: 0.5 }}>.{msString}</span>
                </div>
                <div className="clock-status-label" style={{ color: officeHoursActive ? 'var(--success)' : 'var(--warning)' }}>
                  {officeHoursActive ? '[ Policy: OFFICE_HOURS ] - Standard Routing Active' : '[ Policy: OFF_HOURS ] - Sandbox Segmentation Active'}
                </div>
              </div>
            </div>

            {/* Temporal Traffic Animation */}
            <div className="soc-glass-card" style={{ paddingBottom: '60px' }}>
              <div className="soc-title">
                <Activity size={16} color="var(--cyan)" /> Live Routing Pipeline
              </div>

              <div className="temporal-flow-diagram">
                {/* Gateway */}
                <div className="gateway-node">
                  <div style={{ fontWeight: 800, fontSize: '14px', marginBottom: '8px' }}>ZTA GATEWAY</div>
                  <div style={{ fontSize: '10px', color: 'var(--cyan)' }}>INGRESS 443</div>
                </div>

                {/* Shimmer Barrier (Only rendered during off hours) */}
                {!officeHoursActive && (
                  <div className="shimmer-barrier">
                    <div style={{ position: 'absolute', top: '-40px', left: '-80px', width: '160px', textAlign: 'center', fontSize: '10px', color: 'var(--warning)', fontWeight: 800 }}>TEMPORAL FENCE ACTIVE</div>
                  </div>
                )}

                {/* Animated Paths */}
                {officeHoursActive ? (
                  // Flowing straight to Prod
                  <div className="flow-path office-active" style={{ right: 'auto', width: '400px' }}></div>
                ) : (
                  // Bending down to Sandbox
                  <div className="flow-path off-hours-active" style={{ width: '200px', transform: 'translateY(60px) rotate(20deg)', transformOrigin: 'left' }}></div>
                )}

                {/* Targets */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '60px' }}>
                  <div className="target-node target-prod" style={{ opacity: officeHoursActive ? 1 : 0.3 }}>
                    <div style={{ fontWeight: 800, fontSize: '14px', marginBottom: '8px' }}>PRODUCTION CORE</div>
                    <div style={{ fontSize: '10px', color: 'var(--success)' }}>VLAN 10 • ACTIVE</div>
                  </div>
                  <div className="target-node target-sandbox" style={{ opacity: !officeHoursActive ? 1 : 0.3 }}>
                    <div style={{ fontWeight: 800, fontSize: '14px', marginBottom: '8px' }}>SANDBOX ENCLAVE</div>
                    <div style={{ fontSize: '10px', color: 'var(--warning)' }}>VLAN 50 • ISOLATED</div>
                  </div>
                </div>

              </div>
            </div>

          </div>

          {/* Right Column: Alerts and Tickers */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '30px' }}>
            
            {/* Time-Drift Alert Panel */}
            <div className="soc-glass-card" style={{ padding: 0 }}>
              <div style={{ padding: '20px', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                <div className="soc-title" style={{ margin: 0 }}>
                  <ServerCrash size={16} color="var(--danger)" /> NTP Sync Watch
                </div>
              </div>
              <div style={{ padding: '20px' }}>
                <div className="drift-panel">
                  <Clock size={24} color="var(--info)" />
                  <div>
                    <div style={{ fontSize: '12px', fontWeight: 700, letterSpacing: '1px' }}>DRIFT VARIANCE: 0.04ms</div>
                    <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Synchronized with pool.ntp.org (Strata 2)</div>
                  </div>
                </div>
                <div className="drift-panel alert" style={{ marginTop: '16px', display: 'none' }}>
                  <AlertTriangle size={24} color="var(--danger)" />
                  <div>
                    <div style={{ fontSize: '12px', fontWeight: 700, letterSpacing: '1px', color: 'var(--danger)' }}>CRITICAL DRIFT DETECTED</div>
                    <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Temporal tampering suspected. Locking nodes.</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Event Ticker */}
            <div className="soc-glass-card" style={{ flex: 1, padding: 0, display: 'flex', flexDirection: 'column' }}>
               <div style={{ padding: '20px', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                <div className="soc-title" style={{ margin: 0 }}>
                  <Database size={16} color="var(--cyan)" /> Activity Feed
                </div>
              </div>
              
              <div className="ticker-container" style={{ padding: '20px', maxHeight: '400px' }}>
                {activities.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-muted)', fontSize: '12px' }}>
                    <ShieldAlert size={32} style={{ opacity: 0.3, marginBottom: '10px' }} />
                    <p>Awaiting network events...</p>
                  </div>
                ) : (
                  activities.map((act, idx) => (
                    <div key={act.id || idx} className={`ticker-item ${act.action === 'BLOCKED' ? 'blocked' : act.action === 'SANDBOXED' ? 'sandboxed' : 'verified'}`} style={{ background: 'rgba(0,0,0,0.4)' }}>
                      <div className="ticker-header">
                        <span className={`ticker-action ${act.action === 'BLOCKED' ? 'blocked' : act.action === 'SANDBOXED' ? 'sandboxed' : 'verified'}`}>
                          {act.action === 'SANDBOXED' ? 'ROUTED TO SANDBOX' : act.action === 'BLOCKED' ? 'CONNECTION REFUSED' : 'ACCESS GRANTED'}
                        </span>
                        <span className="ticker-time">{act.timestamp.split('T')[1].substring(0,8)}</span>
                      </div>
                      <div className="ticker-details">{act.details}</div>
                      <div className="ticker-meta">
                        <span>USER: {act.user}</span>
                        <span>IP: {act.location}</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  )
}
