# Budget Recommender Feasibility — Context & Phase 1a Results

**Created**: 2026-06-10
**Companion to**: `docs/recommender_feasibility_plan.md`
**Status**: Phase 0 complete (recovered from main session); Phase 1a + 1b complete; thresholds registered; gate = PASS (A/B boundary). See decision memo `docs/recommender_feasibility.md`.

---

## Phase 0 — Context sweep

Three parallel research agents were run. Two streams were blocked by tool-permission denials in the sub-agent sandbox (sub-agents cannot trigger interactive permission prompts). Recoverable from the main session; see "Open items".

### 0A. Repo synthesis (complete)

**Two allocator pipelines exist side by side:**

- **SEM (legacy)** — `sql/06_allocator_inputs_rollup.sql` + `sql/07_naive_allocator_suggestion.sql`. Source `agg_daily_v2` + `clicksanalytics_v2`. Google + Bing only (no Meta/Taboola). Computes `expected_revenue_per_dollar = (rtctr_paid_7d * rpc_paid_7d) / cpc_7d`, floors at 0.10, allocates proportional weights among platforms with `clicks_7d >= 1000`. **Static point-in-time efficiency ratio — no diminishing returns, no budget-level awareness.**
- **FF ranker** — `sql/10_ff_ranker_inputs_p28d.sql` + `sql/11_ff_ranker_suggestion.sql`. Source `paid_media_ff_campaign_daily` (all 4 platforms). ROAS over 7/14/28d, ranked with volume guardrails (platform `clicks_7d>=500`, campaign `>=100`) and DQ flags. **Ranks who is best; does not say how much to shift.**

**The original budget-changelog argument** (`docs/ff_ranker_methodology.md`, "Future: ROAS/CPOA-by-Budget Modeling", 2026-01-28): to answer "how to reallocate $X" you need response curves; to fit response curves you need variation in *budget settings*; to know which variation was *deliberate* (budget decisions vs auction/pacing mechanics) you need a changelog of intended budget. The `cost` column is *realized* spend, not intended budget — so naive day-to-day variation mixes budget decisions with delivery noise. This is precisely what Tier 1 (does realized variation substitute?) and Tier 2 (do deliberate level-shifts agree with the Tier-1 curve?) are designed to test.

**Meta/Taboola caveat** (`docs/meta_taboola_feasibility.md`): post-lead match rates 0.047% (Meta) / 0.216% (Taboola) → those platforms use `total_actual_revenue` as a revenue proxy, not funded outcomes.

### 0C. Web best-practices research (draft — live citations pending; WebSearch/WebFetch were blocked for the sub-agent)

Synthesis below is from model knowledge (to be verified against live docs):

- **Functional form**: Robyn and Meridian both use a **Hill saturation** transform (`x^α / (x^α + K^α)`), Robyn applying adstock (carryover) first. Negative-exponential is the simpler legacy alternative; Hill is the current standard.
- **Data needs**: ~2 years (≈104 weekly obs) recommended; daily acceptable. **Curve identification requires meaningful spend-range variation** within each unit — units that ran at near-constant spend yield prior-dominated (unreliable) curves. Both tools fit via Bayesian estimation with informative priors as the main guard against under-identification.
- **Allocation rule**: once curves exist, **equalize marginal revenue per dollar across units** (Lagrangian/KKT), shifting dollars from low to high `dR/dx`. Pitfalls: extrapolating beyond observed spend ranges; correlated channels; flat marginal surface near optimum → unstable allocations (Robyn returns a Pareto frontier rather than a point).
- **Endogeneity (the gate)**: teams raise spend when performance is good → naive curves look *flatter* and underestimate saturation. Mitigations feasible **without experiments** on our 29-month daily data:
  - **Lagged-spend IV** (spend[t-1]/[t-7] instruments spend[t]; valid if budget persistence is a budget decision, not algorithmic delivery). First-stage F>10 is the usual bar.
  - **Within-unit day-of-week variation** + DoW fixed effects (auction/pacing varies within week while budgets often don't).
  - **Changepoint / event-study around deliberate level-shifts** (Tier 2) — cleaner if shifts are genuine budget decisions.
  - **Geo holdouts** — gold standard but require future setup; not retrospective.
  - Implication: lagged-spend IV + DoW FE are the minimum credible mitigation available now; if the IV first stage is weak (spend not autocorrelated → erratic algorithmic delivery), the ceiling is outcome B.
- **Constraints/pacing**: solved infrastructure (min/max as fraction of current spend, greedy marginal-ROAS fill). Not a research question; `sql/07` already does rank-based allocation — the only change is swapping its static ROAS signal for marginal ROAS from a fitted curve.

### 0B. Slack + Outlook (recovered from main session)

Slack `#br-paidmedia-performance-collaboration` (Apr–Jun 2026), highly relevant:
- **The Budget Allocator is already live in dev** — Erik Case, 2026-04-22: "I have a working dev copy of the updated Budget Allocator deployed," Rita Harrobin sanity-checking ([link](https://redventures.enterprise.slack.com/archives/C0A1YF9BWJU/p1776880280599579)). A recommender extension has a home and a reviewer.
- **Organizational appetite for MMM exists.** Rita Harrobin, 2026-04-30, relaying an Energy-team MMM conversation: "MMM revealed 4x the revenue attributable to paid than what was previously showing… explore MMM as a way to measure similar impact on Bankrate" ([link](https://redventures.enterprise.slack.com/archives/C0A1YF9BWJU/p1777582722708889)). Response curves *are* MMM — there is an internal precedent (Energy team) and stated interest.
- Active adjacent work: last-paid-touch passback, Meta step-level quality scoring (Steven Sosa), server-side near-real-time conversion uploads. The team is maturing measurement, not budget-decision logging.
- **No mention of a budget changelog being built** — consistent with the user's confirmation that one is not coming.
- Outlook search ("budget allocator MMM media mix response curve reallocation") returned no matches; the live discussion is in Slack.

### 0A. Prior transcripts (recovered)
Grep of `~/.claude/projects/*` shows the budget-changelog / response-curve / endogeneity language originates in the older `budget-allocator` session (`ba669d5c…`) that authored `ff_ranker_methodology.md` and this feasibility plan; `MTA`, `MetaQualityScore`, `SelfReview` sessions touch adjacent attribution/quality-score work, not the allocator response-curve question. No prior conclusion contradicts this study; provenance only.

### 0C. Web citations (recovered)
- Hill saturation + diminishing returns are the standard in both Meta Robyn and Google Meridian; saturation is applied on adstocked spend ([Meridian: media saturation & lagging](https://developers.google.com/meridian/docs/advanced-modeling/media-saturation-lagging); [Robyn intro, arXiv 2403.14674](https://arxiv.org/pdf/2403.14674); [Search Engine Land MMM tools](https://searchengineland.com/mmm-tools-explained-467284)).
- Curves are identified from the **observed spend range** and "should be interpreted with caution when extrapolated" — matches our finding that thin/constant-spend units give unreliable curves.
- Endogeneity is the central observational-MMM threat; documented mitigations: instrumental variables, causal/backdoor adjustment, informative priors, and (gold standard) incrementality experiments folded in as calibration ([Bias correction for paid search in MMM (Google, US10445388 / TDS review)](https://towardsdatascience.com/bias-correction-for-paid-search-in-media-mix-modeling-paper-review-d3579cfaee9b); [Endogeneity and the MMM](https://market.science/causal-attribution-and-the-marketing-mix-model/)). Confirms the plan's gate and points to geo/incrementality tests as the eventual upgrade path beyond DoW/IV.

---

## Phase 1a — Spend feasibility (exploratory, predictor only; NO revenue)

SQL: `sql/15_spend_variation_p90d.sql`, `sql/16_spend_level_shifts.sql`, `sql/17_history_depth.sql`. Run 2026-06-10. Scope `vertical = 'deposits'`, matching the FF ranker.
(SQL renumbered 15–18; the plan's "12–15" collide with existing `12_–14_` vertical-discovery files.)

### Variation — daily spend, trailing 90d (query 15)

| Platform | active/cal days | mean $/day | CV | p10 | p50 | p90 | p90/p10 |
|---|---|---|---|---|---|---|---|
| Google | 90/90 | 38,399 | 0.316 | 24,266 | 40,778 | 48,712 | 2.01 |
| Microsoft | 90/90 | 4,793 | 0.407 | 2,828 | 4,069 | 8,035 | 2.84 |
| Meta | 90/90 | 740 | 0.526 | 266 | 722 | 1,245 | 4.68 |
| Taboola | 90/90 | 3,082 | 0.695 | 893 | 2,343 | 7,133 | 7.98 |

All four platforms clear CV>0.3 and p90/p10>=2. Campaign-level: **53 campaigns** in window; **13** have ≥60 active days; **10** also clear CV>0.3 **and** p90/p10≥2 (heuristic asked for ≥5).

### History depth — since 2024-01-01 (query 17)

| Platform | first | active days | pct active | usable months (≥20 active days) | max gap (days) |
|---|---|---|---|---|---|
| Google | 2024-01-01 | 891 | 1.00 | **29** | 1 |
| Microsoft | 2024-01-04 | 888 | 1.00 | **29** | 1 |
| Meta | 2025-01-21 | 368 | 0.73 | 12 | **134** |
| Taboola | 2025-11-12 | 210 | 1.00 | 6 | 1 |
| YahooDSP | 2025-07-21 | 11 | 0.46 | 0 | — (test only; ignore) |

Deepest campaigns (≥25 usable months): Google `20455602196` SMMA: Automated Bidding (890 active days, 29 mo); Microsoft `506073492` Product Agnostic (886, 29); Google `20455602199` CD: Automated Bidding (836, 26); Microsoft `506118191` CD: Automated Bidding (815, 25). These plus a second tier (Meta `..2700043` adv_BR-Deposits_p1 ~216 active days/6 usable mo; several Taboola WL campaigns 4–5 usable mo) are the curve-fit candidates. Most other campaigns are short-lived (churn); `campaign_key` is stable across name changes (e.g., MSFT `506118190` renamed Nov 2025).

### Level shifts — weekly, trailing 365d (query 16)

Sustained week-over-week level shifts (≥1.5x up / ≤0.667x down between consecutive ≥4-active-day weeks) are common. The deep evergreen campaigns show **clean, sustained, multi-week monotone moves** that read as deliberate budget decisions — e.g. Google `20455602196`: Dec-2025 ramp-down 33.2k→7.8k→4.6k, then Feb–Mar-2026 ramp-up 7.5k→16.7k→35.8k. Platform weekly totals show clear seasonal/decision structure (Google + Microsoft pull back in Dec-2025 then ramp Q1-2026; Taboola scales from ~$1k/wk Nov-2025 to ~$50k/wk Feb–Mar-2026; Meta ramps Oct–Dec then declines Apr–May-2026). Alongside these are many one-week oscillations in low-spend campaigns (delivery noise). **Both signal and noise are present — the core reason Tier 2 exists.**

### Phase 1a read

1. **Variation: PASS.** Strong, well above heuristic at platform level (all 4) and for ~10 campaigns.
2. **Depth: PASS for Google + Microsoft (29 usable mo), MODERATE for Meta (12 mo + a 134-day hole), THIN for Taboola (6 mo).** Per-campaign curve fitting is only viable for ~4–6 evergreen campaigns; broad per-campaign curves are not (churn). Platform grain is the robust target; Google/Microsoft are the deep anchors.
3. **Level shifts: PRESENT and partly deliberate-looking.** Sustained moves in evergreen campaigns give real Tier 2 event-study material; this is an early positive sign that a credible endogeneity mitigation exists.
4. **Confounders flagged before registration**: (a) seasonality — Dec spend pullback coincides with seasonally low deposits demand, so time controls are mandatory; (b) realized-vs-intended — weekly oscillation in thin campaigns is likely delivery noise, so Tier 1 must lean on units with depth.

---

## Registered thresholds (LOCKED 2026-06-10, user-confirmed — see plan doc for binding copy)

Locked before any ROAS-vs-spend query was run (explore-then-register protocol).

**Candidate inclusion (which units get a Phase 1b curve attempt):**
- Platform grain: ≥12 usable months AND 90d CV ≥0.3. → Google, Microsoft (clear); Meta (borderline — 12 mo but 134-day gap, fit on contiguous post-gap span only); Taboola (excluded on depth, revisit later).
- Campaign grain: ≥12 usable months AND ≥200 active days AND 90d CV ≥0.3. → the 4 deep evergreen campaigns above.

**Tier 1 PASS:** ≥3 candidate units show a diminishing-returns ROAS-vs-spend pattern in spend-quintile bins — operationalized as: marginal revenue/$ (Δrev/Δspend between adjacent quintiles) non-increasing in ≥3 of 4 steps, AND top-quintile mean ROAS < bottom-quintile mean ROAS — and the pattern survives day-of-week control.

**Strong pass (outcome A)** additionally requires the **endogeneity gate**: a credible mitigation demonstrated (lagged-spend IV first-stage F>10, and/or DoW within-unit identification) AND Tier 2 agreement (changepoint event-study sign matches Tier 1 for a majority of testable evergreen campaigns).

**KILL:** <3 candidates show interpretable diminishing returns, OR patterns vanish/invert under DoW control, OR Tier 1 and Tier 2 directionally disagree for most candidates.

---

## Phase 1b — Confirmatory results (run once, against registered thresholds)

SQL: `sql/18_roas_by_spend_bin.sql` (Tier 1), `sql/19_tier2_levelshift_eventstudy.sql` (Tier 2). Run 2026-06-10.

### Tier 1 — ROAS by within-unit spend quintile (diminishing returns)

Per-unit pass test = ROAS declines in ≥3 of 4 quintile steps AND q5 ROAS < q1 ROAS, **and survives day-of-week control**. Depth-reliable units (≥12 usable mo; campaigns ≥200 active days) passing BOTH raw and DoW-controlled:

| Unit | q1 ROAS | q5 ROAS | declining steps (raw) | DoW-controlled |
|---|---|---|---|---|
| PLATFORM Google | 1.50 | 1.01 | 4/4 | PASS |
| Google CD: Automated Bidding (`20455602199`) | 2.22 | 1.08 | 4/4 | PASS |
| Google SMMA: Automated Bidding (`20455602196`) | 1.71 | 1.07 | 3/4 | PASS |
| Google SMMA: Whale Campaign (`22171883742`) | 1.12 | 0.82 | 3/4 | PASS |
| Microsoft CD: Automated Bidding (`506118191`) | 2.93 | 1.28 | 4/4 | PASS |
| Microsoft Product Agnostic (`506073492`) | 2.36 | 1.76 | 3/4 | PASS |

**6 depth-reliable units pass (≥3 required) → Tier 1 PASS.** Many thinner campaigns also pass, reinforcing.

**Key counter-signal (endogeneity):** at the **platform aggregate**, Meta ROAS *rises* with spend (q1 0.92 → q5 1.48; 0 declining steps) and Microsoft is non-monotone (1.87→1.44→1.48→1.72→1.73). Upward-sloping naive curves are the textbook endogeneity/mix-shift signature — money chasing good performance, or scaling by adding high-ROAS campaigns. The clean diminishing returns live **within mature search campaigns**, not at the Meta/Taboola aggregate. Curve fitting must be scoped accordingly and must not be extrapolated beyond observed spend ranges.

### Tier 2 — deliberate level-shift event study (endogeneity robustness)

For each sustained week-over-week shift in an eligible campaign, compare ROAS in the 14 active days before vs after; "agrees" = spend UP→ROAS down or spend DOWN→ROAS up (diminishing-returns sign).

- **Overall: 141/215 events agree = 65.6%** (up-moves 64.7%, down-moves 66.4% — symmetric, so not an artifact of one direction).
- Mature Google/Microsoft search "automated bidding" campaigns agree strongly: Google `20455602199` **0.81**, Microsoft `506118191` **0.87**, Google `20455602196` **0.90**, Microsoft `506118190` **0.74**.
- Weak/coin-flip: Google whale `22171883742` 0.53 (volatile, sub-$1 ROAS), Microsoft catch-all `506073492` 0.59.
- **Meta `adv_BR-Deposits_p2` actively disagrees (0.17)** — corroborates Meta's upward platform curve. Meta/Taboola are not curve-ready.

Majority of testable evergreen campaigns agree (4–5 of 6, three strongly >0.8) → **Tier 2 agreement satisfied for the Google/Microsoft search core.**

## GATE OUTCOME: PASS — at the A/B boundary

- **Strong pass (A) for the Google/Microsoft search core** (the 4 mature "automated bidding" campaigns + Google platform): diminishing returns are present (Tier 1), survive day-of-week identification, and agree with deliberate-move event studies (Tier 2). Endogeneity gate cleared via DoW within-unit ID + Tier 2 majority agreement (the registered "and/or"). Enough to build and *test* a marginal-dollar recommender now — scoped to these units and not extrapolated.
- **Weak pass (B) for Meta + Taboola**: variation exists but is confounded (upward platform curves, Meta p2 reversal, thin Taboola history). Use a logged-suggestion / prospective-validation approach, not a fitted curve, here.
- **Caveats keeping this off "unambiguous A":** no formal lagged-spend IV first-stage was estimated (DoW ID is a weaker instrument); Tier 2 at 65% overall leaves ~⅓ of moves inconsistent (lagged revenue, non-stationarity, or residual performance-chasing); seasonality (Dec demand trough) remains a lower-frequency confound DoW control does not remove. These set the validation agenda, not a blocker.
- **Changelog not coming → outcome C is the delivery wrapper**, not a stopgap: ship suggestions + log adoptions to generate the budget changelog the original assessment wanted.
