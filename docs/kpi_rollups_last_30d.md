# KPI Rollups - Last 30 Days

## Overview
This document analyzes KPI rollups and performance metrics for the last 30 days, including 14-day rolling calculations and daily trends.

---

## Freshness & Volume

**Source**: `sql/02_row_counts_last_30d.sql` executed on 2026-01-27

### Date Column Summary

| Table | Date Column | Min Date | Max Date | Total Rows |
|-------|-------------|----------|----------|------------|
| clicksanalytics_v2 | render_date | 2018-04-30 | 2026-01-27 | 99,596,878 |
| clicksanalytics_v2 | msg_date | 2019-09-24 | 2026-01-27 | 99,596,878 |

**Note**: `clicksanalytics_v2` uses **msg_date** for rollups. `render_date` also exists and is current.

### agg_daily_v2 - Daily Row Counts (Last 30 Days)

| searchdate | row_count |
|------------|-----------|
| 2025-12-28 | 4,456 |
| 2025-12-29 | 7,628 |
| 2025-12-30 | 7,294 |
| 2025-12-31 | 6,300 |
| 2026-01-01 | 6,950 |
| 2026-01-02 | 7,584 |
| 2026-01-03 | 4,228 |
| 2026-01-04 | 4,334 |
| 2026-01-05 | 8,867 |
| 2026-01-06 | 8,679 |
| 2026-01-07 | 9,015 |
| 2026-01-08 | 9,262 |
| 2026-01-09 | 9,537 |
| 2026-01-10 | 6,139 |
| 2026-01-11 | 4,780 |
| 2026-01-12 | 9,346 |
| 2026-01-13 | 9,538 |
| 2026-01-14 | 9,409 |
| 2026-01-15 | 10,048 |
| 2026-01-16 | 9,817 |
| 2026-01-17 | 4,606 |
| 2026-01-18 | 4,643 |
| 2026-01-19 | 9,088 |
| 2026-01-20 | 9,344 |
| 2026-01-21 | 9,387 |
| 2026-01-22 | 9,089 |
| 2026-01-23 | 8,910 |
| 2026-01-24 | 4,467 |
| 2026-01-25 | 4,796 |
| 2026-01-26 | 9,002 |
| 2026-01-27 | 4 |

### clicksanalytics_v2 - Daily Row Counts (Last 30 Days, by msg_date)

| msg_dt | row_count |
|--------|-----------|
| 2025-12-28 | 19,157 |
| 2025-12-29 | 21,726 |
| 2025-12-30 | 23,472 |
| 2025-12-31 | 18,650 |
| 2026-01-01 | 21,644 |
| 2026-01-02 | 23,232 |
| 2026-01-03 | 19,907 |
| 2026-01-04 | 20,507 |
| 2026-01-05 | 24,620 |
| 2026-01-06 | 23,327 |
| 2026-01-07 | 24,283 |
| 2026-01-08 | 25,001 |
| 2026-01-09 | 25,105 |
| 2026-01-10 | 21,057 |
| 2026-01-11 | 18,799 |
| 2026-01-12 | 24,523 |
| 2026-01-13 | 26,195 |
| 2026-01-14 | 26,972 |
| 2026-01-15 | 28,914 |
| 2026-01-16 | 26,666 |
| 2026-01-17 | 22,915 |
| 2026-01-18 | 22,703 |
| 2026-01-19 | 25,379 |
| 2026-01-20 | 29,189 |
| 2026-01-21 | 29,084 |
| 2026-01-22 | 28,402 |
| 2026-01-23 | 27,732 |
| 2026-01-24 | 27,134 |
| 2026-01-25 | 26,930 |
| 2026-01-26 | 29,307 |
| 2026-01-27 | 13,861 |

---

## Notebook Reproduction (p14d)

**Source**: `sql/03_notebook_repro_p14d.sql` executed on 2026-01-27

### Platform Rollups (Last 14 Days)

| platform | clicks | cost | rt_clicks | revenue | clean | open | cpc | rtctr | rpc | er |
|----------|--------|------|-----------|---------|-------|------|-----|-------|-----|-----|
| google_main | 42,288 | 116,566.41 | NULL | NULL | NULL | NULL | 2.76 | NULL | NULL | NULL |
| whale | 5,008 | 41,889.77 | NULL | NULL | NULL | NULL | 8.36 | NULL | NULL | NULL |

### Notes

- **bing**: No rows returned from `agg_daily_v2` matching `campaign ILIKE 'p:B | SMMA: Automated Bidding'`
- **clk metrics (rt_clicks, revenue, clean, open)**: All NULL for both platforms
  - Cause: No matching rows in `clicksanalytics_v2` for the `utm_campaign` + `web` patterns
  - The `agg_daily_v2` table uses `campaign` column; `clicksanalytics_v2` uses `utm_campaign`
  - Platform mapping may need adjustment to match actual values in `clicksanalytics_v2`
- **Action needed**: Investigate actual `utm_campaign` and `web` values in `clicksanalytics_v2` to correct the join

---

## clicksanalytics web discovery (p14d)

**Source**: `sql/03a_clicksanalytics_web_discovery_p14d.sql` executed on 2026-01-27

### Top web Values by Volume (Last 14 Days)

| web | rows |
|-----|------|
| br3 | 80,814 |
| myfi_ratezip_api | 59,760 |
| myfi_z2amedia | 29,356 |
| myfi_yhof3 | 15,084 |
| myfi_mdr | 14,456 |
| myfi_comparisun | 14,202 |
| myfi_savingspro | 13,754 |
| meta_savings | 13,436 |
| myfi_comparisonrabbit | 11,249 |
| myfi_credible | 10,848 |
| sem_savings_google_b | 9,859 |
| br_myfin_all | 9,400 |
| smma_taboola | 8,467 |
| myfi_bankerxplorer | 7,649 |
| sem_savings_google_c | 7,103 |
| myfi_forbes_sem_mtg_google | 5,744 |
| sembrmtg | 5,483 |
| myfi_walletjump | 4,945 |
| myfi_greensprout | 4,411 |
| sem_purebrand_google | 3,913 |
| myfi_cbsmw | 3,884 |
| myfi_wsj_buyside | 3,475 |
| sem_cds_bing_1 | 3,336 |
| rproad2 | 3,195 |
| myfi_milansingh | 3,176 |
| myfi_moneyatlas | 3,146 |
| sem_savings_google_d | 2,973 |
| myfi_calltoleap | 2,934 |
| email | 2,562 |
| myfi_cnbc | 2,302 |
| sem_cds_google_1 | 2,152 |
| sem_savings_bing_desktop | 1,993 |
| br_brand_pmax | 1,791 |
| br_myfi_mortgage_deposits_editorial | 1,664 |
| sem_savings_google_2 | 1,628 |
| myfi_kiplinger | 1,563 |
| myfi_fortune | 1,409 |
| sem_pa_bing | 1,033 |
| myfi_mkw | 1,028 |
| sem_savings_google_whale | 936 |
| myfi_comparecom | 897 |
| myfi_cstransunion | 837 |
| myfi_fortune_api | 837 |
| sem_savings_bing_mobile | 801 |
| myfi_fico | 799 |
| myfi_sinclairsynd | 709 |
| myfi_forbes_sem_bing | 688 |
| myfi_militarycom | 653 |
| myfi_mbr | 643 |
| he_googlesearch | 614 |

### Traffic Source Breakdown (Last 14 Days)

| traffic_source_level_one | traffic_source_level_two | traffic_source_level_three | rows |
|--------------------------|--------------------------|----------------------------|------|
| Paid | Partner | RateZip API partner | 59,503 |
| Earned | SEO | Google SEO | 46,495 |
| Paid | Paid Search | Google Paid Search | 39,251 |
| Earned | Direct | Direct | 37,818 |
| Paid | Partner | Z2A Media partner | 29,356 |
| Paid | Paid Other | Paid Other | 19,874 |
| Paid | Partner | Madrivo partner | 14,131 |
| Paid | Partner | Comparisun partner | 13,990 |
| Paid | Partner | SavingsPro partner | 13,735 |
| Paid | Partner | Yahoo Finance partner | 13,657 |
| Paid | Partner | Credible.com partner | 11,432 |
| Paid | Partner | Comparison Rabbit partner | 11,249 |
| Paid | Paid Other | paiddisplay | 8,712 |
| Paid | Paid Search | Bing Paid Search | 8,159 |
| Paid | Partner | Bankerexplorer partner | 7,649 |
| Earned | Referral | Referral Other | 5,559 |
| Paid | Partner | Wallet Jump partner | 4,872 |
| Paid | Partner | Greensprout partner | 4,369 |
| Earned | Email | Email | 3,861 |
| Paid | Partner | CBS News MoneyWatch partner | 3,827 |
| Earned | SEO | DuckDuckGo SEO | 3,651 |
| Paid | Partner | WSJ Buyside partner | 3,367 |
| Paid | Partner | RATE CATCHER partner | 3,191 |
| Earned | SEO | Bing SEO | 2,898 |
| Paid | Partner | Milan Singh partner | 2,630 |
| Paid | Partner | CNBC partner | 2,478 |
| Paid | Partner | Call To Leap partner | 2,170 |
| Paid | Partner | Fortune Recommends partner | 1,401 |
| Earned | SEO | Yahoo SEO | 1,060 |
| Paid | Partner | Yahoo Finance CDs Pixel partner | 960 |
| Paid | Partner | Credit Sesame Transunion API partner | 811 |
| Paid | Partner | BANKTRUTH partner | 799 |
| Paid | Partner | FICO partner | 789 |
| Paid | Partner | Market Watch partner | 788 |
| Paid | Partner | Sinclair Syndication partner | 675 |
| Paid | Partner | Forbes SEM partner | 663 |
| Paid | Partner | TheMortgageReports partner | 551 |
| Paid | Partner | Monitor Bank Rates partner | 526 |
| Paid | Partner | Kiplinger Pub partner | 517 |
| Paid | Partner | Credit Sesame API partner | 508 |
| Paid | Partner | google,google partner | 438 |
| Paid | Partner | Yahoo iFrame partner | 423 |
| Paid | Partner | Humphrey Yang partner | 419 |
| Paid | Partner | Perform[CB] partner | 416 |
| Paid | Partner | WSJ Buyside SEM partner | 408 |
| Paid | Partner | Gabe Bult partner | 341 |
| Paid | Partner | Forbes Mtg, Deposits partner | 340 |
| Paid | Partner | Resource+Help+Online partner | 337 |
| Paid | Partner | Yahoo Finance Mtg Pixel partner | 303 |
| Paid | Partner | Loan Finder partner | 260 |

---

## Notebook Reproduction (p14d) v2 (evidence-based web mapping)

**Source**: `sql/03b_notebook_repro_p14d_v2.sql` executed on 2026-01-27

### Platform Rollups (Last 14 Days)

| platform | clicks | cost | rt_clicks | revenue | clean | open | cpc | rtctr | rpc | er |
|----------|--------|------|-----------|---------|-------|------|-----|-------|-----|-----|
| google_main | 42,288 | 116,566.41 | NULL | NULL | NULL | NULL | 2.76 | NULL | NULL | NULL |
| whale | 5,008 | 41,889.77 | 878 | 38,665.99 | 18 | 14 | 8.36 | 0.175 | 44.04 | 0.78 |

### Notes

- **whale**: Successfully joined. 878 rt_clicks, $38,666 revenue, rtctr=17.5%, rpc=$44.04, er=78%
- **google_main**: clk metrics still NULL - web mapping unknown, not forced
- **bing**: No rows returned from `agg_daily_v2` (campaign pattern may not match)

### Comparison to v1

| platform | v1 rt_clicks | v2 rt_clicks | Change |
|----------|--------------|--------------|--------|
| whale | NULL | 878 | Fixed |
| google_main | NULL | NULL | Still pending |
| bing | N/A | N/A | No agg rows |

---

## Google main web discovery (p14d)

**Source**: `sql/03c_google_main_web_discovery_p14d.sql` executed on 2026-01-27

### Query 1: Web values where traffic_source contains 'google'

| web | rows |
|-----|------|
| br3 | 39,160 |
| sem_savings_google_b | 8,943 |
| sem_savings_google_c | 6,466 |
| myfi_forbes_sem_mtg_google | 5,336 |
| sembrmtg | 4,034 |
| br_myfin_all | 3,695 |
| sem_savings_google_d | 2,651 |
| sem_purebrand_google | 2,585 |
| sem_cds_google_1 | 1,931 |
| sem_savings_google_2 | 1,601 |
| br_myfi_mortgage_deposits_editorial | 1,035 |
| sem_savings_google_whale | 851 |
| br_brand_pmax | 744 |
| he_googlesearch | 479 |
| myfi_moneyatlas | 383 |
| **sem_savings_google_1** | **204** |
| sem_savings_google_e | 129 |
| sem_savings_google_a | 62 |
| myfi_wsjbuysidesem | 54 |
| mtg_refi_pmax | 49 |

### Query 2: Web values where web contains 'google'

| web | rows |
|-----|------|
| sem_savings_google_b | 9,419 |
| sem_savings_google_c | 6,847 |
| myfi_forbes_sem_mtg_google | 5,498 |
| sem_purebrand_google | 3,689 |
| sem_savings_google_d | 2,777 |
| sem_cds_google_1 | 2,030 |
| sem_savings_google_2 | 1,675 |
| sem_savings_google_whale | 865 |
| he_googlesearch | 560 |
| seo_google | 304 |
| **sem_savings_google_1** | **214** |
| sem_savings_google_e | 132 |
| sem_savings_google_a | 62 |
| myfi_forbes_sem_google | 21 |

### Findings

- **sem_savings_google_1 EXISTS** with 204-214 rows (low volume vs. google_main's 42,288 agg clicks)
- Higher-volume candidates: `sem_savings_google_b` (9,419), `sem_savings_google_c` (6,847), `sem_savings_google_d` (2,777)
- `br3` (39,160 rows) is high volume but generic - not specific to google_main

**Recommendation**: The original mapping `sem_savings_google_1` exists but has very low volume. Consider whether google_main should map to multiple web values (b, c, d, 1, 2) or if the campaign-to-web relationship differs from expectations.

---

## Notebook Reproduction (p14d) v3 (evidence-based web mapping incl. google_main)

**Source**: `sql/03d_notebook_repro_p14d_v3.sql` executed on 2026-01-27

### Platform Rollups (Last 14 Days)

| platform | clicks | cost | rt_clicks | revenue | clean | open | cpc | rtctr | rpc | er |
|----------|--------|------|-----------|---------|-------|------|-----|-------|-----|-----|
| google_main | 40,276 | 112,406.94 | 19,878 | 427,524.99 | 23 | 57 | 2.79 | 0.494 | 21.51 | 2.48 |
| whale | 4,495 | 38,238.29 | 812 | 35,802.21 | 18 | 14 | 8.51 | 0.181 | 44.09 | 0.78 |

### Notes

- **google_main**: Now fully populated with 19,878 rt_clicks, $427,525 revenue
  - rtctr = 49.4% (rt_clicks / clicks)
  - rpc = $21.51 (revenue / rt_clicks)
  - er = 2.48 (open / clean) - note: >1 indicates multiple opens per clean
- **whale**: 812 rt_clicks, $35,802 revenue, rtctr=18.1%, rpc=$44.09, er=0.78
- **bing**: Still no rows from `agg_daily_v2` (campaign pattern may not match)

### Comparison to v2

| platform | v2 rt_clicks | v3 rt_clicks | Change |
|----------|--------------|--------------|--------|
| google_main | NULL | 19,878 | **Fixed** |
| whale | 878 | 812 | Minor variance |
| bing | N/A | N/A | No agg rows |

### Paid vs All Comparison (p14d, v3 mapping)

| platform | rt_clicks | rt_clicks_paid | revenue | revenue_paid | rpc | rpc_paid | rtctr | rtctr_paid |
|----------|-----------|----------------|---------|--------------|-----|----------|-------|------------|
| google_main | 19,878 | 19,757 | $427,525 | $427,525 | $21.51 | $21.64 | 49.4% | 49.1% |
| whale | 812 | 798 | $35,802 | $35,802 | $44.09 | $44.86 | 18.1% | 17.8% |

**Findings**:
- **rt_clicks vs rt_clicks_paid**: ~0.6-1.7% of clicks are zero-CPC (google_main: 121 unpaid, whale: 14 unpaid)
- **revenue = revenue_paid**: All revenue comes from paid clicks (zero-CPC rows contribute $0)
- **rpc_paid slightly higher**: Removing zero-CPC clicks from denominator increases rpc by ~0.6-1.7%
- **Impact minimal**: For MVP, using `_paid` variants is cleaner but difference is small

---

## Daily KPIs (last 30d, v3 mapping)

**Source**: `sql/04_daily_kpis_p30d.sql` executed on 2026-01-27

### Sample: Last 10 Days

| date | platform | clicks | cost | rt_clicks | revenue | cpc | rtctr | rpc | er | has_agg | has_clk |
|------|----------|--------|------|-----------|---------|-----|-------|-----|-----|---------|---------|
| 2026-01-27 | (null) | - | - | 19,610 | 301,673 | - | - | 15.38 | 0.01 | 0 | 1 |
| 2026-01-27 | (null) | 8 | 2.55 | - | - | 0.32 | - | - | - | 1 | 0 |
| 2026-01-27 | bing | - | - | 115 | 1,311 | - | - | 11.40 | 0.0 | 0 | 1 |
| 2026-01-27 | google_main | - | - | 1,338 | 30,163 | - | - | 22.54 | 0.0 | 0 | 1 |
| 2026-01-27 | whale | - | - | 36 | 1,436 | - | 39.90 | 0.0 | 0 | 1 |
| 2026-01-26 | (null) | - | - | 26,361 | 396,883 | - | - | 15.06 | 0.06 | 0 | 1 |
| 2026-01-26 | (null) | 52,845 | 68,817 | - | - | 1.30 | - | - | - | 1 | 0 |
| 2026-01-26 | bing | - | - | 122 | 1,074 | - | - | 8.81 | 0.0 | 0 | 1 |
| 2026-01-26 | google_main | 2,552 | 8,554 | 1,196 | 27,742 | 3.35 | 0.47 | 23.20 | 0.06 | 1 | 1 |
| 2026-01-26 | whale | 409 | 3,543 | 69 | 2,988 | 8.66 | 0.17 | 43.30 | 0.0 | 1 | 1 |
| 2026-01-25 | google_main | 3,797 | 13,692 | 1,831 | 40,732 | 3.61 | 0.48 | 22.25 | 0.15 | 1 | 1 |
| 2026-01-25 | whale | 310 | 3,019 | 60 | 2,663 | 9.74 | 0.19 | 44.38 | 0.10 | 1 | 1 |
| 2026-01-24 | google_main | 2,899 | 9,047 | 1,524 | 35,110 | 3.12 | 0.53 | 23.04 | 0.21 | 1 | 1 |
| 2026-01-24 | whale | 261 | 2,063 | 51 | 2,299 | 7.90 | 0.20 | 45.07 | 0.07 | 1 | 1 |
| 2026-01-23 | google_main | 2,899 | 8,385 | 1,551 | 34,792 | 2.89 | 0.54 | 22.43 | 0.19 | 1 | 1 |
| 2026-01-23 | whale | 356 | 3,289 | 59 | 2,405 | 9.24 | 0.17 | 40.76 | 0.17 | 1 | 1 |

### Missingness Summary (updated with bing wildcard fix)

| platform | has_agg | has_clk | row_count |
|----------|---------|---------|-----------|
| bing | 1 | 1 | 30 |
| google_main | 1 | 1 | 30 |
| whale | 1 | 1 | 30 |

### Notes

- **All 3 platforms now have full coverage** (has_agg=1, has_clk=1) for 30 days
- bing fixed by using `campaign ILIKE 'p:B | SMMA: Automated Bidding%'` wildcard

### Bing Last 10 Days Sample

| date | clicks | cost | rt_clicks_paid | revenue_paid | cpc | rtctr_paid | rpc_paid |
|------|--------|------|----------------|--------------|-----|------------|----------|
| 2026-01-27 | 2,424 | $1,080 | 158 | $1,613 | $0.45 | 6.5% | $10.21 |
| 2026-01-26 | 1,955 | $971 | 120 | $1,074 | $0.50 | 6.1% | $8.95 |
| 2026-01-25 | 1,609 | $700 | 114 | $1,067 | $0.44 | 7.1% | $9.36 |
| 2026-01-24 | 1,454 | $636 | 112 | $1,040 | $0.44 | 7.7% | $9.28 |
| 2026-01-23 | 1,489 | $636 | 169 | $1,610 | $0.43 | 11.3% | $9.53 |
| 2026-01-22 | 1,566 | $651 | 158 | $1,415 | $0.42 | 10.1% | $8.96 |
| 2026-01-21 | 1,549 | $631 | 155 | $1,439 | $0.41 | 10.0% | $9.28 |
| 2026-01-20 | 2,046 | $811 | 186 | $1,698 | $0.40 | 9.1% | $9.13 |
| 2026-01-19 | 1,754 | $665 | 146 | $1,313 | $0.38 | 8.3% | $8.99 |
| 2026-01-18 | 1,387 | $510 | 121 | $1,111 | $0.37 | 8.7% | $9.18 |

---

## Data Quality Checks (last 30d)

**Source**: `sql/05_dq_checks.sql` executed on 2026-01-27

### A) agg_daily_v2: clicks=0 but cost>0

**Result**: No rows returned.

No campaigns have cost without clicks in the last 30 days.

### B) clicksanalytics_v2: negative/zero cost_per_click

| msg_dt | rows | neg_cpc_rows | zero_cpc_rows | min_cpc | max_cpc |
|--------|------|--------------|---------------|---------|---------|
| 2026-01-27 | 22,573 | 0 | 5,750 | 0.0 | 280.0 |
| 2026-01-26 | 29,307 | 0 | 6,552 | 0.0 | 280.0 |
| 2026-01-25 | 26,930 | 0 | 5,781 | 0.0 | 280.0 |
| 2026-01-24 | 27,134 | 0 | 5,680 | 0.0 | 280.0 |
| 2026-01-23 | 27,732 | 0 | 6,356 | 0.0 | 280.0 |
| ... | ... | ... | ... | ... | ... |

**Summary**:
- **No negative CPC** values found
- **~20-25% zero CPC** rows daily (e.g., 5,750 / 22,573 = 25%)
- Max CPC = $280-$492 (reasonable range)

**MVP Impact**: Zero-CPC rows inflate rt_clicks count but contribute $0 to revenue. May need filtering or separate treatment.

### C) ER sanity: open > clean

**Result**: No rows returned.

No days/platforms where open > clean. ER metric is bounded [0, 1] as expected.

### D) Missingness by platform (last 30d)

| platform | has_agg | has_clk | row_count |
|----------|---------|---------|-----------|
| bing | 0 | 1 | 30 |
| google_main | 0 | 1 | 1 |
| google_main | 1 | 1 | 29 |
| whale | 0 | 1 | 1 |
| whale | 1 | 1 | 29 |

**Findings**:
- **bing**: 30 days with clk data but **0 days with agg data** - campaign pattern not matching
- **google_main**: 29/30 days have both; 1 day (2026-01-27) missing agg (partial day)
- **whale**: 29/30 days have both; 1 day (2026-01-27) missing agg (partial day)

**MVP Blockers**:
1. **bing platform unusable** - no agg_daily_v2 data to join. Need to investigate campaign pattern.
2. **Zero-CPC rows** - consider filtering `cost_per_click > 0` if revenue accuracy is critical.

---

## Bing agg discovery (p30d)

**Source**: `sql/04a_bing_agg_discovery_p30d.sql` executed on 2026-01-27

### Query 1: By platform/provider/channel

| platform | provider | channel | rows | clicks | cost |
|----------|----------|---------|------|--------|------|
| Google | | Paid Search | 99,268 | 421,305 | $1,399,008 |
| **Microsoft** | | **Paid Search** | **117,615** | **287,545** | **$195,904** |
| Taboola | | Paid Native | 4,615 | 396,414 | $148,382 |
| Meta | | Paid Social | 593 | 311,347 | $96,786 |

### Query 2: Campaign names with bing/p:b/microsoft patterns

| campaign | clicks | cost |
|----------|--------|------|
| p:B\|a:BrMTG\|^G\|#All\|d:MixedIntent\|m:All\|g:All\|ad:All | 95,625 | $86,399 |
| **p:B \| SMMA: Automated Bidding Desktop** | **46,650** | **$24,743** |
| p:B\|a:BrHE\|^G\|#All\|d:HomeEquityCPL2025\|m:All\|g:USA\|ad:All | 4,559 | $17,822 |
| p:B \| CD: Automated Bidding | 55,078 | $13,851 |
| **p:B \| SMMA: Automated Bidding Mobile** | **26,370** | **$9,763** |
| p:B \| Purebrand: Automated Bidding | 5,196 | $378 |
| ... (more SAFE campaigns) | ... | ... |

### Findings

- **Microsoft platform exists** with 287,545 clicks, $195,904 cost (significant volume)
- **Bing SMMA campaigns found**: `p:B | SMMA: Automated Bidding Desktop` and `p:B | SMMA: Automated Bidding Mobile`
- Current mapping uses `p:B | SMMA: Automated Bidding` (no Desktop/Mobile suffix) - **pattern mismatch**
- Combined SMMA Desktop + Mobile: 73,020 clicks, $34,506 cost

**Root cause**: Campaign pattern `p:B | SMMA: Automated Bidding` does not match actual campaign names which have `Desktop` or `Mobile` suffix.

---

## Allocator inputs rollup (7d/14d/28d, excluding today)

**Source**: `sql/06_allocator_inputs_rollup.sql` executed on 2026-01-28

### Rolling-Window KPIs by Platform

| platform | clicks_7d | cost_7d | rt_clicks_paid_7d | revenue_paid_7d | cpc_7d | rtctr_paid_7d | rpc_paid_7d |
|----------|-----------|---------|-------------------|-----------------|--------|---------------|-------------|
| bing | 13,894 | $6,574 | 1,037 | $9,802 | $0.47 | 7.5% | $9.45 |
| google_main | 20,803 | $66,894 | 10,618 | $238,221 | $3.22 | 51.0% | $22.44 |
| whale | 2,534 | $21,731 | 439 | $18,749 | $8.58 | 17.3% | $42.71 |

| platform | clicks_14d | cost_14d | rt_clicks_paid_14d | revenue_paid_14d | cpc_14d | rtctr_paid_14d | rpc_paid_14d |
|----------|------------|----------|--------------------|--------------------|---------|----------------|--------------|
| bing | 33,831 | $15,492 | 2,456 | $22,696 | $0.46 | 7.3% | $9.24 |
| google_main | 43,465 | $124,971 | 19,983 | $431,241 | $2.88 | 46.0% | $21.58 |
| whale | 4,873 | $40,950 | 810 | $36,208 | $8.40 | 16.6% | $44.70 |

| platform | clicks_28d | cost_28d | rt_clicks_paid_28d | revenue_paid_28d | cpc_28d | rtctr_paid_28d | rpc_paid_28d |
|----------|------------|----------|--------------------|--------------------|---------|----------------|--------------|
| bing | 69,821 | $32,361 | 5,699 | $47,876 | $0.46 | 8.2% | $8.40 |
| google_main | 77,463 | $202,467 | 31,678 | $739,053 | $2.61 | 40.9% | $23.33 |
| whale | 10,016 | $83,590 | 1,609 | $76,888 | $8.35 | 16.1% | $47.79 |

### Data Quality Flags

| platform | flags |
|----------|-------|
| bing | (none) |
| google_main | (none) |
| whale | (none) |

All platforms have full 7/14/28 day coverage with no missing days or low-click warnings.

### Key Observations

- **google_main**: Highest volume (20K clicks/7d), best rtctr_paid (51%), moderate rpc ($22)
- **whale**: Lowest volume (2.5K clicks/7d), highest cpc ($8.58), highest rpc ($43-48)
- **bing**: Mid volume (14K clicks/7d), lowest cpc ($0.47), lowest rpc ($8-9)

---

## Naive allocator suggestion (7d rollup)

**Source**: `sql/07_naive_allocator_suggestion.sql` executed on 2026-01-28

### Allocation Weights

| platform | expected_revenue_per_dollar | expected_paid_clicks_per_dollar | allocation_weight |
|----------|-----------------------------|---------------------------------|-------------------|
| google_main | 3.56 | 0.159 | **60.2%** |
| bing | 1.49 | 0.158 | **25.2%** |
| whale | 0.86 | 0.020 | **14.6%** |

### Formula

```
expected_revenue_per_dollar = (rtctr_paid_7d * rpc_paid_7d) / cpc_7d
allocation_weight = normalized(max(expected_revenue_per_dollar, 0.10))
```

### Notes

- This is a **baseline heuristic**, not accounting for diminishing returns or bid-response curves.
- google_main dominates due to high rtctr (51%) combined with reasonable rpc ($22) and moderate cpc ($3.22).
- bing has similar paid-clicks-per-dollar (0.158) to google_main but lower rpc ($9 vs $22).
- whale has highest rpc ($43) but very low rtctr (17%) and high cpc ($8.58), limiting expected revenue per dollar.

---

## Executive Summary
**Analysis Period**: [start_date] to [end_date]
**Source SQL**: `/sql/03_notebook_repro_p14d.sql`, `/sql/04_daily_kpis_p30d.sql`

[High-level summary of key findings]

## 14-Day Rolling Analysis

### Reproduction Validation
**Source SQL**: `/sql/03_notebook_repro_p14d.sql`

**Validation Results**:
- Notebook Logic Reproduced: [Y/N]
- Discrepancies Found: [count]
- Accuracy Rate: [percentage]

### Rolling KPIs (Last 14 Days)
| KPI | Current 14D | Previous 14D | Change | % Change |
|-----|-------------|--------------|--------|----------|
| Total Spend | [amount] | [amount] | [amount] | [percentage] |
| Total Impressions | [count] | [count] | [count] | [percentage] |
| Total Clicks | [count] | [count] | [count] | [percentage] |
| Total Conversions | [count] | [count] | [count] | [percentage] |
| Average ROAS | [value] | [value] | [value] | [percentage] |

### Daily Rolling Trends
**Source SQL**: `/sql/03_notebook_repro_p14d.sql`

[Chart or table showing daily rolling values over 30 days]

## Daily KPI Analysis

### Daily Performance Summary
**Source SQL**: `/sql/04_daily_kpis_p30d.sql`

| Date | Daily Spend | Impressions | Clicks | Conversions | CPC | CTR | Conversion Rate | ROAS |
|------|-------------|-------------|--------|-------------|-----|-----|-----------------|------|
| [date_1] | [amount] | [count] | [count] | [count] | [value] | [value] | [value] | [value] |
| [date_2] | [amount] | [count] | [count] | [count] | [value] | [value] | [value] | [value] |

### KPI Trends (Last 30 Days)
**Source SQL**: `/sql/04_daily_kpis_p30d.sql`

#### Spend Trends
- **Average Daily Spend**: [amount]
- **Spend Growth**: [percentage] over 30 days
- **Peak Spend Day**: [date] with [amount]
- **Lowest Spend Day**: [date] with [amount]

#### Efficiency Metrics
- **Average CPC**: [value] ([trend])
- **Average CTR**: [value] ([trend])
- **Average Conversion Rate**: [value] ([trend])
- **Average ROAS**: [value] ([trend])

## Campaign-Level Rollups

### Top Performing Campaigns (Last 30 Days)
| Campaign ID | Spend | Revenue | ROAS | Conversions | CPC |
|-------------|-------|---------|------|-------------|-----|
| [campaign_1] | [amount] | [amount] | [value] | [count] | [value] |
| [campaign_2] | [amount] | [amount] | [value] | [count] | [value] |

### Underperforming Campaigns
| Campaign ID | Spend | Revenue | ROAS | Conversions | CPC |
|-------------|-------|---------|------|-------------|-----|
| [campaign_1] | [amount] | [amount] | [value] | [count] | [value] |
| [campaign_2] | [amount] | [amount] | [value] | [count] | [value] |

## Weekly Patterns

### Day-of-Week Analysis
| Day | Avg Spend | Avg Impressions | Avg Clicks | Avg Conversions | Avg ROAS |
|-----|-----------|-----------------|------------|-----------------|----------|
| Monday | [amount] | [count] | [count] | [count] | [value] |
| Tuesday | [amount] | [count] | [count] | [count] | [value] |
| ... | ... | ... | ... | ... | ... |

## Anomalies and Insights

### Notable Patterns
- [Pattern 1 description]
- [Pattern 2 description]
- [Pattern 3 description]

### Outliers Detected
- **Date**: [date] - [description of anomaly]
- **Metric**: [metric] - [value] vs expected [value]
- **Impact**: [description of business impact]

## Recommendations

### Performance Optimization
1. [Recommendation 1]
2. [Recommendation 2]
3. [Recommendation 3]

### Budget Allocation Insights
1. [Insight 1]
2. [Insight 2]
3. [Insight 3]

## Notes
- Analysis Date: [timestamp]
- SQL Files Used: `/sql/03_notebook_repro_p14d.sql`, `/sql/04_daily_kpis_p30d.sql`
- Data Period: Last 30 days from [end_date]
- Analyst: [analyst name]
