import React, { useState, useEffect } from 'react';
import { 
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  ScatterChart, Scatter, ZAxis
} from 'recharts';
import { 
  TrendingUp, DollarSign, MousePointer, AlertTriangle, 
  CheckCircle, Target, ArrowUpRight, ArrowDownRight
} from 'lucide-react';

const COLORS = {
  google: '#4285F4',
  bing: '#00A4EF',
  whale: '#9333EA',
  meta: '#1877F2',
  taboola: '#FF6B35'
};

const PLATFORM_COLOR_MAP = {
  Google: COLORS.google,
  Bing: COLORS.bing,
  Microsoft: COLORS.bing,
  Meta: COLORS.meta,
  Taboola: COLORS.taboola,
  Whale: COLORS.whale,
};

function colorFor(platform) {
  return PLATFORM_COLOR_MAP[platform] || '#6B7280';
}

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

function AllocationPie({ data }) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Recommended Allocation</h3>
      <div className="flex items-center">
        <ResponsiveContainer width="50%" height={200}>
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={50}
              outerRadius={80}
              paddingAngle={2}
              dataKey="value"
            >
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
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
          <Line type="monotone" dataKey="whale" stroke={COLORS.whale} strokeWidth={2} dot={false} name="Whale" />
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
          {data.map((entry, index) => (
            <Scatter key={index} name={entry.platform} data={[entry]} fill={entry.color} />
          ))}
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
              <th className="pb-3 font-medium text-right">Allocation</th>
            </tr>
          </thead>
          <tbody>
            {data.map((row) => (
              <tr key={row.platform} className="border-b border-gray-50 hover:bg-gray-50">
                <td className="py-3 font-medium text-gray-900">{row.platform}</td>
                <td className="py-3 text-right text-gray-600">{row.clicks_7d.toLocaleString()}</td>
                <td className="py-3 text-right text-gray-600">${row.cost_7d.toLocaleString()}</td>
                <td className="py-3 text-right text-gray-600">${row.revenue_7d.toLocaleString()}</td>
                <td className="py-3 text-right font-semibold text-gray-900">{row.roas_7d.toFixed(2)}x</td>
                <td className="py-3 text-right text-gray-600">${row.cpc.toFixed(2)}</td>
                <td className="py-3 text-right text-gray-600">${row.rpc.toFixed(2)}</td>
                <td className="py-3 text-right">
                  <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-50 text-blue-700">
                    {row.allocation}%
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
  const iconMap = {
    warning: AlertTriangle,
    info: Target,
    success: CheckCircle,
  };
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
        <input
          type="range"
          min="10000"
          max="500000"
          step="10000"
          value={budget}
          onChange={(e) => setBudget(Number(e.target.value))}
          className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
        />
        <div className="flex justify-between text-xs text-gray-400 mt-1">
          <span>$10K</span>
          <span>$500K</span>
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

export default function App() {
  const [platformData, setPlatformData] = useState([]);
  const [trendData, setTrendData] = useState([]);
  const [efficiencyData, setEfficiencyData] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function fetchAll() {
      try {
        const [rollupRes, trendRes, effRes, alertRes] = await Promise.all([
          fetch('/api/platform-rollups'),
          fetch('/api/daily-roas'),
          fetch('/api/efficiency'),
          fetch('/api/alerts'),
        ]);

        for (const r of [rollupRes, trendRes, effRes, alertRes]) {
          if (!r.ok) throw new Error(`${r.url} returned ${r.status}`);
        }

        const [rollupJson, trendJson, effJson, alertJson] = await Promise.all([
          rollupRes.json(),
          trendRes.json(),
          effRes.json(),
          alertRes.json(),
        ]);

        setPlatformData(transformPlatformRollups(rollupJson));
        setTrendData(transformDailyRoas(trendJson));
        setEfficiencyData(transformEfficiency(effJson));
        setAlerts(alertJson);
      } catch (err) {
        console.error(err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    fetchAll();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <LoadingSpinner />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 p-10">
        <ErrorBanner message={error} />
      </div>
    );
  }

  const allocationData = deriveAllocation(platformData);
  const totalSpend = platformData.reduce((s, p) => s + p.cost_7d, 0);
  const totalRevenue = platformData.reduce((s, p) => s + p.revenue_7d, 0);
  const blendedROAS = totalSpend > 0 ? totalRevenue / totalSpend : 0;

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Budget Allocator</h1>
            <p className="text-sm text-gray-500">Deposits Paid Media Optimization</p>
          </div>
          <div className="text-sm text-gray-500">
            Last updated: {new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-6 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <KPICard 
            title="Total Spend (7d)" 
            value={`$${Math.round(totalSpend).toLocaleString()}`}
            subtitle={`Across ${platformData.length} platforms`}
            icon={DollarSign}
            color="blue"
          />
          <KPICard 
            title="Total Revenue (7d)" 
            value={`$${Math.round(totalRevenue).toLocaleString()}`}
            subtitle="FF attributed"
            icon={TrendingUp}
            color="green"
          />
          <KPICard 
            title="Blended ROAS" 
            value={`${blendedROAS.toFixed(2)}x`}
            subtitle="Revenue / Spend"
            icon={Target}
            color="purple"
          />
          <KPICard 
            title="Total Clicks (7d)" 
            value={platformData.reduce((s, p) => s + p.clicks_7d, 0).toLocaleString()}
            subtitle="Paid clicks only"
            icon={MousePointer}
            color="indigo"
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <AllocationPie data={allocationData} />
          <div className="lg:col-span-2">
            <ROASTrend data={trendData} />
          </div>
        </div>

        <PlatformTable data={platformData} />

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <EfficiencyScatter data={efficiencyData} />
          <BudgetSimulator platformData={platformData} />
          <AlertsPanel alerts={alerts} />
        </div>
      </main>
    </div>
  );
}
