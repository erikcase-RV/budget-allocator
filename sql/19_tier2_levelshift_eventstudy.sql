-- 19_tier2_levelshift_eventstudy.sql
-- Phase 1b Tier 2 (ROBUSTNESS) of the recommender feasibility plan. USES REVENUE.
-- Purpose: guard against the endogeneity failure mode. Tier 1 fit curves on ALL
--          day-to-day spend variation (pacing + budget decisions mixed). Tier 2 isolates
--          DELIBERATE sustained level shifts (changepoint proxy) and asks whether ROAS
--          moves the way diminishing returns predict: spend UP -> ROAS DOWN, spend DOWN
--          -> ROAS UP. Agreement => Tier 1 was reading budget response, not delivery noise.
-- Event = consecutive valid weeks (>=4 active days) with mean-daily-spend ratio >=1.5 (UP)
--          or <=0.667 (DOWN), <=14 days apart. Around each event boundary we compare ROAS
--          in the 14 active days before vs the 14 active days after. Window: trailing 400d.
-- Note: 14d windows around a deliberate move hold seasonality ~constant, a different
--        identification than the full-series Tier 1 fit. Overlapping events within 14d are
--        a known caveat (contamination); reported, not corrected, at feasibility stage.

--------------------------------------------------------------------------------
-- STATEMENT 1: PER-EVENT detail (spend & ROAS before vs after each deliberate shift)
--------------------------------------------------------------------------------
WITH daily AS (
  SELECT date, platform, campaign_key, campaign_name,
         SUM(cost) AS cost, SUM(total_actual_revenue) AS revenue
  FROM bankrate_prod.br_rpt.paid_media_ff_campaign_daily
  WHERE date >= date_sub(current_date(), 400)
    AND date <  current_date()
    AND vertical = 'deposits'
  GROUP BY date, platform, campaign_key, campaign_name
),
elig AS (
  SELECT platform, campaign_key
  FROM daily WHERE cost > 0
  GROUP BY platform, campaign_key
  HAVING COUNT(*) >= 50
),
weekly AS (
  SELECT platform, campaign_key, MAX(campaign_name) AS campaign_name,
         trunc(date, 'WEEK') AS wk,
         SUM(cost) AS wk_cost,
         SUM(CASE WHEN cost > 0 THEN 1 ELSE 0 END) AS active_days
  FROM daily
  GROUP BY platform, campaign_key, trunc(date, 'WEEK')
),
valid_weeks AS (
  SELECT platform, campaign_key, campaign_name, wk,
         wk_cost / NULLIF(active_days, 0) AS wk_mean_daily
  FROM weekly WHERE active_days >= 4
),
seq AS (
  SELECT *,
    LAG(wk_mean_daily) OVER (PARTITION BY platform, campaign_key ORDER BY wk) AS prev_wk_mean,
    LAG(wk)            OVER (PARTITION BY platform, campaign_key ORDER BY wk) AS prev_wk
  FROM valid_weeks
),
events AS (
  SELECT s.platform, s.campaign_key, s.campaign_name, s.wk AS event_date,
         s.wk_mean_daily / NULLIF(s.prev_wk_mean, 0) AS wow_ratio,
         CASE WHEN s.wk_mean_daily / NULLIF(s.prev_wk_mean, 0) >= 1.5 THEN 'UP' ELSE 'DOWN' END AS dir
  FROM seq s
  JOIN elig e USING (platform, campaign_key)
  WHERE datediff(s.wk, s.prev_wk) <= 14
    AND s.prev_wk_mean > 0
    AND (s.wk_mean_daily / NULLIF(s.prev_wk_mean, 0) >= 1.5
      OR s.wk_mean_daily / NULLIF(s.prev_wk_mean, 0) <= 0.6667)
),
bef AS (
  SELECT ev.platform, ev.campaign_key, ev.event_date, ev.dir, ev.wow_ratio,
         SUM(d.cost) AS c_bef, SUM(d.revenue) AS r_bef, COUNT(*) AS n_bef
  FROM events ev
  JOIN daily d ON d.platform = ev.platform AND d.campaign_key = ev.campaign_key
    AND d.date >= date_sub(ev.event_date, 14) AND d.date < ev.event_date AND d.cost > 0
  GROUP BY ev.platform, ev.campaign_key, ev.event_date, ev.dir, ev.wow_ratio
),
aft AS (
  SELECT ev.platform, ev.campaign_key, ev.event_date,
         SUM(d.cost) AS c_aft, SUM(d.revenue) AS r_aft, COUNT(*) AS n_aft
  FROM events ev
  JOIN daily d ON d.platform = ev.platform AND d.campaign_key = ev.campaign_key
    AND d.date >= ev.event_date AND d.date < date_add(ev.event_date, 14) AND d.cost > 0
  GROUP BY ev.platform, ev.campaign_key, ev.event_date
)
SELECT
  b.platform, b.campaign_key, b.event_date, b.dir,
  ROUND(b.wow_ratio, 2) AS wow_ratio,
  ROUND(b.c_bef / b.n_bef, 2) AS spend_bef_daily,
  ROUND(a.c_aft / a.n_aft, 2) AS spend_aft_daily,
  ROUND(b.r_bef / NULLIF(b.c_bef, 0), 3) AS roas_bef,
  ROUND(a.r_aft / NULLIF(a.c_aft, 0), 3) AS roas_aft,
  b.n_bef, a.n_aft,
  CASE
    WHEN (b.dir = 'UP'   AND a.r_aft / NULLIF(a.c_aft, 0) < b.r_bef / NULLIF(b.c_bef, 0))
      OR (b.dir = 'DOWN' AND a.r_aft / NULLIF(a.c_aft, 0) > b.r_bef / NULLIF(b.c_bef, 0))
    THEN 1 ELSE 0 END AS agrees_diminishing
FROM bef b
JOIN aft a USING (platform, campaign_key, event_date)
WHERE b.n_bef >= 7 AND a.n_aft >= 7
ORDER BY b.platform, b.campaign_key, b.event_date;

--------------------------------------------------------------------------------
-- STATEMENT 2: AGREEMENT SUMMARY (overall + per campaign)
--------------------------------------------------------------------------------
WITH daily AS (
  SELECT date, platform, campaign_key, campaign_name,
         SUM(cost) AS cost, SUM(total_actual_revenue) AS revenue
  FROM bankrate_prod.br_rpt.paid_media_ff_campaign_daily
  WHERE date >= date_sub(current_date(), 400)
    AND date <  current_date()
    AND vertical = 'deposits'
  GROUP BY date, platform, campaign_key, campaign_name
),
elig AS (
  SELECT platform, campaign_key
  FROM daily WHERE cost > 0
  GROUP BY platform, campaign_key
  HAVING COUNT(*) >= 50
),
weekly AS (
  SELECT platform, campaign_key, MAX(campaign_name) AS campaign_name,
         trunc(date, 'WEEK') AS wk,
         SUM(cost) AS wk_cost,
         SUM(CASE WHEN cost > 0 THEN 1 ELSE 0 END) AS active_days
  FROM daily GROUP BY platform, campaign_key, trunc(date, 'WEEK')
),
valid_weeks AS (
  SELECT platform, campaign_key, campaign_name, wk,
         wk_cost / NULLIF(active_days, 0) AS wk_mean_daily
  FROM weekly WHERE active_days >= 4
),
seq AS (
  SELECT *,
    LAG(wk_mean_daily) OVER (PARTITION BY platform, campaign_key ORDER BY wk) AS prev_wk_mean,
    LAG(wk)            OVER (PARTITION BY platform, campaign_key ORDER BY wk) AS prev_wk
  FROM valid_weeks
),
events AS (
  SELECT s.platform, s.campaign_key, s.campaign_name, s.wk AS event_date,
         CASE WHEN s.wk_mean_daily / NULLIF(s.prev_wk_mean, 0) >= 1.5 THEN 'UP' ELSE 'DOWN' END AS dir
  FROM seq s
  JOIN elig e USING (platform, campaign_key)
  WHERE datediff(s.wk, s.prev_wk) <= 14
    AND s.prev_wk_mean > 0
    AND (s.wk_mean_daily / NULLIF(s.prev_wk_mean, 0) >= 1.5
      OR s.wk_mean_daily / NULLIF(s.prev_wk_mean, 0) <= 0.6667)
),
bef AS (
  SELECT ev.platform, ev.campaign_key, ev.campaign_name, ev.event_date, ev.dir,
         SUM(d.cost) AS c_bef, SUM(d.revenue) AS r_bef, COUNT(*) AS n_bef
  FROM events ev
  JOIN daily d ON d.platform = ev.platform AND d.campaign_key = ev.campaign_key
    AND d.date >= date_sub(ev.event_date, 14) AND d.date < ev.event_date AND d.cost > 0
  GROUP BY ev.platform, ev.campaign_key, ev.campaign_name, ev.event_date, ev.dir
),
aft AS (
  SELECT ev.platform, ev.campaign_key, ev.event_date,
         SUM(d.cost) AS c_aft, SUM(d.revenue) AS r_aft, COUNT(*) AS n_aft
  FROM events ev
  JOIN daily d ON d.platform = ev.platform AND d.campaign_key = ev.campaign_key
    AND d.date >= ev.event_date AND d.date < date_add(ev.event_date, 14) AND d.cost > 0
  GROUP BY ev.platform, ev.campaign_key, ev.event_date
),
ev_eval AS (
  SELECT b.platform, b.campaign_key, b.campaign_name, b.dir,
    CASE
      WHEN (b.dir = 'UP'   AND a.r_aft / NULLIF(a.c_aft, 0) < b.r_bef / NULLIF(b.c_bef, 0))
        OR (b.dir = 'DOWN' AND a.r_aft / NULLIF(a.c_aft, 0) > b.r_bef / NULLIF(b.c_bef, 0))
      THEN 1 ELSE 0 END AS agrees
  FROM bef b JOIN aft a USING (platform, campaign_key, event_date)
  WHERE b.n_bef >= 7 AND a.n_aft >= 7
)
SELECT
  '== OVERALL ==' AS scope, NULL AS campaign_key,
  COUNT(*) AS events, SUM(agrees) AS agree, ROUND(AVG(agrees), 3) AS agree_rate,
  SUM(CASE WHEN dir='UP' THEN 1 ELSE 0 END) AS up_events,
  SUM(CASE WHEN dir='UP' THEN agrees ELSE 0 END) AS up_agree,
  SUM(CASE WHEN dir='DOWN' THEN 1 ELSE 0 END) AS down_events,
  SUM(CASE WHEN dir='DOWN' THEN agrees ELSE 0 END) AS down_agree
FROM ev_eval
UNION ALL
SELECT
  concat(platform, ' / ', MAX(campaign_name)) AS scope, campaign_key,
  COUNT(*) AS events, SUM(agrees) AS agree, ROUND(AVG(agrees), 3) AS agree_rate,
  SUM(CASE WHEN dir='UP' THEN 1 ELSE 0 END) AS up_events,
  SUM(CASE WHEN dir='UP' THEN agrees ELSE 0 END) AS up_agree,
  SUM(CASE WHEN dir='DOWN' THEN 1 ELSE 0 END) AS down_events,
  SUM(CASE WHEN dir='DOWN' THEN agrees ELSE 0 END) AS down_agree
FROM ev_eval
GROUP BY platform, campaign_key
ORDER BY scope = '== OVERALL ==' DESC, events DESC;
