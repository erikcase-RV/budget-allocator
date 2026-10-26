"""recommender.py

Production-hardened budget response-curve recommender (Design 1 of
docs/recommender_feasibility.md; hardening per docs/recommender_hardening.md).
Successor to recommender_prototype.py.

Per unit (platform or campaign) of deposits daily data:
  1. Deseasonalize cost & revenue multiplicatively by day-of-week and month-of-year
     (mirrors sql/18 statement 3; month factor suppressed when <12 distinct months).
  2. Fit two saturation forms on the adjusted series with soft log-scale priors
     (penalized least squares): negexp rev = a*(1-exp(-x/k)) and Hill
     rev = a*x^h/(x^h+k^h); select by AICc.
  3. Weekly block bootstrap (gap-aware) -> 90% CI on marginal ROAS at current spend.
  4. CI-aware action: ADD only if CI lower bound clears 1.0 AND the cross-unit median;
     TRIM only if CI upper bound < 1.0; otherwise HOLD. Deltas capped +/-15% and
     clamped to the observed spend range (raw dollars).
  5. Walk-forward backtest (A-core units): 3 expanding-window folds, 14-day horizon,
     curve must beat a naive mean-revenue baseline or the unit is HOLD (backtest warn).

Run:  python recommender.py [--no-backtest] [--no-bootstrap] [--lookback N]
                            [--output PATH] [--units-only KEY[,KEY]] [--verbose]
Reads .env for DATABRICKS_HOST / DATABRICKS_HTTP_PATH|WAREHOUSE_ID / DATABRICKS_TOKEN.
Output CSV: docs/recommender_prototype_output.csv (shape feeds sql/21_suggestion_log_ddl.sql).
Backtest data pull is documented in sql/22_walk_forward_actuals.sql.
"""

from __future__ import annotations

import argparse
import os
import sys
from dataclasses import dataclass
from pathlib import Path

import numpy as np
import pandas as pd
from scipy.optimize import least_squares

HERE = Path(__file__).resolve().parent

# ----------------------------------------------------------------------------- CONSTANTS
LOOKBACK_DAYS = 365
BACKTEST_LOOKBACK_DAYS = 700
RECENT_DAYS = 28               # window defining "current" daily spend
MIN_ACTIVE_DAYS = 90           # minimum active days to fit a curve at all
NEAR_ZERO_FRAC = 0.01          # days with cost < 1% of median treated as inactive
MIN_CELL_DAYS = 5              # min days in a DoW/month cell to trust its factor
MIN_MONTHS_FOR_MOY = 12        # need a full year of months to use month factors
HILL_FREE_H_MIN_DAYS = 120     # free Hill exponent only with this much data
PENALTY_WEIGHT = 0.05          # soft-prior pull, in units of sqrt(n)*std(rev) per log-unit
BLOCK_WEEKS = 4                # bootstrap block length (2 if series < 180 days)
BLOCK_WEEKS_THIN = 2
THIN_SERIES_DAYS = 180
GAP_SPLIT_DAYS = 7             # split series at gaps longer than this (Meta's 134d hole)
BOOTSTRAP_REPS = 500
CI_LO_PCT, CI_HI_PCT = 5.0, 95.0   # 90% CI
MIN_BOOT_SUCCESS_FRAC = 0.9
ADD_CI_THRESHOLD = 1.0         # CI lower bound must clear this (and cross-unit median) to ADD
TRIM_CI_THRESHOLD = 1.0        # CI upper bound must be below this to TRIM
NEAR_SATURATION_FRAC = 0.8     # current spend > 80% of observed max -> HOLD
PACING_MAX_DELTA_PCT = 0.15
BACKTEST_FOLDS = 3
BACKTEST_HORIZON_DAYS = 14
# Backtest warn calibration (2026-06-11, see docs/recommender_hardening.md): daily MAPE is
# dominated by irreducible daily revenue lumpiness (25-83% across ALL units, including ones
# with 2-16% 14-day aggregate error), so the absolute bar gates on WINDOW-level error, not
# daily MAPE. Hard gate remains losing to the naive mean-revenue baseline.
BACKTEST_LEVEL_ERR_WARN = 50.0  # % abs 14d-window revenue error above this -> backtest warn
# Google/Microsoft search core that cleared the strong-pass gate (memo section 5).
A_CORE_CAMPAIGN_KEYS = {"20455602196", "20455602199", "506118191", "506118190", "506073492"}
A_CORE_PLATFORMS = {"Google", "Microsoft"}

VERBOSE = False


def vlog(msg: str) -> None:
    if VERBOSE:
        print(msg, file=sys.stderr)


# ----------------------------------------------------------------------------- DATA
def load_dotenv(path: Path) -> None:
    if not path.exists():
        return
    for line in path.read_text().splitlines():
        if "=" in line and not line.strip().startswith("#"):
            k, v = line.split("=", 1)
            os.environ.setdefault(k.strip(), v.strip())


def fetch_daily(lookback_days: int, a_core_only: bool = False) -> pd.DataFrame:
    from databricks import sql as dbsql

    host = os.environ.get("DATABRICKS_HOST", "").removeprefix("https://").removeprefix("http://").rstrip("/")
    http_path = os.environ.get("DATABRICKS_HTTP_PATH") or os.environ.get("DATABRICKS_WAREHOUSE_ID")
    token = os.environ.get("DATABRICKS_TOKEN")
    if not (host and http_path and token):
        sys.exit("ERROR: missing DATABRICKS_HOST / DATABRICKS_HTTP_PATH(or WAREHOUSE_ID) / DATABRICKS_TOKEN")

    # a_core filter mirrors sql/22_walk_forward_actuals.sql
    core_filter = ""
    if a_core_only:
        keys = ",".join(f"'{k}'" for k in sorted(A_CORE_CAMPAIGN_KEYS))
        plats = ",".join(f"'{p}'" for p in sorted(A_CORE_PLATFORMS))
        core_filter = f"AND (platform IN ({plats}) OR campaign_key IN ({keys}))"
    query = f"""
        SELECT date, platform, campaign_key, campaign_name,
               SUM(cost) AS cost, SUM(total_actual_revenue) AS revenue
        FROM bankrate_prod.br_rpt.paid_media_ff_campaign_daily
        WHERE date >= date_sub(current_date(), {lookback_days})
          AND date <  current_date()
          AND vertical = 'deposits'
          {core_filter}
        GROUP BY date, platform, campaign_key, campaign_name
    """
    with dbsql.connect(server_hostname=host, http_path=http_path, access_token=token) as conn:
        with conn.cursor() as cur:
            cur.execute(query)
            cols = [d[0] for d in cur.description]
            df = pd.DataFrame(cur.fetchall(), columns=cols)
    df["date"] = pd.to_datetime(df["date"])
    df["cost"] = df["cost"].astype(float)
    df["revenue"] = df["revenue"].astype(float)
    return df


def build_units(df: pd.DataFrame) -> dict[str, pd.DataFrame]:
    """Return {unit_key: daily df (date, cost, revenue, platform, campaign_key, label)}."""
    units: dict[str, pd.DataFrame] = {}
    plat = df.groupby(["platform", "date"], as_index=False)[["cost", "revenue"]].sum()
    for p, g in plat.groupby("platform"):
        units[f"PLATFORM:{p}"] = g[["date", "cost", "revenue"]].copy().assign(
            platform=p, campaign_key=None, label=p)
    camp = df.groupby(["platform", "campaign_key", "date"], as_index=False).agg(
        cost=("cost", "sum"), revenue=("revenue", "sum"),
        campaign_name=("campaign_name", "max"))
    for (p, ck), g in camp.groupby(["platform", "campaign_key"]):
        names = sorted(df[(df["platform"] == p) & (df["campaign_key"] == ck)]["campaign_name"].unique())
        label = f"{p} / {names[-1]}" + (f" (+{len(names) - 1} renamed)" if len(names) > 1 else "")
        units[f"CAMPAIGN:{p}|{ck}"] = g[["date", "cost", "revenue"]].copy().assign(
            platform=p, campaign_key=ck, label=label).sort_values("date")
    return units


def active_series(g: pd.DataFrame) -> pd.DataFrame:
    """Active days only: cost > 0 and not near-zero delivery-pause days."""
    g = g[g["cost"] > 0].sort_values("date").copy()
    if g.empty:
        return g
    floor = NEAR_ZERO_FRAC * float(g["cost"].median())
    return g[g["cost"] >= floor].copy()


# ----------------------------------------------------------------------------- DESEASONALIZATION
def _multiplicative_factor(g: pd.DataFrame, value_col: str, group_key: pd.Series) -> pd.Series:
    """Per-row factor overall_mean / cell_mean; cells with < MIN_CELL_DAYS get 1.0."""
    overall = g[value_col].mean()
    cell_mean = g.groupby(group_key)[value_col].transform("mean")
    cell_n = g.groupby(group_key)[value_col].transform("count")
    factor = overall / cell_mean.replace(0, np.nan)
    factor = factor.where(cell_n >= MIN_CELL_DAYS, 1.0).fillna(1.0)
    return factor


def compute_seasonal_factors(g: pd.DataFrame) -> tuple[pd.DataFrame, bool, bool]:
    """Add raw_cost/raw_revenue/adj_cost/adj_rev + per-row factor columns.

    DoW factors computed on raw; month factors computed on the DoW-adjusted series
    (sequential composition keeps each step mean-preserving). Month factors are
    suppressed for units without MIN_MONTHS_FOR_MOY distinct months.
    Returns (df, dow_applied, month_applied).
    """
    g = g.copy()
    g["raw_cost"], g["raw_revenue"] = g["cost"], g["revenue"]
    dow = g["date"].dt.weekday
    moy = g["date"].dt.month

    f_cost_dow = _multiplicative_factor(g, "raw_cost", dow)
    f_rev_dow = _multiplicative_factor(g, "raw_revenue", dow)
    g["adj_cost"] = g["raw_cost"] * f_cost_dow
    g["adj_rev"] = g["raw_revenue"] * f_rev_dow
    dow_applied = bool((f_cost_dow != 1.0).any())

    month_applied = False
    if moy.nunique() >= MIN_MONTHS_FOR_MOY:
        f_cost_moy = _multiplicative_factor(g, "adj_cost", moy)
        f_rev_moy = _multiplicative_factor(g, "adj_rev", moy)
        g["adj_cost"] *= f_cost_moy
        g["adj_rev"] *= f_rev_moy
        month_applied = bool((f_cost_moy != 1.0).any())

    g["f_cost"] = g["adj_cost"] / g["raw_cost"]
    g["f_rev"] = g["adj_rev"] / g["raw_revenue"].replace(0, np.nan)
    g["f_rev"] = g["f_rev"].fillna(1.0)
    return g, dow_applied, month_applied


# ----------------------------------------------------------------------------- CURVE FITTING
@dataclass
class FitResult:
    model: str          # 'negexp' or 'hill'
    a: float
    k: float
    h: float            # 1.0 for negexp
    aicc: float
    r2: float
    converged: bool
    k_prior: float
    a_prior: float


def sat_negexp(x: np.ndarray, a: float, k: float) -> np.ndarray:
    return a * (1.0 - np.exp(-x / k))


def sat_hill(x: np.ndarray, a: float, k: float, h: float) -> np.ndarray:
    xh = np.power(x, h)
    return a * xh / (xh + np.power(k, h))


def marginal_roas(fit: FitResult, x: float) -> float:
    if fit.model == "negexp":
        return (fit.a / fit.k) * float(np.exp(-x / fit.k))
    a, k, h = fit.a, fit.k, fit.h
    return a * h * (k ** h) * (x ** (h - 1)) / ((x ** h + k ** h) ** 2)


def eval_curve(fit: FitResult, x: np.ndarray) -> np.ndarray:
    if fit.model == "negexp":
        return sat_negexp(x, fit.a, fit.k)
    return sat_hill(x, fit.a, fit.k, fit.h)


def _fit_form(model: str, cost: np.ndarray, rev: np.ndarray,
              k_prior: float, a_prior: float, free_h: bool) -> FitResult | None:
    """Penalized least squares for one functional form.

    Soft priors enter as extra residuals on log-scale parameter deviations, scaled by
    sqrt(n)*std(rev) so the pull is proportional to the data's own scale (the plan
    agent's raw 0.05*n*ln spec is dimensionally inconsistent with revenue residuals).
    AICc is computed on the FIT residuals only (penalties excluded).
    """
    n = len(cost)
    pen_scale = PENALTY_WEIGHT * np.sqrt(n) * max(float(np.std(rev)), 1.0)

    def residuals(params: np.ndarray) -> np.ndarray:
        if model == "negexp":
            a, k = params
            pred = sat_negexp(cost, a, k)
        else:
            a, k = params[0], params[1]
            h = params[2] if free_h else 1.0
            pred = sat_hill(cost, a, k, h)
        pens = [pen_scale * (np.log(params[0]) - np.log(a_prior)),
                pen_scale * (np.log(params[1]) - np.log(k_prior))]
        return np.append(rev - pred, pens)

    a0 = max(float(rev.max()), 1.0)
    k0 = max(float(np.median(cost)), 1.0)
    if model == "negexp":
        x0, lo, hi = [a0, k0], [1e-3, 1.0], [np.inf, np.inf]
        p = 2
    elif free_h:
        x0, lo, hi = [a0, k0, 1.0], [1e-3, 1.0, 0.5], [np.inf, np.inf, 4.0]
        p = 3
    else:
        x0, lo, hi = [a0, k0], [1e-3, 1.0], [np.inf, np.inf]
        p = 2
    try:
        res = least_squares(residuals, x0=x0, bounds=(lo, hi), max_nfev=20000)
    except Exception:
        return None
    if not np.all(np.isfinite(res.x)):
        return None
    a, k = float(res.x[0]), float(res.x[1])
    h = float(res.x[2]) if (model == "hill" and free_h) else 1.0
    pred = sat_negexp(cost, a, k) if model == "negexp" else sat_hill(cost, a, k, h)
    rss = float(((rev - pred) ** 2).sum())
    ss_tot = float(((rev - rev.mean()) ** 2).sum())
    r2 = 1 - rss / ss_tot if ss_tot > 0 else float("nan")
    aicc = n * np.log(max(rss, 1e-12) / n) + 2 * p
    if n - p - 1 > 0:
        aicc += 2 * p * (p + 1) / (n - p - 1)
    return FitResult(model, a, k, h, aicc, r2, res.success, k_prior, a_prior)


def fit_unit(cost: np.ndarray, rev: np.ndarray) -> FitResult | None:
    """Fit negexp and Hill with soft priors; select by AICc."""
    k_prior = max(float(np.median(cost)), 1.0)
    a_prior = max(3.0 * float(np.median(rev)), 1.0)
    free_h = len(cost) >= HILL_FREE_H_MIN_DAYS
    fits = [f for f in (
        _fit_form("negexp", cost, rev, k_prior, a_prior, False),
        _fit_form("hill", cost, rev, k_prior, a_prior, free_h),
    ) if f is not None and f.converged]
    if not fits:
        return None
    return min(fits, key=lambda f: f.aicc)


def refit_same_form(fit: FitResult, cost: np.ndarray, rev: np.ndarray) -> FitResult | None:
    """Bootstrap refit: same model form, same priors, no re-selection."""
    free_h = fit.model == "hill" and fit.h != 1.0
    return _fit_form(fit.model, cost, rev, fit.k_prior, fit.a_prior, free_h)


# ----------------------------------------------------------------------------- BOOTSTRAP
def split_at_gaps(g: pd.DataFrame) -> list[pd.DataFrame]:
    gaps = g["date"].diff().dt.days > GAP_SPLIT_DAYS
    return [seg for _, seg in g.groupby(gaps.cumsum()) if len(seg)]


def bootstrap_marginal_ci(
    g_adj: pd.DataFrame, fit: FitResult, x_cur_adj: float,
    rng: np.random.Generator, curve_grid: np.ndarray | None = None,
) -> tuple[float, float, int, tuple[np.ndarray, np.ndarray] | None]:
    """Weekly block bootstrap of marginal ROAS at current (adjusted) spend.

    Blocks of BLOCK_WEEKS consecutive ISO weeks, drawn with replacement WITHIN
    gap-free segments (Meta's 134-day hole must not be stitched into fake contiguity).
    If curve_grid is given, each successful rep's curve is also evaluated over it and
    per-point percentile bands returned (for the viz export).
    Returns (ci_lo, ci_hi, n_success, band); band = (lo_arr, hi_arr) or None.
    """
    block_weeks = BLOCK_WEEKS if len(g_adj) >= THIN_SERIES_DAYS else BLOCK_WEEKS_THIN
    seg_blocks: list[list[pd.DataFrame]] = []
    for seg in split_at_gaps(g_adj):
        wk = seg["date"] - pd.to_timedelta(seg["date"].dt.weekday, unit="D")
        weeks = [w for _, w in seg.groupby(wk)]
        blocks = [pd.concat(weeks[i:i + block_weeks]) for i in range(0, len(weeks), block_weeks)]
        if blocks:
            seg_blocks.append(blocks)
    if not seg_blocks:
        return float("nan"), float("nan"), 0, None

    margs: list[float] = []
    curves: list[np.ndarray] = []
    for _ in range(BOOTSTRAP_REPS):
        parts = []
        for blocks in seg_blocks:
            idx = rng.integers(0, len(blocks), size=len(blocks))
            parts.extend(blocks[i] for i in idx)
        sample = pd.concat(parts)
        bf = refit_same_form(fit, sample["adj_cost"].to_numpy(), sample["adj_rev"].to_numpy())
        if bf is not None and bf.converged:
            m = marginal_roas(bf, x_cur_adj)
            if np.isfinite(m):
                margs.append(m)
                if curve_grid is not None:
                    curves.append(eval_curve(bf, curve_grid))
    if len(margs) < MIN_BOOT_SUCCESS_FRAC * BOOTSTRAP_REPS:
        return float("nan"), float("nan"), len(margs), None
    lo, hi = np.percentile(margs, [CI_LO_PCT, CI_HI_PCT])
    band = None
    if curves:
        stack = np.vstack(curves)
        band = (np.percentile(stack, CI_LO_PCT, axis=0), np.percentile(stack, CI_HI_PCT, axis=0))
    return float(lo), float(hi), len(margs), band


# ----------------------------------------------------------------------------- IV CHECK (unchanged)
def ols(y: np.ndarray, x: np.ndarray) -> tuple[float, float, float]:
    X = np.column_stack([np.ones_like(x), x])
    beta, *_ = np.linalg.lstsq(X, y, rcond=None)
    resid = y - X @ beta
    ss_res = float(resid @ resid)
    ss_tot = float(((y - y.mean()) ** 2).sum())
    r2 = 1 - ss_res / ss_tot if ss_tot > 0 else float("nan")
    return float(beta[0]), float(beta[1]), r2


def iv_check(g: pd.DataFrame) -> dict:
    cost = g["raw_cost"].to_numpy()
    rev = g["raw_revenue"].to_numpy()
    paired = pd.DataFrame({"date": g["date"].to_numpy(), "y": rev, "x": np.log(cost)})
    lag = pd.DataFrame({"date": g["date"].to_numpy() + pd.Timedelta(days=7), "z": np.log(cost)})
    m = paired.merge(lag, on="date", how="inner")
    out = {"b_ols": None, "b_iv": None, "iv_over_ols": None, "first_stage_F": None}
    if len(m) < 30:
        return out
    _, b_ols, _ = ols(m["y"].to_numpy(), m["x"].to_numpy())
    ic, sl, r2_fs = ols(m["x"].to_numpy(), m["z"].to_numpy())
    n = len(m)
    F = r2_fs * (n - 2) / (1 - r2_fs) if r2_fs < 1 else float("inf")
    x_hat = ic + sl * m["z"].to_numpy()
    _, b_iv, _ = ols(m["y"].to_numpy(), x_hat)
    out.update(b_ols=round(b_ols, 1), b_iv=round(b_iv, 1),
               iv_over_ols=round(b_iv / b_ols, 2) if b_ols else None,
               first_stage_F=round(F, 1))
    return out


# ----------------------------------------------------------------------------- ANALYSIS (two-pass)
def analyze_unit_fit(key: str, g_raw: pd.DataFrame) -> dict | None:
    """Pass 1: deseasonalize + fit + point marginal. No bootstrap, no action."""
    g = active_series(g_raw)
    if len(g) < MIN_ACTIVE_DAYS:
        return None
    g, dow_applied, month_applied = compute_seasonal_factors(g)
    fit = fit_unit(g["adj_cost"].to_numpy(), g["adj_rev"].to_numpy())

    recent = g.tail(RECENT_DAYS)
    x_cur = float(recent["raw_cost"].mean())
    f_recent = float(recent["f_cost"].median())
    x_cur_adj = x_cur * f_recent
    avg_roas_recent = (float(recent["raw_revenue"].sum() / recent["raw_cost"].sum())
                       if recent["raw_cost"].sum() else float("nan"))
    obs_min, obs_max = float(g["raw_cost"].min()), float(g["raw_cost"].max())

    ck = g_raw["campaign_key"].iloc[0]
    platform = g_raw["platform"].iloc[0]
    is_a_core = (str(ck) in A_CORE_CAMPAIGN_KEYS) or (
        key.startswith("PLATFORM:") and platform in A_CORE_PLATFORMS)

    marg = marginal_roas(fit, x_cur_adj) if fit else float("nan")
    row = {
        "unit": key, "label": g_raw["label"].iloc[0], "platform": platform,
        "confidence": "A" if is_a_core else "B",
        "n_days": len(g),
        "current_daily_spend": round(x_cur, 2),
        "observed_min": round(obs_min, 2), "observed_max": round(obs_max, 2),
        "near_saturation": x_cur > NEAR_SATURATION_FRAC * obs_max,
        "selected_model": fit.model if fit else None,
        "curve_a_ceiling": round(fit.a, 1) if fit else None,
        "curve_k_scale": round(fit.k, 1) if fit else None,
        "curve_h_shape": round(fit.h, 2) if fit else None,
        "curve_r2": round(fit.r2, 3) if fit else None,
        "marginal_roas_at_current": round(marg, 3) if np.isfinite(marg) else None,
        "avg_roas_recent": round(avg_roas_recent, 3) if np.isfinite(avg_roas_recent) else None,
        "dow_factor_applied": dow_applied, "month_factor_applied": month_applied,
        "has_gap": len(split_at_gaps(g)) > 1,
        **iv_check(g),
    }
    return {"row": row, "g": g, "fit": fit, "x_cur_adj": x_cur_adj}


def assign_action(row: dict, ci_lo: float, ci_hi: float, cross_median: float | None) -> str:
    if row["confidence"] != "A":
        return "suggest-only (validate)"
    if row["marginal_roas_at_current"] is None:
        return "skip (no curve)"
    if row["near_saturation"]:
        return "HOLD (near saturation)"
    if not np.isfinite(ci_lo) or cross_median is None:
        return "HOLD (insufficient evidence)"
    if ci_lo > ADD_CI_THRESHOLD and ci_lo > cross_median:
        return "ADD"
    if ci_hi < TRIM_CI_THRESHOLD:
        return "TRIM"
    return "HOLD (insufficient evidence)"


def pacing(row: dict, action: str) -> dict:
    x = row["current_daily_spend"]
    delta = {"ADD": PACING_MAX_DELTA_PCT, "TRIM": -PACING_MAX_DELTA_PCT}.get(action, 0.0)
    lo = max(row["observed_min"], x * (1 - PACING_MAX_DELTA_PCT))
    hi = min(row["observed_max"], x * (1 + PACING_MAX_DELTA_PCT))
    if action == "ADD" and x >= row["observed_max"]:
        delta = 0.0  # cannot recommend beyond observed range
    return {"recommended_delta_pct": delta,
            "recommended_daily_spend_lo": round(lo, 2),
            "recommended_daily_spend_hi": round(hi, 2)}


# ----------------------------------------------------------------------------- BACKTEST
def walk_forward_backtest(units: dict[str, pd.DataFrame]) -> tuple[pd.DataFrame, pd.DataFrame]:
    """3 expanding-window folds x 14d horizon per A-core unit. Train-only factors.

    Returns (per-unit summary with warn flag, per-fold detail rows for the viz export)."""
    results = []
    for key, g_raw in units.items():
        g_all = active_series(g_raw)
        if g_all.empty:
            continue
        t_end = g_all["date"].max() + pd.Timedelta(days=1)
        for i in range(1, BACKTEST_FOLDS + 1):
            test_end = t_end - pd.Timedelta(days=(i - 1) * BACKTEST_HORIZON_DAYS)
            test_start = test_end - pd.Timedelta(days=BACKTEST_HORIZON_DAYS)
            train = g_all[g_all["date"] < test_start]
            test = g_all[(g_all["date"] >= test_start) & (g_all["date"] < test_end)]
            if len(train) < MIN_ACTIVE_DAYS or len(test) < 7:
                continue
            tr, _, _ = compute_seasonal_factors(train)
            fit = fit_unit(tr["adj_cost"].to_numpy(), tr["adj_rev"].to_numpy())
            if fit is None:
                continue
            # train-only factors applied to test days (no peeking)
            dow_fc = tr.groupby(tr["date"].dt.weekday)["f_cost"].median()
            dow_fr = tr.groupby(tr["date"].dt.weekday)["f_rev"].median()
            f_c = test["date"].dt.weekday.map(dow_fc).fillna(1.0).to_numpy()
            f_r = test["date"].dt.weekday.map(dow_fr).fillna(1.0).to_numpy()
            pred_adj = (sat_negexp(test["cost"].to_numpy() * f_c, fit.a, fit.k)
                        if fit.model == "negexp"
                        else sat_hill(test["cost"].to_numpy() * f_c, fit.a, fit.k, fit.h))
            pred_raw = pred_adj / f_r
            actual = test["revenue"].to_numpy()
            naive = float(train["revenue"].mean())
            mape = float(np.mean(np.abs(pred_raw - actual) / np.maximum(actual, 1.0))) * 100
            naive_mape = float(np.mean(np.abs(naive - actual) / np.maximum(actual, 1.0))) * 100
            window_bias = float(pred_raw.sum() - actual.sum()) / max(float(actual.sum()), 1.0) * 100
            results.append({"unit": key, "fold": i, "mape": mape,
                            "naive_mape": naive_mape, "window_bias_pct": window_bias,
                            "predicted_rev": float(pred_raw.sum()),
                            "actual_rev": float(actual.sum())})
            vlog(f"backtest {key} fold {i}: mape={mape:.1f}% naive={naive_mape:.1f}% "
                 f"window_bias={window_bias:+.1f}%")
    if not results:
        empty = pd.DataFrame(columns=["unit", "backtest_mean_mape", "backtest_naive_mape",
                                      "backtest_window_err_pct", "backtest_window_bias_pct",
                                      "backtest_warn"])
        return empty, pd.DataFrame(results)
    res = pd.DataFrame(results)
    res["window_err_pct"] = res["window_bias_pct"].abs()
    bt = res.groupby("unit", as_index=False).agg(
        backtest_mean_mape=("mape", "mean"),
        backtest_naive_mape=("naive_mape", "mean"),
        backtest_window_err_pct=("window_err_pct", "mean"),
        backtest_window_bias_pct=("window_bias_pct", "mean"))
    bt["backtest_warn"] = (bt["backtest_mean_mape"] >= bt["backtest_naive_mape"]) | \
                          (bt["backtest_window_err_pct"] > BACKTEST_LEVEL_ERR_WARN)
    for c in ["backtest_mean_mape", "backtest_naive_mape",
              "backtest_window_err_pct", "backtest_window_bias_pct"]:
        bt[c] = bt[c].round(1)
    return bt, res


# ----------------------------------------------------------------------------- VIZ EXPORT
VIZ_PATH = HERE / "dashboard-mockup" / "public" / "data" / "recommender_viz.json"
CURVE_GRID_POINTS = 50


def export_viz(out: pd.DataFrame, fitted: list[dict], bands: dict[str, dict],
               bt_folds: pd.DataFrame | None, cross_median: float | None,
               lookback_days: int) -> Path:
    """Assemble the schema_version-1 JSON bundle for the dashboard Recommender tab.

    Charts live in seasonally ADJUSTED spend space (matching the fitted curves);
    raw-dollar fields are for the action table. scatter/curve_grid only for A-core
    units with a curve (has_viz_data) to bound file size.
    """
    import json
    from datetime import datetime, timezone

    by_unit = {r["row"]["unit"]: r for r in fitted}
    folds_by_unit: dict[str, list[dict]] = {}
    if bt_folds is not None and len(bt_folds):
        for _, fr in bt_folds.iterrows():
            folds_by_unit.setdefault(fr["unit"], []).append({
                "fold": int(fr["fold"]),
                "predicted_rev": round(fr["predicted_rev"], 0),
                "actual_rev": round(fr["actual_rev"], 0),
                "window_bias_pct": round(fr["window_bias_pct"], 1),
            })

    units_json = []
    for _, row in out.iterrows():
        unit = row["unit"]
        r = by_unit.get(unit)
        g = r["g"] if r else None
        fit = r["fit"] if r else None
        band = bands.get(unit)
        has_viz = bool(row["confidence"] == "A" and fit is not None and band is not None)

        warn = None
        if row.get("backtest_warn") is True:
            warn = ("loses_to_naive"
                    if row.get("backtest_mean_mape", 0) >= row.get("backtest_naive_mape", float("inf"))
                    else "high_window_bias")

        u = {
            "unit": unit, "label": row["label"], "confidence": row["confidence"],
            "action": row["action"],
            "marginal_roas": row["marginal_roas_at_current"],
            "ci_lo": row["marg_roas_ci_lo"], "ci_hi": row["marg_roas_ci_hi"],
            "current_daily_spend": row["current_daily_spend"],
            "current_daily_spend_adj": round(r["x_cur_adj"], 2) if r else None,
            "observed_min": row["observed_min"], "observed_max": row["observed_max"],
            "observed_min_adj": round(float(g["adj_cost"].min()), 2) if g is not None else None,
            "observed_max_adj": round(float(g["adj_cost"].max()), 2) if g is not None else None,
            "recommended_delta_pct": row["recommended_delta_pct"],
            "pacing": {"lo": row["recommended_daily_spend_lo"],
                       "hi": row["recommended_daily_spend_hi"]},
            "curve": ({"model": row["selected_model"], "r2": row["curve_r2"]}
                      if row["selected_model"] else None),
            "warn": warn,
            "has_viz_data": has_viz,
            "backtest": None,
            "scatter": [], "curve_grid": [],
        }
        if pd.notna(row.get("backtest_mean_mape")):
            u["backtest"] = {
                "mean_mape": row["backtest_mean_mape"],
                "naive_mape": row["backtest_naive_mape"],
                "window_bias_pct": row["backtest_window_bias_pct"],
                "warn": warn,
                "folds": folds_by_unit.get(unit, []),
            }
        if has_viz:
            recent_cutoff = g["date"].max() - pd.Timedelta(days=RECENT_DAYS)
            u["scatter"] = [
                {"date": d.strftime("%Y-%m-%d"), "adj_cost": round(c, 0),
                 "adj_rev": round(v, 0), "recent": bool(d > recent_cutoff)}
                for d, c, v in zip(g["date"], g["adj_cost"], g["adj_rev"])
            ]
            grid, (b_lo, b_hi) = band["grid"], band["band"]
            fit_vals = eval_curve(fit, grid)
            u["curve_grid"] = [
                {"x": round(float(x), 0), "fit": round(float(f), 0),
                 "band_lo": round(float(lo), 0), "band_hi": round(float(hi), 0)}
                for x, f, lo, hi in zip(grid, fit_vals, b_lo, b_hi)
            ]
        # JSON has no NaN: normalize pandas NA/NaN scalars to null
        def clean(v):
            if isinstance(v, dict):
                return {k2: clean(v2) for k2, v2 in v.items()}
            if isinstance(v, list):
                return v
            if v is None or (isinstance(v, float) and not np.isfinite(v)):
                return None
            try:
                if pd.isna(v):
                    return None
            except (TypeError, ValueError):
                pass
            return v
        units_json.append({k: clean(v) for k, v in u.items()})

    bundle = {
        "schema_version": 1,
        "generated_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "lookback_days": lookback_days,
        "cross_unit_median_marginal": cross_median,
        "units": units_json,
    }
    VIZ_PATH.parent.mkdir(parents=True, exist_ok=True)
    VIZ_PATH.write_text(json.dumps(bundle, allow_nan=False), encoding="utf-8")
    return VIZ_PATH


# ----------------------------------------------------------------------------- MAIN
def main() -> int:
    global VERBOSE
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("--no-backtest", action="store_true")
    ap.add_argument("--no-bootstrap", action="store_true")
    ap.add_argument("--lookback", type=int, default=LOOKBACK_DAYS)
    ap.add_argument("--output", type=Path, default=HERE / "docs" / "recommender_prototype_output.csv")
    ap.add_argument("--units-only", type=str, default=None,
                    help="comma-separated unit keys, e.g. CAMPAIGN:Google|22171883742")
    ap.add_argument("--export-viz", action="store_true",
                    help=f"also write the dashboard viz bundle to {VIZ_PATH}")
    ap.add_argument("--verbose", action="store_true")
    args = ap.parse_args()
    VERBOSE = args.verbose
    rng = np.random.default_rng(20260611)

    load_dotenv(HERE / ".env")
    print("Fetching daily deposits data...", file=sys.stderr)
    df = fetch_daily(args.lookback)
    units = build_units(df)
    if args.units_only:
        wanted = set(args.units_only.split(","))
        units = {k: v for k, v in units.items() if k in wanted}
        if not units:
            sys.exit(f"ERROR: no units matched {sorted(wanted)}")

    # pass 1: fit everything
    fitted = [r for r in (analyze_unit_fit(k, g) for k, g in units.items()) if r]
    a_margs = [r["row"]["marginal_roas_at_current"] for r in fitted
               if r["row"]["confidence"] == "A" and r["row"]["marginal_roas_at_current"] is not None]
    cross_median = float(np.median(a_margs)) if a_margs else None
    vlog(f"cross-unit median marginal ROAS (A-core): {cross_median}")

    # pass 2: bootstrap + action
    rows = []
    bands: dict[str, dict] = {}
    for r in fitted:
        row, fit = r["row"], r["fit"]
        ci_lo = ci_hi = float("nan")
        n_boot = 0
        if fit and not args.no_bootstrap and row["confidence"] == "A":
            grid = None
            if args.export_viz:
                g = r["g"]
                grid = np.linspace(float(g["adj_cost"].min()), float(g["adj_cost"].max()),
                                   CURVE_GRID_POINTS)
            ci_lo, ci_hi, n_boot, band = bootstrap_marginal_ci(
                r["g"], fit, r["x_cur_adj"], rng, curve_grid=grid)
            if band is not None and grid is not None:
                bands[row["unit"]] = {"grid": grid, "band": band}
            vlog(f"bootstrap {row['unit']}: CI=({ci_lo:.3f},{ci_hi:.3f}) n={n_boot}")
        action = assign_action(row, ci_lo, ci_hi, cross_median)
        row.update({
            "marg_roas_ci_lo": round(ci_lo, 3) if np.isfinite(ci_lo) else None,
            "marg_roas_ci_hi": round(ci_hi, 3) if np.isfinite(ci_hi) else None,
            "ci_decisive": action in ("ADD", "TRIM"),
            "bootstrap_n": n_boot,
            "action": action,
            **pacing(row, action),
        })
        rows.append(row)
    out = pd.DataFrame(rows)

    # backtest (A-core, wider window)
    bt_folds = None
    if not args.no_backtest:
        print("Running walk-forward backtest (700d pull)...", file=sys.stderr)
        df_bt = fetch_daily(BACKTEST_LOOKBACK_DAYS, a_core_only=True)
        bt_units = {k: v for k, v in build_units(df_bt).items()
                    if k in {r["row"]["unit"] for r in fitted if r["row"]["confidence"] == "A"}}
        bt, bt_folds = walk_forward_backtest(bt_units)
        out = out.merge(bt, on="unit", how="left")
        warn = out["backtest_warn"].eq(True) & out["action"].isin(["ADD", "TRIM"])
        out.loc[warn, "action"] = "HOLD (backtest warn)"
    else:
        for c in ["backtest_mean_mape", "backtest_naive_mape", "backtest_window_err_pct",
                  "backtest_window_bias_pct", "backtest_warn"]:
            out[c] = None

    # rank A-core by marginal ROAS for readability
    out["next_dollar_rank"] = out[out["confidence"].eq("A")]["marginal_roas_at_current"] \
        .rank(ascending=False)
    out = out.sort_values(["confidence", "next_dollar_rank"],
                          ascending=[True, True], na_position="last")
    out.to_csv(args.output, index=False)

    if args.export_viz:
        viz_path = export_viz(out, fitted, bands, bt_folds, cross_median, args.lookback)
        print(f"Wrote viz bundle: {viz_path}", file=sys.stderr)

    show_cols = ["confidence", "next_dollar_rank", "label", "current_daily_spend",
                 "selected_model", "marginal_roas_at_current", "marg_roas_ci_lo",
                 "marg_roas_ci_hi", "curve_r2", "backtest_mean_mape", "backtest_naive_mape",
                 "backtest_window_bias_pct", "action", "recommended_delta_pct"]
    print("\n# Budget recommender (hardened) - next-best-dollar (deposits)\n")
    print(out[[c for c in show_cols if c in out.columns]].to_markdown(index=False))
    print(f"\nWrote {args.output}  ({len(out)} units)")
    print("\nReading: marginal_roas_at_current = predicted revenue from the next $1 at current "
          "spend (seasonally adjusted fit, evaluated at average-season conditions). ADD requires "
          "the 90% CI lower bound to clear 1.0 AND the cross-unit median; TRIM requires the CI "
          "upper bound under 1.0. Deltas capped at +/-15% and within the observed spend range. "
          "Backtest gate: the curve must beat the naive mean-revenue baseline AND keep 14-day "
          "window-level error under 50% (daily MAPE is reported but not gated on - daily "
          "revenue noise dominates it; backtest_window_bias_pct shows signed level bias).")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
