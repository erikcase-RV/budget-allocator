-- 02_row_counts_last_30d.sql
-- Purpose: Row counts and data freshness for the last 30 days

-- 1) Check render_date range and row count
SELECT
  MIN(render_date) AS min_render_date,
  MAX(render_date) AS max_render_date,
  COUNT(*) AS n
FROM bankrate_prod.br_rpt.clicksanalytics_v2;

-- 2) Check msg_date range
SELECT
  MIN(msg_date) AS min_msg_date,
  MAX(msg_date) AS max_msg_date,
  COUNT(*) AS n
FROM bankrate_prod.br_rpt.clicksanalytics_v2;

-- 3) agg_daily_v2 daily row counts (last 30 days)
SELECT
  searchdate,
  COUNT(*) AS row_count
FROM bankrate_prod.br_rpt.agg_daily_v2
WHERE searchdate >= date_sub(current_date(), 30)
GROUP BY 1
ORDER BY 1;

-- 4) clicksanalytics_v2 daily row counts (last 30 days) using msg_date
SELECT
  CAST(msg_date AS DATE) AS msg_dt,
  COUNT(*) AS row_count
FROM bankrate_prod.br_rpt.clicksanalytics_v2
WHERE msg_date >= date_sub(current_timestamp(), 30)
GROUP BY 1
ORDER BY 1;
