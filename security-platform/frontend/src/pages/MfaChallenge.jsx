import { useState, useEffect, useRef } from 'react'
import { useParams } from 'react-router-dom'
import { apiFetch } from '../App'
import * as faceapi from 'face-api.js'

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
  
  // Auto-close window when completed
  useEffect(() => {
    if (completed) {
      const timer = setTimeout(() => {
        window.close()
      }, 3000)
      return () => clearTimeout(timer)
    }
  }, [completed])
  
  // Face Recognition State
  const [modelsLoaded, setModelsLoaded] = useState(false)
  const [faceMatcher, setFaceMatcher] = useState(null)
  const [scanStatusMsg, setScanStatusMsg] = useState('')
  const videoRef = useRef(null)
  const canvasRef = useRef(null)
  const scanIntervalRef = useRef(null)

  useEffect(() => {
    loadChallenge()
    initFaceRecognition()
    return () => stopFaceScan()
  }, [challengeId])

  const initFaceRecognition = async () => {
    try {
      await Promise.all([
        faceapi.nets.ssdMobilenetv1.loadFromUri('/models'),
        faceapi.nets.faceLandmark68Net.loadFromUri('/models'),
        faceapi.nets.faceRecognitionNet.loadFromUri('/models')
      ])
      
      const labels = ['Teammate1', 'Teammate2', 'Teammate3', 'Teammate4']
      const labeledFaceDescriptors = await Promise.all(
        labels.map(async label => {
          const descriptors = []
          for (let i = 1; i <= 3; i++) {
            try {
              const imgUrl = `/labeled_images/${label}/${i}.jpg`
              const img = await faceapi.fetchImage(imgUrl)
              const detections = await faceapi.detectSingleFace(img).withFaceLandmarks().withFaceDescriptor()
              if (detections) {
                descriptors.push(detections.descriptor)
              }
            } catch (e) {
              // Ignore securely if ${i}.jpg does not exist
            }
          }
          
          if (descriptors.length === 0) {
            console.warn(`No valid labeled images found for ${label}`)
            return null
          }
          return new faceapi.LabeledFaceDescriptors(label, descriptors)
        })
      )
      
      const validDescriptors = labeledFaceDescriptors.filter(d => d !== null)
      if (validDescriptors.length > 0) {
        // Enforce strict threshold: 0.42 (balances security and camera variations)
        setFaceMatcher(new faceapi.FaceMatcher(validDescriptors, 0.42))
      }
      setModelsLoaded(true)
    } catch(err) {
      console.error('FaceAPI Init Error:', err)
      setError("Failed to load face recognition models. Ensure /models directory exists.")
    }
  }

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

  const startFaceScan = () => {
    if (!modelsLoaded) return setError("Models are still loading...")
    setFaceScanning(true)
    setScanStatusMsg('Starting camera...')
    
    navigator.mediaDevices.getUserMedia({ video: {} })
      .then(stream => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream
        }
      })
      .catch(err => {
        setFaceScanning(false)
        setError("Camera access denied or unavailable: " + err.message)
      })
  }

  const stopFaceScan = () => {
    if (scanIntervalRef.current) clearInterval(scanIntervalRef.current)
    if (videoRef.current && videoRef.current.srcObject) {
      videoRef.current.srcObject.getTracks().forEach(t => t.stop())
    }
    setFaceScanning(false)
  }

  const submitFaceFailure = async (reason) => {
    stopFaceScan()
    setVerifying(true)
    try {
      const res = await apiFetch(`/api/mfa/${challengeId}/verify`, {
        method: 'POST',
        body: JSON.stringify({ value: 'face_failed', reason })
      })
      if (res.status === 'completed') {
         // shouldn't happen on failure, but handle gracefully
      } else {
         setChallenge(prev => ({ ...prev, step: res.step }))
      }
    } catch (err) {
      const data = err.data || {}
      if (data.status === 'failed' && data.escalated) {
        setFailed(true)
        setFailData(data)
      } else {
        setStepError(data.message || err.message || 'Face verification failed permanently')
      }
    } finally {
      setVerifying(false)
    }
  }

  const onVideoPlay = () => {
    if (!faceMatcher) {
      setScanStatusMsg('No reference faces loaded! Please add 1.jpg to labeled_images folders.')
      setTimeout(() => submitFaceFailure('No reference faces loaded'), 4000)
      return
    }

    setScanStatusMsg('Analyzing face...')
    const displaySize = { width: videoRef.current.width, height: videoRef.current.height }
    faceapi.matchDimensions(canvasRef.current, displaySize)
    
    let scanAttempts = 0
    let unknownFaceCount = 0
    const maxAttempts = 50 // roughly 5 seconds at 100ms intervals

    scanIntervalRef.current = setInterval(async () => {
      scanAttempts++
      if (scanAttempts > maxAttempts) {
        clearInterval(scanIntervalRef.current)
        setScanStatusMsg('Timeout: No registered face found in 5 seconds.')
        submitFaceFailure('Face scan timeout (No face found)')
        return
      }

      if (videoRef.current && videoRef.current.readyState === 4) {
        const detections = await faceapi.detectSingleFace(videoRef.current)
          .withFaceLandmarks()
          .withFaceDescriptor()

        if (detections) {
          const match = faceMatcher.findBestMatch(detections.descriptor)
          
          const canvas = canvasRef.current
          if (canvas) {
            const resizedDetections = faceapi.resizeResults(detections, displaySize)
            canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height)
            faceapi.draw.drawDetections(canvas, resizedDetections)
            const box = resizedDetections.detection.box
            const drawBox = new faceapi.draw.DrawBox(box, { label: match.toString() })
            drawBox.draw(canvas)
          }

          // Ensure the match distance is extremely strict relative to the training data
          if (match.label !== 'unknown' && match.distance < 0.42) {
            clearInterval(scanIntervalRef.current)
            setScanStatusMsg(`Recognized: ${match.label} (Confidence: ${((1 - match.distance) * 100).toFixed(1)}%)`)
            setFaceDone(true)
            stopFaceScan()
            
            // Auto-submit success
            setVerifying(true)
            try {
              const res = await apiFetch(`/api/mfa/${challengeId}/verify`, { method: 'POST', body: JSON.stringify({ value: 'face_verified' }) })
              setChallenge(prev => ({ ...prev, step: res.step }))
            } catch (err) {
              setStepError('Server error recording face match')
            } finally {
              setVerifying(false)
            }
          } else {
            // Saw a face, but it didn't strictly match the registered models
            unknownFaceCount++
            if (unknownFaceCount >= 20) {
              // 20 frames of an unauthorized face (~2.0 seconds) gives camera time to adjust exposure, then INSTANT FAILURE
              clearInterval(scanIntervalRef.current)
              setScanStatusMsg('Unauthorized Face Detected. Blocking immediately.')
              submitFaceFailure('Face mismatch detected by Security Platform')
            }
          }
        }
      }
    }, 100)
  }

  const handleVerify = async () => {
    if (challenge.step === 2) {
      startFaceScan()
      return
    }

    setVerifying(true)
    setStepError(null)

    try {
      const res = await apiFetch(`/api/mfa/${challengeId}/verify`, {
        method: 'POST',
        body: JSON.stringify({ value })
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
            <p className="mfa-hint">This window will automatically close in 3 seconds...</p>
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

          {/* Face Recognition (Live) */}
          {currentStep === 2 ? (
            <div className="face-scan-area">
              {faceDone ? (
                <div className="face-done">
                  <div className="face-check">✓</div>
                  <p>Face verified successfully!</p>
                  <p className="scan-text">{scanStatusMsg}</p>
                </div>
              ) : faceScanning ? (
                <div style={{ position: 'relative', width: '320px', height: '240px', margin: '0 auto', overflow: 'hidden', borderRadius: '8px', border: '2px solid var(--primary-color)' }}>
                  <video 
                    ref={videoRef} 
                    autoPlay 
                    muted 
                    onPlay={onVideoPlay} 
                    width="320" 
                    height="240" 
                    style={{ position: 'absolute', top: 0, left: 0 }} 
                  />
                  <canvas 
                    ref={canvasRef} 
                    width="320" 
                    height="240" 
                    style={{ position: 'absolute', top: 0, left: 0 }} 
                  />
                  <div className="scan-text" style={{ position: 'absolute', bottom: '10px', width: '100%', textAlign: 'center', backgroundColor: 'rgba(0,0,0,0.6)', color: 'white', padding: '4px' }}>
                    {scanStatusMsg}
                  </div>
                </div>
              ) : (
                <div className="face-placeholder">
                  <div className="face-outline">👤</div>
                  <p>{modelsLoaded ? 'Click "Start Scan" to verify your face' : 'Loading facial recognition models...'}</p>
                </div>
              )}
            </div>
          ) : (
            <div className="mfa-input-group">
              {currentStep === 3 && (
                <div className="otp-hint">
                  <span>🔐</span> Request the hex OTP code from your Security Admin portal
                </div>
              )}
              <input
                type={currentStep === 1 ? 'password' : 'text'}
                className="mfa-input"
                placeholder={currentStep === 0 ? 'e.g. treasury_01' : currentStep === 1 ? 'Enter password' : 'Enter hex OTP (e.g. A3F1B20E)'}
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
            disabled={verifying || (currentStep !== 2 && !value.trim()) || (currentStep === 2 && !modelsLoaded && !faceDone)}
          >
            {verifying ? 'Verifying...' : currentStep === 2 ? (faceScanning ? 'Scanning...' : 'Start Scan') : `Verify Step ${currentStep + 1}`}
          </button>
        </div>
      </div>
    </div>
  )
}
