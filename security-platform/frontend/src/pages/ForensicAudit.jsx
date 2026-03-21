import { useState, useEffect, useCallback } from 'react'
import { io } from 'socket.io-client'

// ─── Backend Defaults (mirrors bankingProxy.js ZTA_DEFAULTS) ─────────────────
const ZTA_DEFAULTS = {
  amountLimit: 500000,
  criticalRiskScore: 90,
  sandboxRiskScore: 60
}

// ─── Helper ─────────────────────────────────────────────────────────────────
const fmtAmount = (n) => `$${Number(n).toLocaleString()}`
const fmtScore  = (n) => `${n}%`

export default function ForensicAudit() {
  const [isConnected, setIsConnected]         = useState(false)
  const [latestEvent, setLatestEvent]         = useState(null)
  const [localStorageState, setLocalStorage]  = useState(null)
  const [eventHistory, setEventHistory]       = useState([])
  const [auditPhase, setAuditPhase]           = useState('IDLE') // IDLE | INTERCEPTING | RECONSTRUCTING | SCORING | ROUTING

  // Poll localStorage every 500ms to keep the persistence panel live
  const pollLocalStorage = useCallback(() => {
    try {
      const raw = localStorage.getItem('zta-overrides')
      setLocalStorage(raw ? JSON.parse(raw) : null)
    } catch { setLocalStorage(null) }
  }, [])

  useEffect(() => {
    const interval = setInterval(pollLocalStorage, 500)
    pollLocalStorage()
    return () => clearInterval(interval)
  }, [pollLocalStorage])

  useEffect(() => {
    const socket = io('http://127.0.0.1:3002')
    socket.on('connect',    () => setIsConnected(true))
    socket.on('disconnect', () => setIsConnected(false))

    socket.on('zta-activity', (data) => {
      setLatestEvent(data)
      setEventHistory(prev => [data, ...prev].slice(0, 20))

      // Animate audit phase chain
      setAuditPhase('INTERCEPTING')
      setTimeout(() => setAuditPhase('RECONSTRUCTING'), 800)
      setTimeout(() => setAuditPhase('SCORING'),        1600)
      setTimeout(() => setAuditPhase('ROUTING'),        2400)
      setTimeout(() => setAuditPhase('IDLE'),           4000)
    })

    return () => socket.disconnect()
  }, [])

  // ──── Derived state from latest event ───────────────────────────────────────
  const overrides   = latestEvent?.extraPayload?.thresholds ?? latestEvent?.thresholds ?? null
  const isOverride  = latestEvent?.isOverrideActive ?? false
  const factors     = latestEvent?.extraPayload?.factors ?? latestEvent?.factors ?? []
  const riskScore   = latestEvent?.score ?? 0
  const action      = latestEvent?.action ?? 'FORWARDED'
  const isSandboxed = action === 'SANDBOXED'
  const isBlocked   = action === 'BLOCKED'

  // Detected override headers (reconstruct from threshold diff)
  const detectedHeaders = []
  if (overrides && isOverride) {
    if (overrides.amountLimit   !== ZTA_DEFAULTS.amountLimit)        detectedHeaders.push({ key: 'x-zta-override-amount',       value: fmtAmount(overrides.amountLimit) })
    if (overrides.criticalRiskScore !== ZTA_DEFAULTS.criticalRiskScore) detectedHeaders.push({ key: 'x-zta-override-risk-block',  value: fmtScore(overrides.criticalRiskScore) })
    if (overrides.sandboxRiskScore !== ZTA_DEFAULTS.sandboxRiskScore)   detectedHeaders.push({ key: 'x-zta-override-risk-sandbox', value: fmtScore(overrides.sandboxRiskScore) })
  }
  if (latestEvent?.extraPayload?.time != null) {
    detectedHeaders.push({ key: 'x-zta-override-time', value: `${latestEvent.extraPayload.time}:00` })
  }

  const sandboxThreshold = overrides?.sandboxRiskScore ?? ZTA_DEFAULTS.sandboxRiskScore

  return (
    <div className="forensic-dashboard">
      {/* ── HEADER ─────────────────────────────────────────────────────────── */}
      <div className="forensic-header">
        <div className="fh-left">
          <div className="fh-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.955 11.955 0 003 12c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.623 0-2.296-.652-4.438-1.778-6.261l.003.003z" />
            </svg>
          </div>
          <div>
            <h1>ZTA VALIDATION & FORENSIC AUDIT</h1>
            <p>REQUEST LIFECYCLE INSPECTOR · REAL-TIME POLICY ENFORCEMENT TRACE</p>
          </div>
        </div>
        <div className="fh-status-row">
          <div className={`fh-pill ${isConnected ? 'pill-active' : 'pill-warn'}`}>
            <span className={`pill-dot ${isConnected ? 'dot-cyan' : 'dot-amber'}`} />
            {isConnected ? 'NODE SOCKET LIVE' : 'RECONNECTING...'}
          </div>
          {latestEvent && (
            <div className={`fh-pill ${isSandboxed ? 'pill-sandbox' : isBlocked ? 'pill-danger' : 'pill-success'}`}>
              <span className={`pill-dot ${isSandboxed ? 'dot-amber' : isBlocked ? 'dot-red' : 'dot-green'}`} />
              LAST: {action} · SCORE {riskScore}
            </div>
          )}
        </div>
      </div>

      {/* ── AUDIT PHASE STEPPER ────────────────────────────────────────────── */}
      <div className="audit-stepper">
        {[
          { id: 'INTERCEPTING',   label: '① HEADER INTERCEPT'   },
          { id: 'RECONSTRUCTING', label: '② POLICY RECONSTRUCT' },
          { id: 'SCORING',        label: '③ AI RISK SCORE'       },
          { id: 'ROUTING',        label: '④ PATH DECISION'       },
        ].map(s => (
          <div key={s.id} className={`step-node ${auditPhase === s.id ? 'step-active' : auditPhase === 'IDLE' && latestEvent ? 'step-done' : ''}`}>
            <div className="step-icon" />
            <span>{s.label}</span>
          </div>
        ))}
      </div>

      {/* ── MAIN GRID ──────────────────────────────────────────────────────── */}
      <div className="forensic-grid">

        {/* ① Packet Inspection Window */}
        <div className={`fa-panel packet-panel ${auditPhase === 'INTERCEPTING' ? 'panel-flash' : ''}`}>
          <div className="fa-panel-hdr">
            <span className="fa-dot dot-purple" />
            <h3>① PACKET INSPECTION</h3>
            <span className="fa-badge">DYNAMIC HEADER INTERCEPT</span>
          </div>
          <div className="fa-panel-body">
            <div className="code-window">
              <div className="cw-titlebar">
                <span className="cw-btn cw-red" /><span className="cw-btn cw-amber" /><span className="cw-btn cw-green" />
                <span className="cw-title">REQUEST HEADERS · INGRESS INSPECTION</span>
              </div>
              <div className="cw-body">
                <div className="cw-line comment">// Standard ZTA Headers</div>
                <div className="cw-line"><span className="ck">Authorization:</span> <span className="cv">Bearer eyJ**** [JWT VERIFIED]</span></div>
                <div className="cw-line"><span className="ck">X-ZTA-Verified:</span> <span className="cv success-text">true</span></div>
                <div className="cw-line"><span className="ck">X-ZTA-Risk-Score:</span> <span className={`cv ${riskScore > 60 ? 'danger-text' : 'success-text'}`}>{riskScore}</span></div>
                <div className="cw-divider" />
                <div className="cw-line comment">// Override Headers {detectedHeaders.length > 0 ? '← DETECTED' : '← NONE ACTIVE'}</div>
                {detectedHeaders.length === 0 ? (
                  <div className="cw-line muted-text">x-zta-override-*: &lt;not present — using system defaults&gt;</div>
                ) : detectedHeaders.map(h => (
                  <div key={h.key} className="cw-line override-line">
                    <span className="ck override-key">{h.key}:</span>
                    <span className="cv override-val">{h.value}</span>
                    <span className="detected-badge">DETECTED</span>
                  </div>
                ))}
                {latestEvent && (
                  <>
                    <div className="cw-divider" />
                    <div className="cw-line comment">// Request Metadata</div>
                    <div className="cw-line"><span className="ck">User-ID:</span> <span className="cv">{latestEvent.user}</span></div>
                    <div className="cw-line"><span className="ck">Role:</span> <span className="cv">{latestEvent.role}</span></div>
                    <div className="cw-line"><span className="ck">Source-IP:</span> <span className="cv">{latestEvent.location}</span></div>
                    <div className="cw-line"><span className="ck">Segment:</span> <span className={`cv ${isSandboxed ? 'danger-text' : 'success-text'}`}>{latestEvent.segment}</span></div>
                  </>
                )}
                {!latestEvent && <div className="cw-idle">Awaiting incoming request...</div>}
              </div>
            </div>
          </div>
        </div>

        {/* ② Policy Reconstruction */}
        <div className={`fa-panel logic-panel ${auditPhase === 'RECONSTRUCTING' ? 'panel-flash' : ''}`}>
          <div className="fa-panel-hdr">
            <span className="fa-dot dot-purple" />
            <h3>② LIVE POLICY LOGIC</h3>
            <span className="fa-badge">RECONSTRUCT ACTIVE THRESHOLDS</span>
          </div>
          <div className="fa-panel-body">
            <div className="policy-compare">
              <div className={`policy-block ${isOverride ? 'dimmed' : 'glowing-green'}`}>
                <div className="pb-title">SYSTEM DEFAULTS</div>
                <div className="pb-row"><span>Amount Limit</span><span className="pb-val">{fmtAmount(ZTA_DEFAULTS.amountLimit)}</span></div>
                <div className="pb-row"><span>Block Score</span><span className="pb-val">{ZTA_DEFAULTS.criticalRiskScore}%</span></div>
                <div className="pb-row"><span>Sandbox Score</span><span className="pb-val">{ZTA_DEFAULTS.sandboxRiskScore}%</span></div>
              </div>

              <div className="policy-arrow">
                {isOverride ? <span className="arrow-override">→ OVERRIDDEN →</span> : <span className="arrow-default">→ ACTIVE →</span>}
              </div>

              <div className={`policy-block ${isOverride ? 'glowing-purple' : 'dimmed'}`}>
                <div className="pb-title">{isOverride ? '🔴 ACTIVE OVERRIDES' : 'DEMO OVERRIDES'}</div>
                <div className="pb-row">
                  <span>Amount Limit</span>
                  <span className={`pb-val ${isOverride && overrides?.amountLimit !== ZTA_DEFAULTS.amountLimit ? 'override-val' : ''}`}>
                    {overrides ? fmtAmount(overrides.amountLimit) : '--'}
                  </span>
                </div>
                <div className="pb-row">
                  <span>Block Score</span>
                  <span className={`pb-val ${isOverride && overrides?.criticalRiskScore !== ZTA_DEFAULTS.criticalRiskScore ? 'override-val' : ''}`}>
                    {overrides ? fmtScore(overrides.criticalRiskScore) : '--'}
                  </span>
                </div>
                <div className="pb-row">
                  <span>Sandbox Score</span>
                  <span className={`pb-val ${isOverride && overrides?.sandboxRiskScore !== ZTA_DEFAULTS.sandboxRiskScore ? 'override-val' : ''}`}>
                    {overrides ? fmtScore(overrides.sandboxRiskScore) : '--'}
                  </span>
                </div>
              </div>
            </div>

            {isOverride && <div className="override-notice">⚠ Policy override active — backend is using injected thresholds for this request lifecycle.</div>}
            {!latestEvent && <div className="idle-notice">No event received yet. Submit a banking transaction to trigger audit.</div>}
          </div>
        </div>

        {/* ③ XAI Risk Attribution */}
        <div className={`fa-panel xai-audit-panel ${auditPhase === 'SCORING' ? 'panel-flash' : ''}`}>
          <div className="fa-panel-hdr">
            <span className="fa-dot dot-cyan" />
            <h3>③ XAI RISK ATTRIBUTION</h3>
            <span className="fa-badge">analyzeRisk() WEIGHTS</span>
          </div>
          <div className="fa-panel-body">
            {factors.length === 0 ? (
              <div className="idle-notice">
                No risk breakdown available — submit a transaction to see XAI factor weights.
              </div>
            ) : (
              <div className="xai-chart">
                <div className="xai-score-summary">
                  <div className={`risk-score-badge ${riskScore >= 80 ? 'critical' : riskScore >= 60 ? 'high' : riskScore >= 40 ? 'medium' : 'low'}`}>
                    {riskScore}
                    <span>RISK</span>
                  </div>
                  <div className="risk-verdict">
                    <div className={`verdict-text ${isSandboxed ? 'danger-text' : isBlocked ? 'danger-text' : 'success-text'}`}>{action}</div>
                    <div className="verdict-sub">Threshold: {sandboxThreshold}%</div>
                  </div>
                </div>
                <div className="factor-bars">
                  {factors.map((f, i) => {
                    const pct = Math.round((f.score / (f.maxScore || 100)) * 100)
                    const color = pct > 75 ? '#f43f5e' : pct > 40 ? '#f59e0b' : '#22d3ee'
                    return (
                      <div key={i} className="factor-row">
                        <div className="factor-label">
                          <span>{f.factor}</span>
                          <span className="factor-pts">{f.score} / {f.maxScore}</span>
                        </div>
                        <div className="factor-track">
                          <div className="factor-fill" style={{ width: `${pct}%`, background: color, boxShadow: `0 0 8px ${color}` }} />
                        </div>
                        <div className="factor-detail">{f.detail}</div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ④ Network Path / Micro-segmentation */}
        <div className={`fa-panel path-panel ${auditPhase === 'ROUTING' ? 'panel-flash' : ''}`}>
          <div className="fa-panel-hdr">
            <span className="fa-dot dot-cyan" />
            <h3>④ NETWORK PATH TRACE</h3>
            <span className="fa-badge">MICRO-SEGMENTATION DECISION</span>
          </div>
          <div className="fa-panel-body">
            <div className="net-diagram">

              {/* Ingress Node */}
              <div className="net-node ingress-node">
                <div className="nn-icon">⟶</div>
                <div className="nn-label">ZTA GATEWAY<br/><span>INGRESS 443</span></div>
              </div>

              {/* Decision Arrow */}
              <div className="net-arrow">
                {latestEvent && (
                  <div className={`pulsing-dot ${isSandboxed || isBlocked ? 'dot-diverted' : 'dot-flowing'}`}
                    title={`Score: ${riskScore} | Threshold: ${sandboxThreshold}`}
                  />
                )}
                <div className="net-line" />
                <div className="net-score-tag">
                  {latestEvent ? `SCORE: ${riskScore}% — THRESHOLD: ${sandboxThreshold}%` : 'AWAITING TRAFFIC'}
                </div>
              </div>

              {/* Fork Targets */}
              <div className="net-targets">
                <div className={`net-node prod-node ${!isSandboxed && !isBlocked && latestEvent ? 'node-active' : 'node-dim'}`}>
                  <div className="nn-icon">🟢</div>
                  <div className="nn-label">PRODUCTION CORE<br/><span>VLAN 10 · PORT 5000</span></div>
                  {!isSandboxed && !isBlocked && latestEvent && <div className="routing-tag tag-prod">ROUTED HERE</div>}
                </div>

                <div className={`net-node sandbox-node ${isSandboxed && latestEvent ? 'node-active-amber' : 'node-dim'}`}>
                  <div className="nn-icon">⚠</div>
                  <div className="nn-label">ISOLATED SANDBOX<br/><span>VLAN 50 · PORT 5001</span></div>
                  {isSandboxed && latestEvent && <div className="routing-tag tag-sandbox">DIVERTED HERE</div>}
                </div>

                <div className={`net-node block-node ${isBlocked && latestEvent ? 'node-active-red' : 'node-dim'}`}>
                  <div className="nn-icon">🔴</div>
                  <div className="nn-label">EDGE FIREWALL<br/><span>BLOCKED · DROPPED</span></div>
                  {isBlocked && latestEvent && <div className="routing-tag tag-block">TERMINATED</div>}
                </div>
              </div>

            </div>
            {isSandboxed && (
              <div className="override-notice danger-notice">
                ⚠ Risk {riskScore}% ≥ Sandbox threshold {sandboxThreshold}% — traffic diverted to Isolated Sandbox Segment (VLAN 50, port 5001).
              </div>
            )}
          </div>
        </div>

        {/* ⑤ Persistence Check / localStorage */}
        <div className="fa-panel persist-panel">
          <div className="fa-panel-hdr">
            <span className="fa-dot dot-amber" />
            <h3>⑤ PERSISTENCE CHECK</h3>
            <span className="fa-badge">window.localStorage ↔ x-zta-override-*</span>
          </div>
          <div className="fa-panel-body persist-body">
            <div className="ls-section">
              <div className="ls-title">window.localStorage['zta-overrides']</div>
              {!localStorageState ? (
                <div className="ls-empty">
                  <span className="ls-null">null</span>
                  <span className="ls-hint">No overrides are currently active on this browser session.</span>
                </div>
              ) : (
                <div className="ls-tree">
                  <div className="ls-brace">{'{'}</div>
                  {Object.entries(localStorageState).map(([k, v]) => (
                    <div key={k} className="ls-row">
                      <span className="ls-key">"{k}"</span>
                      <span>: </span>
                      <span className="ls-val">{JSON.stringify(v)}</span>
                      <span className="ls-comma">,</span>
                    </div>
                  ))}
                  <div className="ls-brace">{'}'}</div>
                </div>
              )}
            </div>

            <div className="sync-arrow">
              <div className="sa-line" />
              <div className="sa-label">{localStorageState ? '✓ SYNC BRIDGE ACTIVE' : '○ NO BRIDGE'}</div>
            </div>

            <div className="ls-section">
              <div className="ls-title">HTTP Headers → Backend (last request)</div>
              {detectedHeaders.length === 0 ? (
                <div className="ls-empty">
                  <span className="ls-null">—</span>
                  <span className="ls-hint">Headers match system defaults; no override headers were sent.</span>
                </div>
              ) : (
                <div className="ls-tree">
                  {detectedHeaders.map(h => (
                    <div key={h.key} className="ls-row">
                      <span className="ls-key override-key">{h.key}</span>
                      <span>: </span>
                      <span className="ls-val override-val">{h.value}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Request Lifecycle Timeline */}
        <div className="fa-panel timeline-panel">
          <div className="fa-panel-hdr">
            <span className="fa-dot dot-green" />
            <h3>REQUEST LIFECYCLE LOG</h3>
            <span className="fa-badge">{eventHistory.length} events captured</span>
          </div>
          <div className="fa-panel-body">
            <div className="lifecycle-log">
              {eventHistory.length === 0 && <div className="idle-notice">Awaiting first transaction through the ZTA gateway...</div>}
              {eventHistory.map((evt, i) => (
                <div key={evt.id || i} className={`log-row ${evt.action === 'BLOCKED' ? 'log-blocked' : evt.action === 'SANDBOXED' ? 'log-sandboxed' : 'log-allowed'}`}>
                  <span className="log-time">{new Date(evt.timestamp).toLocaleTimeString()}</span>
                  <span className={`log-action ${evt.action === 'BLOCKED' ? 'danger-text' : evt.action === 'SANDBOXED' ? 'amber-text' : 'success-text'}`}>{evt.action}</span>
                  <span className="log-score">SCORE: {evt.score}</span>
                  <span className="log-user">USER: {evt.user}</span>
                  <span className="log-seg">{evt.segment}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

      </div>
    </div>
  )
}
