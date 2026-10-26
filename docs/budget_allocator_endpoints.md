# Budget Allocator Live Endpoints & Expected Volume (Erik Case)

## Overview
The Budget Allocator project consists of a Databricks App with a Node.js/Express backend serving a React dashboard. All endpoints are REST APIs that query Databricks SQL Warehouse `a2a6f171e901de84` and return JSON responses.

## Live API Endpoints

### 1. `/api/platform-rollups`
**Method**: GET  
**Purpose**: Platform-level 7d/14d/28d rollups with key metrics  
**Expected Volume**: ~50 requests/day (dashboard refreshes, user interactions)  
**Query Parameters**: 
- `vertical` (optional): deposits, mortgages, home equity, all (default: deposits)
- `sub_vertical` (optional): savings, cds (for deposits only)  
**Response**: Array of platform metrics across 3 time windows
```json
[
  {
    "platform": "Google",
    "window": "7d",
    "cost": 12345.67,
    "clicks": 5432,
    "revenue": 23456.78,
    "roas": 1.9,
    "cpc": 2.27,
    "rpc": 4.32,
    "missing_days": 0,
    "cost_zero_revenue_positive_days": 0,
    "clicks_zero_cost_positive_days": 0
  }
]
```

### 2. `/api/daily-roas`
**Method**: GET  
**Purpose**: Daily ROAS by platform for trend visualization  
**Expected Volume**: ~30 requests/day (chart updates)  
**Query Parameters**: Same as `/api/platform-rollups`  
**Response**: Daily ROAS values for last 14 days
```json
[
  {
    "date": "2026-03-04",
    "platform": "Google", 
    "roas": 1.85
  }
]
```

### 3. `/api/efficiency`
**Method**: GET  
**Purpose**: CPC and RPC metrics for scatter plot analysis  
**Expected Volume**: ~25 requests/day (efficiency analysis)  
**Query Parameters**: Same as `/api/platform-rollups`  
**Response**: Platform efficiency metrics
```json
[
  {
    "platform": "Google",
    "cpc": 2.27,
    "rpc": 4.32,
    "volume": 5432
  }
]
```

### 4. `/api/alerts`
**Method**: GET  
**Purpose**: Data quality flags and system health alerts  
**Expected Volume**: ~100 requests/day (frequent health checks)  
**Query Parameters**: Same as `/api/platform-rollups`  
**Response**: Alert objects for data quality issues
```json
[
  {
    "type": "warning",
    "message": "Google: Missing 2 day(s) of data in last 7d"
  },
  {
    "type": "info", 
    "message": "Bing volume below 500 clicks/day threshold (2,100 clicks/7d)"
  }
]
```

### 5. `/api/sub-verticals`
**Method**: GET  
**Purpose**: Get available sub-verticals for a given vertical  
**Expected Volume**: ~10 requests/day (dropdown population)  
**Query Parameters**: 
- `vertical` (optional): deposits, mortgages, home equity, all (default: deposits)  
**Response**: Available sub-vertical options
```json
[
  {
    "value": "savings",
    "label": "Savings"
  },
  {
    "value": "cds", 
    "label": "CDs"
  }
]
```

## Databricks App Management Endpoints

### 6. `/api/2.0/apps/budget-allocator/start`
**Method**: POST  
**Purpose**: Start the budget-allocator Databricks App  
**Expected Volume**: 1 request/day (automated via scheduled job)  
**Authentication**: Bearer token (Databricks API)  
**Called by**: `budget-allocator-start` job at 8:00 AM CT weekdays

### 7. `/api/2.0/apps/budget-allocator/stop`  
**Method**: POST  
**Purpose**: Stop the budget-allocator Databricks App  
**Expected Volume**: 1 request/day (automated via scheduled job)  
**Authentication**: Bearer token (Databricks API)  
**Called by**: `budget-allocator-stop` job at 7:00 PM CT weekdays

## Static Asset Serving

### 8. `/*` (SPA Fallback)
**Method**: GET  
**Purpose**: Serve React application and static assets  
**Expected Volume**: ~200 requests/day (page loads, asset requests)  
**Response**: Static files from `dist/` directory or `index.html` fallback

## Infrastructure Details

### Server Configuration
- **Port**: 8000 (Databricks Apps requirement)
- **Warehouse ID**: `a2a6f171e901de84`
- **Data Source**: `bankrate_prod.br_rpt.paid_media_ff_campaign_daily`
- **Authentication**: OAuth via environment variables

### Scheduled Jobs
1. **budget-allocator-start**: Weekdays 8:00 AM CT
2. **budget-allocator-stop**: Weekdays 7:00 PM CT

### Total Expected Daily Volume
- **API Endpoints**: ~215 requests/day
- **Static Assets**: ~200 requests/day  
- **App Management**: 2 requests/day
- **Grand Total**: ~417 requests/day

### Performance Considerations
- All queries use `maxRows: 10000` limit
- SQL queries optimized with CTEs and proper indexing
- Connection pooling via DBSQLClient
- Error handling and logging for all endpoints
- Input validation to prevent SQL injection

### Monitoring
- Error logging to console
- 500 status responses for failures
- Data quality alerts via `/api/alerts` endpoint
- Missing data detection in platform rollups
