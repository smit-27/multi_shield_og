import { apiFetch } from '../App'

export default function ExplainableAI() {
  const [activities, setActivities] = useState([])
  const [selected, setSelected] = useState(null)

  useEffect(() => {
    apiFetch('/api/activities?limit=50').then(d => {
      // Show activities that have factors
      const flagged = d.activities.filter(a => a.factors && a.factors.length > 0)
      setActivities(flagged)
      if (flagged.length > 0) setSelected(flagged[0])
    }).catch(console.error)
  }, [])

  const scoreColor = (s) => s >= 71 ? 'var(--danger)' : s >= 41 ? 'var(--warning)' : 'var(--success)'
  const gaugeClass = (s) => s >= 71 ? 'gauge-high' : s >= 41 ? 'gauge-medium' : 'gauge-low'
  const fillClass = (s, max) => { const pct = (s / max) * 100; return pct >= 60 ? 'high' : pct >= 30 ? 'medium' : 'low' }

  return (
    <div>
      <div className="page-header">
        <h2><Icon name="ai" size={24} style={{verticalAlign:'middle', marginRight:'8px'}} /> Explainable AI</h2>
        <p>Understand why actions were flagged — transparent risk analysis</p>
      </div>

      {activities.length === 0 ? (
        <div className="card"><div className="card-body empty-state">
          <div className="icon"><Icon name="ai" size={48} /></div>
          <p>No flagged activities yet. Perform actions in the Banking System to generate risk analysis data.</p>
        </div></div>
      ) : (
        <div className="grid-2">
          <div className="card" style={{maxHeight:'calc(100vh - 160px)', overflowY:'auto'}}>
            <div className="card-header"><h3>Flagged Activities</h3><span className="badge neutral">{activities.length}</span></div>
            <div className="card-body" style={{padding:'8px'}}>
              {activities.map((a, i) => (
                <div key={a.id || i}
                  className={`activity-item ${selected?.id === a.id ? 'selected' : ''}`}
                  style={{cursor:'pointer', borderColor: selected?.id === a.id ? 'var(--accent)' : undefined, marginBottom:'8px'}}
                  onClick={() => setSelected(a)}>
                  <div className={`activity-dot ${a.decision === 'BLOCK' ? 'block' : a.decision === 'REQUIRE_MFA' ? 'mfa' : 'allow'}`} />
                  <div className="activity-content">
                    <div className="activity-title" style={{fontSize:'13px'}}>
                      <strong className="mono">{a.user_id}</strong> → {a.action}
                    </div>
                    <div className="activity-meta">
                      <span>{a.role}</span>
                      <span>{a.created_at}</span>
                    </div>
                  </div>
                  <span className="mono" style={{fontWeight:'700', color: scoreColor(a.risk_score), fontSize:'16px'}}>{a.risk_score}</span>
                </div>
              ))}
            </div>
          </div>

          <div>
            {selected ? (
              <>
                <div className="card">
                  <div className="card-header"><h3>Risk Analysis Breakdown</h3></div>
                  <div className="card-body">
                    <div style={{display:'flex', gap:'32px', alignItems:'center', marginBottom:'24px'}}>
                      <div className="risk-gauge">
                        <div className={`gauge-circle ${gaugeClass(selected.risk_score)}`}>{selected.risk_score}</div>
                        <div className="gauge-label">Risk Score</div>
                      </div>
                      <div style={{flex:1}}>
                        <div style={{marginBottom:'8px'}}>
                          <span style={{color:'var(--text-muted)', fontSize:'13px'}}>User: </span>
                          <strong className="mono">{selected.user_id}</strong> ({selected.role})
                        </div>
                        <div style={{marginBottom:'8px'}}>
                          <span style={{color:'var(--text-muted)', fontSize:'13px'}}>Action: </span>
                          <span className="badge neutral">{selected.action}</span>
                        </div>
                        {selected.amount > 0 && <div style={{marginBottom:'8px'}}>
                          <span style={{color:'var(--text-muted)', fontSize:'13px'}}>Amount: </span>
                          <span className="mono" style={{color:'var(--cyan)'}}>₹{Number(selected.amount).toLocaleString('en-IN')}</span>
                        </div>}
                        <div>
                          <span style={{color:'var(--text-muted)', fontSize:'13px'}}>Decision: </span>
                          <span className={`badge ${selected.decision === 'BLOCK' ? 'block' : selected.decision === 'REQUIRE_MFA' ? 'mfa' : 'allow'}`}>{selected.decision}</span>
                        </div>
                      </div>
                    </div>

                    {selected.reason && (
                      <div style={{padding:'12px 16px', background:'var(--bg-input)', borderRadius:'var(--radius-sm)', marginBottom:'20px', borderLeft:`3px solid ${scoreColor(selected.risk_score)}`}}>
                        <div style={{fontSize:'12px', color:'var(--text-muted)', marginBottom:'4px'}}>AI Explanation</div>
                        <div style={{fontSize:'14px'}}>{selected.reason}</div>
                      </div>
                    )}
                  </div>
                </div>

                <div className="card">
                  <div className="card-header"><h3>Factor Breakdown</h3></div>
                  <div className="card-body">
                    {selected.factors?.map((f, i) => (
                      <div className="factor-bar-container" key={i}>
                        <div className="factor-bar-header">
                          <span className="factor-name">{f.factor}</span>
                          <span className="factor-score" style={{color: scoreColor(f.score * (100 / f.maxScore))}}>{f.score}/{f.maxScore}</span>
                        </div>
                        <div className="factor-bar">
                          <div className={`fill ${fillClass(f.score, f.maxScore)}`} style={{width: `${(f.score / f.maxScore) * 100}%`}} />
                        </div>
                        <div style={{fontSize:'12px', color:'var(--text-muted)', marginTop:'2px'}}>{f.detail}</div>
                      </div>
                    ))}
                    {(!selected.factors || selected.factors.length === 0) && (
                      <div className="empty-state"><p>No detailed factors available</p></div>
                    )}
                  </div>
                </div>
              </>
            ) : (
              <div className="card"><div className="card-body empty-state"><p>Select an activity to view its risk breakdown</p></div></div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
