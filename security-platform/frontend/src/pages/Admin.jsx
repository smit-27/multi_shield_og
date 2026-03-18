import { useState, useEffect, useRef } from 'react'
import { apiFetch, Icon } from '../App'
import { io } from 'socket.io-client'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, BarChart, Bar, CartesianGrid } from 'recharts'
import { Activity, ShieldAlert, Cpu, Globe, Lock, ShieldCheck, MapPin, Zap } from 'lucide-react'

// Map Recharts to a simple Neon dark theme
const chartColors = {
  verified: '#34d399',
  sandboxed: '#f59e0b',
  blocked: '#f43f5e',
  text: '#a09bb8',
  grid: '#2d2548'
};

export default function Admin() {
  const [activities, setActivities] = useState([])
  const [trafficStats, setTrafficStats] = useState({ verified: 0, sandboxed: 0, blocked: 0 })
  const [riskData, setRiskData] = useState([{ time: 'Now', score: 0 }])
  const [isConnected, setIsConnected] = useState(false)
  const maxEvents = 50;

  useEffect(() => {
    // Connect to Backend Socket.io
    const socket = io('http://localhost:3002')

    socket.on('connect', () => {
      setIsConnected(true)
    })

    socket.on('disconnect', () => {
      setIsConnected(false)
    })

    // Listen for real-time ZTA activity logs
    socket.on('zta-activity', (data) => {
      // Add to event ticker
      setActivities(prev => {
        const updated = [data, ...prev]
        if (updated.length > maxEvents) return updated.slice(0, maxEvents)
        return updated
      })

      // Update counters
      setTrafficStats(prev => {
        let { verified, sandboxed, blocked } = prev;
        if (data.action === 'BLOCKED' || data.action === 'AUTH_LOCKED') blocked += 1;
        else if (data.action === 'SANDBOXED') sandboxed += 1;
        else verified += 1;
        return { verified, sandboxed, blocked }
      })

      // Update live risk chart
      setRiskData(prev => {
        const now = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second:'2-digit' })
        const newPoint = { time: now, score: data.score || 0 }
        const updated = [...prev, newPoint]
        if (updated.length > 15) return updated.slice(updated.length - 15)
        return updated
      })
    })

    return () => socket.disconnect()
  }, [])

  return (
    <div className="obsidian-dashboard">
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <Cpu size={28} color="var(--cyan)" />
            Cyber Security Command Center
          </h2>
          <p>Real-time Zero Trust Architecture Gateway telemetry</p>
        </div>
        <div className={`status-pill ${isConnected ? 'active' : 'warning'}`}>
          <div className="pulse" style={{ width: '8px', height: '8px', background: isConnected ? 'var(--success)' : 'var(--warning)', boxShadow: 'none' }} />
          {isConnected ? 'SENSORS ONLINE' : 'RECONNECTING...'}
        </div>
      </div>

      <div className="obsidian-grid">
        {/* Left Column: Visualizations */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          
          {/* Main Traffic Flow Diagram */}
          <div className="obsidian-card">
            <div className="obsidian-card-header">
              <h3 className="obsidian-title obsidian-title-cyan">
                <Activity size={18} /> ZTA Gateway Traffic Flow
              </h3>
            </div>
            
            <div className="zta-traffic-flow">
              <div className="flow-node">
                <div className="flow-node-title">Security Ingress Router</div>
                <div className="flow-node-subtitle">PORT 3002 • TLS 1.3</div>
              </div>
              
              {/* Downward Lines (CSS representation) */}
              <div style={{ width: '2px', height: '30px', background: 'var(--border-accent)' }}></div>
              
              <div className="flow-split">
                <div className="flow-branch">
                  <div className="flow-stat-box verified">
                    <div className="stat-value">{trafficStats.verified}</div>
                    <div className="stat-label"><ShieldCheck size={12} style={{verticalAlign:'middle', marginRight:'4px'}}/> Verified</div>
                  </div>
                  <div className="flow-node-subtitle">Production Core</div>
                </div>

                <div className="flow-branch">
                  <div className="flow-stat-box sandboxed">
                    <div className="stat-value">{trafficStats.sandboxed}</div>
                    <div className="stat-label"><Globe size={12} style={{verticalAlign:'middle', marginRight:'4px'}}/> Micro-segmented</div>
                  </div>
                  <div className="flow-node-subtitle">Sandbox VLAN</div>
                </div>

                <div className="flow-branch">
                  <div className="flow-stat-box blocked">
                    <div className="stat-value">{trafficStats.blocked}</div>
                    <div className="stat-label"><ShieldAlert size={12} style={{verticalAlign:'middle', marginRight:'4px'}}/> Blocked</div>
                  </div>
                  <div className="flow-node-subtitle">Edge Firewall</div>
                </div>
              </div>
            </div>
          </div>

          {/* Risk Score Heat Map (Line Chart proxy) */}
          <div className="obsidian-card">
            <div className="obsidian-card-header">
              <h3 className="obsidian-title obsidian-title-amber">
                <Zap size={18} /> Aggregate Risk Heat Map
              </h3>
            </div>
            <div style={{ width: '100%', height: '220px' }}>
              <ResponsiveContainer>
                <LineChart data={riskData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={chartColors.grid} vertical={false} />
                  <XAxis dataKey="time" stroke={chartColors.text} fontSize={10} tickMargin={10} />
                  <YAxis stroke={chartColors.text} fontSize={10} domain={[0, 100]} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: 'rgba(23, 17, 42, 0.9)', border: '1px solid var(--border-accent)', borderRadius: '8px' }}
                    itemStyle={{ color: '#fff', fontWeight: 600 }}
                  />
                  <Line type="monotone" dataKey="score" stroke="var(--warning)" strokeWidth={3} dot={{ r: 3, fill: 'var(--warning)', strokeWidth: 0 }} activeDot={{ r: 6 }} animationDuration={300} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

        </div>

        {/* Right Column: Widgets & Logs */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          
          {/* Geographic Kill-Switch Status */}
          <div className="obsidian-card" style={{ padding: '16px 20px' }}>
            <div className="obsidian-card-header" style={{ marginBottom: '12px' }}>
              <h3 className="obsidian-title" style={{ fontSize: '13px' }}>
                <MapPin size={16} color="var(--info)" /> Geo Kill-Switch
              </h3>
              <div className="status-pill active">ARMED</div>
            </div>
            <div style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
              Automatically terminates sessions from non-sanctioned sovereign regions (Non-IN/US/GB).
            </div>
          </div>

          {/* Face-Auth / Account Lockouts */}
          <div className="obsidian-card" style={{ padding: '16px 20px' }}>
            <div className="obsidian-card-header" style={{ marginBottom: '12px' }}>
              <h3 className="obsidian-title" style={{ fontSize: '13px' }}>
                <Lock size={16} color="var(--danger)" /> Step-Up Auth Watch
              </h3>
            </div>
            <div style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
              Continuously monitoring Keycloak MFA and Biometric fallback sensors.
            </div>
          </div>

          {/* Live Event Ticker */}
          <div className="obsidian-card" style={{ flex: 1 }}>
            <div className="obsidian-card-header">
              <h3 className="obsidian-title">
                <Activity size={18} /> Live ZTA Telemetry
              </h3>
            </div>
            
            <div className="ticker-container">
              {activities.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-muted)', fontSize: '12px' }}>
                  <Activity size={32} style={{ opacity: 0.3, marginBottom: '10px' }} />
                  <p>Awaiting network traffic...</p>
                </div>
              ) : (
                activities.map((act, idx) => (
                  <div key={act.id || idx} className={`ticker-item ${act.action === 'BLOCKED' || act.action === 'AUTH_LOCKED' ? 'blocked' : act.action === 'SANDBOXED' ? 'sandboxed' : 'verified'}`}>
                    <div className="ticker-header">
                      <span className={`ticker-action ${act.action === 'BLOCKED' || act.action === 'AUTH_LOCKED' ? 'blocked' : act.action === 'SANDBOXED' ? 'sandboxed' : 'verified'}`}>
                        {act.action === 'AUTH_LOCKED' ? 'ACCOUNT LOCKED' : act.action}
                      </span>
                      <span className="ticker-time">{act.timestamp.split('T')[1].substring(0,8)}</span>
                    </div>
                    <div className="ticker-details">{act.details}</div>
                    <div className="ticker-meta">
                      <span>USER: {act.user}</span>
                      <span>RISK: {act.score}</span>
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
  )
}
