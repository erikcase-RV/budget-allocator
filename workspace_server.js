const express = require('express');
const path = require('path');
const { DBSQLClient } = require('@databricks/sql');

const app = express();
const PORT = process.env.DATABRICKS_APP_PORT || process.env.PORT || 8000;

// Serve Vite-built static assets
app.use(express.static(path.join(__dirname, 'dist')));

// ---------------------------------------------------------------------------
// Databricks SQL helper
// ---------------------------------------------------------------------------
async function getClient() {
  const rawHost = process.env.DATABRICKS_HOST;
  const clientId = process.env.DATABRICKS_CLIENT_ID;
  const clientSecret = process.env.DATABRICKS_CLIENT_SECRET;
  const warehouseId = process.env.DATABRICKS_WAREHOUSE_ID;

  if (!rawHost || !clientId || !clientSecret || !warehouseId) {
    throw new Error(
      'Missing required env vars. Got: ' +
      `DATABRICKS_HOST=${rawHost ? 'set' : 'MISSING'}, ` +
      `DATABRICKS_CLIENT_ID=${clientId ? 'set' : 'MISSING'}, ` +
      `DATABRICKS_CLIENT_SECRET=${clientSecret ? 'set' : 'MISSING'}, ` +
      `DATABRICKS_WAREHOUSE_ID=${warehouseId ? 'set' : 'MISSING'}`
    );
  }

  const host = rawHost.replace(/^https?:\/\//, '');

  const client = new DBSQLClient();
  const connectedClient = await client.connect({
    authType: 'databricks-oauth',
    host,
    path: `/sql/1.0/warehouses/${warehouseId}`,
    oauthClientId: clientId,
    oauthClientSecret: clientSecret,
  });
  return connectedClient;
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

// ---------------------------------------------------------------------------
// API Routes
// ---------------------------------------------------------------------------

// /api/health -- diagnostic endpoint to test DB connection and table access
app.get('/api/health', async (req, res) => {
  const diag = {
    env: {
      DATABRICKS_HOST: process.env.DATABRICKS_HOST ? 'set' : 'MISSING',
      DATABRICKS_CLIENT_ID: process.env.DATABRICKS_CLIENT_ID ? 'set' : 'MISSING',
      DATABRICKS_CLIENT_SECRET: process.env.DATABRICKS_CLIENT_SECRET ? 'set' : 'MISSING',
      DATABRICKS_WAREHOUSE_ID: process.env.DATABRICKS_WAREHOUSE_ID ? 'set' : 'MISSING',
    },
    tests: {},
  };
  try {
    const rows = await runQuery("SELECT 1 AS ok, current_date() AS today");
    diag.tests.connection = { status: 'ok', result: rows };
  } catch (err) {
    diag.tests.connection = { status: 'error', message: err.message };
  }
  try {
    const rows = await runQuery("SELECT COUNT(*) AS cnt FROM bankrate_prod.br_rpt.paid_media_ff_campaign_daily WHERE date >= date_sub(current_date(), 7)");
    diag.tests.table_access = { status: 'ok', result: rows };
  } catch (err) {
    diag.tests.table_access = { status: 'error', message: err.message };
  }
  try {
    const rows = await runQuery("SELECT platform, vertical, SUM(cost) AS cost FROM bankrate_prod.br_rpt.paid_media_ff_campaign_daily WHERE date >= date_sub(current_date(), 7) AND vertical = 'deposits' GROUP BY platform, vertical LIMIT 5");
    diag.tests.rollup_query = { status: 'ok', result: rows };
  } catch (err) {
    diag.tests.rollup_query = { status: 'error', message: err.message };
  }
  res.json(diag);
});

// /api/platform-rollups -- platform-level 7d/14d/28d rollups
app.get('/api/platform-rollups', async (req, res) => {
  try {
    const vf = verticalFilter(req);
    const sql = `
      WITH daily_data AS (
        SELECT
          date,
          platform,
          SUM(cost) AS cost,
          SUM(clicks) AS clicks,
          SUM(total_actual_revenue) AS revenue
        FROM bankrate_prod.br_rpt.paid_media_ff_campaign_daily
        WHERE date >= date_sub(current_date(), 28)
          AND date < current_date()
          ${vf}
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
    const sql = `
      SELECT
        date,
        platform,
        SUM(total_actual_revenue) / NULLIF(SUM(cost), 0) AS roas
      FROM bankrate_prod.br_rpt.paid_media_ff_campaign_daily
      WHERE date >= date_sub(current_date(), 14)
        AND date < current_date()
        ${vf}
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
    const sql = `
      SELECT
        platform,
        SUM(cost) / NULLIF(SUM(clicks), 0) AS cpc,
        SUM(total_actual_revenue) / NULLIF(SUM(clicks), 0) AS rpc,
        SUM(clicks) AS volume
      FROM bankrate_prod.br_rpt.paid_media_ff_campaign_daily
      WHERE date >= date_sub(current_date(), 7)
        AND date < current_date()
        ${vf}
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
    const sql = `
      WITH daily_data AS (
        SELECT
          date,
          platform,
          SUM(cost) AS cost,
          SUM(clicks) AS clicks,
          SUM(total_actual_revenue) AS revenue
        FROM bankrate_prod.br_rpt.paid_media_ff_campaign_daily
        WHERE date >= date_sub(current_date(), 7)
          AND date < current_date()
          ${vf}
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
