import { useState, useEffect } from 'react'
import { io } from 'socket.io-client'
import { Activity, Clock, Sliders, ShieldAlert, Cpu, Network, Zap } from 'lucide-react'

// Backend Defaults
const ZTA_DEFAULTS = {
  amountLimit: 500000,
  riskTolerance: 60 // Anything above is sandboxed/blocked depending on rules
}

export default function PredictiveIsolation() {
  const [isConnected, setIsConnected] = useState(false)
  const [activities, setActivities] = useState([])
  const [selectedActivity, setSelectedActivity] = useState(null)
  
  // Custom Overrides 
  const [overrides, setOverrides] = useState({
    temporalOverride: 15, // Default 3:00 PM (15:00)
    amountLimit: ZTA_DEFAULTS.amountLimit,
    riskTolerance: ZTA_DEFAULTS.riskTolerance
  })

  // Check if any override is active
  const isOverrideActive = 
    overrides.temporalOverride !== 15 || // Default normal hour for demo
    overrides.amountLimit !== ZTA_DEFAULTS.amountLimit ||
    overrides.riskTolerance !== ZTA_DEFAULTS.riskTolerance;

  useEffect(() => {
    const socket = io('http://127.0.0.1:3002')
    socket.on('connect', () => setIsConnected(true))
    socket.on('disconnect', () => setIsConnected(false))

    socket.on('zta-activity', (data) => {
      setActivities(prev => {
        const updated = [data, ...prev].slice(0, 50)
        return updated
      })
      // Auto-select latest activity for XAI panel if none selected
      setSelectedActivity(data)
    })

    return () => socket.disconnect()
  }, [])

  // Sync to local storage for dummy-banking injection
  useEffect(() => {
    if (isOverrideActive) {
      localStorage.setItem('zta-overrides', JSON.stringify({
          temporalOverride: overrides.temporalOverride,
          amountLimit: overrides.amountLimit,
          sandboxRiskScore: overrides.riskTolerance
      }))
    } else {
      localStorage.removeItem('zta-overrides')
    }
  }, [overrides, isOverrideActive])


  const formatTime = (hour) => {
    const ampm = hour >= 12 ? 'PM' : 'AM'
    const h = hour % 12 || 12
    return `${h.toString().padStart(2, '0')}:00 ${ampm}`
  }

  return (
    <div className="predictive-dashboard geometric-bg">
      <div className="soc-content" style={{ padding: '30px', height: '100%', display: 'flex', flexDirection: 'column' }}>
        
        {/* Header Ribbon */}
        <div className="pred-header">
          <div className="pred-title">
            <Network className="neon-cyan" size={32} />
            <div>
              <h1>PREDICTIVE ISOLATION & DYNAMIC CONTROL</h1>
              <p>ZTA MICRO-SEGMENTATION SIMULATION ENGINE</p>
            </div>
          </div>
          <div className={`status-pill ${isConnected ? 'active' : 'warning'}`}>
            <div className={`pulse ${isConnected ? 'pulse-cyan' : 'pulse-amber'}`} />
            {isConnected ? 'NODE CONNECTED' : 'AWAITING NODE...'}
          </div>
        </div>

        {/* Top: Temporal & Policy Overrides */}
        <div className="pred-panel override-strap">
          <div className="strap-controls">
            
            <div className="strap-group temporal-group">
              <div className="strap-label">
                <Clock size={16} className="neon-amber" />
                <span>TEMPORAL SIMULATION STRAP</span>
                <span className={`sim-value ${overrides.temporalOverride < 8 || overrides.temporalOverride > 18 ? 'glow-amber' : 'glow-cyan'}`}>
                  {formatTime(overrides.temporalOverride)}
                  {overrides.temporalOverride < 8 || overrides.temporalOverride > 18 ? ' (OFF-HOURS)' : ''}
                </span>
              </div>
              <input 
                type="range" min="0" max="23" step="1"
                value={overrides.temporalOverride}
                onChange={(e) => setOverrides({...overrides, temporalOverride: parseInt(e.target.value)})}
                className="cyber-slider cyan-slider"
              />
            </div>

            <div className="strap-group config-group">
               <div className="strap-label">
                 <Sliders size={16} className="neon-purple" />
                 <span>Min Amount Threshold (₹)</span>
               </div>
               <input 
                type="range" min="1000" max="1000000" step="1000"
                value={overrides.amountLimit}
                onChange={(e) => setOverrides({...overrides, amountLimit: parseInt(e.target.value)})}
                className="cyber-slider purple-slider"
               />
               <div className="strap-subval">₹{overrides.amountLimit.toLocaleString('en-IN')}</div>
            </div>

            <div className="strap-group config-group">
               <div className="strap-label">
                 <ShieldAlert size={16} className="neon-danger" />
                 <span>Risk Tolerance (%)</span>
               </div>
               <input 
                type="range" min="10" max="100" step="5"
                value={overrides.riskTolerance}
                onChange={(e) => setOverrides({...overrides, riskTolerance: parseInt(e.target.value)})}
                className="cyber-slider danger-slider"
               />
               <div className="strap-subval">{overrides.riskTolerance}%</div>
            </div>

            {isOverrideActive && (
                <div className="demo-override-badge pulse-purple">
                  DEMO OVERRIDE ACTIVE
                </div>
            )}
          </div>
        </div>

        <div className="pred-grid">
          
          {/* Left: Explainable AI Panel */}
          <div className="pred-panel xai-panel">
            <div className="panel-hdr">
              <Cpu size={18} className="neon-cyan" />
              <h3>AI DECISION EXPLAINER</h3>
            </div>
            <div className="panel-bd">
               {!selectedActivity ? (
                 <div className="empty-state">Awaiting traffic for analysis...</div>
               ) : (
                 <div className="xai-content">
                    <div className="xai-target">
                       <div>USER: {selectedActivity.user}</div>
                       <div>ACTION: {selectedActivity.details?.split(' ')[1] || 'Web Action'}</div>
                    </div>
                    
                    <div className="xai-score-ring">
                       <svg viewBox="0 0 36 36" className={`circular-chart ${selectedActivity.score > overrides.riskTolerance ? 'orange' : 'green'}`}>
                         <path className="circle-bg"
                           d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                         />
                         <path className="circle" strokeDasharray={`${selectedActivity.score}, 100`}
                           d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                         />
                         <text x="18" y="20.35" className="percentage">{selectedActivity.score}%</text>
                       </svg>
                       <div className="xai-score-lbl">Risk Prediction</div>
                    </div>

                    <div className="xai-factors">
                       {(selectedActivity.extraPayload && selectedActivity.extraPayload.factors && selectedActivity.extraPayload.factors.length > 0) ? 
                         selectedActivity.extraPayload.factors.map((f, i) => (
                         <div key={i} className="fa-bar-group">
                           <div className="fa-label">
                             <span>{f.factor}</span>
                             <span>{f.score} / {f.maxScore}</span>
                           </div>
                           <div className="fa-track">
                             <div className={`fa-fill ${f.score > 15 ? 'danger' : 'warning'}`} style={{ width: `${(f.score / f.maxScore) * 100}%` }}></div>
                           </div>
                         </div>
                       )) : <div style={{opacity:0.5, fontSize:'12px', marginTop:'20px'}}>No granular factors extracted (Base Network Traffic).</div>}
                    </div>
                 </div>
               )}
            </div>
          </div>

          {/* Center: Live Traffic & Micro-segmentation Map */}
          <div className="pred-panel map-panel">
            <div className="panel-hdr">
               <Activity size={18} className="neon-green" />
               <h3>LIVE MICRO-SEGMENTATION TOPOLOGY</h3>
            </div>
            <div className="topology-viewport">
                
                {/* Production Core Boundaries */}
                <div className="prod-core">
                  <div className="core-label">PRODUCTION NETWORK CORE</div>
                  <div className="core-shield-pulse"></div>
                </div>

                {/* Sandbox VLAN Barrier */}
                <div className="sandbox-barrier">
                  <div className="barrier-glow"></div>
                  <div className="sandbox-vlan">
                     <div className="vlan-label">SANDBOX ENVIRONMENT<br/><span style={{fontSize:'10px', color:'var(--amber)', opacity: 0.8}}>READ-ONLY VLAN</span></div>
                  </div>
                </div>

                {/* Simulated Streams */}
                {activities.slice(0, 5).map((act, i) => {
                    const isSandboxed = act.score > overrides.riskTolerance;
                    return (
                      <div key={act.id + i} 
                        className={`stream-packet ${isSandboxed ? 'path-sandbox' : 'path-core'}`}
                        style={{ animationDelay: `${i * 0.4}s` }}
                        onClick={() => setSelectedActivity(act)}
                      >
                         <div className={`packet-dot ${isSandboxed ? 'dot-amber' : 'dot-green'}`}></div>
                         <div className="packet-meta">
                           USER: {act.user} | SCORE: {act.score}%
                         </div>
                      </div>
                    )
                })}

            </div>
          </div>
        </div>

        {/* Bottom: Activity Ticker */}
        <div className="pred-panel ticker-panel">
          <div className="ticker-label">
            <Zap size={14} className="neon-cyan" />
            LIVE SOC LOGS
          </div>
          <div className="ticker-scroll">
            {activities.length === 0 && <div className="ticker-empty">Waiting for network stream interception...</div>}
            {activities.map((act, i) => (
              <div key={act.id + i} className={`ticker-item ${act.action === 'BLOCKED' || act.action === 'SANDBOXED' ? 'ticker-alert' : 'ticker-info'}`}>
                 <span className="ticker-time">{new Date(act.timestamp).toLocaleTimeString()}</span>
                 <span className="ticker-level">{act.action === 'SANDBOXED' ? '[ALERT]' : act.action === 'BLOCKED' ? '[CRITICAL]' : '[INFO]'}</span>
                 <span className="ticker-msg">
                   {act.message} (User: {act.user}) | Risk: {act.score}% 
                   {act.action === 'SANDBOXED' ? ' - Action diverted to Sandbox.' : ''}
                 </span>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  )
}
