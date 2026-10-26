# Budget Recommender Feasibility — Decision Memo

**Run Date**: 2026-06-10
**Question**: Was a budget changelog ever a hard prerequisite for a "next best dollar" budget recommender, or can the response curves it was meant to enable be estimated from the realized-spend history we already have?
**Plan**: `docs/recommender_feasibility_plan.md` (thresholds registered before confirmatory analysis)
**Context & full results**: `docs/recommender_feasibility_context.md`
**SQL**: `sql/15_spend_variation_p90d.sql`, `sql/16_spend_level_shifts.sql`, `sql/17_history_depth.sql`, `sql/18_roas_by_spend_bin.sql`, `sql/19_tier2_levelshift_eventstudy.sql`, `sql/20_lagged_spend_iv_firststage.sql`, `sql/21_suggestion_log_ddl.sql` (proposed, not executed)
**Prototype**: `recommender.py` (hardened 2026-06-11, see `docs/recommender_hardening.md`; formerly `recommender_prototype.py`) → `docs/recommender_prototype_output.csv`
**Data**: `bankrate_prod.br_rpt.paid_media_ff_campaign_daily`, `vertical = 'deposits'`

---

## TL;DR

**The changelog was a means, not a prerequisite. Verdict: PASS, at the A/B boundary.** Realized daily spend in `paid_media_ff_campaign_daily` carries enough variation, history, and deliberate-move structure to estimate usable diminishing-returns response curves **for the mature Google and Microsoft search campaigns** — and to build a testable next-best-dollar recommender for them now. A working implementation (`recommender.py`, production-hardened 2026-06-11) already does this; an instrumental-variable check confirms the diminishing-returns slope survives instrumenting for the search core (the endogeneity bias is small there, large only in the already-flagged Meta/whale units). **Meta and Taboola are a weak pass** (variation is confounded — their naive curves slope *up*), so they get logged suggestions and prospective validation, not fitted curves. Because no formal budget changelog is coming, the recommender should **log its own suggestions and adoptions**, bootstrapping the changelog the original assessment wanted (outcome C as the delivery wrapper).

The original 2026-01 assessment (`ff_ranker_methodology.md`) listed a budget changelog as prerequisite #1 for response curves. This analysis shows the changelog's real job — telling deliberate budget moves apart from delivery noise — can be approximated from the realized series itself for the platforms that matter most for spend.

---

## Method (two-tier, pre-registered)

To avoid motivated reasoning, thresholds were locked **after** looking only at the spend predictor and **before** any ROAS-vs-spend query (explore-then-register; see plan doc).

- **Phase 1a (exploratory, spend only)**: distribution, level shifts, history depth — no revenue.
- **Tier 1 (confirmatory)**: does ROAS show diminishing returns across within-unit spend quintiles, surviving day-of-week control?
- **Tier 2 (robustness)**: do *deliberate* sustained spend shifts move ROAS the way diminishing returns predict (spend up → ROAS down)? Guards against fitting delivery noise / endogeneity.

---

## Evidence

### 1. Spend variation is ample (Phase 1a, `sql/15`)

| Platform | mean $/day | CV | p90/p10 | active/cal days (90d) |
|---|---|---|---|---|
| Google | 38,399 | 0.32 | 2.0 | 90/90 |
| Microsoft | 4,793 | 0.41 | 2.8 | 90/90 |
| Meta | 740 | 0.53 | 4.7 | 90/90 |
| Taboola | 3,082 | 0.70 | 8.0 | 90/90 |

All four platforms clear CV>0.3 and p90/p10≥2; 10 of 53 campaigns clear the campaign heuristic (≥5 required).

### 2. History depth is the real constraint (Phase 1a, `sql/17`)

| Platform | usable months (≥20 active days) | max spend gap | curve-ready? |
|---|---|---|---|
| Google | 29 | 1 day | Yes |
| Microsoft | 29 | 1 day | Yes |
| Meta | 12 | **134 days** | Marginal |
| Taboola | 6 | 1 day | No (too short) |

Four campaigns carry 25–29 usable months (Google `20455602196`, `20455602199`; Microsoft `506073492`, `506118191`); most others churn. **Per-campaign curves are viable only for the deep evergreen search campaigns; broad per-campaign fitting is not.**

### 3. Diminishing returns are real where history is deep (Tier 1, `sql/18`)

Six depth-reliable units pass the registered test (ROAS declines in ≥3 of 4 spend quintiles, q5<q1) **and survive day-of-week control**:

| Unit | q1 ROAS → q5 ROAS | DoW-controlled |
|---|---|---|
| Google (platform) | 1.50 → 1.01 | PASS |
| Google CD: Automated Bidding (`20455602199`) | 2.22 → 1.08 | PASS |
| Google SMMA: Automated Bidding (`20455602196`) | 1.71 → 1.07 | PASS |
| Microsoft CD: Automated Bidding (`506118191`) | 2.93 → 1.28 | PASS |
| Microsoft Product Agnostic (`506073492`) | 2.36 → 1.76 | PASS |
| Google SMMA: Whale Campaign (`22171883742`) | 1.12 → 0.82 | PASS |

**Endogeneity counter-signal (the reason this isn't an unambiguous A):** at the *platform aggregate*, Meta ROAS *rises* with spend (0.92 → 1.48) and Microsoft is non-monotone. Upward naive curves are the classic "spend chases performance" / mix-shift signature. Diminishing returns are trustworthy **within mature search campaigns**, not at the Meta/Taboola aggregate, and curves must not be extrapolated past observed spend ([Meridian saturation docs](https://developers.google.com/meridian/docs/advanced-modeling/media-saturation-lagging)).

### 4. Deliberate moves confirm the sign for the search core (Tier 2, `sql/19`)

Spend-up→ROAS-down (and vice versa) agreement across 215 deliberate level-shift events:

| Scope | agreement |
|---|---|
| Overall | 65.6% (141/215) |
| Google CD `20455602199` | 0.81 |
| Microsoft CD `506118191` | 0.87 |
| Google SMMA `20455602196` | 0.90 |
| Microsoft SMMA `506118190` | 0.74 |
| Microsoft Product Agnostic `506073492` | 0.59 |
| Google Whale `22171883742` | 0.53 |
| **Meta `adv_BR-Deposits_p2`** | **0.17 (disagrees)** |

The mature search campaigns agree strongly; Meta corroborates its upward curve by disagreeing. ~⅓ of moves overall don't agree (lagged revenue, non-stationarity, residual performance-chasing) — real, but not disqualifying for the core.

### 5. Endogeneity holds up under instrumenting (IV, `sql/20` + `recommender_prototype.py`)

Lagged spend is a **strong instrument** for current spend (budget persistence): first-stage F (lag7, day-of-week removed) is 30–2,100 across all A-core units (lag1 F in the hundreds–thousands). Weak-instrument concern is not binding.

2SLS sanity check on the semilog slope (revenue ~ β·ln spend), OLS vs IV-instrumented:

| A-core unit | β OLS | β IV | IV/OLS |
|---|---|---|---|
| Microsoft Product Agnostic | 533 | 542 | 1.02 |
| Microsoft SMMA Auto Bid (`506118190`) | 5,869 | 5,871 | 1.00 |
| Microsoft (platform) | 12,720 | 13,246 | 1.04 |
| Microsoft CD (`506118191`) | 3,627 | 3,794 | 1.05 |
| Google CD (`20455602199`) | 3,018 | 3,519 | 1.17 |
| Google (platform) | 26,228 | 32,025 | 1.22 |

For the search core the diminishing-returns slope **survives instrumenting** (IV/OLS ≈ 1.0–1.2; OLS was not materially inflated by performance-chasing). The units where IV explodes — Google whale `20455602196` (2.2, weakest F=30), Meta `p2` (3.7, F=15) — are exactly the ones already flagged as unreliable. The IV independently reproduces the A/B split. Remaining caveat: instrument *validity* (exclusion) assumes lagged spend touches today's revenue only via today's spend; adstock/carryover can violate this, which only a holdout fully settles.

---

## Conclusion — maps to outcomes A + B + C

| Segment | Outcome | Why | What to build |
|---|---|---|---|
| Google + Microsoft **search** core (4 mature "automated bidding" campaigns + Google platform) | **A — strong pass** | Tier 1 + DoW + Tier 2 all align; 25–29 mo history | Observational response-curve model → marginal-dollar ranker, scoped to observed spend ranges |
| Meta, Taboola | **B — weak pass** | Upward/confounded curves, thin or gapped history | LLM-wrapper recommender that proposes moves with rationale + confidence; validate prospectively before trusting |
| All | **C — bootstrap** | No changelog coming (confirmed) | Log every suggestion + whether it was adopted → generates the budget changelog within ~90 days |

**Outcome D (kill) is rejected**: ≥3 depth-reliable units show interpretable, DoW-robust, Tier-2-corroborated diminishing returns. The original budget-changelog-as-prerequisite framing does not hold for the platforms carrying most spend.

---

## Phase 2 — candidate designs (sketches, sized to the findings)

**Design 1 — Observational response-curve ranker (the outcome-A core). [BUILT — hardened 2026-06-11, see `docs/recommender_hardening.md`]**
Fit a saturating curve (negative-exponential `rev = a·(1−exp(−cost/k))`) per mature Google/Microsoft search unit on trailing daily cost→revenue; compute marginal revenue/$ = dR/dx at current spend; recommend shifting the next dollar to the highest-marginal unit, bounded to observed spend ranges (no extrapolation) and to ±X% per step (pacing). Slots into the existing `sql/07` rank-based allocator — swap its static ROAS signal for marginal ROAS.

Built, hardened, and run (`recommender.py`, output `docs/recommender_prototype_output.csv`). Hardening (2026-06-11): DoW×month deseasonalization, penalized fits with soft priors + AICc model selection, gap-aware block-bootstrap CIs, CI-gated actions, ±15% pacing bounds, and a walk-forward backtest gate. After hardening, the decisive moves are **ADD Microsoft Product Agnostic (marginal ROAS 1.78, 90% CI 1.68–1.84, backtest window bias +0.9%) and TRIM Google platform (0.75, CI 0.69–0.82)** — the next deposits dollar moves from Google toward Microsoft search, now with uncertainty and out-of-sample evidence behind it. The backtest also exposed systematic positive level bias on most units (recent ROAS regime below the 23-month average — non-stationarity), which the gate correctly converts to HOLDs. Full results in `docs/recommender_hardening.md`. This is the exact "next best dollar" capability the changelog was thought to be a prerequisite for, produced from realized spend alone.

**Design 2 — LLM wrapper over the FF ranker (the outcome-B bridge, covers Meta/Taboola).**
Feed the existing FF ranker outputs + spend levels + curve estimates (where they exist) to an LLM that proposes next-best-dollar moves with written rationale and a confidence flag (high where a fitted curve exists, low where it's extrapolation/Meta/Taboola). Cheap to ship, honest about uncertainty, works before curves are trustworthy everywhere.

**Design 3 — Hybrid + adoption logging (the outcome-C wrapper; recommended spine).**
Either of the above, plus a log table recording each suggestion (unit, current spend, recommended delta, predicted marginal ROAS, confidence) and whether the media buyer adopted it and the realized result. Within ~90 days this is the budget changelog — and the prospective validation set that upgrades Meta/Taboola from B to A and converts DoW identification into adoption-based quasi-experiments.

**Recommendation:** ship Design 1 for the Google/Microsoft search core, wrapped in Design 3 logging from day one, with Design 2 covering Meta/Taboola at low confidence. There is organizational pull for this — the Budget Allocator is already deployed in dev (Slack, 2026-04-22) and the team is actively exploring MMM after an Energy-team MMM showed 4x paid attribution (Slack, 2026-04-30).

---

## Validation agenda (to move the core from "testable" to "trusted")

1. **Lagged-spend IV** — DONE (`sql/20`, `recommender.py`). First-stage F 30–2,100 (strong); 2SLS slope survives for the search core (IV/OLS ≈ 1.0–1.2). Open sub-item: exclusion validity vs adstock — needs a holdout to fully settle.
2. **Seasonality control** beyond day-of-week — DONE (2026-06-11): multiplicative DoW×month deseasonalization in the hardened fit, plus a walk-forward backtest. The backtest surfaced residual non-stationarity (positive level bias on recent windows), gated via `HOLD (backtest warn)`.
3. **Prospective adoption test** via Design 3 logs (`sql/21`) — the cleanest path, and it doubles as the changelog.
4. **Geo / incrementality holdout** as the eventual gold-standard calibration ([bias correction for paid search in MMM](https://towardsdatascience.com/bias-correction-for-paid-search-in-media-mix-modeling-paper-review-d3579cfaee9b)).

## Limitations

- Revenue is `total_actual_revenue` (FF proxy); Meta/Taboola post-lead outcomes remain unreliable (`meta_taboola_feasibility.md`), an independent reason to keep them at outcome B.
- Tier 2's weekly-aggregation changepoint proxy is a screen, not a formal CPD; overlapping events within 14 days can contaminate (reported, not corrected).
- Curves are valid only inside observed spend ranges; the recommender must refuse to extrapolate.
