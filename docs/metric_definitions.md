# Metric Definitions

## Overview
This document defines all business metrics and calculations used in the Budget Allocator EDA analysis.

## Core Performance Metrics

### Spend Metrics
**Source SQL**: `/sql/04_daily_kpis_p30d.sql`

#### Daily Spend
- **Definition**: Total monetary spend on advertising campaigns per day
- **Formula**: `SUM(spend_amount)`
- **Units**: Currency (USD)
- **Granularity**: Daily, per campaign
- **Data Source**: [table_name.spend_amount]
- **Notes**: Includes all campaign types and channels

#### Cumulative Spend
- **Definition**: Running total of spend over time period
- **Formula**: `SUM(spend_amount) OVER (ORDER BY date ROWS UNBOUNDED PRECEDING)`
- **Units**: Currency (USD)
- **Granularity**: Daily
- **Use Case**: Budget tracking and pacing

### Engagement Metrics

#### Impressions
- **Definition**: Number of times ads were displayed
- **Formula**: `COUNT(DISTINCT impression_id)`
- **Units**: Count
- **Granularity**: Daily, per campaign
- **Data Source**: [table_name.impression_id]
- **Notes**: Unique impressions only, duplicates excluded

#### Clicks
- **Definition**: Number of times users clicked on ads
- **Formula**: `COUNT(DISTINCT click_id)`
- **Units**: Count
- **Granularity**: Daily, per campaign
- **Data Source**: [table_name.click_id]

### Efficiency Metrics

#### Cost Per Click (CPC)
- **Definition**: Average cost incurred for each click
- **Formula**: `SUM(spend_amount) / COUNT(DISTINCT click_id)`
- **Units**: Currency (USD)
- **Granularity**: Daily, per campaign
- **Calculation Notes**: Excludes days with zero clicks to avoid division by zero
- **Business Context**: Measures cost efficiency of driving traffic

#### Click Through Rate (CTR)
- **Definition**: Percentage of impressions that resulted in clicks
- **Formula**: `COUNT(DISTINCT click_id) / COUNT(DISTINCT impression_id)`
- **Units**: Percentage (%)
- **Granularity**: Daily, per campaign
- **Calculation Notes**: Excludes days with zero impressions
- **Business Context**: Measures ad effectiveness and relevance

#### Conversion Rate
- **Definition**: Percentage of clicks that resulted in conversions
- **Formula**: `COUNT(DISTINCT conversion_id) / COUNT(DISTINCT click_id)`
- **Units**: Percentage (%)
- **Granularity**: Daily, per campaign
- **Calculation Notes**: Excludes days with zero clicks
- **Business Context**: Measures landing page and offer effectiveness

### Revenue Metrics

#### Revenue
- **Definition**: Total revenue generated from conversions
- **Formula**: `SUM(revenue_value)`
- **Units**: Currency (USD)
- **Granularity**: Daily, per campaign
- **Data Source**: [table_name.revenue_value]
- **Notes**: Attributed revenue based on attribution model

#### Return on Ad Spend (ROAS)
- **Definition**: Revenue generated per dollar of ad spend
- **Formula**: `SUM(revenue_value) / SUM(spend_amount)`
- **Units**: Ratio (e.g., 3.5x)
- **Granularity**: Daily, per campaign
- **Calculation Notes**: Excludes days with zero spend
- **Business Context**: Primary measure of advertising profitability

## Rolling Calculations

### 14-Day Rolling Metrics
**Source SQL**: `/sql/03_notebook_repro_p14d.sql`

#### Rolling Average
- **Definition**: Average metric value over trailing 14-day period
- **Formula**: `AVG(metric) OVER (ORDER BY date ROWS BETWEEN 13 PRECEDING AND CURRENT ROW)`
- **Purpose**: Smooths daily fluctuations, shows trends
- **Business Context**: Used for performance trend analysis

#### Rolling Sum
- **Definition**: Cumulative metric value over trailing 14-day period
- **Formula**: `SUM(metric) OVER (ORDER BY date ROWS BETWEEN 13 PRECEDING AND CURRENT ROW)`
- **Purpose**: Shows recent performance volume
- **Business Context**: Used for recent performance evaluation

## Composite Metrics

### Efficiency Score
- **Definition**: Combined efficiency metric based on CPC, CTR, and Conversion Rate
- **Formula**: [Custom formula to be defined]
- **Units**: Score (0-100)
- **Purpose**: Overall campaign efficiency ranking
- **Business Context**: Used for campaign comparison

### Performance Index
- **Definition**: Weighted index of multiple performance metrics
- **Formula**: [Custom formula to be defined]
- **Units**: Index (baseline = 100)
- **Purpose**: Overall campaign performance tracking
- **Business Context**: Used for performance benchmarking

## Attribution Metrics

### First-Touch Attribution
- **Definition**: Revenue attributed to first campaign interaction
- **Formula**: [Attribution logic]
- **Business Context**: Measures top-of-funnel effectiveness

### Last-Touch Attribution
- **Definition**: Revenue attributed to final campaign interaction
- **Formula**: [Attribution logic]
- **Business Context**: Measures bottom-of-funnel effectiveness

### Linear Attribution
- **Definition**: Revenue equally distributed across all touchpoints
- **Formula**: [Attribution logic]
- **Business Context**: Balanced view of customer journey

## Data Quality Metrics

### Completeness Rate
- **Definition**: Percentage of expected data present
- **Formula**: `COUNT(*) / expected_count`
- **Units**: Percentage (%)
- **Purpose**: Data quality monitoring

### Freshness Score
- **Definition**: How current the data is relative to expected update time
- **Formula**: Time-based calculation
- **Units**: Hours/Days
- **Purpose**: Data timeliness monitoring

## Notes
- Analysis Date: [timestamp]
- SQL Files Used: `/sql/03_notebook_repro_p14d.sql`, `/sql/04_daily_kpis_p30d.sql`
- Currency: USD
- Attribution Model: [model to be specified]
- Analyst: [analyst name]
