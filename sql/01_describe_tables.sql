-- 01_describe_tables.sql
-- Purpose: Confirm environment + validate table existence + capture schema details
-- Do not modify data. Read-only only.

-- A) Environment (helps debug catalog/schema issues)
SELECT
  current_user()      AS current_user,
  current_catalog()   AS current_catalog,
  current_schema()    AS current_schema;

-- B) Table existence + metadata
DESCRIBE TABLE EXTENDED bankrate_prod.br_rpt.agg_daily_v2;
DESCRIBE TABLE EXTENDED bankrate_prod.br_rpt.clicksanalytics_v2;

-- C) Column lists (often easiest to diff + reference later)
SHOW COLUMNS IN bankrate_prod.br_rpt.agg_daily_v2;
SHOW COLUMNS IN bankrate_prod.br_rpt.clicksanalytics_v2;
