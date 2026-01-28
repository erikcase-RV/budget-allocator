-- 07_naive_allocator_suggestion.sql
-- Purpose: Naive budget allocator suggestion based on 7d rolling KPIs

WITH daily AS (
  SELECT
    searchdate AS dt,
    CASE
      WHEN campaign ILIKE 'SMMA: Automated Bidding' THEN 'google_main'
      WHEN campaign ILIKE 'SMMA: Whale Campaign' THEN 'whale'
      WHEN campaign ILIKE 'p:B | SMMA: Automated Bidding%' THEN 'bing'
    END AS platform,
    SUM(clickcount) AS clicks,
    SUM(cost) AS cost
  FROM bankrate_prod.br_rpt.agg_daily_v2
  WHERE searchdate >= date_sub(current_date(), 7)
    AND searchdate < current_date()
  GROUP BY 1, 2
),
clk_daily AS (
  SELECT
    CAST(msg_date AS DATE) AS dt,
    CASE
      WHEN web IN ('sem_savings_google_b', 'sem_savings_google_c', 'sem_savings_google_d', 'sem_savings_google_2', 'sem_savings_google_1') THEN 'google_main'
      WHEN web = 'sem_savings_google_whale' THEN 'whale'
      WHEN web IN ('sem_savings_bing_desktop', 'sem_savings_bing_mobile') THEN 'bing'
    END AS platform,
    COUNT(DISTINCT CASE WHEN cost_per_click > 0 THEN purchaseid END) AS rt_clicks_paid,
    SUM(CASE WHEN cost_per_click > 0 THEN cost_per_click ELSE 0 END) AS revenue_paid
  FROM bankrate_prod.br_rpt.clicksanalytics_v2
  WHERE CAST(msg_date AS DATE) >= date_sub(current_date(), 7)
    AND CAST(msg_date AS DATE) < current_date()
  GROUP BY 1, 2
),
joined AS (
  SELECT
    COALESCE(d.dt, c.dt) AS dt,
    COALESCE(d.platform, c.platform) AS platform,
    COALESCE(d.clicks, 0) AS clicks,
    COALESCE(d.cost, 0) AS cost,
    COALESCE(c.rt_clicks_paid, 0) AS rt_clicks_paid,
    COALESCE(c.revenue_paid, 0) AS revenue_paid
  FROM daily d
  FULL OUTER JOIN clk_daily c ON d.dt = c.dt AND d.platform = c.platform
  WHERE COALESCE(d.platform, c.platform) IS NOT NULL
),
rollups AS (
  SELECT
    platform,
    SUM(clicks) AS clicks_7d,
    SUM(cost) AS cost_7d,
    SUM(rt_clicks_paid) AS rt_clicks_paid_7d,
    SUM(revenue_paid) AS revenue_paid_7d,
    SUM(cost) / NULLIF(SUM(clicks), 0) AS cpc_7d,
    SUM(rt_clicks_paid) / NULLIF(SUM(clicks), 0) AS rtctr_paid_7d,
    SUM(revenue_paid) / NULLIF(SUM(rt_clicks_paid), 0) AS rpc_paid_7d
  FROM joined
  GROUP BY platform
),
metrics AS (
  SELECT
    platform,
    clicks_7d,
    cost_7d,
    cpc_7d,
    rtctr_paid_7d,
    rpc_paid_7d,
    (rtctr_paid_7d * rpc_paid_7d) / NULLIF(cpc_7d, 0) AS expected_revenue_per_dollar,
    rtctr_paid_7d / NULLIF(cpc_7d, 0) AS expected_paid_clicks_per_dollar,
    CASE WHEN clicks_7d >= 1000 THEN 1 ELSE 0 END AS eligible
  FROM rollups
),
weights AS (
  SELECT
    platform,
    clicks_7d,
    cost_7d,
    cpc_7d,
    rtctr_paid_7d,
    rpc_paid_7d,
    expected_revenue_per_dollar,
    expected_paid_clicks_per_dollar,
    eligible,
    CASE 
      WHEN eligible = 1 THEN GREATEST(expected_revenue_per_dollar, 0.10)
      ELSE 0 
    END AS raw_weight
  FROM metrics
),
totals AS (
  SELECT SUM(raw_weight) AS total_weight FROM weights WHERE eligible = 1
)
SELECT
  w.platform,
  w.expected_revenue_per_dollar,
  w.expected_paid_clicks_per_dollar,
  CASE 
    WHEN w.eligible = 1 THEN w.raw_weight / t.total_weight
    ELSE 0 
  END AS allocation_weight
FROM weights w
CROSS JOIN totals t
ORDER BY allocation_weight DESC;
