-- 21_suggestion_log_ddl.sql
-- Design 3 (outcome C): the suggestion + adoption log that bootstraps the budget changelog.
--
-- *** PROPOSED DDL -- DO NOT RUN AS-IS. ***
-- AGENTS.md mandates read-only work; creating tables is a write. This file documents the
-- schema for review. Before execution: (1) point <sandbox_catalog>.<sandbox_schema> at a
-- DEV/sandbox location, NOT bankrate_prod gold; (2) get owner sign-off. Replace the
-- placeholders below.
--
-- Why this exists: the original assessment (ff_ranker_methodology.md) said a budget changelog
-- was prerequisite #1. None is coming (confirmed 2026-06). If the recommender LOGS every
-- suggestion and whether the buyer adopted it, then within ~90 days these two tables ARE the
-- changelog -- plus a prospective validation set that upgrades Meta/Taboola from outcome B to A
-- and converts day-of-week/IV identification into adoption-based quasi-experiments.

-- 1) One row per suggestion the recommender emits (mirrors recommender.py output;
--    hardened 2026-06-11 -- see docs/recommender_hardening.md).
-- Columns added by the hardening (append when this DDL is finalized):
--   selected_model STRING, curve_h_shape DOUBLE,
--   marg_roas_ci_lo DOUBLE, marg_roas_ci_hi DOUBLE, ci_decisive BOOLEAN, bootstrap_n INT,
--   recommended_daily_spend_lo DOUBLE, recommended_daily_spend_hi DOUBLE,
--   backtest_mean_mape DOUBLE, backtest_naive_mape DOUBLE,
--   backtest_window_err_pct DOUBLE, backtest_window_bias_pct DOUBLE, backtest_warn BOOLEAN,
--   dow_factor_applied BOOLEAN, month_factor_applied BOOLEAN, has_gap BOOLEAN
CREATE TABLE IF NOT EXISTS <sandbox_catalog>.<sandbox_schema>.budget_reco_suggestion (
  suggestion_id      STRING,        -- uuid
  generated_at       TIMESTAMP,     -- when the recommender ran
  run_id             STRING,        -- batch/run identifier
  vertical           STRING,        -- 'deposits'
  unit               STRING,        -- 'PLATFORM:Google' or 'CAMPAIGN:Microsoft|506118191'
  platform           STRING,
  campaign_key       STRING,        -- null for platform-grain rows
  label              STRING,
  confidence_tier    STRING,        -- 'A' (curve-backed) or 'B' (suggest-only/validate)
  current_daily_spend DOUBLE,
  observed_min       DOUBLE,        -- curve trusted only within [observed_min, observed_max]
  observed_max       DOUBLE,
  curve_a_ceiling    DOUBLE,        -- fitted rev ceiling  (rev = a*(1-exp(-cost/k)))
  curve_k_scale      DOUBLE,
  curve_r2           DOUBLE,
  marginal_roas      DOUBLE,        -- predicted revenue from the next $1 at current spend
  recommended_action STRING,        -- 'ADD' / 'HOLD' / 'TRIM' / 'suggest-only'
  recommended_delta_pct DOUBLE,     -- proposed change to daily spend (bounded, e.g. +/-15%)
  rationale          STRING,        -- human-readable why (LLM-wrapper text for tier B)
  first_stage_F      DOUBLE,        -- instrument strength snapshot (validation breadcrumb)
  iv_over_ols        DOUBLE         -- endogeneity check snapshot
) USING DELTA;

-- 2) One row per adoption outcome (the buyer's response + realized result).
--    Joining this back to (1) over time yields the realized response curve -> the changelog.
CREATE TABLE IF NOT EXISTS <sandbox_catalog>.<sandbox_schema>.budget_reco_adoption (
  suggestion_id      STRING,        -- FK -> budget_reco_suggestion.suggestion_id
  decided_at         TIMESTAMP,
  decided_by         STRING,        -- media buyer
  adopted            BOOLEAN,       -- did they act on it?
  actual_delta_pct   DOUBLE,        -- what they actually changed (may differ from recommended)
  notes              STRING,
  -- realized outcome, backfilled after the change has had time to mature:
  realized_window_days INT,         -- e.g. 14
  realized_spend     DOUBLE,
  realized_revenue   DOUBLE,
  realized_roas      DOUBLE,
  outcome_filled_at  TIMESTAMP
) USING DELTA;

-- Validation query sketch (once data accrues): compare predicted marginal_roas vs realized
-- marginal response on ADOPTED suggestions -> prospective test of the curves, and the
-- as-if-random budget moves needed to retire the endogeneity caveat without a formal holdout.
