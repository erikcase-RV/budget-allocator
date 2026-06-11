# Skill 2: Hybrid Report Eval

**What it does:** Scores report quality using both objective checks (deterministic) and a different model's judgment (LLM judge).

**Input:** Report schema, list of claims, ground-truth SQL/source for each claim, tolerance bands.

**Output:** Deterministic test suite, LLM-judge prompts, eval runner (eval/run_eval.py), results aggregation (eval/results/<timestamp>.json).

---

## Use this when:

- You have an agent that produces reports and you need to know if the report is actually good (not just "plausible")
- You want to catch both hallucinations (wrong numbers) AND poor reasoning (true numbers, bad synthesis)
- You're building an eval harness that will feed iteration loops (Skill 4)
- You want regression detection (score this week vs last week)

## Why hybrid eval matters:

**LLM judges alone:** Biased toward the model they're judging. "Does this report look good?" answered by the same model that wrote it = always "yes."

**Deterministic checks alone:** Catch hallucinations but miss reasoning failures. "Numbers match SQL" doesn't tell you if the synthesis makes sense.

**Hybrid:** Deterministic checks catch hallucinations; independent LLM judges catch reasoning gaps. Much stronger together.

---

## How to use it:

### Step 1: Define the report schema (10 minutes)

What sections must the report have? What fields are required in each section?

Example (MTA attribution):
```
## Report schema

- Executive summary (prose, max 5 sentences)
- Channel performance table (columns: channel, last_touch_revenue, markov_revenue, linear_revenue, model_disagreement_flag)
- Model disagreement section (only if >2 channels rank differently between models)
- Hypothesis table (columns: signal_type, magnitude, confidence, hypothesis_text, suggested_test)
- Data quality notes (any missing days? anomalies?)
```

### Step 2: List claims in the report (15 minutes)

What numeric or factual claims does the report make? How would you verify each one?

Example:
```
## Claims

Claim 1: "Meta's Markov removal effect is 2.3x its last-touch share"
  Verify: SELECT markov_revenue, lt_revenue FROM ... WHERE platform='Meta'
  Tolerance: ±5%

Claim 2: "Google ranked #1 by last-touch but #3 by Markov"
  Verify: SELECT channel, ROW_NUMBER() OVER (...) FROM ... ORDER BY model, revenue
  Tolerance: exact rank match (ties OK)

Claim 3: "We found 5 testable hypotheses this week"
  Verify: COUNT(*) FROM hypothesis_table WHERE confidence >= HIGH
  Tolerance: exact count (0-1 diff OK for edge cases)
```

### Step 3: Design deterministic tests (20 minutes)

For each claim, write a test:

Example:
```python
# Test 1: Report schema
def test_report_schema(report_text):
    assert "Executive summary" in report_text
    assert "Channel performance" in report_text
    assert "Hypothesis table" in report_text
    return True  # or False if missing

# Test 2: Number match (Meta removal effect claim)
def test_meta_removal_effect(report_text, ground_truth_sql_result):
    # Extract "2.3x" from report prose
    extracted = extract_numeric_claim(report_text, "Meta", "removal effect")
    expected = ground_truth_sql_result['ratio']
    assert abs(extracted - expected) < 0.05 * expected  # ±5%
    return True

# Test 3: Hypothesis count
def test_hypothesis_count(report_text, expected_count):
    hypothesis_table = extract_table(report_text, "Hypothesis")
    assert len(hypothesis_table) == expected_count
    return True
```

### Step 4: Design LLM-judge prompts (10 minutes)

What reasoning quality do you care about? Write prompts that target that.

Example:
```
Prompt 1 (Grounding):
"Below is a report executive summary and the data table it references. 
Is the summary grounded in the data? Does it make claims unsupported by 
the numbers? Answer with yes/no + one reason."

Prompt 2 (Completeness):
"This report claims to show all 9 attribution models. Does the channel 
performance table include all 9 models (or explain if one is missing)?"

Prompt 3 (Actionability):
"Does each hypothesis in the hypothesis table have a clear suggested_test 
that a marketer could actually run? Answer with pass/fail."
```

### Step 5: Implement eval/run_eval.py (30 minutes)

Template:
```python
import json
import subprocess
from datetime import datetime

def run_deterministic_tests(report_text, ground_truth):
    """Run all schema + number-match + logic tests."""
    results = {}
    results['schema'] = test_report_schema(report_text)
    results['number_match'] = test_meta_removal_effect(report_text, ground_truth)
    results['hypothesis_count'] = test_hypothesis_count(report_text, expected=5)
    return results

def run_llm_judge(report_text, model_endpoint):
    """Call Haiku (or different model) as judge."""
    prompts = [
        "Is this summary grounded in the data?",
        "Are all 9 models represented?",
        "Are hypotheses actionable?"
    ]
    judge_results = {}
    for p in prompts:
        response = call_endpoint(model_endpoint, p + "\n\nReport:\n" + report_text)
        judge_results[p] = parse_yes_no(response)
    return judge_results

def run_eval(report_file, ground_truth_sql_results):
    """Run full eval suite."""
    report_text = read_file(report_file)
    
    deterministic = run_deterministic_tests(report_text, ground_truth_sql_results)
    judge = run_llm_judge(report_text, endpoint='databricks-claude-haiku-4-5')
    
    # Aggregate
    det_pass_rate = sum(deterministic.values()) / len(deterministic)
    judge_pass_rate = sum(judge.values()) / len(judge)
    overall_score = (det_pass_rate + judge_pass_rate) / 2
    
    # Write results
    results = {
        'timestamp': datetime.now().isoformat(),
        'deterministic': deterministic,
        'judge': judge,
        'overall_score': overall_score,
        'det_pass_rate': det_pass_rate,
        'judge_pass_rate': judge_pass_rate,
    }
    
    with open(f'eval/results/{datetime.now().isoformat()}.json', 'w') as f:
        json.dump(results, f, indent=2)
    
    return results

if __name__ == '__main__':
    report_file = 'docs/reports/LATEST.md'
    ground_truth = run_ground_truth_queries()
    run_eval(report_file, ground_truth)
```

### Step 6: Run baseline eval (5 minutes)

```bash
python eval/run_eval.py
```

This is your baseline score. All future iterations will be compared against this.

---

## Output artifacts

1. **eval/cases.jsonl** (optional, if you want to track test cases over time)
2. **eval/run_eval.py** — the eval runner
3. **eval/results/<timestamp>.json** — per-run results with per-check pass/fail + aggregate score
4. **DETERMINISTIC_TESTS.md** (optional) — documentation of each test and why it matters
5. **LLM_JUDGE_PROMPTS.md** (optional) — the judge prompts you're using

---

## Example: MTA Attribution Agent Eval

**Deterministic tests:**
1. Schema check: report has Executive Summary, Channel Performance, Hypothesis Table
2. Number match: channel revenues in report ± 5% of SQL results
3. Hypothesis logic: each hypothesis with confidence=HIGH has magnitude > threshold
4. Consistency: no contradictions between model rankings

**LLM judge (Haiku):**
1. Grounding: "Is the executive summary supported by the data table below?"
2. Completeness: "Are all 9 attribution models represented?"
3. Actionability: "Does each hypothesis have a testable suggested_test?"

**Scoring:**
```
det_pass_rate = 4/4 = 100%
judge_pass_rate = 3/3 = 100%
overall_score = (1.0 + 1.0) / 2 = 1.0
```

**Regression alert:** If next week's score < 0.95, page someone.

---

## Checklist

- [ ] Report schema is defined (required sections + fields)
- [ ] Claims to verify are listed (what numbers does the report make?)
- [ ] Deterministic tests are written (one per claim + one per schema requirement)
- [ ] LLM-judge prompts are written (target reasoning quality you care about)
- [ ] eval/run_eval.py is implemented and working
- [ ] Baseline eval passes (gives you a starting score)
- [ ] eval/results/ exists and baseline JSON is committed
- [ ] You can run `python eval/run_eval.py` and it produces results in 2-3 minutes

## Next step

Move to **Skill 3 (Scheduled Agent Harness)** to run this eval on a schedule, or **Skill 4 (Iteration Loop Controller)** to improve the agent based on eval feedback.
