-- 03c_google_main_web_discovery_p14d.sql
-- Purpose: Discover candidate web values for google_main platform

-- 1) Find candidate Google web values by filtering traffic source fields (p14d)
SELECT
  web,
  COUNT(*) AS rows
FROM bankrate_prod.br_rpt.clicksanalytics_v2
WHERE msg_date >= date_sub(current_timestamp(), 14)
  AND (
    LOWER(traffic_source_level_one) LIKE '%google%'
    OR LOWER(traffic_source_level_two) LIKE '%google%'
    OR LOWER(traffic_source_level_three) LIKE '%google%'
  )
GROUP BY 1
ORDER BY rows DESC
LIMIT 50;

-- 2) Fall back to searching web for 'google'
SELECT
  web,
  COUNT(*) AS rows
FROM bankrate_prod.br_rpt.clicksanalytics_v2
WHERE msg_date >= date_sub(current_timestamp(), 14)
  AND LOWER(web) LIKE '%google%'
GROUP BY 1
ORDER BY rows DESC
LIMIT 50;
