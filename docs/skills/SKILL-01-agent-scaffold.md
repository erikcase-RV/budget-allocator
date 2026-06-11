# Skill 1: Agent Scaffold

**What it does:** Designs the agent mission, guardrails, and decision log before writing code.

**Input:** Task description, data sources, access rules, output format, success criteria.

**Output:** AGENTS.md, numbered phases with exit rules, DECISIONS.md template, STATUS.md shell, mission prompt boilerplate.

---

## Use this when:

- You're designing a new autonomous agent and want to get the structure right before coding
- You need explicit guardrails (read-only data, cost caps, decision logging) baked in from the start
- You want to prevent the agent from stalling — you need explicit "pass/skip" criteria for every phase
- You're building something that will run unattended and need auditable decision history

## How to use it:

### Step 1: Write your task description (5 minutes)

What does the agent do? Who does it help? What data does it use? What output do they get?

Example:
> Weekly attribution report + hypothesis generator. Users: paid media team. Data: Databricks attribution tables (read-only). Output: markdown report with performance metrics + scored hypotheses. Success: report includes all 9 attribution models, hypothesis table has signal_type/magnitude/confidence.

### Step 2: List your constraints (5 minutes)

What's off-limits for the agent? How much can it spend? What decisions is it allowed to make vs. escalate?

Example:
> - Read-only Databricks access only
> - No temp tables, no writes
> - Max 200 endpoint calls per run
> - Decisions with LOW confidence go to STATUS.md as "needs human review"
> - All visible diffs only, no silent rewrites

### Step 3: Ask Claude to scaffold (or use this checklist)

"Build an AGENTS.md and phase structure for [your task description]. Constraints: [your list]. Output should include: AGENTS.md with explicit rules, numbered phases 0–6 with exit rules, DECISIONS.md template, STATUS.md shell."

### Step 4: Review and commit

Read what Claude produced. Tweak the phases if needed (not every agent needs all 6). Commit AGENTS.md and the phase roadmap to git before you write any agent code.

---

## What the output looks like

### AGENTS.md (excerpt)

```markdown
# Agent Rules for [Your Task]

## What this agent is
[One-line description]

## Strict rules

### Data access
- Read-only against [tables]. No writes, no DDL.
- Never modify [code/configs]. 
- Query results saved to /sql/ with meaningful filenames.
- Every endpoint call logged to eval/logs/.

### Decision-making
- When blocked or uncertain: log it, skip it, move on. Never wait for input.
- Every judgment call recorded in DECISIONS.md: Decision | Rationale | Confidence (HIGH/LOW)
- LOW confidence + hard to reverse = don't do it; add to STATUS.md as "needs human decision"
- All self-modifications visible git diffs only — never silent rewrites.

### Git hygiene
- Commit checkpoint after each phase.
```

### Phase roadmap (excerpt)

| Phase | What it does | Exit rule |
|-------|--------------|-----------|
| 0 — Smoke tests | Verify auth works, test the endpoint | Both pass, else ABORT |
| 1 — Explore | Map data sources, understand existing output | docs/data_map.md exists |
| 2 — Design | Decide on output format, eval criteria | DECISIONS.md covers all decisions |
| 3 — Build | Implement the agent | Works end-to-end on sample data |
| 4 — Eval | Build test suite | Baseline score recorded |
| 5 — Iterate | Improve system prompt, gated on eval | Score plateaus or 5 iters done |
| 6 — Retro | Write STATUS.md, patch docs, final commit | Always runs |

---

## Output artifacts

After applying Skill 1, you have:

1. **AGENTS.md** — the agent's constitution (guardrails, constraints, rules)
2. **Phase roadmap** — markdown table with phases 0–6, what each does, exit rule for each
3. **DECISIONS.md template** — table structure: Decision | Rationale | Confidence
4. **STATUS.md shell** — sections: per-phase results, baseline vs final eval, deferred decisions, next steps
5. **Mission prompt boilerplate** — phases 0–6 as prose, ready for the human to fill in details

---

## Example: MTA Attribution Agent

**Task description:**
> Weekly attribution performance report + testable hypotheses. Users: paid media team. Data: Databricks attribution tables (channel/platform/day grain). Output: markdown report with performance metrics, cross-model disagreement, scored hypotheses (signal_type, magnitude, confidence, hypothesis_text, suggested_test).

**Constraints:**
> - Read-only Databricks
> - Max 200 endpoint calls/run
> - Markov removal effects are the primary signal (if available at channel grain)
> - Eval: deterministic checks + LLM judge grounding
> - Report goes to docs/reports/; Looker integration is future

**Output:** See `docs/agent_mission_prompt.md` and `AGENTS.md` in the MTA project for the full version.

---

## Checklist

- [ ] Task description is written (what the agent does, who it helps, data source, output)
- [ ] Constraints are listed (read-only? cost cap? decision escalation thresholds?)
- [ ] AGENTS.md is written and committed
- [ ] Phase roadmap is clear (agent knows what "pass" and "skip" mean for each phase)
- [ ] DECISIONS.md template is in place (agent will use it)
- [ ] STATUS.md shell is ready (you know what done looks like)
- [ ] You've read through the mission prompt boilerplate

## Next step

Once you have the scaffold, move to **Skill 2 (Hybrid Report Eval)** to define how you'll know the agent's output is good.
