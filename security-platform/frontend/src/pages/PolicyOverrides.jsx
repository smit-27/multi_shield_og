import { useState, useEffect } from 'react'
import { io } from 'socket.io-client'
import { Shield, Activity, Sliders, Database, AlertCircle, Cpu, Zap } from 'lucide-react'

// Backend Defaults
const ZTA_DEFAULTS = {
  amountLimit: 500000,
  criticalRiskScore: 90,
  sandboxRiskScore: 60
}

export default function PolicyOverrides() {
  const [isConnected, setIsConnected] = useState(false)
  const [activities, setActivities] = useState([])
  
  // Sliders State
  const [overrides, setOverrides] = useState({
    amountLimit: ZTA_DEFAULTS.amountLimit,
    criticalRiskScore: ZTA_DEFAULTS.criticalRiskScore,
    sandboxRiskScore: ZTA_DEFAULTS.sandboxRiskScore
  })

  // Check if any override is active
  const isOverrideActive = 
    overrides.amountLimit !== ZTA_DEFAULTS.amountLimit ||
    overrides.criticalRiskScore !== ZTA_DEFAULTS.criticalRiskScore ||
    overrides.sandboxRiskScore !== ZTA_DEFAULTS.sandboxRiskScore;

  useEffect(() => {
    const socket = io('http://localhost:3002')
    socket.on('connect', () => setIsConnected(true))
    socket.on('disconnect', () => setIsConnected(false))

    // Listen for ZTA Live Activity
    socket.on('zta-activity', (data) => {
      setActivities(prev => {
        const updated = [data, ...prev]
        return updated.slice(0, 30)
      })
    })

    return () => socket.disconnect()
  }, [])

  // Sync active overrides to window.localStorage so Demo Test Scripts can pick them up and inject headers
  useEffect(() => {
    if (isOverrideActive) {
      localStorage.setItem('zta-overrides', JSON.stringify(overrides))
    } else {
      localStorage.removeItem('zta-overrides')
    }
  }, [overrides, isOverrideActive])


  const handleReset = () => {
    setOverrides(ZTA_DEFAULTS)
  }

  return (
    <div className="policy-override-dashboard">
      <div className="soc-content" style={{ padding: '40px' }}>
        
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '40px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <Sliders size={36} color="var(--purple)" />
            <div>
              <h1 style={{ margin: 0, fontSize: '24px', letterSpacing: '2px', textTransform: 'uppercase' }}>Dynamic Policy Overrides</h1>
              <p style={{ margin: 0, color: 'var(--purple)', fontSize: '12px', letterSpacing: '4px' }}>LIVE MANIPULATION MATRICES</p>
            </div>
          </div>
          <div className={`status-pill ${isConnected ? 'active' : 'warning'}`} style={{ fontSize: '12px', padding: '8px 16px' }}>
            <div className={`pulse ${isConnected ? 'pulse-green' : 'pulse-amber'}`} style={{ width: '8px', height: '8px', boxShadow: 'none' }} />
            {isConnected ? 'NODE SOCKET LINKED' : 'AWAITING CONNECTION...'}
          </div>
        </div>

        {/* Global Notifications */}
        {isOverrideActive && (
          <div className="override-alert-banner">
            <AlertCircle size={20} />
            <span><strong>POLICY UPDATED:</strong> Temporary override active. Backend defenses are currently suppressed or accelerated.</span>
          </div>
        )}

        <div className="override-grid">
          
          {/* Left: Policy Configurator */}
          <div className="override-panel configurator-panel">
            <div className="panel-header">
              <Activity size={18} color="var(--purple)" />
              <h3>POLICY CONFIGURATOR</h3>
            </div>
            <div className="panel-body">
              <p className="panel-desc">Drag sliders to temporarily rewrite ZTA risk validation thresholds. Injects overlay headers into HTTP proxy stream.</p>
              
              <div className="slider-group">
                <div className="slider-label">
                  <span>Txn Amount Limit</span>
                  <span className={`slider-value ${overrides.amountLimit !== ZTA_DEFAULTS.amountLimit ? 'override-glow-purple' : ''}`}>
                    ₹{overrides.amountLimit.toLocaleString('en-IN')}
                  </span>
                </div>
                <input 
                  type="range" 
                  min="1000" 
                  max="1000000" 
                  step="1000"
                  value={overrides.amountLimit}
                  onChange={(e) => setOverrides({...overrides, amountLimit: parseInt(e.target.value)})}
                  className="cyber-slider purple-slider"
                />
              </div>

              <div className="slider-group">
                <div className="slider-label">
                  <span>Critical Risk (BLOCK)</span>
                  <span className={`slider-value ${overrides.criticalRiskScore !== ZTA_DEFAULTS.criticalRiskScore ? 'override-glow-danger' : ''}`}>
                    {overrides.criticalRiskScore} pts
                  </span>
                </div>
                <input 
                  type="range" 
                  min="1" 
                  max="100" 
                  value={overrides.criticalRiskScore}
                  onChange={(e) => setOverrides({...overrides, criticalRiskScore: parseInt(e.target.value)})}
                  className="cyber-slider danger-slider"
                />
                <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.4)', marginTop: '4px' }}>Scores above trigger immediate blocking.</div>
              </div>

              <div className="slider-group">
                <div className="slider-label">
                  <span>Sandbox Threshold</span>
                  <span className={`slider-value ${overrides.sandboxRiskScore !== ZTA_DEFAULTS.sandboxRiskScore ? 'override-glow-warning' : ''}`}>
                    {overrides.sandboxRiskScore} pts
                  </span>
                </div>
                <input 
                  type="range" 
                  min="1" 
                  max="100" 
                  value={overrides.sandboxRiskScore}
                  onChange={(e) => setOverrides({...overrides, sandboxRiskScore: parseInt(e.target.value)})}
                  className="cyber-slider warning-slider"
                />
                <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.4)', marginTop: '4px' }}>Scores above are routed to VLAN50.</div>
              </div>

              <button className="cyber-btn reset-btn" onClick={handleReset} style={{ marginTop: '20px', width: '100%' }}>
                RESTORE DEFAULTS
              </button>

            </div>
          </div>

          {/* Center: Real-time Traffic visualization */}
          <div className="override-panel traffic-panel" style={{ gridColumn: 'span 2' }}>
            <div className="panel-header">
              <Zap size={18} color="var(--success)" />
              <h3>REAL-TIME RISK TELEMETRY</h3>
            </div>
            <div className="panel-body" style={{ padding: 0 }}>
              <div className="telemetry-graph">
                 {/* Visual Threshold Lines */}
                 <div className="threshold-line block-line" style={{ bottom: `${overrides.criticalRiskScore}%` }}>
                    <span className="line-label">BLOCK THRESHOLD</span>
                 </div>
                 <div className="threshold-line sandbox-line" style={{ bottom: `${overrides.sandboxRiskScore}%` }}>
                    <span className="line-label">SANDBOX THRESHOLD</span>
                 </div>

                 {/* Incoming Request Pulses */}
                 {activities.slice(0,10).map((act, i) => (
                    <div 
                      key={act.id + i} 
                      className={`risk-pulse ${act.action === 'BLOCKED' ? 'pulse-blocked' : act.action === 'SANDBOXED' ? 'pulse-sandboxed' : 'pulse-allowed'}`}
                      style={{ 
                        left: `${(i + 1) * 9}%`, 
                        bottom: `${act.score}%`,
                        animationDelay: `${i * 0.1}s` 
                      }}
                    >
                      <div className="pulse-tooltip">
                        <div>Score: {act.score}</div>
                        <div>User: {act.user}</div>
                      </div>
                    </div>
                 ))}
                 
                 {activities.length === 0 && (
                   <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', opacity: 0.3, letterSpacing: '2px', fontSize: '14px' }}>
                     AWAITING TRAFFIC...
                   </div>
                 )}
              </div>
              <div className="graph-footer">
                <div>Y-Axis: Risk Score (0-100)</div>
                <div style={{ display: 'flex', gap: '16px' }}>
                   <span style={{ color: 'var(--success)' }}>● ALLOWED</span>
                   <span style={{ color: 'var(--warning)' }}>● SANDBOXED</span>
                   <span style={{ color: 'var(--danger)' }}>● BLOCKED</span>
                </div>
              </div>
            </div>
          </div>

          {/* Right: State Comparison */}
          <div className="override-panel state-panel">
            <div className="panel-header">
              <Database size={18} color="var(--info)" />
              <h3>CONFIG STATE</h3>
            </div>
            <div className="panel-body">
              
              <div className={`state-block defaults ${isOverrideActive ? 'dimmed' : 'active'}`}>
                <h4>BACKEND DEFAULTS</h4>
                <div className="state-row"><span>Txn Limit:</span> <span>₹{ZTA_DEFAULTS.amountLimit.toLocaleString('en-IN')}</span></div>
                <div className="state-row"><span>Block Score:</span> <span>{ZTA_DEFAULTS.criticalRiskScore}</span></div>
                <div className="state-row"><span>Sandbox Score:</span> <span>{ZTA_DEFAULTS.sandboxRiskScore}</span></div>
              </div>

              <div style={{ textAlign: 'center', margin: '16px 0', color: 'rgba(255,255,255,0.2)' }}>
                VS
              </div>

              <div className={`state-block overrides ${isOverrideActive ? 'active glow' : 'dimmed'}`}>
                <h4>DEMO OVERRIDES</h4>
                <div className="state-row"><span>Txn Limit:</span> <span>₹{overrides.amountLimit.toLocaleString('en-IN')}</span></div>
                <div className="state-row"><span>Block Score:</span> <span>{overrides.criticalRiskScore}</span></div>
                <div className="state-row"><span>Sandbox Score:</span> <span>{overrides.sandboxRiskScore}</span></div>
              </div>

            </div>
          </div>

        </div>
      </div>
    </div>
  )
}
