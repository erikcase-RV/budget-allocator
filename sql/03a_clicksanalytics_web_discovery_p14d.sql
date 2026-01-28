-- 03a_clicksanalytics_web_discovery_p14d.sql
-- Purpose: Discover web values and traffic source patterns in clicksanalytics_v2

-- 1) Top web values by volume (last 14 days)
SELECT
  web,
  COUNT(*) AS rows
FROM bankrate_prod.br_rpt.clicksanalytics_v2
WHERE msg_date >= date_sub(current_timestamp(), 14)
GROUP BY 1
ORDER BY rows DESC
LIMIT 50;

-- 2) Traffic source breakdown (last 14 days)
SELECT
  traffic_source_level_one,
  traffic_source_level_two,
  traffic_source_level_three,
  COUNT(*) AS rows
FROM bankrate_prod.br_rpt.clicksanalytics_v2
WHERE msg_date >= date_sub(current_timestamp(), 14)
GROUP BY 1,2,3
ORDER BY rows DESC
LIMIT 50;
