# Prompt: Deploy Budget Allocator Dashboard to Databricks Apps

Use this prompt to start a new Cascade conversation for deploying the budget allocator dashboard to Databricks Apps.

---

## Prompt

I have an existing React dashboard (Vite + Tailwind + Recharts) that I need to deploy to Databricks Apps as a Node.js application. The dashboard currently uses hardcoded data arrays and I want to replace them with live queries against Databricks SQL. I want to do as much from the terminal as possible.

### What exists today

- **Repo:** https://github.com/erikcase-RV/budget-allocator
- **Dashboard source:** `dashboard-mockup/` directory
- **Stack:** React 18, Vite 5, TailwindCSS 3, Recharts 2, Lucide React
- **Current state:** Static mockup with hardcoded platform data in `src/App.jsx`

### What I need

Restructure the project for Databricks Apps deployment:

1. **Add an Express server** (`server.js`) that:
   - Serves the built Vite static assets from `dist/`
   - Listens on `process.env.PORT || 8000` (Databricks Apps requirement)
   - Exposes API endpoints that query Databricks SQL and return JSON

2. **Add `app.yaml`** at the project root:
   ```yaml
   command: ['node', 'server.js']
   env:
     - name: 'DATABRICKS_WAREHOUSE_ID'
       value: '<WAREHOUSE_ID>'
   ```

3. **Add API routes** on the Express server that query Databricks SQL for:
   - `/api/platform-rollups` -- platform-level 7d/14d/28d rollups (KPI cards, table, allocation pie)
   - `/api/daily-roas` -- daily ROAS by platform for the trend chart
   - `/api/efficiency` -- CPC and RPC by platform for the scatter plot
   - `/api/alerts` -- data quality flags (missing days, low volume, revenue methodology)

4. **Update the React frontend** (`src/App.jsx`) to:
   - Replace hardcoded `platformData`, `trendData`, `allocationData`, `efficiencyData`, `alerts` arrays with `fetch()` calls to the Express API endpoints
   - Add loading states while data is being fetched
   - Handle errors gracefully

5. **Update `package.json`** to include:
   - `express` as a dependency
   - `@databricks/sql` (Databricks SQL Node.js connector) as a dependency
   - A `"start": "node server.js"` script (Databricks Apps runs `npm run start` by default)
   - Keep `"build": "vite build"` for building the React frontend

### SQL queries to use

The source table is `bankrate_prod.br_rpt.paid_media_ff_campaign_daily` with `vertical = 'deposits'`. The existing SQL is in these files (use them as reference for the API queries):

- `sql/10_ff_ranker_inputs_p28d.sql` -- platform and campaign rollups (7d/14d/28d) with cost, clicks, revenue, ROAS, CPC, and data quality flags (missing_days, cost_zero_revenue_positive_days, clicks_zero_cost_positive_days)
- `sql/11_ff_ranker_suggestion.sql` -- ranking by 7d ROAS (primary) and 14d ROAS (tiebreaker), volume guardrails (500 clicks/day platform, 100 clicks/7d campaign)

### Deployment steps (CLI-first)

Prerequisites:
- Databricks CLI installed and authenticated (`databricks auth login`)
- Access to a Databricks SQL warehouse

Then:
```bash
# 1. Build the Vite frontend
npm run build

# 2. Create the app in Databricks (one-time, or do in UI: Sidebar > New > App > Custom App)
databricks apps create budget-allocator --description "Paid media budget allocation dashboard"

# 3. Sync code to workspace
databricks workspace import-dir ./  /Workspace/Users/<my-email>/budget-allocator --overwrite

# 4. Deploy
databricks apps deploy budget-allocator --source-code-path /Workspace/Users/<my-email>/budget-allocator

# 5. Check logs
databricks apps logs budget-allocator --follow

# 6. Get the app URL
databricks apps get budget-allocator
```

Note: Step 2 may need to be done in the Databricks UI if the CLI create doesn't work or if we need to configure resources (SQL warehouse access, service principal). The UI path is: Sidebar > New > App > Custom App > name it `budget-allocator` > configure SQL warehouse resource > create.

### Key constraints

- All files must be under 10 MB each
- The app must listen on `process.env.PORT` (Databricks sets this at runtime)
- Auth is handled by Databricks workspace SSO automatically
- The SQL connector authenticates via environment variables that Databricks Apps sets automatically (`DATABRICKS_HOST`, `DATABRICKS_TOKEN`)
- Keep the existing dashboard UI/UX identical; only the data source changes

### Reference docs

- Databricks Apps overview: https://docs.databricks.com/aws/en/dev-tools/databricks-apps/
- Node.js tutorial: https://docs.databricks.com/aws/en/dev-tools/databricks-apps/tutorial-node
- app.yaml config: https://docs.databricks.com/aws/en/dev-tools/databricks-apps/app-runtime
- CLI apps commands: https://docs.databricks.com/aws/en/dev-tools/cli/reference/apps-commands
- Deploy guide: https://docs.databricks.com/aws/en/dev-tools/databricks-apps/deploy
- Databricks SQL Node.js connector: https://docs.databricks.com/aws/en/dev-tools/nodejs-sql-driver.html
