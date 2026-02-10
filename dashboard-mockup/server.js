const express = require('express');
const path = require('path');
const { DBSQLClient } = require('@databricks/sql');

const app = express();
const PORT = process.env.PORT || 8000;

// Serve Vite-built static assets
app.use(express.static(path.join(__dirname, 'dist')));

// ---------------------------------------------------------------------------
// Databricks SQL helper
// ---------------------------------------------------------------------------
function getConnection() {
  const host = process.env.DATABRICKS_HOST;
  const token = process.env.DATABRICKS_TOKEN;
  const warehouseId = process.env.DATABRICKS_WAREHOUSE_ID;

  if (!host || !token || !warehouseId) {
    throw new Error(
      'Missing required env vars: DATABRICKS_HOST, DATABRICKS_TOKEN, DATABRICKS_WAREHOUSE_ID'
    );
  }

  const client = new DBSQLClient();
  return client
    .connect({
      host,
      path: `/sql/1.0/warehouses/${warehouseId}`,
      token,
    })
    .then((connection) => connection);
}

async function runQuery(sql) {
  const connection = await getConnection();
  try {
    const session = await connection.openSession();
    const operation = await session.executeStatement(sql, {
      runAsync: true,
      maxRows: 10000,
    });
    const result = await operation.fetchAll();
    await operation.close();
    await session.close();
    return result;
  } finally {
    await connection.close();
  }
}

// ---------------------------------------------------------------------------
// API Routes
// ---------------------------------------------------------------------------

// /api/platform-rollups -- platform-level 7d/14d/28d rollups
app.get('/api/platform-rollups', async (req, res) => {
  try {
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
          AND vertical = 'deposits'
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
    const sql = `
      SELECT
        date,
        platform,
        SUM(total_actual_revenue) / NULLIF(SUM(cost), 0) AS roas
      FROM bankrate_prod.br_rpt.paid_media_ff_campaign_daily
      WHERE date >= date_sub(current_date(), 14)
        AND date < current_date()
        AND vertical = 'deposits'
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
    const sql = `
      SELECT
        platform,
        SUM(cost) / NULLIF(SUM(clicks), 0) AS cpc,
        SUM(total_actual_revenue) / NULLIF(SUM(clicks), 0) AS rpc,
        SUM(clicks) AS volume
      FROM bankrate_prod.br_rpt.paid_media_ff_campaign_daily
      WHERE date >= date_sub(current_date(), 7)
        AND date < current_date()
        AND vertical = 'deposits'
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
          AND vertical = 'deposits'
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

// SPA fallback -- serve index.html for any non-API route
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Budget Allocator server listening on port ${PORT}`);
});
