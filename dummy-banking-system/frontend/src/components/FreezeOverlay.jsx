import { useState, useEffect, useRef } from 'react'

const SECURITY_PLATFORM_URL = 'http://localhost:3002'
const SECURITY_FRONTEND_URL = 'http://localhost:5174'

export default function FreezeOverlay({ mode, data, onResolved, onDenied }) {
  const [timeLeft, setTimeLeft] = useState(30 * 60) // 30 minutes
  const [message, setMessage] = useState('')
  const [messageSent, setMessageSent] = useState(false)
  const [status, setStatus] = useState('pending')
  const [adminResponse, setAdminResponse] = useState('')
  const [sending, setSending] = useState(false)
  const pollRef = useRef(null)

  // Poll for status updates
  useEffect(() => {
    if (status !== 'pending') return

    const pollStatus = async () => {
      try {
        if (mode === 'mfa' && data?.challenge_id) {
          const res = await fetch(`${SECURITY_PLATFORM_URL}/api/mfa/${data.challenge_id}`)
          const result = await res.json()
          if (result.status === 'completed') {
            setStatus('completed')
            onResolved?.()
          } else if (result.status === 'failed') {
            setStatus('failed')
          }
        } else if ((mode === 'admin' || mode === 'mfa_escalated') && data?.request_id) {
          const res = await fetch(`${SECURITY_PLATFORM_URL}/api/approvals/check/${data.request_id}`)
          const result = await res.json()
          if (result.status === 'approved') {
            setStatus('approved')
            setAdminResponse(result.admin_response || '')
            onResolved?.()
          } else if (result.status === 'denied') {
            setStatus('denied')
            setAdminResponse(result.admin_response || 'No reason provided')
            onDenied?.()
          }
        }
      } catch (err) {
        console.error('Poll error:', err)
      }
    }

    pollRef.current = setInterval(pollStatus, 3000)
    return () => clearInterval(pollRef.current)
  }, [mode, data, status])

  // Countdown timer for admin mode
  useEffect(() => {
    if (mode !== 'admin' && mode !== 'mfa_escalated') return
    if (status !== 'pending') return

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
      window.open(`${SECURITY_FRONTEND_URL}/mfa/${data.challenge_id}`, '_blank', 'width=600,height=700')
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
          <div className="freeze-icon">✅</div>
          <h2>{status === 'completed' ? 'MFA Verification Successful' : 'Action Approved by Admin'}</h2>
          {adminResponse && <p className="admin-response">Admin: "{adminResponse}"</p>}
          <p className="freeze-subtitle">Unfreezing your session... You may now continue.</p>
          <div className="freeze-progress-bar"><div className="freeze-progress-fill resolved" /></div>
        </div>
      </div>
    )
  }

  // Denied state
  if (status === 'denied') {
    return (
      <div className="freeze-overlay denied">
        <div className="freeze-content denied">
          <div className="freeze-icon">🚫</div>
          <h2>Action Denied by Admin</h2>
          <p className="admin-response">"{adminResponse}"</p>
          <p className="freeze-subtitle">This action has been permanently blocked. Contact your security administrator for more information.</p>
          <button className="btn btn-outline freeze-close-btn" onClick={onDenied}>Close</button>
        </div>
      </div>
    )
  }

  // MFA failed → escalated
  if (status === 'failed' && mode === 'mfa') {
    return (
      <div className="freeze-overlay">
        <div className="freeze-content escalated">
          <div className="freeze-icon">⚠️</div>
          <h2>MFA Failed — Escalated to Admin</h2>
          <p className="freeze-subtitle">Your MFA verification failed after 3 attempts. This action has been escalated to admin for manual approval.</p>
          <div className="freeze-progress-bar"><div className="freeze-progress-fill warning" /></div>
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
            <div className="freeze-icon pulse-icon">🔐</div>
            <h2>Multi-Factor Authentication Required</h2>
            <p className="freeze-subtitle">Your banking session is temporarily frozen. Complete MFA verification on the Security Platform to continue.</p>
            
            <div className="freeze-details">
              <div className="freeze-detail-row">
                <span>Reason</span>
                <span>{data?.reason}</span>
              </div>
            </div>

            <button className="btn btn-primary freeze-action-btn" onClick={openMfa}>
              🛡️ Open Security Platform for MFA
            </button>
            <p className="freeze-hint">A new window will open. Complete all 4 verification steps to unfreeze your session.</p>
          </>
        )}

        {/* Admin Approval Mode */}
        {(mode === 'admin' || mode === 'mfa_escalated') && (
          <>
            <div className="freeze-icon pulse-icon">🛑</div>
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
                <span>{data?.reason}</span>
              </div>
            </div>

            <div className="message-section">
              <h4>💬 Explain the reason for the action</h4>
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
