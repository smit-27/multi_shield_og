import { apiFetch } from '../App'
import Icon from '../components/Icon'

export default function Monitoring() {
  const [activities, setActivities] = useState([])
  const [stats, setStats] = useState({})
  const [autoRefresh, setAutoRefresh] = useState(true)
  const intervalRef = useRef(null)

  const load = () => {
    apiFetch('/api/activities?limit=30').then(d => setActivities(d.activities)).catch(console.error)
    apiFetch('/api/activities/stats').then(setStats).catch(console.error)
  }

  useEffect(() => {
    load()
    if (autoRefresh) {
      intervalRef.current = setInterval(load, 5000)
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  }, [autoRefresh])

  const decisionBadge = (d) => {
    const map = { ALLOW: 'allow', BLOCK: 'block', REQUIRE_MFA: 'mfa' }
    return <span className={`badge ${map[d] || 'neutral'}`}>{d}</span>
  }

  const scoreColor = (s) => s >= 71 ? 'var(--danger)' : s >= 41 ? 'var(--warning)' : 'var(--success)'

  return (
    <div>
      <div className="page-header" style={{display:'flex', justifyContent:'space-between', alignItems:'flex-start'}}>
        <div>
          <h2><Icon name="monitoring" size={24} style={{verticalAlign:'middle', marginRight:'8px'}} /> Live Monitoring</h2>
          <p>Real-time privileged user activity monitoring</p>
        </div>
        <div style={{display:'flex', gap:'8px', alignItems:'center'}}>
          <span className="live-badge">● LIVE</span>
          <button className={`btn btn-sm ${autoRefresh ? 'btn-primary' : 'btn-outline'}`} onClick={() => setAutoRefresh(!autoRefresh)}>
            {autoRefresh ? <><Icon name="clock" size={14} /> Pause</> : <><Icon name="monitoring" size={14} /> Resume</>}
          </button>
        </div>
      </div>

      <div className="kpi-grid">
        <div className="kpi-card cyan"><div className="kpi-icon"><Icon name="volume" /></div><div className="kpi-label">Total Activities</div><div className="kpi-value">{stats.total || 0}</div></div>
        <div className="kpi-card green"><div className="kpi-icon"><Icon name="check" /></div><div className="kpi-label">Allowed</div><div className="kpi-value">{stats.allowed || 0}</div></div>
        <div className="kpi-card orange"><div className="kpi-icon"><Icon name="shield" /></div><div className="kpi-label">MFA Required</div><div className="kpi-value">{stats.mfa || 0}</div></div>
        <div className="kpi-card red"><div className="kpi-icon"><Icon name="block" /></div><div className="kpi-label">Blocked</div><div className="kpi-value">{stats.blocked || 0}</div></div>
        <div className="kpi-card purple"><div className="kpi-icon"><Icon name="target" /></div><div className="kpi-label">Avg Risk Score</div><div className="kpi-value">{stats.avgRisk || 0}</div></div>
      </div>

      <div className="card">
        <div className="card-header">
          <h3>Activity Feed</h3>
          <span className="badge neutral">{activities.length} events</span>
        </div>
        <div className="card-body">
          {activities.length === 0 ? (
            <div className="empty-state">
              <div className="icon"><Icon name="refresh" size={48} /></div>
              <p>No activities recorded yet. Perform actions in the Banking System to see them here.</p>
            </div>
          ) : (
            <div className="activity-feed">
              {activities.map((a, i) => (
                <div className="activity-item" key={a.id || i}>
                  <div className={`activity-dot ${a.decision === 'BLOCK' ? 'block' : a.decision === 'REQUIRE_MFA' ? 'mfa' : 'allow'}`} />
                  <div className="activity-content">
                    <div className="activity-title">
                      <strong className="mono">{a.user_id}</strong> performed <strong>{a.action}</strong>
                    </div>
                    {a.amount > 0 && <div className="activity-detail">Amount: ₹{Number(a.amount).toLocaleString('en-IN')}</div>}
                    {a.reason && <div className="activity-detail" style={{color: a.decision === 'BLOCK' ? 'var(--danger)' : a.decision === 'REQUIRE_MFA' ? 'var(--warning)' : 'var(--text-muted)'}}>{a.reason}</div>}
                    <div className="activity-meta">
                      <span><Icon name="user" size={14} /> {a.role || 'Unknown'}</span>
                      <span><Icon name="phone" size={14} /> {a.device || 'Unknown'}</span>
                      <span><Icon name="clock" size={14} /> {a.timestamp || a.created_at}</span>
                    </div>
                  </div>
                  <div className="activity-score" style={{color: scoreColor(a.risk_score)}}>
                    {a.risk_score}
                    <span className="label">Risk</span>
                  </div>
                  <div>{decisionBadge(a.decision)}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
