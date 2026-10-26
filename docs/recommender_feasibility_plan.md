# Budget Recommender Feasibility Plan

**Created**: 2026-06-10
**Status**: COMPLETE 2026-06-10. Phases 0–1 done; gate = PASS (A/B boundary). Decision memo: `docs/recommender_feasibility.md`. Phase 2–3 build is a follow-up session per the timebox.
**Purpose**: Test the January 2026 assessment that a budget changelog is a prerequisite for a "next best dollar" budget recommender, using data and context we already have.

## Background

`docs/ff_ranker_methodology.md` ("Future: ROAS/CPOA-by-Budget Modeling") records the original assessment: to move from "which platform is best now" to "how should we reallocate $X across platforms," we need:

1. **Budget Changelog**: Historical record of daily budget levels per platform/campaign
2. **Response Curves**: Model of how ROAS changes with spend level (diminishing returns)
3. **Constraints**: Min/max spend thresholds, pacing requirements

The budget changelog is not coming anytime soon. This plan tests whether it was ever a hard prerequisite, or whether the response curves (the actual goal — the changelog was a means to them) can be estimated from data already available.

## Hypothesis (testable, two-tier)

> **Tier 1 (generous):** Usable response curves — how marginal revenue per dollar changes with spend level — can be estimated per platform/campaign from the natural day-to-day spend variation already recorded in `bankrate_prod.br_rpt.paid_media_ff_campaign_daily`, without a formal budget changelog.
>
> **Tier 2 (robustness, only if Tier 1 passes):** Curves estimated from *deliberate* budget moves — identified as large sustained level shifts in daily spend (changepoint detection) — agree in direction with the Tier 1 curves. Disagreement means Tier 1 was fitting delivery noise, not budget response.

Key reframe: the `cost` column *is* a realized-spend log, backfilled to **2024-01-01** (per the Paid Media Full Funnel doc), giving ~29 months of daily history. What's missing is *intended* budget settings. Tier 1 tests whether realized variation substitutes; Tier 2 guards against the failure mode where all variation is auction/pacing mechanics rather than budget decisions.

## Pass/kill criteria: explore-then-register protocol

To balance honest calibration against the motivated-reasoning critique, thresholds are set in two steps:

1. **Phase 1a (exploratory, spend only)**: Look at daily spend distributions — CV, p10/p50/p90, level shifts — *without querying revenue alongside spend*. This calibrates thresholds to what deliberate variation actually looks like in this account.
2. **Register**: Fix the pass/kill thresholds in this document, informed by 1a.
3. **Phase 1b (confirmatory)**: Run the ROAS-vs-spend analysis once, against the registered thresholds.

The protocol is defensible because we peek at the *predictor* (spend) but not the *outcome relationship* (ROAS vs spend) before registering. Starting heuristics to be revised in step 2 (not yet binding): CV > 0.3 for >= 5 campaigns over 90d with >= 60 active days; p90/p10 >= 2; >= 12 months usable history; monotone/saturating binned ROAS pattern for >= 3 candidates.

**Endogeneity is a gate, not a caveat**: teams raise spend when performance is good, biasing naive curve fits upward. A **strong pass (outcome A) requires a credible mitigation strategy** identified in Phase 0 research (e.g., lagged spend instruments, within-campaign day-of-week variation, changepoint-based event studies from Tier 2, geo holdouts as a future option). Without one, outcome B is the ceiling regardless of how clean the curves look.

### REGISTERED THRESHOLDS (binding — fixed 2026-06-10 after Phase 1a, before any ROAS-vs-spend query)

Informed by Phase 1a (`docs/recommender_feasibility_context.md`); user-confirmed. Locked before query 18.

**Candidate inclusion (units that get a Phase 1b curve attempt):**
- Platform grain: ≥12 usable months AND 90d CV ≥0.3.
- Campaign grain: ≥12 usable months AND ≥200 active days AND 90d CV ≥0.3.
- Fitting *scope* for query 18 (per user): **all qualifying units** — all 4 platforms + every campaign clearing the 90d variation heuristic (≥60 active days, CV>0.3, p90/p10≥2), even thin ones, with reliability flagged. Units with <50 active days in the 365d fit window are dropped (cannot form 5 stable quintiles).

**Tier 1 PASS:** ≥3 *depth-reliable* candidate units show a diminishing-returns ROAS-vs-spend pattern across within-unit spend quintiles, where the pattern is operationalized as:
  - average ROAS declines in ≥3 of the 4 quintile steps (q1→q2 … q4→q5), with the marginal rev/$ slope (Δmean_rev / Δmean_cost) reported alongside; AND
  - top-quintile (q5) ROAS < bottom-quintile (q1) ROAS; AND
  - the pattern survives day-of-week control (deseasonalize cost & revenue by unit×DoW means, re-bin, recheck).
  (Operational note: the registered "marginal rev/$ non-increasing in ≥3 of 4 steps" is implemented as the ROAS-declines-in-≥3-of-4-steps test above, with the marginal slope reported for color. Equivalent intent, cleaner with 5 quintiles.)

**Strong pass (outcome A)** additionally requires the **endogeneity gate**: a credible mitigation demonstrated — lagged-spend IV first-stage F>10 and/or DoW within-unit identification — AND Tier 2 agreement (changepoint event-study sign matches Tier 1 for a majority of testable evergreen campaigns).

**KILL:** <3 depth-reliable candidates show interpretable diminishing returns, OR patterns vanish/invert under DoW control, OR Tier 1 and Tier 2 directionally disagree for most candidates.

**Context decisions recorded 2026-06-10:** a formal budget changelog is **not coming / no timeline** (per user) → outcome C (a recommender that logs its own suggestions+adoptions to bootstrap the changelog) is the strategically interesting bridge, not a temporary stopgap.

## Evidence streams (all verified 2026-06-10)

### 1. Repo
- `docs/ff_ranker_methodology.md` — original assessment, current ranker design, guardrails
- `docs/meta_taboola_feasibility.md` — precedent for this genre of memo; match-rate kill criteria
- `sql/07_naive_allocator_suggestion.sql`, `sql/06_allocator_inputs_rollup.sql` — current allocator logic

### 2. Data (Databricks)
- Access: `run.ps1 <sql_file>` loads `.env` and runs via `run_sql.py`. **Auth verified 2026-06-10** (`sql/00_smoke_test.sql`).
- Primary: `bankrate_prod.br_rpt.paid_media_ff_campaign_daily` (gold; platform/campaign/day; cost, clicks, total_actual_revenue)
- Finer grain if needed: `br_rpt.paid_media_daily` (ad/ad_group/keyword/device/day) + `br_rpt.conversions_enriched_all_verticals` (silver; pre-aggregate before joining, per the FF doc)
- Planned queries (save to `/sql/` per AGENTS.md):
  - `12_spend_variation_p90d.sql` — (Phase 1a) CV, p10/p50/p90 of daily spend per platform and per campaign; **no revenue columns**
  - `13_spend_level_shifts.sql` — (Phase 1a) sustained level shifts in daily spend as candidate deliberate budget moves (Tier 2 inputs)
  - `14_history_depth.sql` — (Phase 1a) usable days per candidate since 2024-01-01, gaps, quality flags
  - `15_roas_by_spend_bin.sql` — (Phase 1b, after registration) ROAS binned by spend level within campaign, controlling for day-of-week

### 3. Documents
- `docs/Paid Media Full Funnel.pdf` (Confluence export, Michael Dey, v25, updated 2026-02-03). Text extraction works via `pypdf` with `PYTHONIOENCODING=utf-8` (the default `pdftoppm` path is unavailable on this machine).
- Source page: redventures.atlassian.net DEBR space, "Paid Media Full Funnel" (id 101921620118) — check for newer versions via Atlassian MCP during Phase 0.

### 4. Web research (best practices)
- Media mix modeling: Meta Robyn, Google Meridian — saturation (Hill) curves from observational data
- Marginal ROAS / next-best-dollar allocation under diminishing returns
- Endogeneity handling without randomized experiments
- Budget pacing and constraint handling in production allocators

### 5. Communications context
- Slack channels (verified): `#br-paidmedia-performance-collaboration` (private, C0A1YF9BWJU, created by Arland Crandell 2025-12-02), `#bankrate-paid-media-ds-bi-connect` (C0AFJQP0JNN, created by Andy Cisler 2026-02-17)
- People (verified): Andy Cisler (U7YP43SS2), Arland Crandell (U07PS5ALQSG), Rita Harrobin (U05A63J03SN, Media Buyer)
- Outlook: search via Microsoft 365 MCP for budget changelog / allocator threads with the above
- Prior Claude sessions: transcripts under `~/.claude/projects/C--Users-ecase-CascadeProjects-*` — `budget-allocator` primarily; `MTA`, `MetaQualityScore`, `RapidExperiment` likely adjacent

## Phases

### Phase 0 — Context sweep (parallel agents, ~1 session combined with Phase 1)
- Agent A: repo + prior-transcript synthesis ("what did earlier Claudes conclude and why")
- Agent B: Slack + Outlook mining scoped to the channels/people above (search terms: budget changelog, allocator, next best dollar, response curve, reallocation)
- Agent C: web research per stream 4
- Output: `docs/recommender_feasibility_context.md`

### Phase 1 — Data feasibility (gate)
- **1a (exploratory)**: run queries 12–14 (spend distributions, level shifts, history depth — no revenue)
- **Register**: revise the heuristic thresholds into binding criteria; update this doc
- **1b (confirmatory)**: run query 15 once against the registered criteria; if Tier 1 passes, run the Tier 2 level-shift robustness check
- Output: results section appended to the context doc
- **Gate**: KILL → skip to Phase 3. PASS → Phase 2. Strong pass (outcome A) additionally requires the endogeneity mitigation gate to clear.

### Phase 2 — Candidate designs (only on pass)
Sized to what Phase 1 found; sketch 2–3 of:
- Observational response-curve model feeding a marginal-dollar ranker
- LLM wrapper over the existing FF ranker that suggests next-best-dollar moves with rationale and confidence
- Hybrid: ship suggestions + adoption logging, bootstrapping the budget changelog

### Phase 3 — Decision memo
- `docs/recommender_feasibility.md`, same structure as `meta_taboola_feasibility.md`: question, queries, evidence tables, conclusion
- Maps to one of the outcomes below

## Possible outcomes

- **A. Strong pass**: spend variation supports curve estimation → testable next-best-dollar recommender now
- **B. Weak pass**: variation exists but confounded → LLM-wrapper recommender with logged suggestions; prospective validation
- **C. Bootstrap**: ship a recommender that logs its own suggestions and adoptions → generates the budget changelog within ~90 days, dissolving the chicken-and-egg
- **D. Kill confirmed**: data cannot support curves → original assessment stands; memo documents exactly why, with numbers

## Timebox

One focused session for Phases 0–1 (the gate). Phase 2–3 only if warranted, in a follow-up session.
