import { useState, useEffect } from 'react'
import { io } from 'socket.io-client'

const ZTA_DEFAULTS = {
  amountLimit: 500000,
  criticalRiskScore: 90,
  sandboxRiskScore: 60
}

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

export default function PolicyOverrides() {
  const [isConnected, setIsConnected] = useState(false)
  const [activities, setActivities] = useState([])
  
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
        return updated.slice(0, 30) // Keep last 30
      })
    })

    return () => socket.disconnect()
  }, [])

  // Sync active overrides to window.localStorage
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
    <div className="flex-1 flex flex-col h-full w-full">
      
      {/* ── Header Section ── */}
      <header style={{ padding: '32px 40px', borderBottom: `1px solid ${COLORS.border}`, backgroundColor: COLORS.base }}>
        <div className="flex justify-between items-baseline mb-2">
          <div>
            <h1 className="font-syne" style={{ fontSize: '28px', fontWeight: 700, letterSpacing: '-0.02em', color: COLORS.textPrimary, margin: 0 }}>Dynamic Policy Overrides</h1>
            <p style={{ fontSize: '15px', color: COLORS.textSecondary, margin: '8px 0 0 0' }}>LIVE MANIPULATION MATRICES</p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 12px', backgroundColor: isConnected ? 'rgba(52,168,83,0.1)' : 'rgba(196,64,79,0.1)', border: `1px solid ${isConnected ? COLORS.low : COLORS.high}` }}>
            <div style={{ width: '6px', height: '6px', backgroundColor: isConnected ? COLORS.low : COLORS.high }}></div>
            <span className="font-mono" style={{ fontSize: '11px', fontWeight: 600, color: isConnected ? COLORS.low : COLORS.high, textTransform: 'uppercase' }}>
              {isConnected ? 'NODE SOCKET LINKED' : 'AWAITING CONNECTION...'}
            </span>
          </div>
        </div>
      </header>

      {/* Global Notifications */}
      {isOverrideActive && (
        <div style={{ backgroundColor: 'rgba(183,134,11,0.1)', border: `1px solid ${COLORS.medium}`, padding: '16px', marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ padding: '4px', backgroundColor: COLORS.medium, color: '#000', fontSize: '10px', fontWeight: 700, letterSpacing: '0.04em' }}>ALERT</div>
          <span style={{ fontSize: '13px', color: COLORS.textPrimary }}><strong>POLICY UPDATED:</strong> Temporary override active. Backend defenses are currently altered.</span>
        </div>
      )}

      {/* Main Grid */}
      <div className="flex gap-8 items-start h-[500px]" style={{ padding: '32px 40px' }}>
        
        {/* Left: Policy Configurator (30%) */}
        <section style={{ width: '30%', backgroundColor: COLORS.surface, border: `1px solid ${COLORS.border}`, display: 'flex', flexDirection: 'column', height: '100%' }}>
          <div style={{ padding: '24px 32px', borderBottom: `1px solid ${COLORS.border}` }}>
            <h3 className="font-syne" style={{ fontSize: '14px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.12em', color: COLORS.textTertiary, margin: 0 }}>Policy Configurator</h3>
            <p style={{ fontSize: '13px', color: COLORS.textSecondary, marginTop: '8px', marginBottom: 0 }}>Rewrite ZTA thresholds in real-time.</p>
          </div>
          <div style={{ padding: '24px', flex: 1, display: 'flex', flexDirection: 'column', gap: '32px' }}>
            
            <div className="flex flex-col gap-2">
              <div className="flex justify-between items-end">
                <span style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', color: COLORS.textPrimary }}>Txn Amount Limit</span>
                <span className="font-mono" style={{ fontSize: '13px', color: overrides.amountLimit !== ZTA_DEFAULTS.amountLimit ? COLORS.accent : '#fff' }}>
                  ₹{overrides.amountLimit.toLocaleString('en-IN')}
                </span>
              </div>
              <input 
                type="range" min="1000" max="1000000" step="1000"
                value={overrides.amountLimit}
                onChange={(e) => setOverrides({...overrides, amountLimit: parseInt(e.target.value)})}
                style={{ width: '100%', accentColor: COLORS.accent, height: '4px', backgroundColor: COLORS.elevated, cursor: 'pointer' }}
              />
            </div>

            <div className="flex flex-col gap-2">
              <div className="flex justify-between items-end">
                <span style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', color: COLORS.textPrimary }}>Critical Risk (BLOCK)</span>
                <span className="font-mono" style={{ fontSize: '13px', color: overrides.criticalRiskScore !== ZTA_DEFAULTS.criticalRiskScore ? COLORS.high : '#fff' }}>
                  {overrides.criticalRiskScore} pts
                </span>
              </div>
              <input 
                type="range" min="1" max="100" 
                value={overrides.criticalRiskScore}
                onChange={(e) => setOverrides({...overrides, criticalRiskScore: parseInt(e.target.value)})}
                style={{ width: '100%', accentColor: COLORS.high, height: '4px', backgroundColor: COLORS.elevated, cursor: 'pointer' }}
              />
              <div style={{ fontSize: '10px', color: COLORS.textSecondary }}>Scores above trigger immediate blocking.</div>
            </div>

            <div className="flex flex-col gap-2">
              <div className="flex justify-between items-end">
                <span style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', color: COLORS.textPrimary }}>Sandbox Risk</span>
                <span className="font-mono" style={{ fontSize: '13px', color: overrides.sandboxRiskScore !== ZTA_DEFAULTS.sandboxRiskScore ? COLORS.medium : '#fff' }}>
                  {overrides.sandboxRiskScore} pts
                </span>
              </div>
              <input 
                type="range" min="1" max="100" 
                value={overrides.sandboxRiskScore}
                onChange={(e) => setOverrides({...overrides, sandboxRiskScore: parseInt(e.target.value)})}
                style={{ width: '100%', accentColor: COLORS.medium, height: '4px', backgroundColor: COLORS.elevated, cursor: 'pointer' }}
              />
              <div style={{ fontSize: '10px', color: COLORS.textSecondary }}>Scores above are isolated to sandbox.</div>
            </div>

            <button 
              onClick={handleReset} 
              style={{ marginTop: 'auto', width: '100%', padding: '12px', backgroundColor: 'transparent', color: COLORS.textPrimary, border: `1px solid ${COLORS.border}`, fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', cursor: 'pointer' }}
              onMouseEnter={(e) => e.target.style.backgroundColor = COLORS.elevated}
              onMouseLeave={(e) => e.target.style.backgroundColor = 'transparent'}
            >
              RESTORE DEFAULTS
            </button>
          </div>
        </section>

        {/* Center: Real-time Traffic visualization (45%) */}
        <section style={{ width: '45%', backgroundColor: COLORS.surface, border: `1px solid ${COLORS.border}`, display: 'flex', flexDirection: 'column', height: '100%' }}>
          <div style={{ padding: '24px 32px', borderBottom: `1px solid ${COLORS.border}` }}>
            <h3 className="font-syne" style={{ fontSize: '14px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.12em', color: COLORS.textTertiary, margin: 0 }}>Real-time Risk Telemetry</h3>
          </div>
          <div style={{ flex: 1, position: 'relative', overflow: 'hidden', borderBottom: `1px solid ${COLORS.border}`, backgroundColor: COLORS.base }}>
             
             {/* Threshold Lines */}
             <div style={{ position: 'absolute', bottom: `${overrides.criticalRiskScore}%`, left: 0, right: 0, borderBottom: `1px dashed ${COLORS.high}`, zIndex: 10 }}>
                <span className="font-mono" style={{ position: 'absolute', right: '8px', bottom: '2px', fontSize: '9px', color: COLORS.high }}>BLOCK</span>
             </div>
             <div style={{ position: 'absolute', bottom: `${overrides.sandboxRiskScore}%`, left: 0, right: 0, borderBottom: `1px dashed ${COLORS.medium}`, zIndex: 10 }}>
                <span className="font-mono" style={{ position: 'absolute', right: '8px', bottom: '2px', fontSize: '9px', color: COLORS.medium }}>SANDBOX</span>
             </div>

             {/* Dynamic Activity Points */}
             {activities.slice(0, 15).map((act, i) => {
               const actColor = act.action === 'BLOCKED' ? COLORS.high : act.action === 'SANDBOXED' ? COLORS.medium : COLORS.low;
               return (
                 <div
                   key={act.id + i}
                   style={{
                     position: 'absolute',
                     left: `${8 + (i * 6)}%`,
                     bottom: `${act.score}%`,
                     width: '6px',
                     height: '6px',
                     backgroundColor: actColor,
                     zIndex: 20,
                     transform: 'translate(-50%, 50%)'
                   }}
                   title={`Score: ${act.score} | User: ${act.user}`}
                 >
                 </div>
               );
             })}

             {activities.length === 0 && (
               <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', opacity: 0.5, letterSpacing: '0.08em', fontSize: '11px', color: COLORS.textSecondary, textTransform: 'uppercase' }}>
                 AWAITING TRAFFIC...
               </div>
             )}
          </div>
          <div style={{ padding: '16px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontSize: '10px', color: COLORS.textSecondary, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Y-Axis: Risk Score (0-100)</div>
            <div style={{ display: 'flex', gap: '16px' }}>
               <span style={{ fontSize: '10px', fontWeight: 600, color: COLORS.low }}><span style={{ color: COLORS.low }}>■</span> ALLOWED</span>
               <span style={{ fontSize: '10px', fontWeight: 600, color: COLORS.medium }}><span style={{ color: COLORS.medium }}>■</span> SANDBOXED</span>
               <span style={{ fontSize: '10px', fontWeight: 600, color: COLORS.high }}><span style={{ color: COLORS.high }}>■</span> BLOCKED</span>
            </div>
          </div>
        </section>

        {/* Right: State Comparison (25%) */}
        <section style={{ width: '25%', backgroundColor: COLORS.surface, border: `1px solid ${COLORS.border}`, display: 'flex', flexDirection: 'column', height: '100%' }}>
          <div style={{ padding: '24px 32px', borderBottom: `1px solid ${COLORS.border}` }}>
            <h3 className="font-syne" style={{ fontSize: '14px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.12em', color: COLORS.textTertiary, margin: 0 }}>Config State</h3>
          </div>
          <div style={{ padding: '24px', flex: 1, display: 'flex', flexDirection: 'column', gap: '24px' }}>
            
            <div style={{ padding: '16px', backgroundColor: isOverrideActive ? 'transparent' : COLORS.elevated, border: `1px solid ${COLORS.border}`, opacity: isOverrideActive ? 0.5 : 1 }}>
              <h4 style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.08em', color: COLORS.textSecondary, margin: '0 0 16px 0' }}>BACKEND DEFAULTS</h4>
              <div className="flex justify-between items-center mb-2">
                <span style={{ fontSize: '11px', color: COLORS.textSecondary }}>Txn Limit</span>
                <span className="font-mono" style={{ fontSize: '12px', color: '#fff' }}>₹{ZTA_DEFAULTS.amountLimit.toLocaleString('en-IN')}</span>
              </div>
              <div className="flex justify-between items-center mb-2">
                <span style={{ fontSize: '11px', color: COLORS.textSecondary }}>Block Score</span>
                <span className="font-mono" style={{ fontSize: '12px', color: '#fff' }}>{ZTA_DEFAULTS.criticalRiskScore}</span>
              </div>
              <div className="flex justify-between items-center">
                <span style={{ fontSize: '11px', color: COLORS.textSecondary }}>Sandbox Score</span>
                <span className="font-mono" style={{ fontSize: '12px', color: '#fff' }}>{ZTA_DEFAULTS.sandboxRiskScore}</span>
              </div>
            </div>

            <div style={{ textAlign: 'center', fontSize: '11px', color: COLORS.border, fontWeight: 700 }}>VS</div>

            <div style={{ padding: '16px', backgroundColor: isOverrideActive ? COLORS.elevated : 'transparent', border: `1px solid ${isOverrideActive ? COLORS.accent : COLORS.border}`, opacity: isOverrideActive ? 1 : 0.5 }}>
              <h4 style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.08em', color: isOverrideActive ? COLORS.accent : COLORS.textSecondary, margin: '0 0 16px 0' }}>DEMO OVERRIDES</h4>
              <div className="flex justify-between items-center mb-2">
                <span style={{ fontSize: '11px', color: COLORS.textSecondary }}>Txn Limit</span>
                <span className="font-mono" style={{ fontSize: '12px', color: '#fff' }}>₹{overrides.amountLimit.toLocaleString('en-IN')}</span>
              </div>
              <div className="flex justify-between items-center mb-2">
                <span style={{ fontSize: '11px', color: COLORS.textSecondary }}>Block Score</span>
                <span className="font-mono" style={{ fontSize: '12px', color: '#fff' }}>{overrides.criticalRiskScore}</span>
              </div>
              <div className="flex justify-between items-center">
                <span style={{ fontSize: '11px', color: COLORS.textSecondary }}>Sandbox Score</span>
                <span className="font-mono" style={{ fontSize: '12px', color: '#fff' }}>{overrides.sandboxRiskScore}</span>
              </div>
            </div>

          </div>
        </section>

      </div>
    </div>
  )
}
