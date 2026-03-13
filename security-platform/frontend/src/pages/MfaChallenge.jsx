import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { apiFetch } from '../App'

const STEPS = [
  { key: 'employee_id', label: 'Employee ID', icon: '🪪', description: 'Enter your employee identification number' },
  { key: 'password', label: 'Password', icon: '🔑', description: 'Enter your security password' },
  { key: 'face', label: 'Face Recognition', icon: '📷', description: 'Verify your identity with face scan' },
  { key: 'otp', label: 'OTP Verification', icon: '📲', description: 'Enter the one-time passcode' }
]

export default function MfaChallenge() {
  const { challengeId } = useParams()
  const [challenge, setChallenge] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [value, setValue] = useState('')
  const [verifying, setVerifying] = useState(false)
  const [stepError, setStepError] = useState(null)
  const [faceScanning, setFaceScanning] = useState(false)
  const [faceDone, setFaceDone] = useState(false)
  const [otpHint, setOtpHint] = useState(null)
  const [completed, setCompleted] = useState(false)
  const [failed, setFailed] = useState(false)
  const [failData, setFailData] = useState(null)

  useEffect(() => {
    loadChallenge()
  }, [challengeId])

  const loadChallenge = async () => {
    try {
      const data = await apiFetch(`/api/mfa/${challengeId}`)
      setChallenge(data)
      if (data.status === 'completed') setCompleted(true)
      if (data.status === 'failed') setFailed(true)
    } catch (err) {
      setError(err.message || 'Failed to load challenge')
    } finally {
      setLoading(false)
    }
  }

  const handleVerify = async () => {
    setVerifying(true)
    setStepError(null)

    // Face recognition is a static mock
    if (challenge.step === 2) {
      setFaceScanning(true)
      await new Promise(r => setTimeout(r, 2500))
      setFaceScanning(false)
      setFaceDone(true)
    }

    try {
      const res = await apiFetch(`/api/mfa/${challengeId}/verify`, {
        method: 'POST',
        body: JSON.stringify({ value: challenge.step === 2 ? 'face_verified' : value })
      })

      if (res.status === 'completed') {
        setCompleted(true)
        setChallenge(prev => ({ ...prev, step: 4, status: 'completed' }))
      } else {
        setChallenge(prev => ({ ...prev, step: res.step }))
        setValue('')
        setFaceDone(false)
        if (res.otp_hint) setOtpHint(res.otp_hint)
      }
    } catch (err) {
      const data = err.data || {}
      if (data.status === 'failed' && data.escalated) {
        setFailed(true)
        setFailData(data)
      } else {
        setStepError(data.message || err.message || 'Verification failed')
      }
    } finally {
      setVerifying(false)
    }
  }

  if (loading) {
    return (
      <div className="mfa-page">
        <div className="mfa-container">
          <div className="mfa-loading"><div className="spinner" /><p>Loading MFA challenge...</p></div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="mfa-page">
        <div className="mfa-container">
          <div className="mfa-error">
            <div className="mfa-icon">❌</div>
            <h2>Challenge Not Found</h2>
            <p>{error}</p>
          </div>
        </div>
      </div>
    )
  }

  if (completed) {
    return (
      <div className="mfa-page">
        <div className="mfa-container">
          <div className="mfa-success">
            <div className="mfa-icon success-pulse">✅</div>
            <h2>MFA Verification Complete</h2>
            <p>All verification steps passed successfully. Your banking session is now unfreezing.</p>
            <div className="mfa-info-card">
              <div className="mfa-info-row"><span>Action</span><span>{challenge?.action}</span></div>
              <div className="mfa-info-row"><span>Risk Score</span><span>{challenge?.risk_score}/100</span></div>
              <div className="mfa-info-row"><span>Status</span><span className="text-success">Verified ✓</span></div>
            </div>
            <p className="mfa-hint">You can safely close this window and return to the Banking System.</p>
          </div>
        </div>
      </div>
    )
  }

  if (failed) {
    return (
      <div className="mfa-page">
        <div className="mfa-container">
          <div className="mfa-failed">
            <div className="mfa-icon">🚫</div>
            <h2>MFA Verification Failed</h2>
            <p>{failData?.message || 'Too many failed attempts. This action has been escalated to the admin for review.'}</p>
            <div className="mfa-info-card danger">
              <div className="mfa-info-row"><span>Action</span><span>{challenge?.action}</span></div>
              <div className="mfa-info-row"><span>Status</span><span className="text-danger">Escalated to Admin</span></div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  const currentStep = challenge?.step || 0
  const stepInfo = STEPS[currentStep]

  return (
    <div className="mfa-page">
      <div className="mfa-container">
        <div className="mfa-header">
          <h1>🛡️ Multi-Factor Authentication</h1>
          <p>Complete all 4 verification steps to authorize your banking action</p>
        </div>

        {/* Progress Steps */}
        <div className="mfa-progress">
          {STEPS.map((step, idx) => (
            <div key={step.key} className={`mfa-step-indicator ${idx < currentStep ? 'done' : idx === currentStep ? 'active' : 'pending'}`}>
              <div className="step-circle">
                {idx < currentStep ? '✓' : idx + 1}
              </div>
              <span className="step-label">{step.label}</span>
            </div>
          ))}
        </div>

        {/* Challenge Info */}
        <div className="mfa-info-card">
          <div className="mfa-info-row"><span>User</span><span>{challenge?.username || challenge?.user_id}</span></div>
          <div className="mfa-info-row"><span>Action</span><span>{challenge?.action}</span></div>
          <div className="mfa-info-row"><span>Risk Score</span><span className="text-warning">{challenge?.risk_score}/100</span></div>
        </div>

        {/* Current Step */}
        <div className="mfa-step-card">
          <div className="step-header">
            <span className="step-icon">{stepInfo.icon}</span>
            <div>
              <h3>Step {currentStep + 1}: {stepInfo.label}</h3>
              <p>{stepInfo.description}</p>
            </div>
          </div>

          {/* Face Recognition (mock) */}
          {currentStep === 2 ? (
            <div className="face-scan-area">
              {faceScanning ? (
                <>
                  <div className="face-scan-animation">
                    <div className="scan-circle" />
                    <div className="scan-line" />
                  </div>
                  <p className="scan-text">Scanning face...</p>
                </>
              ) : faceDone ? (
                <div className="face-done">
                  <div className="face-check">✓</div>
                  <p>Face verified successfully</p>
                </div>
              ) : (
                <div className="face-placeholder">
                  <div className="face-outline">👤</div>
                  <p>Click "Verify" to begin face scan</p>
                </div>
              )}
            </div>
          ) : (
            <div className="mfa-input-group">
              {currentStep === 3 && otpHint && (
                <div className="otp-hint">
                  <span>📱</span> {otpHint}
                </div>
              )}
              <input
                type={currentStep === 1 ? 'password' : 'text'}
                className="mfa-input"
                placeholder={currentStep === 0 ? 'e.g. treasury_01' : currentStep === 1 ? 'Enter password' : 'Enter 6-digit OTP'}
                value={value}
                onChange={e => setValue(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && value) handleVerify() }}
                autoFocus
              />
            </div>
          )}

          {stepError && (
            <div className="mfa-step-error">
              <span>⚠️</span> {stepError}
            </div>
          )}

          <button
            className="btn btn-primary mfa-verify-btn"
            onClick={handleVerify}
            disabled={verifying || (currentStep !== 2 && !value.trim())}
          >
            {verifying ? (currentStep === 2 ? 'Scanning...' : 'Verifying...') : `Verify Step ${currentStep + 1}`}
          </button>
        </div>
      </div>
    </div>
  )
}
