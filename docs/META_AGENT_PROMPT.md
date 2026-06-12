# Meta-Agent Prompt: Autonomous Analysis Agent Builder

**Paste this entire prompt into a fresh Claude Code session to autonomously scaffold, build, test, and iterate on a new analysis agent.**

---

## Mission

Build an autonomous analysis agent end-to-end: from business problem statement to deployed, tested, documented agent that runs on schedule. Your job is to:

1. **Understand the problem** — what question does the agent answer, what data does it use, who uses the output?
2. **Scaffold the project** — create AGENTS.md, mission phases, directory structure, decision log template
3. **Build the agent** — implement the thing (SQL queries, Python code, endpoint integration)
4. **Build the eval harness** — deterministic tests + LLM judge scoring
5. **Run and evaluate** — get a baseline score
6. **Iterate** — improve the agent based on eval feedback (bounded loop)
7. **Hand off** — document everything, show how to schedule it

You do this **autonomously**. When you hit a judgment call, decide and record it in DECISIONS.md with rationale and confidence (HIGH/LOW). LOW-confidence decisions get escalated ("needs human review") rather than silently executed. Never wait for user input.

---

## Your input

You will receive a **business problem statement** like:

> "Build a weekly churn prediction agent. Data: Databricks user_events table (read-only). Output: markdown report with churn risk scores plus hypothesis about which cohorts are at highest risk."

Treat that statement as your specification. If it's unclear, interpret it generously (favor breadth over depth) and note your interpretation in DECISIONS.md.

---

## Your output

When you finish, the project directory will have:

```
project/
├── AGENTS.md                      # Agent rules and constraints
├── docs/
│   ├── agent_mission.md           # The 7 phases you executed
│   ├── data_map.md                # What tables, what grain, what freshness
│   └── reports/                   # Weekly output lands here
├── src/agent/                     # Agent implementation
│   ├── __init__.py
│   ├── agent.py                   # Main agent logic
│   ├── sql_runner.py              # SQL queries against Databricks
│   ├── endpoint_client.py         # Calls the serving endpoint
│   └── report_renderer.py         # Markdown output
├── eval/
│   ├── run_eval.py                # Test suite runner
│   ├── cases.jsonl                # Test cases (schema, number-match, logic)
│   └── results/                   # Eval scores per run
├── sql/
│   ├── w01_schema_map.sql         # Explore tables
│   ├── w02_ground_truth.sql       # Ground truth queries for eval
│   └── ... (numbered queries per phase)
├── scripts/
│   ├── check_regression.py        # Alerts if eval score drops
│   └── schedule.json              # Cron config for `/schedule`
├── DECISIONS.md                   # Judgment calls + confidence
├── STATUS.md                      # Final report (per-phase results)
└── README.md                      # How to run, how to iterate
```

Plus: a working agent that passes eval and is ready to schedule.

---

## Phases (follow in order)

### PHASE 0 — SMOKE TESTS (abort gate)

Verify the basics work:
- Databricks SQL auth: `SELECT 1` against the warehouse
- Serving endpoint: round-trip one prompt through the LLM endpoint, log response + model version

**Exit rule:** Both pass. If endpoint unreachable after 3 attempts, write STATUS.md explaining failure and **END THE RUN** (nothing downstream is possible).

**Questions to answer:**
- What is the Databricks warehouse ID I should connect to?
- What is the serving endpoint name (e.g., databricks-claude-sonnet-4-6)?

---

### PHASE 1 — UNDERSTAND AND MAP

Read the problem statement closely. Understand:
- What question does this agent answer?
- What data sources does it use (table names, grain, freshness)?
- Who uses the output and how?
- What success looks like (example output, decision made on the output)

Map the Databricks tables:
- Run `DESCRIBE` on each table used
- Check row counts and date ranges (is the data fresh?)
- Understand the columns: which ones are metrics, which are dimensions, which are time-based?

Enumerate plausible use cases (5-10 questions the output should answer):
- Example: "Which cohort has the highest churn risk? Should we focus retention on them?"
- Example: "Did churn risk change week-over-week? Is it trending up?"

**Deliverable:** `docs/data_map.md` with tables, columns, grain, freshness, and 5-10 use-case questions.

**Exit rule:** `docs/data_map.md` exists and is readable.

---

### PHASE 2 — DESIGN

Design the agent without writing code. Record in DECISIONS.md:

**(a) Report structure.** What sections should the output have?

Example: Executive summary (3-5 sentences), churn risk table (cohort, score, trend), hypothesis section, data quality flags.

**(b) Scoring method for eval.** How do you know if a report is good?

- Deterministic checks: schema (all required sections present?), number-match (if the report says "cohort X has 45% churn," does SQL say 45%?), logic consistency
- LLM judge: is the summary grounded in the data? Are hypotheses actionable?

**(c) Agent architecture.** How does the agent work?

- Read SQL query results, pass to endpoint with system prompt, render markdown output, or:
- Pre-compute all metrics in Python, use endpoint only for narrative synthesis?
- Which approach does the data support?

**(d) Package structure.** Where does code live?

- `src/agent/agent.py` for orchestration
- `src/agent/sql_runner.py` for queries
- `src/agent/endpoint_client.py` for LLM calls
- `src/agent/report_renderer.py` for markdown output

**(e) Lookback window.** What time range for the first report? 

Example: 7 days (weekly), 30 days (monthly), trailing 90 days (quarterly)?

**Exit rule:** DECISIONS.md covers a–e with HIGH or LOW confidence tags.

---

### PHASE 3 — BUILD THE AGENT

Implement `src/agent/` following the Phase 2 design.

**Step 1:** `sql_runner.py` — write and test SQL queries.
- Save all SQL to `/sql/w0X_*.sql` with meaningful names
- Test each query locally (run it and spot-check results)
- Document what each query computes

**Step 2:** `endpoint_client.py` — call the serving endpoint.
- Take a prompt, send to the endpoint, get a response
- Log request/response/model version to `eval/logs/`
- Handle timeouts and errors gracefully

**Step 3:** `report_renderer.py` — turn data + prose into markdown.
- Format the report per Phase 2 spec
- Ensure all required sections are present
- Make it human-readable

**Step 4:** `agent.py` — orchestrate the flow.
- Entrypoint: `python -m agent --lookback 7`
- Calls sql_runner to get data
- Calls endpoint_client to synthesize prose
- Calls report_renderer to output markdown
- Saves to `docs/reports/YYYY-MM-DD_report.md`

**Step 5:** Test end-to-end locally.
- Run `python -m agent --lookback 7`
- Inspect the report in `docs/reports/`
- Does it have all required sections? Are the numbers reasonable?

**Exit rule:** `python -m agent` produces a readable report that answers at least 3 of the Phase 1 use-case questions.

---

### PHASE 4 — BUILD EVAL HARNESS

Define quality tests for the report.

**Step 1:** Deterministic checks.

```python
def test_schema(report_text):
    """Does the report have all required sections?"""
    assert "Executive summary" in report_text
    assert "Churn risk table" in report_text
    assert "Hypothesis" in report_text
    return True

def test_number_match(report_text, ground_truth_sql):
    """Do reported numbers match SQL within tolerance?"""
    # Extract "45%" from report, compare to SQL result
    # Tolerance: ±5% or ±1 percentage point (your choice)
    return True

def test_logic(report_text):
    """Are hypotheses internally consistent?"""
    # Check: if cohort X has highest risk, is it mentioned in hypothesis?
    return True
```

**Step 2:** LLM judge prompts (use Haiku or a different model).

```
Prompt 1: "Is this executive summary grounded in the data table below?"
Prompt 2: "Are the hypotheses actionable for a retention manager?"
Prompt 3: "Does the report flag any missing data or anomalies?"
```

**Step 3:** `eval/run_eval.py` — test runner.

```python
def run_eval(report_file, ground_truth_sql_results):
    """Run all tests, aggregate score."""
    deterministic_pass = run_deterministic_tests(report_file, ground_truth_sql_results)
    judge_score = run_llm_judge(report_file, model='databricks-claude-haiku-4-5')
    
    overall_score = (deterministic_pass + judge_score) / 2  # Simple avg
    
    # Save results
    write_json(f'eval/results/{timestamp}.json', {
        'deterministic_pass': deterministic_pass,
        'judge_score': judge_score,
        'overall_score': overall_score,
        'timestamp': timestamp,
    })
    
    return overall_score
```

**Step 4:** Run baseline eval.

```bash
python eval/run_eval.py
```

This is your baseline. All future iterations compare against it.

**Exit rule:** `eval/run_eval.py` runs, produces a JSON result with an overall_score ≥ 0.7 (or your bar).

---

### PHASE 5 — ITERATE (bounded, use haiku endpoint)

Up to 5 iterations. Each iteration:
1. Identify failing deterministic tests (if any)
2. Ask Claude to propose a prompt change to fix them
3. Update `src/agent/agent.py` system prompt
4. Run `python -m agent` + `python eval/run_eval.py`
5. Decision: keep if score improves or plateaus, discard if regression
6. Commit the iteration (visible diff showing what changed + score delta)

**Cost control:** Use `databricks-claude-haiku-4-5` for iterations (cheaper than sonnet).

**Exit rule:** 5 iterations done, or 2 consecutive plateaus, or endpoint-call cap nears. Keep best version.

---

### PHASE 6 — RETRO AND HAND OFF (always runs, even after abort)

**Step 1:** Write STATUS.md.

```markdown
# Status: [Agent Name]

## Per-phase results
- Phase 0: PASS
- Phase 1: PASS (docs/data_map.md exists)
- Phase 2: PASS (DECISIONS.md complete)
- Phase 3: PASS (agent produces reports)
- Phase 4: PASS (baseline eval score 0.82)
- Phase 5: PASS (final score 0.91 after 3 iterations)
- Phase 6: IN PROGRESS

## Baseline vs final score
- Baseline: 0.82
- Final: 0.91
- Improvement: +9%

## Iteration details
- Iteration 1: added magnitude field to hypothesis, +0.04
- Iteration 2: improved grounding language, +0.03
- Iteration 3: added actionability check, +0.02, kept

## Total endpoint calls
- Build phase: 12
- Eval baseline: 4
- Iteration loop: 18
- Judge calls: 8
- Total: 42 / 200 cap

## Deferred decisions (needs human review)
- None (all HIGH confidence)

## Next steps
1. Schedule the agent to run weekly
2. Monitor eval/results/ for regression
3. If score drops >5%, review what changed (SQL? data quality?)
```

**Step 2:** Document the agent.

Write `README.md`:
```markdown
# [Agent Name]

## What it does
[One paragraph: what question it answers, who uses it, how often]

## How to run it
python -m agent --lookback 7

## Output
docs/reports/YYYY-MM-DD_report.md

## How to schedule it
/schedule --interval weekly --day monday --time 09:00 \
  --cmd "cd /path && python -m agent --lookback 7 && python eval/run_eval.py"

## Eval
- Baseline score: 0.91
- Deterministic checks: all passing
- LLM judge: 90% grounding, 95% actionability

## If eval score drops
See scripts/check_regression.py — it will alert you.
Review eval/results/LATEST.json to see which test failed.
```

**Step 3:** Self-patch instructions.

If any phase was unclear, rewrite this prompt as a visible diff. Commit it.

**Step 4:** Append lessons to AGENTS.md.

```markdown
## Lessons learned from this build

- [Agent-specific lessons from this project]
- Example: "Churn predictions need 90+ days of history for stability"
- Example: "Haiku judge sometimes misses subtle data issues — add extra deterministic checks"
```

**Step 5:** Final commit.

```bash
git add STATUS.md README.md DECISIONS.md docs/data_map.md eval/results/baseline.json
git commit -m "[Agent] [Agent Name] - build complete, score 0.91, ready to schedule"
```

---

## Decision-making rules

- **When stuck:** Log the blocker in STATUS.md, mark the phase SKIPPED, move on. Never wait for input.
- **When uncertain:** Record in DECISIONS.md (Decision | Rationale | Confidence). HIGH confidence decisions proceed. LOW confidence decisions get escalated to STATUS.md as "needs human review."
- **When changing code:** Commit per phase so the work is auditable.
- **All visible diffs only:** No silent rewrites. Git history should show exactly what changed and when.

---

## Cost and time guardrails

- **Endpoint calls:** 200 per run (measured + logged)
- **Wall-clock time:** This should take 1–2 hours for a complete run (smoke tests → deploy-ready agent)
- **Iteration cap:** 5 iterations max (bounded loop)
- **Decision delay:** 0 minutes (decide autonomously, don't wait)

---

## Success criteria

When you finish, you have:
- [ ] A working agent that runs end-to-end
- [ ] An eval harness that measures quality
- [ ] A baseline score ≥ 0.7 (or passes all deterministic checks)
- [ ] Documented architecture and decisions
- [ ] A README explaining how to run and schedule it
- [ ] All code committed with clean git history
- [ ] A STATUS.md showing per-phase results

You're done when someone else could read the README and `python -m agent` to get a report, or wire it to `/schedule` to run weekly.
