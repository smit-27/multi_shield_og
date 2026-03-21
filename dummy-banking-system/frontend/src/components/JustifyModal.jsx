import { useState } from 'react'
import { Shield } from 'lucide-react'

export default function JustifyModal({ show, data, onSubmit, onClose }) {
  const [reason, setReason] = useState('')
  const [submitting, setSubmitting] = useState(false)

  if (!show) return null

  const handleSubmit = async () => {
    if (!reason.trim()) return
    setSubmitting(true)
    try {
      await onSubmit(reason.trim())
      setReason('')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="freeze-overlay">
      <div className="freeze-content">
        <div className="freeze-icon" style={{background:'var(--danger-light)', color:'var(--danger)'}}><Shield size={32}/></div>
        <h2 style={{color:'var(--danger)'}}>Privileged Access Required</h2>
        <p className="freeze-subtitle">
          {data?.message || 'This action requires Just-In-Time (JIT) credential elevation. Please provide a business justification to proceed.'}
        </p>

        {data?.reason && (
          <div className="freeze-details">
            <div className="freeze-detail-row">
              <span>Security Notice</span>
              <span>{data.reason}</span>
            </div>
          </div>
        )}

        <div className="justify-form" style={{ textAlign: 'left', marginBottom: '24px' }}>
          <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: 'var(--text-secondary)', marginBottom: '8px' }}>
            Business Justification for Elevated Access
          </label>
          <textarea
            className="message-textarea"
            value={reason}
            onChange={e => setReason(e.target.value)}
            placeholder="Please provide a clear business justification for this action. This will be logged in the audit trail."
            rows={4}
            style={{ resize: 'vertical', minHeight: '100px' }}
          />
        </div>

        <div style={{ display: 'flex', gap: '12px' }}>
          <button className="btn btn-outline" onClick={onClose} style={{ flex: 1, justifyContent: 'center' }}>
            Cancel Action
          </button>
          <button
            className="btn btn-primary"
            onClick={handleSubmit}
            disabled={!reason.trim() || submitting}
            style={{ flex: 1, justifyContent: 'center', background: 'var(--danger)', borderColor: 'var(--danger)' }}
          >
            {submitting ? 'Authenticating...' : '✓ Request JIT Access'}
          </button>
        </div>
      </div>
    </div>
  )
}
