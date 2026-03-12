export default function KpiCard({ icon, label, value, change, color = 'blue' }) {
  return (
    <div className={`kpi-card ${color}`}>
      <div className="kpi-icon">{icon}</div>
      <div className="kpi-label">{label}</div>
      <div className="kpi-value">{value}</div>
      {change && (
        <div className={`kpi-change ${change.startsWith('+') || change.startsWith('↑') ? 'up' : 'down'}`}>
          {change}
        </div>
      )}
    </div>
  )
}
