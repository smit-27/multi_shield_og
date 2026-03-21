import React, { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip as RechartsTooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { apiFetch } from '../App';

// Timeline data for last 24 hours
const MOCK_TIMELINE = Array.from({ length: 24 }).map((_, i) => ({
  hour: `${i.toString().padStart(2, '0')}:00`,
  high: Math.floor(Math.random() * 10),
  medium: Math.floor(Math.random() * 20),
  low: Math.floor(Math.random() * 30),
}));

// === THEME CONSTANTS ===
const COLORS = {
  base: '#0A0C0F',
  surface: '#0F1217',
  elevated: '#151921',
  accent: '#3D7EFF',
  borderLight: 'rgba(255,255,255,0.055)',
  borderActive: 'rgba(255,255,255,0.11)',
  textPrimary: '#E8EAF0',
  textSecondary: '#6B7280',
  textTertiary: '#3D4451',
  mono: '#A8B5C8',
  highBg: 'rgba(139,38,53,0.15)',
  highText: '#C4404F',
  medBg: 'rgba(122,92,30,0.15)',
  medText: '#C49A3C',
  lowBg: 'rgba(28,74,53,0.15)',
  lowText: '#3D9E6E',
  neuBg: 'rgba(26,46,74,0.15)',
  neuText: '#4A8CC4',
};

const SectionHeader = ({ title }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '24px' }}>
    <span className="font-syne" style={{ fontSize: '14px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.12em', color: COLORS.textTertiary }}>
      {title}
    </span>
    <div style={{ flex: 1, height: '1px', backgroundColor: COLORS.borderLight }}></div>
  </div>
);

export default function AdminDashboard() {
  const [time, setTime] = useState(new Date().toLocaleTimeString('en-US', { hour12: false }));
  
  const [stats, setStats] = useState({
    highRiskEvents: 0,
    activeSessions: 0,
    eventsToday: 0
  });
  const [activities, setActivities] = useState([]);
  const [threats, setThreats] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchDashboardData = async () => {
    try {
      const [statsRes, activityRes, threatsRes] = await Promise.all([
        apiFetch('/api/dashboard/stats'),
        apiFetch('/api/dashboard/activity'),
        apiFetch('/api/dashboard/threats')
      ]);
      setStats(statsRes);
      setActivities(activityRes);
      setThreats(threatsRes);
      setTime(new Date().toLocaleTimeString('en-US', { hour12: false }));
    } catch (err) {
      console.error('Failed to fetch dashboard data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
    const timer = setInterval(fetchDashboardData, 10000); // refresh every 10s
    return () => clearInterval(timer);
  }, []);

  const getRiskStatus = (levelStr) => {
    const level = (levelStr || '').toLowerCase();
    if (level === 'high' || level === 'critical') return { bg: COLORS.highBg, text: COLORS.highText };
    if (level === 'medium' || level === 'warning') return { bg: COLORS.medBg, text: COLORS.medText };
    if (level === 'low' || level === 'safe') return { bg: COLORS.lowBg, text: COLORS.lowText };
    return { bg: COLORS.neuBg, text: COLORS.neuText };
  };

  return (
    <div className="flex-1 flex flex-col w-full h-full pb-10">
      
      {/* ── HEADER SECTION ── */}
      <section style={{ padding: '32px 40px', borderBottom: `1px solid ${COLORS.borderLight}`, backgroundColor: COLORS.base }}>
        <div className="flex justify-between items-baseline mb-2">
          <h1 className="font-syne" style={{ fontSize: '28px', fontWeight: 700, letterSpacing: '-0.02em', color: COLORS.textPrimary, margin: 0 }}>
            Unified Threat Landscape
          </h1>
          <div className="flex items-center gap-6">
            <span className="font-mono" style={{ fontSize: '13px', color: COLORS.textSecondary }}>LAST TELEMETRY PING: {time}</span>
            <button onClick={fetchDashboardData} className="flex items-center gap-2 cursor-pointer transition-fast" style={{ background: 'none', border: '1px solid transparent', padding: '6px 12px', borderRadius: '4px', outline: 'none', color: COLORS.textPrimary }} onMouseEnter={e => Object.assign(e.currentTarget.style, { backgroundColor: COLORS.surface, border: `1px solid ${COLORS.borderActive}` })} onMouseLeave={e => Object.assign(e.currentTarget.style, { backgroundColor: 'transparent', border: '1px solid transparent' })}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="square" strokeLinejoin="miter" className={loading ? "animate-spin" : ""}>
                <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.92-10.44l5.08 5.08" />
              </svg>
              <span style={{ fontSize: '13px', fontWeight: 500 }}>Resync</span>
            </button>
          </div>
        </div>
        <p style={{ fontSize: '15px', fontWeight: 400, color: COLORS.textSecondary, margin: 0, marginTop: '8px' }}>
          Live monitoring interface for zero-trust proxy events. <span style={{ color: COLORS.medText }}>ELEVATED THREAT VOLUME DETECTED.</span>
        </p>
      </section>

      {/* ── STATS SECTION ── */}
      <section style={{ padding: '32px 40px', borderBottom: `1px solid ${COLORS.borderLight}`, backgroundColor: COLORS.base }}>
        <SectionHeader title="System Telemetry" />
        <div className="grid grid-cols-4" style={{ gap: '24px' }}>
          {[
            { label: 'CRITICAL EVENTS', value: stats.highRiskEvents, delta: '+3 events', deltaColor: COLORS.highText, color: COLORS.highText },
            { label: 'ACTIVE SESSIONS', value: stats.activeSessions, delta: 'Stable', deltaColor: COLORS.lowText, color: COLORS.accent },
            { label: 'POLICY VIOLATIONS', value: activities.filter(a => a.action === 'BLOCKED').length, delta: '+12% avg', deltaColor: COLORS.highText, color: COLORS.medText },
            { label: 'EVENTS TODAY', value: stats.eventsToday, delta: '+2.4k total', deltaColor: COLORS.textSecondary, color: COLORS.accent }
          ].map((stat, idx) => (
            <div key={idx} style={{ 
              height: '116px', 
              backgroundColor: COLORS.surface, 
              padding: '24px', 
              borderLeft: `2px solid ${stat.color}`,
              borderRadius: '6px',
              display: 'flex', flexDirection: 'column', justifyContent: 'space-between'
            }}>
              <div style={{ fontSize: '12px', textTransform: 'uppercase', color: COLORS.textTertiary, fontWeight: 600, letterSpacing: '0.05em' }}>
                {stat.label}
              </div>
              <div className="flex justify-between items-baseline">
                <span className="font-mono" style={{ fontSize: '40px', color: COLORS.textPrimary, lineHeight: 1 }}>{stat.value}</span>
                <span style={{ fontSize: '13px', color: stat.deltaColor, fontWeight: 500 }}>{stat.delta}</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── MAIN CONTENT (TABLE + THREATS) ── */}
      <section style={{ display: 'flex', gap: '32px', padding: '32px 40px', borderBottom: `1px solid ${COLORS.borderLight}`, backgroundColor: COLORS.base }}>
        
        {/* Activity Feed (Fluid) */}
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
          <SectionHeader title="Live Activity Stream" />
          
          {/* Toolbar */}
          <div className="flex gap-6 mb-6">
            <input 
              type="text" 
              placeholder="Search user or IP..." 
              className="transition-fast"
              style={{ height: '40px', backgroundColor: COLORS.surface, border: `1px solid ${COLORS.borderLight}`, borderRadius: '4px', padding: '0 16px', fontSize: '15px', color: COLORS.textPrimary, outline: 'none', width: '280px' }} 
            />
            <select 
              className="transition-fast"
              style={{ height: '40px', backgroundColor: COLORS.surface, border: `1px solid ${COLORS.borderLight}`, borderRadius: '4px', padding: '0 16px', fontSize: '15px', color: COLORS.textPrimary, outline: 'none' }}>
              <option>Sort: Newest First</option>
              <option>Sort: Risk Descending</option>
            </select>
            <div className="flex items-center gap-4 ml-auto">
              {['High', 'Medium', 'Low'].map(l => (
                <button key={l} className="transition-fast" style={{ height: '40px', background: 'none', border: 'none', padding: '0 12px', fontSize: '15px', color: COLORS.textSecondary, cursor: 'pointer' }} onMouseEnter={e => e.currentTarget.style.color = '#fff'} onMouseLeave={e => e.currentTarget.style.color = COLORS.textSecondary}>
                  {l}
                </button>
              ))}
            </div>
          </div>

          {/* Table */}
          <div style={{ width: '100%', overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr>
                  {['#', 'User', 'Action', 'IP Address', 'Risk Score', 'Level', 'Time'].map(h => (
                    <th key={h} style={{ padding: '0 16px 16px 16px', fontSize: '12px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em', color: COLORS.textTertiary, borderBottom: `1px solid ${COLORS.borderLight}` }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {activities.map((act, i) => {
                  const statusInfo = getRiskStatus(act.riskLevel);
                  return (
                    <tr key={act.id} 
                        className="transition-fast"
                        style={{ height: '52px', borderBottom: `1px solid ${COLORS.borderLight}` }}
                        onMouseEnter={e => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.025)'}
                        onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
                    >
                      <td className="font-mono" style={{ padding: '0 16px', fontSize: '14px', color: COLORS.textTertiary }}>{(i+1).toString().padStart(2, '0')}</td>
                      <td style={{ padding: '0 16px', fontSize: '15px', color: COLORS.textPrimary }}>{act.username || act.userId}</td>
                      <td style={{ padding: '0 16px', fontSize: '15px', color: COLORS.textSecondary }}>{act.action}</td>
                      <td className="font-mono" style={{ padding: '0 16px', fontSize: '14px', color: COLORS.mono }}>{act.ipAddress || '10.x.x.x'}</td>
                      <td style={{ padding: '0 16px' }}>
                        <div className="flex items-center gap-4">
                          <span className="font-mono" style={{ fontSize: '15px', color: COLORS.mono, width: '28px' }}>{Math.round(act.riskScore)}</span>
                          <div style={{ width: '64px', height: '4px', backgroundColor: COLORS.borderLight, borderRadius: '2px' }}>
                            <div style={{ width: `${Math.min(100, act.riskScore)}%`, height: '100%', backgroundColor: statusInfo.text, opacity: 0.8, borderRadius: '2px' }}></div>
                          </div>
                        </div>
                      </td>
                      <td style={{ padding: '0 16px' }}>
                        <div className="flex items-center gap-3">
                          <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: statusInfo.text }}></div>
                          <span style={{ fontSize: '15px', color: COLORS.textPrimary, textTransform: 'capitalize' }}>{act.riskLevel}</span>
                        </div>
                      </td>
                      <td className="font-mono" style={{ padding: '0 16px', fontSize: '14px', color: COLORS.mono }}>
                        {new Date((typeof act.timestamp === 'string' && act.timestamp.includes(' ') && !act.timestamp.includes('Z')) ? act.timestamp.replace(' ', 'T') + 'Z' : act.timestamp).toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Threat Categories (Fixed Sidebar) */}
        <div style={{ width: '380px', display: 'flex', flexDirection: 'column' }}>
          <SectionHeader title="Threat Categories" />
          <div className="flex-1 flex flex-col gap-8 pt-4">
            {threats.map((t, i) => {
              // Pick a status color based on rank approx
              const color = i === 0 ? COLORS.highText : i < 3 ? COLORS.medText : COLORS.lowText;
              return (
                <div key={i} className="flex flex-col gap-3">
                  <div className="flex justify-between items-end">
                    <span style={{ fontSize: '15px', fontWeight: 500, color: COLORS.textSecondary }}>{t.category}</span>
                    <span className="font-mono" style={{ fontSize: '14px', color: COLORS.mono }}>{t.count}</span>
                  </div>
                  <div style={{ width: '100%', height: '4px', backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: '2px' }}>
                    <div style={{ width: `${(t.count / t.max) * 100}%`, height: '100%', backgroundColor: color, borderRadius: '2px' }}></div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* ── CHART SECTION ── */}
      <section style={{ padding: '32px 40px', backgroundColor: COLORS.base }}>
        <SectionHeader title="Volume Architecture · 24H" />
        <div style={{ height: '220px', width: '100%' }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={MOCK_TIMELINE} margin={{ top: 10, right: 0, left: -20, bottom: 0 }} barGap={0} barSize={12}>
              <CartesianGrid vertical={false} stroke="rgba(255,255,255,0.04)" strokeDasharray="3 3" />
              <XAxis 
                dataKey="hour" 
                axisLine={{ stroke: COLORS.borderLight }} 
                tickLine={false} 
                tick={{ fontSize: 13, fill: COLORS.textTertiary, fontFamily: 'IBM Plex Mono' }} 
                dy={16}
              />
              <YAxis 
                axisLine={false} 
                tickLine={false} 
                tick={{ fontSize: 13, fill: COLORS.textTertiary, fontFamily: 'IBM Plex Mono' }} 
              />
              <RechartsTooltip 
                cursor={{ fill: 'rgba(255,255,255,0.02)' }}
                contentStyle={{ backgroundColor: COLORS.elevated, border: `1px solid rgba(255,255,255,0.1)`, borderRadius: 0, fontFamily: 'IBM Plex Mono', fontSize: '12px', boxShadow: 'none' }}
                itemStyle={{ color: COLORS.textPrimary }}
              />
              <Bar dataKey="low" stackId="a" fill={COLORS.lowText} isAnimationActive={false} />
              <Bar dataKey="medium" stackId="a" fill={COLORS.medText} isAnimationActive={false} />
              <Bar dataKey="high" stackId="a" fill={COLORS.highText} isAnimationActive={false} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>

    </div>
  );
}
