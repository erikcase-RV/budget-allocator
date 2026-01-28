-- 05_dq_checks.sql
-- Purpose: Data quality checks for Budget Allocator MVP (last 30 days)

-- A) agg_daily_v2: clicks=0 but cost>0 (last 30d)
SELECT
  searchdate,
  campaign,
  SUM(clickcount) AS clicks,
  SUM(cost) AS cost
FROM bankrate_prod.br_rpt.agg_daily_v2
WHERE searchdate >= date_sub(current_date(), 30)
GROUP BY 1,2
HAVING SUM(clickcount) = 0 AND SUM(cost) > 0
ORDER BY cost DESC
LIMIT 50;

-- B) clicksanalytics_v2: negative/zero cost_per_click (last 30d)
SELECT
  CAST(msg_date AS DATE) AS msg_dt,
  COUNT(*) AS rows,
  SUM(CASE WHEN cost_per_click < 0 THEN 1 ELSE 0 END) AS neg_cpc_rows,
  SUM(CASE WHEN cost_per_click = 0 THEN 1 ELSE 0 END) AS zero_cpc_rows,
  MIN(cost_per_click) AS min_cpc,
  MAX(cost_per_click) AS max_cpc
FROM bankrate_prod.br_rpt.clicksanalytics_v2
WHERE msg_date >= date_sub(current_timestamp(), 30)
GROUP BY 1
ORDER BY 1 DESC;

-- C) ER sanity: show days/platforms where open > clean (last 30d, v3 mapping)
WITH clk AS (
  SELECT
    CAST(msg_date AS DATE) AS dt,
    CASE
      WHEN web = 'sem_savings_google_whale' THEN 'whale'
      WHEN web IN ('sem_savings_google_b','sem_savings_google_c','sem_savings_google_d','sem_savings_google_2','sem_savings_google_1') THEN 'google_main'
      WHEN web IN ('sem_savings_bing_desktop','sem_savings_bing_mobile') THEN 'bing'
      ELSE NULL
    END AS platform,
    COUNT(DISTINCT adv_uid) AS clean,
    SUM(CASE WHEN utm_matched ILIKE 'matched' THEN 1 ELSE 0 END) AS open
  FROM bankrate_prod.br_rpt.clicksanalytics_v2
  WHERE msg_date >= date_sub(current_timestamp(), 30)
  GROUP BY 1,2
)
SELECT *
FROM clk
WHERE platform IS NOT NULL
  AND open > clean
ORDER BY dt DESC, platform;

-- D) Missingness by platform (last 30d) from joined daily KPIs
WITH agg AS (
  SELECT
    searchdate AS dt,
    CASE
      WHEN campaign ILIKE 'SMMA: Automated Bidding' THEN 'google_main'
      WHEN campaign ILIKE 'SMMA: Whale Campaign' THEN 'whale'
      WHEN campaign ILIKE 'p:B | SMMA: Automated Bidding' THEN 'bing'
    END AS platform,
    SUM(clickcount) AS clicks,
    SUM(cost) AS cost
  FROM bankrate_prod.br_rpt.agg_daily_v2
  WHERE searchdate >= date_sub(current_date(), 30)
  GROUP BY 1, 2
),
clk AS (
  SELECT
    CAST(msg_date AS DATE) AS dt,
    CASE
      WHEN web IN ('sem_savings_google_b', 'sem_savings_google_c', 'sem_savings_google_d', 'sem_savings_google_2', 'sem_savings_google_1') THEN 'google_main'
      WHEN web = 'sem_savings_google_whale' THEN 'whale'
      WHEN web IN ('sem_savings_bing_desktop', 'sem_savings_bing_mobile') THEN 'bing'
    END AS platform,
    COUNT(DISTINCT purchaseid) AS rt_clicks
  FROM bankrate_prod.br_rpt.clicksanalytics_v2
  WHERE msg_date >= date_sub(current_timestamp(), 30)
  GROUP BY 1, 2
),
joined AS (
  SELECT
    COALESCE(agg.dt, clk.dt) AS dt,
    COALESCE(agg.platform, clk.platform) AS platform,
    CASE WHEN agg.clicks IS NOT NULL THEN 1 ELSE 0 END AS has_agg,
    CASE WHEN clk.rt_clicks IS NOT NULL THEN 1 ELSE 0 END AS has_clk
  FROM agg
  FULL OUTER JOIN clk ON agg.dt = clk.dt AND agg.platform = clk.platform
)
SELECT
  platform,
  has_agg,
  has_clk,
  COUNT(*) AS row_count
FROM joined
WHERE platform IS NOT NULL
GROUP BY 1, 2, 3
ORDER BY platform, has_agg, has_clk;
