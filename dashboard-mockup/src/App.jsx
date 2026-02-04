import React, { useState } from 'react';
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

const platformData = [
  { platform: 'Google', clicks_7d: 20803, cost_7d: 66894, revenue_7d: 238221, roas_7d: 3.56, allocation: 42.8, cpc: 3.22, rtctr: 51.0, rpc: 22.44, color: COLORS.google },
  { platform: 'Bing', clicks_7d: 13894, cost_7d: 6574, revenue_7d: 9802, roas_7d: 1.49, allocation: 17.9, cpc: 0.47, rtctr: 7.5, rpc: 9.45, color: COLORS.bing },
  { platform: 'Meta', clicks_7d: 6435, cost_7d: 11255, revenue_7d: 33858, roas_7d: 3.01, allocation: 21.5, cpc: 1.75, rtctr: 14.2, rpc: 5.26, color: COLORS.meta },
  { platform: 'Taboola', clicks_7d: 3940, cost_7d: 17255, revenue_7d: 33937, roas_7d: 1.97, allocation: 11.8, cpc: 4.38, rtctr: 7.1, rpc: 8.61, color: COLORS.taboola },
  { platform: 'Whale', clicks_7d: 2534, cost_7d: 21731, revenue_7d: 18749, roas_7d: 0.86, allocation: 6.0, cpc: 8.58, rtctr: 17.3, rpc: 42.71, color: COLORS.whale },
];

const trendData = [
  { date: '01/20', google: 3.42, bing: 1.38, meta: 2.85, taboola: 1.82, whale: 0.91 },
  { date: '01/21', google: 3.51, bing: 1.45, meta: 2.92, taboola: 1.88, whale: 0.88 },
  { date: '01/22', google: 3.48, bing: 1.52, meta: 2.98, taboola: 1.91, whale: 0.82 },
  { date: '01/23', google: 3.55, bing: 1.48, meta: 3.05, taboola: 1.95, whale: 0.85 },
  { date: '01/24', google: 3.62, bing: 1.51, meta: 2.95, taboola: 1.99, whale: 0.89 },
  { date: '01/25', google: 3.58, bing: 1.44, meta: 3.08, taboola: 2.01, whale: 0.92 },
  { date: '01/26', google: 3.56, bing: 1.49, meta: 3.01, taboola: 1.97, whale: 0.86 },
];

const allocationData = [
  { name: 'Google', value: 42.8, color: COLORS.google },
  { name: 'Meta', value: 21.5, color: COLORS.meta },
  { name: 'Bing', value: 17.9, color: COLORS.bing },
  { name: 'Taboola', value: 11.8, color: COLORS.taboola },
  { name: 'Whale', value: 6.0, color: COLORS.whale },
];

const efficiencyData = [
  { platform: 'Google', cpc: 3.22, rpc: 22.44, volume: 20803, color: COLORS.google },
  { platform: 'Bing', cpc: 0.47, rpc: 9.45, volume: 13894, color: COLORS.bing },
  { platform: 'Meta', cpc: 1.75, rpc: 5.26, volume: 6435, color: COLORS.meta },
  { platform: 'Taboola', cpc: 4.38, rpc: 8.61, volume: 3940, color: COLORS.taboola },
  { platform: 'Whale', cpc: 8.58, rpc: 42.71, volume: 2534, color: COLORS.whale },
];

const alerts = [
  { type: 'warning', message: 'Meta/Taboola: Using FF revenue (post-lead tracking unavailable)' },
  { type: 'info', message: 'Whale volume below 500 clicks/day threshold' },
  { type: 'success', message: 'All 5 platforms have full 7d data coverage' },
];

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
              <th className="pb-3 font-medium text-right">RTCTR</th>
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
                <td className="py-3 text-right text-gray-600">{row.rtctr}%</td>
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

function BudgetSimulator() {
  const [budget, setBudget] = useState(100000);
  const projected = {
    google: budget * 0.428 * 3.56,
    meta: budget * 0.215 * 3.01,
    bing: budget * 0.179 * 1.49,
    taboola: budget * 0.118 * 1.97,
    whale: budget * 0.060 * 0.86,
  };
  const total = projected.google + projected.meta + projected.bing + projected.taboola + projected.whale;

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
    </div>
  );
}

export default function App() {
  const totalSpend = platformData.reduce((s, p) => s + p.cost_7d, 0);
  const totalRevenue = platformData.reduce((s, p) => s + p.revenue_7d, 0);
  const blendedROAS = totalRevenue / totalSpend;

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Budget Allocator</h1>
            <p className="text-sm text-gray-500">Deposits Paid Media Optimization</p>
          </div>
          <div className="text-sm text-gray-500">
            Last updated: Jan 27, 2026
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-6 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <KPICard 
            title="Total Spend (7d)" 
            value={`$${Math.round(totalSpend).toLocaleString()}`}
            subtitle="Across 5 platforms"
            trend={-2.4}
            icon={DollarSign}
            color="blue"
          />
          <KPICard 
            title="Total Revenue (7d)" 
            value={`$${Math.round(totalRevenue).toLocaleString()}`}
            subtitle="FF attributed"
            trend={5.2}
            icon={TrendingUp}
            color="green"
          />
          <KPICard 
            title="Blended ROAS" 
            value={`${blendedROAS.toFixed(2)}x`}
            subtitle="Revenue / Spend"
            trend={7.8}
            icon={Target}
            color="purple"
          />
          <KPICard 
            title="Total Clicks (7d)" 
            value={platformData.reduce((s, p) => s + p.clicks_7d, 0).toLocaleString()}
            subtitle="Paid clicks only"
            trend={1.1}
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
          <BudgetSimulator />
          <AlertsPanel alerts={alerts} />
        </div>
      </main>
    </div>
  );
}
