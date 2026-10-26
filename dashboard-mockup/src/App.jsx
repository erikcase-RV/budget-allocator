import React, { useState, useEffect } from 'react';
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  ScatterChart, Scatter, ZAxis
} from 'recharts';
import {
  TrendingUp, DollarSign, MousePointer, AlertTriangle,
  CheckCircle, Target, ArrowUpRight, ArrowDownRight,
  Layers, Clock, XCircle
} from 'lucide-react';
import RecommenderTab from './RecommenderTab';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const COLORS = {
  google: '#4285F4',
  bing: '#00A4EF',
  meta: '#1877F2',
  taboola: '#FF6B35'
};

const PLATFORM_COLOR_MAP = {
  Google: COLORS.google,
  Bing: COLORS.bing,
  Microsoft: COLORS.bing,
  Meta: COLORS.meta,
  Taboola: COLORS.taboola,
};

function colorFor(platform) {
  return PLATFORM_COLOR_MAP[platform] || '#6B7280';
}

const VERTICALS = [
  { value: 'deposits', label: 'Deposits' },
  { value: 'mortgages', label: 'Mortgages' },
  { value: 'home equity', label: 'Home Equity' },
  { value: 'all', label: 'All Verticals' },
];

const STATUS_STYLES = {
  in_flight: { label: 'In Flight', bg: 'bg-green-50', text: 'text-green-700', icon: CheckCircle },
  recently_ended: { label: 'Recently Ended', bg: 'bg-amber-50', text: 'text-amber-700', icon: Clock },
  stale: { label: 'Stale', bg: 'bg-gray-100', text: 'text-gray-500', icon: XCircle },
};

const fmt = {
  usd: (v) => `$${Number(v || 0).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`,
  usd2: (v) => `$${Number(v || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
  pct: (v) => `${Number(v || 0).toFixed(1)}%`,
  roas: (v) => `${Number(v || 0).toFixed(2)}x`,
  num: (v) => Number(v || 0).toLocaleString(),
};

// ---------------------------------------------------------------------------
// Transform helpers
// ---------------------------------------------------------------------------
function transformPlatformRollups(rows) {
  const byPlatform = {};
  for (const row of rows) {
    if (row.window !== '7d') continue;
    byPlatform[row.platform] = row;
  }
  const totalCost = Object.values(byPlatform).reduce((s, r) => s + Number(r.cost), 0);
  return Object.values(byPlatform).map((r) => ({
    platform: r.platform,
    clicks_7d: Number(r.clicks_7d || r.clicks),
    cost_7d: Number(r.cost),
    revenue_7d: Number(r.revenue),
    roas_7d: Number(r.roas) || 0,
    allocation: totalCost > 0 ? Math.round((Number(r.cost) / totalCost) * 1000) / 10 : 0,
    cpc: Number(r.cpc) || 0,
    rpc: Number(r.rpc) || 0,
    color: colorFor(r.platform),
  }));
}

function transformDailyRoas(rows) {
  const byDate = {};
  for (const row of rows) {
    const d = String(row.date).slice(5, 10).replace('-', '/');
    if (!byDate[d]) byDate[d] = { date: d };
    byDate[d][row.platform.toLowerCase()] = Number(row.roas) || 0;
  }
  return Object.values(byDate).sort((a, b) => (a.date > b.date ? 1 : -1));
}

function transformEfficiency(rows) {
  return rows.map((r) => ({
    platform: r.platform,
    cpc: Number(r.cpc) || 0,
    rpc: Number(r.rpc) || 0,
    volume: Number(r.volume) || 0,
    color: colorFor(r.platform),
  }));
}

function deriveAllocation(platformData) {
  const totalCost = platformData.reduce((s, p) => s + p.cost_7d, 0);
  return platformData.map((p) => ({
    name: p.platform,
    value: totalCost > 0 ? Math.round((p.cost_7d / totalCost) * 1000) / 10 : 0,
    color: p.color,
  }));
}

// ---------------------------------------------------------------------------
// Shared UI components
// ---------------------------------------------------------------------------
function KPICard({ title, value, subtitle, trend, icon: Icon, color = 'blue' }) {
  const trendUp = trend > 0;
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
      <div className="flex justify-between items-start">
        <div>
          <p className="text-sm font-medium text-gray-500">{title}</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{value}</p>
          {subtitle && <p className="text-xs text-gray-400 mt-1">{subtitle}</p>}
        </div>
        <div className={`p-2 rounded-lg bg-${color}-50`}>
          <Icon className={`w-5 h-5 text-${color}-500`} />
        </div>
      </div>
      {trend !== undefined && (
        <div className={`flex items-center mt-3 text-sm ${trendUp ? 'text-green-600' : 'text-red-600'}`}>
          {trendUp ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />}
          <span className="ml-1">{Math.abs(trend)}% vs last week</span>
        </div>
      )}
    </div>
  );
}

function LoadingSpinner() {
  return (
    <div className="flex items-center justify-center py-20">
      <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-500" />
    </div>
  );
}

function ErrorBanner({ message }) {
  return (
    <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-700">
      <strong>Error loading data:</strong> {message}
    </div>
  );
}

function StatusBadge({ status }) {
  const s = STATUS_STYLES[status] || STATUS_STYLES.stale;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${s.bg} ${s.text}`}>
      <s.icon className="w-3 h-3" />
      {s.label}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Platform-level components (kept from original)
// ---------------------------------------------------------------------------
function AllocationPie({ data, title = 'Actual Allocation' }) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">{title}</h3>
      <div className="flex items-center">
        <ResponsiveContainer width="50%" height={200}>
          <PieChart>
            <Pie data={data} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={2} dataKey="value">
              {data.map((entry, i) => (<Cell key={i} fill={entry.color} />))}
            </Pie>
            <Tooltip formatter={(v) => `${v}%`} />
          </PieChart>
        </ResponsiveContainer>
        <div className="space-y-3">
          {data.map((item) => (
            <div key={item.name} className="flex items-center">
              <div className="w-3 h-3 rounded-full mr-2" style={{ backgroundColor: item.color }} />
              <span className="text-sm text-gray-600">{item.name}</span>
              <span className="ml-2 text-sm font-semibold text-gray-900">{item.value}%</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function ROASTrend({ data }) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">7-Day Rolling ROAS Trend</h3>
      <ResponsiveContainer width="100%" height={250}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis dataKey="date" tick={{ fontSize: 12 }} stroke="#9ca3af" />
          <YAxis tick={{ fontSize: 12 }} stroke="#9ca3af" />
          <Tooltip />
          <Legend />
          <Line type="monotone" dataKey="google" stroke={COLORS.google} strokeWidth={2} dot={false} name="Google" />
          <Line type="monotone" dataKey="meta" stroke={COLORS.meta} strokeWidth={2} dot={false} name="Meta" />
          <Line type="monotone" dataKey="taboola" stroke={COLORS.taboola} strokeWidth={2} dot={false} name="Taboola" />
          <Line type="monotone" dataKey="bing" stroke={COLORS.bing} strokeWidth={2} dot={false} name="Bing" />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

function EfficiencyScatter({ data }) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
      <h3 className="text-lg font-semibold text-gray-900 mb-2">Efficiency Matrix</h3>
      <p className="text-xs text-gray-500 mb-4">CPC vs RPC (bubble size = click volume)</p>
      <ResponsiveContainer width="100%" height={250}>
        <ScatterChart margin={{ top: 10, right: 10, bottom: 10, left: 10 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis type="number" dataKey="cpc" name="CPC" unit="$" tick={{ fontSize: 12 }} stroke="#9ca3af" />
          <YAxis type="number" dataKey="rpc" name="RPC" unit="$" tick={{ fontSize: 12 }} stroke="#9ca3af" />
          <ZAxis type="number" dataKey="volume" range={[100, 1000]} />
          <Tooltip cursor={{ strokeDasharray: '3 3' }} formatter={(v, name) => [`$${v.toFixed(2)}`, name]} />
          {data.map((entry, i) => (<Scatter key={i} name={entry.platform} data={[entry]} fill={entry.color} />))}
        </ScatterChart>
      </ResponsiveContainer>
    </div>
  );
}

function PlatformTable({ data }) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Platform Performance (7d)</h3>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-gray-500 border-b border-gray-100">
              <th className="pb-3 font-medium">Platform</th>
              <th className="pb-3 font-medium text-right">Clicks</th>
              <th className="pb-3 font-medium text-right">Cost</th>
              <th className="pb-3 font-medium text-right">Revenue</th>
              <th className="pb-3 font-medium text-right">ROAS</th>
              <th className="pb-3 font-medium text-right">CPC</th>
              <th className="pb-3 font-medium text-right">RPC</th>
              <th className="pb-3 font-medium text-right">Actual Allocation</th>
            </tr>
          </thead>
          <tbody>
            {data.map((row) => (
              <tr key={row.platform} className="border-b border-gray-50 hover:bg-gray-50">
                <td className="py-3 font-medium text-gray-900">{row.platform}</td>
                <td className="py-3 text-right text-gray-600">{fmt.num(row.clicks_7d)}</td>
                <td className="py-3 text-right text-gray-600">{fmt.usd(row.cost_7d)}</td>
                <td className="py-3 text-right text-gray-600">{fmt.usd(row.revenue_7d)}</td>
                <td className="py-3 text-right font-semibold text-gray-900">{fmt.roas(row.roas_7d)}</td>
                <td className="py-3 text-right text-gray-600">{fmt.usd2(row.cpc)}</td>
                <td className="py-3 text-right text-gray-600">{fmt.usd2(row.rpc)}</td>
                <td className="py-3 text-right">
                  <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-50 text-blue-700">
                    {fmt.pct(row.allocation)}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function AlertsPanel({ alerts }) {
  const iconMap = { warning: AlertTriangle, info: Target, success: CheckCircle };
  const colorMap = {
    warning: 'text-amber-500 bg-amber-50',
    info: 'text-blue-500 bg-blue-50',
    success: 'text-green-500 bg-green-50',
  };
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Data Quality Alerts</h3>
      <div className="space-y-3">
        {alerts.map((alert, i) => {
          const Icon = iconMap[alert.type];
          const colors = colorMap[alert.type];
          return (
            <div key={i} className="flex items-start gap-3">
              <div className={`p-1.5 rounded-lg ${colors.split(' ')[1]}`}>
                <Icon className={`w-4 h-4 ${colors.split(' ')[0]}`} />
              </div>
              <p className="text-sm text-gray-600">{alert.message}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function BudgetSimulator({ platformData }) {
  const [budget, setBudget] = useState(100000);
  const totalCost = platformData.reduce((s, p) => s + p.cost_7d, 0);
  const projected = {};
  for (const p of platformData) {
    const share = totalCost > 0 ? p.cost_7d / totalCost : 0;
    projected[p.platform.toLowerCase()] = budget * share * (p.roas_7d || 0);
  }
  const total = Object.values(projected).reduce((s, v) => s + v, 0);
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Budget Simulator</h3>
      <div className="mb-4">
        <label className="block text-sm text-gray-600 mb-2">
          Weekly Budget: <span className="font-semibold">${budget.toLocaleString()}</span>
        </label>
        <input type="range" min="10000" max="500000" step="10000" value={budget}
          onChange={(e) => setBudget(Number(e.target.value))}
          className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer" />
        <div className="flex justify-between text-xs text-gray-400 mt-1">
          <span>$10K</span><span>$500K</span>
        </div>
      </div>
      <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg p-4">
        <p className="text-sm text-gray-600">Projected Weekly Revenue</p>
        <p className="text-3xl font-bold text-gray-900 mt-1">${Math.round(total).toLocaleString()}</p>
        <p className="text-sm text-green-600 mt-1">Blended ROAS: {(total / budget).toFixed(2)}x</p>
      </div>
      <div className="mt-4 space-y-2">
        {Object.entries(projected).map(([platform, rev]) => (
          <div key={platform} className="flex justify-between text-sm">
            <span className="text-gray-600 capitalize">{platform}</span>
            <span className="font-medium text-gray-900">${Math.round(rev).toLocaleString()}</span>
          </div>
        ))}
      </div>
      <p className="mt-4 text-xs text-gray-400 italic">
        Assumes linear scaling. Actual ROAS typically decreases at higher spend due to diminishing returns.
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Campaign-level components
// ---------------------------------------------------------------------------
function CampaignMetricsTable({ rows, window = '7d', onSelect }) {
  const filtered = rows.filter((r) => r.window === window);
  if (!filtered.length) return <p className="text-sm text-gray-400 py-4">No campaign data for {window} window.</p>;

  const totalCost = filtered.reduce((s, r) => s + Number(r.cost || 0), 0);

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-gray-500 border-b border-gray-100">
            <th className="pb-3 font-medium">Campaign</th>
            <th className="pb-3 font-medium">Platform</th>
            <th className="pb-3 font-medium text-right">Cost</th>
            <th className="pb-3 font-medium text-right">Clicks</th>
            <th className="pb-3 font-medium text-right">Revenue</th>
            <th className="pb-3 font-medium text-right">ROAS</th>
            <th className="pb-3 font-medium text-right">CPC</th>
            <th className="pb-3 font-medium text-right">RPC</th>
            <th className="pb-3 font-medium text-right">Actual Alloc.</th>
            <th className="pb-3 font-medium">Status</th>
          </tr>
        </thead>
        <tbody>
          {filtered.map((r, i) => {
            const alloc = totalCost > 0 ? (Number(r.cost) / totalCost) * 100 : 0;
            return (
              <tr key={`${r.campaign_key}-${i}`}
                className="border-b border-gray-50 hover:bg-blue-50 cursor-pointer"
                onClick={() => onSelect && onSelect(r.campaign_key)}
              >
                <td className="py-2 text-gray-900 max-w-xs truncate" title={r.campaign_name}>{r.campaign_name}</td>
                <td className="py-2 text-gray-600">{r.platform}</td>
                <td className="py-2 text-right text-gray-600">{fmt.usd(r.cost)}</td>
                <td className="py-2 text-right text-gray-600">{fmt.num(r.clicks)}</td>
                <td className="py-2 text-right text-gray-600">{fmt.usd(r.revenue)}</td>
                <td className="py-2 text-right font-semibold text-gray-900">{fmt.roas(r.roas)}</td>
                <td className="py-2 text-right text-gray-600">{fmt.usd2(r.cpc)}</td>
                <td className="py-2 text-right text-gray-600">{fmt.usd2(r.rpc)}</td>
                <td className="py-2 text-right">
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700">
                    {fmt.pct(alloc)}
                  </span>
                </td>
                <td className="py-2">{r.status_bucket && <StatusBadge status={r.status_bucket} />}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function CampaignStatusSection({ title, campaigns, icon: Icon, accentClass }) {
  if (!campaigns || !campaigns.length) return null;
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
      <div className="flex items-center gap-2 mb-4">
        <Icon className={`w-5 h-5 ${accentClass}`} />
        <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
        <span className="ml-auto text-xs text-gray-400">{campaigns.length} campaigns</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-gray-500 border-b border-gray-100">
              <th className="pb-2 font-medium">Campaign</th>
              <th className="pb-2 font-medium">Platform</th>
              <th className="pb-2 font-medium">Channel</th>
              <th className="pb-2 font-medium text-right">Cost (7d)</th>
              <th className="pb-2 font-medium text-right">Revenue (7d)</th>
              <th className="pb-2 font-medium text-right">ROAS (7d)</th>
              <th className="pb-2 font-medium">Last Seen</th>
            </tr>
          </thead>
          <tbody>
            {campaigns.map((c, i) => (
              <tr key={i} className="border-b border-gray-50 hover:bg-gray-50">
                <td className="py-2 text-gray-900 max-w-xs truncate" title={c.campaign_name}>{c.campaign_name}</td>
                <td className="py-2 text-gray-600">{c.platform}</td>
                <td className="py-2 text-gray-600">{c.channel || '-'}</td>
                <td className="py-2 text-right text-gray-600">{fmt.usd(c.cost_7d)}</td>
                <td className="py-2 text-right text-gray-600">{fmt.usd(c.revenue_7d)}</td>
                <td className="py-2 text-right font-semibold text-gray-900">{fmt.roas(c.roas_7d)}</td>
                <td className="py-2 text-gray-500 text-xs">{c.last_seen_date}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function CampaignDetail({ campaignKey, rollups, onBack }) {
  const rows = rollups.filter((r) => r.campaign_key === campaignKey);
  if (!rows.length) return <p className="text-sm text-gray-500">No data for this campaign.</p>;

  const meta = rows[0];
  const windows = ['7d', '14d', '28d'];

  return (
    <div className="space-y-4">
      <button onClick={onBack}
        className="text-sm text-blue-600 hover:text-blue-800 font-medium">&larr; Back to all campaigns</button>
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
        <h3 className="text-lg font-semibold text-gray-900 mb-1">{meta.campaign_name}</h3>
        <div className="flex flex-wrap gap-4 text-sm text-gray-500 mb-4">
          <span>Platform: <strong className="text-gray-700">{meta.platform}</strong></span>
          <span>Channel: <strong className="text-gray-700">{meta.channel || '-'}</strong></span>
          <span>Search: <strong className="text-gray-700">{meta.search || '-'}</strong></span>
          <span>Key: <code className="text-xs bg-gray-100 px-1 rounded">{meta.campaign_key}</code></span>
          <span>Last Seen: <strong className="text-gray-700">{meta.last_seen_date}</strong></span>
          {meta.status_bucket && <StatusBadge status={meta.status_bucket} />}
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-gray-500 border-b border-gray-100">
              <th className="pb-2 font-medium">Window</th>
              <th className="pb-2 font-medium text-right">Cost</th>
              <th className="pb-2 font-medium text-right">Clicks</th>
              <th className="pb-2 font-medium text-right">Revenue</th>
              <th className="pb-2 font-medium text-right">ROAS</th>
              <th className="pb-2 font-medium text-right">CPC</th>
              <th className="pb-2 font-medium text-right">RPC</th>
            </tr>
          </thead>
          <tbody>
            {windows.map((w) => {
              const r = rows.find((x) => x.window === w);
              if (!r) return null;
              return (
                <tr key={w} className="border-b border-gray-50">
                  <td className="py-2 font-medium text-gray-900">{w}</td>
                  <td className="py-2 text-right text-gray-600">{fmt.usd(r.cost)}</td>
                  <td className="py-2 text-right text-gray-600">{fmt.num(r.clicks)}</td>
                  <td className="py-2 text-right text-gray-600">{fmt.usd(r.revenue)}</td>
                  <td className="py-2 text-right font-semibold text-gray-900">{fmt.roas(r.roas)}</td>
                  <td className="py-2 text-right text-gray-600">{fmt.usd2(r.cpc)}</td>
                  <td className="py-2 text-right text-gray-600">{fmt.usd2(r.rpc)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tabs
// ---------------------------------------------------------------------------
function TabBar({ tabs, active, onChange }) {
  return (
    <div className="flex border-b border-gray-200 gap-6">
      {tabs.map((t) => (
        <button key={t.value} onClick={() => onChange(t.value)}
          className={`pb-2 text-sm font-medium transition-colors ${active === t.value
            ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500 hover:text-gray-700'}`}>
          {t.label}
        </button>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Error Boundary
// ---------------------------------------------------------------------------
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  componentDidCatch(error, info) {
    console.error('React render error:', error, info);
    this.setState({ errorInfo: info });
  }
  render() {
    if (this.state.hasError) {
      const { error, errorInfo } = this.state;
      return (
        <div className="min-h-screen bg-gray-50 p-10">
          <div className="bg-red-50 border border-red-200 rounded-lg p-6 max-w-4xl mx-auto space-y-4">
            <h2 className="text-lg font-semibold text-red-800">Something went wrong</h2>
            <div>
              <h3 className="text-sm font-semibold text-red-700 mb-1">Error message:</h3>
              <pre className="text-xs text-red-700 whitespace-pre-wrap bg-red-100 p-3 rounded overflow-auto max-h-32">{String(error)}</pre>
            </div>
            {error && error.stack && (
              <div>
                <h3 className="text-sm font-semibold text-red-700 mb-1">Stack trace:</h3>
                <pre className="text-xs text-red-600 whitespace-pre-wrap bg-red-100 p-3 rounded overflow-auto max-h-48">{error.stack}</pre>
              </div>
            )}
            {errorInfo && errorInfo.componentStack && (
              <div>
                <h3 className="text-sm font-semibold text-red-700 mb-1">Component stack:</h3>
                <pre className="text-xs text-red-600 whitespace-pre-wrap bg-red-100 p-3 rounded overflow-auto max-h-48">{errorInfo.componentStack}</pre>
              </div>
            )}
            <button onClick={() => { this.setState({ hasError: false, error: null, errorInfo: null }); window.location.reload(); }}
              className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm hover:bg-red-700">Reload</button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

// ---------------------------------------------------------------------------
// Main App
// ---------------------------------------------------------------------------
function Dashboard() {
  // Filters
  const [vertical, setVertical] = useState('deposits');
  const [subVertical, setSubVertical] = useState('');
  const [subVerticals, setSubVerticals] = useState([]);
  const [platform, setPlatform] = useState('');
  const [selectedCampaignKey, setSelectedCampaignKey] = useState(null);

  // Tab
  const [tab, setTab] = useState('overview');

  // Platform-level data (phase 1)
  const [platformData, setPlatformData] = useState([]);
  const [trendData, setTrendData] = useState([]);
  const [efficiencyData, setEfficiencyData] = useState([]);
  const [alerts, setAlerts] = useState([]);

  // Campaign-level data (phase 2)
  const [campaignOptions, setCampaignOptions] = useState([]);
  const [campaignRollups, setCampaignRollups] = useState([]);
  const [campaignStatus, setCampaignStatus] = useState(null);

  const [loading, setLoading] = useState(true);
  const [campaignLoading, setCampaignLoading] = useState(true);
  const [error, setError] = useState(null);

  // Build shared query string
  function qs(extra = {}) {
    const params = new URLSearchParams({ vertical, ...extra });
    if (subVertical) params.set('sub_vertical', subVertical);
    if (platform) params.set('platform', platform);
    return `?${params.toString()}`;
  }

  // Fetch sub-verticals when vertical changes
  useEffect(() => {
    async function fetchSubVerticals() {
      try {
        const res = await fetch(`/api/sub-verticals?vertical=${encodeURIComponent(vertical)}`);
        if (!res.ok) throw new Error(`Failed to fetch sub-verticals: ${res.status}`);
        const data = await res.json();
        setSubVerticals(data);
        setSubVertical('');
      } catch (err) {
        console.error('Error fetching sub-verticals:', err);
        setSubVerticals([]);
        setSubVertical('');
      }
    }
    fetchSubVerticals();
  }, [vertical]);

  // Phase 1: platform data (fires first so Overview renders quickly)
  useEffect(() => {
    async function fetchPlatform() {
      setLoading(true);
      setError(null);
      setSelectedCampaignKey(null);
      try {
        const q = qs();
        const [rollupRes, trendRes, effRes, alertRes] = await Promise.all([
          fetch(`/api/platform-rollups${q}`),
          fetch(`/api/daily-roas${q}`),
          fetch(`/api/efficiency${q}`),
          fetch(`/api/alerts${q}`),
        ]);
        for (const r of [rollupRes, trendRes, effRes, alertRes]) {
          if (!r.ok) throw new Error(`${r.url.split('?')[0].split('/').pop()} returned ${r.status}`);
        }
        const [rollupJ, trendJ, effJ, alertJ] = await Promise.all([
          rollupRes.json(), trendRes.json(), effRes.json(), alertRes.json(),
        ]);
        setPlatformData(transformPlatformRollups(rollupJ));
        setTrendData(transformDailyRoas(trendJ));
        setEfficiencyData(transformEfficiency(effJ));
        setAlerts(Array.isArray(alertJ) ? alertJ : []);
      } catch (err) {
        console.error('Platform fetch error:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    fetchPlatform();
  }, [vertical, subVertical, platform]);

  // Phase 2: campaign data (fires after platform data is done)
  useEffect(() => {
    if (loading) return;
    async function fetchCampaigns() {
      setCampaignLoading(true);
      try {
        const q = qs();
        const [campOptRes, campRollRes, campStatRes] = await Promise.all([
          fetch(`/api/campaign-options${q}`),
          fetch(`/api/campaign-rollups${q}`),
          fetch(`/api/campaign-status${q}`),
        ]);
        for (const r of [campOptRes, campRollRes, campStatRes]) {
          if (!r.ok) throw new Error(`${r.url.split('?')[0].split('/').pop()} returned ${r.status}`);
        }
        const [coJ, crJ, csJ] = await Promise.all([
          campOptRes.json(), campRollRes.json(), campStatRes.json(),
        ]);
        setCampaignOptions(Array.isArray(coJ) ? coJ : []);
        setCampaignRollups(Array.isArray(crJ) ? crJ : []);
        setCampaignStatus(csJ && typeof csJ === 'object' ? csJ : null);
      } catch (err) {
        console.error('Campaign fetch error:', err);
        // Non-fatal: campaign tabs will show an inline message
        setCampaignOptions([]);
        setCampaignRollups([]);
        setCampaignStatus(null);
      } finally {
        setCampaignLoading(false);
      }
    }
    fetchCampaigns();
  }, [loading, vertical, subVertical, platform]);

  if (loading) return <div className="min-h-screen bg-gray-50 flex items-center justify-center"><LoadingSpinner /></div>;
  if (error) return <div className="min-h-screen bg-gray-50 p-10"><ErrorBanner message={error} /></div>;

  // Diagnostic: log raw data shapes to help debug render errors
  console.log('[Dashboard render]', {
    platformData_len: platformData.length,
    platformData_sample: platformData[0],
    campaignOptions_len: campaignOptions?.length,
    campaignOptions_sample: campaignOptions?.[0],
    campaignRollups_len: campaignRollups?.length,
    campaignRollups_sample: campaignRollups?.[0],
    campaignStatus_type: typeof campaignStatus,
    campaignStatus_keys: campaignStatus ? Object.keys(campaignStatus) : null,
    alerts_len: alerts?.length,
    alerts_sample: alerts?.[0],
  });

  const allocationData = deriveAllocation(platformData);
  const totalSpend = platformData.reduce((s, p) => s + p.cost_7d, 0);
  const totalRevenue = platformData.reduce((s, p) => s + p.revenue_7d, 0);
  const blendedROAS = totalSpend > 0 ? totalRevenue / totalSpend : 0;
  const totalClicks = platformData.reduce((s, p) => s + p.clicks_7d, 0);
  const campaignCount = Array.isArray(campaignOptions) ? campaignOptions.length : 0;

  // Replaced useMemo with plain computation + String() coercion
  let platformList = [];
  try {
    if (Array.isArray(campaignOptions) && campaignOptions.length) {
      const set = new Set(campaignOptions.map((c) => String(c.platform || '')));
      set.delete('');
      platformList = Array.from(set).sort();
    }
  } catch (e) {
    console.error('Error computing platformList:', e);
  }

  const TABS = [
    { value: 'overview', label: 'Overview' },
    { value: 'campaigns', label: `Campaigns (${campaignCount})` },
    { value: 'status', label: 'Campaign Status' },
    { value: 'recommender', label: 'Recommender' },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Budget Allocator</h1>
            <p className="text-sm text-gray-500">Paid Media Optimization</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <select value={vertical} onChange={(e) => setVertical(e.target.value)}
              className="text-sm border border-gray-300 rounded-lg px-3 py-1.5 bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500">
              {VERTICALS.map((v) => <option key={v.value} value={v.value}>{v.label}</option>)}
            </select>
            {subVerticals.length > 0 && (
              <select value={subVertical} onChange={(e) => setSubVertical(e.target.value)}
                className="text-sm border border-gray-300 rounded-lg px-3 py-1.5 bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="">All Sub-Verticals</option>
                {subVerticals.map((sv) => <option key={sv.value} value={sv.value}>{sv.label}</option>)}
              </select>
            )}
            <select value={platform} onChange={(e) => setPlatform(e.target.value)}
              className="text-sm border border-gray-300 rounded-lg px-3 py-1.5 bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="">All Platforms</option>
              {platformList.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
            <span className="text-xs text-gray-400">
              {new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
            </span>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-6 space-y-6">
        {/* KPIs */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <KPICard title="Total Cost (7d)" value={fmt.usd(totalSpend)}
            subtitle={`${platformData.length} platforms, ${campaignCount} campaigns`} icon={DollarSign} color="blue" />
          <KPICard title="Total Revenue (7d)" value={fmt.usd(totalRevenue)}
            subtitle="FF attributed revenue" icon={TrendingUp} color="green" />
          <KPICard title="Blended ROAS" value={fmt.roas(blendedROAS)}
            subtitle="Revenue / Cost" icon={Target} color="purple" />
          <KPICard title="Total Clicks (7d)" value={fmt.num(totalClicks)}
            subtitle="Paid clicks across platforms" icon={MousePointer} color="indigo" />
        </div>

        {/* Tabs */}
        <TabBar tabs={TABS} active={tab} onChange={(t) => { setTab(t); setSelectedCampaignKey(null); }} />

        {/* Tab: Overview */}
        {tab === 'overview' && (
          <>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <AllocationPie data={allocationData} title="Actual Allocation" />
              <div className="lg:col-span-2"><ROASTrend data={trendData} /></div>
            </div>
            <PlatformTable data={platformData} />
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <EfficiencyScatter data={efficiencyData} />
              <BudgetSimulator platformData={platformData} />
              <AlertsPanel alerts={alerts} />
            </div>
          </>
        )}

        {/* Tab: Campaigns */}
        {tab === 'campaigns' && (
          campaignLoading ? <LoadingSpinner />
          : selectedCampaignKey
            ? <CampaignDetail campaignKey={selectedCampaignKey} rollups={campaignRollups}
                onBack={() => setSelectedCampaignKey(null)} />
            : (
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-gray-900">Campaign Rollups (7d)</h3>
                  <span className="text-xs text-gray-400">Click a row for details</span>
                </div>
                <CampaignMetricsTable rows={campaignRollups} window="7d"
                  onSelect={(key) => setSelectedCampaignKey(key)} />
              </div>
            )
        )}

        {/* Tab: Campaign Status */}
        {tab === 'status' && campaignLoading && <LoadingSpinner />}
        {tab === 'status' && !campaignLoading && campaignStatus && (
          <div className="space-y-6">
            {/* Summary cards */}
            {campaignStatus.summary && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {campaignStatus.summary.map((s) => {
                  const style = STATUS_STYLES[s.status_bucket] || STATUS_STYLES.stale;
                  return (
                    <div key={s.status_bucket} className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
                      <div className="flex items-center gap-2 mb-2">
                        <style.icon className={`w-5 h-5 ${style.text}`} />
                        <h4 className="font-semibold text-gray-900">{style.label}</h4>
                      </div>
                      <p className="text-2xl font-bold text-gray-900">{s.campaigns}</p>
                      <p className="text-xs text-gray-400 mt-1">
                        Cost: {fmt.usd(s.cost_7d)} &middot; Rev: {fmt.usd(s.revenue_7d)} &middot; ROAS: {fmt.roas(s.roas_7d)}
                      </p>
                    </div>
                  );
                })}
              </div>
            )}
            <CampaignStatusSection title="In Flight" campaigns={campaignStatus.in_flight}
              icon={CheckCircle} accentClass="text-green-600" />
            <CampaignStatusSection title="Recently Ended" campaigns={campaignStatus.recently_ended}
              icon={Clock} accentClass="text-amber-600" />
            <CampaignStatusSection title="Stale" campaigns={campaignStatus.stale}
              icon={XCircle} accentClass="text-gray-400" />
          </div>
        )}

        {/* Tab: Recommender */}
        {tab === 'recommender' && <RecommenderTab />}
      </main>
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <Dashboard />
    </ErrorBoundary>
  );
}
