-- 22_walk_forward_actuals.sql
-- Documenting copy of the walk-forward backtest data pull executed by recommender.py
-- (fetch_daily(BACKTEST_LOOKBACK_DAYS=700, a_core_only=True)). Saved per AGENTS.md
-- "save every query". The backtest itself (3 expanding-window folds x 14-day horizon,
-- train-only seasonal factors, curve-vs-naive MAPE) runs in Python; see
-- docs/recommender_hardening.md.
-- A-core scope = Google/Microsoft search units that cleared the strong-pass gate
-- (docs/recommender_feasibility.md section 5). The campaign keys are all within the
-- two platforms, so the platform filter alone is sufficient; keys kept for clarity.

SELECT date, platform, campaign_key, campaign_name,
       SUM(cost) AS cost, SUM(total_actual_revenue) AS revenue
FROM bankrate_prod.br_rpt.paid_media_ff_campaign_daily
WHERE date >= date_sub(current_date(), 700)
  AND date <  current_date()
  AND vertical = 'deposits'
  AND (
    platform IN ('Google', 'Microsoft')
    OR campaign_key IN ('20455602196', '20455602199', '506073492', '506118190', '506118191')
  )
GROUP BY date, platform, campaign_key, campaign_name
ORDER BY date;
