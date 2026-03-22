import { useState, useEffect, useRef } from 'react'
import { ShieldAlert, ShieldCheck, Ban, Shield, AlertTriangle, MessageSquare } from 'lucide-react'
import { io as ioClient } from 'socket.io-client'

const SECURITY_PLATFORM_URL = 'http://127.0.0.1:3002'
const SECURITY_FRONTEND_URL = 'http://127.0.0.1:5174'

export default function FreezeOverlay({ mode, data, onResolved, onDenied }) {
  const [timeLeft, setTimeLeft] = useState(30 * 60) // 30 minutes
  const [message, setMessage] = useState('')
  const [messageSent, setMessageSent] = useState(false)
  const [status, setStatus] = useState('pending')
  const [adminResponse, setAdminResponse] = useState('')
  const [sending, setSending] = useState(false)
  const pollRef = useRef(null)
  const popupRef = useRef(null)
  const socketRef = useRef(null)
  
  // Prevent stale closures
  const onResolvedRef = useRef(onResolved)
  const onDeniedRef = useRef(onDenied)
  useEffect(() => {
    onResolvedRef.current = onResolved
    onDeniedRef.current = onDenied
  }, [onResolved, onDenied])

  // Real-time Socket.io listener for instant admin decisions
  useEffect(() => {
    if (status !== 'pending') return
    if (mode !== 'admin' && mode !== 'mfa_escalated') return
    if (!data?.request_id) return

    const socket = ioClient(SECURITY_PLATFORM_URL, { transports: ['websocket', 'polling'] })
    socketRef.current = socket

    socket.on('approval-decision', (event) => {
      // Match by request_id (approval_requests.id)
      if (event.request_id == data.request_id) {
        if (event.decision === 'approved') {
          setStatus('approved')
          setAdminResponse(event.admin_response || '')
          setTimeout(() => onResolvedRef.current?.(), 2500)
        } else if (event.decision === 'denied') {
          setStatus('denied')
          setAdminResponse(event.admin_response || 'No reason provided')
        }
      }
    })

    return () => {
      socket.disconnect()
      socketRef.current = null
    }
  }, [mode, data, status])

  // Poll for status updates (fallback if Socket.io fails)
  useEffect(() => {
    if (status !== 'pending') return

    const pollStatus = async () => {
      try {
        if (mode === 'mfa' && data?.challenge_id) {
          const res = await fetch(`${SECURITY_PLATFORM_URL}/api/mfa/${data.challenge_id}`)
          const result = await res.json()
          if (result.status === 'completed') {
            setStatus('completed')
            if (popupRef.current) popupRef.current.close()
            setTimeout(() => onResolvedRef.current?.(), 2500)
          } else if (result.status === 'failed') {
            setStatus('failed')
            if (popupRef.current) popupRef.current.close()
          } else if (result.status === 'denied') {
            setStatus('denied')
            setAdminResponse(result.message || 'Action permanently blocked by Zero Trust Architecture due to risk profile.')
            if (popupRef.current) popupRef.current.close()
          }
        } else if ((mode === 'admin' || mode === 'mfa_escalated') && data?.request_id) {
          const res = await fetch(`${SECURITY_PLATFORM_URL}/api/approvals/check/${data.request_id}`)
          const result = await res.json()
          if (result.status === 'approved') {
            setStatus('approved')
            setAdminResponse(result.admin_response || '')
            setTimeout(() => onResolvedRef.current?.(), 2500)
          } else if (result.status === 'denied') {
            setStatus('denied')
            setAdminResponse(result.admin_response || 'No reason provided')
          }
        }
      } catch (err) {
        console.error('Poll error:', err)
      }
    }

    pollRef.current = setInterval(pollStatus, 3000)
    return () => clearInterval(pollRef.current)
  }, [mode, data, status])

  // Countdown timer for admin mode and escalated MFA mode
  useEffect(() => {
    if (mode !== 'admin' && mode !== 'mfa_escalated' && !(mode === 'mfa' && status === 'failed')) return
    
    // Only start timer if we don't already have one running for this state
    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 0) {
          clearInterval(timer)
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => clearInterval(timer)
  }, [mode, status])

  const formatTime = (seconds) => {
    const m = Math.floor(seconds / 60)
    const s = seconds % 60
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
  }

  const openMfa = () => {
    if (data?.challenge_id) {
      popupRef.current = window.open(`${SECURITY_FRONTEND_URL}/mfa/${data.challenge_id}`, 'mfa_popup', 'width=600,height=700')
    }
  }

  const sendMessage = async () => {
    if (!message.trim() || !data?.request_id) return
    setSending(true)
    try {
      await fetch(`${SECURITY_PLATFORM_URL}/api/approvals/${data.request_id}/message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: message.trim() })
      })
      setMessageSent(true)
      setMessage('')
    } catch (err) {
      console.error('Failed to send message:', err)
    } finally {
      setSending(false)
    }
  }

  // Resolved/approved state
  if (status === 'completed' || status === 'approved') {
    return (
      <div className="freeze-overlay">
        <div className="freeze-content resolved">
          <div className="freeze-icon"><ShieldCheck size={56} color="var(--success)" /></div>
          <h2>{status === 'completed' ? 'MFA Verification Successful' : 'Action Approved by Admin'}</h2>
          {adminResponse && <p className="admin-response">Admin: "{adminResponse}"</p>}
          <p className="freeze-subtitle">Unfreezing your session... You may now continue.</p>
          <div className="freeze-progress-bar"><div className="freeze-progress-fill resolved" /></div>
          <button className="btn btn-primary" style={{marginTop: '20px', width: '100%'}} onClick={() => onResolvedRef.current?.()}>Continue to app</button>
        </div>
      </div>
    )
  }

  // Denied state
  if (status === 'denied') {
    return (
      <div className="freeze-overlay denied">
        <div className="freeze-content denied">
          <div className="freeze-icon"><Ban size={56} color="var(--danger)" /></div>
          <h2>Action Denied by Admin</h2>
          <p className="admin-response">"{adminResponse}"</p>
          <p className="freeze-subtitle">This action has been permanently blocked. Contact your security administrator for more information.</p>
          <button className="btn btn-outline freeze-close-btn" onClick={() => onDeniedRef.current?.()}>Close</button>
        </div>
      </div>
    )
  }

  // MFA failed → escalated
  if (status === 'failed' && mode === 'mfa') {
    return (
      <div className="freeze-overlay">
        <div className="freeze-content escalated">
          <div className="freeze-icon pulse-icon"><AlertTriangle size={56} color="var(--danger)" /></div>
          <h2>Verification Failed — System Locked</h2>
          <p className="freeze-subtitle">Your identity could not be securely verified. This action has been escalated. The system is locked for 30 minutes pending admin review.</p>
          
          <div className="countdown-container" style={{ margin: '20px 0' }}>
            <div className="countdown-label">System Lockout Timer</div>
            <div className="countdown-timer">{formatTime(timeLeft)}</div>
            <div className="countdown-bar">
              <div className="countdown-fill danger" style={{ width: `${(timeLeft / (30 * 60)) * 100}%`, backgroundColor: 'var(--danger-color)' }} />
            </div>
          </div>

        </div>
      </div>
    )
  }

  return (
    <div className="freeze-overlay">
      <div className="freeze-content">
        {/* MFA Mode */}
        {mode === 'mfa' && (
          <>
            <div className="freeze-icon pulse-icon"><ShieldAlert size={48} color="var(--accent)" /></div>
            <h2>Multi-Factor Authentication Required</h2>
            <p className="freeze-subtitle">Your banking session is temporarily frozen. Complete MFA verification on the Security Platform to continue.</p>
            
            <div className="freeze-details">
              <div className="freeze-detail-row">
                <span>Reason</span>
                <span>{data?.message || data?.reason}</span>
              </div>
            </div>

            <button className="btn btn-primary freeze-action-btn" onClick={openMfa}>
              <Shield size={18} /> Open Security Platform for MFA
            </button>
            <p className="freeze-hint">A new window will open. Complete all 4 verification steps to unfreeze your session.</p>
          </>
        )}

        {/* Admin Approval Mode */}
        {(mode === 'admin' || mode === 'mfa_escalated') && (
          <>
            <div className="freeze-icon pulse-icon"><AlertTriangle size={48} color="var(--danger)" /></div>
            <h2>Pending Admin Approval</h2>
            <p className="freeze-subtitle">This action has been temporarily blocked due to security verification. System locked pending security approval (up to 30 minutes).</p>

            <div className="countdown-container">
              <div className="countdown-label">Time Remaining</div>
              <div className="countdown-timer">{formatTime(timeLeft)}</div>
              <div className="countdown-bar">
                <div className="countdown-fill" style={{ width: `${(timeLeft / (30 * 60)) * 100}%` }} />
              </div>
            </div>

            <div className="freeze-details">
              <div className="freeze-detail-row">
                <span>Reason</span>
                <span>{data?.message || data?.reason}</span>
              </div>
            </div>

            <div className="message-section">
              <h4 style={{display:'flex', alignItems:'center', gap:'6px'}}><MessageSquare size={16}/> Explain the reason for the action</h4>
              <textarea
                className="message-textarea"
                placeholder="Explain the reason for this action..."
                value={message}
                onChange={e => setMessage(e.target.value)}
                rows={4}
                disabled={messageSent && !message}
              />
              <div className="message-actions">
                <button className="btn btn-primary" onClick={sendMessage} disabled={!message.trim() || sending}>
                  {sending ? 'Sending...' : 'Submit for Admin Review'}
                </button>
                {messageSent && <span className="message-status">✅ Message delivered</span>}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
