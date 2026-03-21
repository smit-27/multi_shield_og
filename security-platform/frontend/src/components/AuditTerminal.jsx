import React, { useState, useEffect, useRef } from 'react';

const COLORS = {
  base: '#0A0C0F',
  surface: '#0F1217',
  accent: '#3D7EFF',
  borderLight: 'rgba(255,255,255,0.055)',
  textPrimary: '#E8EAF0',
  textSecondary: '#6B7280',
  mono: '#A8B5C8',
  success: '#3D9E6E',
  warning: '#C49A3C',
  danger: '#C4404F'
};

const MOCK_LOGS = [
  { time: '09:41:22', type: 'INFO', msg: 'System initialized. Listening on port 3002.' },
  { time: '09:41:25', type: 'INFO', msg: 'Connected to ZTA Policy Engine (v2.4.1)' },
  { time: '09:45:10', type: 'AUTH', msg: 'User rajesh.kumar authenticated via SSO' },
  { time: '09:45:12', type: 'EVAL', msg: 'Evaluating request: POST /api/transactions/internal' },
  { time: '09:45:13', type: 'WARN', msg: 'Risk score 65 for rajesh.kumar (Unusual time)' },
  { time: '09:45:13', type: 'ACTION', msg: 'Enforcing REQUIRE_MFA policy limit' },
  { time: '09:47:01', type: 'AUTH', msg: 'MFA Step 1 (Password) verified for rajesh.kumar' },
  { time: '09:47:15', type: 'AUTH', msg: 'MFA Step 2 (Face Match) verified (Confidence: 98.2%)' },
  { time: '09:47:22', type: 'AUTH', msg: 'MFA Step 3 (Hex OTP) verified successfully' },
  { time: '09:47:23', type: 'SUCCESS', msg: 'ZTA Session trust level elevated to: HIGH' },
  { time: '10:12:05', type: 'EVAL', msg: 'Evaluating request: POST /api/withdrawals/corporate' },
  { time: '10:12:06', type: 'CRITICAL', msg: 'Risk score 92 for amit.patel (High-value + New IP)' },
  { time: '10:12:06', type: 'ACTION', msg: 'Enforcing ADMIN_APPROVAL policy limit' },
  { time: '10:15:30', type: 'INFO', msg: 'Admin reviewed and REJECTED request #8821' },
  { time: '10:15:31', type: 'ACTION', msg: 'Transaction blocked and logged to forensic vault' },
  { time: '10:22:14', type: 'EVAL', msg: 'Evaluating request: GET /api/customers/CIF-0041' },
  { time: '10:22:15', type: 'SUCCESS', msg: 'Access granted (Risk Score: 12, Policy: ALLOW)' }
];

export default function AuditTerminal() {
  const [logs, setLogs] = useState([]);
  const [isPlaying, setIsPlaying] = useState(true);
  const containerRef = useRef(null);

  useEffect(() => {
    if (!isPlaying) return;
    
    let currentIndex = 0;
    setLogs([]);

    const interval = setInterval(() => {
      setLogs(prev => {
        if (currentIndex < MOCK_LOGS.length) {
          const nextLog = MOCK_LOGS[currentIndex];
          currentIndex++;
          
          // Use timeout to ensure scroll happens after React render
          setTimeout(() => {
            if (containerRef.current) {
              containerRef.current.scrollTop = containerRef.current.scrollHeight;
            }
          }, 0);

          return [...prev, nextLog];
        } else {
          clearInterval(interval);
          return prev;
        }
      });
    }, 800);

    return () => {
      clearInterval(interval);
    };
  }, [isPlaying]);

  const getColor = (type) => {
    switch(type) {
      case 'INFO': return COLORS.textSecondary;
      case 'AUTH': return COLORS.accent;
      case 'EVAL': return COLORS.mono;
      case 'WARN': return COLORS.warning;
      case 'CRITICAL': return COLORS.danger;
      case 'ACTION': return COLORS.warning;
      case 'SUCCESS': return COLORS.success;
      default: return COLORS.textPrimary;
    }
  };

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', backgroundColor: '#050505', fontFamily: 'IBM Plex Mono, monospace' }}>
      <div style={{ padding: '8px 16px', backgroundColor: '#111', borderBottom: `1px solid #222`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: '8px' }}>
          <div style={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: '#ff5f56' }} />
          <div style={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: '#ffbd2e' }} />
          <div style={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: '#27c93f' }} />
        </div>
        <div style={{ fontSize: '12px', color: '#666' }}>root@zta-core:~# tail -f /var/log/zta-engine.log</div>
        <button 
          onClick={() => setIsPlaying(!isPlaying)}
          style={{ background: 'none', border: '1px solid #333', color: '#aaa', padding: '2px 8px', borderRadius: '4px', fontSize: '11px', cursor: 'pointer' }}
        >
          {isPlaying ? 'Pause' : 'Play'}
        </button>
      </div>
      <div 
        ref={containerRef}
        style={{ flex: 1, padding: '16px', overflowY: 'auto', fontSize: '13px', lineHeight: '1.6' }}
        className="custom-scrollbar"
      >
        {logs.map((log, i) => (
          <div key={i} style={{ marginBottom: '4px', display: 'flex', gap: '12px' }}>
            <span style={{ color: '#555', minWidth: '70px' }}>[{log.time}]</span>
            <span style={{ color: getColor(log.type), minWidth: '70px', fontWeight: 'bold' }}>[{log.type}]</span>
            <span style={{ color: '#ccc' }}>{log.msg}</span>
          </div>
        ))}
        {isPlaying && logs.length < MOCK_LOGS.length && (
          <div style={{ color: '#555', marginTop: '8px', animation: 'pulse 1s infinite' }}>_</div>
        )}
      </div>
    </div>
  );
}
