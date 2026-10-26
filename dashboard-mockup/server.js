const express = require('express');
const path = require('path');
const { DBSQLClient } = require('@databricks/sql');

const app = express();
const PORT = process.env.DATABRICKS_APP_PORT || process.env.PORT || 8000;

// Serve Vite-built static assets
app.use(express.static(path.join(__dirname, 'dist')));

function platformNormalizationExpr(column = 'platform') {
  return `
    CASE
      WHEN lower(${column}) = 'whale' THEN 'Google'
      ELSE ${column}
    END
  `;
}

// ---------------------------------------------------------------------------
// Databricks SQL helper
// ---------------------------------------------------------------------------
async function getClient() {
  const rawHost = process.env.DATABRICKS_HOST;
  const clientId = process.env.DATABRICKS_CLIENT_ID;
  const clientSecret = process.env.DATABRICKS_CLIENT_SECRET;
  const warehouseId = process.env.DATABRICKS_WAREHOUSE_ID;
  const token = process.env.DATABRICKS_TOKEN;
  const httpPath = process.env.DATABRICKS_HTTP_PATH ||
    (warehouseId ? `/sql/1.0/warehouses/${warehouseId}` : null);

  if (!rawHost) {
    throw new Error('Missing required env var DATABRICKS_HOST');
  }
  const host = rawHost.replace(/^https?:\/\//, '');
  const client = new DBSQLClient();

  // OAuth M2M — the Databricks Apps runtime injects client id/secret
  if (clientId && clientSecret && warehouseId) {
    return client.connect({
      authType: 'databricks-oauth',
      host,
      path: `/sql/1.0/warehouses/${warehouseId}`,
      oauthClientId: clientId,
      oauthClientSecret: clientSecret,
    });
  }

  // PAT — local dev, same vars as the repo-root .env used by run_sql.py
  if (token && httpPath) {
    return client.connect({ host, path: httpPath, token });
  }

  throw new Error(
    'Missing Databricks credentials: need either ' +
    'DATABRICKS_CLIENT_ID + DATABRICKS_CLIENT_SECRET + DATABRICKS_WAREHOUSE_ID (OAuth, prod) ' +
    'or DATABRICKS_TOKEN + DATABRICKS_HTTP_PATH (PAT, local dev). Got: ' +
    `CLIENT_ID=${clientId ? 'set' : 'missing'}, CLIENT_SECRET=${clientSecret ? 'set' : 'missing'}, ` +
    `WAREHOUSE_ID=${warehouseId ? 'set' : 'missing'}, TOKEN=${token ? 'set' : 'missing'}, ` +
    `HTTP_PATH=${process.env.DATABRICKS_HTTP_PATH ? 'set' : 'missing'}`
  );
}

async function runQuery(sql) {
  const client = await getClient();
  try {
    const session = await client.openSession();
    const operation = await session.executeStatement(sql, {
      runAsync: true,
      maxRows: 10000,
    });
    const result = await operation.fetchAll();
    await operation.close();
    await session.close();
    return result;
  } finally {
    await client.close();
  }
}

// ---------------------------------------------------------------------------
// Vertical and sub-vertical filter helper
// ?vertical=deposits  -> AND vertical = 'deposits'  (default)
// ?vertical=all       -> no filter (all verticals)
// ?vertical=mortgages -> AND vertical = 'mortgages'
// ?sub_vertical=savings -> AND sub_vertical = 'savings' (for deposits only)
// ---------------------------------------------------------------------------
function verticalFilter(req) {
  const v = (req.query.vertical || 'deposits').toLowerCase();
  const sv = req.query.sub_vertical?.toLowerCase();
  
  // Validate inputs to prevent SQL injection
  const validVerticals = ['deposits', 'mortgages', 'home equity', 'all'];
  const validSubVerticals = ['savings', 'cds'];
  
  if (!validVerticals.includes(v)) {
    throw new Error(`Invalid vertical: ${v}`);
  }
  
  if (sv && !validSubVerticals.includes(sv)) {
    throw new Error(`Invalid sub_vertical: ${sv}`);
  }
  
  if (v === 'all') return '';
  
  let filter = `AND vertical = '${v}'`;
  
  // Add sub-vertical filter for deposits only
  if (v === 'deposits' && sv) {
    filter += ` AND (
      CASE 
        WHEN campaign_name ILIKE '%cd%' OR campaign_name ILIKE '%certificate%' THEN 'cds'
        WHEN campaign_name ILIKE '%savings%' OR campaign_name ILIKE '%deposit%' THEN 'savings'
        ELSE 'savings'
      END = '${sv}'
    )`;
  }
  
  return filter;
}

function normalizePlatformParam(value) {
  if (!value) return null;

  const normalized = String(value).trim().toLowerCase();
  if (!normalized || normalized === 'all') return null;

  const platformMap = {
    google: 'Google',
    whale: 'Google',
    bing: 'Microsoft',
    microsoft: 'Microsoft',
    meta: 'Meta',
    taboola: 'Taboola',
  };

  const mapped = platformMap[normalized];
  if (!mapped) {
    throw new Error(`Invalid platform: ${value}`);
  }

  return mapped;
}

function platformFilter(req, column = 'platform') {
  const platform = normalizePlatformParam(req.query.platform);
  return platform ? `AND ${column} = '${platform}'` : '';
}

function campaignKeyFilter(req, column = 'campaign_key') {
  const rawCampaignKey = req.query.campaign_key;
  if (!rawCampaignKey) return '';

  const campaignKey = String(rawCampaignKey).trim();
  if (!/^[A-Za-z0-9._:-]+$/.test(campaignKey)) {
    throw new Error(`Invalid campaign_key: ${rawCampaignKey}`);
  }

  return `AND ${column} = '${campaignKey}'`;
}

function normalizeStatusParam(value) {
  if (!value) return null;

  const normalized = String(value).trim().toLowerCase();
  if (!normalized || normalized === 'all') return null;

  const validStatuses = ['in_flight', 'recently_ended', 'stale'];
  if (!validStatuses.includes(normalized)) {
    throw new Error(`Invalid status: ${value}`);
  }

  return normalized;
}

function statusFilter(req, column = 'status_bucket') {
  const status = normalizeStatusParam(req.query.status);
  return status ? `AND ${column} = '${status}'` : '';
}

function parseLimit(value, fallback, max) {
  if (value === undefined) return fallback;

  const parsed = Number.parseInt(String(value), 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`Invalid limit: ${value}`);
  }

  return Math.min(parsed, max);
}

function statusBucketExpr(column = 'last_seen_date') {
  return `
    CASE
      WHEN ${column} >= date_sub(current_date(), 2) THEN 'in_flight'
      WHEN ${column} >= date_sub(current_date(), 14) THEN 'recently_ended'
      ELSE 'stale'
    END
  `;
}

function statusSortExpr(column = 'status_bucket') {
  return `
    CASE ${column}
      WHEN 'in_flight' THEN 1
      WHEN 'recently_ended' THEN 2
      ELSE 3
    END
  `;
}

function campaignBaseCtes(req, lookbackDays = 35) {
  const vf = verticalFilter(req);
  const pf = platformFilter(req);
  const cf = campaignKeyFilter(req);
  const platformExpr = platformNormalizationExpr();

  return `
    WITH normalized_data AS (
      SELECT
        date,
        ${platformExpr} AS platform,
        channel,
        search,
        campaign_key,
        campaign_name,
        account_id,
        account_name,
        cost,
        clicks,
        total_actual_revenue AS revenue
      FROM bankrate_prod.br_rpt.paid_media_ff_campaign_daily
      WHERE date >= date_sub(current_date(), ${lookbackDays})
        AND date < current_date()
        ${vf}
        AND campaign_key IS NOT NULL
    ),
    filtered_data AS (
      SELECT *
      FROM normalized_data
      WHERE 1 = 1
        ${pf}
        ${cf}
    )
  `;
}

// ---------------------------------------------------------------------------
// API Routes
// ---------------------------------------------------------------------------

// /api/platform-rollups -- platform-level 7d/14d/28d rollups
app.get('/api/platform-rollups', async (req, res) => {
  try {
    const vf = verticalFilter(req);
    const platformExpr = platformNormalizationExpr();
    const sql = `
      WITH normalized_data AS (
        SELECT
          date,
          ${platformExpr} AS platform,
          cost,
          clicks,
          total_actual_revenue AS revenue
        FROM bankrate_prod.br_rpt.paid_media_ff_campaign_daily
        WHERE date >= date_sub(current_date(), 28)
          AND date < current_date()
          ${vf}
      ),
      daily_data AS (
        SELECT
          date,
          platform,
          SUM(cost) AS cost,
          SUM(clicks) AS clicks,
          SUM(revenue) AS revenue
        FROM normalized_data
        GROUP BY date, platform
      ),
      platform_7d AS (
        SELECT
          platform, '7d' AS window,
          SUM(cost) AS cost, SUM(clicks) AS clicks, SUM(revenue) AS revenue,
          SUM(revenue) / NULLIF(SUM(cost), 0) AS roas,
          SUM(cost) / NULLIF(SUM(clicks), 0) AS cpc,
          SUM(revenue) / NULLIF(SUM(clicks), 0) AS rpc,
          7 - COUNT(DISTINCT date) AS missing_days,
          SUM(CASE WHEN cost = 0 AND revenue > 0 THEN 1 ELSE 0 END) AS cost_zero_revenue_positive_days,
          SUM(CASE WHEN clicks = 0 AND cost > 0 THEN 1 ELSE 0 END) AS clicks_zero_cost_positive_days
        FROM daily_data
        WHERE date >= date_sub(current_date(), 7)
        GROUP BY platform
      ),
      platform_14d AS (
        SELECT
          platform, '14d' AS window,
          SUM(cost) AS cost, SUM(clicks) AS clicks, SUM(revenue) AS revenue,
          SUM(revenue) / NULLIF(SUM(cost), 0) AS roas,
          SUM(cost) / NULLIF(SUM(clicks), 0) AS cpc,
          SUM(revenue) / NULLIF(SUM(clicks), 0) AS rpc,
          14 - COUNT(DISTINCT date) AS missing_days,
          SUM(CASE WHEN cost = 0 AND revenue > 0 THEN 1 ELSE 0 END) AS cost_zero_revenue_positive_days,
          SUM(CASE WHEN clicks = 0 AND cost > 0 THEN 1 ELSE 0 END) AS clicks_zero_cost_positive_days
        FROM daily_data
        WHERE date >= date_sub(current_date(), 14)
        GROUP BY platform
      ),
      platform_28d AS (
        SELECT
          platform, '28d' AS window,
          SUM(cost) AS cost, SUM(clicks) AS clicks, SUM(revenue) AS revenue,
          SUM(revenue) / NULLIF(SUM(cost), 0) AS roas,
          SUM(cost) / NULLIF(SUM(clicks), 0) AS cpc,
          SUM(revenue) / NULLIF(SUM(clicks), 0) AS rpc,
          28 - COUNT(DISTINCT date) AS missing_days,
          SUM(CASE WHEN cost = 0 AND revenue > 0 THEN 1 ELSE 0 END) AS cost_zero_revenue_positive_days,
          SUM(CASE WHEN clicks = 0 AND cost > 0 THEN 1 ELSE 0 END) AS clicks_zero_cost_positive_days
        FROM daily_data
        GROUP BY platform
      )
      SELECT * FROM platform_7d
      UNION ALL
      SELECT * FROM platform_14d
      UNION ALL
      SELECT * FROM platform_28d
      ORDER BY platform, window
    `;
    const rows = await runQuery(sql);
    res.json(rows);
  } catch (err) {
    console.error('Error in /api/platform-rollups:', err);
    res.status(500).json({ error: err.message });
  }
});

// /api/daily-roas -- daily ROAS by platform for the trend chart
app.get('/api/daily-roas', async (req, res) => {
  try {
    const vf = verticalFilter(req);
    const platformExpr = platformNormalizationExpr();
    const sql = `
      WITH normalized_data AS (
        SELECT
          date,
          ${platformExpr} AS platform,
          cost,
          total_actual_revenue AS revenue
        FROM bankrate_prod.br_rpt.paid_media_ff_campaign_daily
        WHERE date >= date_sub(current_date(), 14)
          AND date < current_date()
          ${vf}
      )
      SELECT
        date,
        platform,
        SUM(revenue) / NULLIF(SUM(cost), 0) AS roas
      FROM normalized_data
      GROUP BY date, platform
      ORDER BY date, platform
    `;
    const rows = await runQuery(sql);
    res.json(rows);
  } catch (err) {
    console.error('Error in /api/daily-roas:', err);
    res.status(500).json({ error: err.message });
  }
});

// /api/efficiency -- CPC and RPC by platform for scatter plot
app.get('/api/efficiency', async (req, res) => {
  try {
    const vf = verticalFilter(req);
    const platformExpr = platformNormalizationExpr();
    const sql = `
      WITH normalized_data AS (
        SELECT
          ${platformExpr} AS platform,
          cost,
          clicks,
          total_actual_revenue AS revenue
        FROM bankrate_prod.br_rpt.paid_media_ff_campaign_daily
        WHERE date >= date_sub(current_date(), 7)
          AND date < current_date()
          ${vf}
      )
      SELECT
        platform,
        SUM(cost) / NULLIF(SUM(clicks), 0) AS cpc,
        SUM(revenue) / NULLIF(SUM(clicks), 0) AS rpc,
        SUM(clicks) AS volume
      FROM normalized_data
      GROUP BY platform
      ORDER BY platform
    `;
    const rows = await runQuery(sql);
    res.json(rows);
  } catch (err) {
    console.error('Error in /api/efficiency:', err);
    res.status(500).json({ error: err.message });
  }
});

// /api/alerts -- data quality flags
app.get('/api/alerts', async (req, res) => {
  try {
    const vf = verticalFilter(req);
    const platformExpr = platformNormalizationExpr();
    const sql = `
      WITH normalized_data AS (
        SELECT
          date,
          ${platformExpr} AS platform,
          cost,
          clicks,
          total_actual_revenue AS revenue
        FROM bankrate_prod.br_rpt.paid_media_ff_campaign_daily
        WHERE date >= date_sub(current_date(), 7)
          AND date < current_date()
          ${vf}
      ),
      daily_data AS (
        SELECT
          date,
          platform,
          SUM(cost) AS cost,
          SUM(clicks) AS clicks,
          SUM(revenue) AS revenue
        FROM normalized_data
        GROUP BY date, platform
      ),
      platform_flags AS (
        SELECT
          platform,
          SUM(clicks) AS clicks_7d,
          7 - COUNT(DISTINCT date) AS missing_days,
          SUM(CASE WHEN cost = 0 AND revenue > 0 THEN 1 ELSE 0 END) AS cost_zero_revenue_positive_days,
          SUM(CASE WHEN clicks = 0 AND cost > 0 THEN 1 ELSE 0 END) AS clicks_zero_cost_positive_days
        FROM daily_data
        GROUP BY platform
      )
      SELECT
        platform,
        clicks_7d,
        missing_days,
        cost_zero_revenue_positive_days,
        clicks_zero_cost_positive_days,
        CASE WHEN clicks_7d < 3500 THEN true ELSE false END AS low_volume,
        CASE WHEN missing_days > 0 THEN true ELSE false END AS has_missing_days
      FROM platform_flags
      ORDER BY platform
    `;
    const rows = await runQuery(sql);

    // Transform rows into alert objects for the frontend
    const alerts = [];
    let allComplete = true;

    for (const row of rows) {
      if (row.missing_days > 0) {
        allComplete = false;
        alerts.push({
          type: 'warning',
          message: `${row.platform}: Missing ${row.missing_days} day(s) of data in last 7d`,
        });
      }
      if (row.cost_zero_revenue_positive_days > 0) {
        alerts.push({
          type: 'warning',
          message: `${row.platform}: ${row.cost_zero_revenue_positive_days} day(s) with revenue but zero cost (FF revenue methodology)`,
        });
      }
      if (row.low_volume) {
        alerts.push({
          type: 'info',
          message: `${row.platform} volume below 500 clicks/day threshold (${Number(row.clicks_7d).toLocaleString()} clicks/7d)`,
        });
      }
    }

    if (allComplete) {
      alerts.push({
        type: 'success',
        message: `All ${rows.length} platforms have full 7d data coverage`,
      });
    }

    res.json(alerts);
  } catch (err) {
    console.error('Error in /api/alerts:', err);
    res.status(500).json({ error: err.message });
  }
});

// /api/campaign-options -- campaign dropdown options with status metadata
app.get('/api/campaign-options', async (req, res) => {
  try {
    const limit = parseLimit(req.query.limit, 250, 1000);
    const sf = statusFilter(req);
    const sql = `
      ${campaignBaseCtes(req, 35)},
      campaign_options AS (
        SELECT
          platform,
          channel,
          search,
          campaign_key,
          campaign_name,
          CASE WHEN COUNT(DISTINCT account_id) = 1 THEN MAX(account_id) END AS account_id,
          CASE WHEN COUNT(DISTINCT account_name) = 1 THEN MAX(account_name) ELSE 'MULTIPLE_ACCOUNTS' END AS account_name,
          MAX(date) AS last_seen_date,
          SUM(CASE WHEN date >= date_sub(current_date(), 7) THEN cost ELSE 0 END) AS cost_7d,
          SUM(CASE WHEN date >= date_sub(current_date(), 28) THEN cost ELSE 0 END) AS cost_28d,
          SUM(CASE WHEN date >= date_sub(current_date(), 28) THEN clicks ELSE 0 END) AS clicks_28d,
          SUM(CASE WHEN date >= date_sub(current_date(), 28) THEN revenue ELSE 0 END) AS revenue_28d
        FROM filtered_data
        GROUP BY platform, channel, search, campaign_key, campaign_name
      ),
      campaign_enriched AS (
        SELECT
          platform,
          channel,
          search,
          campaign_key,
          campaign_name,
          account_id,
          account_name,
          CAST(last_seen_date AS STRING) AS last_seen_date,
          ${statusBucketExpr()} AS status_bucket,
          cost_7d,
          cost_28d,
          clicks_28d,
          revenue_28d,
          revenue_28d / NULLIF(cost_28d, 0) AS roas_28d
        FROM campaign_options
        WHERE cost_28d > 0
      )
      SELECT *
      FROM campaign_enriched
      WHERE 1 = 1
        ${sf}
      ORDER BY
        ${statusSortExpr()},
        cost_28d DESC,
        campaign_name
      LIMIT ${limit}
    `;
    const rows = await runQuery(sql);
    res.json(rows);
  } catch (err) {
    console.error('Error in /api/campaign-options:', err);
    res.status(500).json({ error: err.message });
  }
});

// /api/campaign-rollups -- campaign-level 7d/14d/28d rollups
app.get('/api/campaign-rollups', async (req, res) => {
  try {
    const sf = statusFilter(req);
    const sql = `
      ${campaignBaseCtes(req, 35)},
      campaign_metadata AS (
        SELECT
          platform,
          channel,
          search,
          campaign_key,
          campaign_name,
          CASE WHEN COUNT(DISTINCT account_id) = 1 THEN MAX(account_id) END AS account_id,
          CASE WHEN COUNT(DISTINCT account_name) = 1 THEN MAX(account_name) ELSE 'MULTIPLE_ACCOUNTS' END AS account_name,
          MAX(date) AS last_seen_date
        FROM filtered_data
        GROUP BY platform, channel, search, campaign_key, campaign_name
      ),
      campaign_daily AS (
        SELECT
          date,
          platform,
          channel,
          search,
          campaign_key,
          campaign_name,
          SUM(cost) AS cost,
          SUM(clicks) AS clicks,
          SUM(revenue) AS revenue
        FROM filtered_data
        WHERE date >= date_sub(current_date(), 28)
        GROUP BY date, platform, channel, search, campaign_key, campaign_name
      ),
      campaign_7d AS (
        SELECT
          platform,
          channel,
          search,
          campaign_key,
          campaign_name,
          '7d' AS window,
          SUM(cost) AS cost,
          SUM(clicks) AS clicks,
          SUM(revenue) AS revenue,
          SUM(revenue) / NULLIF(SUM(cost), 0) AS roas,
          SUM(cost) / NULLIF(SUM(clicks), 0) AS cpc,
          SUM(revenue) / NULLIF(SUM(clicks), 0) AS rpc,
          7 - COUNT(DISTINCT date) AS missing_days,
          SUM(CASE WHEN cost = 0 AND revenue > 0 THEN 1 ELSE 0 END) AS cost_zero_revenue_positive_days,
          SUM(CASE WHEN clicks = 0 AND cost > 0 THEN 1 ELSE 0 END) AS clicks_zero_cost_positive_days
        FROM campaign_daily
        WHERE date >= date_sub(current_date(), 7)
        GROUP BY platform, channel, search, campaign_key, campaign_name
      ),
      campaign_14d AS (
        SELECT
          platform,
          channel,
          search,
          campaign_key,
          campaign_name,
          '14d' AS window,
          SUM(cost) AS cost,
          SUM(clicks) AS clicks,
          SUM(revenue) AS revenue,
          SUM(revenue) / NULLIF(SUM(cost), 0) AS roas,
          SUM(cost) / NULLIF(SUM(clicks), 0) AS cpc,
          SUM(revenue) / NULLIF(SUM(clicks), 0) AS rpc,
          14 - COUNT(DISTINCT date) AS missing_days,
          SUM(CASE WHEN cost = 0 AND revenue > 0 THEN 1 ELSE 0 END) AS cost_zero_revenue_positive_days,
          SUM(CASE WHEN clicks = 0 AND cost > 0 THEN 1 ELSE 0 END) AS clicks_zero_cost_positive_days
        FROM campaign_daily
        WHERE date >= date_sub(current_date(), 14)
        GROUP BY platform, channel, search, campaign_key, campaign_name
      ),
      campaign_28d AS (
        SELECT
          platform,
          channel,
          search,
          campaign_key,
          campaign_name,
          '28d' AS window,
          SUM(cost) AS cost,
          SUM(clicks) AS clicks,
          SUM(revenue) AS revenue,
          SUM(revenue) / NULLIF(SUM(cost), 0) AS roas,
          SUM(cost) / NULLIF(SUM(clicks), 0) AS cpc,
          SUM(revenue) / NULLIF(SUM(clicks), 0) AS rpc,
          28 - COUNT(DISTINCT date) AS missing_days,
          SUM(CASE WHEN cost = 0 AND revenue > 0 THEN 1 ELSE 0 END) AS cost_zero_revenue_positive_days,
          SUM(CASE WHEN clicks = 0 AND cost > 0 THEN 1 ELSE 0 END) AS clicks_zero_cost_positive_days
        FROM campaign_daily
        GROUP BY platform, channel, search, campaign_key, campaign_name
      ),
      campaign_windows AS (
        SELECT * FROM campaign_7d
        UNION ALL
        SELECT * FROM campaign_14d
        UNION ALL
        SELECT * FROM campaign_28d
      ),
      campaign_enriched AS (
        SELECT
          w.platform,
          w.channel,
          w.search,
          w.campaign_key,
          w.campaign_name,
          m.account_id,
          m.account_name,
          CAST(m.last_seen_date AS STRING) AS last_seen_date,
          ${statusBucketExpr('m.last_seen_date')} AS status_bucket,
          w.window,
          w.cost,
          w.clicks,
          w.revenue,
          w.roas,
          w.cpc,
          w.rpc,
          w.missing_days,
          w.cost_zero_revenue_positive_days,
          w.clicks_zero_cost_positive_days
        FROM campaign_windows w
        JOIN campaign_metadata m
          ON w.platform = m.platform
         AND w.channel = m.channel
         AND w.search = m.search
         AND w.campaign_key = m.campaign_key
         AND w.campaign_name = m.campaign_name
      )
      SELECT *
      FROM campaign_enriched
      WHERE 1 = 1
        ${sf}
      ORDER BY platform, campaign_name, window
    `;
    const rows = await runQuery(sql);
    res.json(rows);
  } catch (err) {
    console.error('Error in /api/campaign-rollups:', err);
    res.status(500).json({ error: err.message });
  }
});

// /api/campaign-status -- in-flight and recently ended campaign buckets
app.get('/api/campaign-status', async (req, res) => {
  try {
    const limitPerBucket = parseLimit(req.query.limit, 10, 100);
    const sf = statusFilter(req);
    const sql = `
      ${campaignBaseCtes(req, 35)},
      campaign_status_base AS (
        SELECT
          platform,
          channel,
          search,
          campaign_key,
          campaign_name,
          CASE WHEN COUNT(DISTINCT account_id) = 1 THEN MAX(account_id) END AS account_id,
          CASE WHEN COUNT(DISTINCT account_name) = 1 THEN MAX(account_name) ELSE 'MULTIPLE_ACCOUNTS' END AS account_name,
          MAX(date) AS last_seen_date,
          SUM(CASE WHEN date >= date_sub(current_date(), 7) THEN cost ELSE 0 END) AS cost_7d,
          SUM(CASE WHEN date >= date_sub(current_date(), 7) THEN clicks ELSE 0 END) AS clicks_7d,
          SUM(CASE WHEN date >= date_sub(current_date(), 7) THEN revenue ELSE 0 END) AS revenue_7d
        FROM filtered_data
        GROUP BY platform, channel, search, campaign_key, campaign_name
      ),
      campaign_status_enriched AS (
        SELECT
          platform,
          channel,
          search,
          campaign_key,
          campaign_name,
          account_id,
          account_name,
          CAST(last_seen_date AS STRING) AS last_seen_date,
          ${statusBucketExpr()} AS status_bucket,
          cost_7d,
          clicks_7d,
          revenue_7d,
          revenue_7d / NULLIF(cost_7d, 0) AS roas_7d
        FROM campaign_status_base
      )
      SELECT *
      FROM campaign_status_enriched
      WHERE 1 = 1
        ${sf}
      ORDER BY
        ${statusSortExpr()},
        cost_7d DESC,
        last_seen_date DESC,
        campaign_name
    `;
    const rows = await runQuery(sql);

    const buckets = {
      in_flight: [],
      recently_ended: [],
      stale: [],
    };

    const summaryMap = {
      in_flight: { status_bucket: 'in_flight', campaigns: 0, cost_7d: 0, clicks_7d: 0, revenue_7d: 0 },
      recently_ended: { status_bucket: 'recently_ended', campaigns: 0, cost_7d: 0, clicks_7d: 0, revenue_7d: 0 },
      stale: { status_bucket: 'stale', campaigns: 0, cost_7d: 0, clicks_7d: 0, revenue_7d: 0 },
    };

    for (const row of rows) {
      const bucket = row.status_bucket;
      if (!summaryMap[bucket]) continue;

      const item = {
        platform: row.platform,
        channel: row.channel,
        search: row.search,
        campaign_key: row.campaign_key,
        campaign_name: row.campaign_name,
        account_id: row.account_id,
        account_name: row.account_name,
        last_seen_date: row.last_seen_date,
        status_bucket: row.status_bucket,
        cost_7d: Number(row.cost_7d) || 0,
        clicks_7d: Number(row.clicks_7d) || 0,
        revenue_7d: Number(row.revenue_7d) || 0,
        roas_7d: Number(row.roas_7d) || 0,
      };

      summaryMap[bucket].campaigns += 1;
      summaryMap[bucket].cost_7d += item.cost_7d;
      summaryMap[bucket].clicks_7d += item.clicks_7d;
      summaryMap[bucket].revenue_7d += item.revenue_7d;

      if (buckets[bucket].length < limitPerBucket) {
        buckets[bucket].push(item);
      }
    }

    const summary = Object.values(summaryMap).map((entry) => ({
      ...entry,
      cost_7d: Math.round(entry.cost_7d * 100) / 100,
      revenue_7d: Math.round(entry.revenue_7d * 100) / 100,
      roas_7d: entry.cost_7d > 0 ? Math.round((entry.revenue_7d / entry.cost_7d) * 10000) / 10000 : 0,
    }));

    res.json({
      summary,
      ...buckets,
    });
  } catch (err) {
    console.error('Error in /api/campaign-status:', err);
    res.status(500).json({ error: err.message });
  }
});

// /api/sub-verticals -- get available sub-verticals for a vertical
app.get('/api/sub-verticals', async (req, res) => {
  try {
    const vertical = (req.query.vertical || 'deposits').toLowerCase();
    
    // Validate vertical
    const validVerticals = ['deposits', 'mortgages', 'home equity', 'all'];
    if (!validVerticals.includes(vertical)) {
      return res.status(400).json({ error: `Invalid vertical: ${vertical}` });
    }
    
    // Only deposits has sub-verticals currently
    if (vertical === 'deposits') {
      const subVerticals = [
        { value: 'savings', label: 'Savings' },
        { value: 'cds', label: 'CDs' }
      ];
      res.json(subVerticals);
    } else {
      // Other verticals don't have sub-verticals yet
      res.json([]);
    }
  } catch (err) {
    console.error('Error in /api/sub-verticals:', err);
    res.status(500).json({ error: err.message });
  }
});

// SPA fallback -- serve index.html for any non-API route
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Budget Allocator server listening on port ${PORT}`);
});
