# Skill 3: Scheduled Agent Harness

**What it does:** Runs the agent autonomously on a schedule (weekly, daily, etc.) and tracks quality regression.

**Input:** Agent entrypoint (CLI or Python module), eval runner (from Skill 2), report output directory, schedule (cron expression).

**Output:** `/schedule` configuration, regression alert rules, `eval/results/` aggregation dashboard, optional Slack notifications.

---

## Use this when:

- The agent is passing eval and ready to run without human checkpoints
- You want reports generated on a fixed schedule (weekly, daily, etc.) automatically
- You need to track whether the agent is still working (regression detection)
- You want to be alerted if the agent's output quality drops

## How to use it:

### Step 1: Confirm the agent is ready (5 minutes)

Check:
- [ ] Agent CLI works locally: `python -m my_agent --lookback 30` produces a report
- [ ] Report lands in the right place: `docs/reports/`
- [ ] Eval passes: `python eval/run_eval.py` produces baseline score ≥ 0.8 (or your threshold)
- [ ] All output is deterministic (running twice gives identical results)

### Step 2: Create the schedule config (5 minutes)

Use Claude Code's `/schedule` skill to set up a recurring cloud agent:

```
/schedule --interval "weekly" --day "monday" --time "09:00" \
  --cmd "cd /path/to/agent && python -m my_agent --lookback 7 && python eval/run_eval.py"
```

Or write a `.claude/schedule.json` file:
```json
{
  "name": "weekly-attribution-report",
  "description": "Generate weekly attribution report and eval score",
  "schedule": "0 9 * * 1",  // Monday 9am UTC
  "command": "python -m mta_agent --lookback 7 && python eval/run_eval.py",
  "output": {
    "report": "docs/reports/",
    "eval": "eval/results/"
  }
}
```

### Step 3: Set up regression alerts (10 minutes)

Create a simple alerting function that runs after each scheduled agent invocation:

```python
# scripts/check_regression.py
import json
import subprocess
from pathlib import Path
from datetime import datetime, timedelta

def get_latest_score():
    """Read the latest eval result."""
    results_dir = Path('eval/results')
    latest = sorted(results_dir.glob('*.json'))[-1]
    with open(latest) as f:
        return json.load(f)

def get_previous_score():
    """Read the eval result from last week."""
    results_dir = Path('eval/results')
    all_results = sorted(results_dir.glob('*.json'))
    if len(all_results) >= 2:
        with open(all_results[-2]) as f:
            return json.load(f)
    return None

def check_regression(threshold_drop=0.05):
    """Alert if score dropped more than threshold."""
    latest = get_latest_score()
    previous = get_previous_score()
    
    if previous is None:
        print("First run, no regression to check")
        return
    
    latest_score = latest['overall_score']
    previous_score = previous['overall_score']
    drop = previous_score - latest_score
    
    if drop > threshold_drop:
        print(f"ALERT: Score dropped {drop:.1%} (was {previous_score:.1%}, now {latest_score:.1%})")
        # Send Slack notification
        send_slack_alert(f"Attribution report score regressed: {drop:.1%}")
    else:
        print(f"OK: Score stable ({latest_score:.1%})")

if __name__ == '__main__':
    check_regression()
```

Call this after each agent run:
```bash
python scripts/check_regression.py
```

### Step 4: Set up Slack notifications (optional, 10 minutes)

If you want to be notified when the report is ready:

```python
# scripts/slack_notify.py
import requests
import json
from pathlib import Path

def notify_slack(webhook_url, report_file, eval_score):
    """Send a summary to Slack."""
    
    # Read report summary
    with open(report_file) as f:
        report_text = f.read()
    summary = report_text.split('\n')[0:10]  # First 10 lines
    
    # Format message
    message = {
        "blocks": [
            {
                "type": "section",
                "text": {
                    "type": "mrkdwn",
                    "text": f"📊 *Weekly Attribution Report*\n\nScore: {eval_score:.1%}"
                }
            },
            {
                "type": "section",
                "text": {
                    "type": "mrkdwn",
                    "text": "```\n" + "\n".join(summary) + "\n```"
                }
            },
            {
                "type": "actions",
                "elements": [
                    {
                        "type": "button",
                        "text": {"type": "plain_text", "text": "View Full Report"},
                        "url": "https://git.company.com/path/to/report"
                    }
                ]
            }
        ]
    }
    
    requests.post(webhook_url, json=message)

if __name__ == '__main__':
    webhook_url = 'https://hooks.slack.com/...'  # Your webhook
    report_file = 'docs/reports/LATEST.md'
    with open('eval/results/LATEST.json') as f:
        eval_score = json.load(f)['overall_score']
    notify_slack(webhook_url, report_file, eval_score)
```

Wire this into the schedule:
```bash
cd /path/to/agent && \
  python -m my_agent --lookback 7 && \
  python eval/run_eval.py && \
  python scripts/check_regression.py && \
  python scripts/slack_notify.py
```

### Step 5: Commit the schedule config (5 minutes)

```bash
git add eval/results/LATEST.json  # baseline
git add scripts/check_regression.py
git add scripts/slack_notify.py
git commit -m "[Scheduled] Configure weekly agent run + regression alerts"
git push
```

### Step 6: Let it run for 2–4 weeks unattended (watch only)

Check in after the first 2–3 runs. Look for:
- Does the report land in docs/reports/ every Monday?
- Does eval/results/ get a new JSON file each run?
- Are the scores stable week-to-week, or drifting?
- Any permission issues or auth failures?

If all good, you're done. The agent runs autonomously forever. If something breaks, you'll see it in the score drop and the regression alert will page you.

---

## Output artifacts

1. **`.claude/schedule.json`** or `/schedule` configuration
2. **`scripts/check_regression.py`** — regression detection
3. **`scripts/slack_notify.py`** (optional) — Slack notifications
4. **`eval/results/`** — timestamped JSON files, one per run
5. **Dashboard (optional)** — a simple web page showing `eval/results/` over time (score trends, pass/fail per check)

---

## Example: MTA Attribution Agent Schedule

**Schedule:** Monday 9am UTC, lookback=7 days (weekly report)

**Command:**
```bash
cd /home/Claude/mta && \
  python -m mta_agent --lookback 7 && \
  python eval/run_eval.py && \
  python scripts/check_regression.py
```

**Expected output:**
- `docs/reports/2026-06-16_attribution_report.md` (the report)
- `eval/results/2026-06-16T09-00-00Z.json` (eval score + per-check results)
- Slack notification: "Attribution report ready, score 0.92"
- If score drops below 0.87, regression alert: "ALERT: score dropped 5.3%"

**Monitoring:**
- Check eval/results/ once a week to spot trends
- Review the latest report in docs/reports/ to see if findings are sensible
- If score drops, check DECISIONS.md to see what the agent decided to change

---

## Checklist

- [ ] Agent CLI runs locally and produces a report
- [ ] Eval harness passes with ≥0.8 baseline score
- [ ] Schedule config is written (cron or `/schedule` format)
- [ ] Regression check script exists and works locally
- [ ] (Optional) Slack notification script exists
- [ ] Full command (agent + eval + regression + notify) runs end-to-end locally
- [ ] Schedule is committed to git
- [ ] You've run it manually 2–3 times and results look good
- [ ] Regression alert threshold is reasonable for your use case (5%? 10%? domain-specific?)

## Troubleshooting

**Issue:** Schedule runs but reports don't show up in docs/reports/

Check: Does the agent write to the right path? Is it creating the file in the cloud environment? Cloud agents may have different working directories. Use absolute paths or confirm `pwd` in the agent's output.

**Issue:** Eval runs but eval/results/ is empty

Check: Is eval/run_eval.py writing to the right path? Are permissions set correctly? Add logging to the eval runner to see where files are going.

**Issue:** Regression alert fires even though the report looks fine

Check: Did something in the data change? Did the SQL query break? Review the deterministic test failures in eval/results/LATEST.json — regression alerts trigger on score drop, but you need to debug which test failed.

## Next step

Once the agent is running on schedule, move to **Skill 4 (Iteration Loop Controller)** if you want to improve it further, or stick with what you have if the baseline eval is good enough.
