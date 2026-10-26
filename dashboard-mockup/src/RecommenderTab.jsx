import React, { useState, useEffect } from 'react';
import {
  ComposedChart, BarChart, Bar, Line, Area, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  ReferenceLine, ErrorBar,
} from 'recharts';
import { TrendingUp, Calendar, Activity } from 'lucide-react';

// Reads the static bundle written by `python recommender.py --export-viz`
// (dashboard-mockup/public/data/recommender_viz.json). Pure rendering — all
// statistics (curves, bootstrap CIs, backtest) are computed in Python.
const VIZ_URL = '/data/recommender_viz.json';

const fmt = {
  usd: (v) => `$${Number(v || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}`,
  roas: (v) => (v == null ? '—' : `${Number(v).toFixed(2)}x`),
  pct: (v) => `${Number(v || 0).toFixed(1)}%`,
  k: (v) => (v >= 1000 ? `$${(v / 1000).toFixed(v >= 10000 ? 0 : 1)}k` : `$${Math.round(v)}`),
};

const ACTION_STYLES = [
  { test: (a) => a === 'ADD', cls: 'bg-green-50 text-green-700', color: '#16A34A', order: 0 },
  { test: (a) => a === 'TRIM', cls: 'bg-red-50 text-red-700', color: '#DC2626', order: 1 },
  { test: (a) => a.startsWith('HOLD'), cls: 'bg-amber-50 text-amber-700', color: '#9CA3AF', order: 2 },
  { test: () => true, cls: 'bg-gray-100 text-gray-500', color: '#D1D5DB', order: 3 },
];
const actionStyle = (a) => ACTION_STYLES.find((s) => s.test(a || ''));

function ActionChip({ action }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${actionStyle(action).cls}`}>
      {action}
    </span>
  );
}

// ---------------------------------------------------------------------------
// 1. Action board — full recommendation table
// ---------------------------------------------------------------------------
function ActionBoard({ units }) {
  const rows = [...units].sort((a, b) =>
    actionStyle(a.action).order - actionStyle(b.action).order
    || (b.marginal_roas ?? -1) - (a.marginal_roas ?? -1));
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Next-Best-Dollar Actions</h3>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-gray-500 border-b border-gray-100">
              <th className="pb-3 font-medium">Unit</th>
              <th className="pb-3 font-medium">Tier</th>
              <th className="pb-3 font-medium">Action</th>
              <th className="pb-3 font-medium text-right">Marginal ROAS (90% CI)</th>
              <th className="pb-3 font-medium text-right">Avg Daily Spend</th>
              <th className="pb-3 font-medium text-right">Delta</th>
              <th className="pb-3 font-medium text-right">Pacing Range</th>
              <th className="pb-3 font-medium">Flag</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((u) => (
              <tr key={u.unit} className="border-b border-gray-50 hover:bg-gray-50">
                <td className="py-3 font-medium text-gray-900 max-w-xs truncate" title={u.label}>{u.label}</td>
                <td className="py-3 text-gray-600">{u.confidence}</td>
                <td className="py-3"><ActionChip action={u.action} /></td>
                <td className="py-3 text-right text-gray-900 font-semibold">
                  {fmt.roas(u.marginal_roas)}
                  {u.ci_lo != null && (
                    <span className="font-normal text-gray-400"> ({u.ci_lo.toFixed(2)}–{u.ci_hi.toFixed(2)})</span>
                  )}
                </td>
                <td className="py-3 text-right text-gray-600">{fmt.usd(u.current_daily_spend)}</td>
                <td className="py-3 text-right text-gray-600">
                  {u.recommended_delta_pct ? fmt.pct(u.recommended_delta_pct * 100) : '—'}
                </td>
                <td className="py-3 text-right text-gray-600">
                  {fmt.usd(u.pacing.lo)} – {fmt.usd(u.pacing.hi)}
                </td>
                <td className="py-3 text-xs text-gray-400">{u.warn || ''}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 2. Next-dollar ladder — ranked marginal ROAS with CI whiskers
// ---------------------------------------------------------------------------
function NextDollarLadder({ units, median }) {
  const data = units
    .filter((u) => u.confidence === 'A' && u.marginal_roas != null)
    .sort((a, b) => b.marginal_roas - a.marginal_roas)
    .map((u) => ({
      label: u.label.length > 38 ? `${u.label.slice(0, 36)}…` : u.label,
      marginal: u.marginal_roas,
      err: u.ci_lo != null ? (u.ci_hi - u.ci_lo) / 2 : 0,
      action: u.action,
    }));
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
      <h3 className="text-lg font-semibold text-gray-900 mb-1">Marginal ROAS Ladder (A-core)</h3>
      <p className="text-xs text-gray-400 mb-4">Predicted revenue from the next $1 at current spend, with 90% bootstrap CI</p>
      <ResponsiveContainer width="100%" height={Math.max(220, data.length * 44)}>
        <BarChart data={data} layout="vertical" margin={{ left: 40, right: 30, top: 5, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" horizontal={false} />
          <XAxis type="number" tickFormatter={(v) => `${v.toFixed(1)}x`} domain={[0, 'auto']} />
          <YAxis type="category" dataKey="label" width={250} tick={{ fontSize: 11 }} />
          <Tooltip formatter={(v) => fmt.roas(v)} />
          <ReferenceLine x={1.0} stroke="#6B7280" strokeDasharray="4 4"
            label={{ value: 'Break-even', position: 'top', fontSize: 10, fill: '#6B7280' }} />
          {median != null && (
            <ReferenceLine x={median} stroke="#7C3AED" strokeDasharray="4 4"
              label={{ value: 'Median', position: 'top', fontSize: 10, fill: '#7C3AED' }} />
          )}
          <Bar dataKey="marginal" barSize={18} isAnimationActive={false}>
            {data.map((d, i) => <Cell key={i} fill={actionStyle(d.action).color} />)}
            <ErrorBar dataKey="err" direction="x" width={5} strokeWidth={1.5} stroke="#374151" />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 3. Response-curve small multiples — scatter + fit + CI band per A-core unit
// ---------------------------------------------------------------------------
function curveChartData(unit) {
  // Merge grid rows (fit + band + breakeven) and daily scatter rows on a shared
  // numeric x so one ComposedChart renders all series.
  const rows = unit.curve_grid.map((g) => ({
    x: g.x, fit: g.fit, band: [g.band_lo, g.band_hi], breakeven: g.x,
  }));
  unit.scatter.forEach((s) => rows.push({ x: s.adj_cost, day: s.adj_rev, recent: s.recent }));
  return rows.sort((a, b) => a.x - b.x);
}

function ScatterDot(props) {
  const { cx, cy, payload, index } = props;
  if (payload.day == null || cx == null || cy == null) return null;
  return payload.recent
    ? <circle key={`d${index}`} cx={cx} cy={cy} r={3} fill="#2563EB" fillOpacity={0.9} />
    : <circle key={`d${index}`} cx={cx} cy={cy} r={2} fill="#9CA3AF" fillOpacity={0.45} />;
}

function ResponseCurveCard({ unit }) {
  const data = curveChartData(unit);
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
      <div className="flex items-center justify-between mb-1">
        <h4 className="text-sm font-semibold text-gray-900 truncate mr-2" title={unit.label}>{unit.label}</h4>
        <ActionChip action={unit.action} />
      </div>
      <p className="text-xs text-gray-400 mb-2">
        {unit.curve.model} fit, R² {unit.curve.r2?.toFixed(2)} · marginal {fmt.roas(unit.marginal_roas)}
      </p>
      <ResponsiveContainer width="100%" height={210}>
        <ComposedChart data={data} margin={{ left: 0, right: 10, top: 5, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="x" type="number" domain={['dataMin', 'dataMax']}
            tickFormatter={fmt.k} tick={{ fontSize: 10 }} />
          <YAxis tickFormatter={fmt.k} tick={{ fontSize: 10 }} width={48} />
          <Area dataKey="band" stroke="none" fill="#93C5FD" fillOpacity={0.3}
            connectNulls isAnimationActive={false} />
          <Line dataKey="breakeven" stroke="#9CA3AF" strokeDasharray="4 4" dot={false}
            connectNulls isAnimationActive={false} />
          <Line dataKey="day" stroke="none" strokeWidth={0} dot={<ScatterDot />}
            isAnimationActive={false} legendType="none" />
          <Line dataKey="fit" stroke="#2563EB" strokeWidth={2} dot={false}
            connectNulls isAnimationActive={false} />
          <ReferenceLine x={unit.current_daily_spend_adj} stroke="#DC2626" strokeDasharray="3 3"
            label={{ value: 'now', position: 'top', fontSize: 10, fill: '#DC2626' }} />
        </ComposedChart>
      </ResponsiveContainer>
      <p className="text-[10px] text-gray-400 mt-1">
        Seasonally adjusted daily spend (x) vs revenue (y). Dashed gray = break-even. Curve valid only within observed spend.
      </p>
    </div>
  );
}

function ResponseCurveGrid({ units }) {
  const vizUnits = units.filter((u) => u.has_viz_data);
  return (
    <div>
      <h3 className="text-lg font-semibold text-gray-900 mb-1">Response Curves (A-core)</h3>
      <p className="text-xs text-gray-400 mb-4">
        Daily observations (blue = last 28 days), fitted saturation curve, 90% bootstrap band, current spend marker
      </p>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {vizUnits.map((u) => <ResponseCurveCard key={u.unit} unit={u} />)}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 4. Backtest evidence panel — predicted vs actual per fold + signed bias
// ---------------------------------------------------------------------------
function BacktestCard({ unit }) {
  const bt = unit.backtest;
  const beats = bt.mean_mape < bt.naive_mape;
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
      <div className="flex items-center justify-between mb-1">
        <h4 className="text-sm font-semibold text-gray-900 truncate mr-2" title={unit.label}>{unit.label}</h4>
        <span className={`text-xs font-medium ${beats ? 'text-green-600' : 'text-red-600'}`}>
          MAPE {bt.mean_mape}% vs naive {bt.naive_mape}%
        </span>
      </div>
      <p className="text-xs text-gray-400 mb-2">
        14-day window bias {bt.window_bias_pct > 0 ? '+' : ''}{bt.window_bias_pct}%{bt.warn ? ` · ${bt.warn}` : ''}
      </p>
      <ResponsiveContainer width="100%" height={150}>
        <BarChart data={bt.folds} margin={{ left: 0, right: 10, top: 5, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="fold" tickFormatter={(v) => `fold ${v}`} tick={{ fontSize: 10 }} />
          <YAxis tickFormatter={fmt.k} tick={{ fontSize: 10 }} width={48} />
          <Tooltip formatter={(v) => fmt.usd(v)} />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          <Bar dataKey="predicted_rev" name="Predicted" fill="#93C5FD" isAnimationActive={false} />
          <Bar dataKey="actual_rev" name="Actual" fill="#1D4ED8" isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function BacktestPanel({ units }) {
  const withBt = units.filter((u) => u.backtest && u.backtest.folds?.length);
  if (!withBt.length) return null;
  return (
    <div>
      <h3 className="text-lg font-semibold text-gray-900 mb-1">Walk-Forward Backtest</h3>
      <p className="text-xs text-gray-400 mb-4">
        Out-of-sample evidence: predicted vs realized 14-day revenue per fold. Positive bias = curve over-predicts the recent regime.
      </p>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {withBt.map((u) => <BacktestCard key={u.unit} unit={u} />)}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tab wrapper — fetch once, render the four sections
// ---------------------------------------------------------------------------
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
      <strong>Error loading recommender data:</strong> {message}
      <div className="text-xs text-red-500 mt-1">
        Generate it with: <code>python recommender.py --export-viz</code>
      </div>
    </div>
  );
}

export default function RecommenderTab() {
  const [viz, setViz] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function fetchViz() {
      try {
        const res = await fetch(VIZ_URL);
        if (!res.ok) throw new Error(`${VIZ_URL} returned ${res.status}`);
        setViz(await res.json());
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    fetchViz();
  }, []);

  if (loading) return <LoadingSpinner />;
  if (error) return <ErrorBanner message={error} />;
  if (!viz?.units?.length) return <ErrorBanner message="bundle is empty" />;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-4 text-xs text-gray-500">
        <span className="inline-flex items-center gap-1">
          <Calendar className="w-3.5 h-3.5" /> Generated {new Date(viz.generated_at).toLocaleString()}
        </span>
        <span className="inline-flex items-center gap-1">
          <Activity className="w-3.5 h-3.5" /> {viz.lookback_days}d lookback
        </span>
        <span className="inline-flex items-center gap-1">
          <TrendingUp className="w-3.5 h-3.5" /> Cross-unit median marginal {fmt.roas(viz.cross_unit_median_marginal)}
        </span>
      </div>
      <ActionBoard units={viz.units} />
      <NextDollarLadder units={viz.units} median={viz.cross_unit_median_marginal} />
      <ResponseCurveGrid units={viz.units} />
      <BacktestPanel units={viz.units} />
    </div>
  );
}
