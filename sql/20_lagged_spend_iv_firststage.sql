-- 20_lagged_spend_iv_firststage.sql
-- Validation agenda item #1 (endogeneity): lagged-spend instrument STRENGTH.
-- The endogeneity worry: budgets rise when performance is good, so realized spend is
-- correlated with the revenue shock. A lagged-spend instrument (yesterday's / last week's
-- spend) is valid only if (a) it predicts today's spend strongly [first stage, tested here]
-- and (b) it affects today's revenue only through today's spend [an assumption, not tested
-- in SQL]. Here we measure first-stage strength = budget persistence.
-- First-stage F for a single regressor: F = R^2 * (n - 2) / (1 - R^2); F > 10 = strong.
-- Two instruments tested: lag7 (same weekday, removes day-of-week) and lag1 (next-day
-- persistence). Calendar self-joins so a "lag" is a true 7-day / 1-day gap, not a row offset.
-- Source: paid_media_ff_campaign_daily, deposits, trailing 365d, active days only.

WITH daily AS (
  SELECT date, platform, campaign_key, campaign_name,
         SUM(cost) AS cost, SUM(total_actual_revenue) AS revenue
  FROM bankrate_prod.br_rpt.paid_media_ff_campaign_daily
  WHERE date >= date_sub(current_date(), 365)
    AND date <  current_date()
    AND vertical = 'deposits'
  GROUP BY date, platform, campaign_key, campaign_name
),
unit_daily AS (
  SELECT date, unit, label, cost FROM (
    SELECT date, concat('PLATFORM:', platform) AS unit, platform AS label,
           SUM(cost) AS cost
    FROM daily GROUP BY date, platform
    UNION ALL
    SELECT date, concat('CAMPAIGN:', platform, '|', campaign_key) AS unit,
           concat(platform, ' / ', campaign_name) AS label, cost
    FROM daily
  ) WHERE cost > 0
),
elig AS (SELECT unit FROM unit_daily GROUP BY unit HAVING COUNT(*) >= 50),
ud AS (SELECT u.* FROM unit_daily u JOIN elig e USING (unit)),
pairs7 AS (
  SELECT a.unit, ln(a.cost) AS y, ln(b.cost) AS x
  FROM ud a JOIN ud b ON a.unit = b.unit AND b.date = date_sub(a.date, 7)
),
pairs1 AS (
  SELECT a.unit, ln(a.cost) AS y, ln(b.cost) AS x
  FROM ud a JOIN ud b ON a.unit = b.unit AND b.date = date_sub(a.date, 1)
),
fs7 AS (
  SELECT unit, COUNT(*) AS n7, regr_r2(y, x) AS r2_7, regr_slope(y, x) AS slope_7
  FROM pairs7 GROUP BY unit
),
fs1 AS (
  SELECT unit, COUNT(*) AS n1, regr_r2(y, x) AS r2_1, regr_slope(y, x) AS slope_1
  FROM pairs1 GROUP BY unit
)
SELECT
  f7.unit, MAX(u.label) AS label,
  f7.n7, ROUND(f7.r2_7, 3) AS r2_lag7, ROUND(f7.slope_7, 3) AS slope_lag7,
  ROUND(f7.r2_7 * (f7.n7 - 2) / NULLIF(1 - f7.r2_7, 0), 1) AS approx_F_lag7,
  f1.n1, ROUND(f1.r2_1, 3) AS r2_lag1,
  ROUND(f1.r2_1 * (f1.n1 - 2) / NULLIF(1 - f1.r2_1, 0), 1) AS approx_F_lag1
FROM fs7 f7
JOIN fs1 f1 USING (unit)
JOIN ud u USING (unit)
GROUP BY f7.unit, f7.n7, f7.r2_7, f7.slope_7, f1.n1, f1.r2_1
ORDER BY approx_F_lag7 DESC;
