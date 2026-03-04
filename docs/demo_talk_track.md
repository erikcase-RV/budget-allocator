# Budget Allocator Dashboard -- Demo Talk Track

Audience: Mixed engineers and analysts

---

## 1. Context: How This Project Started

- I was asked to help optimize paid media budget allocation across platforms (Google, Bing, Meta, Taboola, Whale).
- First step was determining whether this was a data science problem -- i.e., does it need ML, optimization models, response curve fitting?
- After scoping the data and requirements, I realized **this is fundamentally an analytics dashboarding problem**: aggregate trailing metrics, rank platforms by efficiency, and present the results in an actionable format.
- Part of being a data scientist is knowing when something does *not* need a model, and being able to pinch-hit on the analytics/engineering side to deliver it anyway.

---

## 2. How It Was Built

- **Requirements gathering**: Worked with stakeholders to define the KPIs, ranking logic, and allocation methodology. Documented everything in a dashboard specification and methodology doc.
- **SQL**: Wrote all queries against Databricks tables (`bankrate_prod.br_rpt.paid_media_ff_campaign_daily` and supporting tables). The SQL is version-controlled in `/sql/`.
- **Dashboard stack**: Built entirely with **Windsurf (AI-assisted coding)**:
  - **React 18** (via Vite 5) for the frontend
  - **TailwindCSS 3** for styling
  - **Recharts 2** for charts (line, pie, scatter, bar)
  - **Lucide React** for icons
  - **Express.js** backend serving the built frontend and proxying live SQL queries through the **@databricks/sql** Node.js connector
- **Why not Looker or Databricks Dashboards?**
  - Looker required LookML modeling overhead and did not support the interactive budget simulator.
  - Databricks SQL Dashboards lacked the layout flexibility and interactivity needed (e.g., slider-driven projections, scatter plot with bubble sizing).
  - Windsurf enabled rapid prototyping of a fully custom React dashboard without needing a dedicated frontend engineer.
- **Hosting**: Deployed on **Databricks Apps** (serverless Node.js hosting).
  - Auth is handled automatically via workspace SSO -- no separate login needed.
  - The app queries a Databricks SQL Warehouse at runtime, so data is always T-1 fresh.
  - `app.yaml` config is minimal: just specifies `node server.js` and the warehouse ID.
- **Estimated cost of the dashboard**:
  - Databricks Apps is serverless; compute costs are included in the DBU price.
  - The app defaults to "Medium" compute (2 vCPU, 6 GB RAM) at **0.5 DBU/hour**. It runs continuously while in a Running state.
  - The list price is $75/DBU (AWS Premium pay-as-you-go), but enterprise contracts with committed-use discounts typically bring DBU costs down to $0.20-$0.40/DBU. At contract rates, the app likely costs **in the low hundreds of dollars per month** to run 24/7.
  - SQL warehouse query costs are separate and depend on warehouse size and query frequency.
  - Confirm actual costs with your Databricks admin or account billing console.

---

## 3. Dashboard Components -- What Each Card Does

### 3a. KPI Summary Cards (top row, 4 cards)

- **Total Cost (7d)**: `SUM(cost)` across all platforms for the trailing 7 days. Tells you total spend at a glance.
- **Total Revenue (7d)**: `SUM(total_actual_revenue)` -- this is FF (First-to-File) attributed revenue, not post-lead funded revenue. FF is the only cross-platform revenue signal that works for Meta and Taboola (their post-lead match rates are below 1%).
- **Blended ROAS**: `Total Revenue / Total Cost`. Interpretation: >2.0x is strong, 1.0-2.0x is profitable, <1.0x is below break-even.
- **Total Clicks (7d)**: `SUM(clicks)` across all platforms. Volume indicator.

### 3b. Recommended Allocation (pie chart)

- Shows current budget distribution across platforms as a percentage of total cost.
- Formula: `allocation[platform] = cost_7d[platform] / SUM(cost_7d) * 100`
- **Limitation**: This is a *naive proportional allocation* -- it reflects where money is currently going, not where it *should* go. A true optimizer would weight by ROAS with diminishing returns curves.

### 3c. 7-Day Rolling ROAS Trend (line chart)

- One line per platform showing `daily_roas = revenue[date] / cost[date]`.
- Purpose: Spot trends and anomalies. An upward trend suggests improving efficiency; high variance suggests instability.
- Useful for analysts to quickly see if a platform's efficiency is degrading before it shows up in the 7d aggregate.

### 3d. Platform Performance Table

- Sortable table with columns: Platform, Clicks, Cost, Revenue, ROAS, CPC, RPC, Allocation.
- **CPC** = `cost / clicks`
- **RPC** = `revenue / clicks` (for Meta/Taboola using FF revenue; for SEM using rt_clicks_paid where available)
- **ROAS** = `revenue / cost`
- This is the main reference table for analysts to compare platforms side-by-side.

### 3e. Efficiency Matrix (scatter plot)

- **X-axis**: CPC (cost per click) -- lower is cheaper traffic.
- **Y-axis**: RPC (revenue per click) -- higher is better monetization.
- **Bubble size**: Click volume (7d) -- larger means more scale.
- Quadrant logic:
  - Top-right = "Best Performers" (high RPC, acceptable CPC)
  - Top-left = "Premium Niche" (high RPC, low CPC but possibly low volume)
  - Bottom-left = "Volume Play" (cheap clicks, low revenue per click)
  - Bottom-right = "Investigate" (expensive clicks, low revenue)

### 3f. Budget Simulator (interactive slider)

- Slider lets you set a hypothetical weekly budget ($10K-$500K).
- Projects revenue per platform: `projected_revenue[platform] = budget * allocation_weight * roas_7d`
- Sums to a total projected revenue and blended projected ROAS.
- **Key limitation: assumes linear scaling.** In reality, ROAS declines at higher spend due to diminishing returns (you exhaust the most efficient audience segments first). The simulator is directionally useful but will overestimate revenue at high budget levels.

### 3g. Data Quality Alerts

- Flags key data issues:
  - **Meta/Taboola FF revenue warning**: Post-lead match rate <1%, so FF is the only usable revenue signal.
  - **Low volume warning**: Platform with <500 clicks/day or campaign with <100 clicks/7d is flagged as LOW_VOLUME.
  - **Coverage check**: Confirms all platforms have a full 7 days of data.
- Important for building trust that the dashboard is transparent about its data limitations.

---

## 4. Segue: Why We Need a Budget Changelog (Next Steps)

- The recommender currently **cannot model nonlinear response curves**. It uses trailing ROAS as a static multiplier, which implicitly assumes that doubling spend doubles revenue. That is almost never true.
- To do true budget optimization, we need to model how ROAS *changes* as a function of spend level -- i.e., diminishing returns curves.
- To fit those curves, we need **historical variation in budget levels** -- a budget changelog that records daily budget caps per platform/campaign over time.
- With a budget changelog, we can:
  1. Observe how ROAS varies at different spend levels for each platform.
  2. Fit response curves (e.g., log, power, or saturation functions) to that data.
  3. Use constrained optimization to allocate a fixed total budget across platforms to maximize total revenue, subject to min/max spend constraints.
- **This is where it becomes a true data science problem** -- and the dashboard becomes the delivery vehicle for the optimization output rather than just a reporting tool.
