import { useState } from 'react'

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
        <div className="freeze-icon">📝</div>
        <h2>Justification Required</h2>
        <p className="freeze-subtitle">
          {data?.message || 'This action requires additional verification. Please provide a business justification before proceeding.'}
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
            Why is this action necessary?
          </label>
          <textarea
            className="message-textarea"
            value={reason}
            onChange={e => setReason(e.target.value)}
            placeholder="Please provide a clear business justification for this action..."
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
            style={{ flex: 1, justifyContent: 'center' }}
          >
            {submitting ? 'Submitting...' : '✓ Submit & Proceed'}
          </button>
        </div>
      </div>
    </div>
  )
}
