-- 09_meta_taboola_feasibility_p14d.sql
-- Purpose: Feasibility check for Meta + Taboola deposits traffic
-- Time window: last 14 completed days (exclude today)
-- Run date: 2026-01-28
--
-- Identifiers tested:
--   A) web = 'meta_savings'
--   B) fbclid IS NOT NULL
--   C) web = 'smma_taboola'
--
-- Join: LEFT JOIN deposits_postlead ON regexp_replace(brlid,'[^0-9]','') = purchaseid

--------------------------------------------------------------------------------
-- 2A) VOLUME SANITY: Meta web='meta_savings' - DAILY
--------------------------------------------------------------------------------
SELECT
  CAST(msg_date AS DATE) AS dt,
  COUNT(DISTINCT purchaseid) AS rt_clicks,
  SUM(CASE WHEN cost_per_click > 0 THEN cost_per_click ELSE 0 END) AS revenue_paid
FROM bankrate_prod.br_rpt.clicksanalytics_v2
WHERE CAST(msg_date AS DATE) >= date_sub(current_date(), 14)
  AND CAST(msg_date AS DATE) < current_date()
  AND web = 'meta_savings'
GROUP BY 1
ORDER BY 1;

--------------------------------------------------------------------------------
-- 2A) VOLUME SANITY: Meta web='meta_savings' - 14D TOTAL
--------------------------------------------------------------------------------
SELECT
  'meta_savings_14d' AS identifier,
  COUNT(DISTINCT purchaseid) AS rt_clicks,
  SUM(CASE WHEN cost_per_click > 0 THEN cost_per_click ELSE 0 END) AS revenue_paid
FROM bankrate_prod.br_rpt.clicksanalytics_v2
WHERE CAST(msg_date AS DATE) >= date_sub(current_date(), 14)
  AND CAST(msg_date AS DATE) < current_date()
  AND web = 'meta_savings';

--------------------------------------------------------------------------------
-- 2B) VOLUME SANITY: Meta fbclid IS NOT NULL - DAILY
--------------------------------------------------------------------------------
SELECT
  CAST(msg_date AS DATE) AS dt,
  COUNT(DISTINCT purchaseid) AS rt_clicks,
  SUM(CASE WHEN cost_per_click > 0 THEN cost_per_click ELSE 0 END) AS revenue_paid
FROM bankrate_prod.br_rpt.clicksanalytics_v2
WHERE CAST(msg_date AS DATE) >= date_sub(current_date(), 14)
  AND CAST(msg_date AS DATE) < current_date()
  AND fbclid IS NOT NULL
GROUP BY 1
ORDER BY 1;

--------------------------------------------------------------------------------
-- 2B) VOLUME SANITY: Meta fbclid IS NOT NULL - 14D TOTAL
--------------------------------------------------------------------------------
SELECT
  'fbclid_not_null_14d' AS identifier,
  COUNT(DISTINCT purchaseid) AS rt_clicks,
  SUM(CASE WHEN cost_per_click > 0 THEN cost_per_click ELSE 0 END) AS revenue_paid
FROM bankrate_prod.br_rpt.clicksanalytics_v2
WHERE CAST(msg_date AS DATE) >= date_sub(current_date(), 14)
  AND CAST(msg_date AS DATE) < current_date()
  AND fbclid IS NOT NULL;

--------------------------------------------------------------------------------
-- 2C) VOLUME SANITY: Taboola web='smma_taboola' - DAILY
--------------------------------------------------------------------------------
SELECT
  CAST(msg_date AS DATE) AS dt,
  COUNT(DISTINCT purchaseid) AS rt_clicks,
  SUM(CASE WHEN cost_per_click > 0 THEN cost_per_click ELSE 0 END) AS revenue_paid
FROM bankrate_prod.br_rpt.clicksanalytics_v2
WHERE CAST(msg_date AS DATE) >= date_sub(current_date(), 14)
  AND CAST(msg_date AS DATE) < current_date()
  AND web = 'smma_taboola'
GROUP BY 1
ORDER BY 1;

--------------------------------------------------------------------------------
-- 2C) VOLUME SANITY: Taboola web='smma_taboola' - 14D TOTAL
--------------------------------------------------------------------------------
SELECT
  'smma_taboola_14d' AS identifier,
  COUNT(DISTINCT purchaseid) AS rt_clicks,
  SUM(CASE WHEN cost_per_click > 0 THEN cost_per_click ELSE 0 END) AS revenue_paid
FROM bankrate_prod.br_rpt.clicksanalytics_v2
WHERE CAST(msg_date AS DATE) >= date_sub(current_date(), 14)
  AND CAST(msg_date AS DATE) < current_date()
  AND web = 'smma_taboola';

--------------------------------------------------------------------------------
-- 3A) OUTCOME JOIN COVERAGE: Meta web='meta_savings'
--------------------------------------------------------------------------------
SELECT
  'meta_savings' AS identifier,
  COUNT(DISTINCT c.purchaseid) AS rt_clicks,
  COUNT(DISTINCT regexp_replace(p.brlid, '[^0-9]', '')) AS matched_postlead,
  COUNT(DISTINCT regexp_replace(p.brlid, '[^0-9]', '')) / NULLIF(COUNT(DISTINCT c.purchaseid), 0) AS match_rate,
  COUNT(DISTINCT CASE WHEN p.funded_amount > 0 THEN regexp_replace(p.brlid, '[^0-9]', '') END) AS funded_matches,
  SUM(COALESCE(p.funded_amount, 0)) AS funded_amount,
  COUNT(DISTINCT regexp_replace(p.brlid, '[^0-9]', '')) AS open_proxy
FROM bankrate_prod.br_rpt.clicksanalytics_v2 c
LEFT JOIN bankrate_prod.br_rpt.deposits_postlead p
  ON regexp_replace(p.brlid, '[^0-9]', '') = c.purchaseid
WHERE CAST(c.msg_date AS DATE) >= date_sub(current_date(), 14)
  AND CAST(c.msg_date AS DATE) < current_date()
  AND c.web = 'meta_savings';

--------------------------------------------------------------------------------
-- 3B) OUTCOME JOIN COVERAGE: Meta fbclid IS NOT NULL
--------------------------------------------------------------------------------
SELECT
  'fbclid_not_null' AS identifier,
  COUNT(DISTINCT c.purchaseid) AS rt_clicks,
  COUNT(DISTINCT regexp_replace(p.brlid, '[^0-9]', '')) AS matched_postlead,
  COUNT(DISTINCT regexp_replace(p.brlid, '[^0-9]', '')) / NULLIF(COUNT(DISTINCT c.purchaseid), 0) AS match_rate,
  COUNT(DISTINCT CASE WHEN p.funded_amount > 0 THEN regexp_replace(p.brlid, '[^0-9]', '') END) AS funded_matches,
  SUM(COALESCE(p.funded_amount, 0)) AS funded_amount,
  COUNT(DISTINCT regexp_replace(p.brlid, '[^0-9]', '')) AS open_proxy
FROM bankrate_prod.br_rpt.clicksanalytics_v2 c
LEFT JOIN bankrate_prod.br_rpt.deposits_postlead p
  ON regexp_replace(p.brlid, '[^0-9]', '') = c.purchaseid
WHERE CAST(c.msg_date AS DATE) >= date_sub(current_date(), 14)
  AND CAST(c.msg_date AS DATE) < current_date()
  AND c.fbclid IS NOT NULL;

--------------------------------------------------------------------------------
-- 3C) OUTCOME JOIN COVERAGE: Taboola web='smma_taboola'
--------------------------------------------------------------------------------
SELECT
  'smma_taboola' AS identifier,
  COUNT(DISTINCT c.purchaseid) AS rt_clicks,
  COUNT(DISTINCT regexp_replace(p.brlid, '[^0-9]', '')) AS matched_postlead,
  COUNT(DISTINCT regexp_replace(p.brlid, '[^0-9]', '')) / NULLIF(COUNT(DISTINCT c.purchaseid), 0) AS match_rate,
  COUNT(DISTINCT CASE WHEN p.funded_amount > 0 THEN regexp_replace(p.brlid, '[^0-9]', '') END) AS funded_matches,
  SUM(COALESCE(p.funded_amount, 0)) AS funded_amount,
  COUNT(DISTINCT regexp_replace(p.brlid, '[^0-9]', '')) AS open_proxy
FROM bankrate_prod.br_rpt.clicksanalytics_v2 c
LEFT JOIN bankrate_prod.br_rpt.deposits_postlead p
  ON regexp_replace(p.brlid, '[^0-9]', '') = c.purchaseid
WHERE CAST(c.msg_date AS DATE) >= date_sub(current_date(), 14)
  AND CAST(c.msg_date AS DATE) < current_date()
  AND c.web = 'smma_taboola';

--------------------------------------------------------------------------------
-- 4) OVERLAP CHECK: Meta identifiers
--------------------------------------------------------------------------------
SELECT
  COUNT(DISTINCT CASE WHEN web = 'meta_savings' THEN purchaseid END) AS meta_savings_only,
  COUNT(DISTINCT CASE WHEN fbclid IS NOT NULL THEN purchaseid END) AS fbclid_not_null_only,
  COUNT(DISTINCT CASE WHEN web = 'meta_savings' AND fbclid IS NOT NULL THEN purchaseid END) AS both_intersection,
  COUNT(DISTINCT CASE WHEN web = 'meta_savings' OR fbclid IS NOT NULL THEN purchaseid END) AS either_union
FROM bankrate_prod.br_rpt.clicksanalytics_v2
WHERE CAST(msg_date AS DATE) >= date_sub(current_date(), 14)
  AND CAST(msg_date AS DATE) < current_date();
