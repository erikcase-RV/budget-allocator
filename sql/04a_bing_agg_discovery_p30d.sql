-- 04a_bing_agg_discovery_p30d.sql
-- Purpose: Discover Bing campaigns in agg_daily_v2 (last 30 days)

-- 1) Find campaigns by platform/provider/channel fields
SELECT
  platform,
  provider,
  channel,
  COUNT(*) AS rows,
  SUM(clickcount) AS clicks,
  SUM(cost) AS cost
FROM bankrate_prod.br_rpt.agg_daily_v2
WHERE searchdate >= date_sub(current_date(), 30)
GROUP BY 1,2,3
ORDER BY cost DESC
LIMIT 50;

-- 2) Search campaign names for bing-ish patterns (case-insensitive)
SELECT
  campaign,
  SUM(clickcount) AS clicks,
  SUM(cost) AS cost
FROM bankrate_prod.br_rpt.agg_daily_v2
WHERE searchdate >= date_sub(current_date(), 30)
  AND (
    LOWER(campaign) LIKE '%bing%'
    OR LOWER(campaign) LIKE '%p:b%'
    OR LOWER(campaign) LIKE '%microsoft%'
  )
GROUP BY 1
ORDER BY cost DESC
LIMIT 50;
