import { useState, useEffect, useRef } from 'react'
import { Terminal, Shield, Play, Pause, X, FastForward } from 'lucide-react'

export default function SessionReplay({ show, sessionData, onClose }) {
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentLine, setCurrentLine] = useState(0)
  const [speed, setSpeed] = useState(1)
  const [logs, setLogs] = useState([])
  const containerRef = useRef(null)

  const defaultLogs = [
    "[00:00:01] SYS: PAW-NODE-IX-4821 connection established.",
    "[00:00:02] SYS: Screen recording telemetry started. Video stream secure.",
    "[00:00:03] VAULT: Injecting privileged credentials for Target System (Customer DB).",
    "[00:00:05] AUTH: Handshake complete. Justification: 'Investigating high-risk alert'.",
    "[00:00:10] USER: Navigated to profile view for Customer ID (Pan: ABCD****F).",
    "[00:00:15] USER: Expanded 'Detailed Transaction History'.",
    "[00:00:32] USER: Interacted with Risk Classification module.",
    "[00:00:43] USER: Clicked 'Force Financial Transfer' tool.",
    "[00:00:55] USER: Entered input: 50,000 INR to Destination: ACC004.",
    "[00:00:58] VAULT: Intercepted privileged API call.",
    "[00:01:02] ZTA: Evaluating contextual risk... (Score: 84 - HIGH RISK).",
    "[00:01:05] ZTA: Triggered Step-Up Authentication (MFA).",
    "[00:01:20] AUTH: MFA verification successful via Security Platform.",
    "[00:01:22] SYS: API Call /api/treasury/transfer executed successfully.",
    "[00:01:30] USER: Session voluntarily terminated."
  ]

  const replayLogs = sessionData?.logs || defaultLogs

  useEffect(() => {
    if (show && isPlaying && currentLine < replayLogs.length) {
      const timer = setTimeout(() => {
        setLogs(prev => [...prev, replayLogs[currentLine]])
        setCurrentLine(c => c + 1)
      }, Math.max(500 / speed, 50)) // Randomize slightly for effect in real app, steady here
      return () => clearTimeout(timer)
    }
  }, [show, isPlaying, currentLine, replayLogs, speed])

  useEffect(() => {
    if (show) {
      setLogs([])
      setCurrentLine(0)
      setIsPlaying(true)
    }
  }, [show])

  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight
    }
  }, [logs])

  if (!show) return null

  return (
    <div className="freeze-overlay" style={{ zIndex: 1100 }}>
      <div className="terminal-window" style={{ background: '#0a0a0a', width: '800px', maxWidth: '95vw', border: '1px solid #333', borderRadius: '8px', display: 'flex', flexDirection: 'column', height: '600px', boxShadow: '0 20px 40px rgba(0,0,0,0.5)' }}>
        
        {/* Terminal Header */}
        <div style={{ background: '#1a1a1a', padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #333', borderTopLeftRadius: '8px', borderTopRightRadius: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ display: 'flex', gap: '6px' }}>
              <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: '#ff5f56', cursor: 'pointer' }} onClick={onClose} />
              <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: '#ffbd2e' }} />
              <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: '#27c93f' }} />
            </div>
            <span style={{ color: '#888', fontSize: '12px', fontFamily: 'monospace', display: 'flex', alignItems: 'center', gap: '6px' }}><Terminal size={14}/> pty-session-replay (Read-Only)</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ color: 'var(--accent)', fontSize: '11px', fontWeight: 'bold', border: '1px solid var(--accent)', padding: '2px 6px', borderRadius: '4px' }}>VERIFIED SECURE RECORDING</span>
          </div>
        </div>

        {/* Playback Controls */}
        <div style={{ background: '#111', padding: '10px 16px', borderBottom: '1px solid #222', display: 'flex', justifyContent: 'center', gap: '20px' }}>
          <button onClick={() => setIsPlaying(!isPlaying)} style={{ background: 'transparent', border: 'none', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}>
            {isPlaying ? <Pause size={16}/> : <Play size={16}/>} {isPlaying ? 'PAUSE' : 'PLAY'}
          </button>
          <button onClick={() => setSpeed(s => s >= 4 ? 1 : s * 2)} style={{ background: 'transparent', border: 'none', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <FastForward size={16}/> {speed}x SPEED
          </button>
        </div>

        {/* Terminal Body */}
        <div ref={containerRef} style={{ flex: 1, padding: '20px', overflowY: 'auto', fontFamily: '"Courier New", Courier, monospace', fontSize: '14px', lineHeight: '1.6', color: '#00ff00', textShadow: '0 0 2px rgba(0,255,0,0.4)' }}>
          <div style={{ color: '#888', marginBottom: '20px' }}>
            MultiShield Security Vault - Session Replay Engine v2.1.4<br/>
            Target: Customer Database (ID: ACC00X)<br/>
            Loading encrypted telemetry chunks... [OK]<br/>
            Decrypting keystroke payloads... [OK]<br/>
            Starting playback...<br/>
            ========================================================================
          </div>

          {logs.map((log, i) => (
            <div key={i} style={{ marginBottom: '8px', wordBreak: 'break-all' }}>
              {log.includes('SYS:') ? <span style={{color: '#aaa'}}>{log}</span> :
               log.includes('USER:') ? <span style={{color: '#00ff00'}}>{log}</span> :
               log.includes('VAULT:') ? <span style={{color: '#ffbd2e'}}>{log}</span> :
               log.includes('ZTA:') ? <span style={{color: '#ff5f56'}}>{log}</span> : log}
            </div>
          ))}

          {currentLine === replayLogs.length && (
            <div style={{ color: '#888', marginTop: '20px' }}>
              ========================================================================<br/>
              Playback finished (EOF).<br/>
              <button 
                onClick={onClose}
                style={{ marginTop: '16px', background: '#333', color: '#fff', border: 'none', padding: '6px 16px', cursor: 'pointer', borderRadius: '4px' }}
              >
                Close Reviewer
              </button>
            </div>
          )}
          {/* Blinking cursor */}
          {currentLine < replayLogs.length && <span style={{ animation: 'blink 1s step-end infinite' }}>_</span>}
        </div>
      </div>
    </div>
  )
}
