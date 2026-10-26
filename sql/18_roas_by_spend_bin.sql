-- 18_roas_by_spend_bin.sql
-- Phase 1b (CONFIRMATORY) of the recommender feasibility plan.
-- Run ONCE against the REGISTERED thresholds (see docs/recommender_feasibility_plan.md).
-- Purpose: test whether ROAS exhibits diminishing returns as daily spend rises, within
--          each unit (platform + qualifying campaigns), and whether the pattern survives
--          day-of-week control. THIS QUERY USES REVENUE (the registered outcome).
-- Unit = a platform OR a campaign. Spend quintiles formed within-unit on daily cost
--          (active days only). Fit window: trailing 365 days. Units with <50 active
--          days are dropped (cannot form 5 stable quintiles). Source: deposits FF table.
-- DoW control (stmt 3): deseasonalize cost & revenue by unit x day-of-week means, then
--          re-bin on adjusted cost and recompute -- removes multiplicative weekday effects.

--------------------------------------------------------------------------------
-- STATEMENT 1: RAW per-unit spend-quintile ROAS + marginal rev/$ slope
--------------------------------------------------------------------------------
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
  SELECT date, unit, label, dow, cost, revenue FROM (
    SELECT date, concat('PLATFORM:', platform) AS unit, platform AS label,
           dayofweek(date) AS dow, SUM(cost) AS cost, SUM(revenue) AS revenue
    FROM daily GROUP BY date, platform
    UNION ALL
    SELECT date, concat('CAMPAIGN:', platform, '|', campaign_key) AS unit,
           concat(platform, ' / ', campaign_name) AS label,
           dayofweek(date) AS dow, cost, revenue
    FROM daily
  ) WHERE cost > 0
),
elig AS (
  SELECT unit FROM unit_daily GROUP BY unit HAVING COUNT(*) >= 50
),
binned AS (
  SELECT u.*, ntile(5) OVER (PARTITION BY u.unit ORDER BY u.cost) AS q
  FROM unit_daily u JOIN elig e USING (unit)
),
q_agg AS (
  SELECT unit, MAX(label) AS label, q, COUNT(*) AS days,
         AVG(cost) AS mean_cost, AVG(revenue) AS mean_rev,
         SUM(revenue) / NULLIF(SUM(cost), 0) AS roas
  FROM binned GROUP BY unit, q
),
q_lag AS (
  SELECT *,
    LAG(mean_cost) OVER (PARTITION BY unit ORDER BY q) AS pmc,
    LAG(mean_rev)  OVER (PARTITION BY unit ORDER BY q) AS pmr
  FROM q_agg
)
SELECT
  unit, label, q, days,
  ROUND(mean_cost, 2) AS mean_cost,
  ROUND(mean_rev, 2)  AS mean_rev,
  ROUND(roas, 3)      AS roas,
  ROUND((mean_rev - pmr) / NULLIF(mean_cost - pmc, 0), 3) AS marginal_rev_per_dollar
FROM q_lag
ORDER BY unit, q;

--------------------------------------------------------------------------------
-- STATEMENT 2: RAW per-unit PASS summary (diminishing-returns test)
--------------------------------------------------------------------------------
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
  SELECT date, unit, label, dow, cost, revenue FROM (
    SELECT date, concat('PLATFORM:', platform) AS unit, platform AS label,
           dayofweek(date) AS dow, SUM(cost) AS cost, SUM(revenue) AS revenue
    FROM daily GROUP BY date, platform
    UNION ALL
    SELECT date, concat('CAMPAIGN:', platform, '|', campaign_key) AS unit,
           concat(platform, ' / ', campaign_name) AS label,
           dayofweek(date) AS dow, cost, revenue
    FROM daily
  ) WHERE cost > 0
),
elig AS (
  SELECT unit FROM unit_daily GROUP BY unit HAVING COUNT(*) >= 50
),
binned AS (
  SELECT u.*, ntile(5) OVER (PARTITION BY u.unit ORDER BY u.cost) AS q
  FROM unit_daily u JOIN elig e USING (unit)
),
q_agg AS (
  SELECT unit, MAX(label) AS label, q, COUNT(*) AS days,
         AVG(cost) AS mean_cost,
         SUM(revenue) / NULLIF(SUM(cost), 0) AS roas
  FROM binned GROUP BY unit, q
),
q_lag AS (
  SELECT *, LAG(roas) OVER (PARTITION BY unit ORDER BY q) AS prev_roas FROM q_agg
)
SELECT
  unit, MAX(label) AS label,
  SUM(days) AS total_days,
  ROUND(MAX(CASE WHEN q = 1 THEN roas END), 3) AS roas_q1,
  ROUND(MAX(CASE WHEN q = 5 THEN roas END), 3) AS roas_q5,
  SUM(CASE WHEN q >= 2 AND roas < prev_roas THEN 1 ELSE 0 END) AS declining_roas_steps,
  CASE WHEN MAX(CASE WHEN q = 5 THEN roas END) < MAX(CASE WHEN q = 1 THEN roas END)
       THEN 1 ELSE 0 END AS top_lt_bottom,
  CASE WHEN SUM(CASE WHEN q >= 2 AND roas < prev_roas THEN 1 ELSE 0 END) >= 3
        AND MAX(CASE WHEN q = 5 THEN roas END) < MAX(CASE WHEN q = 1 THEN roas END)
       THEN 'PASS' ELSE 'fail' END AS tier1_raw
FROM q_lag
GROUP BY unit
ORDER BY tier1_raw DESC, declining_roas_steps DESC, unit;

--------------------------------------------------------------------------------
-- STATEMENT 3: DAY-OF-WEEK-CONTROLLED per-unit PASS summary
-- Deseasonalize cost & revenue by unit x dow means, re-bin on adjusted cost.
--------------------------------------------------------------------------------
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
  SELECT date, unit, label, dow, cost, revenue FROM (
    SELECT date, concat('PLATFORM:', platform) AS unit, platform AS label,
           dayofweek(date) AS dow, SUM(cost) AS cost, SUM(revenue) AS revenue
    FROM daily GROUP BY date, platform
    UNION ALL
    SELECT date, concat('CAMPAIGN:', platform, '|', campaign_key) AS unit,
           concat(platform, ' / ', campaign_name) AS label,
           dayofweek(date) AS dow, cost, revenue
    FROM daily
  ) WHERE cost > 0
),
elig AS (
  SELECT unit FROM unit_daily GROUP BY unit HAVING COUNT(*) >= 50
),
ud AS (
  SELECT u.* FROM unit_daily u JOIN elig e USING (unit)
),
dow_means AS (
  SELECT unit, dow, AVG(cost) AS mc_dow, AVG(revenue) AS mr_dow FROM ud GROUP BY unit, dow
),
overall AS (
  SELECT unit, AVG(cost) AS mc_all, AVG(revenue) AS mr_all FROM ud GROUP BY unit
),
adj AS (
  SELECT ud.unit, ud.label,
         ud.cost    / NULLIF(dm.mc_dow, 0) * o.mc_all AS adj_cost,
         ud.revenue / NULLIF(dm.mr_dow, 0) * o.mr_all AS adj_rev
  FROM ud
  JOIN dow_means dm USING (unit, dow)
  JOIN overall   o  USING (unit)
  WHERE dm.mc_dow > 0
),
binned AS (
  SELECT *, ntile(5) OVER (PARTITION BY unit ORDER BY adj_cost) AS q FROM adj
),
q_agg AS (
  SELECT unit, MAX(label) AS label, q, COUNT(*) AS days,
         SUM(adj_rev) / NULLIF(SUM(adj_cost), 0) AS roas
  FROM binned GROUP BY unit, q
),
q_lag AS (
  SELECT *, LAG(roas) OVER (PARTITION BY unit ORDER BY q) AS prev_roas FROM q_agg
)
SELECT
  unit, MAX(label) AS label,
  ROUND(MAX(CASE WHEN q = 1 THEN roas END), 3) AS roas_q1_adj,
  ROUND(MAX(CASE WHEN q = 5 THEN roas END), 3) AS roas_q5_adj,
  SUM(CASE WHEN q >= 2 AND roas < prev_roas THEN 1 ELSE 0 END) AS declining_roas_steps_adj,
  CASE WHEN SUM(CASE WHEN q >= 2 AND roas < prev_roas THEN 1 ELSE 0 END) >= 3
        AND MAX(CASE WHEN q = 5 THEN roas END) < MAX(CASE WHEN q = 1 THEN roas END)
       THEN 'PASS' ELSE 'fail' END AS tier1_dow_controlled
FROM q_lag
GROUP BY unit
ORDER BY tier1_dow_controlled DESC, declining_roas_steps_adj DESC, unit;
