# Autonomous Analysis Agent Framework: Set-and-Forget Eval for Structured Data Synthesis

**Created**: 2026-06-11
**Status**: Framework extracted from budget-allocator feasibility study and MTA attribution agent
**Audience**: Data science and analytics teams building recurring, automated insights

## Overview

This guide describes a reusable framework for building agents that synthesize structured data into insights, hypotheses, and reports — and then run those agents autonomously on a schedule with quality gates.

**The problem it solves:**
- Manual analysis tasks that repeat weekly (attribution reports, budget recommendations, feasibility studies)
- Eval that actually catches hallucinations AND poor reasoning (hybrid approach, not just "does the LLM judge like it?")
- Autonomous operation without human checkpoints, but with auditable decisions
- Self-improvement: each run's eval score feeds the next iteration

**The solution:**
Four composable skills that cover the full loop:
1. **Agent Scaffold** — design the agent mission, guardrails, and decision log
2. **Hybrid Report Eval** — score output quality with deterministic checks + LLM judge
3. **Scheduled Agent Harness** — run the agent on a cron, track regression, alert on drift
4. **Iteration Loop Controller** — bounded prompt variation gated on eval score

**Proof it works:**
- Budget recommender feasibility study (pre-registered thresholds, autonomous gate, weekly runs possible)
- MTA attribution agent (scored hypotheses, eval harness, iterative prompt improvement)

---

## Core principles

### 1. The LLM never makes up numbers

All metrics, rankings, confidence scores, and thresholds come from SQL, Python, or domain logic. The endpoint's job is **narrative synthesis** (writing prose around numbers) and **hypothesis text generation** (translating signals into business-language claims). If you need a number, query it. If you need prose about that number, use the LLM.

### 2. Eval must catch both hallucination and poor reasoning

**Deterministic checks** catch hallucinations: does the report have the right schema? Do the numbers in the report match the SQL output within tolerance? Does each scored hypothesis actually have the signal it claims?

**LLM-as-judge** catches reasoning failures: "Is this summary grounded in the numbers below? Does it make claims unsupported by the data?" Use a different model (e.g., Haiku) as the judge so the evaluator and creator are independent.

### 3. Autonomy requires auditable decisions

Every judgment call the agent makes goes into `DECISIONS.md` with rationale and a confidence tag (HIGH/LOW). LOW-confidence decisions get escalated ("needs human review") rather than silently executed. Visible diffs only — no silent rewrites to instructions.

### 4. Iteration is gated on eval, not vibes

You can change the system prompt or agent logic, but only keep changes that:
- Pass all deterministic checks (non-negotiable)
- Improve the eval score (or at worst, plateau)
- Don't regress any individual test case beyond tolerance

---

## The four skills (detailed)

### Skill 1: Agent Scaffold

**Purpose:** Design the agent mission, guardrails, and decision log before writing code.

**Input:**
- Task description (e.g., "build an agent that generates weekly attribution reports + testable hypotheses")
- Data sources and access rules (e.g., read-only Databricks, no writes)
- Output format (e.g., markdown reports in docs/reports/)
- Success criteria (e.g., "report includes hypothesis table with signal_type, magnitude, confidence")

**Output:**
- `AGENTS.md` — agent rules and constraints
- Numbered phases (0–6) with explicit exit rules per phase
- `DECISIONS.md` template for recording judgment calls
- `STATUS.md` shell defining what "done" looks like
- Mission prompt boilerplate (the human fills in details, Claude follows it)

**Why it matters:**
Running an agent autonomously is only safe if the guardrails are written down first. AGENTS.md is the agent's constitution. Numbered phases with exit rules prevent stalling — the agent knows what "pass" and "skip" mean for every step.

**Example from this project:**
- Budget allocator: `docs/recommender_feasibility_plan.md` (the plan) + `AGENTS.md` (the rails)
- MTA agent: `docs/agent_mission_prompt.md` (phases 0–6) + AGENTS.md (read-only, 200-call cap, visible diffs)

---

### Skill 2: Hybrid Report Eval

**Purpose:** Score report quality using both objective checks and a different model's judgment.

**Input:**
- Report schema (required sections, fields, structure)
- List of claims made in the report (extracted by you or the agent)
- Ground-truth SQL or data source for each claim
- Tolerance bands (e.g., numeric comparisons within ±5%)

**Output:**
- Deterministic test suite:
  - Schema check: does the report have all required fields?
  - Number-match check: do reported values match ground truth within tolerance?
  - Logic check: does each scored hypothesis have the signal it claims?
  - Consistency check: no contradictions across sections
- LLM-judge prompts and scoring (using a different model, e.g. Haiku)
- `eval/run_eval.py` — runner that executes all checks, writes results
- `eval/results/<timestamp>.json` — per-check pass/fail, aggregate score, token spend

**Why it matters:**
LLM judges alone are biased toward the output they're judging. Deterministic checks catch hallucinations; LLM judges catch reasoning gaps. Together they're much stronger than either alone.

**Example from this project:**
- MTA agent eval: deterministic checks (report schema, number-match tolerance, hypothesis fields all populated) + Haiku grounding judge ("Is the executive summary supported by the numbers?")

---

### Skill 3: Scheduled Agent Harness

**Purpose:** Run the agent autonomously on a schedule and track quality regression.

**Input:**
- Agent entrypoint (CLI or Python module)
- Eval runner (from Skill 2)
- Report output directory
- Schedule (cron expression, e.g. `0 9 * * 1` for Monday 9am)

**Output:**
- `/schedule` configuration (Claude Code scheduled cloud agent)
- Regression alert rules (e.g., "if this week's score < last week's score - 5%, page someone")
- `eval/results/` aggregation (so you can see trends week-over-week)
- Optional: Slack notification on completion with key findings

**Why it matters:**
Once the agent is good enough to run autonomously, you want it running weekly with zero human intervention. The harness handles scheduling, regression detection, and alerting so you only intervene when something broke.

**Example from this project:**
- MTA attribution agent: runs weekly via `/schedule`, produces report in docs/reports/, eval score in eval/results/, alerts if score drops

---

### Skill 4: Iteration Loop Controller

**Purpose:** Bounded, gated prompt iteration — improve the agent without letting it drift.

**Input:**
- Baseline eval score (from Skill 2, first run)
- Iteration budget (e.g., max 5 iterations, max 200 endpoint calls, max $50)
- Deterministic test suite (from Skill 2)
- System prompt version control (git history of changes)

**Output:**
- Iteration strategy (what to vary: system prompt? retrieval logic? output format?)
- Score gate logic: keep a change only if aggregate score improves AND no test regresses
- Best-version keeper: commits and tags the best-performing version
- Visible-diffs recorder: each iteration recorded as a git commit with the prompt diff and score delta

**Why it matters:**
Without gates, you can iterate forever chasing marginal gains. Without visibility, you won't know if the "improved" version actually improved or just got lucky on this week's data. Visible diffs let you revert if things go sideways.

**Example from this project:**
- MTA agent Phase 5: up to 5 iterations, each one: adjust system prompt, re-run eval, keep if score improves or plateaus twice

---

## How to use this framework: step-by-step

### Step 1: Use Skill 1 (Agent Scaffold)

Write a brief task description and constraints. Ask Claude (or use the `agent-scaffold` skill if you've extracted it):
> "Build an AGENTS.md and mission phases for: weekly churn prediction agent. Data source: Databricks user_events table (read-only). Output: markdown report with churn risk scores + hypothesis about which cohorts are at highest risk. Constraints: no fine-tuning, deterministic eval only."

Output: AGENTS.md, mission phases, DECISIONS.md template, STATUS.md shell.

### Step 2: Build the agent

Use the mission phases to guide implementation. Commit after each phase. Record decisions in DECISIONS.md. Let the agent run with the guardrails you designed.

### Step 3: Use Skill 2 (Hybrid Report Eval)

Define what a good report looks like (schema), what claims it makes, and how to verify those claims against ground truth. Build the deterministic test suite + LLM-judge prompts.

Run the first eval: this is your baseline.

### Step 4: Use Skill 3 (Scheduled Agent Harness)

Once the agent passes eval, wire it to run on a schedule. Set up regression alerts. Let it run for 2–4 weeks unattended.

### Step 5: Use Skill 4 (Iteration Loop Controller)

If the baseline eval is good enough, you're done — the agent runs on schedule forever. If you see specific failures in the deterministic checks (e.g., "report sometimes missing the hypothesis table"), use Skill 4 to iterate: vary the system prompt within a bounded budget, keep only improvements, commit the best version.

---

## Real-world examples

### Budget Allocator Feasibility Study

**Goal:** Test whether we can build a "next best dollar" budget recommender without a budget changelog.

**Phases:**
1. Smoke tests (Databricks auth works)
2. Explore (understand the data)
3. Design (register thresholds before looking at outcomes)
4. Feasibility analysis (do the data support curve estimation?)
5. Retro (write up findings)

**Eval:** Pre-registered pass/kill criteria (spend CV > 0.3, >5 campaigns, etc.). Phase 1 = peek at predictor. Register thresholds. Phase 2 = run analysis once against registered thresholds.

**Output:** `docs/recommender_feasibility_plan.md` with verdict, evidence tables, next steps.

**Automation:** Can be run weekly on new data (rolling window of spend variation). Eval score = "did we find enough variation to support curve fitting?"

### MTA Attribution Agent

**Goal:** Weekly attribution performance report + testable hypotheses for the paid media team.

**Phases:**
1. Smoke tests (SQL + endpoint work)
2. Explore (understand the 9 models, Markov outputs)
3. Design (report schema, hypothesis structure, eval criteria)
4. Build (agent that synthesizes SQL results into prose + hypotheses)
5. Eval (deterministic checks + Haiku grounding judge)
6. Iterate (improve system prompt, gated on eval)

**Eval:** 
- Deterministic: report schema check, number-match check (±5%), hypothesis fields all populated, logic consistency
- LLM judge: "Is the executive summary grounded in the data?"

**Output:** `docs/reports/YYYY-MM-DD_attribution_report.md` with executive summary, channel performance table, cross-model disagreement, scored hypotheses.

**Automation:** Runs weekly via `/schedule`. Eval results in `eval/results/` feed regression alerts. If score drops >5%, page the analytics team.

---

## Checklist: is your agent ready for set-and-forget?

- [ ] **Skill 1:** AGENTS.md exists with explicit guardrails (read-only? cost cap? decision log format?)
- [ ] **Skill 1:** Numbered phases with exit rules (the agent knows what "pass" and "skip" mean)
- [ ] **Skill 2:** Deterministic eval tests exist and pass (schema, number-match, logic)
- [ ] **Skill 2:** LLM-judge eval defined and passing (you have a baseline score)
- [ ] **Skill 3:** Agent runs on a schedule without human checkpoints (tested 2+ times)
- [ ] **Skill 4:** You've run at least one iteration cycle (improved prompt, score improved, kept the change)
- [ ] **Documentation:** README explaining what the agent does and when to intervene
- [ ] **Git history:** Phase commits + iteration diffs visible, easily reversible

---

## Pitfalls and how to avoid them

### Pitfall 1: The LLM hallucinates numbers

**Symptom:** Report says "we had 1.5M clicks" but SQL says 800K. The eval judge says "yeah that sounds right" because it's plausible.

**Fix:** Deterministic check — report must match SQL within tolerance. Deterministic checks run first; if they fail, the report is rejected before the LLM judge even sees it.

### Pitfall 2: The eval judge is biased

**Symptom:** The same model that generated the report now judges it, and it always says "this looks good."

**Fix:** Use a different model as the judge (e.g., Haiku if you used Sonnet to generate). Or add a human-in-the-loop step: "reviewer approves the report before it goes to Looker."

### Pitfall 3: The agent stalls waiting for user input

**Symptom:** Agent hits a blocker and just sits there waiting for you to tell it what to do.

**Fix:** AGENTS.md rule: "When blocked, log it in STATUS.md and move on." Exit rules per phase mean the agent always has a way forward (SKIP the phase, move to the next one, ship the retro).

### Pitfall 4: Iterations improve on this week's data but break on next week's

**Symptom:** You tweak the system prompt, eval score goes up, you deploy, then next week it crashes.

**Fix:** Skill 4's iteration loop uses real eval data from a held-out test set or the full historical data, not just this week. Run eval against a multi-week window. Keep visible diffs so you can revert.

### Pitfall 5: The scheduled agent runs but you never know if it's working

**Symptom:** Agent runs silently, you have no idea if it's still working months later.

**Fix:** Skill 3's regression alerts + weekly score summaries. Slack notification on completion. Review eval/results/ at a glance to spot trends.

---

## Next steps

1. **Extract the skills** (they're in `skills/` subdirectory, one markdown per skill)
2. **Read the skill you need** — start with Skill 1 if you're designing a new agent, Skill 2 if you're building an eval harness
3. **Apply to your task** — use the examples (budget allocator, MTA) as templates
4. **Iterate** — ship a minimal agent first, then use Skill 4 to improve
5. **Schedule it** — use Skill 3 to run it autonomously once it passes eval

---

## Questions?

This framework is battle-tested on two real projects (budget allocation feasibility, attribution analysis). If you find gaps or improvements, file an issue or reach out to the data science team.
