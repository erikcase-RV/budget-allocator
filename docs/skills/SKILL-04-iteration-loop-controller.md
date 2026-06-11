# Skill 4: Iteration Loop Controller

**What it does:** Bounded, gated prompt iteration — improve the agent without letting it drift.

**Input:** Baseline eval score (from Skill 2), iteration budget (max iterations, cost cap, endpoint call limit), deterministic test suite, current system prompt.

**Output:** Iteration strategy, score gate logic, best-version keeper, visible-diffs recorder, git history of all changes.

---

## Use this when:

- The agent passes basic eval but specific tests are failing (e.g., "report sometimes missing a table")
- You want to improve the system prompt but can't iterate forever (bounded budget)
- You need to know which prompt changes actually helped (visible diffs + score deltas)
- You're building the self-improving loop (each run's eval feeds the next)

## Why bounded iteration matters:

**Without gates:** You can iterate forever, chasing marginal improvements. "99.2% → 99.3%?" doesn't justify a new prompt. Costs spiral.

**Without visibility:** You improve the prompt, score goes up, you deploy, then next week it crashes. You don't know which change broke it because you didn't keep diffs.

**With gates:** You can vary the prompt, but only keep changes that improve the score (or at worst, plateau). Visible diffs let you revert if things go sideways.

---

## How to use it:

### Step 1: Understand your baseline (5 minutes)

From Skill 2's eval, you have a baseline score and a per-test breakdown.

Example:
```
Baseline score: 0.88
Deterministic tests:
  - schema: PASS
  - number_match: FAIL (2 channels had >5% error)
  - hypothesis_logic: FAIL (1 hypothesis had no signal magnitude)
  - consistency: PASS

LLM judge:
  - grounding: PASS
  - completeness: PASS
  - actionability: FAIL (2 hypotheses had no suggested_test)
```

Your iteration targets are clear: fix number_match, hypothesis_logic, and actionability.

### Step 2: Set your iteration budget (5 minutes)

How much can you spend improving?
```
Max iterations: 5
Max endpoint calls per iteration: 50  (to stay under cost cap)
Max wall-clock time: 1 week
Success criterion: score ≥ 0.95 (up from 0.88)
```

Write this at the top of DECISIONS.md so the agent knows the bounds.

### Step 3: Design your variation strategy (15 minutes)

What can you vary? For most analysis agents: **the system prompt only**. Don't vary retrieval logic, output format, or eval criteria mid-iteration.

Example variations for an attribution agent:
1. **First iteration:** Add explicit instruction to always output hypothesis magnitude from SQL
2. **Second iteration:** Revise system prompt to emphasize "include a suggested_test for every hypothesis"
3. **Third iteration:** Add a schema-validation step before calling the endpoint (catches missing fields early)
4. **Fourth iteration:** Refine the grounding-check language to match how the Haiku judge scores it
5. **Fifth iteration:** (reserve for surprise findings)

### Step 4: Implement the iteration loop (30 minutes)

Pseudocode:
```python
# scripts/iterate_agent.py

import json
import subprocess
from pathlib import Path
from datetime import datetime

def load_baseline_score():
    """Get the baseline eval score from Skill 2."""
    with open('eval/results/baseline.json') as f:
        return json.load(f)

def read_system_prompt():
    """Current prompt in src/agent/agent.py or similar."""
    with open('src/agent/agent.py') as f:
        content = f.read()
    # Extract the SYSTEM_PROMPT = """...""" block
    return extract_prompt(content)

def propose_variation(iteration_num, failing_tests, baseline_prompt):
    """Ask Claude to vary the prompt to fix specific failing tests."""
    
    failing_list = ", ".join(failing_tests)
    
    prompt_for_claude = f"""
    Current system prompt:
    {baseline_prompt}
    
    Failing tests this iteration: {failing_list}
    
    Propose ONE specific change to the system prompt that would fix these failures.
    Be concrete. Example: "Add explicit instruction: 'Always include SQL_GENERATED_MAGNITUDE 
    from the query result in every hypothesis.'"
    
    Return ONLY the revised prompt, no explanations.
    """
    
    response = call_claude(prompt_for_claude)
    return response

def run_iteration(iteration_num, new_prompt, baseline_score):
    """Run agent + eval with the new prompt."""
    
    # Update agent code
    update_system_prompt('src/agent/agent.py', new_prompt)
    
    # Run agent
    subprocess.run(['python', '-m', 'agent', '--lookback', '7'], check=True)
    
    # Run eval
    result = subprocess.run(['python', 'eval/run_eval.py'], 
                           capture_output=True, text=True)
    
    # Parse eval result
    with open('eval/results/LATEST.json') as f:
        new_eval = json.load(f)
    
    new_score = new_eval['overall_score']
    improvements = {
        'baseline_score': baseline_score,
        'new_score': new_score,
        'delta': new_score - baseline_score,
        'per_test': new_eval,
    }
    
    return new_score, improvements

def decide_keep_or_discard(new_score, baseline_score, deterministic_checks, threshold_delta=0.02):
    """Keep if: score improves OR plateaus. Discard if: regression."""
    
    # Hard rule: deterministic checks must NOT regress
    for check, passed in deterministic_checks.items():
        if not passed:
            return False, "Deterministic check failed"
    
    # Soft rule: overall score should improve or at least not drop >2%
    if (new_score - baseline_score) >= -threshold_delta:
        return True, f"Score improved by {(new_score - baseline_score):.1%}"
    else:
        return False, f"Score regressed by {(baseline_score - new_score):.1%}"

def commit_iteration(iteration_num, old_prompt, new_prompt, new_score, baseline_score, kept):
    """Record the iteration as a visible git diff."""
    
    diff = f"""
    === Iteration {iteration_num} ===
    Score: {baseline_score:.3f} → {new_score:.3f} (delta: {new_score - baseline_score:+.3f})
    Status: {'KEPT' if kept else 'DISCARDED'}
    
    OLD PROMPT:
    {old_prompt}
    
    NEW PROMPT:
    {new_prompt}
    """
    
    with open(f'eval/iterations/iter_{iteration_num:02d}.md', 'w') as f:
        f.write(diff)
    
    subprocess.run(['git', 'add', f'eval/iterations/iter_{iteration_num:02d}.md'])
    subprocess.run(['git', 'commit', '-m', f'[Iteration {iteration_num}] Score {new_score:.1%} ({"kept" if kept else "discarded"})'])

def main():
    baseline = load_baseline_score()
    baseline_score = baseline['overall_score']
    baseline_prompt = read_system_prompt()
    
    best_score = baseline_score
    best_prompt = baseline_prompt
    iterations_run = 0
    
    for iteration in range(1, 6):  # Max 5 iterations
        print(f"\n--- Iteration {iteration} ---")
        
        # Identify failing tests
        failing_tests = [t for t, p in baseline['deterministic'].items() if not p]
        if not failing_tests:
            print("All deterministic tests passing, no need to iterate.")
            break
        
        # Get Claude to propose a change
        new_prompt = propose_variation(iteration, failing_tests, best_prompt)
        
        # Run the iteration
        new_score, improvements = run_iteration(iteration, new_prompt, best_score)
        print(f"Score: {best_score:.3f} → {new_score:.3f}")
        
        # Decide: keep or discard
        keep, reason = decide_keep_or_discard(
            new_score, best_score, 
            improvements['per_test']['deterministic']
        )
        
        print(f"Decision: {'KEEP' if keep else 'DISCARD'} - {reason}")
        
        if keep:
            best_score = new_score
            best_prompt = new_prompt
            iterations_run += 1
        
        # Commit regardless (visible diff shows what we tried and whether it helped)
        commit_iteration(iteration, best_prompt, new_prompt, new_score, best_score, keep)
        
        # Check for plateau (2 consecutive no-improvement iterations)
        if iteration > 1 and not keep and iterations_run > 0:
            # If we discarded this one, might want to stop
            pass
    
    print(f"\nIteration loop complete. Best score: {best_score:.3f} (was {baseline_score:.3f})")

if __name__ == '__main__':
    main()
```

### Step 5: Run the iteration loop (varies, typically 30 min - 2 hours)

```bash
python scripts/iterate_agent.py
```

This will:
1. Read your baseline eval (from Skill 2)
2. Loop up to 5 times:
   - Ask Claude to propose a prompt change to fix failing tests
   - Run the agent with the new prompt
   - Run eval
   - Decide: keep if score improves (or at worst plateaus), discard if regression
   - Commit the iteration (visible diff shows what changed and by how much)
3. Report the best score achieved

### Step 6: Review the iterations and keep the best (5 minutes)

```bash
git log --oneline | head -10
```

You'll see commits like:
```
[Iteration 3] Score 0.91 (kept)
[Iteration 2] Score 0.88 (discarded)
[Iteration 1] Score 0.90 (kept)
```

The best version is already checked out. Read the diffs in `eval/iterations/` to understand what worked:

```bash
ls eval/iterations/
# iter_01.md (kept, +0.02)
# iter_02.md (discarded, -0.01)
# iter_03.md (kept, +0.01)
```

---

## Output artifacts

1. **`eval/iterations/iter_XX.md`** — record of each iteration (prompt diff + score delta + decision)
2. **Git commit history** — visible diffs, one per iteration, easy to revert
3. **`eval/results/iteration_summary.json`** — baseline vs best, best iteration number, wall-clock time
4. **Best-version prompt** — committed to `src/agent/agent.py` as the new standard

---

## Example: MTA Attribution Agent Iteration

**Baseline:** 0.88 (schema PASS, number_match FAIL, hypothesis_logic FAIL, consistency PASS, grounding PASS, completeness PASS, actionability FAIL)

**Iteration 1:** Add "Always include magnitude from SQL result" → Score 0.90 ✓ KEPT
- Fixed: hypothesis_logic now PASS
- Still failing: number_match (rounding errors), actionability

**Iteration 2:** Revise grounding instruction to match Haiku's expectations → Score 0.89 ✗ DISCARDED
- Regression (was 0.90)
- Revert to Iteration 1

**Iteration 3:** Fix number-match by adding tolerance logic to the agent → Score 0.91 ✓ KEPT
- Fixed: number_match now PASS (within ±5%)
- Still failing: actionability

**Iteration 4:** Explicit instruction "every hypothesis must have a one-sentence suggested_test" → Score 0.94 ✓ KEPT
- Fixed: actionability now PASS
- All tests passing

**Final:** Best score 0.94 (up from 0.88, +6.8% improvement)

---

## Checklist

- [ ] Baseline eval score is recorded (from Skill 2)
- [ ] Iteration budget is decided (max iterations, cost cap, success criterion)
- [ ] Variation strategy is clear (prompt only, no retrieval/output format changes)
- [ ] Iteration loop script (or pseudocode) is written
- [ ] You've run at least one full iteration cycle locally
- [ ] `eval/iterations/` directory exists with diffs from each attempt
- [ ] Git history shows visible diffs, one commit per iteration
- [ ] You can see which iterations were kept vs discarded
- [ ] Best version is checked out and committed to main

## Troubleshooting

**Issue:** Iteration loop keeps discarding changes (nothing improves)

Check: Are your failing tests real? Is the agent even being called with the new prompt? Run manually once and inspect the output. The issue might be that your variation strategy is too conservative — propose bigger changes.

**Issue:** Score improves then plateaus, or oscillates

Check: You might be overfitting to this week's data. Run eval against a multi-week hold-out set or last month's data to ensure gains generalize. Plateau is fine — that's your signal to stop (Skill 4 should auto-stop after 2 consecutive plateaus).

**Issue:** All tests pass but you still get surprises next week

Check: Your deterministic tests might not be comprehensive. Add more tests for edge cases, or add a "human review" step before deploying to production.

## Next step

Once you've iterated and achieved your target score, commit the best version and move to **Skill 3 (Scheduled Agent Harness)** to run it autonomously on a schedule. The eval harness (Skill 2) will monitor it for regression automatically.
